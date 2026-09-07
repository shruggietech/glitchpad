export function Select({ id, label, required = false, error, children, ...props }) {
  return (
    <div className="gl-field">
      <label className="gl-field__label" htmlFor={id}>{label}{required ? <span className="gl-field__required" aria-hidden="true"> *</span> : null}</label>
      <select className="gl-field__control" id={id} required={required} {...props}>{children}</select>
      {error ? <p className="gl-field__error" role="alert">{error}</p> : null}
    </div>
  );
}
