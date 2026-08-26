import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "../services/supabaseClient";

export default function useMessages() {
  const [
    conversations,
    setConversations,
  ] =
    useState([]);

  const [
    selectedConversation,
    setSelectedConversation,
  ] =
    useState(null);

  const [
    messages,
    setMessages,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);

  // ============================================================
  // LOAD CONVERSATIONS
  // ============================================================

  const loadConversations =
    useCallback(
      async () => {
        try {
          setError(
            null
          );

          const {
            data,
            error:
              conversationError,
          } =
            await supabase
              .from(
                "conversations"
              )
              .select(`
                id,
                booking_id,
                owner_id,
                owner_email,
                created_at,
                updated_at,
                bookings (
                  id,
                  booking_code,
                  pet_id,
                  room_id,
                  status,
                  pets (
                    id,
                    name,
                    species,
                    breed,
                    sex
                  ),
                  rooms (
                    id,
                    room_number,
                    room_name
                  )
                )
              `)
              .order(
                "updated_at",
                {
                  ascending:
                    false,
                }
              );

          if (
            conversationError
          ) {
            throw conversationError;
          }

          const list =
            data ??
            [];

          setConversations(
            list
          );

          setSelectedConversation(
            (
              current
            ) => {
              if (
                current
              ) {
                const found =
                  list.find(
                    (
                      item
                    ) =>
                      item.id ===
                      current.id
                  );

                if (
                  found
                ) {
                  return found;
                }
              }

              return (
                list[0] ??
                null
              );
            }
          );
        } catch (
          err
        ) {
          console.error(
            "Conversation load error:",
            err
          );

          setError(
            err?.message ||
              "Unable to load conversations."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  // ============================================================
  // LOAD MESSAGES
  // ============================================================

  const loadMessages =
    useCallback(
      async (
        conversationId
      ) => {
        if (
          !conversationId
        ) {
          setMessages(
            []
          );

          return;
        }

        try {
          const {
            data,
            error:
              messageError,
          } =
            await supabase
              .from(
                "messages"
              )
              .select(`
                id,
                conversation_id,
                sender_user_id,
                sender_type,
                sender_name,
                message,
                read_at,
                created_at
              `)
              .eq(
                "conversation_id",
                conversationId
              )
              .order(
                "created_at",
                {
                  ascending:
                    true,
                }
              );

          if (
            messageError
          ) {
            throw messageError;
          }

          setMessages(
            data ??
              []
          );
        } catch (
          err
        ) {
          console.error(
            "Message load error:",
            err
          );

          setError(
            err?.message ||
              "Unable to load messages."
          );
        }
      },
      []
    );

  // ============================================================
  // SEND STAFF MESSAGE
  // ============================================================

  const sendMessage =
    useCallback(
      async (
        text
      ) => {
        const clean =
          text.trim();

        if (
          !clean ||
          !selectedConversation
        ) {
          return false;
        }

        try {
          setSending(
            true
          );

          setError(
            null
          );

          const {
            data: {
              user,
            },
            error:
              authError,
          } =
            await supabase.auth.getUser();

          if (
            authError ||
            !user
          ) {
            throw new Error(
              "Staff session not found."
            );
          }

          const {
            data:
              profile,
            error:
              profileError,
          } =
            await supabase
              .from(
                "users"
              )
              .select(
                "full_name, email, role"
              )
              .eq(
                "id",
                user.id
              )
              .maybeSingle();

          if (
            profileError
          ) {
            console.warn(
              "Staff profile load failed:",
              profileError
            );
          }

          const senderName =
            profile?.full_name ||
            profile?.email ||
            user.email ||
            "CareFur Staff";

          const {
            data:
              insertedMessage,
            error:
              insertError,
          } =
            await supabase
              .from(
                "messages"
              )
              .insert({
                conversation_id:
                  selectedConversation.id,

                sender_user_id:
                  user.id,

                sender_type:
                  "staff",

                sender_name:
                  senderName,

                message:
                  clean,
              })
              .select()
              .single();

          if (
            insertError
          ) {
            throw insertError;
          }

          setMessages(
            (
              current
            ) => {
              if (
                current.some(
                  (
                    item
                  ) =>
                    item.id ===
                    insertedMessage.id
                )
              ) {
                return current;
              }

              return [
                ...current,
                insertedMessage,
              ];
            }
          );

          await loadConversations();

          return true;
        } catch (
          err
        ) {
          console.error(
            "Staff send message error:",
            err
          );

          setError(
            err?.message ||
              "Unable to send message."
          );

          return false;
        } finally {
          setSending(
            false
          );
        }
      },
      [
        selectedConversation,
        loadConversations,
      ]
    );

  // ============================================================
  // INITIAL
  // ============================================================

  useEffect(() => {
    loadConversations();
  }, [
    loadConversations,
  ]);

  // ============================================================
  // SELECTED CHAT
  // ============================================================

  useEffect(() => {
    if (
      selectedConversation
        ?.id
    ) {
      loadMessages(
        selectedConversation.id
      );
    } else {
      setMessages(
        []
      );
    }
  }, [
    selectedConversation,
    loadMessages,
  ]);

  // ============================================================
  // REALTIME
  // ============================================================

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "carefur-dashboard-chat"
        )
        .on(
          "postgres_changes",
          {
            event:
              "INSERT",

            schema:
              "public",

            table:
              "messages",
          },
          (
            payload
          ) => {
            const incoming =
              payload.new;

            loadConversations();

            if (
              incoming.conversation_id ===
              selectedConversation
                ?.id
            ) {
              setMessages(
                (
                  current
                ) => {
                  if (
                    current.some(
                      (
                        item
                      ) =>
                        item.id ===
                        incoming.id
                    )
                  ) {
                    return current;
                  }

                  return [
                    ...current,
                    incoming,
                  ];
                }
              );
            }
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    selectedConversation,
    loadConversations,
  ]);

  return {
    conversations,

    selectedConversation,

    setSelectedConversation,

    messages,

    loading,

    sending,

    error,

    sendMessage,

    reload:
      loadConversations,
  };
}