import { ArrowClockwise, CalendarBlank, CheckCircle, Clock, ForkKnife, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import useFeedingSchedules from "../hooks/useFeedingSchedules";
import "./FeedingSchedule.css";

const statusFilters = ["all", "pending", "completed", "missed"];

export default function FeedingSchedule() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const { schedules, loading, updatingId, error, toggleFeedingStatus, refetchSchedules } = useFeedingSchedules();

  const todayKey = toDayKey(new Date());
  const summary = useMemo(() => ({
    pending: schedules.filter((item) => item.status === "pending").length,
    completedToday: schedules.filter((item) => item.status === "completed" && toDayKey(new Date(item.scheduled_at)) === todayKey).length,
    missed: schedules.filter((item) => item.status === "missed").length,
    today: schedules.filter((item) => toDayKey(new Date(item.scheduled_at)) === todayKey).length,
  }), [schedules, todayKey]);

  const filteredSchedules = useMemo(() => schedules.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (method !== "all" && item.feeding_method !== method) return false;
    return true;
  }), [schedules, filterStatus, method]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const item of filteredSchedules) {
      const key = toDayKey(new Date(item.scheduled_at));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups.entries()];
  }, [filteredSchedules]);

  return (
    <section className="feeding-page">
      <PageHeader
        eyebrow="Care & Feeding"
        title="Feeding Schedule"
        description="A focused timeline of upcoming and completed feedings for boarded pets."
        actions={<Button variant="secondary" onClick={refetchSchedules}><ArrowClockwise size={18} /> Refresh</Button>}
      />

      <div className="feeding-summary-grid">
        <Summary icon={CalendarBlank} value={summary.today} label="Scheduled today" />
        <Summary icon={Clock} value={summary.pending} label="Pending" />
        <Summary icon={CheckCircle} value={summary.completedToday} label="Completed today" />
        <Summary icon={WarningCircle} value={summary.missed} label="Missed" />
      </div>

      <div className="feeding-toolbar">
        <div className="segmented-control feeding-filters">
          {statusFilters.map((status) => (
            <button key={status} type="button" className={filterStatus === status ? "active" : ""} onClick={() => setFilterStatus(status)}>
              {status}
            </button>
          ))}
        </div>
        <select className="feeding-method-filter" value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Filter by feeding method">
          <option value="all">All methods</option>
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {error && <div className="page-alert page-alert--error">{error}</div>}

      {loading ? (
        <div className="page-loading">Loading feeding schedules…</div>
      ) : grouped.length === 0 ? (
        <EmptyState icon={ForkKnife} title="No feeding tasks" message="No schedules match the selected filters." />
      ) : (
        <div className="feeding-timeline">
          {grouped.map(([day, items]) => (
            <section className="feeding-day" key={day}>
              <header className="feeding-day__header">
                <div><span>{day === todayKey ? "Today" : formatDayLabel(day)}</span><strong>{items.length} feeding{items.length === 1 ? "" : "s"}</strong></div>
              </header>
              <div className="feeding-day__list">
                {items.map((item) => {
                  const pet = item.booking?.pet;
                  const room = item.booking?.room;
                  return (
                    <article key={item.id} className="feeding-row">
                      <div className="feeding-row__time"><strong>{formatTime(item.scheduled_at)}</strong><span>{item.feeding_method === "automatic" ? "Auto" : "Manual"}</span></div>
                      <div className="feeding-row__main">
                        <div className="feeding-row__title"><h2>{pet?.name || "Unknown pet"}</h2><Badge tone={getStatusTone(item.status)}>{item.status}</Badge></div>
                        <p>{room?.room_number ? `Room ${room.room_number}` : "Room not assigned"}{item.portion_grams ? ` • ${item.portion_grams} g` : ""}{item.compartment_number ? ` • Compartment ${item.compartment_number}` : ""}</p>
                        {item.instructions && <small>{item.instructions}</small>}
                      </div>
                      {(item.status === "pending" || item.status === "completed") && (
                        <Button variant={item.status === "completed" ? "secondary" : "primary"} size="sm" disabled={updatingId === item.id} onClick={() => toggleFeedingStatus(item.id, item.status)}>
                          <CheckCircle size={16} />{updatingId === item.id ? "Saving…" : item.status === "completed" ? "Reopen" : "Complete"}
                        </Button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function Summary({ icon: Icon, value, label }) { return <article className="feeding-summary-card"><Icon size={22} weight="duotone"/><div><strong>{value}</strong><span>{label}</span></div></article>; }
function formatTime(value) { return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatDayLabel(day) { return new Intl.DateTimeFormat([], { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${day}T12:00:00`)); }
function toDayKey(date) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function getStatusTone(status) { if (status === "completed") return "success"; if (status === "pending") return "warning"; if (status === "missed" || status === "cancelled") return "danger"; return "neutral"; }
