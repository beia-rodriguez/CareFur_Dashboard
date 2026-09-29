import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function useWebsiteInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("public_inquiries")
        .select("id,client_name,client_email,subject,status,created_at,updated_at")
        .order("updated_at", { ascending: false });
      if (queryError) throw queryError;
      const base = data ?? [];
      const ids = base.map((item)=>item.id);
      const summaries = new Map();
      if (ids.length) {
        const { data: rows, error: msgError } = await supabase
          .from("public_inquiry_messages")
          .select("id,inquiry_id,sender_type,sender_name,message,created_at")
          .in("inquiry_id", ids)
          .order("created_at", { ascending: false });
        if (msgError) throw msgError;
        for (const row of rows ?? []) if (!summaries.has(row.inquiry_id)) summaries.set(row.inquiry_id,row);
      }
      const enriched = base.map((item)=>({...item,lastMessage:summaries.get(item.id)||null}));
      setInquiries(enriched);
      setSelectedInquiry((current)=>current ? enriched.find((item)=>item.id===current.id) ?? enriched[0] ?? null : enriched[0] ?? null);
    } catch (fetchError) {
      console.error("Website inquiry load error:", fetchError);
      setError(fetchError?.message || "Unable to load website inquiries.");
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (inquiryId) => {
    if (!inquiryId) { setMessages([]); return; }
    try {
      const { data, error: queryError } = await supabase
        .from("public_inquiry_messages")
        .select("id,inquiry_id,sender_type,sender_name,staff_user_id,message,created_at")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true });
      if (queryError) throw queryError;
      setMessages(data ?? []);
    } catch (fetchError) {
      console.error("Website inquiry messages error:", fetchError);
      setError(fetchError?.message || "Unable to load inquiry messages.");
    }
  }, []);

  const selectInquiry = useCallback((inquiry)=>setSelectedInquiry(inquiry),[]);

  const sendReply = useCallback(async (message, senderName = "CareFur Staff") => {
    if (!selectedInquiry?.id || !message?.trim()) return false;
    setSending(true);
    setError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("public_inquiry_messages").insert({
        inquiry_id: selectedInquiry.id,
        sender_type: "staff",
        sender_name: senderName,
        staff_user_id: authData?.user?.id || null,
        message: message.trim(),
      });
      if (insertError) throw insertError;
      await loadMessages(selectedInquiry.id);
      await loadInquiries();
      return true;
    } catch (sendError) {
      console.error("Website inquiry reply error:", sendError);
      setError(sendError?.message || "Unable to send reply.");
      return false;
    } finally {
      setSending(false);
    }
  }, [selectedInquiry?.id, loadMessages, loadInquiries]);

  const toggleStatus = useCallback(async () => {
    if (!selectedInquiry?.id) return;
    const next = selectedInquiry.status === "closed" ? "open" : "closed";
    const { error: updateError } = await supabase.from("public_inquiries").update({ status: next, updated_at: new Date().toISOString() }).eq("id", selectedInquiry.id);
    if (updateError) { setError(updateError.message); return; }
    await loadInquiries();
  }, [selectedInquiry, loadInquiries]);

  useEffect(()=>{ loadInquiries(); },[loadInquiries]);
  useEffect(()=>{ loadMessages(selectedInquiry?.id); },[selectedInquiry?.id,loadMessages]);
  useEffect(()=>{
    const channel = supabase.channel("carefur-public-inquiries-admin")
      .on("postgres_changes", {event:"*",schema:"public",table:"public_inquiries"}, loadInquiries)
      .on("postgres_changes", {event:"*",schema:"public",table:"public_inquiry_messages"}, ()=>{ loadInquiries(); if(selectedInquiry?.id) loadMessages(selectedInquiry.id); })
      .subscribe();
    return ()=>supabase.removeChannel(channel);
  },[loadInquiries,loadMessages,selectedInquiry?.id]);

  return { inquiries, selectedInquiry, selectInquiry, messages, loading, sending, error, sendReply, toggleStatus, refresh: loadInquiries };
}
