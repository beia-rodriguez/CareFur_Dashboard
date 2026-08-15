import { createClient } from "@supabase/supabase-js";

const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isOriginAllowed(request) {
  const origin = request.headers.get("Origin");

  return !origin || allowedOrigins.includes(origin);
}

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  return {
    "Access-Control-Allow-Origin":
      origin && allowedOrigins.includes(origin)
        ? origin
        : "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
    Vary: "Origin",
  };
};

Deno.serve(async (request) => {
  if (!isOriginAllowed(request)) {
    return jsonResponse(
      request,
      {
        error: "Origin is not allowed.",
      },
      403,
    );
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      request,
      {
        error: "Method not allowed.",
      },
      405,
    );
  }

  let createdBookingId = null;
  let createdPetId = null;
  let createdOwnerRecordId = null;

  try {
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

    const staffUser =
      await authenticateStaff(
        request,
        adminClient,
      );

    const body =
      await readRequestBody(request);

    const input =
      validateBookingInput(body);

    await validateRoomAvailability(
      adminClient,
      input.roomId,
      input.checkInAt,
      input.expectedCheckOutAt,
    );

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

    let pet;

    if (input.existingPetId) {
      pet = await getExistingPet(
        adminClient,
        input.existingPetId,
      );
    } else {
      pet = await createPet({
        adminClient,
        petData:
          input.newCustomer.pet,
        createdBy: staffUser.id,
      });

      createdPetId = pet.id;
    }

    /*
     * pet_owner_links.owner_id references
     * public.users.id, not public.owners.id.
     *
     * We only create the permanent link when
     * the owner already has an authenticated
     * public.users account.
     */
    let authenticatedOwner =
      ownerResult.authenticatedOwner;

    if (
      !authenticatedOwner &&
      input.existingPetId
    ) {
      authenticatedOwner =
        await findAuthenticatedPetOwner(
          adminClient,
          pet.id,
        );
    }

    if (
      createdPetId &&
      authenticatedOwner
    ) {
      await createPetOwnerLink({
        adminClient,
        petId: pet.id,
        ownerId:
          authenticatedOwner.id,
      });
    }

    const invitedEmail =
      normalizeEmail(
        authenticatedOwner?.email ??
          ownerResult.ownerRecord
            ?.email ??
          input.newCustomer?.owner
            ?.email,
      );

    if (!invitedEmail) {
      throw new AppError(
        "The pet owner must have an email address before an access invitation can be created.",
        400,
      );
    }

    const booking =
      await createBookingRecord({
        adminClient,
        petId: pet.id,
        roomId: input.roomId,
        checkInAt: input.checkInAt,
        expectedCheckOutAt:
          input.expectedCheckOutAt,
        specialInstructions:
          input.specialInstructions,
        createdBy: staffUser.id,
      });

    createdBookingId = booking.id;

    const feedingRows =
      buildFeedingScheduleRows({
        bookingId: booking.id,
        checkInAt:
          input.checkInAt,
        expectedCheckOutAt:
          input.expectedCheckOutAt,
        feeding: input.feeding,
        timeZone: input.timeZone,
        createdBy: staffUser.id,
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
        bookingId: booking.id,
        ownerId:
          authenticatedOwner?.id ??
          null,
        invitedEmail,
        accessCodeHash,
        expiresAt,
        createdBy: staffUser.id,
      });

    return jsonResponse(
      request,
      {
        message:
          "Booking created successfully.",

        booking,

        pet,

        feedingScheduleCount:
          feedingSchedules.length,

        access: {
          id: accessRecord.id,
          code: accessCode,
          invitedEmail:
            accessRecord.invited_email,
          expiresAt:
            accessRecord.expires_at,
          redeemedAt:
            accessRecord.redeemed_at,
        },
      },
      201,
    );
  } catch (error) {
    console.error(
      "create-booking failed:",
      error,
    );

    /*
     * Clean up partially created records.
     * Deleting the booking also removes its
     * feeding schedules and booking access
     * records through cascading foreign keys.
     */
    try {
      const supabaseUrl =
        Deno.env.get("SUPABASE_URL");

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
                persistSession: false,
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
            .eq("id", createdPetId);
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
        error: message,
      },
      status,
    );
  }
});

class AppError extends Error {
  constructor(
    message,
    status = 400,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

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
    !["admin", "staff"].includes(
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
    cleanString(body?.roomId);

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
    body?.newCustomer ?? null;

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
      ) ?? null,
  };
}

function validateFeeding(
  feeding,
) {
  const method =
    feeding?.method;

  if (
    !["manual", "automatic"].includes(
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
    !Array.isArray(schedules) ||
    schedules.length === 0
  ) {
    throw new AppError(
      "At least one feeding schedule is required.",
      400,
    );
  }

  const validatedSchedules =
    schedules.map(
      (schedule, index) => {
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
          !isValidTime(time)
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
          method === "automatic"
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
                schedule?.portion,
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
    .eq("id", roomId)
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

  if (room.status !== "active") {
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
    .eq("room_id", roomId)
    .in(
      "status",
      ["pending", "checked_in"],
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
    Array.isArray(conflicts) &&
    conflicts.length > 0
  ) {
    throw new AppError(
      "The selected room already has an overlapping booking.",
      409,
    );
  }
}

async function resolveOwner({
  adminClient,
  existingOwnerId,
  newCustomer,
}) {
  let authenticatedOwner =
    null;

  let ownerRecord = null;

  let createdOwnerRecord =
    false;

  const ownerInput =
    newCustomer?.owner ?? {};

  const candidateOwnerId =
    existingOwnerId ??
    cleanString(ownerInput.id);

  /*
   * The supplied owner ID may come from either
   * public.users or public.owners. Check users
   * first because only users.id can be used in
   * pet_owner_links and booking_access.owner_id.
   */
  if (candidateOwnerId) {
    const {
      data: userOwner,
      error: userOwnerError,
    } = await adminClient
      .from("users")
      .select(
        "id, full_name, email, phone, role",
      )
      .eq(
        "id",
        candidateOwnerId,
      )
      .maybeSingle();

    if (userOwnerError) {
      throw new AppError(
        `Unable to check the owner account: ${userOwnerError.message}`,
        500,
      );
    }

    if (
      userOwner?.role === "owner"
    ) {
      authenticatedOwner =
        userOwner;
    } else {
      const {
        data: contactOwner,
        error:
          contactOwnerError,
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

      if (contactOwnerError) {
        throw new AppError(
          `Unable to read the owner record: ${contactOwnerError.message}`,
          500,
        );
      }

      ownerRecord =
        contactOwner;
    }
  }

  const email =
    normalizeEmail(
      authenticatedOwner?.email ??
        ownerRecord?.email ??
        ownerInput.email,
    );

  /*
   * Match an existing authenticated owner by
   * email even when the selected record came
   * from public.owners.
   */
  if (
    !authenticatedOwner &&
    email
  ) {
    const {
      data: matchingUser,
      error: matchingUserError,
    } = await adminClient
      .from("users")
      .select(
        "id, full_name, email, phone, role",
      )
      .ilike(
        "email",
        escapeLike(email),
      )
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (matchingUserError) {
      throw new AppError(
        `Unable to match the owner account: ${matchingUserError.message}`,
        500,
      );
    }

    authenticatedOwner =
      matchingUser;
  }

  /*
   * public.owners acts as the staff-side contact
   * record. Create it only for a genuinely new
   * customer when no contact record exists.
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
      data: existingContact,
      error:
        existingContactError,
    } = await adminClient
      .from("owners")
      .select(
        "id, full_name, email, phone, notes",
      )
      .ilike(
        "email",
        escapeLike(email),
      )
      .limit(1)
      .maybeSingle();

    if (existingContactError) {
      throw new AppError(
        `Unable to check existing owner records: ${existingContactError.message}`,
        500,
      );
    }

    if (existingContact) {
      ownerRecord =
        existingContact;
    } else {
      const {
        data: insertedOwner,
        error: insertOwnerError,
      } = await adminClient
        .from("owners")
        .insert({
          full_name: fullName,
          email,
          phone:
            cleanString(
              ownerInput.phone,
            ) ?? null,
          notes:
            cleanString(
              ownerInput.notes,
            ) ?? null,
        })
        .select(
          "id, full_name, email, phone, notes",
        )
        .single();

      if (insertOwnerError) {
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
  }

  return {
    authenticatedOwner,
    ownerRecord,
    createdOwnerRecord,
  };
}

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
    .eq("id", petId)
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
        ) ?? null,
      sex,
      birth_date:
        cleanString(
          petData?.birth_date ??
            petData?.birthDate,
        ) ?? null,
      weight_kg: weightKg,
      allergies:
        cleanString(
          petData?.allergies,
        ) ?? null,
      medical_notes:
        cleanString(
          petData?.medical_notes ??
            petData?.medicalNotes,
        ) ?? null,
      feeding_notes:
        cleanString(
          petData?.feeding_notes ??
            petData?.feedingNotes,
        ) ?? null,
      photo_url:
        cleanString(
          petData?.photo_url ??
            petData?.photoUrl,
        ) ?? null,
      created_by: createdBy,
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

async function findAuthenticatedPetOwner(
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
    .eq("pet_id", petId)
    .order(
      "is_primary",
      {
        ascending: false,
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
    links?.[0]?.owner_id;

  if (!ownerId) {
    return null;
  }

  const {
    data: owner,
    error: ownerError,
  } = await adminClient
    .from("users")
    .select(
      "id, full_name, email, phone, role",
    )
    .eq("id", ownerId)
    .eq("role", "owner")
    .maybeSingle();

  if (ownerError) {
    throw new AppError(
      `Unable to read the owner's account: ${ownerError.message}`,
      500,
    );
  }

  return owner;
}

async function createPetOwnerLink({
  adminClient,
  petId,
  ownerId,
}) {
  const {
    error,
  } = await adminClient
    .from("pet_owner_links")
    .upsert(
      {
        pet_id: petId,
        owner_id: ownerId,
        relationship: "owner",
        is_primary: true,
      },
      {
        onConflict:
          "pet_id,owner_id",
        ignoreDuplicates: true,
      },
    );

  if (error) {
    throw new AppError(
      `Unable to link the owner to the pet: ${error.message}`,
      500,
    );
  }
}

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
        pet_id: petId,
        room_id: roomId,
        check_in_at:
          checkInAt.toISOString(),
        expected_check_out_at:
          expectedCheckOutAt.toISOString(),
        status: "pending",
        special_instructions:
          specialInstructions,
        created_by: createdBy,
      })
      .select("*")
      .single();

    if (!error) {
      return booking;
    }

    if (
      error.code !== "23505"
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
    dateKey <= finalDateKey
  ) {
    for (
      const schedule of feeding.schedules
    ) {
      const scheduledAt =
        zonedDateTimeToUtc(
          dateKey,
          schedule.time,
          timeZone,
        );

      if (
        scheduledAt >= checkInAt &&
        scheduledAt <
          expectedCheckOutAt
      ) {
        rows.push({
          booking_id: bookingId,
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
          status: "pending",
          created_by: createdBy,
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

async function createFeedingSchedules(
  adminClient,
  rows,
) {
  const {
    data,
    error,
  } = await adminClient
    .from("feeding_schedules")
    .insert(rows)
    .select("*");

  if (error) {
    throw new AppError(
      `Unable to create feeding schedules: ${error.message}`,
      500,
    );
  }

  return data ?? [];
}

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
    .from("booking_access")
    .insert({
      booking_id: bookingId,
      owner_id: ownerId,
      invited_email:
        invitedEmail,
      access_code_hash:
        accessCodeHash,
      expires_at:
        expiresAt.toISOString(),
      created_by: createdBy,
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

function generateBookingCode() {
  const now = new Date();

  const datePart = [
    now.getUTCFullYear(),
    String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0"),
    String(
      now.getUTCDate(),
    ).padStart(2, "0"),
  ].join("");

  const randomPart =
    generateRandomString(6);

  return `CF-${datePart}-${randomPart}`;
}

function generateAccessCode() {
  return generateRandomString(8);
}

function generateRandomString(
  length,
) {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const randomValues =
    new Uint32Array(length);

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
    new Uint8Array(digest),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

function calculateAccessExpiration(
  expectedCheckOutAt,
) {
  const checkout =
    new Date(
      expectedCheckOutAt,
    );

  const expiration =
    new Date(
      checkout.getTime() +
        24 * 60 * 60 * 1000,
    );

  const minimumExpiration =
    new Date(
      Date.now() +
        24 * 60 * 60 * 1000,
    );

  return expiration >
    minimumExpiration
    ? expiration
    : minimumExpiration;
}

function parseDate(
  value,
  label,
) {
  const date =
    new Date(value);

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

function cleanString(value) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

function normalizeEmail(value) {
  const email =
    cleanString(value);

  return email
    ? email.toLowerCase()
    : null;
}

function normalizeSex(value) {
  const sex =
    cleanString(value)
      ?.toLowerCase();

  if (!sex) {
    return null;
  }

  if (
    ["male", "female", "unknown"].includes(
      sex,
    )
  ) {
    return sex;
  }

  return "unknown";
}

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
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throw new AppError(
      `${label} must be greater than zero.`,
      400,
    );
  }

  return number;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    value,
  );
}

function validateTimeZone(
  value,
) {
  const timeZone =
    cleanString(value) ??
    "Asia/Manila";

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
      },
    ).format(new Date());

    return timeZone;
  } catch {
    return "Asia/Manila";
  }
}

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
    String(parts.month).padStart(
      2,
      "0",
    ),
    String(parts.day).padStart(
      2,
      "0",
    ),
  ].join("-");
}

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
    .map(Number);

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
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),
    String(
      date.getUTCDate(),
    ).padStart(2, "0"),
  ].join("-");
}

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
    .map(Number);

  const [
    hour,
    minute,
  ] = time
    .split(":")
    .map(Number);

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
      new Date(guessedUtc),
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

function getZonedParts(
  date,
  timeZone,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      },
    );

  const values = {};

  for (
    const part of formatter.formatToParts(
      date,
    )
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[part.type] =
        Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function escapeLike(value) {
  return value.replace(
    /[\\%_]/g,
    "\\$&",
  );
}

function jsonResponse(
  request,
  body,
  status = 200,
) {
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
