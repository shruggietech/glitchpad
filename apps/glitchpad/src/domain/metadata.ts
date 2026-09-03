import type {
  ExternalRevision,
  ShellSession,
  SourceMetadataSnapshot,
} from './contracts';

export type MetadataGroup =
  | 'source'
  | 'content'
  | 'embedded'
  | 'derived'
  | 'renderer';
export type MetadataAvailability =
  | 'available'
  | 'not_provided'
  | 'unsupported'
  | 'redacted'
  | 'pending'
  | 'errored';
export type MetadataProducer =
  | 'host'
  | 'text_profile'
  | 'detection'
  | 'renderer'
  | 'integrity';
export type MetadataSensitivity = 'public' | 'sensitive' | 'protected';
export type MetadataCopyPolicy = 'direct' | 'explicit_confirmation' | 'denied';
export type MetadataValueKind =
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'timestamp_unix_nanos';

export type MetadataValue =
  | { kind: 'text'; value: string }
  | { kind: 'integer'; value: string }
  | { kind: 'decimal'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'timestamp_unix_nanos'; value: string };

export interface MetadataCatalogEntry {
  key: string;
  group: MetadataGroup;
  label_key: string;
  label: string;
  value_kind: MetadataValueKind;
  sensitivity: MetadataSensitivity;
  copy_policy: MetadataCopyPolicy;
  applies: 'all' | 'text' | 'markdown' | 'mermaid';
}

export interface MetadataFact {
  key: string;
  availability: MetadataAvailability;
  value?: MetadataValue;
  unit?: string;
  provenance: MetadataProducer;
  error_code?: string;
  session_revision?: number;
  external_revision?: ExternalRevision | null;
  renderer_revision?: number | null;
}

export type MetadataObservation = Omit<MetadataFact, 'provenance'>;

export interface MetadataSnapshot {
  session_id: string;
  source_id: string | null;
  session_revision: number;
  external_revision: ExternalRevision | null;
  facts: MetadataFact[];
}

export interface MetadataContribution {
  session_id: string;
  expected_session_revision: number;
  expected_external_revision?: ExternalRevision | null;
  producer: MetadataProducer;
  renderer_revision?: number | null;
  facts: MetadataObservation[];
}

const entry = (
  key: string,
  group: MetadataGroup,
  label: string,
  value_kind: MetadataValueKind,
  applies: MetadataCatalogEntry['applies'] = 'all',
  sensitivity: MetadataSensitivity = 'public',
  copy_policy: MetadataCopyPolicy = 'direct',
): MetadataCatalogEntry => ({
  key,
  group,
  label_key: `metadata.${key.replaceAll('.', '_')}`,
  label,
  value_kind,
  applies,
  sensitivity,
  copy_policy,
});

export const METADATA_CATALOG: readonly MetadataCatalogEntry[] = [
  entry('host.display_name', 'source', 'File name', 'text'),
  entry('host.source_kind', 'source', 'Source kind', 'text'),
  entry('host.byte_length', 'source', 'Size', 'integer'),
  entry('host.modified', 'source', 'Modified', 'timestamp_unix_nanos'),
  entry('host.created', 'source', 'Created', 'timestamp_unix_nanos'),
  entry('host.accessed', 'source', 'Accessed', 'timestamp_unix_nanos'),
  entry('host.write_state', 'source', 'Write state', 'text'),
  entry('host.identity_confidence', 'source', 'Identity confidence', 'text'),
  entry('host.external_revision', 'source', 'External revision', 'text', 'all', 'sensitive', 'explicit_confirmation'),
  entry('text.encoding', 'content', 'Encoding', 'text', 'text'),
  entry('text.bom', 'content', 'Byte-order mark', 'text', 'text'),
  entry('text.newline_pattern', 'content', 'Newlines', 'text', 'text'),
  entry('text.terminal_newline', 'content', 'Terminal newline', 'boolean', 'text'),
  entry('text.line_count', 'content', 'Lines', 'integer', 'text'),
  entry('text.character_count', 'content', 'Characters', 'integer', 'text'),
  entry('text.language', 'content', 'Language', 'text', 'text'),
  entry('text.round_trip_safe', 'content', 'Round-trip safe', 'boolean', 'text'),
  entry('derived.media_type', 'derived', 'Media type', 'text'),
  entry('derived.detection_status', 'derived', 'Detection status', 'text'),
  entry('derived.detection_confidence', 'derived', 'Detection confidence', 'text'),
  entry('derived.format_evidence', 'derived', 'Format evidence', 'text'),
  entry('derived.format_conflicts', 'derived', 'Format conflicts', 'text'),
  entry('derived.warnings', 'derived', 'Warnings', 'text', 'all', 'protected', 'denied'),
  entry('derived.sha256', 'derived', 'SHA-256', 'text'),
  entry('derived.sha256_progress', 'derived', 'SHA-256 progress', 'integer', 'all', 'public', 'denied'),
  entry('renderer.name', 'renderer', 'Renderer', 'text'),
  entry('renderer.status', 'renderer', 'Renderer status', 'text'),
  entry('markdown.sanitizer_version', 'renderer', 'Sanitizer version', 'integer', 'markdown'),
  entry('markdown.source_bytes', 'renderer', 'Source bytes', 'integer', 'markdown'),
  entry('markdown.node_count', 'renderer', 'Nodes', 'integer', 'markdown'),
  entry('markdown.heading_count', 'renderer', 'Headings', 'integer', 'markdown'),
  entry('markdown.search_entry_count', 'renderer', 'Search entries', 'integer', 'markdown'),
  entry('markdown.parse_duration', 'renderer', 'Parse duration', 'decimal', 'markdown'),
  entry('diagram.type', 'renderer', 'Diagram type', 'text', 'mermaid'),
  entry('diagram.parser_version', 'renderer', 'Parser version', 'text', 'mermaid'),
  entry('diagram.sanitizer_version', 'renderer', 'Sanitizer version', 'integer', 'mermaid'),
  entry('diagram.preview_revision', 'renderer', 'Preview revision', 'integer', 'mermaid'),
  entry('diagram.preview_stale', 'renderer', 'Preview stale', 'boolean', 'mermaid'),
  entry('diagram.source_bytes', 'renderer', 'Source bytes', 'integer', 'mermaid'),
  entry('diagram.edge_count', 'renderer', 'Edges', 'integer', 'mermaid'),
  entry('diagram.output_bytes', 'renderer', 'Output bytes', 'integer', 'mermaid'),
  entry('diagram.parse_duration', 'renderer', 'Parse duration', 'decimal', 'mermaid'),
  entry('diagram.render_duration', 'renderer', 'Render duration', 'decimal', 'mermaid'),
  entry('diagram.total_duration', 'renderer', 'Total duration', 'decimal', 'mermaid'),
  entry('diagram.active_limit', 'renderer', 'Active limit', 'text', 'mermaid'),
  entry('diagram.accessible_title', 'renderer', 'Accessible title', 'text', 'mermaid'),
  entry('diagram.accessible_description', 'renderer', 'Accessible description', 'text', 'mermaid'),
] as const;

const catalogByKey = new Map(METADATA_CATALOG.map((item) => [item.key, item]));
const MAX_FACTS = 256;
const MAX_VALUE_LENGTH = 1_024;
const SAFE_CODE = /^[a-z][a-z0-9_]{0,63}$/u;

export const metadataCatalogEntry = (key: string): MetadataCatalogEntry => {
  const result = catalogByKey.get(key);
  if (!result) throw new Error(`Metadata key is not registered in the catalog: ${key}`);
  return result;
};

const appliesTo = (item: MetadataCatalogEntry, session: ShellSession): boolean =>
  item.applies === 'all' ||
  (item.applies === 'text' && Boolean(session.text_document)) ||
  item.applies === session.renderer.id;

const textValue = (value: string): MetadataValue => ({ kind: 'text', value });
const integerValue = (value: number | string): MetadataValue => ({
  kind: 'integer',
  value: String(value),
});
const available = (
  key: string,
  value: MetadataValue,
  provenance: MetadataProducer,
  session: ShellSession,
  unit?: string,
): MetadataFact => ({
  key,
  availability: 'available',
  value,
  provenance,
  session_revision: session.revision,
  external_revision: session.external_revision ?? null,
  unit,
});

const missing = (
  key: string,
  provenance: MetadataProducer,
  session: ShellSession,
  availability: MetadataAvailability = 'not_provided',
): MetadataFact => ({
  key,
  availability,
  provenance,
  session_revision: session.revision,
  external_revision: session.external_revision ?? null,
});

const sourceRevisionLabel = (revision: ExternalRevision | null | undefined): string | null => {
  if (!revision) return null;
  // Native identity and change tokens are comparison authority, never display data.
  const pieces = [revision.byte_length, revision.modified_unix_nanos]
    .filter((value) => value !== null && value !== undefined)
    .map(String);
  return pieces.length ? pieces.join(' · ') : null;
};

export const projectSessionMetadata = (session: ShellSession): MetadataSnapshot => {
  const facts = new Map<string, MetadataFact>();
  for (const item of METADATA_CATALOG) {
    if (appliesTo(item, session)) facts.set(item.key, missing(item.key, producerFor(item.key), session));
  }
  const put = (fact: MetadataFact) => facts.set(fact.key, fact);
  put(available('host.display_name', textValue(session.source.display_name), 'host', session));
  put(available('host.source_kind', textValue(session.source.kind.replaceAll('_', ' ')), 'host', session));
  if (session.source.byte_length !== null)
    put(available('host.byte_length', integerValue(session.source.byte_length), 'host', session, 'bytes'));
  if (session.source.modified_unix_ms !== null)
    put(available('host.modified', { kind: 'timestamp_unix_nanos', value: `${session.source.modified_unix_ms}000000` }, 'host', session));
  put(available('host.write_state', textValue(session.source.capabilities.write ? 'Writable' : 'Read only'), 'host', session));
  put(available('host.identity_confidence', textValue(session.source.identity.strength.replaceAll('_', ' ')), 'host', session));
  const revision = sourceRevisionLabel(session.external_revision);
  if (revision) put(available('host.external_revision', textValue(revision), 'host', session));
  if (session.text_document) {
    const document = session.text_document;
    put(available('text.encoding', textValue(document.profile.encoding.replaceAll('_', ' ')), 'text_profile', session));
    put(available('text.bom', textValue(document.profile.bom), 'text_profile', session));
    put(available('text.newline_pattern', textValue(document.profile.newline_pattern), 'text_profile', session));
    if (document.profile.terminal_newline !== null)
      put(available('text.terminal_newline', { kind: 'boolean', value: document.profile.terminal_newline }, 'text_profile', session));
    put(available('text.line_count', integerValue(document.normalized_text.length ? document.normalized_text.split('\n').length : 0), 'text_profile', session));
    put(available('text.character_count', integerValue(Array.from(document.normalized_text).length), 'text_profile', session));
    put(available('text.language', textValue(document.language.language.replaceAll('_', ' ')), 'text_profile', session));
    put(available('text.round_trip_safe', { kind: 'boolean', value: document.profile.round_trip_safe }, 'text_profile', session));
  }
  if (session.source.claimed_media_type)
    put(available('derived.media_type', textValue(session.source.claimed_media_type), 'detection', session));
  put(available('renderer.name', textValue(session.renderer.label), 'renderer', session));
  put(available('renderer.status', textValue(rendererStatus(session)), 'renderer', session));
  const projected: MetadataSnapshot = {
    session_id: session.id,
    source_id: session.source_id ?? null,
    session_revision: session.revision,
    external_revision: session.external_revision ?? null,
    facts: [...facts.values()],
  };
  return session.metadata
    ? mergeSnapshots(projected, session.metadata)
    : projected;
};

const rendererStatus = (session: ShellSession): string =>
  session.mermaid_document?.render_status ??
  session.markdown_document?.render_status ??
  session.lifecycle;

const producerFor = (key: string): MetadataProducer =>
  key.startsWith('host.')
    ? 'host'
    : key.startsWith('text.')
      ? 'text_profile'
      : key.startsWith('derived.sha256')
        ? 'integrity'
        : key.startsWith('derived.')
          ? 'detection'
          : 'renderer';

export const markSourceMetadataUnavailable = (
  session: ShellSession,
  snapshot: MetadataSnapshot,
  errorCode = 'metadata_unavailable',
): MetadataSnapshot => ({
  ...snapshot,
  facts: snapshot.facts.map((fact) =>
    fact.provenance === 'host' || fact.provenance === 'integrity'
      ? {
          key: fact.key,
          availability: 'errored',
          provenance: fact.provenance,
          error_code: errorCode,
          session_revision: session.revision,
          external_revision: snapshot.external_revision,
        }
      : fact,
  ),
});

const mergeSnapshots = (base: MetadataSnapshot, cached: MetadataSnapshot): MetadataSnapshot => {
  if (cached.session_id !== base.session_id || cached.session_revision !== base.session_revision)
    return base;
  const facts = new Map(base.facts.map((fact) => [fact.key, fact]));
  for (const fact of cached.facts) if (catalogByKey.has(fact.key)) facts.set(fact.key, fact);
  return { ...base, facts: [...facts.values()] };
};

export const mergeMetadataContribution = (
  session: ShellSession,
  snapshot: MetadataSnapshot,
  contribution: MetadataContribution,
): MetadataSnapshot | null => {
  const expectedExternalRevision = contribution.producer === 'integrity'
    ? snapshot.external_revision
    : session.external_revision ?? null;
  if (
    contribution.session_id !== session.id ||
    contribution.expected_session_revision !== session.revision ||
    snapshot.session_id !== session.id ||
    (contribution.expected_external_revision !== undefined &&
      !sameRevision(contribution.expected_external_revision, expectedExternalRevision))
  ) return null;
  if (contribution.facts.length > MAX_FACTS) throw new Error('Metadata contribution exceeds fact limit');
  const updates = new Map<string, MetadataFact>();
  for (const observation of contribution.facts) {
    const policy = metadataCatalogEntry(observation.key);
    if (!appliesTo(policy, session)) throw new Error('Metadata catalog key does not apply to this session');
    validateObservation(observation, policy, contribution.producer);
    updates.set(observation.key, {
      ...observation,
      value: observation.availability === 'available' ? observation.value : undefined,
      error_code: observation.availability === 'errored' ? observation.error_code : undefined,
      provenance: contribution.producer,
      session_revision: session.revision,
      external_revision: contribution.expected_external_revision ?? session.external_revision ?? null,
      renderer_revision: contribution.renderer_revision,
    });
  }
  if (updates.size !== contribution.facts.length) throw new Error('Metadata contribution contains duplicate keys');
  const facts = new Map(snapshot.facts.map((fact) => [fact.key, fact]));
  for (const [key, fact] of updates) facts.set(key, fact);
  return {
    ...snapshot,
    session_revision: session.revision,
    external_revision: snapshot.external_revision,
    facts: [...facts.values()],
  };
};

const validateObservation = (
  observation: MetadataObservation,
  policy: MetadataCatalogEntry,
  producer: MetadataProducer,
) => {
  if (producer !== producerFor(observation.key)) throw new Error('Metadata producer cannot write this catalog key');
  if (observation.availability === 'available') {
    if (!observation.value || observation.value.kind !== policy.value_kind)
      throw new Error('Metadata value does not match catalog kind');
    if (!validMetadataValue(observation.value)) throw new Error('Metadata value exceeds limit or is malformed');
  } else if (observation.value !== undefined) {
    throw new Error('Unavailable metadata cannot retain a value');
  }
  if (observation.availability === 'errored' && (!observation.error_code || !SAFE_CODE.test(observation.error_code)))
    throw new Error('Metadata error code is not safe');
};

const validMetadataValue = (value: MetadataValue): boolean => {
  if (value.kind === 'text') return Array.from(value.value).length <= MAX_VALUE_LENGTH;
  if (value.kind === 'boolean') return true;
  if (value.kind === 'integer' || value.kind === 'timestamp_unix_nanos')
    return /^(?:0|[1-9]\d{0,19})$/u.test(value.value);
  return value.value.length <= 64 && /^-?\d+(?:\.\d+)?$/u.test(value.value);
};

const sameRevision = (left: ExternalRevision | null, right: ExternalRevision | null): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const contributionFromSourceSnapshot = (
  session: ShellSession,
  source: SourceMetadataSnapshot,
): MetadataContribution => ({
  session_id: session.id,
  expected_session_revision: session.revision,
  expected_external_revision: source.external_revision,
  producer: 'host',
  facts: [
    { key: 'host.display_name', availability: 'available', value: textValue(source.display_name) },
    { key: 'host.source_kind', availability: 'available', value: textValue(source.source_kind.replaceAll('_', ' ')) },
    source.byte_length === null
      ? { key: 'host.byte_length', availability: 'not_provided' }
      : { key: 'host.byte_length', availability: 'available', value: integerValue(source.byte_length), unit: 'bytes' },
    timestampObservation('host.modified', source.modified_unix_nanos),
    timestampObservation('host.created', source.created_unix_nanos),
    timestampObservation('host.accessed', source.accessed_unix_nanos),
    { key: 'host.write_state', availability: 'available', value: textValue(source.write_state.replaceAll('_', ' ')) },
    { key: 'host.identity_confidence', availability: 'available', value: textValue(source.identity_confidence.replaceAll('_', ' ')) },
    { key: 'host.external_revision', availability: 'available', value: textValue(sourceRevisionLabel(source.external_revision) ?? 'Observed') },
  ],
});

export const mergeSourceMetadataSnapshot = (
  session: ShellSession,
  snapshot: MetadataSnapshot,
  source: SourceMetadataSnapshot,
): MetadataSnapshot | null => {
  if (
    source.source_id !== session.source_id ||
    snapshot.session_id !== session.id ||
    snapshot.session_revision !== session.revision
  ) return null;
  const revisionChanged = !sameRevision(snapshot.external_revision, source.external_revision);
  const facts = new Map(snapshot.facts.map((fact) => [fact.key, fact]));
  if (revisionChanged) {
    for (const [key, fact] of facts) {
      if (fact.provenance === 'integrity') facts.set(key, {
        key,
        availability: 'not_provided',
        provenance: 'integrity',
        session_revision: session.revision,
        external_revision: source.external_revision,
      });
    }
  }
  for (const observation of contributionFromSourceSnapshot(session, source).facts) {
    const policy = metadataCatalogEntry(observation.key);
    validateObservation(observation, policy, 'host');
    facts.set(observation.key, {
      ...observation,
      value: observation.availability === 'available' ? observation.value : undefined,
      error_code: observation.availability === 'errored' ? observation.error_code : undefined,
      provenance: 'host',
      session_revision: session.revision,
      external_revision: source.external_revision,
    });
  }
  return {
    ...snapshot,
    source_id: source.source_id,
    external_revision: source.external_revision,
    facts: [...facts.values()],
  };
};

const timestampObservation = (key: string, value: string | null): MetadataObservation =>
  value === null
    ? { key, availability: 'not_provided' }
    : { key, availability: 'available', value: { kind: 'timestamp_unix_nanos', value } };

export interface FormattedMetadataFact {
  label: string;
  value: string;
  provenance: string;
  copy_policy: MetadataCopyPolicy;
  sensitivity: MetadataSensitivity;
}

export const formatMetadataFact = (fact: MetadataFact): FormattedMetadataFact => {
  const policy = metadataCatalogEntry(fact.key);
  const value = fact.availability === 'available' && fact.value
    ? formatValue(fact.value, fact.unit)
    : fact.availability === 'not_provided'
      ? 'Not provided'
      : fact.availability === 'unsupported'
        ? 'Unsupported'
        : fact.availability === 'redacted'
          ? 'Redacted'
          : fact.availability === 'pending'
            ? 'Pending'
            : `Unavailable (${fact.error_code ?? 'metadata_error'})`;
  return {
    label: policy.label,
    value,
    provenance: provenanceLabel(fact.provenance),
    copy_policy: policy.copy_policy,
    sensitivity: policy.sensitivity,
  };
};

const formatValue = (value: MetadataValue, unit?: string): string => {
  switch (value.kind) {
    case 'text': return value.value;
    case 'integer': {
      if (!/^-?\d+$/u.test(value.value)) return value.value;
      const number = BigInt(value.value);
      return new Intl.NumberFormat(undefined, unitFormat(unit, 0)).format(number);
    }
    case 'decimal': return new Intl.NumberFormat(undefined, unitFormat(unit, 3)).format(Number(value.value));
    case 'boolean': return value.value ? 'Yes' : 'No';
    case 'timestamp_unix_nanos': {
      try {
        const milliseconds = BigInt(value.value) / 1_000_000n;
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(Number(milliseconds)));
      } catch {
        return 'Invalid timestamp';
      }
    }
  }
};

const unitFormat = (unit: string | undefined, maximumFractionDigits: number): Intl.NumberFormatOptions => ({
  maximumFractionDigits,
  ...(unit === 'bytes'
    ? { style: 'unit', unit: 'byte', unitDisplay: 'long' }
    : unit === 'ms'
      ? { style: 'unit', unit: 'millisecond', unitDisplay: 'short' }
      : {}),
});

const provenanceLabel = (producer: MetadataProducer): string => ({
  host: 'Host source',
  text_profile: 'Text profile',
  detection: 'Format detection',
  renderer: 'Renderer',
  integrity: 'Integrity check',
})[producer];

export const groupMetadataFacts = (snapshot: MetadataSnapshot): Array<{
  group: MetadataGroup;
  label: string;
  facts: MetadataFact[];
}> => {
  const labels: Record<MetadataGroup, string> = {
    source: 'Source', content: 'Content', embedded: 'Embedded', derived: 'Derived', renderer: 'Renderer',
  };
  return (['source', 'content', 'embedded', 'derived', 'renderer'] as const)
    .map((group) => ({
      group,
      label: labels[group],
      facts: snapshot.facts.filter((fact) => metadataCatalogEntry(fact.key).group === group),
    }))
    .filter(({ facts }) => facts.length > 0);
};

export const bulkCopyText = (snapshot: MetadataSnapshot): string =>
  groupMetadataFacts(snapshot)
    .map(({ label, facts }) => {
      const rows = facts
        .filter((fact) => fact.availability === 'available' && metadataCatalogEntry(fact.key).copy_policy === 'direct')
        .map((fact) => {
          const formatted = formatMetadataFact(fact);
          return `${formatted.label}: ${formatted.value}`;
        });
      return rows.length ? `${label}\n${rows.join('\n')}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

export const rendererContribution = (
  session: ShellSession,
  facts: MetadataObservation[],
  rendererRevision: number | null,
): MetadataContribution => ({
  session_id: session.id,
  expected_session_revision: session.revision,
  expected_external_revision: session.external_revision ?? null,
  producer: 'renderer',
  renderer_revision: rendererRevision,
  facts,
});
