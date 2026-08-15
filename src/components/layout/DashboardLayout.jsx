import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  function openSidebar() {
    setIsSidebarOpen(true);
  }

  function closeSidebar() {
    setIsSidebarOpen(false);
  }

  return (
    <div className="dashboard-layout">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />

      {isSidebarOpen && (
        <button
          type="button"
          className="dashboard-overlay"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      )}

      <div className="dashboard-main">
        <Header onMenuClick={openSidebar} />

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}