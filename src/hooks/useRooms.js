import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function useRooms(
  checkIn,
  checkOut,
) {
  const [rooms, setRooms] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchRooms() {
      setLoading(true);
      setError("");

      const {
        data: roomData,
        error: roomError,
      } = await supabase
        .from("rooms")
        .select(`
          id,
          room_number,
          room_name,
          capacity,
          status
        `)
        .eq("status", "active")
        .order("room_number");

      if (cancelled) {
        return;
      }

      if (roomError) {
        console.error(
          "Failed to load rooms:",
          roomError,
        );

        setRooms([]);
        setError(
          "Unable to load rooms.",
        );
        setLoading(false);

        return;
      }

      const activeRooms =
        roomData ?? [];

      const checkInDate =
        new Date(checkIn);

      const checkOutDate =
        new Date(checkOut);

      const hasValidDates =
        Boolean(checkIn) &&
        Boolean(checkOut) &&
        !Number.isNaN(
          checkInDate.getTime(),
        ) &&
        !Number.isNaN(
          checkOutDate.getTime(),
        ) &&
        checkOutDate >
          checkInDate;

      /*
       * Step 2 should normally only appear
       * after valid dates have been selected.
       * This protects the hook when dates are
       * missing or invalid.
       */
      if (!hasValidDates) {
        setRooms(
          activeRooms.map(
            (room) => ({
              ...room,

              isAvailable: false,

              availabilityStatus:
                "unknown",

              availabilityMessage:
                "Select valid boarding dates to check availability.",

              conflictingBooking:
                null,
            }),
          ),
        );

        setLoading(false);
        return;
      }

      /*
       * A room conflicts when:
       *
       * existing check-in < requested check-out
       * AND
       * existing check-out > requested check-in
       *
       * This allows one booking to check out at
       * the exact time another booking checks in.
       */
      const {
        data: conflictingBookings,
        error: bookingError,
      } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_code,
          room_id,
          check_in_at,
          expected_check_out_at,
          status
        `)
        .in("status", [
          "pending",
          "checked_in",
        ])
        .lt(
          "check_in_at",
          checkOutDate.toISOString(),
        )
        .gt(
          "expected_check_out_at",
          checkInDate.toISOString(),
        );

      if (cancelled) {
        return;
      }

      if (bookingError) {
        console.error(
          "Failed to check room availability:",
          bookingError,
        );

        /*
         * Do not falsely mark rooms as available
         * when the availability query fails.
         */
        setRooms(
          activeRooms.map(
            (room) => ({
              ...room,

              isAvailable: false,

              availabilityStatus:
                "unknown",

              availabilityMessage:
                "Availability could not be checked.",

              conflictingBooking:
                null,
            }),
          ),
        );

        setError(
          "Unable to check room availability.",
        );

        setLoading(false);
        return;
      }

      const conflictsByRoom =
        new Map();

      for (
        const booking of
          conflictingBookings ?? []
      ) {
        if (
          !conflictsByRoom.has(
            booking.room_id,
          )
        ) {
          conflictsByRoom.set(
            booking.room_id,
            booking,
          );
        }
      }

      const roomsWithAvailability =
        activeRooms.map((room) => {
          const conflictingBooking =
            conflictsByRoom.get(
              room.id,
            ) ?? null;

          const isAvailable =
            !conflictingBooking;

          return {
            ...room,

            isAvailable,

            availabilityStatus:
              isAvailable
                ? "available"
                : "unavailable",

            availabilityMessage:
              isAvailable
                ? "Available for the selected dates."
                : "Unavailable for the selected dates.",

            conflictingBooking,
          };
        });

      setRooms(
        roomsWithAvailability,
      );

      setLoading(false);
    }

    fetchRooms();

    return () => {
      cancelled = true;
    };
  }, [
    checkIn,
    checkOut,
    refreshKey,
  ]);

  function refetchRooms() {
    setRefreshKey(
      (currentKey) =>
        currentKey + 1,
    );
  }

  return {
    rooms,
    loading,
    error,
    refetchRooms,
  };
}