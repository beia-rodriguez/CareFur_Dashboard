import "./Common.css";

export default function EmptyState({ icon: Icon, title = "Nothing here yet", message, action }) {
  return (
    <div className="ui-empty-state">
      {Icon && <Icon size={28} weight="duotone" aria-hidden="true" />}
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
