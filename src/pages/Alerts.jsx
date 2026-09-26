import { ArrowClockwise, BellRinging, CheckCircle, Warning, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import useAlerts from "../hooks/useAlerts";
import "./Alerts.css";

export default function Alerts() {
  const { alerts, loading, updatingId, error, refresh, updateAlert } = useAlerts();
  const [filter, setFilter] = useState("active");
  const visible = useMemo(() => alerts.filter((item) => filter === "all" || item.status === filter), [alerts, filter]);

  return (
    <section className="alerts-page">
      <PageHeader eyebrow="Monitoring" title="Alerts" description="Review feeder, camera, missed-feeding, and device issues that need staff attention." actions={<Button variant="secondary" onClick={refresh}><ArrowClockwise size={18}/> Refresh</Button>} />
      <div className="alerts-summary">
        <Summary icon={BellRinging} label="Active" value={alerts.filter((item) => item.status === "active").length} />
        <Summary icon={Warning} label="Critical" value={alerts.filter((item) => item.status === "active" && item.severity === "critical").length} />
        <Summary icon={CheckCircle} label="Resolved" value={alerts.filter((item) => item.status === "resolved").length} />
      </div>
      <div className="segmented-control alerts-filters">{["active","acknowledged","resolved","all"].map((item)=><button key={item} className={filter===item?"active":""} type="button" onClick={()=>setFilter(item)}>{item}</button>)}</div>
      {error && <div className="page-alert page-alert--error">{error}</div>}
      {loading ? <div className="page-loading">Loading alerts…</div> : visible.length === 0 ? <EmptyState icon={CheckCircle} title="No alerts in this view" message="There are no alerts matching the selected status." /> : (
        <div className="alerts-list">{visible.map((alert)=><article key={alert.id} className={`alert-card alert-card--${alert.severity}`}>
          <div className="alert-icon"><WarningCircle size={24} weight="duotone"/></div>
          <div className="alert-content">
            <div className="alert-title-row"><div><h2>{alert.title}</h2><p>{formatType(alert.alert_type)} • {formatDate(alert.created_at)}</p></div><div className="alert-badges"><Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge><Badge tone={statusTone(alert.status)}>{alert.status}</Badge></div></div>
            {alert.message && <p className="alert-message">{alert.message}</p>}
            <div className="alert-context">
              {alert.booking?.pet?.name && <span>Pet: <strong>{alert.booking.pet.name}</strong></span>}
              {alert.booking?.room?.room_number && <span>Room: <strong>{alert.booking.room.room_number}</strong></span>}
              {alert.device?.device_name && <span>Device: <strong>{alert.device.device_name}</strong></span>}
            </div>
          </div>
          <div className="alert-actions">
            {alert.status === "active" && <Button size="sm" variant="secondary" disabled={updatingId===alert.id} onClick={()=>updateAlert(alert.id,"acknowledged")}>Acknowledge</Button>}
            {alert.status !== "resolved" && <Button size="sm" disabled={updatingId===alert.id} onClick={()=>updateAlert(alert.id,"resolved")}>Resolve</Button>}
          </div>
        </article>)}</div>
      )}
    </section>
  );
}
function Summary({icon:Icon,label,value}){return <div className="alerts-summary__item"><Icon size={22} weight="duotone"/><div><strong>{value}</strong><span>{label}</span></div></div>}
function formatType(value){return String(value||"").replaceAll("_"," ").replace(/\b\w/g,(c)=>c.toUpperCase())}
function formatDate(value){return new Intl.DateTimeFormat([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value))}
function severityTone(value){if(value==="critical")return "danger";if(value==="warning")return "warning";return "info"}
function statusTone(value){if(value==="resolved")return "success";if(value==="active")return "danger";return "warning"}
