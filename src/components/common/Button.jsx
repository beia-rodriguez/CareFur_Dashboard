import "./Common.css";

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
