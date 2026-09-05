import type { DesktopSourceSummary } from './contracts';
import {
  createDesktopDeliveryGateway,
  nativeDesktopDeliveryAvailable,
  type DesktopDeliveryResult,
} from './desktop-delivery-gateway';

const bytes = new TextEncoder().encode('# Delivered\n');
const source: DesktopSourceSummary = {
  source_id: 'native-source',
  descriptor: {
    identity: { authority: 'filesystem', scope: 'volume', token: 'opaque', strength: 'strong' },
    restoration_reference: 'opaque-reference',
    display_name: 'delivered.md',
    claimed_media_type: 'text/markdown',
    byte_length: bytes.length,
    modified_unix_ms: 1,
    kind: 'file',
    capabilities: {
      read: true, seek: true, stream: true, metadata: true, observe_revision: true,
      revalidate: true, watch: true, write: true, replace_atomically: true,
      persistent_permission: false, rename: true, observe_deletion: true, reopen: true,
      reveal_location: false,
    },
  },
  external_revision: {
    identity: { authority: 'filesystem', scope: 'volume', token: 'opaque', strength: 'strong' },
    byte_length: bytes.length,
    modified_unix_nanos: '1',
    change_token: null,
  },
};
const result: DesktopDeliveryResult = {
  sequence: 1,
  kind: 'association',
  status: 'opened',
  source,
  error: null,
};

test('requires the complete Tauri callback boundary before enabling native delivery', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, '__TAURI_INTERNALS__');
  try {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: { invoke: vi.fn() },
    });
    expect(nativeDesktopDeliveryAvailable()).toBe(false);
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: { invoke: vi.fn(), transformCallback: vi.fn() },
    });
    expect(nativeDesktopDeliveryAvailable()).toBe(true);
  } finally {
    if (descriptor) Object.defineProperty(window, '__TAURI_INTERNALS__', descriptor);
    else Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  }
});

test('materializes a bounded path-free native summary', async () => {
  const call = vi.fn((command: string, args?: Record<string, unknown>) => {
    if (command !== 'read_source_range') throw new Error(`unexpected ${command}`);
    const offset = args?.offset as number;
    const length = args?.length as number;
    return Promise.resolve({
      source_id: source.source_id,
      offset,
      bytes: [...bytes.slice(offset, offset + length)],
      end_of_source: offset + length >= bytes.length,
    });
  });
  const gateway = createDesktopDeliveryGateway(call, () => Promise.resolve(() => undefined));
  const session = await gateway.materialize(result);
  expect(session?.id).toBe('desktop-native-source');
  expect(session?.content).toBe('# Delivered\n');
  expect(session?.renderer.id).toBe('markdown');
  expect(JSON.stringify(session)).not.toContain('C:\\');
  expect(call).toHaveBeenCalledWith('read_source_range', expect.objectContaining({ operationBudget: bytes.length }));
});

test('detects a large desktop source BOM from a bounded prefix', async () => {
  const largeSource = {
    ...source,
    descriptor: { ...source.descriptor, byte_length: 32 * 1024 * 1024 + 2 },
  };
  const call = vi.fn().mockResolvedValue({
    source_id: source.source_id,
    offset: 0,
    bytes: [0xff, 0xfe, 0x41],
    end_of_source: false,
  });
  const gateway = createDesktopDeliveryGateway(call, () => Promise.resolve(() => undefined));
  const session = await gateway.materialize({ ...result, source: largeSource });
  expect(session?.text_document?.mode).toBe('large_read_only');
  expect(session?.text_document?.profile.encoding).toBe('utf16_le_bom');
  expect(call).toHaveBeenCalledWith('read_source_range', {
    sourceId: source.source_id,
    offset: 0,
    length: 3,
    operationBudget: 3,
  });
});

test('duplicates and rejections never create sessions', async () => {
  const gateway = createDesktopDeliveryGateway(vi.fn(), () => Promise.resolve(() => undefined));
  await expect(gateway.materialize({ ...result, status: 'duplicate' })).resolves.toBeNull();
  await expect(gateway.materialize({ ...result, status: 'rejected', source: null, error: { summary: 'Unavailable', retryable: true } })).resolves.toBeNull();
});

test('drain is bounded and subscription uses the injected event boundary', async () => {
  const full = Array.from({ length: 64 }, (_, index) => ({ ...result, sequence: index + 1 }));
  const call = vi.fn()
    .mockResolvedValueOnce(full)
    .mockResolvedValueOnce([]);
  const handler = vi.fn();
  const subscribe = vi.fn((callback: () => void) => {
    callback();
    return Promise.resolve(() => undefined);
  });
  const gateway = createDesktopDeliveryGateway(call, subscribe);
  await gateway.subscribe(handler);
  expect(handler).toHaveBeenCalledOnce();
  await gateway.drain();
  expect(call).toHaveBeenCalledTimes(2);
  expect(call).toHaveBeenNthCalledWith(1, 'drain_desktop_deliveries', { maximum: 64 });
  expect(call).toHaveBeenNthCalledWith(2, 'drain_desktop_deliveries', { maximum: 64 });
});

test('close releases the native source and duplicate-delivery tracking', async () => {
  const call = vi.fn().mockResolvedValue(undefined);
  const gateway = createDesktopDeliveryGateway(call, () => Promise.resolve(() => undefined));
  await gateway.close('native-source');
  expect(call).toHaveBeenCalledWith('close_desktop_source', { sourceId: 'native-source' });
});

test('Save As serializes exact text bytes and reports native cancellation', async () => {
  const call = vi.fn().mockResolvedValue(false);
  const gateway = createDesktopDeliveryGateway(call, () => Promise.resolve(() => undefined));
  const sourceGateway = createDesktopDeliveryGateway((command, args) => {
    if (command !== 'read_source_range') throw new Error('unexpected command');
    const offset = args?.offset as number;
    const length = args?.length as number;
    return Promise.resolve({ source_id: source.source_id, offset, bytes: [...bytes.slice(offset, offset + length)], end_of_source: true });
  }, () => Promise.resolve(() => undefined));
  const session = await sourceGateway.materialize(result);
  expect(session).not.toBeNull();
  await expect(gateway.saveAs(session!)).resolves.toBe(false);
  expect(call).toHaveBeenCalledWith('save_desktop_source_as', {
    suggestedName: 'delivered.md',
    bytes: [...bytes],
  });
});

test('Save sends exact bytes and revision guards to the native source command', async () => {
  const sourceGateway = createDesktopDeliveryGateway((command, args) => {
    if (command !== 'read_source_range') throw new Error('unexpected command');
    const offset = args?.offset as number;
    return Promise.resolve({
      source_id: source.source_id,
      offset,
      bytes: [...bytes],
      end_of_source: true,
    });
  }, () => Promise.resolve(() => undefined));
  const session = await sourceGateway.materialize(result);
  const call = vi.fn((command: string, args?: Record<string, unknown>) => {
    void command;
    void args;
    return Promise.resolve({
      operation_id: '1',
      source_id: source.source_id,
      accepted_session_revision: 1,
      previous_external_revision: source.external_revision,
      new_external_revision: source.external_revision,
      byte_count: bytes.length,
      durability: 'atomic_file_and_directory',
    });
  });
  const gateway = createDesktopDeliveryGateway(call, () => Promise.resolve(() => undefined));
  await gateway.save(session!);
  expect(call).toHaveBeenCalledOnce();
  const [command, args] = call.mock.calls[0];
  const request = args?.request as {
    operation_id: string;
    source_id: string;
    expected_external_revision: typeof source.external_revision;
    expected_session_revision: number;
    bytes: number[];
  };
  expect(command).toBe('save_source');
  expect(request.operation_id).toMatch(/^\d+$/u);
  expect(request.source_id).toBe(source.source_id);
  expect(request.expected_external_revision).toEqual(source.external_revision);
  expect(request.expected_session_revision).toBe(1);
  expect(request.bytes).toEqual([...bytes]);
});
