export type ResourceKind =
  | 'worker'
  | 'object_url'
  | 'observer'
  | 'subscription'
  | 'timer'
  | 'callback'
  | 'lease'
  | 'surface';

export interface ResourceSnapshot {
  owner_id: string;
  lifecycle: 'active' | 'suspended';
  source_bytes: number;
  estimated_bytes: number;
  counts: Record<ResourceKind, number>;
}

const kinds: readonly ResourceKind[] = [
  'worker',
  'object_url',
  'observer',
  'subscription',
  'timer',
  'callback',
  'lease',
  'surface',
];
const MAX_RENDERER_OWNERS = 1 + 2 * 64;
const emptyCounts = (): Record<ResourceKind, number> =>
  Object.fromEntries(kinds.map((kind) => [kind, 0])) as Record<
    ResourceKind,
    number
  >;

export class ResourceOwner {
  private lifecycle: 'active' | 'suspended' | 'disposed' = 'active';
  private serial = 0;
  private readonly acquisitions = new Map<
    number,
    { kind: ResourceKind; estimatedBytes: number }
  >();

  constructor(
    readonly id: string,
    readonly sourceBytes = 0,
    private readonly onDispose?: () => void,
  ) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id))
      throw new Error('resource_owner_invalid');
    if (!Number.isSafeInteger(sourceBytes) || sourceBytes < 0)
      throw new Error('source_bytes_invalid');
  }

  acquire(kind: ResourceKind, estimatedBytes = 0): () => void {
    if (this.lifecycle === 'disposed')
      throw new Error('resource_owner_disposed');
    if (
      !kinds.includes(kind) ||
      !Number.isSafeInteger(estimatedBytes) ||
      estimatedBytes < 0
    )
      throw new Error('resource_acquisition_invalid');
    if (this.acquisitions.size >= 1_024)
      throw new Error('resource_limit_exceeded');
    this.lifecycle = 'active';
    const token = ++this.serial;
    this.acquisitions.set(token, { kind, estimatedBytes });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.acquisitions.delete(token);
    };
  }

  suspend(): void {
    if (this.lifecycle === 'disposed') return;
    this.acquisitions.clear();
    this.lifecycle = 'suspended';
  }

  resume(): void {
    if (this.lifecycle === 'disposed')
      throw new Error('resource_owner_disposed');
    this.lifecycle = 'active';
  }

  dispose(): void {
    if (this.lifecycle === 'disposed') return;
    this.acquisitions.clear();
    this.lifecycle = 'disposed';
    this.onDispose?.();
  }

  snapshot(): ResourceSnapshot | null {
    if (this.lifecycle === 'disposed') return null;
    const counts = emptyCounts();
    let estimatedBytes = 0;
    for (const acquisition of this.acquisitions.values()) {
      counts[acquisition.kind] += 1;
      estimatedBytes += acquisition.estimatedBytes;
    }
    return {
      owner_id: this.id,
      lifecycle: this.lifecycle,
      source_bytes: this.sourceBytes,
      estimated_bytes: estimatedBytes,
      counts,
    };
  }
}

export class ResourceLedger {
  private readonly owners = new Map<string, ResourceOwner>();

  register(ownerId: string, sourceBytes = 0): ResourceOwner {
    if (this.owners.has(ownerId)) throw new Error('resource_owner_duplicate');
    if (this.owners.size >= MAX_RENDERER_OWNERS)
      throw new Error('resource_owner_limit');
    const owner = new ResourceOwner(ownerId, sourceBytes, () =>
      this.owners.delete(ownerId),
    );
    this.owners.set(ownerId, owner);
    return owner;
  }

  snapshots(): ResourceSnapshot[] {
    return [...this.owners.values()].flatMap((owner) => owner.snapshot() ?? []);
  }
}

export const rendererResourceLedger = new ResourceLedger();

export const suspendedTextTabClassification = (
  sourceBytes: number,
  retainedBytes: number,
) => {
  if (
    ![sourceBytes, retainedBytes].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
  )
    throw new Error('resource_bytes_invalid');
  const target = sourceBytes * 2.5 + 10 * 1024 * 1024;
  const hard = sourceBytes * 4 + 20 * 1024 * 1024;
  return retainedBytes <= target
    ? 'pass'
    : retainedBytes <= hard
      ? 'warning'
      : 'failure';
};
