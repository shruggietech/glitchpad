import { useEffect, useRef } from 'react';
import { appendRecoveryHelp } from '../recovery-help';
export function RecoveryHelp() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) return appendRecoveryHelp(root.current);
  }, []);
  return <div ref={root} />;
}
