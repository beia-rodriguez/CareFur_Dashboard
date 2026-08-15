import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "../services/supabaseClient";

export default function useStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data,
        error: fetchError,
      } = await supabase
        .from("users")
        .select(`
          id,
          full_name,
          email,
          phone,
          avatar_url,
          role,
          created_at
        `)
        .eq("role", "staff")
        .order("created_at", {
          ascending: false,
        });

      if (fetchError) {
        throw fetchError;
      }

      setStaff(data ?? []);
    } catch (fetchError) {
      console.error(
        "Failed loading staff:",
        fetchError,
      );

      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load staff accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const createStaff = useCallback(
    async ({
      fullName,
      email,
      phone,
      password,
    }) => {
      try {
        setCreating(true);
        setError(null);

        const {
          data,
          error: functionError,
        } = await supabase.functions.invoke(
          "create-staff",
          {
            body: {
              fullName,
              email,
              phone,
              password,
            },
          },
        );

        if (functionError) {
          let message =
            functionError.message ||
            "Unable to create the staff account.";

          /*
           * Supabase Edge Function HTTP errors may include
           * the actual JSON response inside error.context.
           */
          try {
            const response = functionError.context;

            if (
              response &&
              typeof response.json === "function"
            ) {
              const responseBody =
                await response.json();

              if (responseBody?.error) {
                message = responseBody.error;
              }
            }
          } catch (responseError) {
            console.warn(
              "Unable to read function error response:",
              responseError,
            );
          }

          throw new Error(message);
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (!data?.staff) {
          throw new Error(
            "The server did not return the new staff account.",
          );
        }

        /*
         * Add the newly created staff member immediately
         * without needing to reload the entire page.
         */
        setStaff((currentStaff) => [
          data.staff,
          ...currentStaff.filter(
            (staffMember) =>
              staffMember.id !== data.staff.id,
          ),
        ]);

        return data.staff;
      } catch (createError) {
        const message =
          createError instanceof Error
            ? createError.message
            : "Unable to create the staff account.";

        console.error(
          "Failed creating staff:",
          createError,
        );

        setError(message);

        throw new Error(message);
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  return {
    staff,
    loading,
    creating,
    error,
    createStaff,
    clearError,
    refreshStaff: fetchStaff,
  };
}