import type { LinkCandidate, ResourceCandidate } from './markdown-contract';

export const MARKDOWN_TARGET_MAX_CHARS = 2_048;

const scheme = /^[a-z][a-z0-9+.-]*:/iu;

const containsForbiddenCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point <= 0x1f || point === 0x7f || (point >= 0x202a && point <= 0x202e) || (point >= 0x2066 && point <= 0x2069);
  });

const safelyDecode = (target: string): string | null => {
  try {
    return decodeURIComponent(target);
  } catch {
    return null;
  }
};

const blocked = (target: string, code: string): LinkCandidate => ({
  kind: 'blocked',
  authored_target: target,
  normalized_target: null,
  display_target: 'Blocked destination',
  reason_code: code,
});

const malformed = (target: string, code: string): LinkCandidate => ({
  kind: 'malformed',
  authored_target: target,
  normalized_target: null,
  display_target: 'Malformed destination',
  reason_code: code,
});

export const classifyMarkdownTarget = (authoredTarget: string): LinkCandidate => {
  const target = authoredTarget.trim();
  if (!target || target.length > MARKDOWN_TARGET_MAX_CHARS)
    return malformed(authoredTarget, 'target_length');
  const decoded = safelyDecode(target);
  if (decoded === null) return malformed(authoredTarget, 'target_encoding');
  if (containsForbiddenCharacter(target) || containsForbiddenCharacter(decoded))
    return blocked(authoredTarget, 'target_control');
  if (target.startsWith('//') || target.includes('\\'))
    return blocked(authoredTarget, 'target_ambiguous');
  if (target.startsWith('#')) {
    return {
      kind: 'fragment',
      authored_target: authoredTarget,
      normalized_target: target,
      display_target: target,
      reason_code: null,
    };
  }
  if (!scheme.test(target)) {
    return {
      kind: 'local',
      authored_target: authoredTarget,
      normalized_target: target,
      display_target: target,
      reason_code: 'local_authority_required',
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return malformed(authoredTarget, 'target_parse');
  }
  const protocol = parsed.protocol.toLowerCase();
  if (!['http:', 'https:', 'mailto:'].includes(protocol))
    return blocked(authoredTarget, 'target_scheme');
  if (parsed.username || parsed.password)
    return blocked(authoredTarget, 'target_credentials');
  if (protocol === 'mailto:' && (!parsed.pathname || parsed.pathname.includes(',')))
    return blocked(authoredTarget, 'target_mailbox');
  const normalized = parsed.toString();
  return {
    kind: protocol === 'mailto:' ? 'email' : 'external',
    authored_target: authoredTarget,
    normalized_target: normalized,
    display_target: normalized,
    reason_code: null,
  };
};

export const classifyMarkdownResource = (
  authoredTarget: string,
  alt: string,
): ResourceCandidate => {
  const candidate = classifyMarkdownTarget(authoredTarget);
  if (candidate.kind === 'local') {
    return {
      kind: 'local',
      authored_target: authoredTarget,
      normalized_target: candidate.normalized_target,
      alt,
      reason_code: 'local_authority_required',
    };
  }
  return {
    kind: candidate.kind === 'malformed' ? 'malformed' : 'blocked',
    authored_target: authoredTarget,
    normalized_target: null,
    alt,
    reason_code:
      candidate.kind === 'external' || candidate.kind === 'email'
        ? 'remote_resource_blocked'
        : candidate.reason_code,
  };
};
