import { ChatCircleDots, EnvelopeSimple, MagnifyingGlass, PaperPlaneTilt, PawPrint } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/common/PageHeader";
import useMessages from "../hooks/useMessages";
import "./Messages.css";

export default function Messages() {
  const { conversations, selectedConversation, setSelectedConversation, messages, loading, sending, error, sendMessage } = useMessages();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((item) => [item.booking?.pet?.name, item.displayOwner?.full_name, item.owner_email, item.booking?.room?.room_number, item.lastMessage?.message].some((value)=>String(value||"").toLowerCase().includes(needle)));
  }, [conversations, search]);

  async function handleSubmit(event) {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;
    if (await sendMessage(clean)) setText("");
  }

  const owner = selectedConversation?.displayOwner;
  const booking = selectedConversation?.booking;

  return (
    <section className="messages-page">
      <PageHeader eyebrow="Communication" title="Messages" description="Keep boarding conversations organized with owner details and unread status." />
      {error && <div className="page-alert page-alert--error">{error}</div>}

      <div className="messages-layout">
        <aside className="conversation-panel">
          <div className="conversation-panel__top">
            <div><strong>Conversations</strong><span>{conversations.reduce((sum,item)=>sum+(item.unreadCount||0),0)} unread</span></div>
            <label className="conversation-search"><MagnifyingGlass size={17}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search messages…"/></label>
          </div>

          <div className="conversation-list">
            {loading ? <div className="conversation-empty">Loading conversations…</div> : filtered.length === 0 ? <div className="conversation-empty">No conversations found.</div> : filtered.map((conversation) => {
              const active = selectedConversation?.id === conversation.id;
              const pet = conversation.booking?.pet;
              const displayName = conversation.displayOwner?.full_name || conversation.owner_email || "Pet owner";
              return (
                <button type="button" key={conversation.id} className={`conversation-row ${active?"active":""}`} onClick={()=>setSelectedConversation(conversation)}>
                  <div className="conversation-avatar"><PawPrint size={20} weight="fill"/></div>
                  <div className="conversation-content">
                    <div className="conversation-line"><strong>{displayName}</strong><time>{formatConversationDate(conversation.lastMessage?.created_at || conversation.updated_at)}</time></div>
                    <div className="conversation-pet-line"><span>{pet?.name || "Unknown pet"}{conversation.booking?.room?.room_number ? ` • Room ${conversation.booking.room.room_number}` : ""}</span>{conversation.unreadCount > 0 && <b className="unread-dot">{conversation.unreadCount}</b>}</div>
                    <small>{conversation.lastMessage?.message || conversation.owner_email || "No messages yet"}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="chat-panel">
          {!selectedConversation ? (
            <div className="chat-placeholder"><ChatCircleDots size={48} weight="duotone"/><h2>Select a conversation</h2><p>Choose a pet owner to view the message history.</p></div>
          ) : (
            <>
              <header className="chat-header">
                <div className="chat-owner">
                  <div className="chat-owner__avatar">{getInitials(owner?.full_name || selectedConversation.owner_email)}</div>
                  <div><h2>{owner?.full_name || "Pet owner"}</h2><p><EnvelopeSimple size={14}/> {selectedConversation.owner_email || owner?.email || "No email"}</p></div>
                </div>
                <div className="chat-booking-meta"><strong>{booking?.pet?.name || "Pet"}</strong><span>{booking?.room?.room_number ? `Room ${booking.room.room_number}` : "No room"} • {formatStatus(booking?.status)}</span></div>
              </header>

              <div className="chat-message-list">
                {messages.length === 0 ? <div className="empty-chat">No messages yet. Start the conversation below.</div> : messages.map((item) => {
                  if (item.sender_type === "system") return <div key={item.id} className="system-message">{item.message}</div>;
                  const fromStaff = item.sender_type === "staff";
                  return (
                    <div key={item.id} className={`message-row ${fromStaff?"staff":"customer"}`}>
                      <div className={`message-bubble ${fromStaff?"staff":"customer"}`}>
                        <strong>{item.sender_name || (fromStaff?"CareFur Staff":owner?.full_name || "Pet owner")}</strong>
                        <p>{item.message}</p>
                        <div className="message-meta"><time>{formatMessageTime(item.created_at)}</time>{fromStaff && <span>{item.read_at ? "Read" : "Sent"}</span>}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              <form className="chat-compose" onSubmit={handleSubmit}>
                <textarea rows="1" value={text} onChange={(event)=>setText(event.target.value)} placeholder="Write a message to the pet owner…"/>
                <button type="submit" disabled={!text.trim() || sending} aria-label="Send message"><PaperPlaneTilt size={20} weight="fill"/></button>
              </form>
            </>
          )}
        </main>
      </div>
    </section>
  );
}

function formatConversationDate(value){if(!value)return "";const date=new Date(value);const today=new Date();if(date.toDateString()===today.toDateString())return new Intl.DateTimeFormat([], {hour:"numeric",minute:"2-digit"}).format(date);return new Intl.DateTimeFormat([], {month:"short",day:"numeric"}).format(date)}
function formatMessageTime(value){return new Intl.DateTimeFormat([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value))}
function formatStatus(value){return String(value||"boarding").replaceAll("_"," ").replace(/\b\w/g,(c)=>c.toUpperCase())}
function getInitials(value){const parts=String(value||"PO").trim().split(/\s+/);return parts.slice(0,2).map((p)=>p[0]?.toUpperCase()).join("")||"PO"}
