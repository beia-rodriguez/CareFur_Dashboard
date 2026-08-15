import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isOriginAllowed(request) {
  const origin = request.headers.get("Origin");

  return (
    !origin ||
    allowedOrigins.includes("*") ||
    allowedOrigins.includes(origin)
  );
}

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

function getAccessToken(request) {
  const authorization =
    request.headers.get("Authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  const token = authorization
    .replace("Bearer ", "")
    .trim();

  return token || null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

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
    return new Response(null, {
      status: 204,
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

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "CARE_FUR_SERVICE_ROLE_KEY",
      ) ||
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Missing required Supabase environment variables.",
      );

      return jsonResponse(
        request,
        {
          error: "Server configuration error.",
        },
        500,
      );
    }

    const accessToken =
      getAccessToken(request);

    if (!accessToken) {
      return jsonResponse(
        request,
        {
          error:
            "Missing or invalid authorization token.",
        },
        401,
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

    /*
     * Verify the logged-in caller.
     */
    const {
      data: userData,
      error: userError,
    } = await adminClient.auth.getUser(
      accessToken,
    );

    const currentUser = userData?.user;

    if (userError || !currentUser) {
      console.error(
        "User verification failed:",
        userError,
      );

      return jsonResponse(
        request,
        {
          error: "Invalid or expired session.",
        },
        401,
      );
    }

    /*
     * Verify that the caller is an administrator.
     */
    const {
      data: adminProfile,
      error: adminProfileError,
    } = await adminClient
      .from("users")
      .select("id, role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (adminProfileError) {
      console.error(
        "Administrator lookup failed:",
        adminProfileError,
      );

      return jsonResponse(
        request,
        {
          error:
            "Unable to verify administrator role.",
        },
        500,
      );
    }

    if (
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {
      return jsonResponse(
        request,
        {
          error:
            "Only administrators can create staff accounts.",
        },
        403,
      );
    }

    /*
     * Read and validate the submitted form.
     */
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        request,
        {
          error:
            "The request body must contain valid JSON.",
        },
        400,
      );
    }

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const phone =
      typeof body.phone === "string" &&
      body.phone.trim()
        ? body.phone.trim()
        : null;

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!fullName) {
      return jsonResponse(
        request,
        {
          error: "Full name is required.",
        },
        400,
      );
    }

    if (fullName.length > 150) {
      return jsonResponse(
        request,
        {
          error:
            "Full name must not exceed 150 characters.",
        },
        400,
      );
    }

    if (!email || !isValidEmail(email)) {
      return jsonResponse(
        request,
        {
          error:
            "Enter a valid email address.",
        },
        400,
      );
    }

    if (password.length < 8) {
      return jsonResponse(
        request,
        {
          error:
            "Password must contain at least 8 characters.",
        },
        400,
      );
    }

    /*
     * Create the Supabase Auth account.
     */
    const {
      data: authData,
      error: authError,
    } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,

        app_metadata: {
          role: "staff",
        },

        user_metadata: {
          full_name: fullName,
        },
      });

    if (authError) {
      console.error(
        "Auth user creation failed:",
        authError,
      );

      const normalizedMessage =
        authError.message?.toLowerCase() || "";

      const accountExists =
        normalizedMessage.includes("already") ||
        normalizedMessage.includes(
          "registered",
        ) ||
        normalizedMessage.includes(
          "exists",
        );

      return jsonResponse(
        request,
        {
          error: accountExists
            ? "An account with this email already exists."
            : authError.message ||
              "Unable to create the staff account.",
        },
        accountExists ? 409 : 400,
      );
    }

    const newUser = authData?.user;

    if (!newUser) {
      return jsonResponse(
        request,
        {
          error:
            "Supabase did not return the new user.",
        },
        500,
      );
    }

    /*
     * Create or update the public.users profile.
     *
     * Upsert prevents duplicate errors if an Auth trigger
     * already created the profile automatically.
     */
    const {
      data: staffProfile,
      error: profileError,
    } = await adminClient
      .from("users")
      .upsert(
        {
          id: newUser.id,
          full_name: fullName,
          email,
          phone,
          avatar_url: null,
          role: "staff",
        },
        {
          onConflict: "id",
        },
      )
      .select(`
        id,
        full_name,
        email,
        phone,
        avatar_url,
        role,
        created_at
      `)
      .single();

    if (profileError || !staffProfile) {
      console.error(
        "Staff profile creation failed:",
        profileError,
      );

      const { error: rollbackError } =
        await adminClient.auth.admin.deleteUser(
          newUser.id,
        );

      if (rollbackError) {
        console.error(
          "Auth user rollback failed:",
          rollbackError,
        );
      }

      return jsonResponse(
        request,
        {
          error:
            "Failed to create the staff profile.",
        },
        500,
      );
    }

    /*
     * Save an activity log.
     *
     * A logging failure does not undo the staff account.
     */
    const { error: activityLogError } =
      await adminClient
        .from("activity_logs")
        .insert({
          actor_user_id: currentUser.id,
          action: "staff_account_created",
          entity_type: "user",
          entity_id: newUser.id,
          description:
            `${fullName} was added as a staff member.`,
        });

    if (activityLogError) {
      console.error(
        "Activity log creation failed:",
        activityLogError,
      );
    }

    return jsonResponse(
      request,
      {
        message:
          "Staff account created successfully.",
        staff: staffProfile,
      },
      201,
    );
  } catch (error) {
    console.error(
      "Unexpected create-staff error:",
      error,
    );

    return jsonResponse(
      request,
      {
        error: "Unexpected server error.",
      },
      500,
    );
  }
});
