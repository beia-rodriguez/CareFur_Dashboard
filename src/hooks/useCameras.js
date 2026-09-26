import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export default function useCameras() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCameras = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: devices, error: deviceError } = await supabase
        .from("devices")
        .select("id, device_code, device_name, device_type, status, last_seen_at, created_at")
        .eq("device_type", "camera")
        .neq("status", "retired")
        .order("device_name", { ascending: true });

      if (deviceError) throw deviceError;

      const ids = (devices ?? []).map((device) => device.id);
      const roomByDevice = new Map();

      if (ids.length > 0) {
        const { data: assignments, error: assignmentError } = await supabase
          .from("room_devices")
          .select(`
            device_id,
            assigned_at,
            unassigned_at,
            room:rooms!room_devices_room_id_fkey (
              id,
              room_number,
              room_name,
              status
            )
          `)
          .in("device_id", ids)
          .is("unassigned_at", null);

        if (assignmentError) throw assignmentError;
        for (const item of assignments ?? []) roomByDevice.set(item.device_id, item.room);
      }

      const now = Date.now();
      setCameras((devices ?? []).map((device) => {
        const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
        const online = device.status === "active" && lastSeen > 0 && now - lastSeen <= ONLINE_WINDOW_MS;
        return { ...device, room: roomByDevice.get(device.id) ?? null, online };
      }));
    } catch (fetchError) {
      console.error("Failed to load cameras:", fetchError);
      setCameras([]);
      setError(fetchError?.message || "Unable to load cameras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCameras();
    const channel = supabase
      .channel("carefur-cameras")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, loadCameras)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_devices" }, loadCameras)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadCameras]);

  return { cameras, loading, error, refresh: loadCameras };
}
