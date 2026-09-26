import { createClient } from "@supabase/supabase-js";

/* =========================================================
   CAREFUR CREATE BOOKING EDGE FUNCTION
   - Staff/Admin authentication
   - CORS for localhost + carefur.me
   - Owner / pet creation
   - Room availability
   - Feeding schedules
   - One-time boarding access code
   - SHA-256 access-code hashing
   - Resend email delivery
========================================================= */

const DEFAULT_ALLOWED_ORIGINS = [
  "https://carefur.me",
  "https://www.carefur.me",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const ENV_ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...ENV_ALLOWED_ORIGINS,
]);

/* =========================================================
   ERROR CLASS
========================================================= */

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

/* =========================================================
   CORS
========================================================= */

function isOriginAllowed(request) {
  const origin = request.headers.get("Origin");

  // Server-to-server requests may not have Origin.
  if (!origin) {
    return true;
  }

  return ALLOWED_ORIGINS.has(origin);
}

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  const allowedOrigin =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(request, body, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...getCorsHeaders(request),
        "Content-Type": "application/json",
      },
    },
  );
}

/* =========================================================
   MAIN FUNCTION
========================================================= */

Deno.serve(async (request) => {
  /*
   * IMPORTANT:
   * Handle browser OPTIONS request before authentication
   * and before normal POST processing.
   */
  if (request.method === "OPTIONS") {
    const origin =
      request.headers.get("Origin");

    if (
      origin &&
      !ALLOWED_ORIGINS.has(origin)
    ) {
      return new Response(
        "Origin is not allowed.",
        {
          status: 403,
          headers: getCorsHeaders(request),
        },
      );
    }

    return new Response(
      "ok",
      {
        status: 200,
        headers: getCorsHeaders(request),
      },
    );
  }

  if (!isOriginAllowed(request)) {
    return jsonResponse(
      request,
      {
        success: false,
        error: "Origin is not allowed.",
      },
      403,
    );
  }

  if (request.method !== "POST") {
    return jsonResponse(
      request,
      {
        success: false,
        error: "Method not allowed.",
      },
      405,
    );
  }

  let createdBookingId = null;
  let createdPetId = null;
  let createdOwnerRecordId = null;

  try {
    /* =====================================================
       SUPABASE CLIENT
    ===================================================== */

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new AppError(
        "Supabase environment variables are missing.",
        500,
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    /* =====================================================
       AUTHENTICATE STAFF
    ===================================================== */

    const staffUser =
      await authenticateStaff(
        request,
        adminClient,
      );

    /* =====================================================
       REQUEST BODY
    ===================================================== */

    const body =
      await readRequestBody(request);

    const input =
      validateBookingInput(body);

    /* =====================================================
       ROOM
    ===================================================== */

    const room =
      await validateRoomAvailability(
        adminClient,
        input.roomId,
        input.checkInAt,
        input.expectedCheckOutAt,
      );

    /* =====================================================
       OWNER
    ===================================================== */

    const ownerResult =
      await resolveOwner({
        adminClient,
        existingOwnerId:
          input.existingOwnerId,
        newCustomer:
          input.newCustomer,
      });

    if (
      ownerResult.createdOwnerRecord
    ) {
      createdOwnerRecordId =
        ownerResult.ownerRecord?.id ??
        null;
    }

    let ownerRecord =
      ownerResult.ownerRecord;

    let authenticatedOwner =
      ownerResult.authenticatedOwner;

    /* =====================================================
       PET
    ===================================================== */

    let pet;

    if (input.existingPetId) {
      pet =
        await getExistingPet(
          adminClient,
          input.existingPetId,
        );
    } else {
      pet =
        await createPet({
          adminClient,
          petData:
            input.newCustomer?.pet,
          createdBy:
            staffUser.id,
        });

      createdPetId = pet.id;
    }

    /*
     * Existing pet:
     * get the owner from pet_owner_links if needed.
     */
    if (
      !ownerRecord &&
      input.existingPetId
    ) {
      ownerRecord =
        await findPetOwnerRecord(
          adminClient,
          pet.id,
        );
    }

    /*
     * Match public.users owner account by email if
     * an owner has already registered in SnugglesApp.
     */
    if (
      !authenticatedOwner &&
      ownerRecord?.email
    ) {
      authenticatedOwner =
        await findAuthenticatedOwnerByEmail(
          adminClient,
          ownerRecord.email,
        );
    }

    /*
     * IMPORTANT:
     *
     * pet_owner_links.owner_id -> public.owners.id
     *
     * booking_access.owner_id -> public.users.id
     *
     * These are two different identities.
     */
    if (
      createdPetId &&
      ownerRecord?.id
    ) {
      await createPetOwnerLink({
        adminClient,
        petId: pet.id,
        ownerId: ownerRecord.id,
      });
    }

    /* =====================================================
       OWNER EMAIL
    ===================================================== */

    const invitedEmail =
      normalizeEmail(
        ownerRecord?.email ??
          authenticatedOwner?.email ??
          input.newCustomer?.owner?.email,
      );

    if (!invitedEmail) {
      throw new AppError(
        "The pet owner must have an email address before an access invitation can be created.",
        400,
      );
    }

    /* =====================================================
       CREATE BOOKING
    ===================================================== */

    const booking =
      await createBookingRecord({
        adminClient,
        petId:
          pet.id,
        roomId:
          room.id,
        checkInAt:
          input.checkInAt,
        expectedCheckOutAt:
          input.expectedCheckOutAt,
        specialInstructions:
          input.specialInstructions,
        createdBy:
          staffUser.id,
      });

    createdBookingId =
      booking.id;

    /* =====================================================
       FEEDING SCHEDULE
    ===================================================== */

    const feedingRows =
      buildFeedingScheduleRows({
        bookingId:
          booking.id,
        checkInAt:
          input.checkInAt,
        expectedCheckOutAt:
          input.expectedCheckOutAt,
        feeding:
          input.feeding,
        timeZone:
          input.timeZone,
        createdBy:
          staffUser.id,
      });

    if (
      feedingRows.length === 0
    ) {
      throw new AppError(
        "None of the selected feeding times fall within the boarding dates.",
        400,
      );
    }

    const feedingSchedules =
      await createFeedingSchedules(
        adminClient,
        feedingRows,
      );

    /* =====================================================
       ACCESS CODE
    ===================================================== */

    const accessCode =
      generateAccessCode();

    const accessCodeHash =
      await hashAccessCode(
        accessCode,
      );

    const expiresAt =
      calculateAccessExpiration(
        input.expectedCheckOutAt,
      );

    const accessRecord =
      await createBookingAccess({
        adminClient,
        bookingId:
          booking.id,

        /*
         * public.users.id only.
         * Null is okay if owner has not registered yet.
         */
        ownerId:
          authenticatedOwner?.id ??
          null,

        invitedEmail,
        accessCodeHash,
        expiresAt,
        createdBy:
          staffUser.id,
      });

    /* =====================================================
       SEND CAREFUR EMAIL
    ===================================================== */

    let emailResult = {
      sent: false,
      id: null,
      error: null,
    };

    try {
      const result =
        await sendBoardingAccessEmail({
          to:
            invitedEmail,

          ownerName:
            ownerRecord?.full_name ??
            authenticatedOwner?.full_name ??
            "Pet Owner",

          petName:
            pet.name,

          bookingCode:
            booking.booking_code,

          accessCode,

          roomName:
            room.room_name ||
            room.room_number,

          checkInAt:
            booking.check_in_at,

          expectedCheckOutAt:
            booking.expected_check_out_at,

          expiresAt:
            accessRecord.expires_at,
        });

      emailResult = {
        sent: true,
        id:
          result?.id ??
          null,
        error: null,
      };
    } catch (emailError) {
      /*
       * DO NOT delete booking if the email provider fails.
       * The boarding itself is valid.
       */
      console.error(
        "Booking created but access email failed:",
        emailError,
      );

      emailResult = {
        sent: false,
        id: null,
        error:
          emailError instanceof Error
            ? emailError.message
            : "Unable to send access email.",
      };
    }

    /* =====================================================
       SUCCESS RESPONSE
    ===================================================== */

    return jsonResponse(
      request,
      {
        success: true,

        message:
          emailResult.sent
            ? "Booking created successfully. Owner access email sent."
            : "Booking created successfully, but owner access email could not be sent.",

        booking,

        pet,

        owner:
          ownerRecord,

        room,

        feedingScheduleCount:
          feedingSchedules.length,

        access: {
          id:
            accessRecord.id,

          /*
           * Returned only to authenticated staff.
           * Database stores only the hash.
           */
          code:
            accessCode,

          invitedEmail:
            accessRecord.invited_email,

          expiresAt:
            accessRecord.expires_at,

          redeemedAt:
            accessRecord.redeemed_at,
        },

        email:
          emailResult,
      },
      201,
    );
  } catch (error) {
    console.error(
      "create-booking failed:",
      error,
    );

    /* =====================================================
       CLEAN UP PARTIAL BOOKING
    ===================================================== */

    try {
      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      if (
        supabaseUrl &&
        serviceRoleKey
      ) {
        const cleanupClient =
          createClient(
            supabaseUrl,
            serviceRoleKey,
            {
              auth: {
                autoRefreshToken:
                  false,
                persistSession:
                  false,
              },
            },
          );

        if (createdBookingId) {
          await cleanupClient
            .from("bookings")
            .delete()
            .eq(
              "id",
              createdBookingId,
            );
        }

        if (createdPetId) {
          await cleanupClient
            .from("pets")
            .delete()
            .eq(
              "id",
              createdPetId,
            );
        }

        if (
          createdOwnerRecordId
        ) {
          await cleanupClient
            .from("owners")
            .delete()
            .eq(
              "id",
              createdOwnerRecordId,
            );
        }
      }
    } catch (cleanupError) {
      console.error(
        "Booking cleanup failed:",
        cleanupError,
      );
    }

    const status =
      error instanceof AppError
        ? error.status
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create booking.";

    return jsonResponse(
      request,
      {
        success: false,
        error: message,
      },
      status,
    );
  }
});

/* =========================================================
   AUTHENTICATION
========================================================= */

async function authenticateStaff(
  request,
  adminClient,
) {
  const authorization =
    request.headers.get(
      "Authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    throw new AppError(
      "You must be signed in.",
      401,
    );
  }

  const token =
    authorization.slice(7);

  const {
    data: authData,
    error: authError,
  } =
    await adminClient.auth.getUser(
      token,
    );

  if (
    authError ||
    !authData.user
  ) {
    throw new AppError(
      "Your session is invalid or has expired.",
      401,
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await adminClient
    .from("users")
    .select(
      "id, full_name, email, role",
    )
    .eq(
      "id",
      authData.user.id,
    )
    .single();

  if (
    profileError ||
    !profile
  ) {
    throw new AppError(
      "Staff profile not found.",
      403,
    );
  }

  if (
    ![
      "admin",
      "staff",
    ].includes(
      profile.role,
    )
  ) {
    throw new AppError(
      "Only staff members can create bookings.",
      403,
    );
  }

  return profile;
}

/* =========================================================
   REQUEST BODY
========================================================= */

async function readRequestBody(
  request,
) {
  try {
    return await request.json();
  } catch {
    throw new AppError(
      "The request body must be valid JSON.",
      400,
    );
  }
}

/* =========================================================
   INPUT VALIDATION
========================================================= */

function validateBookingInput(
  body,
) {
  const checkInAt =
    parseDate(
      body?.checkInAt,
      "Check-in date",
    );

  const expectedCheckOutAt =
    parseDate(
      body?.expectedCheckOutAt,
      "Check-out date",
    );

  if (
    expectedCheckOutAt <=
    checkInAt
  ) {
    throw new AppError(
      "Check-out must be after check-in.",
      400,
    );
  }

  const roomId =
    cleanString(
      body?.roomId,
    );

  if (!roomId) {
    throw new AppError(
      "A room must be selected.",
      400,
    );
  }

  const existingPetId =
    cleanString(
      body?.existingPetId,
    );

  const newCustomer =
    body?.newCustomer ??
    null;

  if (
    !existingPetId &&
    !newCustomer?.pet
  ) {
    throw new AppError(
      "Select an existing pet or enter a new pet.",
      400,
    );
  }

  const feeding =
    validateFeeding(
      body?.feeding,
    );

  return {
    checkInAt,

    expectedCheckOutAt,

    roomId,

    existingPetId,

    existingOwnerId:
      cleanString(
        body?.existingOwnerId,
      ),

    newCustomer,

    feeding,

    timeZone:
      validateTimeZone(
        body?.timeZone ??
          "Asia/Manila",
      ),

    specialInstructions:
      cleanString(
        body?.specialInstructions,
      ) ??
      null,
  };
}

/* =========================================================
   FEEDING VALIDATION
========================================================= */

function validateFeeding(
  feeding,
) {
  const method =
    cleanString(
      feeding?.method,
    );

  if (
    ![
      "manual",
      "automatic",
    ].includes(
      method,
    )
  ) {
    throw new AppError(
      "Invalid feeding method.",
      400,
    );
  }

  const schedules =
    feeding?.schedules;

  if (
    !Array.isArray(
      schedules,
    ) ||
    schedules.length === 0
  ) {
    throw new AppError(
      "At least one feeding schedule is required.",
      400,
    );
  }

  const validatedSchedules =
    schedules.map(
      (
        schedule,
        index,
      ) => {
        const time =
          cleanString(
            schedule?.time,
          );

        const instructions =
          cleanString(
            schedule?.instructions,
          );

        const period =
          cleanString(
            schedule?.period,
          ) ??
          `schedule ${index + 1}`;

        if (
          !time ||
          !isValidTime(
            time,
          )
        ) {
          throw new AppError(
            `Invalid feeding time for ${period}.`,
            400,
          );
        }

        if (!instructions) {
          throw new AppError(
            `Feeding instructions are required for ${period}.`,
            400,
          );
        }

        let compartmentNumber =
          null;

        let portionGrams =
          null;

        if (
          method ===
          "automatic"
        ) {
          compartmentNumber =
            Number(
              schedule
                ?.compartmentNumber ??
                schedule
                  ?.compartment,
            );

          portionGrams =
            Number(
              schedule
                ?.portionGrams ??
                schedule
                  ?.portion,
            );

          if (
            !Number.isInteger(
              compartmentNumber,
            ) ||
            compartmentNumber < 1 ||
            compartmentNumber > 3
          ) {
            throw new AppError(
              `Invalid feeder compartment for ${period}.`,
              400,
            );
          }

          if (
            !Number.isFinite(
              portionGrams,
            ) ||
            portionGrams <= 0
          ) {
            throw new AppError(
              `Invalid food portion for ${period}.`,
              400,
            );
          }
        }

        return {
          period,
          time,
          instructions,
          compartmentNumber,
          portionGrams,
        };
      },
    );

  return {
    method,
    schedules:
      validatedSchedules,
  };
}

/* =========================================================
   ROOM AVAILABILITY
========================================================= */

async function validateRoomAvailability(
  adminClient,
  roomId,
  checkInAt,
  expectedCheckOutAt,
) {
  const {
    data: room,
    error: roomError,
  } = await adminClient
    .from("rooms")
    .select(
      "id, room_number, room_name, status",
    )
    .eq(
      "id",
      roomId,
    )
    .single();

  if (
    roomError ||
    !room
  ) {
    throw new AppError(
      "The selected room was not found.",
      404,
    );
  }

  if (
    room.status !==
    "active"
  ) {
    throw new AppError(
      "The selected room is not active.",
      409,
    );
  }

  const {
    data: conflicts,
    error: conflictError,
  } = await adminClient
    .from("bookings")
    .select(
      "id, booking_code",
    )
    .eq(
      "room_id",
      roomId,
    )
    .in(
      "status",
      [
        "pending",
        "checked_in",
      ],
    )
    .lt(
      "check_in_at",
      expectedCheckOutAt.toISOString(),
    )
    .gt(
      "expected_check_out_at",
      checkInAt.toISOString(),
    )
    .limit(1);

  if (conflictError) {
    throw new AppError(
      `Unable to check room availability: ${conflictError.message}`,
      500,
    );
  }

  if (
    Array.isArray(
      conflicts,
    ) &&
    conflicts.length > 0
  ) {
    throw new AppError(
      "The selected room already has an overlapping booking.",
      409,
    );
  }

  return room;
}

/* =========================================================
   OWNER
========================================================= */

async function resolveOwner({
  adminClient,
  existingOwnerId,
  newCustomer,
}) {
  let authenticatedOwner =
    null;

  let ownerRecord =
    null;

  let createdOwnerRecord =
    false;

  const ownerInput =
    newCustomer?.owner ??
    {};

  const candidateOwnerId =
    existingOwnerId ??
    cleanString(
      ownerInput.id,
    );

  /*
   * existingOwnerId should normally be public.owners.id
   */
  if (candidateOwnerId) {
    const {
      data,
      error,
    } = await adminClient
      .from("owners")
      .select(
        "id, full_name, email, phone, notes",
      )
      .eq(
        "id",
        candidateOwnerId,
      )
      .maybeSingle();

    if (error) {
      throw new AppError(
        `Unable to read the owner record: ${error.message}`,
        500,
      );
    }

    ownerRecord = data;

    /*
     * Backward compatibility:
     * older frontend may send public.users.id.
     */
    if (!ownerRecord) {
      const {
        data: userOwner,
        error: userError,
      } = await adminClient
        .from("users")
        .select(
          "id, full_name, email, phone, role",
        )
        .eq(
          "id",
          candidateOwnerId,
        )
        .eq(
          "role",
          "owner",
        )
        .maybeSingle();

      if (userError) {
        throw new AppError(
          `Unable to check the owner account: ${userError.message}`,
          500,
        );
      }

      authenticatedOwner =
        userOwner;
    }
  }

  const email =
    normalizeEmail(
      ownerRecord?.email ??
        authenticatedOwner?.email ??
        ownerInput.email,
    );

  /*
   * Find owners record by email.
   */
  if (
    !ownerRecord &&
    email
  ) {
    const {
      data,
      error,
    } = await adminClient
      .from("owners")
      .select(
        "id, full_name, email, phone, notes",
      )
      .ilike(
        "email",
        escapeLike(
          email,
        ),
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(
        `Unable to check existing owner records: ${error.message}`,
        500,
      );
    }

    ownerRecord =
      data;
  }

  /*
   * Find authenticated Snuggles account.
   */
  if (
    !authenticatedOwner &&
    email
  ) {
    authenticatedOwner =
      await findAuthenticatedOwnerByEmail(
        adminClient,
        email,
      );
  }

  /*
   * Create new owners record when necessary.
   */
  if (
    newCustomer?.isNewOwner &&
    !ownerRecord
  ) {
    const fullName =
      cleanString(
        ownerInput.full_name ??
          ownerInput.fullName ??
          ownerInput.name,
      );

    if (!fullName) {
      throw new AppError(
        "The owner's full name is required.",
        400,
      );
    }

    if (!email) {
      throw new AppError(
        "The owner's email is required.",
        400,
      );
    }

    const {
      data: insertedOwner,
      error:
        insertOwnerError,
    } = await adminClient
      .from("owners")
      .insert({
        full_name:
          fullName,

        email,

        phone:
          cleanString(
            ownerInput.phone,
          ) ??
          null,

        notes:
          cleanString(
            ownerInput.notes,
          ) ??
          null,
      })
      .select(
        "id, full_name, email, phone, notes",
      )
      .single();

    if (
      insertOwnerError
    ) {
      throw new AppError(
        `Unable to create the owner record: ${insertOwnerError.message}`,
        500,
      );
    }

    ownerRecord =
      insertedOwner;

    createdOwnerRecord =
      true;
  }

  return {
    authenticatedOwner,
    ownerRecord,
    createdOwnerRecord,
  };
}

/* =========================================================
   FIND AUTHENTICATED OWNER
========================================================= */

async function findAuthenticatedOwnerByEmail(
  adminClient,
  emailValue,
) {
  const email =
    normalizeEmail(
      emailValue,
    );

  if (!email) {
    return null;
  }

  const {
    data,
    error,
  } = await adminClient
    .from("users")
    .select(
      "id, full_name, email, phone, role",
    )
    .ilike(
      "email",
      escapeLike(
        email,
      ),
    )
    .eq(
      "role",
      "owner",
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(
      `Unable to match the owner account: ${error.message}`,
      500,
    );
  }

  return data;
}

/* =========================================================
   PET
========================================================= */

async function getExistingPet(
  adminClient,
  petId,
) {
  const {
    data: pet,
    error,
  } = await adminClient
    .from("pets")
    .select("*")
    .eq(
      "id",
      petId,
    )
    .single();

  if (
    error ||
    !pet
  ) {
    throw new AppError(
      "The selected pet was not found.",
      404,
    );
  }

  return pet;
}

/* =========================================================
   CREATE PET
========================================================= */

async function createPet({
  adminClient,
  petData,
  createdBy,
}) {
  const name =
    cleanString(
      petData?.name ??
        petData?.petName,
    );

  const species =
    cleanString(
      petData?.species,
    );

  if (!name) {
    throw new AppError(
      "The pet's name is required.",
      400,
    );
  }

  if (!species) {
    throw new AppError(
      "The pet's species is required.",
      400,
    );
  }

  const sex =
    normalizeSex(
      petData?.sex,
    );

  const weightKg =
    parseOptionalPositiveNumber(
      petData?.weight_kg ??
        petData?.weightKg ??
        petData?.weight,
      "Pet weight",
    );

  const {
    data: pet,
    error,
  } = await adminClient
    .from("pets")
    .insert({
      name,

      species,

      breed:
        cleanString(
          petData?.breed,
        ) ??
        null,

      sex,

      birth_date:
        cleanString(
          petData?.birth_date ??
            petData?.birthDate,
        ) ??
        null,

      weight_kg:
        weightKg,

      allergies:
        cleanString(
          petData?.allergies,
        ) ??
        null,

      medical_notes:
        cleanString(
          petData?.medical_notes ??
            petData?.medicalNotes,
        ) ??
        null,

      feeding_notes:
        cleanString(
          petData?.feeding_notes ??
            petData?.feedingNotes,
        ) ??
        null,

      photo_url:
        cleanString(
          petData?.photo_url ??
            petData?.photoUrl,
        ) ??
        null,

      created_by:
        createdBy,
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(
      `Unable to create the pet: ${error.message}`,
      500,
    );
  }

  return pet;
}

/* =========================================================
   FIND PET OWNER
========================================================= */

async function findPetOwnerRecord(
  adminClient,
  petId,
) {
  const {
    data: links,
    error: linkError,
  } = await adminClient
    .from("pet_owner_links")
    .select(
      "owner_id, is_primary",
    )
    .eq(
      "pet_id",
      petId,
    )
    .order(
      "is_primary",
      {
        ascending:
          false,
      },
    )
    .limit(1);

  if (linkError) {
    throw new AppError(
      `Unable to find the pet owner: ${linkError.message}`,
      500,
    );
  }

  const ownerId =
    links?.[0]
      ?.owner_id;

  if (!ownerId) {
    return null;
  }

  const {
    data: owner,
    error: ownerError,
  } = await adminClient
    .from("owners")
    .select(
      "id, full_name, email, phone, notes",
    )
    .eq(
      "id",
      ownerId,
    )
    .maybeSingle();

  if (ownerError) {
    throw new AppError(
      `Unable to read the owner record: ${ownerError.message}`,
      500,
    );
  }

  return owner;
}

/* =========================================================
   CREATE PET OWNER LINK
========================================================= */

async function createPetOwnerLink({
  adminClient,
  petId,
  ownerId,
}) {
  const {
    data: existingLinks,
    error: lookupError,
  } = await adminClient
    .from("pet_owner_links")
    .select(
      "id, pet_id, owner_id, is_primary",
    )
    .eq(
      "pet_id",
      petId,
    )
    .eq(
      "owner_id",
      ownerId,
    )
    .limit(1);

  if (lookupError) {
    throw new AppError(
      `Unable to check the pet owner link: ${lookupError.message}`,
      500,
    );
  }

  if (
    existingLinks?.length
  ) {
    return existingLinks[0];
  }

  const {
    data,
    error,
  } = await adminClient
    .from("pet_owner_links")
    .insert({
      pet_id:
        petId,

      owner_id:
        ownerId,

      relationship:
        "owner",

      is_primary:
        true,
    })
    .select(
      "id, pet_id, owner_id, is_primary",
    )
    .single();

  if (error) {
    throw new AppError(
      `Unable to link the owner to the pet: ${error.message}`,
      500,
    );
  }

  return data;
}

/* =========================================================
   CREATE BOOKING
========================================================= */

async function createBookingRecord({
  adminClient,
  petId,
  roomId,
  checkInAt,
  expectedCheckOutAt,
  specialInstructions,
  createdBy,
}) {
  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const bookingCode =
      generateBookingCode();

    const {
      data: booking,
      error,
    } = await adminClient
      .from("bookings")
      .insert({
        booking_code:
          bookingCode,

        pet_id:
          petId,

        room_id:
          roomId,

        check_in_at:
          checkInAt.toISOString(),

        expected_check_out_at:
          expectedCheckOutAt.toISOString(),

        status:
          "pending",

        special_instructions:
          specialInstructions,

        created_by:
          createdBy,
      })
      .select("*")
      .single();

    if (!error) {
      return booking;
    }

    /*
     * Retry only when booking_code collided.
     */
    if (
      error.code !==
      "23505"
    ) {
      throw new AppError(
        `Unable to create the booking: ${error.message}`,
        500,
      );
    }
  }

  throw new AppError(
    "Unable to generate a unique booking code.",
    500,
  );
}

/* =========================================================
   BUILD FEEDING SCHEDULES
========================================================= */

function buildFeedingScheduleRows({
  bookingId,
  checkInAt,
  expectedCheckOutAt,
  feeding,
  timeZone,
  createdBy,
}) {
  const rows = [];

  let dateKey =
    getDateKeyInTimeZone(
      checkInAt,
      timeZone,
    );

  const finalDateKey =
    getDateKeyInTimeZone(
      expectedCheckOutAt,
      timeZone,
    );

  while (
    dateKey <=
    finalDateKey
  ) {
    for (
      const schedule
      of feeding.schedules
    ) {
      const scheduledAt =
        zonedDateTimeToUtc(
          dateKey,
          schedule.time,
          timeZone,
        );

      if (
        scheduledAt >=
          checkInAt &&
        scheduledAt <
          expectedCheckOutAt
      ) {
        rows.push({
          booking_id:
            bookingId,

          scheduled_at:
            scheduledAt.toISOString(),

          feeding_method:
            feeding.method,

          compartment_number:
            feeding.method ===
            "automatic"
              ? schedule
                  .compartmentNumber
              : null,

          portion_grams:
            feeding.method ===
            "automatic"
              ? schedule
                  .portionGrams
              : null,

          instructions:
            schedule.instructions,

          status:
            "pending",

          created_by:
            createdBy,
        });
      }
    }

    dateKey =
      addDaysToDateKey(
        dateKey,
        1,
      );
  }

  return rows;
}

/* =========================================================
   INSERT FEEDING SCHEDULES
========================================================= */

async function createFeedingSchedules(
  adminClient,
  rows,
) {
  const {
    data,
    error,
  } = await adminClient
    .from(
      "feeding_schedules",
    )
    .insert(
      rows,
    )
    .select("*");

  if (error) {
    throw new AppError(
      `Unable to create feeding schedules: ${error.message}`,
      500,
    );
  }

  return data ?? [];
}

/* =========================================================
   CREATE BOOKING ACCESS
========================================================= */

async function createBookingAccess({
  adminClient,
  bookingId,
  ownerId,
  invitedEmail,
  accessCodeHash,
  expiresAt,
  createdBy,
}) {
  const {
    data,
    error,
  } = await adminClient
    .from(
      "booking_access",
    )
    .insert({
      booking_id:
        bookingId,

      owner_id:
        ownerId,

      invited_email:
        invitedEmail,

      access_code_hash:
        accessCodeHash,

      expires_at:
        expiresAt.toISOString(),

      created_by:
        createdBy,
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(
      `Unable to create the owner invitation: ${error.message}`,
      500,
    );
  }

  return data;
}

/* =========================================================
   RESEND EMAIL
========================================================= */

async function sendBoardingAccessEmail({
  to,
  ownerName,
  petName,
  bookingCode,
  accessCode,
  roomName,
  checkInAt,
  expectedCheckOutAt,
  expiresAt,
}) {
  const resendApiKey =
    Deno.env.get(
      "RESEND_API_KEY",
    );

  const from =
    Deno.env.get(
      "CAREFUR_EMAIL_FROM",
    ) ??
    "CareFur <noreply@carefur.me>";

  if (!resendApiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured.",
    );
  }

  if (!to) {
    throw new Error(
      "Owner email address is missing.",
    );
  }

  const safeOwnerName =
    escapeHtml(
      ownerName ??
        "Pet Owner",
    );

  const safePetName =
    escapeHtml(
      petName ??
        "your pet",
    );

  const safeBookingCode =
    escapeHtml(
      bookingCode,
    );

  const safeAccessCode =
    escapeHtml(
      accessCode,
    );

  const safeRoom =
    escapeHtml(
      roomName ??
        "Assigned room",
    );

  const safeCheckIn =
    escapeHtml(
      formatPhilippineDateTime(
        checkInAt,
      ),
    );

  const safeCheckout =
    escapeHtml(
      formatPhilippineDateTime(
        expectedCheckOutAt,
      ),
    );

  const safeExpiration =
    escapeHtml(
      formatPhilippineDateTime(
        expiresAt,
      ),
    );

  const subject =
    `CareFur boarding access for ${petName}`;

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#fffdf8;
    font-family:Arial,Helvetica,sans-serif;
    color:#163f43;
  "
>
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="
      width:100%;
      background:#fffdf8;
      padding:36px 14px;
    "
  >
    <tr>
      <td align="center">

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="
            width:100%;
            max-width:620px;
            background:#ffffff;
            border:1px solid #dbe7e5;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <tr>
            <td
              align="center"
              style="
                background:#14646b;
                padding:30px 30px;
              "
            >

              <div
                style="
                  font-size:28px;
                  font-weight:800;
                  color:#ffffff;
                "
              >
                CareFur
              </div>

              <div
                style="
                  margin-top:6px;
                  font-size:13px;
                  color:#d8e7e6;
                "
              >
                Snuggles Premium Pet Hotel
              </div>

            </td>
          </tr>

          <tr>
            <td
              style="
                padding:34px 32px;
              "
            >

              <div
                style="
                  font-size:23px;
                  font-weight:800;
                  color:#163f43;
                "
              >
                Boarding access is ready
              </div>

              <p
                style="
                  margin:18px 0 0;
                  font-size:15px;
                  line-height:1.7;
                  color:#536d6f;
                "
              >
                Hello ${safeOwnerName},
              </p>

              <p
                style="
                  margin:8px 0 0;
                  font-size:15px;
                  line-height:1.7;
                  color:#536d6f;
                "
              >
                ${safePetName}'s boarding stay has been
                registered with Snuggles Premium Pet Hotel.
              </p>

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="
                  width:100%;
                  margin-top:24px;
                  background:#f7f9f5;
                  border-radius:13px;
                "
              >

                <tr>
                  <td
                    style="
                      padding:18px 18px 6px;
                      font-size:14px;
                      color:#617475;
                    "
                  >
                    Booking
                  </td>

                  <td
                    align="right"
                    style="
                      padding:18px 18px 6px;
                      font-size:14px;
                      font-weight:700;
                      color:#163f43;
                    "
                  >
                    ${safeBookingCode}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:6px 18px;
                      font-size:14px;
                      color:#617475;
                    "
                  >
                    Pet
                  </td>

                  <td
                    align="right"
                    style="
                      padding:6px 18px;
                      font-size:14px;
                      font-weight:700;
                      color:#163f43;
                    "
                  >
                    ${safePetName}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:6px 18px;
                      font-size:14px;
                      color:#617475;
                    "
                  >
                    Room
                  </td>

                  <td
                    align="right"
                    style="
                      padding:6px 18px;
                      font-size:14px;
                      font-weight:700;
                      color:#163f43;
                    "
                  >
                    ${safeRoom}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:6px 18px;
                      font-size:14px;
                      color:#617475;
                    "
                  >
                    Check-in
                  </td>

                  <td
                    align="right"
                    style="
                      padding:6px 18px;
                      font-size:14px;
                      font-weight:700;
                      color:#163f43;
                    "
                  >
                    ${safeCheckIn}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:6px 18px 18px;
                      font-size:14px;
                      color:#617475;
                    "
                  >
                    Expected checkout
                  </td>

                  <td
                    align="right"
                    style="
                      padding:6px 18px 18px;
                      font-size:14px;
                      font-weight:700;
                      color:#163f43;
                    "
                  >
                    ${safeCheckout}
                  </td>
                </tr>

              </table>

              <div
                style="
                  margin-top:26px;
                  padding:25px 20px;
                  background:#f3f0d4;
                  border-radius:14px;
                  text-align:center;
                "
              >

                <div
                  style="
                    font-size:12px;
                    font-weight:700;
                    color:#6d754a;
                    letter-spacing:1.3px;
                    text-transform:uppercase;
                  "
                >
                  Your boarding access code
                </div>

                <div
                  style="
                    margin-top:12px;
                    font-size:31px;
                    font-weight:800;
                    color:#14646b;
                    letter-spacing:4px;
                  "
                >
                  ${safeAccessCode}
                </div>

              </div>

              <p
                style="
                  margin:24px 0 0;
                  font-size:14px;
                  line-height:1.7;
                  color:#617475;
                "
              >
                Open the Snuggles app and select
                <strong>Enter Boarding Code</strong>.
                Enter the code above to connect this boarding
                stay to your account.
              </p>

              <p
                style="
                  margin:12px 0 0;
                  font-size:14px;
                  line-height:1.7;
                  color:#617475;
                "
              >
                This access code can only be redeemed
                <strong>once</strong>.
              </p>

              <p
                style="
                  margin:12px 0 0;
                  font-size:14px;
                  line-height:1.7;
                  color:#617475;
                "
              >
                Once redeemed, you may log out and sign in
                again later using the same Snuggles account.
                You will not need to enter this code again.
              </p>

              <p
                style="
                  margin:12px 0 0;
                  font-size:13px;
                  line-height:1.7;
                  color:#829092;
                "
              >
                Access code expiration:
                <strong>
                  ${safeExpiration}
                </strong>
              </p>

              <div
                style="
                  height:1px;
                  margin:28px 0 20px;
                  background:#e5ecea;
                "
              ></div>

              <p
                style="
                  margin:0;
                  font-size:12px;
                  line-height:1.6;
                  color:#8a999a;
                  text-align:center;
                "
              >
                For your security, do not share your boarding
                access code with anyone else.
              </p>

            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                border-top:1px solid #e6ecea;
                padding:21px 26px;
                background:#fbfcfa;
                font-size:12px;
                line-height:1.6;
                color:#829092;
              "
            >
              This is an automated message from CareFur
              <br>
              Snuggles Premium Pet Hotel
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;

  const plainText = `
CareFur
Snuggles Premium Pet Hotel

Hello ${ownerName ?? "Pet Owner"},

${petName}'s boarding stay has been registered.

Booking: ${bookingCode}
Pet: ${petName}
Room: ${roomName}
Check-in: ${formatPhilippineDateTime(checkInAt)}
Expected checkout: ${formatPhilippineDateTime(expectedCheckOutAt)}

YOUR BOARDING ACCESS CODE

${accessCode}

Open the Snuggles app and select "Enter Boarding Code".

This access code can only be redeemed once.

Once redeemed, you may log out and sign back in later using the same account without entering the code again.

Access code expiration:
${formatPhilippineDateTime(expiresAt)}

For your security, do not share this code.

CareFur
Snuggles Premium Pet Hotel
`.trim();

  const response =
    await fetch(
      "https://api.resend.com/emails",
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${resendApiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            from,

            to: [
              to,
            ],

            subject,

            html,

            text:
              plainText,
          }),
      },
    );

  let result = null;

  try {
    result =
      await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    console.error(
      "Resend API error:",
      result,
    );

    throw new Error(
      result?.message ??
        result?.error ??
        `Resend returned HTTP ${response.status}.`,
    );
  }

  return result ?? {};
}

/* =========================================================
   BOOKING CODE
========================================================= */

function generateBookingCode() {
  const now =
    new Date();

  const datePart =
    [
      now.getUTCFullYear(),

      String(
        now.getUTCMonth() +
          1,
      ).padStart(
        2,
        "0",
      ),

      String(
        now.getUTCDate(),
      ).padStart(
        2,
        "0",
      ),
    ].join("");

  const randomPart =
    generateRandomString(
      6,
    );

  return (
    `CF-${datePart}-${randomPart}`
  );
}

/* =========================================================
   ACCESS CODE
========================================================= */

function generateAccessCode() {
  return generateRandomString(
    8,
  );
}

function generateRandomString(
  length,
) {
  /*
   * Avoid ambiguous:
   * O / 0
   * I / 1
   */
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const randomValues =
    new Uint32Array(
      length,
    );

  crypto.getRandomValues(
    randomValues,
  );

  return Array.from(
    randomValues,
    (value) =>
      characters[
        value %
          characters.length
      ],
  ).join("");
}

/* =========================================================
   HASH ACCESS CODE
========================================================= */

async function hashAccessCode(
  accessCode,
) {
  const encoded =
    new TextEncoder().encode(
      accessCode,
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded,
    );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0",
          ),
    )
    .join("");
}

/* =========================================================
   ACCESS EXPIRATION
========================================================= */

function calculateAccessExpiration(
  expectedCheckOutAt,
) {
  const checkout =
    new Date(
      expectedCheckOutAt,
    );

  /*
   * Expire 24 hours after scheduled checkout.
   */
  const expiration =
    new Date(
      checkout.getTime() +
        24 *
          60 *
          60 *
          1000,
    );

  /*
   * Never expire sooner than 24h after creation.
   */
  const minimumExpiration =
    new Date(
      Date.now() +
        24 *
          60 *
          60 *
          1000,
    );

  return (
    expiration >
    minimumExpiration
      ? expiration
      : minimumExpiration
  );
}

/* =========================================================
   DATE PARSING
========================================================= */

function parseDate(
  value,
  label,
) {
  const date =
    new Date(
      value,
    );

  if (
    !value ||
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new AppError(
      `${label} is invalid.`,
      400,
    );
  }

  return date;
}

/* =========================================================
   STRINGS
========================================================= */

function cleanString(
  value,
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return (
    cleaned ||
    null
  );
}

function normalizeEmail(
  value,
) {
  const email =
    cleanString(
      value,
    );

  return email
    ? email.toLowerCase()
    : null;
}

/* =========================================================
   SEX
========================================================= */

function normalizeSex(
  value,
) {
  const sex =
    cleanString(
      value,
    )
      ?.toLowerCase();

  if (!sex) {
    return null;
  }

  if (
    [
      "male",
      "female",
      "unknown",
    ].includes(
      sex,
    )
  ) {
    return sex;
  }

  return "unknown";
}

/* =========================================================
   POSITIVE NUMBER
========================================================= */

function parseOptionalPositiveNumber(
  value,
  label,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    ) ||
    number <= 0
  ) {
    throw new AppError(
      `${label} must be greater than zero.`,
      400,
    );
  }

  return number;
}

/* =========================================================
   VALID TIME
========================================================= */

function isValidTime(
  value,
) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    value,
  );
}

/* =========================================================
   TIME ZONE
========================================================= */

function validateTimeZone(
  value,
) {
  const timeZone =
    cleanString(
      value,
    ) ??
    "Asia/Manila";

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
      },
    ).format(
      new Date(),
    );

    return timeZone;
  } catch {
    return "Asia/Manila";
  }
}

/* =========================================================
   FORMAT PHILIPPINE DATE
========================================================= */

function formatPhilippineDateTime(
  value,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        "Asia/Manila",

      year:
        "numeric",

      month:
        "long",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      hour12:
        true,
    },
  ).format(
    date,
  );
}

/* =========================================================
   DATE KEY IN TIME ZONE
========================================================= */

function getDateKeyInTimeZone(
  date,
  timeZone,
) {
  const parts =
    getZonedParts(
      date,
      timeZone,
    );

  return [
    parts.year,

    String(
      parts.month,
    ).padStart(
      2,
      "0",
    ),

    String(
      parts.day,
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

/* =========================================================
   ADD DAYS
========================================================= */

function addDaysToDateKey(
  dateKey,
  amount,
) {
  const [
    year,
    month,
    day,
  ] = dateKey
    .split("-")
    .map(
      Number,
    );

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + amount,
      ),
    );

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      "0",
    ),

    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

/* =========================================================
   LOCAL ZONED DATETIME -> UTC
========================================================= */

function zonedDateTimeToUtc(
  dateKey,
  time,
  timeZone,
) {
  const [
    year,
    month,
    day,
  ] = dateKey
    .split("-")
    .map(
      Number,
    );

  const [
    hour,
    minute,
  ] = time
    .split(":")
    .map(
      Number,
    );

  const guessedUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
    );

  const firstOffset =
    getTimeZoneOffset(
      new Date(
        guessedUtc,
      ),
      timeZone,
    );

  let result =
    new Date(
      guessedUtc -
        firstOffset,
    );

  const secondOffset =
    getTimeZoneOffset(
      result,
      timeZone,
    );

  if (
    firstOffset !==
    secondOffset
  ) {
    result =
      new Date(
        guessedUtc -
          secondOffset,
      );
  }

  return result;
}

/* =========================================================
   TIME ZONE OFFSET
========================================================= */

function getTimeZoneOffset(
  date,
  timeZone,
) {
  const parts =
    getZonedParts(
      date,
      timeZone,
    );

  const representedAsUtc =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

  return (
    representedAsUtc -
    date.getTime()
  );
}

/* =========================================================
   GET ZONED PARTS
========================================================= */

function getZonedParts(
  date,
  timeZone,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",
      },
    );

  const values =
    {};

  for (
    const part
    of formatter.formatToParts(
      date,
    )
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[
        part.type
      ] =
        Number(
          part.value,
        );
    }
  }

  return {
    year:
      values.year,

    month:
      values.month,

    day:
      values.day,

    hour:
      values.hour,

    minute:
      values.minute,

    second:
      values.second,
  };
}

/* =========================================================
   ESCAPE LIKE
========================================================= */

function escapeLike(
  value,
) {
  return value.replace(
    /[\\%_]/g,
    "\\$&",
  );
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value,
) {
  return String(
    value ??
      "",
  )
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}