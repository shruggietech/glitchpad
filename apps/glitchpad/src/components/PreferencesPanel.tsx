import { useEffect, useRef } from 'react';

import type { PreferenceState } from '../domain/persistence';

interface PreferencesPanelProps {
  value: PreferenceState;
  onChange: (value: PreferenceState) => void;
  onReset: () => void;
  onClose: () => void;
}

export function PreferencesPanel({ value, onChange, onReset, onClose }: PreferencesPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const update = <K extends keyof PreferenceState>(key: K, next: PreferenceState[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <aside className="application-sheet" aria-label="Preferences" onKeyDown={(event) => {
      if (event.key === 'Escape') onClose();
    }}>
      <header className="application-sheet-header">
        <div><h2>Preferences</h2><p>Stored only on this device.</p></div>
        <button ref={closeRef} type="button" onClick={onClose}>Close preferences</button>
      </header>
      <div className="preference-fields">
        <label>Theme
          <select value={value.theme} onChange={(event) => update('theme', event.target.value as PreferenceState['theme'])}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
        <label>Editor font family
          <input value={value.editor_font_family} maxLength={128} onChange={(event) => update('editor_font_family', event.target.value)} />
        </label>
        <label>Editor font size
          <input type="number" min={8} max={72} value={value.editor_font_size} onChange={(event) => update('editor_font_size', Number(event.target.value))} />
        </label>
        <label>Tab width
          <input type="number" min={1} max={16} value={value.tab_width} onChange={(event) => update('tab_width', Number(event.target.value))} />
        </label>
        <label><input type="checkbox" checked={value.line_wrap} onChange={(event) => update('line_wrap', event.target.checked)} /> Wrap long lines</label>
        <label>Markdown default
          <select value={value.markdown_default_mode} onChange={(event) => update('markdown_default_mode', event.target.value as PreferenceState['markdown_default_mode'])}>
            <option value="rendered">Rendered</option><option value="source">Source</option>
          </select>
        </label>
      </div>
      <button type="button" onClick={onReset}>Reset preferences</button>
    </aside>
  );
}
