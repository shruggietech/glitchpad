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
  | 'match'
  | 'changed'
  | 'deleted'
  | 'permission_revoked'
  | 'unavailable';

export interface RevalidationResult {
  source_id: SourceId;
  expected: ExternalRevision;
  current: ExternalRevision | null;
  status: RevalidationStatus;
}

export type DurabilityGuarantee =
  | 'atomic_file_and_directory'
  | 'atomic_file'
  | 'recoverable_non_atomic';

export interface SaveReceipt {
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
  | 'view'
  | 'share'
  | 'open_result'
  | 'create_result';

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
  | 'restored'
  | 'needs_redelivery'
  | 'permission_revoked'
  | 'unavailable';

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

export interface ShellSession {
  id: string;
  source: SourceDescriptor;
  renderer: RendererDescriptor;
  lifecycle: SessionLifecycle;
  dirty: boolean;
  revision: number;
  content: string;
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
