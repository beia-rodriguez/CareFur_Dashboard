import { ArrowClockwise, CalendarBlank, MagnifyingGlass, PawPrint, Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import useBoardings from "../hooks/useBoardings";
import "./Boardings.css";

const filters = ["all", "pending", "checked_in", "checked_out", "cancelled"];

export default function Boardings() {
  const { boardings, loading, error, refresh } = useBoardings();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return boardings.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!needle) return true;
      return [
        item.booking_code,
        item.pet?.name,
        item.owner?.full_name,
        item.owner?.email,
        item.room?.room_number,
        item.room?.room_name,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [boardings, search, status]);

  const checkedIn = boardings.filter((item) => item.status === "checked_in").length;
  const pending = boardings.filter((item) => item.status === "pending").length;

  return (
    <section className="boardings-page">
      <PageHeader
        eyebrow="Operations"
        title="Boarding List"
        description="View current stays, upcoming check-ins, owner details, room assignments, and checkout dates."
        actions={(
          <>
            <Button variant="secondary" onClick={refresh}><ArrowClockwise size={18} /> Refresh</Button>
            <Link className="boardings-new-link" to="/boarding/new"><Plus size={18} /> New boarding</Link>
          </>
        )}
      />

      <div className="boardings-summary">
        <Summary value={checkedIn} label="Currently boarded" />
        <Summary value={pending} label="Upcoming check-ins" />
        <Summary value={boardings.length} label="Total records" />
      </div>

      <div className="boardings-toolbar">
        <label className="boardings-search">
          <MagnifyingGlass size={19} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pet, owner, room, booking code…" />
        </label>
        <div className="segmented-control boardings-filters">
          {filters.map((item) => (
            <button key={item} type="button" className={status === item ? "active" : ""} onClick={() => setStatus(item)}>
              {formatStatus(item)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="page-alert page-alert--error">{error}</div>}

      {loading ? (
        <div className="page-loading">Loading boardings…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarBlank} title="No boarding records" message="No stays match the selected filters." />
      ) : (
        <div className="boardings-grid">
          {filtered.map((item) => (
            <article className="boarding-record" key={item.id}>
              <div className="boarding-record__top">
                <div className="boarding-record__pet-icon"><PawPrint size={24} weight="duotone" /></div>
                <div>
                  <span className="boarding-record__code">{item.booking_code}</span>
                  <h2>{item.pet?.name || "Unknown pet"}</h2>
                  <p>{[item.pet?.species, item.pet?.breed].filter(Boolean).join(" • ") || "Pet details unavailable"}</p>
                </div>
                <Badge tone={toneForStatus(item.status)}>{formatStatus(item.status)}</Badge>
              </div>

              <div className="boarding-record__details">
                <Detail label="Owner" value={item.owner?.full_name || "No owner linked"} sub={item.owner?.email || item.owner?.phone || "No contact details"} />
                <Detail label="Room" value={item.room?.room_number ? `Room ${item.room.room_number}` : "Unassigned"} sub={item.room?.room_name || ""} />
                <Detail label="Check-in" value={formatDateTime(item.check_in_at)} />
                <Detail label="Expected checkout" value={formatDateTime(item.expected_check_out_at)} />
              </div>

              {item.special_instructions && (
                <div className="boarding-record__note">
                  <strong>Special instructions</strong>
                  <p>{item.special_instructions}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Summary({ value, label }) {
  return <div className="boardings-summary__item"><strong>{value}</strong><span>{label}</span></div>;
}
function Detail({ label, value, sub }) {
  return <div className="boarding-detail"><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}
function formatStatus(value) {
  return value === "all" ? "All" : String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function toneForStatus(status) {
  if (status === "checked_in") return "success";
  if (status === "pending") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}
function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
