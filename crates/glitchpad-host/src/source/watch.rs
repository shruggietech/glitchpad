//! Native desktop watcher registration and safe event mapping.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{Receiver, TryRecvError, channel};

use glitchpad_core::source::SourceState;
use notify::event::{ModifyKind, RenameMode};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use super::safe_watch_error;

pub(super) struct WatchRegistration {
    _watcher: RecommendedWatcher,
    receiver: Receiver<notify::Result<Event>>,
    watched_parent: PathBuf,
}

impl WatchRegistration {
    pub fn start(path: &Path) -> Result<Self, glitchpad_core::contracts::CoreError> {
        let parent = path.parent().ok_or_else(|| {
            glitchpad_core::contracts::CoreError::new(
                glitchpad_core::contracts::CoreErrorCategory::InvalidInput,
                "The source does not have a watchable parent directory",
                false,
                false,
            )
        })?;
        let (sender, receiver) = channel();
        let mut watcher = notify::recommended_watcher(sender)
            .map_err(|error| safe_watch_error(&error, "watch_create"))?;
        watcher
            .watch(parent, RecursiveMode::NonRecursive)
            .map_err(|error| safe_watch_error(&error, "watch_start"))?;
        Ok(Self {
            _watcher: watcher,
            receiver,
            watched_parent: parent.to_path_buf(),
        })
    }

    pub fn try_next(&self, source_path: &Path) -> Option<MappedWatchEvent> {
        loop {
            match self.receiver.try_recv() {
                Ok(Ok(event)) => {
                    if let Some(mapped) = map_event(&event, source_path, &self.watched_parent) {
                        return Some(mapped);
                    }
                }
                Ok(Err(_)) => {
                    return Some(MappedWatchEvent {
                        state: SourceState::Unavailable,
                        renamed_path: None,
                    });
                }
                Err(TryRecvError::Empty | TryRecvError::Disconnected) => return None,
            }
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct MappedWatchEvent {
    pub state: SourceState,
    pub renamed_path: Option<PathBuf>,
}

pub(super) fn map_event(
    event: &Event,
    source_path: &Path,
    watched_parent: &Path,
) -> Option<MappedWatchEvent> {
    if event.need_rescan() {
        return Some(MappedWatchEvent {
            state: SourceState::WatcherOverflow,
            renamed_path: None,
        });
    }

    let related = event.paths.is_empty()
        || event.paths.iter().any(|path| {
            path == source_path
                || path.parent() == Some(watched_parent) && path.file_name() == source_path.file_name()
        });
    if !related {
        return None;
    }

    let (state, renamed_path) = match &event.kind {
        EventKind::Remove(_) => (SourceState::Deleted, None),
        EventKind::Modify(ModifyKind::Name(mode)) => {
            let candidate = match mode {
                RenameMode::Both | RenameMode::To | RenameMode::Any | RenameMode::Other => {
                    event.paths.last().filter(|path| path.as_path() != source_path).cloned()
                }
                RenameMode::From => None,
                _ => None,
            };
            (SourceState::Renamed, candidate)
        }
        EventKind::Modify(_) | EventKind::Create(_) => (SourceState::Changed, None),
        EventKind::Other | EventKind::Any => (SourceState::WatcherOverflow, None),
        EventKind::Access(_) => return None,
        _ => (SourceState::WatcherOverflow, None),
    };
    Some(MappedWatchEvent {
        state,
        renamed_path,
    })
}

#[cfg(test)]
mod tests {
    use notify::event::{Flag, ModifyKind};

    use super::*;

    #[test]
    fn rescan_flag_maps_to_stable_overflow() {
        let event = Event::new(EventKind::Other).set_flag(Flag::Rescan);
        assert_eq!(
            map_event(&event, Path::new("/tmp/a.md"), Path::new("/tmp")),
            Some(MappedWatchEvent {
                state: SourceState::WatcherOverflow,
                renamed_path: None,
            })
        );
    }

    #[test]
    fn two_path_rename_preserves_candidate_without_exposing_it_in_contract() {
        let event = Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Both)))
            .add_path(PathBuf::from("/tmp/a.md"))
            .add_path(PathBuf::from("/tmp/b.md"));
        let mapped = map_event(&event, Path::new("/tmp/a.md"), Path::new("/tmp"))
            .expect("mapped rename");
        assert_eq!(mapped.state, SourceState::Renamed);
        assert_eq!(mapped.renamed_path, Some(PathBuf::from("/tmp/b.md")));
    }

    #[test]
    fn unrelated_parent_event_is_filtered() {
        let event = Event::new(EventKind::Modify(ModifyKind::Any))
            .add_path(PathBuf::from("/tmp/unrelated.md"));
        assert_eq!(
            map_event(&event, Path::new("/tmp/a.md"), Path::new("/tmp")),
            None
        );
    }
}
