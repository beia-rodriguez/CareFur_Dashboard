import { ArrowClockwise, CheckCircle, MagnifyingGlass, XCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import useReservationRequests from "../hooks/useReservationRequests";
import "./ReservationRequests.css";

const filters = ["all", "pending_payment", "confirmed", "declined", "cancelled"];

export default function ReservationRequests() {
  const { requests, loading, error, updatingId, refresh, setStatus } = useReservationRequests();
  const [filter, setFilter] = useState("pending_payment");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!needle) return true;
      return [item.request_code,item.owner_name,item.owner_email,item.pet_name,item.requested_room_number,item.room?.room_number]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [requests, filter, search]);

  const pending = requests.filter((item) => item.status === "pending_payment").length;
  const approved = requests.filter((item) => item.status === "confirmed").length;
  const denied = requests.filter((item) => item.status === "declined").length;

  return (
    <section className="reservation-requests-page">
      <PageHeader
        eyebrow="Public Website"
        title="Reservation Requests"
        description="Review reservation requests submitted from carefur.me. Approve or deny the request before the client visits for in-store payment."
        actions={<Button variant="secondary" onClick={refresh}><ArrowClockwise size={18}/> Refresh</Button>}
      />

      <div className="reservation-summary">
        <Summary value={pending} label="Needs review" tone="warning"/>
        <Summary value={approved} label="Approved" tone="success"/>
        <Summary value={denied} label="Denied" tone="danger"/>
      </div>

      <div className="reservation-toolbar">
        <label className="reservation-search"><MagnifyingGlass size={18}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search owner, pet, room, request code…"/></label>
        <div className="segmented-control reservation-filters">
          {filters.map((item)=><button key={item} type="button" className={filter===item?"active":""} onClick={()=>setFilter(item)}>{labelStatus(item)}</button>)}
        </div>
      </div>

      {error && <div className="page-alert page-alert--error">{error}</div>}
      {loading ? <div className="page-loading">Loading reservation requests…</div> : filtered.length===0 ? (
        <EmptyState icon={CheckCircle} title="No reservation requests" message="No requests match the selected filter."/>
      ) : (
        <div className="reservation-request-grid">
          {filtered.map((item)=><article className="reservation-request-card" key={item.id}>
            <header>
              <div><span>{item.request_code || "Website request"}</span><h2>{item.pet_name || "Pet"}</h2><p>{[item.species,item.breed].filter(Boolean).join(" • ") || "Pet details"}</p></div>
              <Badge tone={tone(item.status)}>{labelStatus(item.status)}</Badge>
            </header>
            <div className="reservation-request-details">
              <Detail label="Owner" value={item.owner_name} sub={item.owner_email}/>
              <Detail label="Phone" value={item.owner_phone || "—"}/>
              <Detail label="Room" value={item.requested_room_number || (item.room?.room_number ? `Room ${item.room.room_number}` : "No preference")}/>
              <Detail label="Stay" value={`${fmtDate(item.check_in)} → ${fmtDate(item.check_out)}`}/>
              <Detail label="Rate" value={item.room_rate_per_night ? `${peso(item.room_rate_per_night)} / night` : "—"}/>
              <Detail label="Estimated total" value={item.estimated_total ? peso(item.estimated_total) : "—"} sub={item.nights ? `${item.nights} night${item.nights===1?"":"s"}` : ""}/>
            </div>
            {item.notes && <div className="reservation-note"><strong>Client notes</strong><p>{item.notes}</p></div>}
            <div className="reservation-payment-note"><b>Payment:</b> In-store only. Approval does not mark the reservation as paid.</div>
            {item.status === "pending_payment" && <div className="reservation-actions">
              <Button variant="secondary" disabled={updatingId===item.id} onClick={()=>setStatus(item.id,"declined")}><XCircle size={18}/> Deny</Button>
              <Button disabled={updatingId===item.id} onClick={()=>setStatus(item.id,"confirmed")}><CheckCircle size={18}/> Approve</Button>
            </div>}
          </article>)}
        </div>
      )}
    </section>
  );
}

function Summary({value,label,tone}){return <div className={`reservation-summary__item ${tone}`}><strong>{value}</strong><span>{label}</span></div>}
function Detail({label,value,sub}){return <div className="reservation-detail"><span>{label}</span><strong>{value || "—"}</strong>{sub&&<small>{sub}</small>}</div>}
function fmtDate(value){if(!value)return "—";return new Intl.DateTimeFormat([], {month:"short",day:"numeric",year:"numeric"}).format(new Date(`${value}T00:00:00`))}
function peso(value){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}).format(Number(value||0))}
function labelStatus(value){const map={all:"All",pending_payment:"Pending",confirmed:"Approved",declined:"Denied",cancelled:"Cancelled"};return map[value]||String(value||"").replaceAll("_"," ")}
function tone(value){if(value==="confirmed")return "success";if(value==="declined"||value==="cancelled")return "danger";return "warning"}
