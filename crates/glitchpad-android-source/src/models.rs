use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct BridgeDelivery {
    pub bridge_token: String,
    pub delivery_kind: String,
    pub identity_scope: String,
    pub identity_token: String,
    pub identity_strength: String,
    pub display_name: String,
    pub media_type: Option<String>,
    pub byte_length: Option<u64>,
    pub modified_unix_ms: Option<i64>,
    pub read_granted: bool,
    pub write_granted: bool,
    pub persisted_read: bool,
    pub persisted_write: bool,
    pub seekable: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryBatch {
    pub deliveries: Vec<BridgeDelivery>,
    pub rejections: Vec<BridgeRejection>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeRejection {
    pub code: String,
    pub retryable: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrainRequest {
    pub maximum: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenRequest<'a> {
    pub bridge_token: &'a str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadRequest<'a> {
    pub bridge_token: &'a str,
    pub offset: u64,
    pub length: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadResponse {
    pub bytes: Vec<u8>,
    pub end_of_source: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenStreamRequest<'a> {
    pub bridge_token: &'a str,
    pub offset: u64,
    pub total_budget: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamOpened {
    pub stream_token: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadStreamRequest<'a> {
    pub stream_token: &'a str,
    pub length: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamTokenRequest<'a> {
    pub stream_token: &'a str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickerRequest<'a> {
    pub media_type: Option<&'a str>,
    pub suggested_name: Option<&'a str>,
    pub bytes: Option<&'a [u8]>,
    pub protected_bridge_token: Option<&'a str>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAsResponse {
    pub delivery: BridgeDelivery,
    pub byte_count: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageExportRequest<'a> {
    pub bridge_token: &'a str,
    pub request_id: &'a str,
    pub source_sha256: &'a str,
    pub bytes: &'a [u8],
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageExportCancelRequest<'a> {
    pub request_id: &'a str,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageExportResponse {
    pub exported: bool,
    pub byte_count: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticShareRequest<'a> {
    pub json: &'a str,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DiagnosticShareResponse {
    pub status: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEnvironmentRequest {
    pub include_viewport: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidViewportRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidDiagnosticViewport {
    pub webview_screen: AndroidViewportRect,
    pub visible_screen: AndroidViewportRect,
    pub view_width: u32,
    pub view_height: u32,
    pub density: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidDiagnosticEnvironment {
    pub android_version: String,
    pub api_level: u32,
    pub webview_version: Option<String>,
    pub webview_package: Option<String>,
    #[serde(default)]
    pub viewport: Option<AndroidDiagnosticViewport>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidBackResponse<'a> {
    pub request_id: &'a str,
    pub handled: bool,
}

/// Installed package facts read from Android's package manager.
#[derive(Clone, Debug, Deserialize)]
pub struct InstalledApplicationInfo {
    pub package_identifier: String,
    pub version: String,
    pub version_code: u64,
    pub channel: String,
    pub platform: String,
}
