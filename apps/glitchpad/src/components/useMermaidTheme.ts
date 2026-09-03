import { useEffect, useState } from 'react';

export type MermaidTheme = 'light' | 'dark';

const colorSchemeQuery = '(prefers-color-scheme: light)';

const readTheme = (query?: MediaQueryList): MermaidTheme => {
  const selected = query ?? (typeof window === 'undefined' ? null : window.matchMedia?.(colorSchemeQuery));
  return selected?.matches ? 'light' : 'dark';
};

export const useMermaidTheme = (): MermaidTheme => {
  const [theme, setTheme] = useState<MermaidTheme>(() => readTheme());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(colorSchemeQuery);
    const update = () => setTheme(readTheme(query));
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return theme;
};
