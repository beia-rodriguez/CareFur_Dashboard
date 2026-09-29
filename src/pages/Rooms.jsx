import { ArrowClockwise, Camera, House, PencilSimple, Plus, WifiHigh } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import useRooms from "../hooks/useRooms";
import "./Rooms.css";

const filters = ["all", "active", "maintenance", "inactive"];
const EMPTY_FORM = { room_number:"", room_name:"", capacity:"1", status:"active", notes:"" };

export default function Rooms() {
  const { rooms, loading, error, refetchRooms, createRoom, updateRoom } = useRooms();
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen,setModalOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY_FORM);
  const [saving,setSaving]=useState(false);

  const filteredRooms = useMemo(() => rooms.filter((room) => filterStatus === "all" || room.status === filterStatus), [rooms, filterStatus]);

  function openCreate(){setEditing(null);setForm(EMPTY_FORM);setModalOpen(true)}
  function openEdit(room){setEditing(room);setForm({room_number:room.room_number||"",room_name:room.room_name||"",capacity:String(room.capacity||1),status:room.status||"active",notes:room.notes||""});setModalOpen(true)}
  async function submit(e){e.preventDefault();setSaving(true);const payload={room_number:form.room_number.trim(),room_name:form.room_name.trim()||null,capacity:Number(form.capacity)||1,status:form.status,notes:form.notes.trim()||null,updated_at:new Date().toISOString()};const ok=editing?await updateRoom(editing.id,payload):await createRoom(payload);setSaving(false);if(ok)setModalOpen(false)}

  return (
    <section className="rooms-page">
      <PageHeader title="Room Management" description="Manage room availability, capacity, names, and assigned CareFur hardware. Add new rooms as the pet hotel expands." actions={<><Button variant="secondary" onClick={refetchRooms}><ArrowClockwise size={17}/> Refresh</Button><Button onClick={openCreate}><Plus size={17}/> Add room</Button></>} />
      <div className="room-management-note"><House size={20}/><div><strong>Availability control</strong><p><b>Active</b> rooms can be offered for booking. Use <b>Maintenance</b> or <b>Inactive</b> to keep a room out of availability.</p></div></div>
      <div className="segmented-control" aria-label="Room status filter">{filters.map((status)=><button key={status} type="button" className={filterStatus===status?"active":""} onClick={()=>setFilterStatus(status)}>{status}</button>)}</div>
      {error && <div className="page-alert page-alert--error">{error}</div>}
      {loading ? <div className="page-loading">Loading rooms…</div> : filteredRooms.length===0 ? <EmptyState icon={House} title="No rooms in this view" message="Choose another status or add a new room."/> : <div className="rooms-grid">{filteredRooms.map((room)=>{
        const feeder=room.devices?.find((d)=>d.device_type==="feeder");const camera=room.devices?.find((d)=>d.device_type==="camera");return <article key={room.id} className="room-panel"><div className="room-panel__header"><div className="room-number"><House size={20} weight="duotone"/></div><div><h2>Room {room.room_number}</h2><p>{room.room_name||"Pet suite"}</p></div><Badge tone={getRoomTone(room.status)}>{room.status}</Badge></div><div className="room-capacity">Capacity <strong>{room.capacity||1} pet{room.capacity===1?"":"s"}</strong></div>{room.notes&&<div className="room-notes">{room.notes}</div>}<div className="device-list"><DeviceRow icon={WifiHigh} label="Feeder" device={feeder}/><DeviceRow icon={Camera} label="Camera" device={camera}/></div><div className="room-card-actions"><Button variant="secondary" size="sm" onClick={()=>openEdit(room)}><PencilSimple size={16}/> Edit room</Button></div></article>
      })}</div>}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editing?`Edit Room ${editing.room_number}`:"Add room"} footer={<><Button variant="secondary" onClick={()=>setModalOpen(false)}>Cancel</Button><Button form="room-form" type="submit" disabled={saving}>{saving?"Saving…":editing?"Save changes":"Add room"}</Button></>}>
        <form id="room-form" className="room-form" onSubmit={submit}>
          <div className="room-form-grid"><Input label="Room number *" value={form.room_number} onChange={(e)=>setForm({...form,room_number:e.target.value})} required/><Input label="Room name" value={form.room_name} onChange={(e)=>setForm({...form,room_name:e.target.value})} placeholder="Basic Suite"/><Input label="Capacity *" type="number" min="1" value={form.capacity} onChange={(e)=>setForm({...form,capacity:e.target.value})} required/><Select label="Availability status" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="active">Active / available</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></Select></div>
          <label className="ui-field"><span>Notes</span><textarea className="ui-input room-notes-input" rows="4" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Optional room notes…"/></label>
        </form>
      </Modal>
    </section>
  );
}
function DeviceRow({icon:Icon,label,device}){return <div className="device-row"><Icon size={18} weight="duotone"/><span>{label}</span><strong>{device?.device_code||"Not assigned"}</strong><span className={`device-dot ${device?.status==="active"?"online":""}`} title={device?.status||"unassigned"}/></div>}
function getRoomTone(status){if(status==="active")return"success";if(status==="maintenance")return"warning";if(status==="inactive")return"neutral";return"info"}
