import "./Common.css";

export default function Select({ label, error, id, children, className = "", ...props }) {
  return (
    <label className={["ui-field", className].filter(Boolean).join(" ")} htmlFor={id}>
      {label && <span>{label}</span>}
      <select id={id} className={error ? "ui-input ui-input--error" : "ui-input"} {...props}>
        {children}
      </select>
      {error && <small className="ui-field-error">{error}</small>}
    </label>
  );
}
