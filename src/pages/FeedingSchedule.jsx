import React, { useState } from "react";
import useFeedingSchedules from "../hooks/useFeedingSchedules";
import "./FeedingSchedule.css";

export default function FeedingSchedule() {
  const [filterStatus, setFilterStatus] = useState("all");
  const { schedules, loading, error, toggleFeedingStatus } = useFeedingSchedules();

  const filteredSchedules = schedules.filter((item) => {
    if (filterStatus === "all") return true;
    return item.status === filterStatus;
  });

  return (
    <section className="feeding-page">
      <header className="feeding-page-header">
        <div>
          <p>CareFur</p>
          <h1>Feeding Schedule</h1>
          <span>Manage daily feeding tasks and automated dispenses</span>
        </div>
      </header>

      <div className="feeding-filter-bar">
        {["all", "pending", "completed", "missed", "cancelled"].map((status) => (
          <button
            key={status}
            className={`filter-tab ${filterStatus === status ? "active" : ""}`}
            onClick={() => setFilterStatus(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>Loading feeding schedules...</p>
      ) : (
        <div className="feeding-list">
          {filteredSchedules.map((item) => {
            const pet = item.bookings?.pets;
            const room = item.bookings?.rooms;

            return (
              <article key={item.id} className="feeding-card">
                <div className="feeding-card-main">
                  <div className="feeding-time">
                    {new Date(item.scheduled_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  <div className="feeding-info">
                    <h2>{pet?.name || "Unknown Pet"}</h2>
                    <p>
                      Room {room?.room_number || "N/A"} • {item.feeding_method.toUpperCase()}
                      {item.compartment_number && ` (Chamber ${item.compartment_number})`}
                      {item.portion_grams && ` • ${item.portion_grams}g`}
                    </p>
                    {item.instructions && <small>Note: {item.instructions}</small>}
                  </div>
                </div>

                <div className="feeding-card-actions">
                  <span className={`status-badge status-${item.status}`}>
                    {item.status}
                  </span>

                  <button
                    type="button"
                    className="status-toggle-btn"
                    onClick={() => toggleFeedingStatus(item.id, item.status)}
                  >
                    Mark {item.status === "completed" ? "Pending" : "Complete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}