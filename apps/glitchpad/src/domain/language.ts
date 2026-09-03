import type { LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';

import type {
  LanguageDecision,
  LanguageEvidence,
  LanguageId,
} from './contracts';

const descriptions = new Map<LanguageId, string>([
  ['rust', 'Rust'],
  ['typescript', 'TypeScript'],
  ['javascript', 'JavaScript'],
  ['python', 'Python'],
  ['json', 'JSON'],
  ['toml', 'TOML'],
  ['yaml', 'YAML'],
  ['css', 'CSS'],
  ['html', 'HTML'],
]);

const extensions = new Map<string, LanguageId>([
  ['rs', 'rust'],
  ['ts', 'typescript'],
  ['tsx', 'typescript'],
  ['js', 'javascript'],
  ['jsx', 'javascript'],
  ['mjs', 'javascript'],
  ['cjs', 'javascript'],
  ['py', 'python'],
  ['json', 'json'],
  ['jsonc', 'json'],
  ['toml', 'toml'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
  ['css', 'css'],
  ['html', 'html'],
  ['htm', 'html'],
]);

const CONTENT_PROBE_LIMIT = 64 * 1024;

export const detectLanguage = (
  displayName: string,
  text: string,
): LanguageDecision => {
  const evidence: LanguageEvidence[] = [];
  const probe = text.slice(0, CONTENT_PROBE_LIMIT);
  const lowerName = displayName.toLowerCase();
  if (lowerName === 'cargo.toml')
    evidence.push({
      kind: 'exact_filename',
      language: 'toml',
      detail: 'Cargo.toml',
    });
  const extension = lowerName.includes('.')
    ? lowerName.split('.').at(-1)
    : null;
  const extensionLanguage = extension ? extensions.get(extension) : undefined;
  if (extensionLanguage)
    evidence.push({
      kind: 'extension',
      language: extensionLanguage,
      detail: `.${extension}`,
    });

  const firstLine = probe.slice(
    0,
    probe.indexOf('\n') < 0 ? 256 : probe.indexOf('\n'),
  );
  if (/^#!.*\bpython(?:3)?\b/i.test(firstLine))
    evidence.push({ kind: 'shebang', language: 'python', detail: 'python' });
  else if (/^#!.*\b(?:node|deno)\b/i.test(firstLine))
    evidence.push({
      kind: 'shebang',
      language: 'javascript',
      detail: 'javascript-runtime',
    });

  const modeline = probe
    .slice(0, 2048)
    .match(
      /(?:mode:\s*|ft=)(rust|typescript|javascript|python|json|toml|yaml|css|html)\b/i,
    );
  if (modeline?.[1])
    evidence.push({
      kind: 'modeline',
      language: modeline[1].toLowerCase() as LanguageId,
      detail: modeline[0],
    });

  const contentLanguage = detectContentLanguage(probe);
  if (contentLanguage)
    evidence.push({
      kind: 'content',
      language: contentLanguage,
      detail: 'bounded-content-structure',
    });

  const selected = selectLanguage(evidence);
  const selectedEvidence = selected
    ? evidence.filter(({ language }) => language === selected.language)
    : [];
  const conflicts = selected
    ? evidence.filter(({ language }) => language !== selected.language)
    : [];
  return {
    language: selected?.language ?? 'plain_text',
    confidence:
      selectedEvidence.length > 1
        ? 'high'
        : selected
          ? conflicts.length > 0
            ? 'low'
            : 'medium'
          : 'low',
    evidence: selectedEvidence.slice(0, 16),
    conflicts: conflicts.slice(0, 16),
    origin: 'automatic',
    status: selected ? 'loading' : 'plain',
    load_revision: 0,
    fallback_code: null,
  };
};

export interface LanguageLoadResult {
  language: LanguageId;
  revision: number;
  status: 'highlighted' | 'unavailable' | 'cancelled' | 'failed';
  support: LanguageSupport | null;
}

export class LanguageLoader {
  private token = 0;

  cancel(): void {
    this.token += 1;
  }

  async load(
    language: LanguageId,
    revision: number,
  ): Promise<LanguageLoadResult> {
    const token = ++this.token;
    if (language === 'plain_text')
      return { language, revision, status: 'unavailable', support: null };
    const name = descriptions.get(language);
    const description = languages.find((candidate) => candidate.name === name);
    if (!description)
      return { language, revision, status: 'unavailable', support: null };
    try {
      const support = await description.load();
      if (token !== this.token)
        return { language, revision, status: 'cancelled', support: null };
      return { language, revision, status: 'highlighted', support };
    } catch {
      return { language, revision, status: 'failed', support: null };
    }
  }
}

const evidencePriority = ({ kind }: LanguageEvidence): number =>
  kind === 'modeline'
    ? 5
    : kind === 'shebang'
      ? 4
      : kind === 'exact_filename'
        ? 3
        : kind === 'extension'
          ? 2
          : 1;

const selectLanguage = (
  evidence: readonly LanguageEvidence[],
): LanguageEvidence | undefined =>
  [...evidence].sort((left, right) => {
    const count = (candidate: LanguageEvidence) =>
      evidence.filter(({ language }) => language === candidate.language).length;
    return (
      count(right) - count(left) ||
      evidencePriority(right) - evidencePriority(left)
    );
  })[0];

const detectContentLanguage = (probe: string): LanguageId | null => {
  const trimmed = probe.replace(/^[\uFEFF\s]+/, '');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // A truncated or malformed JSON-looking probe is not decisive evidence.
    }
  }
  if (
    trimmed.startsWith('fn ') ||
    trimmed.startsWith('pub ') ||
    trimmed.includes('fn main()')
  )
    return 'rust';
  if (trimmed.startsWith('def ') || trimmed.startsWith('class '))
    return 'python';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('<!doctype html') || lower.startsWith('<html'))
    return 'html';
  return null;
};
