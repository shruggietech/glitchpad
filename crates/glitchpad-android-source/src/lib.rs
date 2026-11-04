pub mod models;

#[cfg(target_os = "android")]
mod mobile;

use tauri::Runtime;
use tauri::plugin::{Builder, TauriPlugin};

#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
pub use mobile::AndroidSource;

/// Plugin identity shared by native registration and its command permissions.
pub const PLUGIN_NAME: &str = env!("CARGO_PKG_NAME");

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    let builder = Builder::new(PLUGIN_NAME);
    #[cfg(target_os = "android")]
    let builder = builder.setup(|app, api| {
        app.manage(mobile::init(app, &api)?);
        Ok(())
    });
    builder.build()
}

#[cfg(target_os = "android")]
pub trait AndroidSourceExt<R: Runtime> {
    fn android_source(&self) -> tauri::State<'_, AndroidSource<R>>;
}

#[cfg(target_os = "android")]
impl<R: Runtime, T: Manager<R>> AndroidSourceExt<R> for T {
    fn android_source(&self) -> tauri::State<'_, AndroidSource<R>> {
        self.state::<AndroidSource<R>>()
    }
}
