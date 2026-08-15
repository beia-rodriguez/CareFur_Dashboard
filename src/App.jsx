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

import AdminRoute from "./components/auth/AdminRoute";
import StaffManagement from "./pages/StaffManagement";


export default function App() {
  return (
    <Routes>

      {/* Public Route */}
      <Route
        path="/login"
        element={<Login />}
      />


      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
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


        <Route
          path="/dashboard"
          element={<Dashboard />}
        />


        <Route
          path="/staff"
          element={
            <AdminRoute>
              <StaffManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/boarding/new"
          element={<NewBoarding />}
        />

        <Route
          path="/pets"
          element={<Pets />}
        />

        <Route
          path="/rooms"
          element={<Rooms />}
        />

        <Route
          path="/feeding-schedules"
          element={<FeedingSchedule />}
        />

      </Route>


      {/* Redirect unknown routes */}
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