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

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // ============================================================
    // METHOD
    // ============================================================

    if (req.method !== "POST") {
      return jsonResponse(
        {
          error: "Method not allowed.",
        },
        405
      );
    }

    // ============================================================
    // SUPABASE ADMIN CLIENT
    // ============================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

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
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    // ============================================================
    // BODY
    // ============================================================

    let body: any;

    try {
      body = await req.json();
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
        body?.bookingId || ""
      ).trim();

    const accessCode =
      String(
        body?.accessCode || ""
      )
        .trim()
        .toUpperCase();

    if (!bookingId) {
      return jsonResponse(
        {
          error:
            "Booking ID is required.",
        },
        400
      );
    }

    // ============================================================
    // GET AUTHENTICATED USER
    // ============================================================

    let authenticatedUser:
      any = null;

    const authorization =
      req.headers.get(
        "Authorization"
      );

    if (authorization) {
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
          authData?.user
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
      data: booking,
      error:
        bookingError,
    } =
      await supabase
        .from("bookings")
        .select("*")
        .eq(
          "id",
          bookingId
        )
        .maybeSingle();

    if (bookingError) {
      console.error(
        "Booking lookup error:",
        bookingError
      );

      return jsonResponse(
        {
          error:
            "Unable to retrieve booking.",
        },
        500
      );
    }

    if (!booking) {
      return jsonResponse(
        {
          error:
            "Booking was not found.",
        },
        404
      );
    }

    // ============================================================
    // BLOCK CANCELLED BOOKINGS
    // ============================================================

    const bookingStatus =
      String(
        booking.status || ""
      )
        .trim()
        .toLowerCase();

    if (
      [
        "cancelled",
        "canceled",
      ].includes(
        bookingStatus
      )
    ) {
      return jsonResponse(
        {
          error:
            "This booking is no longer available.",
        },
        403
      );
    }

    // ============================================================
    // GET BOOKING ACCESS RECORD
    //
    // We need this regardless of whether the user is logged in.
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
        "Booking access lookup error:",
        bookingAccessError
      );
    }

    // ============================================================
    // CHECK ACCOUNT OWNER ACCESS
    // ============================================================

    let ownerAuthorized =
      false;

    if (
      authenticatedUser
    ) {
      // ----------------------------------------------------------
      // Check booking.owner_id if your bookings table has it
      // ----------------------------------------------------------

      if (
        booking.owner_id &&
        booking.owner_id ===
          authenticatedUser.id
      ) {
        ownerAuthorized =
          true;
      }

      // ----------------------------------------------------------
      // Check booking_access.owner_id
      // ----------------------------------------------------------

      if (
        !ownerAuthorized &&
        bookingAccess
          ?.owner_id &&
        bookingAccess
          .owner_id ===
          authenticatedUser.id
      ) {
        ownerAuthorized =
          true;
      }

      // ----------------------------------------------------------
      // Match invited email
      // ----------------------------------------------------------

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
    // CHECK BOARDING CODE ACCESS
    //
    // IMPORTANT:
    // This is checked EVEN IF a user is currently logged in.
    // ============================================================

    let guestAuthorized =
      false;

    let accessRecord:
      any = null;

    if (
      accessCode &&
      /^[A-Z0-9]{8}$/.test(
        accessCode
      )
    ) {
      const accessCodeHash =
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
            accessCodeHash
          )
          .maybeSingle();

      if (accessError) {
        console.error(
          "Access-code lookup error:",
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

        if (!expired) {
          guestAuthorized =
            true;
        }
      }
    }

    // ============================================================
    // FINAL AUTHORIZATION
    // ============================================================

    const allowed =
      ownerAuthorized ||
      guestAuthorized;

    console.log(
      "CHAT ACCESS CHECK"
    );

    console.log(
      "Booking:",
      bookingId
    );

    console.log(
      "Logged in:",
      Boolean(
        authenticatedUser
      )
    );

    console.log(
      "Owner authorized:",
      ownerAuthorized
    );

    console.log(
      "Guest authorized:",
      guestAuthorized
    );

    if (!allowed) {
      // User supplied a real matching code but it has expired.
      if (
        accessRecord
          ?.expires_at
      ) {
        const expiresAt =
          new Date(
            accessRecord.expires_at
          );

        if (
          expiresAt.getTime() <=
          Date.now()
        ) {
          return jsonResponse(
            {
              error:
                "Your guest chat access has expired. Log in with the owner account to view persistent conversation history.",
            },
            403
          );
        }
      }

      return jsonResponse(
        {
          error:
            "You do not have access to this booking.",
        },
        403
      );
    }

    // ============================================================
    // ACCESS TYPE
    // ============================================================

    const accessType =
      ownerAuthorized
        ? "account"
        : "guest";

    // ============================================================
    // PET
    // ============================================================

    let pet =
      null;

    if (
      booking.pet_id
    ) {
      const {
        data:
          petData,
        error:
          petError,
      } =
        await supabase
          .from("pets")
          .select("*")
          .eq(
            "id",
            booking.pet_id
          )
          .maybeSingle();

      if (petError) {
        console.error(
          "Pet lookup error:",
          petError
        );
      } else {
        pet =
          petData;
      }
    }

    // ============================================================
    // ROOM
    // ============================================================

    let room =
      null;

    if (
      booking.room_id
    ) {
      const {
        data:
          roomData,
        error:
          roomError,
      } =
        await supabase
          .from("rooms")
          .select("*")
          .eq(
            "id",
            booking.room_id
          )
          .maybeSingle();

      if (roomError) {
        console.error(
          "Room lookup error:",
          roomError
        );
      } else {
        room =
          roomData;
      }
    }

    // ============================================================
    // FIND CONVERSATION
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
      console.error(
        "Conversation lookup error:",
        conversationError
      );

      return jsonResponse(
        {
          error:
            "Unable to retrieve conversation.",
        },
        500
      );
    }

    // ============================================================
    // CREATE CONVERSATION
    // ============================================================

    if (!conversation) {
      const ownerId =
        ownerAuthorized &&
        authenticatedUser
          ? authenticatedUser.id
          : bookingAccess
              ?.owner_id ??
            null;

      const ownerEmail =
        ownerAuthorized &&
        authenticatedUser
          ? authenticatedUser
              .email ??
            bookingAccess
              ?.invited_email ??
            null
          : bookingAccess
              ?.invited_email ??
            null;

      const {
        data:
          newConversation,
        error:
          createError,
      } =
        await supabase
          .from(
            "conversations"
          )
          .insert({
            booking_id:
              bookingId,

            owner_id:
              ownerId,

            owner_email:
              ownerEmail,
          })
          .select()
          .single();

      if (createError) {
        console.error(
          "Conversation creation error:",
          createError
        );

        return jsonResponse(
          {
            error:
              "Unable to create conversation.",
          },
          500
        );
      }

      conversation =
        newConversation;
    }

    // ============================================================
    // GET MESSAGES
    // ============================================================

    const {
      data: messages,
      error:
        messagesError,
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
          conversation.id
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        );

    if (
      messagesError
    ) {
      console.error(
        "Messages lookup error:",
        messagesError
      );

      return jsonResponse(
        {
          error:
            "Unable to retrieve messages.",
        },
        500
      );
    }

    // ============================================================
    // SUCCESS
    // ============================================================

    return jsonResponse(
      {
        success: true,

        accessType,

        conversation,

        booking,

        pet,

        room,

        messages:
          messages ??
          [],
      },
      200
    );
  } catch (
    error
  ) {
    console.error(
      "get-booking-chat error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to load chat.",
      },
      500
    );
  }
});

// ============================================================
// SHA256
// ============================================================

async function sha256(
  value: string
): Promise<string> {
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
          .toString(16)
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
  body: unknown,
  status = 200
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