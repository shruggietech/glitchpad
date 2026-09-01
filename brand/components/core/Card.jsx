export function Card({ children, className = "", ...props }) {
  return <section className={`gp-card ${className}`.trim()} {...props}>{children}</section>;
}
