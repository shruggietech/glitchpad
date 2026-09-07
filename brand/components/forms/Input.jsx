export function Input({ id, label, required = false, error, ...props }) {
  return (
    <div className="gl-field">
      <label className="gl-field__label" htmlFor={id}>{label}{required ? <span className="gl-field__required" aria-hidden="true"> *</span> : null}</label>
      <input className="gl-field__control" id={id} required={required} {...props} type="text" />
      {error ? <p className="gl-field__error" role="alert">{error}</p> : null}
    </div>
  );
}
