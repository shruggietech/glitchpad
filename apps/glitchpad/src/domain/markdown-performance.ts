import { MARKDOWN_SANITIZER_VERSION } from './markdown-contract';
import { renderMarkdown } from './markdown-pipeline';

export interface MarkdownPerformanceSample {
  source_bytes: number;
  source_digest: string;
  samples_ms: number[];
  median_ms: number;
  p95_ms: number;
  maximum_ms: number;
}

export const deterministicMarkdownFixture = (minimumBytes = 1024 * 1024): string => {
  const prefix = '# Heading\n\nA deterministic **Markdown** paragraph with `code`.\n\n';
  const unit = 'bounded local content ';
  return (prefix + unit.repeat(Math.ceil((minimumBytes - prefix.length) / unit.length))).slice(0, minimumBytes);
};

const percentile = (samples: number[], fraction: number): number =>
  samples[Math.min(samples.length - 1, Math.ceil(samples.length * fraction) - 1)] ?? 0;

export const measureMarkdownProjection = async (source = deterministicMarkdownFixture(), iterations = 3): Promise<MarkdownPerformanceSample> => {
  const encoded = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const sourceDigest = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const result = await renderMarkdown({
      request_id: `performance-${index}`,
      session_id: 'performance',
      source_revision: index + 1,
      source_text: source,
      sanitizer_version: MARKDOWN_SANITIZER_VERSION,
    });
    samples.push(performance.now() - started);
    if (result.status !== 'ready') throw new Error(`Markdown performance projection failed: ${result.status}`);
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    source_bytes: encoded.byteLength,
    source_digest: sourceDigest,
    samples_ms: samples,
    median_ms: percentile(sorted, 0.5),
    p95_ms: percentile(sorted, 0.95),
    maximum_ms: percentile(sorted, 1),
  };
};
