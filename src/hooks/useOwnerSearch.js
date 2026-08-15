import { useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";

const OWNER_FIELDS = `
  id,
  full_name,
  email,
  phone
`;

function escapeIlikePattern(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export default function useOwnerSearch() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const latestRequestId = useRef(0);

  async function searchOwners(value) {
    const requestId = ++latestRequestId.current;
    const searchValue = value.trim();

    if (!searchValue) {
      setOwners([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    /*
     * Escape LIKE wildcard characters so the user's input
     * is searched literally rather than interpreted as a pattern.
     */
    const safeSearchValue =
      escapeIlikePattern(searchValue);

    const pattern = `%${safeSearchValue}%`;

    try {
      /*
       * Use separate .ilike() calls instead of interpolating
       * user input into Supabase's raw .or() filter syntax.
       */
      const results = await Promise.all([
        supabase
          .from("owners")
          .select(OWNER_FIELDS)
          .ilike("full_name", pattern)
          .limit(5),

        supabase
          .from("owners")
          .select(OWNER_FIELDS)
          .ilike("email", pattern)
          .limit(5),

        supabase
          .from("owners")
          .select(OWNER_FIELDS)
          .ilike("phone", pattern)
          .limit(5),
      ]);

      /*
       * Ignore this result if a newer search has already started.
       * This prevents an older, slower request from replacing
       * newer search results.
       */
      if (requestId !== latestRequestId.current) {
        return;
      }

      const queryError = results.find(
        (result) => result.error,
      )?.error;

      if (queryError) {
        throw queryError;
      }

      /*
       * An owner may match more than one field, so merge the
       * results and remove duplicates using the owner's ID.
       */
      const uniqueOwners = new Map();

      for (const result of results) {
        for (const owner of result.data ?? []) {
          uniqueOwners.set(owner.id, owner);
        }
      }

      setOwners(
        Array.from(uniqueOwners.values()).slice(0, 5),
      );
    } catch (searchError) {
      if (requestId !== latestRequestId.current) {
        return;
      }

      console.error(
        "Owner search error:",
        searchError,
      );

      setOwners([]);

      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to search for owners.",
      );
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }

  function clearOwnerSearch() {
    /*
     * Invalidates any currently running search request.
     */
    latestRequestId.current += 1;

    setOwners([]);
    setError(null);
    setLoading(false);
  }

  return {
    owners,
    loading,
    error,
    searchOwners,
    clearOwnerSearch,
  };
}