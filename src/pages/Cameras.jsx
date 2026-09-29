import { ArrowClockwise, Camera, Clock, House, PencilSimple, Plus, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import useCameras from "../hooks/useCameras";
import useRooms from "../hooks/useRooms";
import "./Cameras.css";

const EMPTY={device_code:"",device_name:"",status:"active",room_id:""};

export default function Cameras() {
  const { cameras, loading, error, refresh, createCamera, updateCamera } = useCameras();
  const { rooms } = useRooms();
  const [modalOpen,setModalOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);
  const online = cameras.filter((item) => item.online).length;

  function openCreate(){setEditing(null);setForm(EMPTY);setModalOpen(true)}
  function openEdit(camera){setEditing(camera);setForm({device_code:camera.device_code||"",device_name:camera.device_name||"",status:camera.status||"active",room_id:camera.room?.id||""});setModalOpen(true)}
  async function submit(e){e.preventDefault();setSaving(true);const payload={device_code:form.device_code.trim(),device_name:form.device_name.trim(),status:form.status,room_id:form.room_id||null};const ok=editing?await updateCamera(editing.id,payload):await createCamera(payload);setSaving(false);if(ok)setModalOpen(false)}

  return (
    <section className="cameras-page">
      <PageHeader eyebrow="Monitoring" title="Camera Management" description="Monitor camera connectivity now and keep room/camera records ready for future live-stream integration." actions={<><Button variant="secondary" onClick={refresh}><ArrowClockwise size={18}/> Refresh</Button><Button onClick={openCreate}><Plus size={18}/> Add camera</Button></>} />
      <div className="camera-summary"><Summary icon={WifiHigh} value={online} label="Online" tone="success"/><Summary icon={WifiSlash} value={Math.max(cameras.length-online,0)} label="Offline" tone="danger"/><Summary icon={Camera} value={cameras.length} label="Registered cameras" tone="neutral"/></div>
      <div className="camera-info-note"><Camera size={20}/><div><strong>Future-ready camera management</strong><p>Register cameras and assign them to rooms now. Live streaming can be added later when you decide on a secure ESP32-CAM gateway or stream URL field.</p></div></div>
      {error&&<div className="page-alert page-alert--error">{error}</div>}
      {loading?<div className="page-loading">Loading cameras…</div>:cameras.length===0?<EmptyState icon={Camera} title="No cameras registered" message="Add a camera now so room assignments are ready for future monitoring."/>:<div className="camera-grid">{cameras.map((camera)=><article className="camera-card" key={camera.id}><div className={`camera-preview ${camera.online?"online":"offline"}`}><Camera size={44} weight="duotone"/><span>{camera.online?"Camera online":"Camera unavailable"}</span></div><div className="camera-card__body"><div className="camera-card__heading"><div><span>{camera.device_code}</span><h2>{camera.device_name||"CareFur Camera"}</h2></div><Badge tone={camera.online?"success":camera.status==="active"?"warning":"neutral"}>{camera.online?"Online":camera.status}</Badge></div><div className="camera-meta"><p><House size={17}/> {camera.room?.room_number?`Room ${camera.room.room_number}${camera.room.room_name?` — ${camera.room.room_name}`:""}`:"Not assigned to a room"}</p><p><Clock size={17}/> Last seen: {formatLastSeen(camera.last_seen_at)}</p></div><div className="camera-card-actions"><Button variant="secondary" size="sm" onClick={()=>openEdit(camera)}><PencilSimple size={16}/> Manage</Button></div></div></article>)}</div>}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editing?`Manage ${editing.device_code}`:"Add camera"} footer={<><Button variant="secondary" onClick={()=>setModalOpen(false)}>Cancel</Button><Button form="camera-form" type="submit" disabled={saving}>{saving?"Saving…":editing?"Save changes":"Add camera"}</Button></>}>
        <form id="camera-form" className="camera-form" onSubmit={submit}>
          <Input label="Device code *" value={form.device_code} onChange={(e)=>setForm({...form,device_code:e.target.value})} disabled={Boolean(editing)} required placeholder="CAM-001"/>
          <Input label="Camera name" value={form.device_name} onChange={(e)=>setForm({...form,device_name:e.target.value})} placeholder="Room 01 Camera"/>
          <Select label="Device status" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></Select>
          <Select label="Assign to room" value={form.room_id} onChange={(e)=>setForm({...form,room_id:e.target.value})}><option value="">Not assigned</option>{rooms.map((room)=><option key={room.id} value={room.id}>Room {room.room_number}{room.room_name?` — ${room.room_name}`:""}</option>)}</Select>
          <div className="future-camera-field"><strong>Live stream</strong><p>Reserved for a future update. No stream URL is stored in the current database schema.</p></div>
        </form>
      </Modal>
    </section>
  );
}
function Summary({icon:Icon,value,label,tone}){return <div className={`camera-summary__item ${tone}`}><Icon size={22} weight="duotone"/><div><strong>{value}</strong><span>{label}</span></div></div>}
function formatLastSeen(value){if(!value)return"Never";return new Intl.DateTimeFormat([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value))}
