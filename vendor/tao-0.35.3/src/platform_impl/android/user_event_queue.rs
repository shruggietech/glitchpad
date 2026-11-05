// SPDX-License-Identifier: Apache-2.0
//! Channel operations shared by the Android event loop and its host regressions.
use crossbeam_channel::{Receiver, Sender, TrySendError};

pub(super) fn send<T>(sender: &Sender<T>, event: T, wake: impl FnOnce()) -> Result<(), T> {
    sender.try_send(event).map_err(TrySendError::into_inner)?;
    wake();
    Ok(())
}

pub(super) fn drain<T>(receiver: &Receiver<T>, skip_dispatch: bool, mut dispatch: impl FnMut(T)) {
    if skip_dispatch {
        return;
    }
    while let Ok(event) = receiver.try_recv() {
        dispatch(event);
    }
}
