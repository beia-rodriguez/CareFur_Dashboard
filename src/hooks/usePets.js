import { useCallback, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function usePets(search = "") {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refetchPets = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchPets() {
      setLoading(true);
      setError("");

      try {
        let petQuery = supabase
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
            feeding_notes,
            photo_url
          `)
          .order("name", { ascending: true });

        const normalizedSearch = search.trim();
        if (normalizedSearch) {
          petQuery = petQuery.ilike("name", `%${escapeIlike(normalizedSearch)}%`);
        }

        const { data: petsData, error: petsError } = await petQuery;
        if (petsError) throw petsError;

        const petIds = (petsData ?? []).map((pet) => pet.id);
        let ownerLinks = [];

        if (petIds.length > 0) {
          const { data, error: linksError } = await supabase
            .from("pet_owner_links")
            .select(`
              id,
              pet_id,
              owner_id,
              relationship,
              is_primary,
              owner:owners!pet_owner_links_owner_id_fkey (
                id,
                full_name,
                email,
                phone,
                notes
              )
            `)
            .in("pet_id", petIds)
            .order("is_primary", { ascending: false });

          if (linksError) throw linksError;
          ownerLinks = data ?? [];
        }

        const ownersByPet = new Map();
        for (const link of ownerLinks) {
          if (!ownersByPet.has(link.pet_id)) ownersByPet.set(link.pet_id, []);
          if (link.owner) {
            ownersByPet.get(link.pet_id).push({
              ...link.owner,
              relationship: link.relationship,
              is_primary: link.is_primary,
            });
          }
        }

        const normalizedPets = (petsData ?? []).map((pet) => {
          const owners = ownersByPet.get(pet.id) ?? [];
          const primaryOwner = owners.find((owner) => owner.is_primary) ?? owners[0] ?? null;
          return {
            ...pet,
            owner: primaryOwner,
            owners,
          };
        });

        if (!cancelled) setPets(normalizedPets);
      } catch (fetchError) {
        console.error("Failed loading pets:", fetchError);
        if (!cancelled) {
          setPets([]);
          setError(fetchError?.message || "Unable to load pets.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPets();
    return () => {
      cancelled = true;
    };
  }, [search, refreshKey]);

  return { pets, loading, error, refetchPets };
}

function escapeIlike(value) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
