import { supabase } from "./supabaseClient";

const DASHBOARD_ROLES = ["admin", "staff"];

/**
 * Retrieves the public.users profile connected to a Supabase Auth user.
 *
 * public.users.id must match auth.users.id.
 */
export async function getUserProfile(userId) {
  if (!userId) {
    throw new Error("A user ID is required to retrieve the profile.");
  }

  const { data, error } = await supabase
    .from("users")
    .select(
      `
        id,
        full_name,
        email,
        phone,
        avatar_url,
        role,
        created_at,
        updated_at
      `
    )
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Failed to retrieve user profile:", error);

    if (error.code === "PGRST116") {
      throw new Error(
        "No CareFur user profile is connected to this account."
      );
    }

    throw new Error(error.message || "Unable to retrieve the user profile.");
  }

  return data;
}

/**
 * Logs an admin or staff member into the CareFur Staff Dashboard.
 */
export async function signInStaff(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    console.error("Supabase login error:", error);
    throw error;
  }

  if (!data.user || !data.session) {
    throw new Error("Login failed because no user session was created.");
  }

  try {
    const profile = await getUserProfile(data.user.id);

    if (!DASHBOARD_ROLES.includes(profile.role)) {
      await supabase.auth.signOut();

      throw new Error(
        "This account is not authorized to access the CareFur Staff Dashboard."
      );
    }

    return {
      session: data.session,
      authUser: data.user,
      profile,
    };
  } catch (profileError) {
    await supabase.auth.signOut();
    throw profileError;
  }
}

/**
 * Logs out the current user.
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Supabase logout error:", error);
    throw new Error(error.message || "Unable to log out.");
  }
}

/**
 * Retrieves the currently stored browser session.
 */
export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Failed to retrieve current session:", error);
    throw new Error(error.message || "Unable to retrieve the current session.");
  }

  return session;
}

/**
 * Returns true when the role may access the staff dashboard.
 */
export function isDashboardRole(role) {
  return DASHBOARD_ROLES.includes(role);
}