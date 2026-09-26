import { ArrowClockwise, Camera, Clock, House, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import useCameras from "../hooks/useCameras";
import "./Cameras.css";

export default function Cameras() {
  const { cameras, loading, error, refresh } = useCameras();
  const online = cameras.filter((item) => item.online).length;

  return (
    <section className="cameras-page">
      <PageHeader
        eyebrow="Monitoring"
        title="Camera Monitoring"
        description="Monitor camera connectivity and room assignments from one screen."
        actions={<Button variant="secondary" onClick={refresh}><ArrowClockwise size={18} /> Refresh</Button>}
      />

      <div className="camera-summary">
        <Summary icon={WifiHigh} value={online} label="Online" tone="success" />
        <Summary icon={WifiSlash} value={Math.max(cameras.length - online, 0)} label="Offline" tone="danger" />
        <Summary icon={Camera} value={cameras.length} label="Total cameras" tone="neutral" />
      </div>

      <div className="camera-info-note">
        <Camera size={20} />
        <div><strong>Live video source</strong><p>Your current Supabase schema stores camera devices and status, but it does not include a stream URL. This page therefore monitors availability and assignments. Add a secure stream field or camera gateway endpoint when your ESP32-CAM stream is ready.</p></div>
      </div>

      {error && <div className="page-alert page-alert--error">{error}</div>}

      {loading ? (
        <div className="page-loading">Loading cameras…</div>
      ) : cameras.length === 0 ? (
        <EmptyState icon={Camera} title="No cameras registered" message="Camera devices will appear here after they are added to the devices table." />
      ) : (
        <div className="camera-grid">
          {cameras.map((camera) => (
            <article className="camera-card" key={camera.id}>
              <div className={`camera-preview ${camera.online ? "online" : "offline"}`}>
                <Camera size={44} weight="duotone" />
                <span>{camera.online ? "Camera online" : "Camera unavailable"}</span>
              </div>
              <div className="camera-card__body">
                <div className="camera-card__heading">
                  <div><span>{camera.device_code}</span><h2>{camera.device_name || "CareFur Camera"}</h2></div>
                  <Badge tone={camera.online ? "success" : "danger"}>{camera.online ? "Online" : "Offline"}</Badge>
                </div>
                <div className="camera-meta">
                  <p><House size={17} /> {camera.room?.room_number ? `Room ${camera.room.room_number}${camera.room.room_name ? ` — ${camera.room.room_name}` : ""}` : "Not assigned to a room"}</p>
                  <p><Clock size={17} /> Last seen: {formatLastSeen(camera.last_seen_at)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
function Summary({ icon: Icon, value, label, tone }) { return <div className={`camera-summary__item ${tone}`}><Icon size={22} weight="duotone" /><div><strong>{value}</strong><span>{label}</span></div></div>; }
function formatLastSeen(value) { if (!value) return "Never"; return new Intl.DateTimeFormat([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
