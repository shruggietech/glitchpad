import { useEffect, useState } from 'react';
export function useCompactLayout() {
  const [layout, setLayout] = useState(() => ({
    compact: window.innerWidth < 768 || window.innerHeight < 480,
    short: window.innerHeight < 320,
  }));
  useEffect(() => {
    const frame =
      document.querySelector<HTMLElement>('.app-shell') ??
      document.getElementById('bb-main');
    const update = () => {
      const bounds = frame?.getBoundingClientRect();
      const width = bounds?.width || window.innerWidth;
      const height = bounds?.height || window.innerHeight;
      setLayout((previous) => {
        const compact = width < 768 || height < 480;
        const short = height < 320;
        return previous.compact === compact && previous.short === short
          ? previous
          : { compact, short };
      });
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (frame) observer?.observe(frame);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    update();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return layout;
}
