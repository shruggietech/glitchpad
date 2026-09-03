import { describe, expect, it } from 'vitest';

import {
  ResourceLedger,
  ResourceOwner,
  suspendedTextTabClassification,
} from './resource-ledger';

describe('resource ownership ledger', () => {
  it('tracks only closed resource kinds and releases idempotently', () => {
    const owner = new ResourceOwner('document:1', 1024);
    const release = owner.acquire('worker', 4096);
    expect(owner.snapshot()).toMatchObject({
      estimated_bytes: 4096,
      counts: { worker: 1 },
    });
    release();
    release();
    expect(owner.snapshot()).toMatchObject({
      estimated_bytes: 0,
      counts: { worker: 0 },
    });
  });

  it('suspends to zero and disposal is terminal and idempotent', () => {
    const ledger = new ResourceLedger();
    const owner = ledger.register('document:2');
    owner.acquire('timer');
    owner.acquire('callback');
    owner.suspend();
    expect(
      Object.values(owner.snapshot()!.counts).every((count) => count === 0),
    ).toBe(true);
    owner.dispose();
    owner.dispose();
    expect(owner.snapshot()).toBeNull();
    expect(ledger.snapshots()).toEqual([]);
    expect(() => owner.acquire('worker')).toThrow('resource_owner_disposed');
  });

  it('returns to a zero baseline through one hundred cycles', () => {
    const owner = new ResourceOwner('cycles');
    for (let index = 0; index < 100; index += 1) {
      owner.resume();
      owner.acquire('worker');
      owner.acquire('object_url', 1024);
      owner.acquire('observer');
      owner.acquire('subscription');
      owner.acquire('timer');
      owner.acquire('callback');
      owner.acquire('lease');
      owner.acquire('surface', 2048);
      owner.suspend();
      expect(
        Object.values(owner.snapshot()!.counts).every((count) => count === 0),
      ).toBe(true);
    }
  });

  it('covers one Markdown owner and both owners for every supported embedded diagram', () => {
    const ledger = new ResourceLedger();
    const owners = Array.from({ length: 1 + 2 * 64 }, (_, index) =>
      ledger.register(`supported:${index}`),
    );
    expect(ledger.snapshots()).toHaveLength(129);
    expect(() => ledger.register('unsupported:overflow')).toThrow(
      'resource_owner_limit',
    );
    owners.forEach((owner) => owner.dispose());
    expect(ledger.snapshots()).toEqual([]);
  });

  it('classifies exact suspended byte boundaries', () => {
    const source = 1024;
    expect(
      suspendedTextTabClassification(source, source * 2.5 + 10 * 1024 * 1024),
    ).toBe('pass');
    expect(
      suspendedTextTabClassification(
        source,
        source * 2.5 + 10 * 1024 * 1024 + 1,
      ),
    ).toBe('warning');
    expect(
      suspendedTextTabClassification(source, source * 4 + 20 * 1024 * 1024 + 1),
    ).toBe('failure');
  });
});
