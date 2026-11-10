# Glitchpad Android user event queue patch

Base: crates.io tao0.37.2, archive SHA256d5777b06fe6435126ae8d816eba269e050e1e10d302cf5461e9c49eccabc3548. Original license texts remain in this directory.

The 2026-11-09 dependency convergence carries the existing Android poll-once and user event queue fixes from tao0.35.3. Every poll result admits queued user events after native sources, except the initial pre-poll pass and a source-requested exit. An exit during an admitted drain remains sticky through the upstream event dispatcher. Sending to a closed queue returns the event without waking the looper. Host regression tests remain in tests/android_user_event_queue.rs.
