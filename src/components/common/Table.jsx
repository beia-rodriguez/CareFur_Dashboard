import "./Common.css";

export default function Table({ children, className = "" }) {
  return (
    <div className="ui-table-wrap">
      <table className={["ui-table", className].filter(Boolean).join(" ")}>{children}</table>
    </div>
  );
}
