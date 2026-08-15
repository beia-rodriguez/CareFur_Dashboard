export default function RoomStep({
  rooms = [],
  loading = false,
  selectedRoom = null,
  updateForm,
}) {
  function selectRoom(room) {
    if (room.isAvailable !== true) {
      return;
    }

    updateForm("roomId", room.id);
  }

  if (loading) {
    return (
      <>
        <h2>Select Room</h2>

        <p role="status">
          Checking room availability...
        </p>
      </>
    );
  }

  return (
    <>
      <h2>Select Room</h2>

      <p className="boarding-description">
        Availability is based on your selected
        check-in and check-out dates.
      </p>

      {rooms.length === 0 ? (
        <p className="customer-error">
          No active rooms are available.
        </p>
      ) : (
        <div className="room-list">
          {rooms.map((room) => {
            const isAvailable =
              room.isAvailable === true;

            const isSelected =
              isAvailable &&
              selectedRoom === room.id;

            const classNames = [
              "room-card",
              isSelected
                ? "room-card-selected"
                : "",
              !isAvailable
                ? "room-card-unavailable"
                : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={room.id}
                type="button"
                className={classNames}
                onClick={() =>
                  selectRoom(room)
                }
                disabled={!isAvailable}
                aria-disabled={!isAvailable}
                aria-pressed={isSelected}
              >
                <div className="room-card-header">
                  <strong>
                    {room.room_number}
                  </strong>

                  <span
                    className={
                      isAvailable
                        ? "room-availability room-availability-available"
                        : "room-availability room-availability-unavailable"
                    }
                  >
                    {isAvailable
                      ? "Available"
                      : "Unavailable"}
                  </span>
                </div>

                <span>
                  {room.room_name ||
                    "Unnamed room"}
                </span>

                <small>
                  Capacity: {room.capacity}
                </small>

                <small className="room-availability-message">
                  {room.availabilityMessage ||
                    (isAvailable
                      ? "Available for the selected dates."
                      : "Unavailable for the selected dates.")}
                </small>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}