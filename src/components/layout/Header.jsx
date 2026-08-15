import useAuth from "../../hooks/useAuth";
import "./Header.css";

export default function Header({ onMenuClick }) {
  const { profile } = useAuth();

  return (
    <header className="dashboard-header">
      <button
        type="button"
        className="menu-button"
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        ☰
      </button>

      <div className="header-brand">
        <strong>CareFur</strong>
        <span>Staff Dashboard</span>
      </div>

      <div className="header-user">
        <span>{profile?.full_name || "Staff"}</span>
      </div>
    </header>
  );
}