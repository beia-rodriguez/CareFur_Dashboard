import { useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import useAuth from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";
import "./Login.css";
import snugglesLogo from "../assets/logos/snuggles_logo.png";

const initialForm = {
  email: "",
  password: "",
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    loading: authLoading,
    canAccessDashboard,
  } = useAuth();

  const [formData, setFormData] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /*
   * After login, return the user to the page they originally requested.
   * Otherwise, open the dashboard.
   */
  const requestedPath = location.state?.from?.pathname;
  const redirectPath =
    requestedPath && requestedPath !== "/login"
      ? requestedPath
      : "/dashboard";

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const email = formData.email.trim();
    const password = formData.password;

    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");

      await login(email, password);

      navigate(redirectPath, {
        replace: true,
      });
    } catch (error) {
      console.error("CareFur login failed:", error);

      const message = error?.message?.toLowerCase() ?? "";

      if (
        message.includes("invalid login credentials") ||
        message.includes("invalid credentials")
      ) {
        setErrorMessage("Incorrect email address or password.");
      } else if (message.includes("email not confirmed")) {
        setErrorMessage(
          "This account's email address has not been confirmed."
        );
      } else if (message.includes("not authorized")) {
        setErrorMessage(
          "This account cannot access the CareFur Staff Dashboard."
        );
      } else if (message.includes("no carefur user profile")) {
        setErrorMessage(
          "This account does not have a connected CareFur staff profile."
        );
      } else {
        setErrorMessage(
          error?.message || "Unable to sign in. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * Wait until Supabase finishes checking the stored session.
   */
  if (authLoading) {
    return (
      <main className="login-loading-page">
        <LoadingSpinner />
      </main>
    );
  }

  /*
   * A logged-in admin or staff member should not see the login page.
   */
  if (canAccessDashboard) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="login-page">
      <section className="login-brand-section">
        <div className="login-brand-content">
          <div className="login-logo" aria-hidden="true">
            <img
                src={snugglesLogo}
                alt="Snuggles Premium Pet Hotel"
                className="login-logo"
                />
          </div>

          <p className="login-brand-label">
            SNUGGLES PREMIUM PET HOTEL
          </p>

          <h1>CareFur Staff Dashboard</h1>

          <p className="login-brand-description">
            Manage pet boarding, feeding schedules, room assignments,
            feeder devices, camera monitoring, and pet care records from
            one secure dashboard.
          </p>
        </div>
      </section>

      <section className="login-form-section">
        <div className="login-mobile-brand">
            <img
                src={snugglesLogo}
                alt="Snuggles Premium Pet Hotel"
                className="login-mobile-logo"
            />

            <span>CareFur</span>
            </div>
        <div className="login-card">
          <header className="login-header">
            <p className="login-eyebrow">STAFF PORTAL</p>

            <p>
              Enter the account credentials provided by your CareFur
              administrator.
            </p>
          </header>

          {errorMessage && (
            <div
              className="login-error"
              role="alert"
              aria-live="polite"
            >
              {errorMessage}
            </div>
          )}

          <form
            className="login-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="form-group">
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="staff@carefur.com"
                value={formData.email}
                onChange={handleInputChange}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck="false"
                disabled={submitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <div className="password-input-container">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  autoComplete="current-password"
                  disabled={submitting}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((currentValue) => !currentValue)
                  }
                  disabled={submitting}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-button"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="login-account-note">
            Staff accounts are created and managed by the Admin
          </p>
        </div>
      </section>
    </main>
  );
}
