import {
  Navigate,
} from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import LoadingSpinner from "../common/LoadingSpinner";
import "./ProtectedRoute.css";


export default function AdminRoute({
  children,
}) {

  const {
    profile,
    loading,
  } = useAuth();


  if (loading) {
    return (
      <main className="auth-route-loading">
        <LoadingSpinner />
      </main>
    );
  }


  if (
    profile?.role !== "admin"
  ) {

    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );

  }


  return children;
}
