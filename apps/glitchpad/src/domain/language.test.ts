import { describe, expect, it } from 'vitest';

import { detectLanguage, LanguageLoader } from './language';

describe('language detection', () => {
  it('combines bounded filename and content evidence', () => {
    const decision = detectLanguage('tool.py', '#!/usr/bin/env python3\nprint(1)');
    expect(decision).toMatchObject({ language: 'python', confidence: 'high' });
    expect(decision.evidence).toHaveLength(2);
  });

  it('lets a modeline resolve conflicting extension evidence', () => {
    const decision = detectLanguage('wrong.js', '// mode: rust\nfn main() {}');
    expect(decision.language).toBe('rust');
    expect(decision.conflicts).toHaveLength(1);
  });

  it('falls back to plain text without loading a grammar', async () => {
    const decision = detectLanguage('README', 'ordinary prose');
    expect(decision).toMatchObject({ language: 'plain_text', status: 'plain' });
    await expect(new LanguageLoader().load('plain_text', 4)).resolves.toMatchObject({
      revision: 4,
      status: 'unavailable',
      support: null,
    });
  });

  it('cancels a superseded grammar result', async () => {
    const loader = new LanguageLoader();
    const first = loader.load('rust', 1);
    const second = loader.load('python', 2);
    await expect(first).resolves.toMatchObject({ status: 'cancelled', support: null });
    await expect(second).resolves.toMatchObject({ status: 'highlighted', revision: 2 });
  });
});
