export function Button({ variant = "primary", size = "md", children, ...props }) {
  return <button className={`gp-button gp-button--${variant} gp-button--${size}`} type="button" {...props}>{children}</button>;
}
