import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // ==========================================================
  // CORS PREFLIGHT
  // ==========================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // ========================================================
    // ONLY ALLOW POST
    // ========================================================

    if (req.method !== "POST") {
      return jsonResponse(
        {
          error: "Method not allowed.",
        },
        405
      );
    }

    // ========================================================
    // SUPABASE ADMIN CLIENT
    // ========================================================

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
      console.error(
        "Missing Supabase environment variables."
      );

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

    // ========================================================
    // READ REQUEST BODY
    // ========================================================

    let body;

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

    // ========================================================
    // NORMALIZE ACCESS CODE
    // ========================================================

    const code =
      String(
        body?.code || ""
      )
        .trim()
        .toUpperCase();

    if (!code) {
      return jsonResponse(
        {
          error:
            "Access code is required.",
        },
        400
      );
    }

    if (
      !/^[A-Z0-9]{8}$/.test(
        code
      )
    ) {
      return jsonResponse(
        {
          error:
            "Invalid access code.",
        },
        400
      );
    }

    console.log(
      "Verifying booking access code..."
    );

    // ========================================================
    // HASH ACCESS CODE
    // ========================================================

    const accessCodeHash =
      await sha256(code);

    // ========================================================
    // FIND BOOKING ACCESS RECORD
    // ========================================================

    const {
      data: accessRecord,
      error: accessError,
    } = await supabase
      .from("booking_access")
      .select(`
        id,
        booking_id,
        owner_id,
        invited_email,
        expires_at,
        redeemed_at,
        created_at
      `)
      .eq(
        "access_code_hash",
        accessCodeHash
      )
      .maybeSingle();

    if (accessError) {
      console.error(
        "booking_access lookup failed:",
        accessError
      );

      return jsonResponse(
        {
          error:
            "Unable to verify the access code.",
        },
        500
      );
    }

    if (!accessRecord) {
      return jsonResponse(
        {
          error:
            "Invalid access code.",
        },
        404
      );
    }

    // ========================================================
    // CHECK ACCESS CODE EXPIRATION
    // ========================================================

    if (
      accessRecord.expires_at
    ) {
      const expiresAt =
        new Date(
          accessRecord.expires_at
        );

      if (
        Number.isNaN(
          expiresAt.getTime()
        ) ||
        expiresAt.getTime() <=
          Date.now()
      ) {
        return jsonResponse(
          {
            error:
              "This access code has expired.",
          },
          410
        );
      }
    }

    // ========================================================
    // GET BOOKING
    // ========================================================

    const {
      data: booking,
      error: bookingError,
    } = await supabase
      .from("bookings")
      .select("*")
      .eq(
        "id",
        accessRecord.booking_id
      )
      .maybeSingle();

    if (bookingError) {
      console.error(
        "Booking lookup failed:",
        bookingError
      );

      return jsonResponse(
        {
          error:
            "Unable to retrieve the booking.",
        },
        500
      );
    }

    if (!booking) {
      return jsonResponse(
        {
          error:
            "The booking connected to this code was not found.",
        },
        404
      );
    }

    // ========================================================
    // CHECK BOOKING STATUS
    // ========================================================

    const status =
      String(
        booking.status || ""
      )
        .trim()
        .toLowerCase();

    const blockedStatuses = [
      "cancelled",
      "canceled",
    ];

    if (
      blockedStatuses.includes(
        status
      )
    ) {
      return jsonResponse(
        {
          error:
            "This boarding booking is no longer available.",
        },
        403
      );
    }

    // ========================================================
    // GET PET
    // ========================================================

    let pet = null;

    if (booking.pet_id) {
      const {
        data: petData,
        error: petError,
      } = await supabase
        .from("pets")
        .select("*")
        .eq(
          "id",
          booking.pet_id
        )
        .maybeSingle();

      if (petError) {
        console.error(
          "Pet lookup failed:",
          petError
        );
      } else {
        pet =
          petData;
      }
    }

    // ========================================================
    // GET ROOM
    // ========================================================

    let room = null;

    if (booking.room_id) {
      const {
        data: roomData,
        error: roomError,
      } = await supabase
        .from("rooms")
        .select("*")
        .eq(
          "id",
          booking.room_id
        )
        .maybeSingle();

      if (roomError) {
        console.error(
          "Room lookup failed:",
          roomError
        );
      } else {
        room =
          roomData;
      }
    }

    // ========================================================
    // GET FEEDING SCHEDULES
    // ========================================================

    const {
      data: feedingSchedules,
      error: feedingError,
    } = await supabase
      .from(
        "feeding_schedules"
      )
      .select(`
        id,
        booking_id,
        scheduled_at,
        feeding_method,
        compartment_number,
        portion_grams,
        instructions,
        status
      `)
      .eq(
        "booking_id",
        booking.id
      )
      .order(
        "scheduled_at",
        {
          ascending: true,
        }
      );

    if (feedingError) {
      console.error(
        "Feeding schedules lookup failed:",
        feedingError
      );
    }

    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return jsonResponse(
      {
        success: true,

        access: {
          id:
            accessRecord.id,

          ownerId:
            accessRecord.owner_id,

          invitedEmail:
            accessRecord.invited_email,

          expiresAt:
            accessRecord.expires_at,

          redeemedAt:
            accessRecord.redeemed_at,
        },

        booking,

        pet,

        room,

        feedingSchedules:
          feedingSchedules ?? [],
      },
      200
    );
  } catch (error) {
    console.error(
      "verify-booking-code error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify the access code.",
      },
      500
    );
  }
});

// ============================================================
// SHA-256 HASH
// ============================================================

async function sha256(
  value: string
): Promise<string> {
  const data =
    new TextEncoder().encode(
      value
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(
      digest
    )
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

// ============================================================
// JSON RESPONSE
// ============================================================

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
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