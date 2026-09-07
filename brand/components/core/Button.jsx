export function Button({ variant = "primary", size = "md", children, ...props }) {
  return <button className={`gl-button gl-button--${variant} gl-button--${size}`} type="button" {...props}>{children}</button>;
}
