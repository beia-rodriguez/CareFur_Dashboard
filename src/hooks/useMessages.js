import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function useMessages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversationState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: conversationError } = await supabase
        .from("conversations")
        .select(`
          id,
          booking_id,
          owner_id,
          owner_email,
          created_at,
          updated_at,
          owner:users!conversations_owner_id_fkey (
            id,
            full_name,
            email,
            phone
          ),
          booking:bookings!conversations_booking_id_fkey (
            id,
            booking_code,
            pet_id,
            room_id,
            status,
            check_in_at,
            expected_check_out_at,
            pet:pets!bookings_pet_id_fkey (
              id,
              name,
              species,
              breed,
              photo_url
            ),
            room:rooms!bookings_room_id_fkey (
              id,
              room_number,
              room_name
            )
          )
        `)
        .order("updated_at", { ascending: false });

      if (conversationError) throw conversationError;

      const base = data ?? [];
      const conversationIds = base.map((item) => item.id);
      const petIds = [...new Set(base.map((item) => item.booking?.pet_id).filter(Boolean))];
      const ownerByPet = new Map();
      const summaryByConversation = new Map();

      if (petIds.length > 0) {
        const { data: ownerLinks, error: ownerError } = await supabase
          .from("pet_owner_links")
          .select(`
            pet_id,
            is_primary,
            owner:owners!pet_owner_links_owner_id_fkey (
              id,
              full_name,
              email,
              phone
            )
          `)
          .in("pet_id", petIds)
          .order("is_primary", { ascending: false });

        if (ownerError) throw ownerError;
        for (const link of ownerLinks ?? []) {
          if (!ownerByPet.has(link.pet_id) || link.is_primary) ownerByPet.set(link.pet_id, link.owner);
        }
      }

      if (conversationIds.length > 0) {
        const { data: messageRows, error: summaryError } = await supabase
          .from("messages")
          .select("id,conversation_id,sender_type,message,read_at,created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false });

        if (summaryError) throw summaryError;

        for (const row of messageRows ?? []) {
          const existing = summaryByConversation.get(row.conversation_id) ?? { unreadCount: 0, lastMessage: null };
          if (!existing.lastMessage) existing.lastMessage = row;
          if ((row.sender_type === "customer" || row.sender_type === "guest") && !row.read_at) existing.unreadCount += 1;
          summaryByConversation.set(row.conversation_id, existing);
        }
      }

      const enriched = base.map((item) => {
        const petOwner = ownerByPet.get(item.booking?.pet_id) ?? null;
        const summary = summaryByConversation.get(item.id) ?? { unreadCount: 0, lastMessage: null };
        return {
          ...item,
          petOwner,
          displayOwner: petOwner || item.owner || null,
          owner_email: item.owner_email || petOwner?.email || item.owner?.email || "",
          unreadCount: summary.unreadCount,
          lastMessage: summary.lastMessage,
        };
      });

      setConversations(enriched);
      setSelectedConversationState((current) => {
        const same = current ? enriched.find((item) => item.id === current.id) : null;
        return same ?? enriched[0] ?? null;
      });
    } catch (fetchError) {
      console.error("Conversation load error:", fetchError);
      setConversations([]);
      setError(fetchError?.message || "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    try {
      const { data, error: messageError } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_user_id,sender_type,sender_name,message,read_at,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (messageError) throw messageError;
      setMessages(data ?? []);
    } catch (fetchError) {
      console.error("Message load error:", fetchError);
      setError(fetchError?.message || "Unable to load messages.");
    }
  }, []);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    const now = new Date().toISOString();
    const { error: readError } = await supabase
      .from("messages")
      .update({ read_at: now })
      .eq("conversation_id", conversationId)
      .in("sender_type", ["customer", "guest"])
      .is("read_at", null);

    if (readError) {
      console.warn("Unable to mark messages read:", readError);
      return;
    }

    setMessages((items) => items.map((item) =>
      (item.sender_type === "customer" || item.sender_type === "guest") && !item.read_at
        ? { ...item, read_at: now }
        : item,
    ));
    setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item));
  }, []);

  const setSelectedConversation = useCallback((conversation) => {
    setSelectedConversationState(conversation);
    if (conversation?.id) markConversationRead(conversation.id);
  }, [markConversationRead]);

  const sendMessage = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean || !selectedConversation) return false;

    setSending(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) throw new Error("Staff session not found.");

      const { data: profile } = await supabase
        .from("users")
        .select("full_name,email")
        .eq("id", authData.user.id)
        .maybeSingle();

      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_user_id: authData.user.id,
          sender_type: "staff",
          sender_name: profile?.full_name || profile?.email || authData.user.email || "CareFur Staff",
          message: clean,
          read_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setMessages((items) => items.some((item) => item.id === inserted.id) ? items : [...items, inserted]);
      await loadConversations();
      return true;
    } catch (sendError) {
      console.error("Staff send message error:", sendError);
      setError(sendError?.message || "Unable to send message.");
      return false;
    } finally {
      setSending(false);
    }
  }, [selectedConversation, loadConversations]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    const id = selectedConversation?.id;
    if (!id) {
      setMessages([]);
      return;
    }
    loadMessages(id).then(() => markConversationRead(id));
  }, [selectedConversation?.id, loadMessages, markConversationRead]);

  useEffect(() => {
    const channel = supabase
      .channel("carefur-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        loadConversations();
        const row = payload.new;
        if (row?.conversation_id === selectedConversation?.id) loadMessages(selectedConversation.id).then(() => markConversationRead(selectedConversation.id));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedConversation?.id, loadConversations, loadMessages, markConversationRead]);

  return {
    conversations,
    selectedConversation,
    setSelectedConversation,
    messages,
    loading,
    sending,
    error,
    sendMessage,
    reload: loadConversations,
  };
}
