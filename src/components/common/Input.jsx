import "./Common.css";

export default function Input({ label, error, id, className = "", ...props }) {
  return (
    <label className={["ui-field", className].filter(Boolean).join(" ")} htmlFor={id}>
      {label && <span>{label}</span>}
      <input id={id} className={error ? "ui-input ui-input--error" : "ui-input"} {...props} />
      {error && <small className="ui-field-error">{error}</small>}
    </label>
  );
}
