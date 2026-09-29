import { ArrowClockwise, ChatCircleDots, EnvelopeSimple, MagnifyingGlass, PaperPlaneTilt } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import PageHeader from "../components/common/PageHeader";
import useAuth from "../hooks/useAuth";
import useWebsiteInquiries from "../hooks/useWebsiteInquiries";
import "./Messages.css";
import "./WebsiteInquiries.css";

export default function WebsiteInquiries(){
  const { profile } = useAuth();
  const { inquiries, selectedInquiry, selectInquiry, messages, loading, sending, error, sendReply, toggleStatus, refresh } = useWebsiteInquiries();
  const [search,setSearch]=useState("");
  const [text,setText]=useState("");
  const bottomRef=useRef(null);
  useEffect(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),[messages]);
  const filtered=useMemo(()=>{const n=search.trim().toLowerCase();if(!n)return inquiries;return inquiries.filter((i)=>[i.client_name,i.client_email,i.subject,i.lastMessage?.message].some((v)=>String(v||"").toLowerCase().includes(n)))},[inquiries,search]);
  async function submit(e){e.preventDefault();const clean=text.trim();if(!clean||sending)return;if(await sendReply(clean,profile?.full_name||"CareFur Staff"))setText("")}
  return <section className="messages-page website-inquiries-page">
    <PageHeader eyebrow="Public Website" title="Website Inquiries" description="Realtime messages submitted from carefur.me. Kept separate from owner-app boarding conversations." actions={<Button variant="secondary" onClick={refresh}><ArrowClockwise size={18}/> Refresh</Button>}/>
    {error&&<div className="page-alert page-alert--error">{error}</div>}
    <div className="message-source-tabs"><div className="message-source-tab active"><ChatCircleDots size={18}/> Website inquiries</div><div className="message-source-note">Owner app messages remain under <b>App Messages</b>.</div></div>
    <div className="messages-layout">
      <aside className="conversation-panel">
        <div className="conversation-panel__top"><div><strong>Public inquiries</strong><span>{inquiries.filter((i)=>i.status==="open").length} open</span></div><label className="conversation-search"><MagnifyingGlass size={17}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search inquiries…"/></label></div>
        <div className="conversation-list">{loading?<div className="conversation-empty">Loading inquiries…</div>:filtered.length===0?<div className="conversation-empty">No inquiries found.</div>:filtered.map((item)=>{
          const active=selectedInquiry?.id===item.id;return <button type="button" key={item.id} className={`conversation-row ${active?"active":""}`} onClick={()=>selectInquiry(item)}><div className="conversation-avatar"><EnvelopeSimple size={20} weight="fill"/></div><div className="conversation-content"><div className="conversation-line"><strong>{item.client_name||"Website visitor"}</strong><time>{fmtListDate(item.lastMessage?.created_at||item.updated_at)}</time></div><div className="conversation-pet-line"><span>{item.subject}</span><Badge tone={item.status==="open"?"success":"neutral"}>{item.status}</Badge></div><small>{item.lastMessage?.message||item.client_email}</small></div></button>})}</div>
      </aside>
      <main className="chat-panel">
        {!selectedInquiry?<div className="chat-placeholder"><ChatCircleDots size={48} weight="duotone"/><h2>Select an inquiry</h2><p>Choose a website visitor to view the realtime thread.</p></div>:<>
          <header className="chat-header"><div className="chat-owner"><div className="chat-owner__avatar">{initials(selectedInquiry.client_name)}</div><div><h2>{selectedInquiry.client_name||"Website visitor"}</h2><p><EnvelopeSimple size={14}/> {selectedInquiry.client_email}</p></div></div><div className="website-inquiry-header-actions"><Badge tone={selectedInquiry.status==="open"?"success":"neutral"}>{selectedInquiry.status}</Badge><Button variant="secondary" size="sm" onClick={toggleStatus}>{selectedInquiry.status==="open"?"Close inquiry":"Reopen inquiry"}</Button></div></header>
          <div className="chat-message-list">{messages.length===0?<div className="empty-chat">No messages yet.</div>:messages.map((item)=>{const fromStaff=item.sender_type==="staff";return <div key={item.id} className={`message-row ${fromStaff?"staff":"customer"}`}><div className={`message-bubble ${fromStaff?"staff":"customer"}`}><strong>{item.sender_name||(fromStaff?"CareFur Staff":selectedInquiry.client_name||"Visitor")}</strong><p>{item.message}</p><div className="message-meta"><time>{fmtMessage(item.created_at)}</time></div></div></div>})}<div ref={bottomRef}/></div>
          {selectedInquiry.status==="open"?<form className="chat-compose" onSubmit={submit}><textarea rows="1" value={text} onChange={(e)=>setText(e.target.value)} placeholder="Reply to website inquiry…"/><button type="submit" disabled={!text.trim()||sending} aria-label="Send reply"><PaperPlaneTilt size={20} weight="fill"/></button></form>:<div className="website-inquiry-closed">This inquiry is closed. Reopen it to send another reply.</div>}
        </>}
      </main>
    </div>
  </section>
}
function fmtListDate(v){if(!v)return"";const d=new Date(v),t=new Date();if(d.toDateString()===t.toDateString())return new Intl.DateTimeFormat([],{hour:"numeric",minute:"2-digit"}).format(d);return new Intl.DateTimeFormat([],{month:"short",day:"numeric"}).format(d)}
function fmtMessage(v){return new Intl.DateTimeFormat([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v))}
function initials(v){const p=String(v||"WV").trim().split(/\s+/);return p.slice(0,2).map((x)=>x[0]?.toUpperCase()).join("")||"WV"}
