export const CONTRACT_VERSION = 1 as const;

export type IdentityAuthority =
  'filesystem' | 'android_document' | 'synthetic' | 'unknown';
export type IdentityStrength = 'strong' | 'weak' | 'unavailable';

export interface DocumentIdentity {
  authority: IdentityAuthority;
  scope: string;
  token: string;
  strength: IdentityStrength;
}

export interface SourceCapabilities {
  read: boolean;
  seek: boolean;
  stream: boolean;
  metadata: boolean;
  observe_revision: boolean;
  revalidate: boolean;
  watch: boolean;
  write: boolean;
  replace_atomically: boolean;
  persistent_permission: boolean;
  rename: boolean;
  observe_deletion: boolean;
  reopen: boolean;
  reveal_location: boolean;
}

export interface RendererCapabilities {
  view: boolean;
  edit: boolean;
  navigate: boolean;
  search: boolean;
  zoom: boolean;
  copy: boolean;
  save: boolean;
  inspect_metadata: boolean;
}

export interface SourceDescriptor {
  identity: DocumentIdentity;
  display_name: string;
  claimed_media_type: string | null;
  byte_length: number | null;
  modified_unix_ms: number | null;
  kind: 'file' | 'document_uri' | 'memory';
  capabilities: SourceCapabilities;
}

export type SourceWriteState =
  | 'writable'
  | 'read_only'
  | 'save_as_only'
  | 'unavailable';

export interface SourceMetadataSnapshot {
  source_id: SourceId;
  external_revision: ExternalRevision;
  display_name: string;
  source_kind: SourceDescriptor['kind'];
  byte_length: string | number | null;
  modified_unix_nanos: string | null;
  created_unix_nanos: string | null;
  accessed_unix_nanos: string | null;
  write_state: SourceWriteState;
  identity_confidence: IdentityStrength;
}

export type IntegrityState =
  | 'pending'
  | 'ready'
  | 'stale'
  | 'limited'
  | 'cancelled'
  | 'failed';

export interface IntegrityStartRequest {
  request_id: string;
  source_id: SourceId;
  expected_external_revision: ExternalRevision;
}

export interface IntegrityProgress {
  request_id: string;
  source_id: SourceId;
  state: IntegrityState;
  processed_bytes: string | number;
  total_bytes: string | number | null;
  sha256: string | null;
  external_revision: ExternalRevision;
  error_code?: string | null;
}

export type SourceId = string;
export type StreamId = string;
export type UserActivationId = string;
export type LinkAuthorizationId = string;

export interface ExternalRevision {
  identity: DocumentIdentity;
  byte_length: number | null;
  modified_unix_nanos: string | null;
  change_token: string | null;
}

export interface DesktopSourceSummary {
  source_id: SourceId;
  descriptor: SourceDescriptor;
  external_revision: ExternalRevision;
}

export type SourceState =
  | 'available'
  | 'changed'
  | 'renamed'
  | 'deleted'
  | 'permission_revoked'
  | 'watcher_overflow'
  | 'unavailable'
  | 'closed';

export interface SourceEvent {
  source_id: SourceId;
  sequence: number;
  state: SourceState;
  display_name: string | null;
  revalidation_required: boolean;
}

export type RevalidationStatus =
  'match' | 'changed' | 'deleted' | 'permission_revoked' | 'unavailable';

export interface RevalidationResult {
  source_id: SourceId;
  expected: ExternalRevision;
  current: ExternalRevision | null;
  status: RevalidationStatus;
}

export type DurabilityGuarantee =
  'atomic_file_and_directory' | 'atomic_file' | 'recoverable_non_atomic';

export interface SaveReceipt {
  operation_id: string;
  source_id: SourceId;
  accepted_session_revision: number;
  previous_external_revision: ExternalRevision;
  new_external_revision: ExternalRevision;
  byte_count: number;
  durability: DurabilityGuarantee;
}

export interface LinkAuthorization {
  id: LinkAuthorizationId;
  normalized_target: string;
}

export type AndroidDeliveryKind =
  'view' | 'share' | 'open_result' | 'create_result';

export interface AndroidGrantState {
  read: boolean;
  write: boolean;
  persisted_read: boolean;
  persisted_write: boolean;
  restorable: boolean;
}

export interface AndroidSourceSummary {
  source_id: SourceId;
  descriptor: SourceDescriptor;
  external_revision: ExternalRevision;
  delivery_kind: AndroidDeliveryKind;
  grant: AndroidGrantState;
}

export interface AndroidDeliveryRejection {
  code: string;
  retryable: boolean;
}

export interface AndroidDeliveryDrain {
  sources: AndroidSourceSummary[];
  rejections: AndroidDeliveryRejection[];
}

export type AndroidRestorationStatus =
  'restored' | 'needs_redelivery' | 'permission_revoked' | 'unavailable';

export interface AndroidRestorationResult {
  source: AndroidSourceSummary | null;
  status: AndroidRestorationStatus;
  display_name: string | null;
}

export interface AndroidSaveAsReceipt {
  previous_source_id: SourceId;
  new_source: AndroidSourceSummary;
  byte_count: number;
  durability: DurabilityGuarantee;
}

export interface RendererDescriptor {
  id: string;
  label: string;
  capabilities: RendererCapabilities;
}

export type SessionLifecycle =
  | 'opening'
  | 'ready'
  | 'active'
  | 'background'
  | 'conflicted'
  | 'closing'
  | 'closed'
  | 'failed';

export type SessionFocus = 'active' | 'background';
export type SessionIntegrity =
  'clean' | 'dirty' | 'saving' | 'conflicted' | 'recovery_only';
export type RecoveryCoverage = 'none' | 'current' | 'stale' | 'unavailable';
export type DestructiveTransitionKind = 'close' | 'reload' | 'exit';
export type DestructiveTransitionStatus =
  'awaiting_decision' | 'saving' | 'cancelled' | 'resolved';
export type SaveMode = 'ordinary' | 'save_as' | 'confirmed_overwrite';

export type TextEncoding =
  'utf8' | 'utf8_bom' | 'utf16_le_bom' | 'utf16_be_bom' | 'unknown';
export type NewlineToken = 'lf' | 'crlf' | 'cr';
export type TextEditorMode = 'editable' | 'large_read_only' | 'refused';
export type LanguageId =
  | 'plain_text'
  | 'rust'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'json'
  | 'toml'
  | 'yaml'
  | 'css'
  | 'html';
export type LanguageEvidenceKind =
  'exact_filename' | 'extension' | 'shebang' | 'modeline' | 'content';

export interface LanguageEvidence {
  kind: LanguageEvidenceKind;
  language: LanguageId;
  detail: string;
}

export interface LanguageDecision {
  language: LanguageId;
  confidence: 'low' | 'medium' | 'high';
  evidence: LanguageEvidence[];
  conflicts: LanguageEvidence[];
  origin: 'automatic' | 'session_override';
  status:
    | 'plain'
    | 'loading'
    | 'highlighted'
    | 'unavailable'
    | 'cancelled'
    | 'failed';
  load_revision: number;
  fallback_code: string | null;
}

export interface TextProfileState {
  encoding: TextEncoding;
  bom: 'present' | 'absent' | 'unknown';
  newline_counts: Record<NewlineToken, number>;
  insertion_newline: NewlineToken;
  newline_pattern: NewlineToken | 'mixed' | 'none';
  terminal_newline: boolean | null;
  undecodable_bytes: 'none' | 'requires_user_decision' | 'unsupported';
  round_trip_safe: boolean;
}

export interface TextDocumentState {
  mode: TextEditorMode;
  normalized_text: string;
  raw_text: string;
  profile: TextProfileState;
  language: LanguageDecision;
  source_bytes: number;
  longest_line_bytes: number;
}

export type MarkdownViewMode = 'rendered' | 'source';
export type MarkdownEligibility =
  | 'full'
  | 'source_only'
  | 'large_read_only'
  | 'refused';
export type MarkdownProjectionStatus =
  | 'idle'
  | 'scheduled'
  | 'rendering'
  | 'ready'
  | 'empty'
  | 'limited'
  | 'cancelled'
  | 'stale'
  | 'failed';

export interface MarkdownDocumentState {
  mode: MarkdownViewMode;
  eligibility: MarkdownEligibility;
  render_revision: number | null;
  render_status: MarkdownProjectionStatus;
  source_selection: { from: number; to: number } | null;
}

export interface MermaidDocumentState {
  mode: 'rendered' | 'source';
  render_revision: number | null;
  render_status: import('./mermaid-contract').MermaidRenderStatus | 'idle' | 'scheduled' | 'stale';
  preview_stale: boolean;
  viewport: import('./mermaid-contract').MermaidViewportState;
}

export interface SaveOperation {
  operation_id: string;
  source_id: SourceId;
  session_revision: number;
  expected_external_revision: ExternalRevision;
  payload_bytes: number;
  payload_digest: string;
  mode: SaveMode;
  durability: DurabilityGuarantee;
}

export interface DestructiveTransition {
  kind: DestructiveTransitionKind;
  target_session_id: string;
  requested_session_revision: number;
  status: DestructiveTransitionStatus;
  save_intent: 'save' | 'save_as' | null;
}

export type RecoveryInventoryStatus =
  'available' | 'expired' | 'corrupted' | 'unsupported' | 'coverage_at_risk';

export interface RecoveryInventoryEntry {
  record_id: string;
  display_hint: string;
  updated_unix_ms: number;
  expires_unix_ms: number;
  committed_bytes: number;
  status: RecoveryInventoryStatus;
}

export interface ShellSession {
  id: string;
  source: SourceDescriptor;
  renderer: RendererDescriptor;
  lifecycle: SessionLifecycle;
  /** Compatibility projection for the existing shell. Safety policy uses focus. */
  focus?: SessionFocus;
  /** Compatibility projection for the existing shell. Safety policy uses integrity. */
  integrity?: SessionIntegrity;
  source_state?: SourceState;
  pending_save?: SaveOperation | null;
  recovery_coverage?: RecoveryCoverage;
  recovery_warning_code?: string | null;
  external_revision?: ExternalRevision | null;
  saved_revision?: number;
  dirty: boolean;
  revision: number;
  content: string;
  source_id?: SourceId | null;
  /** Opaque native-owned token that remains valid across application launches. */
  restoration_reference?: string | null;
  text_document?: TextDocumentState | null;
  markdown_document?: MarkdownDocumentState | null;
  mermaid_document?: MermaidDocumentState | null;
  metadata?: import('./metadata').MetadataSnapshot | null;
}

export interface ContractEnvelope<T> {
  contract_version: typeof CONTRACT_VERSION;
  payload: T;
}

export const noSourceCapabilities = (): SourceCapabilities => ({
  read: false,
  seek: false,
  stream: false,
  metadata: false,
  observe_revision: false,
  revalidate: false,
  watch: false,
  write: false,
  replace_atomically: false,
  persistent_permission: false,
  rename: false,
  observe_deletion: false,
  reopen: false,
  reveal_location: false,
});

export const noRendererCapabilities = (): RendererCapabilities => ({
  view: false,
  edit: false,
  navigate: false,
  search: false,
  zoom: false,
  copy: false,
  save: false,
  inspect_metadata: false,
});
