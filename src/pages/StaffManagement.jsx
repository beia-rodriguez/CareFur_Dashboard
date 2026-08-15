import { useState } from "react";
import {
  EnvelopeSimple,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Plus,
  User,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";

import useStaff from "../hooks/useStaff";

import "./StaffManagement.css";

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
};

export default function StaffManagement() {
  const {
    staff = [],
    loading,
    error,
    creating,
    createStaff,
    clearError,
  } = useStaff();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] =
    useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const normalizedSearch = search
    .trim()
    .toLowerCase();

  const visibleStaff = staff.filter(
    (staffMember) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        staffMember.full_name,
        staffMember.email,
        staffMember.phone,
      ].some((value) =>
        value
          ?.toLowerCase()
          .includes(normalizedSearch),
      );
    },
  );

  function updateField(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function openForm() {
    clearError?.();

    setFormError("");
    setSuccessMessage("");
    setShowPassword(false);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function closeForm() {
    if (creating) {
      return;
    }

    setShowForm(false);
    setShowPassword(false);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    const fullName = form.fullName.trim();
    const email = form.email
      .trim()
      .toLowerCase();
    const phone = form.phone.trim();

    if (!fullName) {
      setFormError(
        "Enter the staff member's full name.",
      );
      return;
    }

    if (!email) {
      setFormError("Enter an email address.");
      return;
    }

    if (form.password.length < 8) {
      setFormError(
        "The temporary password must contain at least 8 characters.",
      );
      return;
    }

    if (typeof createStaff !== "function") {
      setFormError(
        "Staff creation is currently unavailable.",
      );
      return;
    }

    try {
      await createStaff({
        fullName,
        email,
        phone: phone || null,
        password: form.password,
      });

      setShowForm(false);
      setShowPassword(false);
      setForm(EMPTY_FORM);
      setFormError("");

      setSuccessMessage(
        `${fullName}'s staff account was created successfully.`,
      );
    } catch (createError) {
      setFormError(
        createError instanceof Error
          ? createError.message
          : "Unable to create the staff account.",
      );
    }
  }

  return (
    <main className="staff-page">
      <header className="staff-page__header">
        <div>
          <p className="staff-page__eyebrow">
            Administration
          </p>

          <h1>Staff Management</h1>

          <p className="staff-page__description">
            Create and manage staff accounts that
            can access the CareFur dashboard.
          </p>
        </div>

        <button
          type="button"
          className="staff-page__add-button"
          onClick={openForm}
          disabled={creating}
        >
          <Plus size={19} weight="bold" />
          <span>Add staff</span>
        </button>
      </header>

      {successMessage && (
        <div
          className="staff-message staff-message--success"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {error && (
        <div
          className="staff-message staff-message--error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="staff-summary">
        <UsersThree
          size={28}
          weight="fill"
          aria-hidden="true"
        />

        <div>
          <strong>{staff.length}</strong>

          <span>
            Staff account
            {staff.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <section className="staff-directory">
        <div className="staff-directory__toolbar">
          <div>
            <h2>Staff Accounts</h2>

            <p>
              Accounts with staff dashboard access
            </p>
          </div>

          <label className="staff-search">
            <MagnifyingGlass
              size={18}
              aria-hidden="true"
            />

            <span className="sr-only">
              Search staff
            </span>

            <input
              type="search"
              value={search}
              placeholder="Search staff"
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>
        </div>

        {loading ? (
          <StaffSkeleton />
        ) : visibleStaff.length === 0 ? (
          <div className="staff-empty">
            <UsersThree
              size={30}
              weight="light"
            />

            <h3>
              {search
                ? "No matching staff"
                : "No staff accounts yet"}
            </h3>

            <p>
              {search
                ? "Try searching with another name or email."
                : "Create the first staff account to give them dashboard access."}
            </p>
          </div>
        ) : (
          <div className="staff-list">
            {visibleStaff.map((staffMember) => (
              <StaffCard
                key={staffMember.id}
                staffMember={staffMember}
              />
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div
          className="staff-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <section
            className="staff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-title"
          >
            <header className="staff-modal__header">
              <div>
                <p>Add account</p>

                <h2 id="add-staff-title">
                  New Staff Member
                </h2>
              </div>

              <button
                type="button"
                className="staff-modal__close"
                aria-label="Close staff form"
                onClick={closeForm}
                disabled={creating}
              >
                <X size={22} weight="bold" />
              </button>
            </header>

            <form
              className="staff-form"
              onSubmit={handleSubmit}
            >
              {formError && (
                <div
                  className="staff-form__error"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <label className="staff-field">
                <span>Full name</span>

                <div className="staff-field__control">
                  <User
                    size={18}
                    aria-hidden="true"
                  />

                  <input
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    placeholder="e.g. Maria Santos"
                    autoComplete="name"
                    onChange={updateField}
                    disabled={creating}
                    required
                  />
                </div>
              </label>

              <label className="staff-field">
                <span>Email address</span>

                <div className="staff-field__control">
                  <EnvelopeSimple
                    size={18}
                    aria-hidden="true"
                  />

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    placeholder="staff@carefur.com"
                    autoComplete="email"
                    onChange={updateField}
                    disabled={creating}
                    required
                  />
                </div>
              </label>

              <label className="staff-field">
                <span>
                  Phone number{" "}
                  <small>Optional</small>
                </span>

                <div className="staff-field__control">
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    placeholder="09XX XXX XXXX"
                    autoComplete="tel"
                    onChange={updateField}
                    disabled={creating}
                  />
                </div>
              </label>

              <label className="staff-field">
                <span>Temporary password</span>

                <div className="staff-field__control">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="password"
                    value={form.password}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    onChange={updateField}
                    disabled={creating}
                    required
                  />

                  <button
                    type="button"
                    className="staff-password-toggle"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                    disabled={creating}
                  >
                    {showPassword ? (
                      <EyeSlash size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                <small className="staff-field__help">
                  The administrator should send this
                  temporary password securely to the
                  staff member.
                </small>
              </label>

              <div className="staff-form__actions">
                <button
                  type="button"
                  className="staff-button staff-button--secondary"
                  onClick={closeForm}
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="staff-button staff-button--primary"
                  disabled={creating}
                >
                  <UserPlus
                    size={18}
                    weight="bold"
                  />

                  {creating
                    ? "Creating..."
                    : "Create staff account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function StaffCard({ staffMember }) {
  const initials = getInitials(
    staffMember.full_name,
  );

  return (
    <article className="staff-card">
      <div className="staff-card__avatar">
        {staffMember.avatar_url ? (
          <img
            src={staffMember.avatar_url}
            alt=""
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      <div className="staff-card__details">
        <div className="staff-card__heading">
          <h3>
            {staffMember.full_name ||
              "Unnamed staff member"}
          </h3>

          <span className="staff-role-badge">
            Staff
          </span>
        </div>

        <p>{staffMember.email}</p>

        {staffMember.phone && (
          <small>{staffMember.phone}</small>
        )}

        <small>
          Joined {formatDate(staffMember.created_at)}
        </small>
      </div>
    </article>
  );
}

function StaffSkeleton() {
  return (
    <div className="staff-list">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="staff-card staff-card--loading"
        >
          <span />

          <div>
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}

function getInitials(fullName) {
  if (!fullName?.trim()) {
    return "ST";
  }

  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatDate(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    },
  );
}