import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../services/supabaseClient";
import {
  getCurrentSession,
  getUserProfile,
  isDashboardRole,
  signInStaff,
  signOutUser,
} from "../services/authService";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Clears all locally stored authentication information.
   */
  const clearAuthState = useCallback(() => {
    setSession(null);
    setAuthUser(null);
    setProfile(null);
  }, []);

  /**
   * Loads the public.users profile for an existing Supabase session.
   */
  const loadSessionProfile = useCallback(
    async (currentSession) => {
      if (!currentSession?.user) {
        clearAuthState();
        return null;
      }

      const currentUser = currentSession.user;

      try {
        const userProfile = await getUserProfile(currentUser.id);

        /*
         * Owners are allowed to use the mobile application,
         * but they cannot access the Staff Dashboard.
         */
        if (!isDashboardRole(userProfile.role)) {
          await supabase.auth.signOut();
          clearAuthState();
          return null;
        }

        setSession(currentSession);
        setAuthUser(currentUser);
        setProfile(userProfile);

        return userProfile;
      } catch (error) {
        console.error("Failed to load authenticated profile:", error);

        await supabase.auth.signOut();
        clearAuthState();

        return null;
      }
    },
    [clearAuthState]
  );

  /**
   * Checks for a saved session when the application first loads.
   */
  useEffect(() => {
    let active = true;

    async function initializeAuthentication() {
      try {
        setLoading(true);

        const currentSession = await getCurrentSession();

        if (!active) {
          return;
        }

        await loadSessionProfile(currentSession);
      } catch (error) {
        console.error("Authentication initialization failed:", error);

        if (active) {
          clearAuthState();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initializeAuthentication();

    async function handleAuthStateChange(currentSession) {
      if (!active) {
        return;
      }

      if (!currentSession) {
        clearAuthState();
        setLoading(false);
        return;
      }

      try {
        await loadSessionProfile(currentSession);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    /*
     * Keep the listener synchronous. Deferring profile work avoids
     * doing asynchronous Supabase calls from inside its auth callback.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      window.setTimeout(() => {
        void handleAuthStateChange(currentSession);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [clearAuthState, loadSessionProfile]);

  /**
   * Logs in an admin or staff member.
   */
  const login = useCallback(async (email, password) => {
    const result = await signInStaff(email, password);

    setSession(result.session);
    setAuthUser(result.authUser);
    setProfile(result.profile);

    return result.profile;
  }, []);

  /**
   * Logs out the current user.
   */
  const logout = useCallback(async () => {
    try {
      await signOutUser();
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const value = useMemo(
    () => ({
      session,
      authUser,
      profile,
      loading,
      login,
      logout,

      isAuthenticated: Boolean(session && authUser && profile),
      canAccessDashboard: isDashboardRole(profile?.role),
      isAdmin: profile?.role === "admin",
      isStaff: profile?.role === "staff",
    }),
    [session, authUser, profile, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
