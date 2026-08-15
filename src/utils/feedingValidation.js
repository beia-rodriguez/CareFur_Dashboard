export const VALID_FEEDING_METHODS = [
  "manual",
  "automatic",
];

export function getFeedingValidationIssue(
  feeding,
  { requireInstructions = false } = {},
) {
  if (!feeding) {
    return { code: "missing-feeding" };
  }

  if (!VALID_FEEDING_METHODS.includes(feeding.method)) {
    return { code: "invalid-method" };
  }

  const schedules = feeding.schedules ?? [];

  if (schedules.length === 0) {
    return { code: "missing-schedules" };
  }

  for (let index = 0; index < schedules.length; index += 1) {
    const schedule = schedules[index];
    if (!schedule.time) {
      return { code: "missing-time", schedule, index };
    }

    if (!isValidTime(schedule.time)) {
      return { code: "invalid-time", schedule, index };
    }

    if (
      schedule.instructions != null &&
      typeof schedule.instructions !== "string"
    ) {
      return { code: "invalid-instructions", schedule, index };
    }

    if (requireInstructions && !schedule.instructions?.trim()) {
      return { code: "missing-instructions", schedule, index };
    }

    if (feeding.method === "automatic") {
      const compartment = Number(schedule.compartment);
      const portion = Number(schedule.portion);

      if (
        !Number.isInteger(compartment) ||
        compartment < 1 ||
        compartment > 3
      ) {
        return { code: "invalid-compartment", schedule, index };
      }

      if (!Number.isFinite(portion) || portion <= 0) {
        return { code: "invalid-portion", schedule, index };
      }
    }
  }

  return null;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
