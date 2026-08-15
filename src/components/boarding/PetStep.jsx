export default function PetStep({
  pets = [],
  loading,
  petSearch,
  setPetSearch,
  formData,
  updateForm,
  selectedPet,
  setSelectedPet,
  openCustomer,
}) {
  function selectExistingPet(pet) {
    updateForm("petId", pet.id);
    updateForm("ownerId", pet.owner?.id ?? null);
    updateForm("newCustomer", null);

    setSelectedPet(pet);
  }

  function selectNewCustomer() {
    const newCustomer = formData.newCustomer;

    if (!newCustomer) {
      return;
    }

    /*
     * The new pet has not been inserted into the
     * database yet, so it does not have a petId.
     *
     * ownerId will exist only when the user selected
     * an existing owner in CustomerModal.
     */
    updateForm("petId", null);
    updateForm(
      "ownerId",
      newCustomer.owner?.id ?? null,
    );

    setSelectedPet(null);
  }

  const hasSearch =
    Boolean(petSearch?.trim());

  return (
    <>
      <h2>Select Pet</h2>

      <p className="boarding-description">
        Search for an existing pet or create a new
        pet customer.
      </p>

      <input
        type="search"
        className="boarding-search"
        placeholder="Search pet name..."
        value={petSearch}
        onChange={(event) =>
          setPetSearch(event.target.value)
        }
      />

      <div className="pet-list">
        {formData.newCustomer && (
          <button
            type="button"
            className="pet-card pet-card-selected"
            onClick={selectNewCustomer}
          >
            <strong>
              {formData.newCustomer.pet.name}
            </strong>

            <span>
              {formatPetDescription(
                formData.newCustomer.pet,
              )}
            </span>

            <small>
              Owner:{" "}
              {formData.newCustomer.owner
                ?.full_name || "New owner"}
            </small>

            <small>
              New pet — will be created with the
              booking
            </small>
          </button>
        )}

        {loading && (
          <p className="boarding-description">
            Loading pets...
          </p>
        )}

        {!loading &&
          pets.map((pet) => {
            const isSelected =
              formData.petId === pet.id;

            return (
              <button
                key={pet.id}
                type="button"
                className={
                  isSelected
                    ? "pet-card pet-card-selected"
                    : "pet-card"
                }
                aria-pressed={isSelected}
                onClick={() =>
                  selectExistingPet(pet)
                }
              >
                <strong>
                  {pet.name ||
                    "Unnamed pet"}
                </strong>

                <span>
                  {formatPetDescription(pet)}
                </span>

                <small>
                  Owner:{" "}
                  {pet.owner?.full_name ||
                    "No owner linked"}
                </small>
              </button>
            );
          })}

        {!loading &&
          pets.length === 0 &&
          hasSearch &&
          !formData.newCustomer && (
            <p className="boarding-description">
              No pets matched your search.
            </p>
          )}

        {!loading &&
          pets.length === 0 &&
          !hasSearch &&
          !formData.newCustomer && (
            <p className="boarding-description">
              Search for a pet or create a new
              customer.
            </p>
          )}
      </div>

      <button
        type="button"
        className="boarding-new-button"
        onClick={openCustomer}
      >
        + Create New Customer
      </button>
    </>
  );
}

function formatPetDescription(pet) {
  const details = [
    pet?.species,
    pet?.breed,
  ].filter(Boolean);

  return details.length > 0
    ? details.join(" • ")
    : "Pet information unavailable";
}