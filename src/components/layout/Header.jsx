import { List, WifiHigh } from "@phosphor-icons/react";
import useAuth from "../../hooks/useAuth";
import "./Header.css";

export default function Header({ onMenuClick }) {
  const { profile } = useAuth();
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__left">
        <button type="button" className="menu-button" aria-label="Open navigation" onClick={onMenuClick}>
          <List size={22} weight="bold" />
        </button>
        <div>
          <strong>CareFur Operations</strong>
          <span>Smart pet hotel management</span>
        </div>
      </div>
      <div className="dashboard-header__right">
        <span className="system-status"><WifiHigh size={16} weight="bold" /> Connected</span>
        <span className="header-user">{profile?.full_name || "Staff"}</span>
      </div>
    </header>
  );
}
