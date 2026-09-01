//! Tauri host boundary for desktop and Android builds.

use tauri::Manager;

#[cfg(not(mobile))]
pub mod source;

/// Starts the Glitchpad host shell.
///
/// # Panics
///
/// Panics when the host cannot initialize or process a runtime event.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let product = glitchpad_core::product_info();

    let builder = tauri::Builder::default();
    #[cfg(not(mobile))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        source::read_source_range,
        source::open_source_stream,
        source::read_source_stream,
        source::query_source_metadata,
        source::start_source_watch,
        source::drain_source_events,
        source::revalidate_source,
        source::save_source,
        source::close_source,
    ]);

    builder
        .setup(move |app| {
            app.manage(product);
            #[cfg(not(mobile))]
            app.manage(source::DesktopSourceHost::new());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Glitchpad host failed while processing a runtime event");
}
