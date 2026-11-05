import { useEffect, useRef, useState } from 'react';
import {
  defaultPreferences,
  type PreferenceState,
} from '../domain/persistence';
import './DocumentTools.css';
import { TaskSurface } from './TaskSurface';

interface PreferencesPanelProps {
  value: PreferenceState;
  onChange: (value: PreferenceState) => void;
  onReset: () => Promise<void | boolean>;
  onClose: () => void;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export function PreferencesPanel({
  value,
  onChange,
  onReset,
  onClose,
  embedded = false,
  onBusyChange,
}: PreferencesPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const live = useRef(true);
  const pendingRef = useRef(false);
  const [size, setSize] = useState(String(value.editor_font_size));
  const [width, setWidth] = useState(String(value.tab_width));
  const [family, setFamily] = useState(value.editor_font_family);
  const [errors, setErrors] = useState({ size: '', width: '', family: '' });
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  useEffect(() => {
    busyCallback.current?.(pending);
  }, [pending]);
  useEffect(() => {
    live.current = true;
    if (!embedded) closeRef.current?.focus();
    return () => {
      live.current = false;
    };
  }, [embedded]);
  useEffect(
    () => setSize(String(value.editor_font_size)),
    [value.editor_font_size],
  );
  useEffect(() => setWidth(String(value.tab_width)), [value.tab_width]);
  useEffect(
    () => setFamily(value.editor_font_family),
    [value.editor_font_family],
  );
  const update = <K extends keyof PreferenceState>(
    key: K,
    next: PreferenceState[K],
  ) => {
    if (value[key] !== next) onChange({ ...value, [key]: next });
    setStatus('Preferences updated on this device.');
  };
  const commitNumber = (kind: 'size' | 'width') => {
    const text = kind === 'size' ? size : width;
    const min = kind === 'size' ? 8 : 1;
    const max = kind === 'size' ? 72 : 16;
    const parsed = /^\d+$/u.test(text) ? Number(text) : NaN;
    const error =
      !Number.isSafeInteger(parsed) || parsed < min || parsed > max
        ? 'Enter a whole number from ' + min + ' to ' + max + '.'
        : '';
    setErrors((current) => ({ ...current, [kind]: error }));
    if (!error)
      update(kind === 'size' ? 'editor_font_size' : 'tab_width', parsed);
  };
  const commitFamily = () => {
    const text = family.trim();
    const valid =
      text.length > 0 &&
      [...text].length <= 128 &&
      !/[\p{Cc}]/u.test(text) &&
      (typeof CSS === 'undefined' ||
        !CSS.supports ||
        CSS.supports('font-family', text));
    setErrors((current) => ({
      ...current,
      family: valid ? '' : 'Enter a valid font family, or use ui-monospace.',
    }));
    if (valid) update('editor_font_family', text);
  };
  const reset = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setStatus('Resetting preferences');
    try {
      const ok = (await onReset()) !== false;
      if (!live.current) return;
      if (ok) {
        const defaults = defaultPreferences();
        setSize(String(defaults.editor_font_size));
        setWidth(String(defaults.tab_width));
        setFamily(defaults.editor_font_family);
        setErrors({ size: '', width: '', family: '' });
        setConfirmReset(false);
      }
      setStatus(
        ok
          ? 'Preferences reset. Your files are unchanged.'
          : 'Preferences could not be reset. Your files are unchanged.',
      );
    } catch {
      if (live.current)
        setStatus('Preferences could not be reset. Your files are unchanged.');
    } finally {
      pendingRef.current = false;
      if (live.current) setPending(false);
    }
  };
  return (
    <aside
      className={
        embedded
          ? 'preferences-content document-tools'
          : 'application-sheet document-tools'
      }
      aria-label="Preferences"
      aria-busy={pending}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !embedded) {
          event.preventDefault();
          event.stopPropagation();
          if (!pending) onClose();
        }
      }}
    >
      <header className="application-sheet-header">
        <div>
          {!embedded && <h2>Preferences</h2>}
          <p>Stored only on this device. Files are unchanged.</p>
        </div>
        {!embedded && (
          <button
            ref={closeRef}
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            Close preferences
          </button>
        )}
      </header>
      <fieldset className="preference-fields" disabled={pending}>
        <legend className="visually-hidden">Document defaults</legend>
        <label>
          Theme
          <select
            value={value.theme}
            onChange={(event) =>
              update('theme', event.target.value as PreferenceState['theme'])
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Editor font family
          <input
            value={family}
            maxLength={128}
            aria-invalid={Boolean(errors.family)}
            aria-describedby="preference-family-help preference-family-error"
            onChange={(event) => setFamily(event.target.value)}
            onBlur={commitFamily}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitFamily();
              }
            }}
          />
        </label>
        <p id="preference-family-help">
          If a custom font is unavailable, the editor uses a monospace fallback.
        </p>
        <p
          id="preference-family-error"
          role={errors.family ? 'alert' : undefined}
        >
          {errors.family}
        </p>
        <label>
          Editor font size
          <input
            type="number"
            min={8}
            max={72}
            step={1}
            value={size}
            aria-invalid={Boolean(errors.size)}
            aria-describedby="preference-size-error"
            onChange={(event) => setSize(event.target.value)}
            onBlur={() => commitNumber('size')}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitNumber('size');
              }
            }}
          />
        </label>
        <p id="preference-size-error" role={errors.size ? 'alert' : undefined}>
          {errors.size}
        </p>
        <label>
          Tab width
          <input
            type="number"
            min={1}
            max={16}
            step={1}
            value={width}
            aria-invalid={Boolean(errors.width)}
            aria-describedby="preference-width-help preference-width-error"
            onChange={(event) => setWidth(event.target.value)}
            onBlur={() => commitNumber('width')}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitNumber('width');
              }
            }}
          />
        </label>
        <p id="preference-width-help">Spaces per indentation level.</p>
        <p
          id="preference-width-error"
          role={errors.width ? 'alert' : undefined}
        >
          {errors.width}
        </p>
        <label className="preference-checkbox">
          <input
            type="checkbox"
            checked={value.line_wrap}
            onChange={(event) => update('line_wrap', event.target.checked)}
          />{' '}
          Wrap long lines
        </label>
        <p>
          Default wrapping. Wrap lines in document tools changes only that
          document.
        </p>
        <label>
          Default Markdown view
          <select
            value={value.markdown_default_mode}
            onChange={(event) =>
              update(
                'markdown_default_mode',
                event.target.value as PreferenceState['markdown_default_mode'],
              )
            }
          >
            <option value="rendered">Rendered</option>
            <option value="source">Source</option>
          </select>
        </label>
        <p>Newly opened Markdown uses this view. Current edits stay open.</p>
      </fieldset>
      <p
        className="preference-preview"
        aria-label="Editor font preview"
        style={{
          fontFamily: family + ', ui-monospace, monospace',
          fontSize:
            /^\d+$/u.test(size) && Number(size) >= 8 && Number(size) <= 72
              ? Number(size)
              : value.editor_font_size,
        }}
      >
        Aa 0123, editor preview
      </p>
      <button
        ref={resetRef}
        type="button"
        disabled={pending}
        onClick={() => setConfirmReset(true)}
      >
        Reset preferences
      </button>
      <TaskSurface
        open={confirmReset}
        onOpenChange={(open) => {
          if (!pending) setConfirmReset(open);
        }}
        title="Reset preferences?"
        opener={resetRef.current}
        canClose={!pending}
      >
        <div role="group" aria-label="Reset preferences?" aria-busy={pending}>
          <p>
            Restore document defaults and theme on this device? Your files are
            unchanged.
          </p>
          <p role="status" aria-live="polite">
            {status}
          </p>
          <button type="button" disabled={pending} onClick={() => void reset()}>
            Reset settings
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setConfirmReset(false);
              requestAnimationFrame(() => resetRef.current?.focus());
            }}
          >
            Cancel reset
          </button>
        </div>
      </TaskSurface>
      {!confirmReset && (
        <p role="status" aria-live="polite">
          {status}
        </p>
      )}
    </aside>
  );
}
