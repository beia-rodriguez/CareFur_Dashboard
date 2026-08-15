import { useState } from "react";

import useOwnerSearch from "../../hooks/useOwnerSearch";

export default function CustomerModal({
  close,
  setFormData,
  setSelectedPet,
}) {
  const {
    owners,
    loading,
    error: ownerSearchError,
    searchOwners,
    clearOwnerSearch,
  } = useOwnerSearch();

  const [ownerSearch, setOwnerSearch] =
    useState("");

  const [selectedOwner, setSelectedOwner] =
    useState(null);

  const [newOwner, setNewOwner] =
    useState(false);

  const [form, setForm] = useState({
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    petName: "",
    species: "",
    otherSpecies: "",
    breed: "",
    sex: "",
  });

  const [error, setError] = useState("");

  function update(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function selectExistingOwner(owner) {
    setSelectedOwner(owner);
    setNewOwner(false);
    setError("");
  }

  function startNewOwner() {
    setSelectedOwner(null);
    setNewOwner(true);
    setError("");

    clearOwnerSearch?.();
  }

  async function handleOwnerSearch(event) {
    event.preventDefault();

    const searchValue = ownerSearch.trim();

    if (!searchValue) {
      setError(
        "Enter an owner name, email, or phone number.",
      );
      return;
    }

    setError("");

    await searchOwners(searchValue);
  }

  function save() {
    setError("");

    const ownerName = form.ownerName.trim();
    const ownerEmail = form.ownerEmail
      .trim()
      .toLowerCase();
    const ownerPhone = form.ownerPhone.trim();

    const petName = form.petName.trim();
    const breed = form.breed.trim();

    const species =
      form.species === "other"
        ? form.otherSpecies.trim()
        : form.species;

    if (!selectedOwner && !newOwner) {
      setError(
        "Select an existing owner or create a new owner.",
      );
      return;
    }

    if (newOwner && !ownerName) {
      setError("Owner name is required.");
      return;
    }

    if (newOwner && !ownerEmail) {
      setError("Owner email is required.");
      return;
    }

    if (
      newOwner &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        ownerEmail,
      )
    ) {
      setError(
        "Enter a valid owner email address.",
      );
      return;
    }

    if (!petName) {
      setError("Pet name is required.");
      return;
    }

    if (!form.species) {
      setError("Select the pet's species.");
      return;
    }

    if (
      form.species === "other" &&
      !form.otherSpecies.trim()
    ) {
      setError("Specify the pet's species.");
      return;
    }

    const owner = selectedOwner ?? {
      id: null,
      full_name: ownerName,
      email: ownerEmail,
      phone: ownerPhone || null,
    };

    const pet = {
      name: petName,
      species,
      breed: breed || null,
      sex: form.sex || null,
    };

    /*
     * A new pet has not been saved to the database yet,
     * so petId remains null.
     *
     * ownerId is populated only when an existing owner
     * was selected.
     */
    setFormData((currentFormData) => ({
      ...currentFormData,
      petId: null,
      ownerId: selectedOwner?.id ?? null,

      newCustomer: {
        owner,
        pet,
        isNewOwner: newOwner,
      },
    }));

    /*
     * Remove any previously selected existing pet.
     */
    setSelectedPet?.(null);

    close();
  }

  function handleClose() {
    if (loading) {
      return;
    }

    clearOwnerSearch?.();
    close();
  }

  return (
    <div
      className="customer-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <div
        className="customer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
      >
        <h2 id="customer-modal-title">
          New Pet Customer
        </h2>

        {error && (
          <p
            className="customer-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {ownerSearchError && (
          <p
            className="customer-error"
            role="alert"
          >
            {ownerSearchError}
          </p>
        )}

        <h3>Search Owner</h3>

        <form
          className="owner-search-row"
          onSubmit={handleOwnerSearch}
        >
          <input
            type="search"
            placeholder="Name, email, phone"
            value={ownerSearch}
            onChange={(event) =>
              setOwnerSearch(event.target.value)
            }
            disabled={loading}
          />

          <button
            type="submit"
            disabled={
              loading || !ownerSearch.trim()
            }
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {owners.map((owner) => (
          <button
            key={owner.id}
            type="button"
            className={
              selectedOwner?.id === owner.id
                ? "owner-card owner-card-selected"
                : "owner-card"
            }
            onClick={() =>
              selectExistingOwner(owner)
            }
          >
            <strong>{owner.full_name}</strong>

            {owner.email && (
              <small>{owner.email}</small>
            )}

            {owner.phone && (
              <small>{owner.phone}</small>
            )}
          </button>
        ))}

        <button
          type="button"
          className={
            newOwner
              ? "boarding-new-button owner-card-selected"
              : "boarding-new-button"
          }
          onClick={startNewOwner}
        >
          + New Owner
        </button>

        {selectedOwner && (
          <p>
            Selected owner:{" "}
            <strong>
              {selectedOwner.full_name}
            </strong>
          </p>
        )}

        {newOwner && (
          <>
            <h3>Owner Information</h3>

            <label>
              Owner Name

              <input
                type="text"
                value={form.ownerName}
                onChange={(event) =>
                  update(
                    "ownerName",
                    event.target.value,
                  )
                }
                required
              />
            </label>

            <label>
              Email

              <input
                type="email"
                value={form.ownerEmail}
                onChange={(event) =>
                  update(
                    "ownerEmail",
                    event.target.value,
                  )
                }
                required
              />
            </label>

            <label>
              Phone

              <input
                type="tel"
                value={form.ownerPhone}
                onChange={(event) =>
                  update(
                    "ownerPhone",
                    event.target.value,
                  )
                }
              />
            </label>
          </>
        )}

        <h3>Pet Information</h3>

        <label>
          Pet Name

          <input
            type="text"
            value={form.petName}
            onChange={(event) =>
              update(
                "petName",
                event.target.value,
              )
            }
            required
          />
        </label>

        <label>
          Species

          <select
            value={form.species}
            onChange={(event) =>
              update(
                "species",
                event.target.value,
              )
            }
            required
          >
            <option value="">
              Select
            </option>

            <option value="dog">
              Dog
            </option>

            <option value="cat">
              Cat
            </option>

            <option value="other">
              Other
            </option>
          </select>
        </label>

        {form.species === "other" && (
          <label>
            Specify Species

            <input
              type="text"
              value={form.otherSpecies}
              onChange={(event) =>
                update(
                  "otherSpecies",
                  event.target.value,
                )
              }
              required
            />
          </label>
        )}

        <label>
          Breed

          <input
            type="text"
            value={form.breed}
            onChange={(event) =>
              update(
                "breed",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          Sex

          <select
            value={form.sex}
            onChange={(event) =>
              update(
                "sex",
                event.target.value,
              )
            }
          >
            <option value="">
              Select
            </option>

            <option value="male">
              Male
            </option>

            <option value="female">
              Female
            </option>

            <option value="unknown">
              Unknown
            </option>
          </select>
        </label>

        <div className="customer-modal-actions">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="boarding-next"
            onClick={save}
            disabled={loading}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}