//! Scheduling boundary for Android operations that wait on native UI or I/O.

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};

pub(crate) async fn run<T, F>(operation: F) -> Result<T, CoreError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, CoreError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|_| {
            CoreError::new(
                CoreErrorCategory::Unavailable,
                "The native Android operation did not complete",
                true,
                true,
            )
        })?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::Future;
    use std::sync::mpsc;
    use std::task::{Context, Poll, Waker};
    use std::time::Duration;

    #[test]
    fn held_native_work_does_not_block_the_dispatching_thread_or_resolve_early() {
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let (progress_tx, progress_rx) = mpsc::channel();
        let caller = std::thread::spawn(move || {
            let caller_id = std::thread::current().id();
            let mut operation = Box::pin(run(move || {
                entered_tx.send(std::thread::current().id()).unwrap();
                release_rx.recv().unwrap();
                Ok(b"verified native receipt".to_vec())
            }));
            match operation
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop()))
            {
                Poll::Pending => {
                    progress_tx.send((caller_id, true)).unwrap();
                    tauri::async_runtime::block_on(operation)
                }
                Poll::Ready(result) => {
                    progress_tx.send((caller_id, false)).unwrap();
                    result
                }
            }
        });
        let worker_id = entered_rx.recv_timeout(Duration::from_secs(2));
        let progress = progress_rx.recv_timeout(Duration::from_secs(2));
        let completed_before_release = caller.is_finished();
        // Release before asserting so a regression cannot strand a held worker.
        let _ = release_tx.send(());
        let receipt = caller.join().unwrap().unwrap();
        let (caller_id, yielded) = progress.unwrap();
        assert!(
            yielded,
            "the first poll must return while native work is held"
        );
        assert_ne!(worker_id.unwrap(), caller_id);
        assert!(!completed_before_release);
        assert_eq!(receipt, b"verified native receipt");
    }

    #[test]
    fn native_domain_errors_and_cancellation_context_are_unchanged() {
        let expected = CoreError::new(
            CoreErrorCategory::CapabilityDenied,
            "The destination picker was cancelled",
            true,
            true,
        )
        .with_context("reason", "picker_cancelled");
        let native_error = expected.clone();
        let result = tauri::async_runtime::block_on(run::<(), _>(move || Err(native_error)));
        assert_eq!(result, Err(expected));
    }

    #[test]
    fn worker_join_failures_return_only_the_static_bounded_error() {
        let error = tauri::async_runtime::block_on(run::<(), _>(|| {
            panic!("SYNTHETIC_PRIVATE_PROVIDER_URI_AND_DOCUMENT_BYTES");
        }))
        .unwrap_err();
        assert_eq!(error.category, CoreErrorCategory::Unavailable);
        assert_eq!(
            error.summary,
            "The native Android operation did not complete"
        );
        assert!(error.retryable && error.recoverable);
        assert!(error.context.is_empty());
        let output = serde_json::to_string(&error).unwrap();
        assert!(!output.contains("SYNTHETIC_PRIVATE"));
        assert!(!output.contains("panic"));
    }
}
