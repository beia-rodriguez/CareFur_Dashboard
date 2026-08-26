import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute";

import DashboardLayout from "./components/layout/DashboardLayout";

import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";

import NewBoarding from "./pages/NewBoarding";

import Pets from "./pages/Pets";

import Rooms from "./pages/Rooms";

import FeedingSchedule from "./pages/FeedingSchedule";

import Messages from "./pages/Messages";

import AdminRoute from "./components/auth/AdminRoute";

import StaffManagement from "./pages/StaffManagement";

export default function App() {
  return (
    <Routes>
      {/* PUBLIC */}

      <Route
        path="/login"
        element={
          <Login />
        }
      />

      {/* PROTECTED */}

      <Route
        element={
          <ProtectedRoute
            allowedRoles={[
              "admin",
              "staff",
            ]}
          >
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* DASHBOARD */}

        <Route
          path="/dashboard"
          element={
            <Dashboard />
          }
        />

        {/* STAFF MANAGEMENT */}

        <Route
          path="/staff"
          element={
            <AdminRoute>
              <StaffManagement />
            </AdminRoute>
          }
        />

        {/* NEW BOARDING */}

        <Route
          path="/boarding/new"
          element={
            <NewBoarding />
          }
        />

        {/* PETS */}

        <Route
          path="/pets"
          element={
            <Pets />
          }
        />

        {/* ROOMS */}

        <Route
          path="/rooms"
          element={
            <Rooms />
          }
        />

        {/* FEEDING */}

        <Route
          path="/feeding-schedules"
          element={
            <FeedingSchedule />
          }
        />

        {/* MESSAGES */}

        <Route
          path="/messages"
          element={
            <Messages />
          }
        />
      </Route>

      {/* UNKNOWN */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}