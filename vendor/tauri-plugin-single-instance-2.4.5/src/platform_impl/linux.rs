// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#[cfg(feature = "semver")]
use crate::semver_compat::semver_compat_string;

use crate::SingleInstanceCallback;
use tauri::{
    plugin::{self, TauriPlugin},
    AppHandle, Manager, RunEvent, Runtime,
};
use zbus::{interface, names::WellKnownName, Connection};

// zbus 6 is async-only. Use Tauri's persistent runtime from a scoped worker
// so synchronous plugin entry points also work inside a Tokio task.
fn block_on<F: std::future::Future + Send>(future: F) -> F::Output
where
    F::Output: Send,
{
    std::thread::scope(|scope| {
        scope
            .spawn(|| tauri::async_runtime::block_on(future))
            .join()
            .expect("D-Bus runtime worker panicked")
    })
}

struct ConnectionHandle(Connection);

struct SingleInstanceDBus<R: Runtime> {
    callback: Box<SingleInstanceCallback<R>>,
    app_handle: AppHandle<R>,
}

#[interface(name = "org.SingleInstance.DBus")]
impl<R: Runtime> SingleInstanceDBus<R> {
    fn execute_callback(&mut self, argv: Vec<String>, cwd: String) {
        (self.callback)(&self.app_handle, argv, cwd);
    }
}

struct DBusName(String);

pub fn init<R: Runtime>(
    callback: Box<SingleInstanceCallback<R>>,
    dbus_id: Option<String>,
) -> TauriPlugin<R> {
    plugin::Builder::new("single-instance")
        .setup(move |app, _api| {
            let mut dbus_name = dbus_id.unwrap_or_else(|| app.config().identifier.clone());
            dbus_name.push_str(".SingleInstance");

            #[cfg(feature = "semver")]
            {
                dbus_name.push('_');
                dbus_name.push_str(semver_compat_string(&app.package_info().version).as_str());
            }

            let mut dbus_path = dbus_name.replace('.', "/").replace('-', "_");
            if !dbus_path.starts_with('/') {
                dbus_path = format!("/{dbus_path}");
            }

            let single_instance_dbus = SingleInstanceDBus {
                callback,
                app_handle: app.clone(),
            };

            match block_on(
                zbus::connection::Builder::session()
                    .name(dbus_name.as_str())
                    .replace_existing_names(false)
                    .allow_name_replacements(false)
                    .serve_at(dbus_path.as_str(), single_instance_dbus)
                    .build(),
            ) {
                Ok(connection) => {
                    app.manage(ConnectionHandle(connection));
                }
                Err(zbus::Error::NameTaken) => {
                    if let Ok(connection) = block_on(Connection::session()) {
                        let _ = block_on(
                            connection.call_method(
                                Some(dbus_name.as_str()),
                                dbus_path.as_str(),
                                Some("org.SingleInstance.DBus"),
                                "ExecuteCallback",
                                &(
                                    std::env::args().collect::<Vec<String>>(),
                                    std::env::current_dir()
                                        .unwrap_or_default()
                                        .to_str()
                                        .unwrap_or_default(),
                                ),
                            ),
                        );
                    }
                    app.cleanup_before_exit();
                    std::process::exit(0);
                }
                _ => {}
            }

            app.manage(DBusName(dbus_name));

            Ok(())
        })
        .on_event(move |app, event| {
            if let RunEvent::Exit = event {
                destroy(app);
            }
        })
        .build()
}

pub fn destroy<R: Runtime, M: Manager<R>>(manager: &M) {
    if let Some(connection) = manager.try_state::<ConnectionHandle>() {
        if let Some(dbus_name) = manager
            .try_state::<DBusName>()
            .and_then(|name| WellKnownName::try_from(name.0.clone()).ok())
        {
            let _ = block_on(connection.0.release_name(dbus_name));
        }
    }
}

#[cfg(test)]
mod s043_tests {
    use super::*;
    struct Probe;
    #[zbus::interface(name = "org.Glitchpad.S043")]
    impl Probe {
        fn echo(&self, value: &str) -> String {
            value.to_owned()
        }
    }
    #[test]
    fn persistent_runtime_serves_nested_callers_and_releases_its_name() {
        assert!(
            std::env::var_os("DBUS_SESSION_BUS_ADDRESS").is_some(),
            "run under dbus-run-session"
        );
        let name = format!("org.Glitchpad.S043.p{}", std::process::id());
        let connection = block_on(
            zbus::connection::Builder::session()
                .name(name.as_str())
                .serve_at("/org/Glitchpad/S043", Probe)
                .build(),
        )
        .unwrap();
        for _ in 0..3 {
            let value = tauri::async_runtime::block_on(async {
                block_on(async {
                    let client = Connection::session().await.unwrap();
                    let message = client
                        .call_method(
                            Some(name.as_str()),
                            "/org/Glitchpad/S043",
                            Some("org.Glitchpad.S043"),
                            "Echo",
                            &("forwarded",),
                        )
                        .await
                        .unwrap();
                    message.body().deserialize::<String>().unwrap()
                })
            });
            assert_eq!(value, "forwarded");
        }
        assert!(block_on(connection.release_name(name.as_str())).unwrap());
        let replacement = block_on(
            zbus::connection::Builder::session()
                .name(name.as_str())
                .build(),
        )
        .unwrap();
        assert!(block_on(replacement.release_name(name.as_str())).unwrap());
    }
}
