import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import LoadingSpinner from "../common/LoadingSpinner";
import "./ProtectedRoute.css";

export default function ProtectedRoute({
  children,
  allowedRoles = ["admin", "staff"],
}) {
  const location = useLocation();
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <main className="auth-route-loading">
        <LoadingSpinner />
      </main>
    );
  }

  /*
   * The user is not logged in.
   */
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  /*
   * The user has a session but no valid public.users profile.
   */
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  /*
   * The user is logged in but does not have the required role.
   *
   * Example:
   * staff opening /staff-management redirects to /dashboard.
   */
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
