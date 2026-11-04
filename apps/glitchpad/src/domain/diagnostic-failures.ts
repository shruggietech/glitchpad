import { invoke } from '@tauri-apps/api/core';
import {
  diagnosticEnvironment,
  type DiagnosticFailure,
  type DiagnosticEvent,
} from './persistence';
const components = new Set([
  'bootstrap',
  'application',
  'document',
  'markdown',
  'image',
  'source',
  'action',
  'export',
]);
const stages = new Set([
  'bootstrap',
  'delivery',
  'read',
  'session',
  'render',
  'worker',
  'parse',
  'sanitize',
  'projection',
  'execute',
  'write',
  'readback',
  'share',
  'recovery',
]);
const reasons = new Set([
  'root_missing',
  'module_load_failed',
  'application_mount_failed',
  'application_render_failed',
  'document_render_failed',
  'markdown_worker_failed',
  'markdown_render_timeout',
  'markdown_projection_invalid',
  'markdown_projection_failed',
  'markdown_parse_failed',
  'markdown_output_limited',
  'markdown_policy_mismatch',
  'source_delivery_failed',
  'source_read_failed',
  'image_render_failed',
  'action_failed',
  'action_unavailable',
  'export_write_failed',
  'export_readback_failed',
  'share_failed',
  'recovery_flush_failed',
  'cancelled',
  'permission_denied',
  'stale_session',
  'budget_exceeded',
  'invalid_response',
]);
const pending = new Set<Promise<void>>();
const fallback: DiagnosticEvent[] = [];
export const recordFailure = (
  component: string,
  stage: string,
  reason: string,
): void => {
  if (!components.has(component) || !stages.has(stage) || !reasons.has(reason))
    return;
  const now = Date.now();
  const correlation_id = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const failure = {
    component,
    stage,
    reason,
    correlation_id,
  } as DiagnosticFailure;
  const event: DiagnosticEvent = {
    occurred_unix_ms: now,
    level: 'error',
    event_id: 'task_failed',
    platform: diagnosticEnvironment().platform,
    component:
      component === 'source'
        ? 'source'
        : component === 'action'
          ? 'shell'
          : component === 'export'
            ? 'application_state'
            : 'renderer',
    duration_ms: null,
    byte_count: null,
    error_code: reason,
    failure,
  };
  if (!('__TAURI_INTERNALS__' in window)) {
    fallback.push(event);
    if (fallback.length > 200) fallback.shift();
    return;
  }
  const task = invoke('append_diagnostic', { event, nowUnixMs: now })
    .then(() => undefined)
    .catch(() => {
      fallback.push(event);
      if (fallback.length > 200) fallback.shift();
    })
    .finally(() => pending.delete(task));
  pending.add(task);
};
export const collectFailureEvents = async (): Promise<DiagnosticEvent[]> => {
  await Promise.all([...pending]);
  return [...fallback];
};
export const discardCapturedFailureEvents = (
  events: readonly DiagnosticEvent[],
): void => {
  const captured = new Set(events);
  for (let index = fallback.length - 1; index >= 0; index -= 1) {
    if (captured.has(fallback[index])) fallback.splice(index, 1);
  }
};
export const installFailureCapture = (): void => {
  window.addEventListener('glitchpad:failure', (event) => {
    const d = (event as CustomEvent<DiagnosticFailure>).detail;
    if (d) recordFailure(d.component, d.stage, d.reason);
  });
};
