import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import useMessages from "../hooks/useMessages";

import "./Messages.css";

export default function Messages() {
  const {
    conversations,

    selectedConversation,

    setSelectedConversation,

    messages,

    loading,

    sending,

    error,

    sendMessage,
  } =
    useMessages();

  const [
    text,
    setText,
  ] =
    useState("");

  const bottomRef =
    useRef(null);

  // ============================================================
  // AUTO SCROLL
  // ============================================================

  useEffect(() => {
    bottomRef.current
      ?.scrollIntoView({
        behavior:
          "smooth",
      });
  }, [
    messages,
  ]);

  // ============================================================
  // SEND
  // ============================================================

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      const clean =
        text.trim();

      if (
        !clean ||
        sending
      ) {
        return;
      }

      const success =
        await sendMessage(
          clean
        );

      if (
        success
      ) {
        setText("");
      }
    };

  // ============================================================
  // UI
  // ============================================================

  return (
    <section
      className="messages-page"
    >
      {/* HEADER */}

      <header
        className="messages-page-header"
      >
        <div>
          <p>
            CAREFUR
          </p>

          <h1>
            Messages
          </h1>

          <span>
            Chat with pet owners during their boarding stay
          </span>
        </div>
      </header>

      {/* ERROR */}

      {error && (
        <div
          className="messages-error"
        >
          {error}
        </div>
      )}

      {/* CHAT */}

      <div
        className="messages-layout"
      >
        {/* ================================================= */}
        {/* CONVERSATIONS */}
        {/* ================================================= */}

        <aside
          className="conversation-panel"
        >
          <div
            className="conversation-title"
          >
            Conversations
          </div>

          {loading ? (
            <div
              className="conversation-empty"
            >
              Loading conversations...
            </div>
          ) : conversations.length ===
            0 ? (
            <div
              className="conversation-empty"
            >
              No conversations yet.
            </div>
          ) : (
            conversations.map(
              (
                conversation
              ) => {
                const booking =
                  conversation.bookings;

                const pet =
                  booking?.pets;

                const room =
                  booking?.rooms;

                const active =
                  selectedConversation
                    ?.id ===
                  conversation.id;

                return (
                  <button
                    type="button"
                    key={
                      conversation.id
                    }
                    className={`conversation-row ${
                      active
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedConversation(
                        conversation
                      )
                    }
                  >
                    <div
                      className="conversation-avatar"
                    >
                      🐾
                    </div>

                    <div
                      className="conversation-content"
                    >
                      <strong>
                        {pet?.name ||
                          "Pet Owner"}
                      </strong>

                      <span>
                        {room?.room_number
                          ? `Room ${room.room_number}`
                          : "No room assigned"}
                      </span>

                      <small>
                        {conversation.owner_email ||
                          "Guest access"}
                      </small>
                    </div>
                  </button>
                );
              }
            )
          )}
        </aside>

        {/* ================================================= */}
        {/* CHAT */}
        {/* ================================================= */}

        <main
          className="chat-panel"
        >
          {!selectedConversation ? (
            <div
              className="chat-placeholder"
            >
              <div
                className="chat-placeholder-icon"
              >
                💬
              </div>

              <h2>
                Select a conversation
              </h2>

              <p>
                Choose a boarding conversation to start messaging.
              </p>
            </div>
          ) : (
            <>
              {/* HEADER */}

              <div
                className="chat-header"
              >
                <div>
                  <h2>
                    {selectedConversation
                      ?.bookings
                      ?.pets
                      ?.name ||
                      "Pet Owner"}
                  </h2>

                  <p>
                    {selectedConversation
                      ?.bookings
                      ?.rooms
                      ?.room_number
                      ? `Room ${
                          selectedConversation
                            .bookings
                            .rooms
                            .room_number
                        }`
                      : "No room assigned"}
                  </p>
                </div>

                <span
                  className="booking-status"
                >
                  {selectedConversation
                    ?.bookings
                    ?.status ||
                    "boarding"}
                </span>
              </div>

              {/* MESSAGES */}

              <div
                className="chat-message-list"
              >
                {messages.length ===
                0 ? (
                  <div
                    className="empty-chat"
                  >
                    No messages yet.
                  </div>
                ) : (
                  messages.map(
                    (
                      item
                    ) => {
                      const fromStaff =
                        item.sender_type ===
                        "staff";

                      const system =
                        item.sender_type ===
                        "system";

                      if (
                        system
                      ) {
                        return (
                          <div
                            key={
                              item.id
                            }
                            className="system-message"
                          >
                            {item.message}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={
                            item.id
                          }
                          className={`message-row ${
                            fromStaff
                              ? "staff"
                              : "customer"
                          }`}
                        >
                          <div
                            className={`message-bubble ${
                              fromStaff
                                ? "staff"
                                : "customer"
                            }`}
                          >
                            <strong>
                              {fromStaff
                                ? item.sender_name ||
                                  "CareFur Staff"
                                : item.sender_name ||
                                  "Customer"}
                            </strong>

                            <p>
                              {item.message}
                            </p>

                            <small>
                              {formatMessageTime(
                                item.created_at
                              )}
                            </small>
                          </div>
                        </div>
                      );
                    }
                  )
                )}

                <div
                  ref={
                    bottomRef
                  }
                />
              </div>

              {/* INPUT */}

              <form
                className="chat-compose"
                onSubmit={
                  handleSubmit
                }
              >
                <textarea
                  rows="1"
                  maxLength="2000"
                  placeholder="Type a message..."
                  value={
                    text
                  }
                  onChange={(
                    event
                  ) =>
                    setText(
                      event.target.value
                    )
                  }
                />

                <button
                  type="submit"
                  disabled={
                    !text.trim() ||
                    sending
                  }
                >
                  {sending
                    ? "Sending..."
                    : "Send"}
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </section>
  );
}

function formatMessageTime(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        true,
    }
  );
}