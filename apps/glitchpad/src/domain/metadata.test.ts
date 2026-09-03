import { describe, expect, it } from 'vitest';

import { initialSessions } from '../App';
import {
  METADATA_CATALOG,
  bulkCopyText,
  formatMetadataFact,
  mergeMetadataContribution,
  projectSessionMetadata,
  type MetadataContribution,
} from './metadata';

describe('metadata catalog', () => {
  it('has unique stable keys and projects explicit availability for every applicable fact', () => {
    expect(new Set(METADATA_CATALOG.map(({ key }) => key)).size).toBe(
      METADATA_CATALOG.length,
    );
    expect(METADATA_CATALOG.every(({ label_key }) => label_key.startsWith('metadata.'))).toBe(true);
    const snapshot = projectSessionMetadata(initialSessions[1]);
    expect(snapshot.facts.every(({ availability }) => Boolean(availability))).toBe(true);
    expect(snapshot.facts.find(({ key }) => key === 'host.created')?.availability).toBe(
      'not_provided',
    );
    expect(snapshot.facts.find(({ key }) => key === 'derived.format_conflicts')?.availability).toBe('not_provided');
  });

  it('formats integer and timestamp wire values without converting them through unsafe numbers', () => {
    const snapshot = projectSessionMetadata(initialSessions[0]);
    const name = snapshot.facts.find(({ key }) => key === 'host.display_name')!;
    expect(formatMetadataFact(name).value).toBe('welcome.md');
    const timestamp = {
      ...name,
      key: 'host.modified',
      value: { kind: 'timestamp_unix_nanos', value: '1788044400000000123' } as const,
    };
    expect(formatMetadataFact(timestamp).value).toContain('2026');
  });

  it('never projects native identity or change tokens as display values', () => {
    const base = initialSessions[0];
    const snapshot = projectSessionMetadata({
      ...base,
      external_revision: {
        identity: { ...base.source.identity, token: 'private-provider-token' },
        byte_length: 12,
        modified_unix_nanos: '42',
        change_token: 'private-change-token',
      },
    });
    const displayed = snapshot.facts.map(formatMetadataFact).map(({ value }) => value).join('\n');
    expect(displayed).not.toContain('private-provider-token');
    expect(displayed).not.toContain('private-change-token');
  });

  it('accepts only bounded cataloged contributions matching session and external revisions', () => {
    const session = { ...initialSessions[1], external_revision: null };
    const contribution: MetadataContribution = {
      session_id: session.id,
      expected_session_revision: session.revision,
      expected_external_revision: null,
      producer: 'renderer',
      facts: [
        {
          key: 'diagram.type',
          availability: 'available',
          value: { kind: 'text', value: 'flowchart' },
        },
      ],
    };
    expect(
      mergeMetadataContribution(session, projectSessionMetadata(session), contribution)
        ?.facts.find(({ key }) => key === 'diagram.type')?.value,
    ).toEqual({ kind: 'text', value: 'flowchart' });
    expect(
      mergeMetadataContribution(session, projectSessionMetadata(session), {
        ...contribution,
        expected_session_revision: 999,
      }),
    ).toBeNull();
    expect(() =>
      mergeMetadataContribution(session, projectSessionMetadata(session), {
        ...contribution,
        facts: [{ key: 'unknown.private.path', availability: 'redacted' }],
      }),
    ).toThrow(/catalog/iu);
  });

  it('keeps all six states explicit and excludes confirmation and denied facts from bulk copy', () => {
    const snapshot = projectSessionMetadata(initialSessions[1]);
    const states = [
      'available',
      'not_provided',
      'unsupported',
      'redacted',
      'pending',
      'errored',
    ] as const;
    const facts = states.map((availability, index) => ({
      ...snapshot.facts[index],
      availability,
      value:
        availability === 'available'
          ? ({ kind: 'text', value: 'safe' } as const)
          : undefined,
      error_code: availability === 'errored' ? 'metadata_unavailable' : undefined,
    }));
    expect(facts.map((fact) => formatMetadataFact(fact).value)).toEqual([
      'safe',
      'Not provided',
      'Unsupported',
      'Redacted',
      'Pending',
      'Unavailable (metadata_unavailable)',
    ]);
    expect(bulkCopyText({ ...snapshot, facts })).not.toContain('Redacted');
  });
});
