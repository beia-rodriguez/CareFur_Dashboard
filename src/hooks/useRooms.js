import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function useRooms(checkIn = null, checkOut = null) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refetchRooms = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchRooms() {
      setLoading(true);
      setError("");

      try {
        const isAvailabilityCheck = Boolean(checkIn && checkOut);

        let roomQuery = supabase
          .from("rooms")
          .select("id, room_number, room_name, capacity, status, notes")
          .order("room_number", { ascending: true });

        if (isAvailabilityCheck) {
          roomQuery = roomQuery.eq("status", "active");
        }

        const { data: roomData, error: roomError } = await roomQuery;
        if (roomError) throw roomError;

        const baseRooms = roomData ?? [];
        const roomIds = baseRooms.map((room) => room.id);
        let deviceLinks = [];

        if (roomIds.length > 0) {
          const { data, error: deviceError } = await supabase
            .from("room_devices")
            .select(`
              id,
              room_id,
              device_id,
              assigned_at,
              unassigned_at,
              device:devices!room_devices_device_id_fkey (
                id,
                device_code,
                device_name,
                device_type,
                status,
                last_seen_at
              )
            `)
            .in("room_id", roomIds)
            .is("unassigned_at", null);

          if (deviceError) throw deviceError;
          deviceLinks = data ?? [];
        }

        const devicesByRoom = new Map();
        for (const link of deviceLinks) {
          if (!link.device) continue;
          if (!devicesByRoom.has(link.room_id)) devicesByRoom.set(link.room_id, []);
          devicesByRoom.get(link.room_id).push(link.device);
        }

        const roomsWithDevices = baseRooms.map((room) => ({
          ...room,
          devices: devicesByRoom.get(room.id) ?? [],
        }));

        if (!isAvailabilityCheck) {
          if (!cancelled) setRooms(roomsWithDevices);
          return;
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const validDates =
          !Number.isNaN(checkInDate.getTime()) &&
          !Number.isNaN(checkOutDate.getTime()) &&
          checkOutDate > checkInDate;

        if (!validDates) {
          if (!cancelled) {
            setRooms(
              roomsWithDevices.map((room) => ({
                ...room,
                isAvailable: false,
                availabilityStatus: "unknown",
                availabilityMessage: "Select valid boarding dates to check availability.",
                conflictingBooking: null,
              })),
            );
          }
          return;
        }

        const { data: conflicts, error: bookingError } = await supabase
          .from("bookings")
          .select("id, booking_code, room_id, check_in_at, expected_check_out_at, status")
          .in("status", ["pending", "checked_in"])
          .lt("check_in_at", checkOutDate.toISOString())
          .gt("expected_check_out_at", checkInDate.toISOString());

        if (bookingError) throw bookingError;

        const conflictsByRoom = new Map();
        for (const booking of conflicts ?? []) {
          if (!conflictsByRoom.has(booking.room_id)) conflictsByRoom.set(booking.room_id, booking);
        }

        if (!cancelled) {
          setRooms(
            roomsWithDevices.map((room) => {
              const conflictingBooking = conflictsByRoom.get(room.id) ?? null;
              return {
                ...room,
                isAvailable: !conflictingBooking,
                availabilityStatus: conflictingBooking ? "unavailable" : "available",
                availabilityMessage: conflictingBooking
                  ? "Unavailable for the selected dates."
                  : "Available for the selected dates.",
                conflictingBooking,
              };
            }),
          );
        }
      } catch (fetchError) {
        console.error("Failed to load rooms:", fetchError);
        if (!cancelled) {
          setRooms([]);
          setError(fetchError?.message || "Unable to load rooms.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRooms();
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, refreshKey]);

  return { rooms, loading, error, refetchRooms };
}
