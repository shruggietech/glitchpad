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
    api: PluginApi<R, ()>,
) -> Result<AndroidSource<R>, tauri::Error> {
    Ok(AndroidSource(api.register_android_plugin(
        PLUGIN_IDENTIFIER,
        "AndroidSourcePlugin",
    )?))
}

impl<R: Runtime> AndroidSource<R> {
    pub fn drain_deliveries(&self, maximum: usize) -> Result<DeliveryBatch, String> {
        self.0
            .run_mobile_plugin("drainDeliveries", DrainRequest { maximum })
            .map_err(|error| error.to_string())
    }

    pub fn open_document(&self, media_type: Option<&str>) -> Result<BridgeDelivery, String> {
        self.0
            .run_mobile_plugin(
                "openDocument",
                PickerRequest {
                    media_type,
                    suggested_name: None,
                    bytes: None,
                },
            )
            .map_err(|error| error.to_string())
    }

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

    pub fn revalidate(&self, bridge_token: &str) -> Result<BridgeDelivery, String> {
        self.0
            .run_mobile_plugin("revalidate", TokenRequest { bridge_token })
            .map_err(|error| error.to_string())
    }

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

    pub fn close_stream(&self, stream_token: &str) -> Result<(), String> {
        self.0
            .run_mobile_plugin("closeStream", StreamTokenRequest { stream_token })
            .map_err(|error| error.to_string())
    }

    pub fn restore(&self) -> Result<DeliveryBatch, String> {
        self.0
            .run_mobile_plugin("restore", ())
            .map_err(|error| error.to_string())
    }

    pub fn save_as(
        &self,
        media_type: Option<&str>,
        suggested_name: &str,
        bytes: &[u8],
    ) -> Result<SaveAsResponse, String> {
        self.0
            .run_mobile_plugin(
                "saveAs",
                PickerRequest {
                    media_type,
                    suggested_name: Some(suggested_name),
                    bytes: Some(bytes),
                },
            )
            .map_err(|error| error.to_string())
    }

    pub fn close(&self, bridge_token: &str) -> Result<(), String> {
        self.0
            .run_mobile_plugin("close", TokenRequest { bridge_token })
            .map_err(|error| error.to_string())
    }

    pub fn discard(&self, bridge_token: &str) -> Result<(), String> {
        self.0
            .run_mobile_plugin("discard", TokenRequest { bridge_token })
            .map_err(|error| error.to_string())
    }
}
