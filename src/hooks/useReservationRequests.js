import { useCallback, useEffect, useState } from "react";

import { supabase } from "../services/supabaseClient";

export default function useReservationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("reservation_requests")
        .select(`
          id,
          owner_name,
          email,
          phone,
          pet_name,
          pet_species,
          pet_breed,
          room_id,
          requested_room_number,
          check_in_at,
          expected_check_out_at,
          special_instructions,
          status,
          room_rate_per_night,
          nights,
          estimated_total,
          created_at,
          updated_at,
          room:rooms!reservation_requests_room_id_fkey(
            id,
            room_number,
            room_name
          )
        `)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      const normalized = (data ?? []).map((item) => ({
        ...item,

        // aliases so your current UI can still use the old field names
        owner_email: item.email,
        owner_phone: item.phone,
        species: item.pet_species,
        breed: item.pet_breed,
        check_in: item.check_in_at,
        check_out: item.expected_check_out_at,
        notes: item.special_instructions,

        // readable fallback reference
        request_code: `RES-${String(item.id).slice(0, 8).toUpperCase()}`,
      }));

      setRequests(normalized);
    } catch (fetchError) {
      console.error("Reservation requests load error:", fetchError);

      setError(
        fetchError?.message ||
          "Unable to load reservation requests."
      );

      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const setStatus = useCallback(
    async (id, status) => {
      setUpdatingId(id);
      setError("");

      try {
        const { error: updateError } = await supabase
          .from("reservation_requests")
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (updateError) throw updateError;

        await load();

        return true;
      } catch (updateError) {
        console.error(
          "Reservation request update error:",
          updateError
        );

        setError(
          updateError?.message ||
            "Unable to update reservation request."
        );

        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [load]
  );

  useEffect(() => {
    load();

    const channel = supabase
      .channel("carefur-reservation-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservation_requests",
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return {
    requests,
    loading,
    error,
    updatingId,
    refresh: load,
    setStatus,
  };
}