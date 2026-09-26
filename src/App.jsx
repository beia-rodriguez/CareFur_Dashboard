import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import LoadingScreen from "./components/LoadingScreen";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewBoarding from "./pages/NewBoarding";
import Boardings from "./pages/Boardings";
import Pets from "./pages/Pets";
import Rooms from "./pages/Rooms";
import FeedingSchedule from "./pages/FeedingSchedule";
import Cameras from "./pages/Cameras";
import Alerts from "./pages/Alerts";
import Messages from "./pages/Messages";
import StaffManagement from "./pages/StaffManagement";

export default function App() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return (
      <LoadingScreen
        onFinish={() => setLoading(false)}
      />
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/boarding/new" element={<NewBoarding />} />
        <Route path="/boardings" element={<Boardings />} />
        <Route path="/pets" element={<Pets />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/feeding-schedules" element={<FeedingSchedule />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/messages" element={<Messages />} />

        <Route
          path="/staff"
          element={
            <AdminRoute>
              <StaffManagement />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}