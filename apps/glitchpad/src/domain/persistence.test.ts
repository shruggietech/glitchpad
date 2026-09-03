import { initialSessions } from '../App';
import {
  defaultPreferences,
  normalizeExtension,
  normalizePreferences,
  projectSessionState,
} from './persistence';

describe('bounded persistence policy', () => {
  it('defaults invalid preference fields independently', () => {
    expect(normalizePreferences({
      ...defaultPreferences(),
      theme: 'dark',
      editor_font_family: '\u0000private',
      editor_font_size: 20,
      tab_width: 99,
      language_overrides: { '.RS': 'rust', '../../secret': 'python' },
    })).toEqual({
      ...defaultPreferences(),
      theme: 'dark',
      editor_font_size: 20,
      language_overrides: { rs: 'rust' },
    });
  });

  it('normalizes only bounded extension tokens', () => {
    expect(normalizeExtension('.TSX')).toBe('tsx');
    expect(normalizeExtension('../notes')).toBeNull();
    expect(normalizeExtension('a'.repeat(33))).toBeNull();
  });

  it('projects only restorable sources without document content', () => {
    const source = {
      ...initialSessions[0],
      source_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
      source: {
        ...initialSessions[0].source,
        restoration_reference: '70cbf05c-53f5-4442-9ace-9d576529714c',
        capabilities: { ...initialSessions[0].source.capabilities, reopen: true },
      },
    };
    const projected = projectSessionState([source, initialSessions[1]], source.id, 'closed');
    expect(projected.sessions).toHaveLength(1);
    expect(projected.window.active_session_index).toBe(0);
    expect(projected.sessions[0].source_reference).toBe(source.source.restoration_reference);
    expect(JSON.stringify(projected)).not.toContain(source.content);
    expect(JSON.stringify(projected)).not.toContain('normalized_text');
  });

  it('never mistakes an ephemeral source id for a durable restoration reference', () => {
    const source = {
      ...initialSessions[0],
      source_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
      source: {
        ...initialSessions[0].source,
        capabilities: { ...initialSessions[0].source.capabilities, reopen: true },
      },
    };
    expect(projectSessionState([source], source.id, 'closed').sessions).toEqual([]);
  });

  it('projects opaque recovery references without recovery content', () => {
    const recordId = '0f4a54bd-2855-44bb-855d-81703880ac78';
    const projected = projectSessionState(
      [initialSessions[0]],
      initialSessions[0].id,
      'closed',
      new Map([[initialSessions[0].id, recordId]]),
    );
    expect(projected.sessions[0].recovery_record_id).toBe(recordId);
    expect(JSON.stringify(projected)).not.toContain(initialSessions[0].content);
  });
});
