import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function usePets(search = "") {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchPets() {
      setLoading(true);

      try {
        let petsQuery = supabase
          .from("pets")
          .select(`
            id,
            name,
            species,
            breed,
            sex,
            birth_date,
            weight_kg,
            allergies,
            medical_notes,
            feeding_notes
          `)
          .order("name");


        if (search) {
          petsQuery = petsQuery.ilike(
            "name",
            `%${search}%`
          );
        }


        const {
          data: petsData,
          error: petsError,
        } = await petsQuery;


        if (petsError) {
          throw petsError;
        }


        const {
          data: ownerLinks,
          error: ownerLinksError,
        } = await supabase
          .from("pet_owner_links")
          .select(`
            pet_id,
            owner_id,
            owners (
              id,
              full_name,
              email,
              phone
            )
          `);


        if (ownerLinksError) {
          throw ownerLinksError;
        }


        const mergedPets = (petsData ?? []).map(
          (pet) => {

            const ownerLink =
              ownerLinks?.find(
                (link) =>
                  link.pet_id === pet.id
              );

            return {
              ...pet,
              owner:
                ownerLink?.owners ?? null,
            };

          }
        );

        setPets(mergedPets);


      } catch (error) {

        console.error(
          "Failed loading pets:",
          error
        );

        setPets([]);

      } finally {

        setLoading(false);

      }
    }


    fetchPets();

  }, [search]);


  return {
    pets,
    loading,
  };
}
