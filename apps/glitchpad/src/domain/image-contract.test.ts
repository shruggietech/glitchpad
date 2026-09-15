import { describe, expect, it } from 'vitest';
import { createImageSession, validateImageMetadata, validateImageResult, type ImageRenderResult } from './image-contract';
import { makeSession } from '../test/fixtures';

describe('image contract', () => {
  it('keeps image sessions independent from text edit/save behavior', () => {
    const source = makeSession('one', 'photo.png', 'Text', 'text', {}).source;
    const session = createImageSession(source, 'opaque', { identity: source.identity, byte_length: 12, modified_unix_nanos: null, change_token: null }, 'png', 'desktop');
    expect(session.text_document).toBeNull();
    expect(session.renderer.capabilities.edit).toBe(false);
    expect(session.renderer.capabilities.save).toBe(false);
    expect(session.image_document?.codec).toBe('png');
  });
  it('rejects location values and unknown observations before projection', () => {
    const base = { statuses: [], unknown_fields: 0, profile_present: false };
    const location = { key: 'image.location', family: 'exif', tag: 'GPSLatitude', block: 0, availability: 'redacted', value: null, original: null, duplicate: false };
    expect(validateImageMetadata({ ...base, observations: [location] })).toBe(true);
    expect(validateImageMetadata({ ...base, observations: [{ ...location, value: { kind: 'text', value: 'SECRET' } }] })).toBe(false);
    expect(validateImageMetadata({ ...base, observations: [{ ...location, key: 'unknown.payload' }] })).toBe(false);
  });
  it('checks delivered PNG dimensions against the admitted descriptor', () => {
    const source = makeSession('one', 'photo.png', 'Text', '', {}).source;
    const revision = { identity: source.identity, byte_length: 12, modified_unix_nanos: null, change_token: null };
    const bytes = [...atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')].map(c => c.charCodeAt(0));
    const result: ImageRenderResult = { source_id: 'opaque', request_id: 'request', external_revision: revision, failure: null, metadata: { observations: [], statuses: [], unknown_fields: 0, profile_present: false }, preview: {
      kind: 'full', png_bytes: bytes, descriptor: { contract_version: 1, family: 'raster', codec: 'png', width: 1, height: 1, display_width: 1, display_height: 1, pixels: 1, decoded_bytes: 4, orientation: 1, color_policy: 'rgba8_srgb_assumed', profile_status: 'not_provided', alpha: true, bits_per_pixel: 32, limitations: [], capabilities: { view: true, inspect_metadata: true, zoom: true, animate: false, select_frame: false, select_entry: false, export_entry: false, edit: false, save: false } },
    } };
    expect(validateImageResult(result, 'opaque', 'request', revision)).toBe(true);
    bytes[16] = 127;
    expect(validateImageResult(result, 'opaque', 'request', revision)).toBe(false);
  });
});
