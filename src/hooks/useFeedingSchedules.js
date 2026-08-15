import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function useFeedingSchedules(selectedDate = null) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

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
            bookings (
              id,
              booking_code,
              pets ( id, name, species, breed ),
              rooms ( id, room_number, room_name )
            )
          `)
          .order("scheduled_at", { ascending: true });

        if (selectedDate) {
          query = query
            .gte("scheduled_at", `${selectedDate}T00:00:00`)
            .lte("scheduled_at", `${selectedDate}T23:59:59`);
        }

        const { data, error: fetchError } = await query;

        if (cancelled) return;

        if (fetchError) {
          throw fetchError;
        }

        setSchedules(data ?? []);
      } catch (err) {
        console.error("Failed to load feeding schedules:", err);
        setSchedules([]);
        setError("Unable to load feeding schedules.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSchedules();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  async function toggleFeedingStatus(scheduleId, currentStatus) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";

    try {
      const { error: updateError } = await supabase
        .from("feeding_schedules")
        .update({ status: newStatus })
        .eq("id", scheduleId);

      if (updateError) throw updateError;

      setSchedules((prev) =>
        prev.map((item) =>
          item.id === scheduleId ? { ...item, status: newStatus } : item
        )
      );
    } catch (err) {
      console.error("Failed to update feeding status:", err);
      setError("Failed to update status.");
    }
  }

  function refetchSchedules() {
    setRefreshKey((prev) => prev + 1);
  }

  return {
    schedules,
    loading,
    error,
    toggleFeedingStatus,
    refetchSchedules,
  };
}