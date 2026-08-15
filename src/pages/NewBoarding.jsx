import { useState } from "react";

import useRooms from "../hooks/useRooms";
import usePets from "../hooks/usePets";
import useCreateBooking from "../hooks/useCreateBooking";
import { getFeedingValidationIssue } from "../utils/feedingValidation";

import DateStep from "../components/boarding/DateStep";
import RoomStep from "../components/boarding/RoomStep";
import PetStep from "../components/boarding/PetStep";
import CustomerModal from "../components/boarding/CustomerModal";
import FeedingStep from "../components/boarding/FeedingStep";
import ReviewStep from "../components/boarding/ReviewStep";
import AccessCodeStep from "../components/boarding/AccessCodeStep";

import "./NewBoarding.css";

function createInitialFormData() {
  return {
    checkIn: "",
    checkOut: "",
    roomId: null,
    petId: null,
    ownerId: null,
    newCustomer: null,

    feeding: {
      method: "manual",
      schedules: [],
    },
  };
}

export default function NewBoarding() {
  const [step, setStep] =
    useState(1);

  const [petSearch, setPetSearch] =
    useState("");

  const [
    selectedPet,
    setSelectedPet,
  ] = useState(null);

  const [
    showCustomer,
    setShowCustomer,
  ] = useState(false);

  const [
    validationError,
    setValidationError,
  ] = useState("");

  const [
    formData,
    setFormData,
  ] = useState(
    createInitialFormData,
  );

  const [
    bookingResult,
    setBookingResult,
  ] = useState(null);

  const {
    rooms = [],
    loading: roomsLoading,
    error: roomsError,
  } = useRooms(
    formData.checkIn,
    formData.checkOut,
  );

  const {
    pets = [],
    loading: petsLoading,
  } = usePets(petSearch);

  const {
    creating,
    error: createError,
    createBooking,
    clearError,
    resetBookingResult,
  } = useCreateBooking();

  const selectedRoom =
    rooms.find(
      (room) =>
        room.id ===
        formData.roomId,
    ) ?? null;

  const displayedError =
    validationError ||
    createError ||
    roomsError;

  function updateForm(field, value) {
    setFormData((currentFormData) => {
      const datesChanged =
        (field === "checkIn" || field === "checkOut") &&
        currentFormData[field] !== value;

      // First, apply the new field value
      const newFormData = {
        ...currentFormData,
        [field]: value,
      };

      // Then, if the dates changed, reset the room selection
      // because a room selected for old dates may no longer be available.
      if (datesChanged) {
        newFormData.roomId = null;
      }

      return newFormData;
    });
  }

  function clearPageError() {
    setValidationError("");
    clearError?.();
  }

  async function nextStep() {
    if (creating) {
      return;
    }

    clearPageError();
    /*
     * Steps 1–4 move forward after validation.
     */
    if (step <= 4) {
      const validationMessage =
        getStepValidationMessage({
          step,
          formData,
          rooms,
          roomsLoading,
        });

      if (validationMessage) {
        setValidationError(validationMessage);
        return;
      }

      setStep(
        (currentStep) =>
          currentStep + 1,
      );

      return;
    }

    /*
     * Step 5 creates the real booking.
     */
    if (step === 5) {
      await submitBooking();
      return;
    }

    /*
     * Step 6 starts another booking.
     */
    resetForm();
  }

  async function submitBooking() {
    try {
      const result =
        await createBooking(formData);

      setBookingResult(result);
      setStep(6);
    } catch {
      /*
       * useCreateBooking stores the
       * returned error message.
       */
    }
  }

  function previousStep() {
    if (
      creating ||
      step <= 1 ||
      step === 6
    ) {
      return;
    }

    clearPageError();

    setStep(
      (currentStep) =>
        Math.max(
          currentStep - 1,
          1,
        ),
    );
  }

  function resetForm() {
    setStep(1);

    setFormData(
      createInitialFormData(),
    );

    setPetSearch("");
    setSelectedPet(null);
    setShowCustomer(false);
    setValidationError("");
    setBookingResult(null);

    resetBookingResult?.();
  }

  return (
    <section className="boarding-page">
      <header className="boarding-header">
        <p>CareFur</p>

        <h1>New Boarding</h1>

        <span>
          Create a new pet boarding session
        </span>
      </header>

      <div className="boarding-step">
        <p className="boarding-step-count">
          Step {step} of 6
        </p>

        {displayedError && (
          <p
            className="customer-error"
            role="alert"
          >
            {displayedError}
          </p>
        )}

        {step === 1 && (
          <DateStep
            formData={formData}
            updateForm={
              updateForm
            }
          />
        )}

        {step === 2 && (
          <RoomStep
            rooms={rooms}
            loading={
              roomsLoading
            }
            selectedRoom={
              formData.roomId
            }
            updateForm={
              updateForm
            }
          />
        )}

        {step === 3 && (
          <PetStep
            pets={pets}
            loading={
              petsLoading
            }
            petSearch={
              petSearch
            }
            setPetSearch={
              setPetSearch
            }
            formData={
              formData
            }
            updateForm={
              updateForm
            }
            selectedPet={
              selectedPet
            }
            setSelectedPet={
              setSelectedPet
            }
            openCustomer={() =>
              setShowCustomer(
                true,
              )
            }
          />
        )}

        {step === 4 && (
          <FeedingStep
            formData={
              formData
            }
            updateForm={
              updateForm
            }
          />
        )}

        {step === 5 && (
          <ReviewStep
            formData={
              formData
            }
            selectedRoom={
              selectedRoom
            }
            selectedPet={
              selectedPet
            }
          />
        )}

        {step === 6 && (
          <AccessCodeStep
            result={
              bookingResult
            }
          />
        )}

        <div className="boarding-actions">
          {step > 1 &&
            step < 6 && (
              <button
                type="button"
                className="boarding-back"
                onClick={
                  previousStep
                }
                disabled={
                  creating
                }
              >
                Back
              </button>
            )}

          <button
            type="button"
            className="boarding-next"
            onClick={
              nextStep
            }
            disabled={
              creating
            }
          >
            {getPrimaryButtonText(
              step,
              creating,
            )}
          </button>
        </div>
      </div>

      {showCustomer && (
        <CustomerModal
          close={() =>
            setShowCustomer(
              false,
            )
          }
          setFormData={
            setFormData
          }
          setSelectedPet={
            setSelectedPet
          }
        />
      )}
    </section>
  );
}

function getStepValidationMessage({
  step,
  formData,
  rooms,
  roomsLoading,
}) {
  if (step === 1) {
    return getDateValidationMessage(formData);
  }

  if (step === 2) {
    return getRoomValidationMessage({
      formData,
      rooms,
      roomsLoading,
    });
  }

  if (
    step === 3 &&
    !formData.petId &&
    !formData.newCustomer
  ) {
    return "Please select an existing pet or create a new customer.";
  }

  if (step === 4) {
    return getFeedingStepValidationMessage(formData.feeding);
  }

  return null;
}

function getDateValidationMessage(formData) {
  if (!formData.checkIn || !formData.checkOut) {
    return "Please select check-in and check-out dates.";
  }

  const checkIn = new Date(formData.checkIn);
  const checkOut = new Date(formData.checkOut);

  if (
    Number.isNaN(checkIn.getTime()) ||
    Number.isNaN(checkOut.getTime())
  ) {
    return "Please select valid boarding dates.";
  }

  return checkOut <= checkIn
    ? "Check-out must be after check-in."
    : null;
}

function getRoomValidationMessage({
  formData,
  rooms,
  roomsLoading,
}) {
  if (roomsLoading) {
    return "Please wait while room availability is being checked.";
  }

  if (!formData.roomId) {
    return "Please select a room first.";
  }

  const room =
    rooms.find((item) => item.id === formData.roomId) ??
    null;

  if (!room) {
    return "The selected room could not be found.";
  }

  return room.isAvailable === true
    ? null
    : room.availabilityMessage ||
        "The selected room is unavailable for these dates.";
}

function getFeedingStepValidationMessage(feeding) {
  const issue = getFeedingValidationIssue(feeding, {
    requireInstructions: true,
  });

  if (!issue) {
    return null;
  }

  const scheduleName = formatFeedingScheduleName(
    issue.schedule?.period,
  );

  const messages = {
    "missing-feeding": "Feeding information is missing.",
    "invalid-method": "Please select a valid feeding method.",
    "missing-schedules": "Please add at least one feeding schedule.",
    "missing-time": `Please select a feeding time for ${scheduleName}.`,
    "invalid-time": `Please select a valid feeding time for ${scheduleName}.`,
    "invalid-instructions": `Please enter valid feeding instructions for ${scheduleName}.`,
    "missing-instructions": `Please enter feeding instructions for ${scheduleName}.`,
    "invalid-compartment": `Please select a valid feeder compartment for ${scheduleName}.`,
    "invalid-portion": `Please enter a valid portion for ${scheduleName}.`,
  };

  return messages[issue.code];
}

function formatFeedingScheduleName(period) {
  if (!period) {
    return "the feeding schedule";
  }

  return period.charAt(0).toUpperCase() + period.slice(1);
}

function getPrimaryButtonText(
  step,
  creating,
) {
  if (
    step === 5 &&
    creating
  ) {
    return "Creating Booking...";
  }

  if (step === 5) {
    return "Create Booking";
  }

  if (step === 6) {
    return "Create Another Booking";
  }

  return "Continue";
}

