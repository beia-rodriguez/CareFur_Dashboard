import React, { useState } from "react";
import useRooms from "../hooks/useRooms";
import "./Rooms.css";

export default function Rooms() {
  const { rooms, loading, error, refetchRooms } = useRooms();
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredRooms = rooms.filter((room) => {
    if (filterStatus === "all") return true;
    return room.status === filterStatus;
  });

  return (
    <section className="rooms-page">
      <header className="rooms-page-header">
        <div>
          <p>CareFur</p>
          <h1>Rooms</h1>
          <span>Manage hotel rooms & assigned hardware</span>
        </div>
        <button className="add-room-btn" onClick={() => alert("Add Room Modal")}>
          + Add Room
        </button>
      </header>

      {/* Filter Tabs */}
      <div className="rooms-filter-bar">
        {["all", "active", "maintenance", "inactive"].map((status) => (
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
        <p>Loading rooms...</p>
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map((room) => {
            const feeder = room.devices?.find((d) => d.device_type === "feeder");
            const camera = room.devices?.find((d) => d.device_type === "camera");

            return (
              <article key={room.id} className="room-card">
                <div className="room-card-header">
                  <div>
                    <h2>Room {room.room_number}</h2>
                    <p>{room.room_name || "Standard Suite"}</p>
                  </div>
                  <span className={`status-badge status-${room.status}`}>
                    {room.status}
                  </span>
                </div>

                <div className="room-details">
                  <small>Capacity: {room.capacity} Pet(s)</small>
                </div>

                <div className="hardware-section">
                  <span className="section-label">Assigned IoT Devices</span>
                  
                  <div className="device-row">
                    <span>Feeder:</span>
                    <strong>{feeder ? feeder.device_code : "None"}</strong>
                  </div>

                  <div className="device-row">
                    <span>Camera:</span>
                    <strong>{camera ? camera.device_code : "None"}</strong>
                  </div>
                </div>

                <div className="room-card-actions">
                  <button onClick={() => alert(`Manage devices for Room ${room.room_number}`)}>
                    Devices
                  </button>
                  <button onClick={() => alert(`Edit Room ${room.room_number}`)}>
                    Edit
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