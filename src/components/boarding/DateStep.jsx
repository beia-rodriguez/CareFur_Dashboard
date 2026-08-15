export default function DateStep({
  formData,
  updateForm,
}) {

  return (

    <>
      <h2>
        Select Dates
      </h2>


      <p className="boarding-description">
        Choose the check-in and expected checkout date.
      </p>


      <div className="boarding-fields">


        <label>

          Check-in Date

          <input
            type="date"
            value={formData.checkIn}
            onChange={(event) =>
              updateForm(
                "checkIn",
                event.target.value
              )
            }
          />

        </label>



        <label>

          Expected Checkout

          <input
            type="date"
            value={formData.checkOut}
            onChange={(event) =>
              updateForm(
                "checkOut",
                event.target.value
              )
            }
          />

        </label>


      </div>

    </>

  );

}