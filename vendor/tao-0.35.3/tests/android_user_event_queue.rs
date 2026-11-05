// SPDX-License-Identifier: Apache-2.0
#[path = "../src/platform_impl/android/user_event_queue.rs"]
mod user_event_queue;

use crossbeam_channel::unbounded;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

#[test]
fn closed_receiver_returns_the_original_payload_without_waking() {
    let (sender, receiver) = unbounded();
    drop(receiver);
    let wake_count = AtomicUsize::new(0);
    let payload = vec![1_u8, 2, 3];
    let result = user_event_queue::send(&sender, payload.clone(), || {
        wake_count.fetch_add(1, Ordering::SeqCst);
    });
    assert_eq!(result, Err(payload));
    assert_eq!(wake_count.load(Ordering::SeqCst), 0);
}

#[test]
fn accepted_event_is_in_the_queue_before_the_single_wake() {
    let (sender, receiver) = unbounded();
    let wake_count = AtomicUsize::new(0);
    let result = user_event_queue::send(&sender, 7, || {
        assert_eq!(receiver.try_recv(), Ok(7));
        wake_count.fetch_add(1, Ordering::SeqCst);
    });
    assert_eq!(result, Ok(()));
    assert_eq!(wake_count.load(Ordering::SeqCst), 1);
    assert!(receiver.is_empty());
}

#[test]
fn drain_preserves_fifo_and_services_work_enqueued_during_dispatch_exactly_once() {
    let (sender, receiver) = unbounded();
    sender.send(1).unwrap();
    sender.send(2).unwrap();
    let mut observed = Vec::new();
    user_event_queue::drain(&receiver, false, |event| {
        observed.push(event);
        if event == 1 {
            sender.send(3).unwrap();
        }
    });
    user_event_queue::drain(&receiver, false, |event| observed.push(event));
    assert_eq!(observed, [1, 2, 3]);
    assert!(receiver.is_empty());
}

#[test]
fn work_from_a_concurrent_producer_is_serviced_before_returning_to_poll() {
    let (sender, receiver) = unbounded();
    let (entered_tx, entered_rx) = unbounded();
    let (sent_tx, sent_rx) = unbounded();
    sender.send(1).unwrap();
    let producer = std::thread::spawn(move || {
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        sender.send(2).unwrap();
        sender.send(3).unwrap();
        sent_tx.send(()).unwrap();
    });
    let mut observed = Vec::new();
    user_event_queue::drain(&receiver, false, |event| {
        observed.push(event);
        if event == 1 {
            entered_tx.send(()).unwrap();
            sent_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        }
    });
    producer.join().unwrap();
    assert_eq!(observed, [1, 2, 3]);
    assert!(receiver.is_empty());
}

#[test]
fn native_source_exit_leaves_queued_work_unserviced() {
    let (sender, receiver) = unbounded();
    sender.send(1).unwrap();
    user_event_queue::drain(&receiver, true, |_| {
        panic!("source exit must suppress user dispatch")
    });
    assert_eq!(receiver.try_recv(), Ok(1));
}

#[cfg(target_os = "android")]
mod android_loop {
    use ndk::looper::{FdEvent, Poll, ThreadLooper};
    use std::{
        io::{Read, Write},
        os::{fd::AsFd, unix::net::UnixStream},
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
        time::{Duration, Instant},
    };
    use tao::{
        event::{Event, StartCause},
        event_loop::{ControlFlow, EventLoopBuilder},
        platform::{
            android::prelude::NDK_GLUE_LOOPER_INPUT_QUEUE_IDENT, run_return::EventLoopExtRunReturn,
        },
    };

    #[derive(Clone, Copy, Debug)]
    enum PollCase {
        Wake,
        Source,
        Callback,
        Timeout,
    }
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    enum Work {
        First,
        Second,
        Rescue,
    }

    #[test]
    fn real_run_return_services_source_callback_and_timeout_with_fifo_and_sticky_exit() {
        for case in [
            PollCase::Wake,
            PollCase::Source,
            PollCase::Callback,
            PollCase::Timeout,
        ] {
            let looper = ThreadLooper::prepare();
            let mut event_loop = EventLoopBuilder::<Work>::with_user_event().build();
            let proxy = event_loop.create_proxy();
            let (mut reader, mut writer) = UnixStream::pair().unwrap();
            reader.set_nonblocking(true).unwrap();
            let mut rescue_reader = reader.try_clone().unwrap();
            let source_fd = reader.as_fd();
            let callback_ran = Arc::new(AtomicBool::new(false));
            if matches!(case, PollCase::Callback) {
                let seen = callback_ran.clone();
                let mut callback_reader = reader.try_clone().unwrap();
                looper
                    .add_fd_with_callback(source_fd, FdEvent::INPUT, move |_, _| {
                        let _ = callback_reader.read(&mut [0]);
                        seen.store(true, Ordering::SeqCst);
                        false
                    })
                    .unwrap();
            } else if matches!(case, PollCase::Source) {
                looper
                    .as_foreign()
                    .add_fd(
                        source_fd,
                        NDK_GLUE_LOOPER_INPUT_QUEUE_IDENT,
                        FdEvent::INPUT,
                        std::ptr::null_mut(),
                    )
                    .unwrap();
            }
            let (done_tx, done_rx) = crossbeam_channel::unbounded();
            let rescued = Arc::new(AtomicBool::new(false));
            let rescue_flag = rescued.clone();
            let rescue_proxy = proxy.clone();
            let rescue = std::thread::spawn(move || {
                if done_rx.recv_timeout(Duration::from_secs(2)).is_err() {
                    rescue_flag.store(true, Ordering::SeqCst);
                    let _ = rescue_reader.read(&mut [0]);
                    let _ = rescue_proxy.send_event(Work::Rescue);
                }
            });
            let mut armed = false;
            let mut observed = Vec::new();
            let mut requested_resume = None;
            let mut observed_start = None;
            let code = event_loop.run_return(|event, _, control_flow| match event {
                Event::NewEvents(cause) if armed && observed_start.is_none() => {
                    observed_start = Some((cause, Instant::now()));
                }
                Event::RedrawEventsCleared if !armed => {
                    armed = true;
                    proxy.send_event(Work::First).unwrap();
                    proxy.send_event(Work::Second).unwrap();
                    let deadline = if matches!(case, PollCase::Timeout) {
                        Instant::now()
                    } else {
                        Instant::now() + Duration::from_secs(5)
                    };
                    requested_resume = Some(deadline);
                    if matches!(case, PollCase::Timeout) {
                        // Consume the public proxy's wake while retaining its queued work.
                        assert!(matches!(
                            looper.poll_once_timeout(Duration::ZERO).unwrap(),
                            Poll::Wake
                        ));
                    } else if !matches!(case, PollCase::Wake) {
                        writer.write_all(&[1]).unwrap();
                    }
                    *control_flow = ControlFlow::WaitUntil(deadline);
                }
                Event::UserEvent(work) => {
                    observed.push(work);
                    if work == Work::First {
                        if matches!(case, PollCase::Source) && !rescued.load(Ordering::SeqCst) {
                            assert_eq!(reader.read(&mut [0]).unwrap(), 1);
                        }
                        *control_flow = ControlFlow::ExitWithCode(7);
                    } else if work == Work::Second {
                        let _ = done_tx.send(());
                        *control_flow = ControlFlow::Poll; // A prior exit must remain sticky.
                    } else {
                        *control_flow = ControlFlow::ExitWithCode(9);
                    }
                }
                _ => {}
            });
            rescue.join().unwrap();
            if matches!(case, PollCase::Source) {
                looper.as_foreign().remove_fd(reader.as_fd()).unwrap();
            }
            assert!(
                !rescued.load(Ordering::SeqCst),
                "queued work must not require a rescue wake: {case:?}"
            );
            assert_eq!(observed, [Work::First, Work::Second], "{case:?}");
            assert_eq!(code, 7, "exit must stay sticky: {case:?}");
            let deadline = requested_resume.unwrap();
            let (cause, observed_at) = observed_start.unwrap();
            match (case, cause) {
                (
                    PollCase::Timeout,
                    StartCause::ResumeTimeReached {
                        requested_resume, ..
                    },
                ) => {
                    assert_eq!(requested_resume, deadline);
                    assert!(observed_at >= deadline);
                }
                (
                    _,
                    StartCause::WaitCancelled {
                        start,
                        requested_resume: Some(requested),
                        ..
                    },
                ) if !matches!(case, PollCase::Timeout) => {
                    assert_eq!(requested, deadline);
                    assert!(
                        start < deadline,
                        "wait must start before its controlled deadline"
                    );
                    assert!(
                        observed_at < deadline,
                        "{case:?} must interrupt before the deadline"
                    );
                }
                (_, unexpected) => {
                    panic!("wrong deadline classification for {case:?}: {unexpected:?}")
                }
            }
            if matches!(case, PollCase::Callback) {
                assert!(
                    callback_ran.load(Ordering::SeqCst),
                    "native callback must precede user work"
                );
            }
        }
    }

    #[test]
    fn real_closed_proxy_retains_payload_and_does_not_wake() {
        let looper = ThreadLooper::prepare();
        let event_loop = EventLoopBuilder::<Vec<u8>>::with_user_event().build();
        let proxy = event_loop.create_proxy();
        drop(event_loop);
        assert_eq!(
            proxy.send_event(vec![1, 2, 3]),
            Err(tao::event_loop::EventLoopClosed(vec![1, 2, 3]))
        );
        assert!(matches!(
            looper.poll_once_timeout(Duration::ZERO).unwrap(),
            Poll::Timeout
        ));
    }
}
