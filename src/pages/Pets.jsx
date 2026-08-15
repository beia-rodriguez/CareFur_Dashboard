import usePets from "../hooks/usePets";
import "./Pets.css";

export default function Pets() {

  const {
    pets,
    loading,
  } = usePets();

  return (

    <section className="pets-page">

      <header className="pets-page-header">

        <div>
          <p>CareFur</p>

          <h1>
            Pets
          </h1>

          <span>
            Manage boarded pets
          </span>
        </div>

      </header>


      {
        loading ? (

          <p>
            Loading pets...
          </p>

        ) : (

          <div className="pets-list">

            {
              pets.map((pet) => (

                <article
                  key={pet.id}
                  className="pet-card"
                >

                  <h2>
                    {pet.name}
                  </h2>


                  <p>
                    {pet.species}
                    {
                      pet.breed &&
                      ` • ${pet.breed}`
                    }
                  </p>


                  <small>
                    Owner:{" "}
                    {pet.owner?.full_name || "No owner"}
                  </small>


                  {
                    pet.sex && (
                      <small>
                        Sex:
                        {" "}
                        {pet.sex}
                      </small>
                    )
                  }


                  {
                    pet.feeding_notes && (
                      <small>
                        Feeding:
                        {" "}
                        {pet.feeding_notes}
                      </small>
                    )
                  }

                </article>

              ))
            }

          </div>

        )
      }

    </section>

  );
}
