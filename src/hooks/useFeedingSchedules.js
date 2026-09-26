import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function useFeedingSchedules(selectedDate = null) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refetchSchedules = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchSchedules() {
      setLoading(true);
      setError("");

      try {
        let query = supabase
          .from("feeding_schedules")
          .select(`
            id,
            booking_id,
            scheduled_at,
            feeding_method,
            compartment_number,
            portion_grams,
            instructions,
            status,
            booking:bookings!feeding_schedules_booking_id_fkey (
              id,
              booking_code,
              pet:pets!bookings_pet_id_fkey (id, name, species, breed),
              room:rooms!bookings_room_id_fkey (id, room_number, room_name)
            )
          `)
          .order("scheduled_at", { ascending: true });

        if (selectedDate) {
          const start = new Date(`${selectedDate}T00:00:00`);
          const end = new Date(`${selectedDate}T23:59:59.999`);
          query = query.gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString());
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        if (!cancelled) setSchedules(data ?? []);
      } catch (fetchError) {
        console.error("Failed to load feeding schedules:", fetchError);
        if (!cancelled) {
          setSchedules([]);
          setError(fetchError?.message || "Unable to load feeding schedules.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSchedules();
    return () => { cancelled = true; };
  }, [selectedDate, refreshKey]);

  const toggleFeedingStatus = useCallback(async (scheduleId, currentStatus) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    setUpdatingId(scheduleId);
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("feeding_schedules")
        .update({ status: nextStatus })
        .eq("id", scheduleId)
        .select("id, status")
        .single();

      if (updateError) throw updateError;
      setSchedules((items) => items.map((item) => item.id === scheduleId ? { ...item, status: data.status } : item));
      return data;
    } catch (updateError) {
      console.error("Failed to update feeding status:", updateError);
      setError(updateError?.message || "Failed to update feeding status.");
      throw updateError;
    } finally {
      setUpdatingId(null);
    }
  }, []);

  return { schedules, loading, updatingId, error, toggleFeedingStatus, refetchSchedules };
}
