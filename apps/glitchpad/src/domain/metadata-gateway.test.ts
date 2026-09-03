import { describe, expect, it, vi } from 'vitest';

import {
  MemoryClipboardGateway,
  runIntegrityRequest,
  type MetadataGateway,
} from './metadata-gateway';
import type { ExternalRevision } from './contracts';

describe('metadata gateways', () => {
  it('copies only explicitly supplied visible text', async () => {
    const clipboard = new MemoryClipboardGateway();
    await clipboard.write('Size: 12 bytes');
    expect(clipboard.value).toBe('Size: 12 bytes');
  });

  it('advances integrity cooperatively and returns only the matching ready result', async () => {
    const progress = vi.fn();
    const startIntegrity = vi.fn(() => Promise.resolve({
      request_id: 'request', source_id: 'source', state: 'pending' as const,
      processed_bytes: '0', total_bytes: '3', sha256: null, external_revision: revision,
    }));
    const advanceIntegrity = vi.fn(() => Promise.resolve({
      request_id: 'request', source_id: 'source', state: 'ready' as const,
      processed_bytes: '3', total_bytes: '3', sha256: 'a'.repeat(64), external_revision: revision,
    }));
    const gateway: MetadataGateway = {
      query: vi.fn(),
      startIntegrity,
      advanceIntegrity,
      cancelIntegrity: vi.fn(() => Promise.resolve()),
    };
    const result = await runIntegrityRequest(gateway, 'source', revision, 'request', undefined, progress);
    expect(result.state).toBe('ready');
    expect(result.sha256).toBe('a'.repeat(64));
    expect(advanceIntegrity).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledTimes(2);
    expect(startIntegrity).toHaveBeenCalledWith({
      request_id: 'request',
      source_id: 'source',
      expected_external_revision: revision,
    }, undefined);
  });

  it('cancels a pending native operation when aborted', async () => {
    const abort = new AbortController();
    const cancelIntegrity = vi.fn(() => Promise.resolve());
    const gateway: MetadataGateway = {
      query: vi.fn(),
      startIntegrity: vi.fn(() => {
        abort.abort();
        return Promise.resolve({ request_id: 'request', source_id: 'source', state: 'pending', processed_bytes: '0', total_bytes: null, sha256: null, external_revision: revision } as const);
      }),
      advanceIntegrity: vi.fn(),
      cancelIntegrity,
    };
    await expect(runIntegrityRequest(gateway, 'source', revision, 'request', abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelIntegrity).toHaveBeenCalledWith('request');
  });

  it('rejects a digest attributed to a different external revision', async () => {
    const cancelIntegrity = vi.fn(() => Promise.resolve());
    const gateway: MetadataGateway = {
      query: vi.fn(),
      startIntegrity: vi.fn(() => Promise.resolve({
        request_id: 'request', source_id: 'source', state: 'ready' as const, processed_bytes: '3', total_bytes: '3',
        sha256: 'a'.repeat(64), external_revision: { ...revision, change_token: 'different' },
      })),
      advanceIntegrity: vi.fn(),
      cancelIntegrity,
    };
    await expect(runIntegrityRequest(gateway, 'source', revision, 'request')).rejects.toThrow('integrity_response_mismatch');
    expect(cancelIntegrity).toHaveBeenCalledWith('request');
  });
});

const revision: ExternalRevision = {
  identity: { authority: 'synthetic' as const, scope: 'tests', token: 'safe', strength: 'strong' as const },
  byte_length: 3,
  modified_unix_nanos: '1',
  change_token: null,
};
