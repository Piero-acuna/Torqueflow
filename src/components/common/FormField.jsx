export function FormField({ label, error, hint, required, children, className = "" }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span className="field__label">
        {label}{required ? <span className="field__required"> *</span> : null}
      </span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
      {!error && hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = "", ...props }) {
  return <input className={`input ${className}`.trim()} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return <select className={`input ${className}`.trim()} {...props}>{children}</select>;
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={`input textarea ${className}`.trim()} {...props} />;
}
