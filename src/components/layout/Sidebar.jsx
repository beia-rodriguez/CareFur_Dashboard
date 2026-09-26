import {
  BellRinging,
  CalendarCheck,
  CalendarPlus,
  Camera,
  ChatCircleDots,
  ForkKnife,
  House,
  PawPrint,
  SignOut,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import { NavLink } from "react-router-dom";
import logo from "../../assets/logos/snuggles_logo.png";
import useAuth from "../../hooks/useAuth";
import "./Sidebar.css";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: SquaresFour },
  { label: "New Boarding", to: "/boarding/new", icon: CalendarPlus },
  { label: "Boarding List", to: "/boardings", icon: CalendarCheck },
  { label: "Pets", to: "/pets", icon: PawPrint },
  { label: "Rooms", to: "/rooms", icon: House },
  { label: "Feeding", to: "/feeding-schedules", icon: ForkKnife },
  { label: "Cameras", to: "/cameras", icon: Camera },
  { label: "Alerts", to: "/alerts", icon: BellRinging },
  { label: "Messages", to: "/messages", icon: ChatCircleDots },
  { label: "Staff", to: "/staff", icon: UsersThree, adminOnly: true },
];

export default function Sidebar({ isOpen, onClose }) {
  const { logout, profile, isAdmin } = useAuth();

  async function handleLogout() {
    try { await logout(); } catch (error) { console.error("Logout failed:", error); }
  }

  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand">
        <img src={logo} alt="Snuggles Premium Pet Hotel" className="sidebar-brand__logo" />
        <div className="sidebar-brand__copy"><strong>CareFur</strong><span>Pet Hotel Console</span></div>
        <button type="button" className="sidebar-close" aria-label="Close navigation" onClick={onClose}>×</button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <p className="sidebar-group-title">Workspace</p>
        {navigation.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} onClick={onClose} className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}><Icon size={20} weight="duotone" /><span>{item.label}</span></NavLink>;
        })}
      </nav>

      <div className="sidebar-account">
        <div className="sidebar-avatar">{getInitials(profile?.full_name)}</div>
        <div className="sidebar-account__copy"><strong>{profile?.full_name || "CareFur Staff"}</strong><span>{profile?.role || "staff"}</span></div>
        <button type="button" className="sidebar-logout" onClick={handleLogout} aria-label="Log out"><SignOut size={19} /></button>
      </div>
    </aside>
  );
}

function getInitials(name) {
  const parts = String(name || "CF").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CF";
}
