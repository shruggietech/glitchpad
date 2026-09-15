import type { ExternalRevision, ShellSession, SourceDescriptor } from './contracts';
import { noRendererCapabilities } from './contracts';
import type { MetadataValue } from './metadata';

export const IMAGE_CONTRACT_VERSION = 1;
export const MAX_IMAGE_PNG_BYTES = 8 * 1024 * 1024;
export const IMAGE_CODECS = ['png', 'jpeg', 'webp', 'bmp', 'tiff'] as const;
export type RasterCodec = typeof IMAGE_CODECS[number];
export type ImageFamilyState =
  | { family: 'raster'; preview: 'full' | 'thumbnail' | 'unavailable' | 'refused' }
  | { family: 'animation'; paused: boolean; selected_frame: number; frame_count: number | null; loop_count: number | null; frame_duration_ms: number | null; max_composited_frames: number }
  | { family: 'svg'; output: 'unavailable' | 'rasterized_png' | 'safe_tree'; external_resources: false; scripts: false; max_nodes: number; max_depth: number }
  | { family: 'ico'; entries: { index: number; width: number; height: number; bits_per_pixel: number; encoded_bytes: number; preview: 'full' | 'thumbnail' | 'unavailable' | 'refused' }[]; selected_entry: number | null; selected_entry_export: boolean };
export interface ImageResourcePolicy { encoded_bytes: number; png_bytes: number; full_pixels: number; refuse_pixels: number; surface_bytes: number; peak_bytes: number; metadata_block_bytes: number; metadata_total_bytes: number; metadata_facts: number; max_frames: number; max_composited_frames: number; max_entries: number; max_svg_nodes: number; max_svg_depth: number; concurrent_decodes: number; cancellation_scheduling_ms: number }
export interface ImageFamilyContract { contract_version: 1; container: RasterCodec | 'gif' | 'svg' | 'ico'; state: ImageFamilyState; raster_descriptor: ImageDescriptor | null; metadata: ImageMetadataReport; resources: ImageResourcePolicy; capabilities: ImageDescriptor['capabilities']; lifecycle: 'idle' | 'admitted' | 'cancel_requested' | 'suspended' | 'disposed' }
export const IMAGE_METADATA_KEYS = ['image.camera_make', 'image.camera_model', 'image.software', 'image.captured', 'image.artist', 'image.title', 'image.description', 'image.keywords', 'image.exposure', 'image.f_number', 'image.focal_length', 'image.iso', 'image.location', 'image.orientation', 'image.embedded_width', 'image.embedded_height'] as const;

export interface ImageDescriptor {
  contract_version: 1;
  family: 'raster' | 'animation' | 'svg' | 'ico';
  codec: RasterCodec;
  width: number;
  height: number;
  display_width: number;
  display_height: number;
  pixels: number;
  decoded_bytes: number;
  orientation: number;
  color_policy: string;
  profile_status: string;
  alpha: boolean;
  bits_per_pixel: number;
  capabilities: { view: boolean; inspect_metadata: boolean; zoom: boolean; animate: boolean; select_frame: boolean; select_entry: boolean; export_entry: boolean; edit: boolean; save: boolean };
  limitations: string[];
}
export interface ImageMetadataObservation {
  key: typeof IMAGE_METADATA_KEYS[number];
  family: string;
  tag: string;
  block: number;
  availability: 'available' | 'redacted' | 'unsupported' | 'errored' | 'not_provided';
  value: MetadataValue | null;
  original: { kind: 'text'; value: string } | { kind: 'unsigned'; value: number[] } | { kind: 'rational'; value: [number, number][] } | null;
  duplicate: boolean;
}
export interface ImageMetadataReport { observations: ImageMetadataObservation[]; statuses: string[]; unknown_fields: number; profile_present: boolean }
export interface ImageViewport { mode: 'fit' | 'actual'; zoom: number; pan_x: number; pan_y: number; background: 'checker' | 'light' | 'dark' }
export interface ImageDocumentState { codec: RasterCodec; status: 'idle' | 'loading' | 'ready' | 'failed'; descriptor: ImageDescriptor | null; metadata: ImageMetadataReport | null; viewport: ImageViewport }
export interface ImageRenderResult { source_id: string; request_id: string; external_revision: ExternalRevision; preview: { descriptor: ImageDescriptor; kind: 'full' | 'thumbnail'; png_bytes: number[] } | null; failure: string | null; metadata: ImageMetadataReport }

export const initialImageViewport = (): ImageViewport => ({ mode: 'fit', zoom: 1, pan_x: 0, pan_y: 0, background: 'checker' });

export const createImageSession = (source: SourceDescriptor, sourceId: string, externalRevision: ExternalRevision, codec: RasterCodec, idPrefix: string): ShellSession => ({
  id: `${idPrefix}-${sourceId}`, source,
  renderer: { id: 'image', label: 'Image', capabilities: { ...noRendererCapabilities(), view: true, inspect_metadata: true, zoom: true } },
  lifecycle: 'background', source_state: 'available', external_revision: externalRevision,
  saved_revision: 1, dirty: false, revision: 1, content: '', source_id: sourceId,
  text_document: null, markdown_document: null, mermaid_document: null,
  image_document: { codec, status: 'idle', descriptor: null, metadata: null, viewport: initialImageViewport() },
});

const token = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,64}$/u.test(value);
const count = (value: unknown, maximum: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const valueIsValid = (value: unknown): boolean => {
  if (!record(value)) return false;
  if (value.kind === 'boolean') return typeof value.value === 'boolean';
  if (typeof value.value !== 'string' || Array.from(value.value).length > 1024) return false;
  if (value.kind === 'text') return true;
  if (value.kind === 'integer') return /^(?:0|[1-9]\d{0,19})$/u.test(value.value);
  if (value.kind === 'decimal') return /^-?\d+(?:\.\d+)?$/u.test(value.value) && value.value.length <= 64;
  return false;
};

export const validateImageMetadata = (report: unknown): report is ImageMetadataReport => {
  if (!record(report) || !Array.isArray(report.observations) || report.observations.length > 256 || !Array.isArray(report.statuses) || report.statuses.length > 256 || !report.statuses.every(token) || !count(report.unknown_fields, 4096) || typeof report.profile_present !== 'boolean') return false;
  return report.observations.every((o: unknown) => {
    if (!record(o) || !IMAGE_METADATA_KEYS.includes(o.key as typeof IMAGE_METADATA_KEYS[number]) || !token(o.family) || !token(o.tag) || !count(o.block, 4096) || typeof o.duplicate !== 'boolean') return false;
    if (o.key === 'image.location' && o.availability !== 'redacted') return false;
    if (o.availability !== 'available') return ['redacted', 'unsupported', 'errored', 'not_provided'].includes(String(o.availability)) && o.value === null && o.original === null;
    if (!valueIsValid(o.value)) return false;
    const expectedKind = ['image.exposure', 'image.f_number', 'image.focal_length'].includes(String(o.key)) ? 'decimal' : ['image.iso', 'image.orientation', 'image.embedded_width', 'image.embedded_height'].includes(String(o.key)) ? 'integer' : 'text';
    if (!record(o.value) || o.value.kind !== expectedKind) return false;
    if (o.original === null) return true;
    if (!record(o.original)) return false;
    if (o.original.kind === 'text') return typeof o.original.value === 'string' && Array.from(o.original.value).length <= 1024;
    if (!Array.isArray(o.original.value) || o.original.value.length > 64) return false;
    if (o.original.kind === 'unsigned') return o.original.value.every(n => count(n, Number.MAX_SAFE_INTEGER));
    return o.original.kind === 'rational' && o.original.value.every(n => Array.isArray(n) && n.length === 2 && n.every(v => count(v, 0xffff_ffff)));
  });
};

export const validateImageResult = (result: unknown, sourceId: string, requestId: string, revision: ExternalRevision): result is ImageRenderResult => {
  if (!record(result) || result.source_id !== sourceId || result.request_id !== requestId || JSON.stringify(result.external_revision) !== JSON.stringify(revision) || !validateImageMetadata(result.metadata)) return false;
  if (result.preview === null) return token(result.failure);
  if (result.failure !== null || !record(result.preview) || !['full', 'thumbnail'].includes(String(result.preview.kind))) return false;
  const d = result.preview.descriptor;
  if (!record(d) || d.contract_version !== 1 || !IMAGE_CODECS.includes(d.codec as RasterCodec) || !['raster', 'animation'].includes(String(d.family))) return false;
  if (![d.width, d.height, d.display_width, d.display_height].every(v => count(v, 200_000_000) && v > 0) || !count(d.pixels, 200_000_000) || !count(d.decoded_bytes, 400_000_000) || !count(d.orientation, 8) || d.orientation === 0 || !count(d.bits_per_pixel, 128) || typeof d.alpha !== 'boolean' || !token(d.color_policy) || !token(d.profile_status)) return false;
  if (!Array.isArray(d.limitations) || d.limitations.length > 32 || !d.limitations.every(token) || !record(d.capabilities)) return false;
  const capabilities = d.capabilities;
  if (['view', 'inspect_metadata', 'zoom'].some(k => capabilities[k] !== true) || ['edit', 'save', 'animate', 'select_frame', 'select_entry', 'export_entry'].some(k => capabilities[k] !== false)) return false;
  if (d.pixels !== Number(d.width) * Number(d.height) || d.decoded_bytes !== Number(d.display_width) * Number(d.display_height) * 4 || d.bits_per_pixel === 0) return false;
  if (result.preview.kind === 'full' && Number(d.pixels) > 100_000_000) return false;
  const bytes = result.preview.png_bytes;
  if (!Array.isArray(bytes) || bytes.length < 57 || bytes.length > MAX_IMAGE_PNG_BYTES || !bytes.every(n => count(n, 255))) return false;
  if (![137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82].every((n,i) => bytes[i] === n)) return false;
  const dimension = (offset: number) => Number(bytes[offset]) * 0x1000000 + Number(bytes[offset + 1]) * 0x10000 + Number(bytes[offset + 2]) * 0x100 + Number(bytes[offset + 3]);
  if (dimension(16) !== d.display_width || dimension(20) !== d.display_height || bytes[24] !== 8 || bytes[25] !== 6 || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) return false;
  return [0,0,0,0,73,69,78,68,174,66,96,130].every((n,i) => bytes[bytes.length - 12 + i] === n);
};
