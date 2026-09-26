import { ArrowClockwise, Camera, House, WifiHigh } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import useRooms from "../hooks/useRooms";
import "./Rooms.css";

const filters = ["all", "active", "maintenance", "inactive"];

export default function Rooms() {
  const { rooms, loading, error, refetchRooms } = useRooms();
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredRooms = useMemo(
    () => rooms.filter((room) => filterStatus === "all" || room.status === filterStatus),
    [rooms, filterStatus],
  );

  return (
    <section className="rooms-page">
      <PageHeader
        title="Rooms"
        description="Monitor room availability and assigned CareFur hardware."
        actions={<Button variant="secondary" onClick={refetchRooms}><ArrowClockwise size={17} /> Refresh</Button>}
      />

      <div className="segmented-control" aria-label="Room status filter">
        {filters.map((status) => (
          <button key={status} type="button" className={filterStatus === status ? "active" : ""} onClick={() => setFilterStatus(status)}>
            {status}
          </button>
        ))}
      </div>

      {error && <div className="page-alert page-alert--error">{error}</div>}

      {loading ? (
        <div className="page-loading">Loading rooms…</div>
      ) : filteredRooms.length === 0 ? (
        <EmptyState icon={House} title="No rooms in this view" message="Choose another status or refresh the room list." />
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map((room) => {
            const feeder = room.devices?.find((device) => device.device_type === "feeder");
            const camera = room.devices?.find((device) => device.device_type === "camera");
            return (
              <article key={room.id} className="room-panel">
                <div className="room-panel__header">
                  <div className="room-number"><House size={20} weight="duotone" /></div>
                  <div>
                    <h2>Room {room.room_number}</h2>
                    <p>{room.room_name || "Pet suite"}</p>
                  </div>
                  <Badge tone={getRoomTone(room.status)}>{room.status}</Badge>
                </div>

                <div className="room-capacity">Capacity <strong>{room.capacity || 1} pet{room.capacity === 1 ? "" : "s"}</strong></div>

                <div className="device-list">
                  <DeviceRow icon={WifiHigh} label="Feeder" device={feeder} />
                  <DeviceRow icon={Camera} label="Camera" device={camera} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DeviceRow({ icon: Icon, label, device }) {
  return (
    <div className="device-row">
      <Icon size={18} weight="duotone" />
      <span>{label}</span>
      <strong>{device?.device_code || "Not assigned"}</strong>
      <span className={`device-dot ${device?.status === "active" ? "online" : ""}`} title={device?.status || "unassigned"} />
    </div>
  );
}

function getRoomTone(status) {
  if (status === "active") return "success";
  if (status === "maintenance") return "warning";
  if (status === "inactive") return "neutral";
  return "info";
}
