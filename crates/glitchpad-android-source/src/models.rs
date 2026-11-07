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

#[cfg(any(target_os = "android", test))]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EncodedReadResponse {
    pub bytes_base64: String,
    pub end_of_source: bool,
}

#[cfg(any(target_os = "android", test))]
impl EncodedReadResponse {
    pub(crate) fn decode(self, maximum: u64) -> Result<ReadResponse, &'static str> {
        use base64::Engine as _;
        let maximum = usize::try_from(maximum).map_err(|_| "invalid_range_reply")?;
        let encoded_maximum = maximum.div_ceil(3).checked_mul(4).ok_or("invalid_range_reply")?;
        if self.bytes_base64.len() > encoded_maximum {
            return Err("invalid_range_reply");
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(self.bytes_base64)
            .map_err(|_| "invalid_range_reply")?;
        if bytes.len() > maximum || (!self.end_of_source && bytes.len() != maximum) {
            return Err("invalid_range_reply");
        }
        Ok(ReadResponse { bytes, end_of_source: self.end_of_source })
    }
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

#[derive(Clone, Debug, Serialize)]
pub struct ClipboardTextRequest<'a> {
    pub text: &'a str,
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

#[cfg(test)]
mod range_transport_tests {
    use super::*;
    use base64::Engine as _;

    fn reply(bytes: &[u8], terminal: bool) -> EncodedReadResponse {
        EncodedReadResponse {
            bytes_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
            end_of_source: terminal,
        }
    }

    #[test]
    fn encoded_ranges_preserve_all_byte_values_unicode_and_eof() {
        let binary: Vec<u8> = (0..=255).collect();
        let decoded = reply(&binary, false).decode(256).unwrap();
        assert_eq!(decoded.bytes, binary);
        assert!(!decoded.end_of_source);
        let unicode = "S047 Ω🙂\n".as_bytes();
        let decoded = reply(unicode, true).decode(256).unwrap();
        assert_eq!(decoded.bytes, unicode);
        assert!(decoded.end_of_source);
        let eof = reply(&[], true).decode(256).unwrap();
        assert!(eof.bytes.is_empty());
        assert!(eof.end_of_source);
    }

    #[test]
    fn malformed_oversized_or_nonterminal_short_replies_are_rejected() {
        assert!(EncodedReadResponse { bytes_base64: "invalid$".into(), end_of_source: true }.decode(256).is_err());
        assert!(reply(&[0; 33], true).decode(32).is_err());
        assert!(reply(&[0; 128], true).decode(1).is_err());
        assert!(reply(&[], false).decode(256).is_err());
        assert!(reply(&[1, 2], false).decode(3).is_err());
    }
}
