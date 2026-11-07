import { describe, expect, it } from 'vitest';
import {
  IMAGE_FAILURE_CODES,
  imageDecodeFailure,
  imageFailureMessage,
  createImageSession,
  validateImageMetadata,
  validateImageResult,
  type ImageRenderResult,
} from './image-contract';
import { makeSession } from '../test/fixtures';

describe('image contract', () => {
  it('keeps image sessions independent from text edit/save behavior', () => {
    const source = makeSession('one', 'photo.png', 'Text', 'text', {}).source;
    const session = createImageSession(
      source,
      'opaque',
      {
        identity: source.identity,
        byte_length: 12,
        modified_unix_nanos: null,
        change_token: null,
      },
      'png',
      'desktop',
    );
    expect(session.text_document).toBeNull();
    expect(session.renderer.capabilities.edit).toBe(false);
    expect(session.renderer.capabilities.save).toBe(false);
    expect(session.image_document?.codec).toBe('png');
  });
  it('rejects location values and unknown observations before projection', () => {
    const base = { statuses: [], unknown_fields: 0, profile_present: false };
    const location = {
      key: 'image.location',
      family: 'exif',
      tag: 'GPSLatitude',
      block: 0,
      availability: 'redacted',
      value: null,
      original: null,
      duplicate: false,
    };
    expect(validateImageMetadata({ ...base, observations: [location] })).toBe(
      true,
    );
    expect(
      validateImageMetadata({
        ...base,
        observations: [
          { ...location, value: { kind: 'text', value: 'SECRET' } },
        ],
      }),
    ).toBe(false);
    expect(
      validateImageMetadata({
        ...base,
        observations: [{ ...location, key: 'unknown.payload' }],
      }),
    ).toBe(false);
  });
  it('checks delivered PNG dimensions against the admitted descriptor', () => {
    const source = makeSession('one', 'photo.png', 'Text', '', {}).source;
    const revision = {
      identity: source.identity,
      byte_length: 12,
      modified_unix_nanos: null,
      change_token: null,
    };
    const bytes = [
      ...atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      ),
    ].map((c) => c.charCodeAt(0));
    const result: ImageRenderResult = {
      source_id: 'opaque',
      request_id: 'request',
      external_revision: revision,
      failure: null,
      metadata: {
        observations: [],
        statuses: [],
        unknown_fields: 0,
        profile_present: false,
      },
      preview: {
        kind: 'full',
        png_bytes: bytes,
        descriptor: {
          contract_version: 1,
          family: 'raster',
          codec: 'png',
          width: 1,
          height: 1,
          display_width: 1,
          display_height: 1,
          pixels: 1,
          decoded_bytes: 4,
          orientation: 1,
          color_policy: 'rgba8_srgb_assumed',
          profile_status: 'not_provided',
          alpha: true,
          bits_per_pixel: 32,
          limitations: [],
          capabilities: {
            view: true,
            inspect_metadata: true,
            zoom: true,
            animate: false,
            select_frame: false,
            select_entry: false,
            export_entry: false,
            edit: false,
            save: false,
          },
        },
      },
    };
    expect(validateImageResult(result, 'opaque', 'request', revision)).toBe(
      true,
    );
    const svg = structuredClone(result);
    Object.assign(svg.preview!.descriptor, { family: 'svg', codec: 'svg' });
    Object.assign(svg, {
      family_state: {
        family: 'svg',
        output: 'rasterized_png',
        external_resources: false,
        scripts: false,
        max_nodes: 50000,
        max_depth: 128,
      },
    });
    expect(validateImageResult(svg, 'opaque', 'request', revision)).toBe(true);
    Object.assign(svg, {
      family_state: {
        family: 'svg',
        output: 'safe_tree',
        external_resources: true,
        scripts: true,
        max_nodes: 50000,
        max_depth: 128,
      },
    });
    expect(validateImageResult(svg, 'opaque', 'request', revision)).toBe(false);
    const icon = structuredClone(result);
    Object.assign(icon.preview!.descriptor, {
      family: 'ico',
      codec: 'ico',
      capabilities: {
        ...result.preview!.descriptor.capabilities,
        select_entry: true,
        export_entry: true,
      },
    });
    icon.family_state = {
      family: 'ico',
      entries: [
        {
          index: 0,
          width: 1,
          height: 1,
          bits_per_pixel: 65535,
          encoded_bytes: 57,
          preview: 'full',
          encoding: 'png',
          alpha: true,
          failure: null,
          duplicate_of: null,
        },
      ],
      selected_entry: 0,
      selected_entry_export: true,
    };
    expect(validateImageResult(icon, 'opaque', 'request', revision)).toBe(true);
    icon.family_state.entries.push({
      ...icon.family_state.entries[0],
      index: 1,
      encoded_bytes: 0xffff_ffff,
      encoding: 'unknown',
      failure: 'truncated',
      preview: 'unavailable',
    });
    expect(validateImageResult(icon, 'opaque', 'request', revision)).toBe(true);
    Object.assign(result, { family_state: icon.family_state });
    expect(validateImageResult(result, 'opaque', 'request', revision)).toBe(
      false,
    );
    delete result.family_state;
    bytes[16] = 127;
    expect(validateImageResult(result, 'opaque', 'request', revision)).toBe(
      false,
    );
  });
});

it('accepts only declared refusal codes with unavailable inert SVG state and stable Retry disposition', () => {
  const source = makeSession('reason', 'diagram.svg', 'Text', '', {}).source;
  const revision = {
    identity: source.identity,
    byte_length: 1,
    modified_unix_nanos: null,
    change_token: null,
  };
  const result = {
    source_id: 'source',
    request_id: 'request',
    external_revision: revision,
    preview: null,
    failure: 'svg_external_reference',
    metadata: {
      observations: [],
      statuses: [],
      unknown_fields: 0,
      profile_present: false,
    },
    family_state: {
      family: 'svg',
      output: 'unavailable',
      external_resources: false,
      scripts: false,
      max_nodes: 50000,
      max_depth: 128,
    },
  };
  for (const reason of IMAGE_FAILURE_CODES) {
    expect(
      validateImageResult(
        { ...result, failure: reason },
        'source',
        'request',
        revision,
      ),
    ).toBe(true);
    if (reason.startsWith('svg_'))
      expect(imageDecodeFailure(reason).retryable).toBe(false);
  }
  expect(
    validateImageResult(
      { ...result, failure: 'private_native_error' },
      'source',
      'request',
      revision,
    ),
  ).toBe(false);
  expect(
    validateImageResult(
      {
        ...result,
        family_state: { ...result.family_state, output: 'rasterized_png' },
      },
      'source',
      'request',
      revision,
    ),
  ).toBe(false);
});

it('describes entity and external declaration refusals without inventing a network request', () => {
  const message = imageFailureMessage(
    imageDecodeFailure('svg_external_reference'),
  );
  expect(message).toContain('requests external resources or declares entities');
  expect(message).toContain('Neither is resolved');
});
