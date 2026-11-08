import type { ExternalRevision } from './contracts';

export const PDF_CONTRACT_VERSION = 1 as const;
export const PDF_ENGINE_VERSION = '6.5.438' as const;
export type PdfPlatform = 'desktop' | 'android';
export const PDF_LIMITS = Object.freeze({
  desktop: { sourceBytes: 512 * 1024 * 1024, surfaceBytes: 200 * 1024 * 1024 },
  android: { sourceBytes: 256 * 1024 * 1024, surfaceBytes: 96 * 1024 * 1024 },
  pages: 10_000,
  rangeBytes: 256 * 1024,
  rangeConcurrency: 2,
  cancelMs: 250,
  outlineNodes: 4096,
  outlineDepth: 32,
  searchResults: 2000,
  textPageCharacters: 1_000_000,
  thumbnailBytes: 8 * 1024 * 1024,
});

export type PdfErrorCode = 'malformed' | 'incorrect_password' | 'unsupported_encryption' | 'source_limit' | 'page_limit' | 'surface_limit' | 'source_changed' | 'permission_revoked' | 'worker_failure' | 'unavailable' | 'invalid_destination' | 'cancelled';
export class PdfFailure extends Error {
  constructor(public readonly code: PdfErrorCode) { super(code); this.name = 'PdfFailure'; }
}
export type PdfLoadState = 'idle' | 'loading' | 'spooling' | 'password_required' | 'ready' | 'limited' | 'cancelled' | 'failed' | 'disposed';
export interface PdfCapabilities {
  view: boolean;
  navigate: boolean;
  search: boolean;
  zoom: boolean;
  thumbnails: boolean;
  outline: boolean;
  inspect_metadata: boolean;
  print: 'available' | 'unavailable';
  text_selection: boolean;
}
export interface PdfNavigation {
  page: number;
  zoom: number;
  fit: 'page' | 'width' | 'custom';
  rotation: 0 | 90 | 180 | 270;
  layout: 'continuous' | 'single';
  request?: number;
  target?: { x:number|null; y:number|null } | null;
}
export interface PdfDocumentState {
  contract_version: typeof PDF_CONTRACT_VERSION;
  owner_id: string;
  state: PdfLoadState;
  page_count: number | null;
  navigation: PdfNavigation;
  reduced_cache: boolean;
  error: PdfErrorCode | null;
  capabilities: PdfCapabilities;
}
export interface PdfSourceLease {
  readonly length: number;
  readonly platform: PdfPlatform;
  readonly revision: ExternalRevision | null;
  read(offset: number, length: number, signal: AbortSignal): Promise<Uint8Array>;
  close(): void | Promise<void>;
}
export interface PdfSearchMatch { page: number; offset: number; text: string; context: string; }
export interface PdfOutlineEntry { title: string; destination: unknown; children: PdfOutlineEntry[]; }
export interface PdfInternalTarget { page: number; x: number | null; y: number | null; }

export function assertPdfSource(length: number, platform: PdfPlatform): void {
  if (!Number.isSafeInteger(length) || length <= 0) throw new PdfFailure('malformed');
  if (length > PDF_LIMITS[platform].sourceBytes) throw new PdfFailure('source_limit');
}
export function assertPdfPages(count: number): void {
  if (!Number.isSafeInteger(count) || count <= 0) throw new PdfFailure('malformed');
  if (count > PDF_LIMITS.pages) throw new PdfFailure('page_limit');
}
export function assertPdfRange(offset: number, length: number, total: number): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0 || length > PDF_LIMITS.rangeBytes || offset > total - length) throw new PdfFailure('malformed');
}
export function pdfSurfaceBytes(width: number, height: number, platform: PdfPlatform): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width > 32767 || height > 32767) throw new PdfFailure('surface_limit');
  const bytes = width * height * 4;
  if (!Number.isSafeInteger(bytes) || bytes > PDF_LIMITS[platform].surfaceBytes) throw new PdfFailure('surface_limit');
  return bytes;
}
export function pdfCapabilities(state: PdfLoadState, reduced: boolean, printAvailable = false): PdfCapabilities {
  const ready = state === 'ready' || state === 'limited';
  return { view: ready, navigate: ready, search: ready, zoom: ready, thumbnails: ready && !reduced, outline: ready, inspect_metadata: ready, print: ready && printAvailable ? 'available' : 'unavailable', text_selection: ready };
}
export function initialPdfState(ownerId: string): PdfDocumentState {
  return { contract_version: PDF_CONTRACT_VERSION, owner_id: ownerId, state: 'idle', page_count: null, navigation: { page: 0, zoom: 1, fit: 'width', rotation: 0, layout: 'continuous' }, reduced_cache: false, error: null, capabilities: pdfCapabilities('idle', false) };
}
export function classifyPdfFailure(error: unknown): PdfErrorCode {
  if (error instanceof PdfFailure) return error.code;
  if (error && typeof error === 'object' && 'category' in error) {
    if (error.category === 'permission_revoked') return 'permission_revoked';
    if (error.category === 'conflict') return 'source_changed';
    if (error.category === 'stale_session') return 'cancelled';
    if (['not_found', 'unavailable', 'capability_denied'].includes(String(error.category))) return 'unavailable';
  }
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return 'incorrect_password';
  if (name === 'InvalidPDFException' || name === 'MissingPDFException') return 'malformed';
  if (name === 'AbortException' || name === 'AbortError' || name === 'RenderingCancelledException') return 'cancelled';
  const message = error instanceof Error ? error.message : '';
  if (/unsupported.*(?:encrypt|security)|unknown encryption/i.test(message)) return 'unsupported_encryption';
  return 'worker_failure';
}
