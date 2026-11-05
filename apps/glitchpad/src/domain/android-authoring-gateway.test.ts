import { describe, it, expect, vi } from 'vitest';
import {
  createAndroidAuthoringGateway,
  saveFailureReason,
  saveFailureMessage,
} from './android-authoring-gateway';
import { createDraftSession } from './drafts';

describe('Android authoring native result contract', () => {
  it('sends exact UTF8 draft bytes without invented source identity and rejects mismatched receipt', async () => {
    const draft = createDraftSession('markdown');
    const call = vi
      .fn()
      .mockResolvedValue({
        source: { source_id: 'dest' },
        byte_count: 0,
        saved_revision: 1,
      });
    expect(
      await createAndroidAuthoringGateway(call).saveAs(draft),
    ).toMatchObject({ saved_revision: 1, byte_count: 0 });
    const request = (
      call.mock.calls[0][1] as {
        request: { bytes: number[]; source_id?: string };
      }
    ).request;
    expect(request.bytes).toEqual([]);
    expect(request).not.toHaveProperty('source_id');
    expect(request).not.toHaveProperty('expected_external_revision');
    call.mockResolvedValue({
      source: { source_id: 'dest' },
      byte_count: 1,
      saved_revision: 1,
    });
    await expect(
      createAndroidAuthoringGateway(call).saveAs(draft),
    ).rejects.toThrow('invalid_receipt');
  });
  it('returns neutral cancellation and preserves copy source revision checks', async () => {
    const draft = createDraftSession('text');
    const cancel = vi
      .fn()
      .mockRejectedValue({ context: { reason: 'picker_cancelled' } });
    expect(
      await createAndroidAuthoringGateway(cancel).saveAs(draft),
    ).toBeNull();
    const source = {
      ...draft,
      source_id: 'source',
      external_revision: {
        identity: draft.source.identity,
        byte_length: 0,
        modified_unix_nanos: null,
        change_token: null,
      },
    };
    const copy = createDraftSession('text', source);
    const call = vi
      .fn()
      .mockResolvedValue({
        previous_source_id: 'source',
        new_source: { source_id: 'new' },
        byte_count: 0,
      });
    await createAndroidAuthoringGateway(call).saveAs(copy);
    expect(call.mock.calls[0][0]).toBe('save_android_source_as');
    expect(
      (call.mock.calls[0][1] as { request: { source_id: string } }).request
        .source_id,
    ).toBe('source');
  });
});

it('bounds suggested names without cutting a surrogate pair and maps only allowlisted failure context', async () => {
  const draft = createDraftSession('text');
  draft.source.display_name = 'x'.repeat(127) + '🦄.txt';
  const call = vi
    .fn()
    .mockResolvedValue({
      source: { source_id: 'destination' },
      byte_count: 0,
      saved_revision: 1,
    });
  await createAndroidAuthoringGateway(call).saveAs(draft);
  const request = (
    call.mock.calls[0][1] as { request: { suggested_name: string } }
  ).request;
  expect(request.suggested_name).toBe('x'.repeat(127));
  expect(
    saveFailureReason({ context: { reason: 'destination_conflict' } }),
  ).toBe('destination_conflict');
  expect(
    saveFailureReason({
      context: { reason: 'destination_conflict private URI' },
    }),
  ).toBe('write_failed');
  expect(saveFailureMessage('destination_conflict')).toContain(
    'Choose a new name or another destination',
  );
  expect(
    saveFailureMessage(
      saveFailureReason(new Error('content://private/source')),
    ),
  ).not.toContain('private');
});
