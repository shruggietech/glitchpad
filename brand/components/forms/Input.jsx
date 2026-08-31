export function Input({ label, type = "text", required = false, error, id, ...props }) {
  const fieldId = id || `gp-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <label className="gp-field" htmlFor={fieldId}><span className="gp-field__label">{label}{required ? <span className="gp-field__required"> *</span> : null}</span><input className="gp-field__control" id={fieldId} type={type} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined} {...props} />{error ? <span className="gp-field__error" id={`${fieldId}-error`}>{error}</span> : null}</label>;
}
