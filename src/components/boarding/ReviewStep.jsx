export default function ReviewStep({
  formData,
  selectedRoom,
  selectedPet,
}) {
  const pet =
    selectedPet ??
    formData.newCustomer?.pet ??
    null;

  const owner =
    selectedPet?.owner ??
    formData.newCustomer?.owner ??
    null;

  const schedules =
    formData.feeding?.schedules ?? [];

  return (
    <>
      <h2>Review Boarding</h2>

      <p className="boarding-description">
        Review all boarding information before
        continuing.
      </p>

      <div className="boarding-review">
        <ReviewSection title="Boarding Dates">
          <ReviewRow
            label="Check-in"
            value={formatDateTime(
              formData.checkIn,
            )}
          />

          <ReviewRow
            label="Check-out"
            value={formatDateTime(
              formData.checkOut,
            )}
          />
        </ReviewSection>

        <ReviewSection title="Room">
          <ReviewRow
            label="Selected room"
            value={formatRoom(
              selectedRoom,
            )}
          />
        </ReviewSection>

        <ReviewSection title="Pet">
          <ReviewRow
            label="Name"
            value={
              pet?.name ||
              "Pet unavailable"
            }
          />

          <ReviewRow
            label="Species"
            value={
              pet?.species ||
              "Not provided"
            }
          />

          <ReviewRow
            label="Breed"
            value={
              pet?.breed ||
              "Not provided"
            }
          />

          <ReviewRow
            label="Sex"
            value={
              formatValue(
                pet?.sex,
              )
            }
          />
        </ReviewSection>

        <ReviewSection title="Owner">
          <ReviewRow
            label="Name"
            value={
              owner?.full_name ||
              "Owner unavailable"
            }
          />

          <ReviewRow
            label="Email"
            value={
              owner?.email ||
              "Not provided"
            }
          />

          <ReviewRow
            label="Phone"
            value={
              owner?.phone ||
              "Not provided"
            }
          />
        </ReviewSection>

        <ReviewSection title="Feeding">
          <ReviewRow
            label="Method"
            value={
              formData.feeding
                ?.method ===
              "automatic"
                ? "Automatic Feeder"
                : "Manual Feeding"
            }
          />

          {schedules.length === 0 ? (
            <p className="boarding-description">
              No feeding schedules added.
            </p>
          ) : (
            schedules.map(
              (schedule, index) => (
                <div
                  key={
                    schedule.clientId ??
                    `${schedule.period}-${index}`
                  }
                  className="boarding-review__schedule"
                >
                  <h4>
                    {formatPeriod(
                      schedule.period,
                    )}
                  </h4>

                  <ReviewRow
                    label="Time"
                    value={
                      formatTime(
                        schedule.time,
                      )
                    }
                  />

                  <ReviewRow
                    label="Instructions"
                    value={
                      schedule.instructions ||
                      "No instructions"
                    }
                  />

                  {formData.feeding
                    ?.method ===
                    "automatic" && (
                    <>
                      <ReviewRow
                        label="Compartment"
                        value={
                          schedule.compartment
                            ? `Compartment ${schedule.compartment}`
                            : "Not selected"
                        }
                      />

                      <ReviewRow
                        label="Portion"
                        value={
                          schedule.portion
                            ? `${schedule.portion} grams`
                            : "Not provided"
                        }
                      />
                    </>
                  )}
                </div>
              ),
            )
          )}
        </ReviewSection>
      </div>
    </>
  );
}

function ReviewSection({
  title,
  children,
}) {
  return (
    <section className="boarding-review__section">
      <h3>{title}</h3>

      {children}
    </section>
  );
}

function ReviewRow({
  label,
  value,
}) {
  return (
    <div className="boarding-review__row">
      <span>{label}</span>

      <strong>
        {value || "Not provided"}
      </strong>
    </div>
  );
}

function formatRoom(room) {
  if (!room) {
    return "Room unavailable";
  }

  const roomNumber =
    room.room_number ??
    room.roomNumber;

  const roomName =
    room.room_name ??
    room.roomName;

  if (
    roomNumber &&
    roomName
  ) {
    return `${roomNumber} — ${roomName}`;
  }

  return (
    roomNumber ||
    roomName ||
    "Selected room"
  );
}

function formatPeriod(period) {
  if (!period) {
    return "Feeding";
  }

  return (
    period.charAt(0).toUpperCase() +
    period.slice(1)
  );
}

function formatValue(value) {
  if (!value) {
    return "Not provided";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function formatTime(value) {
  if (!value) {
    return "Not selected";
  }

  const [
    hoursString,
    minutesString,
  ] = value.split(":");

  const hours =
    Number(hoursString);

  const minutes =
    Number(minutesString);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return value;
  }

  const period =
    hours >= 12
      ? "PM"
      : "AM";

  const displayHours =
    hours % 12 || 12;

  return `${displayHours}:${String(
    minutes,
  ).padStart(2, "0")} ${period}`;
}

function formatDateTime(value) {
  if (!value) {
    return "Not selected";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-PH",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}