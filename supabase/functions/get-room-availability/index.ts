import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "*",

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
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );
  }

  try {
    // ==========================================================
    // METHOD
    // ==========================================================

    if (req.method !== "POST") {
      return jsonResponse(
        {
          error:
            "Method not allowed.",
        },
        405
      );
    }

    // ==========================================================
    // SUPABASE ADMIN
    // ==========================================================

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

    // ==========================================================
    // BODY
    // ==========================================================

    let body;

    try {
      body =
        await req.json();
    } catch {
      return jsonResponse(
        {
          error:
            "Invalid request.",
        },
        400
      );
    }

    // ==========================================================
    // ACCESS CODE
    // ==========================================================

    const code =
      String(
        body?.code ||
          ""
      )
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z0-9]{8}$/.test(
        code
      )
    ) {
      return jsonResponse(
        {
          error:
            "A valid boarding access code is required.",
        },
        400
      );
    }

    // ==========================================================
    // VERIFY ACCESS CODE
    // ==========================================================

    const codeHash =
      await sha256(
        code
      );

    const {
      data:
        accessRecord,

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
          expires_at
        `)
        .eq(
          "access_code_hash",
          codeHash
        )
        .maybeSingle();

    if (accessError) {
      console.error(
        "Access lookup error:",
        accessError
      );

      return jsonResponse(
        {
          error:
            "Unable to verify boarding access.",
        },
        500
      );
    }

    if (!accessRecord) {
      return jsonResponse(
        {
          error:
            "Invalid boarding access code.",
        },
        404
      );
    }

    // ==========================================================
    // CHECK EXPIRATION
    // ==========================================================

    if (
      accessRecord
        .expires_at
    ) {
      const expiresAt =
        new Date(
          accessRecord
            .expires_at
        );

      if (
        expiresAt.getTime() <=
        Date.now()
      ) {
        return jsonResponse(
          {
            error:
              "This boarding access code has expired.",
          },
          410
        );
      }
    }

    // ==========================================================
    // DATE
    //
    // EXPECT YYYY-MM-DD
    // Example: 2026-08-26
    // ==========================================================

    const dateString =
      String(
        body?.date ||
          ""
      ).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        dateString
      )
    ) {
      return jsonResponse(
        {
          error:
            "Invalid date. Expected YYYY-MM-DD.",
        },
        400
      );
    }

    // ==========================================================
    // PHILIPPINE TIME DAY RANGE
    // ==========================================================

    const dayStart =
      new Date(
        `${dateString}T00:00:00+08:00`
      );

    const nextDay =
      new Date(
        dayStart.getTime() +
          24 *
            60 *
            60 *
            1000
      );

    console.log(
      "ROOM AVAILABILITY REQUEST"
    );

    console.log(
      "Selected date:",
      dateString
    );

    console.log(
      "Day start:",
      dayStart.toISOString()
    );

    console.log(
      "Next day:",
      nextDay.toISOString()
    );

    // ==========================================================
    // GET ROOMS
    // ==========================================================

    const {
      data: rooms,

      error:
        roomsError,
    } =
      await supabase
        .from(
          "rooms"
        )
        .select(`
          id,
          room_number,
          room_name,
          capacity,
          status
        `)
        .order(
          "room_number",
          {
            ascending:
              true,
          }
        );

    if (roomsError) {
      console.error(
        "Rooms error:",
        roomsError
      );

      return jsonResponse(
        {
          error:
            "Unable to retrieve rooms.",
        },
        500
      );
    }

    // ==========================================================
    // GET BOOKINGS THAT OVERLAP SELECTED DATE
    //
    // overlap =
    // check_in < next day
    // AND
    // checkout > day start
    // ==========================================================

    const {
      data: bookings,

      error:
        bookingsError,
    } =
      await supabase
        .from(
          "bookings"
        )
        .select(`
          id,
          booking_code,
          pet_id,
          room_id,
          status,
          check_in_at,
          expected_check_out_at
        `)
        .lt(
          "check_in_at",
          nextDay.toISOString()
        )
        .gt(
          "expected_check_out_at",
          dayStart.toISOString()
        );

    if (bookingsError) {
      console.error(
        "Bookings error:",
        bookingsError
      );

      return jsonResponse(
        {
          error:
            "Unable to retrieve room availability.",
        },
        500
      );
    }

    console.log(
      "Overlapping bookings:",
      bookings ?? []
    );

    // ==========================================================
    // FILTER OUT NON-ACTIVE BOOKINGS
    // ==========================================================

    const activeBookings =
      (
        bookings ??
        []
      ).filter(
        (
          booking
        ) => {
          const status =
            String(
              booking.status ||
                ""
            )
              .trim()
              .toLowerCase();

          return ![
            "cancelled",
            "canceled",
            "expired",
            "rejected",
          ].includes(
            status
          );
        }
      );

    // ==========================================================
    // OCCUPIED ROOM IDS
    // ==========================================================

    const occupiedRoomIds =
      new Set(
        activeBookings
          .map(
            (
              booking
            ) =>
              booking.room_id
          )
          .filter(
            Boolean
          )
      );

    console.log(
      "Occupied room IDs:",
      Array.from(
        occupiedRoomIds
      )
    );

    // ==========================================================
    // BUILD ROOM RESULTS
    // ==========================================================

    const roomResults =
      (
        rooms ??
        []
      ).map(
        (
          room
        ) => {
          const occupied =
            occupiedRoomIds.has(
              room.id
            );

          const status =
            String(
              room.status ||
                "active"
            )
              .trim()
              .toLowerCase();

          return {
            ...room,

            occupied,

            available:
              !occupied &&
              status ===
                "active",
          };
        }
      );

    // ==========================================================
    // SUCCESS
    // ==========================================================

    return jsonResponse(
      {
        success:
          true,

        date:
          dateString,

        rooms:
          roomResults,

        occupiedRoomIds:
          Array.from(
            occupiedRoomIds
          ),
      },
      200
    );
  } catch (error) {
    console.error(
      "get-room-availability error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve room availability.",
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
// JSON RESPONSE
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