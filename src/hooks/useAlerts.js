import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("alerts")
        .select(`
          id,
          alert_type,
          severity,
          title,
          message,
          status,
          acknowledged_at,
          resolved_at,
          created_at,
          booking:bookings!alerts_booking_id_fkey (
            id,
            booking_code,
            pet:pets!bookings_pet_id_fkey (id, name),
            room:rooms!bookings_room_id_fkey (id, room_number, room_name)
          ),
          device:devices!alerts_device_id_fkey (
            id,
            device_code,
            device_name,
            device_type,
            status
          )
        `)
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      setAlerts(data ?? []);
    } catch (fetchError) {
      console.error("Failed to load alerts:", fetchError);
      setAlerts([]);
      setError(fetchError?.message || "Unable to load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAlert = useCallback(async (id, status) => {
    setUpdatingId(id);
    setError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const payload = { status };
      if (status === "acknowledged") {
        payload.acknowledged_at = new Date().toISOString();
        if (authData?.user?.id) payload.acknowledged_by = authData.user.id;
      }
      if (status === "resolved") payload.resolved_at = new Date().toISOString();

      const { data, error: updateError } = await supabase
        .from("alerts")
        .update(payload)
        .eq("id", id)
        .select("id,status,acknowledged_at,resolved_at")
        .single();
      if (updateError) throw updateError;
      setAlerts((items) => items.map((item) => item.id === id ? { ...item, ...data } : item));
    } catch (updateError) {
      console.error("Failed to update alert:", updateError);
      setError(updateError?.message || "Unable to update alert.");
    } finally {
      setUpdatingId(null);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const channel = supabase
      .channel("carefur-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, loadAlerts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadAlerts]);

  return { alerts, loading, updatingId, error, refresh: loadAlerts, updateAlert };
}
