use tauri::plugin::{PluginApi, PluginHandle};
use tauri::{AppHandle, Runtime};

use crate::models::{
    BridgeDelivery, DeliveryBatch, DrainRequest, OpenStreamRequest, PickerRequest, ReadRequest,
    ReadResponse, ReadStreamRequest, SaveAsResponse, StreamOpened, StreamTokenRequest,
    TokenRequest,
};

const PLUGIN_IDENTIFIER: &str = "com.shruggietech.glitchpad.source";

pub struct AndroidSource<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Clone for AndroidSource<R> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

pub fn init<R: Runtime>(
    _app: &AppHandle<R>,
    api: &PluginApi<R, ()>,
) -> Result<AndroidSource<R>, tauri::Error> {
    Ok(AndroidSource(api.register_android_plugin(
        PLUGIN_IDENTIFIER,
        "AndroidSourcePlugin",
    )?))
}

impl<R: Runtime> AndroidSource<R> {
    /// Opens the bounded native PNG export flow.
    ///
    /// # Errors
    ///
    /// Returns the native bridge failure if selection, authority, or verified writing fails.
    pub fn export_image(
        &self,
        request: crate::models::ImageExportRequest<'_>,
    ) -> Result<crate::models::ImageExportResponse, String> {
        self.0
            .run_mobile_plugin("exportImage", request)
            .map_err(|e| e.to_string())
    }

    pub fn cancel_image_export(&self, request: &str) {
        let _ = self.0.run_mobile_plugin::<()>(
            "cancelImageExport",
            crate::models::ImageExportCancelRequest {
                request_id: request,
            },
        );
    }
    /// Drains bounded native document deliveries.
    ///
    /// # Errors
    ///
    /// Returns the bridge failure when the queue cannot be read.
    pub fn drain_deliveries(&self, maximum: usize) -> Result<DeliveryBatch, String> {
        self.0
            .run_mobile_plugin("drainDeliveries", DrainRequest { maximum })
            .map_err(|error| error.to_string())
    }

    /// Opens the native document picker.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure for cancellation, denied access, or provider failure.
    pub fn open_document(&self, media_type: Option<&str>) -> Result<BridgeDelivery, String> {
        self.0
            .run_mobile_plugin(
                "openDocument",
                PickerRequest {
                    media_type,
                    suggested_name: None,
                    bytes: None,
                    protected_bridge_token: None,
                },
            )
            .map_err(|error| error.to_string())
    }

    /// Reads one bounded native range.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure for absent authority, budget excess, or I/O failure.
    pub fn read_range(
        &self,
        bridge_token: &str,
        offset: u64,
        length: u64,
    ) -> Result<ReadResponse, String> {
        self.0
            .run_mobile_plugin(
                "readRange",
                ReadRequest {
                    bridge_token,
                    offset,
                    length,
                },
            )
            .map_err(|error| error.to_string())
    }

    /// Refreshes one registered source.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure when access is revoked or the provider is unavailable.
    pub fn revalidate(&self, bridge_token: &str) -> Result<BridgeDelivery, String> {
        self.0
            .run_mobile_plugin("revalidate", TokenRequest { bridge_token })
            .map_err(|error| error.to_string())
    }

    /// Opens a bounded native stream.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure for absent authority, budget excess, or I/O failure.
    pub fn open_stream(
        &self,
        bridge_token: &str,
        offset: u64,
        total_budget: u64,
    ) -> Result<StreamOpened, String> {
        self.0
            .run_mobile_plugin(
                "openStream",
                OpenStreamRequest {
                    bridge_token,
                    offset,
                    total_budget,
                },
            )
            .map_err(|error| error.to_string())
    }

    /// Reads a bounded native stream chunk.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure for a closed lease or I/O failure.
    pub fn read_stream(&self, stream_token: &str, length: u64) -> Result<ReadResponse, String> {
        self.0
            .run_mobile_plugin(
                "readStream",
                ReadStreamRequest {
                    stream_token,
                    length,
                },
            )
            .map_err(|error| error.to_string())
    }

    /// Closes a native stream lease.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure when the lease cannot be closed.
    pub fn close_stream(&self, stream_token: &str) -> Result<(), String> {
        self.0
            .run_mobile_plugin("closeStream", StreamTokenRequest { stream_token })
            .map_err(|error| error.to_string())
    }

    /// Restores persisted native document grants.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure if the restoration inventory is unavailable.
    pub fn restore(&self) -> Result<DeliveryBatch, String> {
        self.0
            .run_mobile_plugin("restore", ())
            .map_err(|error| error.to_string())
    }

    /// Creates and verifies an independent provider destination.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure for cancellation, alias/conflict refusal, or incomplete writing.
    pub fn save_as(
        &self,
        media_type: Option<&str>,
        suggested_name: &str,
        bytes: &[u8],
        protected_bridge_token: Option<&str>,
    ) -> Result<SaveAsResponse, String> {
        self.0
            .run_mobile_plugin(
                "saveAs",
                PickerRequest {
                    media_type,
                    suggested_name: Some(suggested_name),
                    bytes: Some(bytes),
                    protected_bridge_token,
                },
            )
            .map_err(|error| error.to_string())
    }

    /// Shares frozen JSON through a temporary read grant.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure when the chooser or bounded temporary export is unavailable.
    pub fn share_diagnostics(
        &self,
        json: &str,
    ) -> Result<crate::models::DiagnosticShareResponse, String> {
        self.0
            .run_mobile_plugin(
                "shareDiagnostics",
                crate::models::DiagnosticShareRequest { json },
            )
            .map_err(|error| error.to_string())
    }

    /// Queries native Android and `WebView` identity.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure when the environment query is unavailable.
    pub fn diagnostic_environment(
        &self,
    ) -> Result<crate::models::AndroidDiagnosticEnvironment, String> {
        self.0
            .run_mobile_plugin("diagnosticEnvironment", ())
            .map_err(|error| error.to_string())
    }

    /// Completes one committed native Back request.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure if the result cannot reach the active host.
    pub fn complete_back(&self, request_id: &str, handled: bool) -> Result<(), String> {
        self.0
            .run_mobile_plugin(
                "completeAndroidBack",
                crate::models::AndroidBackResponse {
                    request_id,
                    handled,
                },
            )
            .map_err(|error| error.to_string())
    }

    /// Releases one registered native document.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure if its resources cannot be released.
    pub fn close(&self, bridge_token: &str) -> Result<(), String> {
        self.0
            .run_mobile_plugin("close", TokenRequest { bridge_token })
            .map_err(|error| error.to_string())
    }

    /// Discards one redundant process-local native source.
    ///
    /// # Errors
    ///
    /// Returns a bridge failure if the bridge cannot release it.
    pub fn discard(&self, bridge_token: &str) -> Result<(), String> {
        self.0
            .run_mobile_plugin("discard", TokenRequest { bridge_token })
            .map_err(|error| error.to_string())
    }
}
