export function Card({ children, ...props }) {
  return <div className="gl-card" {...props}>{children}</div>;
}
