import {
  ArrowClockwise,
  EnvelopeSimple,
  MagnifyingGlass,
  PawPrint,
  Phone,
} from "@phosphor-icons/react";
import { useState } from "react";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import usePets from "../hooks/usePets";
import "./Pets.css";

export default function Pets() {
  const [search, setSearch] = useState("");
  const { pets, loading, error, refetchPets } = usePets(search);

  return (
    <section className="pets-page">
      <PageHeader
        title="Pets"
        description="View pet profiles, owner contact information, and feeding notes in one place."
        actions={
          <Button variant="secondary" onClick={refetchPets}>
            <ArrowClockwise size={17} /> Refresh
          </Button>
        }
      />

      <div className="pets-toolbar">
        <MagnifyingGlass size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search pet name..."
          aria-label="Search pets"
        />
      </div>

      {error && <div className="page-alert page-alert--error">{error}</div>}

      {loading ? (
        <div className="page-loading">Loading pets…</div>
      ) : pets.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title="No pets found"
          message={search ? "Try another pet name." : "Pet profiles will appear here once they are added."}
        />
      ) : (
        <div className="pets-grid">
          {pets.map((pet) => (
            <article key={pet.id} className="pet-profile-card">
              <div className="pet-profile-card__top">
                <div className="pet-avatar">
                  <PawPrint size={22} weight="fill" />
                </div>
                <div className="pet-profile-card__identity">
                  <h2>{pet.name || "Unnamed pet"}</h2>
                  <p>{[pet.species, pet.breed].filter(Boolean).join(" • ") || "Pet profile"}</p>
                </div>
                {pet.sex && <Badge tone="info">{pet.sex}</Badge>}
              </div>

              <div className="pet-owner-card">
                <span className="pet-section-label">Primary owner</span>
                <strong>{pet.owner?.full_name || "No linked owner"}</strong>

                {pet.owner?.email && (
                  <a className="pet-contact-line" href={`mailto:${pet.owner.email}`}>
                    <EnvelopeSimple size={16} />
                    <span>{pet.owner.email}</span>
                  </a>
                )}

                {pet.owner?.phone && (
                  <a className="pet-contact-line" href={`tel:${pet.owner.phone}`}>
                    <Phone size={16} />
                    <span>{pet.owner.phone}</span>
                  </a>
                )}
              </div>

              <dl className="pet-meta">
                <div>
                  <dt>Weight</dt>
                  <dd>{pet.weight_kg ? `${pet.weight_kg} kg` : "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Owners</dt>
                  <dd>{pet.owners?.length || 0}</dd>
                </div>
              </dl>

              {pet.feeding_notes && (
                <div className="pet-note">
                  <span>Feeding notes</span>
                  <p>{pet.feeding_notes}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
