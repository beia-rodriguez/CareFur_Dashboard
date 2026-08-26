import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // ============================================================
  // CORS
  // ============================================================

  if (
    req.method ===
    "OPTIONS"
  ) {
    return new Response(
      "ok",
      {
        headers:
          corsHeaders,
      }
    );
  }

  try {
    // ============================================================
    // METHOD
    // ============================================================

    if (
      req.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          error:
            "Method not allowed.",
        },
        405
      );
    }

    // ============================================================
    // SUPABASE
    // ============================================================

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          error:
            "Server configuration error.",
        },
        500
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        }
      );

    // ============================================================
    // BODY
    // ============================================================

    let body:
      any;

    try {
      body =
        await req.json();
    } catch {
      return jsonResponse(
        {
          error:
            "Invalid request body.",
        },
        400
      );
    }

    const bookingId =
      String(
        body?.bookingId ||
          ""
      ).trim();

    const accessCode =
      String(
        body?.accessCode ||
          ""
      )
        .trim()
        .toUpperCase();

    const message =
      String(
        body?.message ||
          ""
      ).trim();

    if (
      !bookingId
    ) {
      return jsonResponse(
        {
          error:
            "Booking ID is required.",
        },
        400
      );
    }

    if (
      !message
    ) {
      return jsonResponse(
        {
          error:
            "Message cannot be empty.",
        },
        400
      );
    }

    if (
      message.length >
      2000
    ) {
      return jsonResponse(
        {
          error:
            "Message is too long.",
        },
        400
      );
    }

    // ============================================================
    // AUTH USER
    // ============================================================

    let authenticatedUser:
      any =
      null;

    const authorization =
      req.headers.get(
        "Authorization"
      );

    if (
      authorization
    ) {
      const token =
        authorization.replace(
          /^Bearer\s+/i,
          ""
        );

      if (token) {
        const {
          data:
            authData,
          error:
            authError,
        } =
          await supabase.auth.getUser(
            token
          );

        if (
          !authError &&
          authData
            ?.user
        ) {
          authenticatedUser =
            authData.user;
        }
      }
    }

    // ============================================================
    // BOOKING
    // ============================================================

    const {
      data:
        booking,
      error:
        bookingError,
    } =
      await supabase
        .from(
          "bookings"
        )
        .select("*")
        .eq(
          "id",
          bookingId
        )
        .maybeSingle();

    if (
      bookingError ||
      !booking
    ) {
      return jsonResponse(
        {
          error:
            "Booking was not found.",
        },
        404
      );
    }

    // ============================================================
    // BOOKING ACCESS
    // ============================================================

    const {
      data:
        bookingAccess,
      error:
        bookingAccessError,
    } =
      await supabase
        .from(
          "booking_access"
        )
        .select(`
          id,
          booking_id,
          owner_id,
          invited_email,
          expires_at,
          redeemed_at,
          access_code_hash
        `)
        .eq(
          "booking_id",
          bookingId
        )
        .maybeSingle();

    if (
      bookingAccessError
    ) {
      console.error(
        "Booking access error:",
        bookingAccessError
      );
    }

    // ============================================================
    // OWNER AUTHORIZATION
    // ============================================================

    let ownerAuthorized =
      false;

    if (
      authenticatedUser
    ) {
      if (
        booking.owner_id &&
        booking.owner_id ===
          authenticatedUser.id
      ) {
        ownerAuthorized =
          true;
      }

      if (
        !ownerAuthorized &&
        bookingAccess
          ?.owner_id ===
          authenticatedUser.id
      ) {
        ownerAuthorized =
          true;
      }

      const authEmail =
        String(
          authenticatedUser
            .email ||
            ""
        )
          .trim()
          .toLowerCase();

      const invitedEmail =
        String(
          bookingAccess
            ?.invited_email ||
            ""
        )
          .trim()
          .toLowerCase();

      if (
        !ownerAuthorized &&
        authEmail &&
        invitedEmail &&
        authEmail ===
          invitedEmail
      ) {
        ownerAuthorized =
          true;
      }
    }

    // ============================================================
    // GUEST CODE AUTHORIZATION
    // ============================================================

    let guestAuthorized =
      false;

    let accessRecord:
      any =
      null;

    if (
      accessCode &&
      /^[A-Z0-9]{8}$/.test(
        accessCode
      )
    ) {
      const hash =
        await sha256(
          accessCode
        );

      const {
        data,
        error:
          accessError,
      } =
        await supabase
          .from(
            "booking_access"
          )
          .select(`
            id,
            booking_id,
            owner_id,
            invited_email,
            expires_at,
            redeemed_at,
            access_code_hash
          `)
          .eq(
            "booking_id",
            bookingId
          )
          .eq(
            "access_code_hash",
            hash
          )
          .maybeSingle();

      if (
        accessError
      ) {
        console.error(
          "Guest access lookup error:",
          accessError
        );
      }

      if (data) {
        accessRecord =
          data;

        let expired =
          false;

        if (
          data.expires_at
        ) {
          const expiresAt =
            new Date(
              data.expires_at
            );

          expired =
            Number.isNaN(
              expiresAt.getTime()
            ) ||
            expiresAt.getTime() <=
              Date.now();
        }

        if (
          !expired
        ) {
          guestAuthorized =
            true;
        }
      }
    }

    // ============================================================
    // FINAL PERMISSION
    // ============================================================

    if (
      !ownerAuthorized &&
      !guestAuthorized
    ) {
      return jsonResponse(
        {
          error:
            "You do not have permission to send messages for this booking.",
        },
        403
      );
    }

    // ============================================================
    // SENDER TYPE
    // ============================================================

    const senderType =
      ownerAuthorized
        ? "customer"
        : "guest";

    let senderName =
      "Guest";

    if (
      ownerAuthorized &&
      authenticatedUser
    ) {
      senderName =
        authenticatedUser
          .user_metadata
          ?.full_name ||
        authenticatedUser
          .email ||
        "Pet Owner";
    } else {
      senderName =
        accessRecord
          ?.invited_email ||
        bookingAccess
          ?.invited_email ||
        "Guest";
    }

    // ============================================================
    // GET CONVERSATION
    // ============================================================

    let {
      data:
        conversation,
      error:
        conversationError,
    } =
      await supabase
        .from(
          "conversations"
        )
        .select("*")
        .eq(
          "booking_id",
          bookingId
        )
        .maybeSingle();

    if (
      conversationError
    ) {
      throw conversationError;
    }

    // ============================================================
    // CREATE CONVERSATION
    // ============================================================

    if (
      !conversation
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "conversations"
          )
          .insert({
            booking_id:
              bookingId,

            owner_id:
              ownerAuthorized &&
              authenticatedUser
                ? authenticatedUser.id
                : bookingAccess
                    ?.owner_id ??
                  null,

            owner_email:
              ownerAuthorized &&
              authenticatedUser
                ? authenticatedUser
                    .email ??
                  bookingAccess
                    ?.invited_email ??
                  null
                : bookingAccess
                    ?.invited_email ??
                  null,
          })
          .select()
          .single();

      if (error) {
        console.error(
          "Conversation create error:",
          error
        );

        throw error;
      }

      conversation =
        data;
    }

    // ============================================================
    // INSERT MESSAGE
    // ============================================================

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
            conversation.id,

          sender_user_id:
            ownerAuthorized &&
            authenticatedUser
              ? authenticatedUser.id
              : null,

          sender_type:
            senderType,

          sender_name:
            senderName,

          message,
        })
        .select()
        .single();

    if (
      insertError
    ) {
      console.error(
        "Message insert error:",
        insertError
      );

      throw insertError;
    }

    // ============================================================
    // SUCCESS
    // ============================================================

    return jsonResponse(
      {
        success:
          true,

        message:
          insertedMessage,
      },
      200
    );
  } catch (
    error
  ) {
    console.error(
      "send-booking-message error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to send message.",
      },
      500
    );
  }
});

// ============================================================
// SHA256
// ============================================================

async function sha256(
  value:
    string
) {
  const encoded =
    new TextEncoder()
      .encode(
        value
      );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return Array.from(
    new Uint8Array(
      digest
    )
  )
    .map(
      (
        byte
      ) =>
        byte
          .toString(
            16
          )
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}

// ============================================================
// RESPONSE
// ============================================================

function jsonResponse(
  body:
    unknown,

  status =
    200
) {
  return new Response(
    JSON.stringify(
      body
    ),
    {
      status,

      headers: {
        ...corsHeaders,

        "Content-Type":
          "application/json",
      },
    }
  );
}