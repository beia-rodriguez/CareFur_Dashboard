export default function AccessCodeStep({
  result,
}) {
  const booking =
    result?.booking ?? {};

  const access =
    result?.access ?? {};

  const bookingCode =
    booking.booking_code ??
    booking.bookingCode ??
    "Unavailable";

  const accessCode =
    access.code ??
    result?.accessCode ??
    "Unavailable";

  const invitedEmail =
    access.invitedEmail ??
    access.invited_email ??
    null;

  const expiresAt =
    access.expiresAt ??
    access.expires_at ??
    null;

  return (
    <div>
      <h2>Booking Created</h2>

      <p className="boarding-description">
        The boarding session was created
        successfully.
      </p>

      <div className="boarding-success">
        <ResultRow
          label="Booking Code"
          value={bookingCode}
        />

        <ResultRow
          label="Status"
          value={
            booking.status ??
            "pending"
          }
        />

        <div className="boarding-access-code">
          <span>Owner Access Code</span>

          <strong>
            {accessCode}
          </strong>
        </div>

        {invitedEmail && (
          <ResultRow
            label="Owner Email"
            value={invitedEmail}
          />
        )}

        {expiresAt && (
          <ResultRow
            label="Access Code Expires"
            value={formatDateTime(
              expiresAt,
            )}
          />
        )}

        <p className="boarding-description">
          Give the access code only to the pet
          owner.
        </p>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
}) {
  return (
    <div className="boarding-review__row">
      <span>{label}</span>

      <strong>
        {value ?? "Unavailable"}
      </strong>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) {
    return "Unavailable";
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