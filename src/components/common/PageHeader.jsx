import "./Common.css";

export default function PageHeader({ eyebrow = "CareFur", title, description, actions }) {
  return (
    <header className="ui-page-header">
      <div>
        <p className="ui-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="ui-page-description">{description}</p>}
      </div>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </header>
  );
}
