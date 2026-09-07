export function Badge({ tone = "neutral", children }) {
  return <span className={`gl-badge gl-badge--${tone}`}>{children}</span>;
}
