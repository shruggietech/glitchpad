//! Bounded wire representations for the existing Android range operation.

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::source::{MAX_SOURCE_CHUNK_BYTES, ReadRangeResult};

pub(crate) fn encode(
    result: ReadRangeResult,
    binary: bool,
) -> Result<tauri::ipc::Response, CoreError> {
    if result.bytes.len() as u64 > MAX_SOURCE_CHUNK_BYTES {
        return Err(invalid_response());
    }
    if binary {
        let mut frame = Vec::with_capacity(result.bytes.len() + 1);
        frame.push(u8::from(result.end_of_source));
        frame.extend(result.bytes);
        Ok(tauri::ipc::Response::new(frame))
    } else {
        serde_json::to_string(&result)
            .map(tauri::ipc::Response::new)
            .map_err(|_| invalid_response())
    }
}

fn invalid_response() -> CoreError {
    CoreError::new(
        CoreErrorCategory::InternalInvariant,
        "Android range response could not be encoded",
        false,
        false,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use glitchpad_core::source::SourceId;
    use tauri::ipc::{InvokeResponseBody, IpcResponse};

    fn range(bytes: Vec<u8>, terminal: bool) -> ReadRangeResult {
        ReadRangeResult {
            source_id: SourceId("source".into()),
            offset: 17,
            bytes,
            end_of_source: terminal,
        }
    }

    #[test]
    fn raw_frames_preserve_every_byte_and_explicit_eof() {
        let bytes: Vec<u8> = (0..=255).collect();
        let InvokeResponseBody::Raw(frame) = encode(range(bytes.clone(), false), true)
            .unwrap()
            .body()
            .unwrap()
        else {
            panic!("raw response required")
        };
        assert_eq!(frame[0], 0);
        assert_eq!(&frame[1..], bytes);
        let InvokeResponseBody::Raw(eof) = encode(range(Vec::new(), true), true)
            .unwrap()
            .body()
            .unwrap()
        else {
            panic!("raw EOF required")
        };
        assert_eq!(eof, [1]);
    }

    #[test]
    fn default_json_keeps_source_offset_bytes_and_terminal_state() {
        let InvokeResponseBody::Json(body) = encode(range(vec![0, 128, 255], true), false)
            .unwrap()
            .body()
            .unwrap()
        else {
            panic!("legacy JSON required")
        };
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["source_id"], "source");
        assert_eq!(value["offset"], 17);
        assert_eq!(value["bytes"], serde_json::json!([0, 128, 255]));
        assert_eq!(value["end_of_source"], true);
    }

    #[test]
    fn neither_wire_mode_can_expand_the_existing_range_budget() {
        for binary in [false, true] {
            assert!(
                encode(
                    range(
                        vec![0; usize::try_from(MAX_SOURCE_CHUNK_BYTES).unwrap() + 1],
                        true
                    ),
                    binary
                )
                .is_err()
            );
        }
    }
}
