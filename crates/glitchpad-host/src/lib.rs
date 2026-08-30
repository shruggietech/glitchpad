//! Tauri host boundary for desktop and Android builds.

use tauri::Manager;

/// Starts the Glitchpad host shell.
///
/// # Panics
///
/// Panics when the host cannot initialize or process a runtime event.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let product = glitchpad_core::product_info();

    tauri::Builder::default()
        .setup(move |app| {
            app.manage(product);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Glitchpad host failed while processing a runtime event");
}
