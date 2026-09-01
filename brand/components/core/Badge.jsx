export function Badge({ tone = "neutral", children }) {
  return <span className={`gp-badge gp-badge--${tone}`}>{children}</span>;
}
