import {
  BellSimple,
  Camera,
  CaretRight,
  CheckCircle,
  Clock,
  Drop,
  ForkKnife,
  PawPrint,
  PlugsConnected,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";

import { Link } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useDashboard from "../hooks/useDashboard";

import "./Dashboard.css";

export default function Dashboard() {
  const { profile } = useAuth();

  const {
    boardedPets,
    feedingsDue,
    manualFeedings,
    activeAlerts,
    camerasOnline,
    camerasOffline,
    recentActivity,
    loading,
    error,
    refresh,
  } = useDashboard();

  const firstName = getFirstName(profile?.full_name);

  const totalFeedingsDue =
    feedingsDue.length + manualFeedings.length;

  return (
    <main className="carefur-dashboard">
      <header className="dashboard-page-header">
        <div>
          <p className="dashboard-greeting">
            {getGreeting()},{" "}
            <strong>{firstName}</strong>
          </p>

          <h1>Dashboard</h1>

          <p className="dashboard-subtitle">
            Today&apos;s operational overview
          </p>
        </div>

        <Link
          to="/notifications"
          className="notification-button"
          aria-label="Open notifications"
        >
          <BellSimple size={23} weight="bold" />

          {activeAlerts.length > 0 && (
            <span
              className="notification-indicator"
              aria-label={`${activeAlerts.length} active alerts`}
            />
          )}
        </Link>
      </header>

      <section
        className="dashboard-summary"
        aria-label="Today's summary"
      >
        <SummaryItem
          icon={PawPrint}
          value={boardedPets}
          label="Pets boarded"
        />

        <SummaryItem
          icon={Clock}
          value={totalFeedingsDue}
          label="Feedings due"
        />
      </section>

      {error && (
        <div className="dashboard-error" role="alert">
          <p>{error}</p>

          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="dashboard-sections">
          <DashboardSection
            title="Feedings Due Now"
            link="/schedules"
            linkLabel="See all automatic feedings"
          >
            <FeedingList
              feedings={feedingsDue}
              method="automatic"
              emptyMessage="No automatic feedings due in the next hour."
            />
          </DashboardSection>

          <DashboardSection
            title="Manual Feedings Pending"
            link="/schedules"
            linkLabel="See all manual feedings"
          >
            <FeedingList
              feedings={manualFeedings}
              method="manual"
              emptyMessage="No manual feedings are currently pending."
            />
          </DashboardSection>

          <DashboardSection
            title="Active Alerts"
            link="/notifications"
            linkLabel="See all alerts"
          >
            {activeAlerts.length > 0 ? (
              <div className="dashboard-list">
                {activeAlerts.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle}
                message="No active alerts. Monitored systems are operating normally."
                state="success"
              />
            )}
          </DashboardSection>

          <DashboardSection
            title="Camera Status"
            link="/rooms"
            linkLabel="See all cameras"
          >
            <div className="camera-status-grid">
              <CameraStatus
                label="Online"
                value={camerasOnline}
                status="online"
              />

              <CameraStatus
                label="Offline"
                value={camerasOffline}
                status="offline"
              />
            </div>
          </DashboardSection>

          <DashboardSection title="Recent Activity">
            {recentActivity.length > 0 ? (
              <div className="activity-list">
                {recentActivity.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                message="No activity has been recorded yet."
              />
            )}
          </DashboardSection>
        </div>
      )}
    </main>
  );
}

function SummaryItem({ icon: Icon, value, label }) {
  return (
    <article className="summary-item">
      <Icon
        className="summary-item__icon"
        size={28}
        weight="fill"
        aria-hidden="true"
      />

      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function DashboardSection({
  title,
  link,
  linkLabel,
  children,
}) {
  return (
    <section className="dashboard-section">
      <header className="dashboard-section__header">
        <h2>{title}</h2>

        {link && (
          <Link
            to={link}
            className="dashboard-section__link"
            aria-label={linkLabel}
          >
            See all
            <CaretRight size={15} weight="bold" />
          </Link>
        )}
      </header>

      {children}
    </section>
  );
}

function FeedingList({
  feedings,
  method,
  emptyMessage,
}) {
  if (feedings.length === 0) {
    return (
      <EmptyState
        icon={method === "automatic" ? Clock : ForkKnife}
        message={emptyMessage}
      />
    );
  }

  return (
    <div className="dashboard-list">
      {feedings.map((feeding) => (
        <FeedingItem
          key={feeding.id}
          feeding={feeding}
          method={method}
        />
      ))}
    </div>
  );
}

function FeedingItem({ feeding, method }) {
  const scheduledDate = new Date(
    feeding.scheduled_at
  );

  const petName =
    feeding.booking?.pet?.name || "Unknown pet";

  const roomName = getRoomName(
    feeding.booking?.room
  );

  return (
    <article className="feeding-item">
      <div className="feeding-item__details">
        <time dateTime={feeding.scheduled_at}>
          {formatTime(scheduledDate)}
        </time>

        <p>
          <strong>{petName}</strong>
          <span aria-hidden="true"> · </span>
          {roomName}
        </p>

        <small>
          {getFeedingDueText(scheduledDate)}
        </small>
      </div>

      <span
        className={`feeding-badge feeding-badge--${method}`}
      >
        {method === "automatic"
          ? "Automatic"
          : "Manual"}
      </span>
    </article>
  );
}

function AlertItem({ alert }) {
  const AlertIcon = getAlertIcon(alert.alert_type);

  const location =
    getRoomName(alert.booking?.room) ||
    alert.device?.device_name ||
    alert.device?.device_code ||
    "System";

  return (
    <article
      className={`alert-item alert-item--${alert.severity}`}
    >
      <div className="alert-item__icon">
        <AlertIcon size={24} weight="bold" />
      </div>

      <div className="alert-item__content">
        <div className="alert-item__top">
          <h3>{alert.title}</h3>

          <time dateTime={alert.created_at}>
            {formatRelativeTime(alert.created_at)}
          </time>
        </div>

        <p>
          {location}
          <span className="alert-severity">
            {capitalize(alert.severity)}
          </span>
        </p>
      </div>
    </article>
  );
}

function CameraStatus({ label, value, status }) {
  return (
    <article
      className={`camera-status camera-status--${status}`}
    >
      <strong>{value}</strong>

      <div>
        <span
          className="camera-status__dot"
          aria-hidden="true"
        />

        <Camera size={17} weight="bold" />

        <span>{label}</span>
      </div>
    </article>
  );
}

function ActivityItem({ activity }) {
  const ActivityIcon = getActivityIcon(
    activity.entity_type,
    activity.action
  );

  return (
    <article className="activity-item">
      <div className="activity-item__icon">
        <ActivityIcon size={18} weight="bold" />
      </div>

      <div className="activity-item__content">
        <p>{activity.description}</p>

        <small>
          {activity.actor?.full_name && (
            <>
              {activity.actor.full_name}
              <span aria-hidden="true"> · </span>
            </>
          )}

          {formatRelativeTime(activity.created_at)}
        </small>
      </div>
    </article>
  );
}

function EmptyState({
  icon: Icon,
  message,
  state = "default",
}) {
  return (
    <div
      className={`empty-state empty-state--${state}`}
    >
      <Icon size={20} weight="bold" />

      <p>{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-sections">
      {[1, 2, 3, 4, 5].map((item) => (
        <section
          key={item}
          className="dashboard-skeleton"
        >
          <span className="skeleton-title" />
          <span className="skeleton-content" />
        </section>
      ))}
    </div>
  );
}

function getFirstName(fullName) {
  if (!fullName?.trim()) {
    return "Staff";
  }

  return fullName.trim().split(/\s+/)[0];
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getRoomName(room) {
  if (!room) {
    return "Unassigned room";
  }

  if (room.room_name) {
    return room.room_name;
  }

  const roomNumber = String(
    room.room_number ?? ""
  ).trim();

  if (!roomNumber) {
    return "Unassigned room";
  }

  if (roomNumber.toLowerCase().startsWith("room")) {
    return roomNumber;
  }

  return `Room ${roomNumber}`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getFeedingDueText(date) {
  const differenceInMinutes = Math.round(
    (date.getTime() - Date.now()) / 60000
  );

  if (
    differenceInMinutes >= -5 &&
    differenceInMinutes <= 5
  ) {
    return "Due now";
  }

  if (differenceInMinutes < -5) {
    return `${Math.abs(
      differenceInMinutes
    )} min overdue`;
  }

  if (differenceInMinutes < 60) {
    return `Due in ${differenceInMinutes} min`;
  }

  const hours = Math.floor(
    differenceInMinutes / 60
  );

  return `Due in ${hours} hr`;
}

function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);

  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (Date.now() - date.getTime()) / 1000
    )
  );

  if (elapsedSeconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    elapsedSeconds / 60
  );

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getAlertIcon(alertType) {
  switch (alertType) {
    case "low_water":
      return Drop;

    case "camera_offline":
      return Camera;

    case "device_offline":
      return PlugsConnected;

    case "motor_error":
    case "lid_error":
      return Wrench;

    case "feeding_failure":
    case "missed_feeding":
      return ForkKnife;

    default:
      return WarningCircle;
  }
}

function getActivityIcon(entityType, action) {
  const normalizedEntity =
    entityType?.toLowerCase() || "";

  const normalizedAction =
    action?.toLowerCase() || "";

  if (
    normalizedEntity.includes("feeding") ||
    normalizedAction.includes("feeding") ||
    normalizedAction.includes("dispens")
  ) {
    return ForkKnife;
  }

  if (
    normalizedEntity.includes("water") ||
    normalizedAction.includes("water")
  ) {
    return Drop;
  }

  if (
    normalizedEntity.includes("device") ||
    normalizedAction.includes("camera")
  ) {
    return Camera;
  }

  return CheckCircle;
}

function capitalize(value) {
  if (!value) {
    return "";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}