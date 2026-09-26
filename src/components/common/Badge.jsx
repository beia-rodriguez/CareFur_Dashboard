import "./Common.css";

export default function Badge({ children, tone = "neutral", className = "" }) {
  return (
    <span className={["ui-badge", `ui-badge--${tone}`, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
