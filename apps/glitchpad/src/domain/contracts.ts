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
  write: boolean;
  replace_atomically: boolean;
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
  write: false,
  replace_atomically: false,
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
