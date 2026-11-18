import Image from "next/image";
import { assets } from "@/lib/assets";
import type { Locale } from "@/i18n/types";
import { PetIcon } from "./pet-icon";
import { GuardianNoteCard } from "./guardian-note-card";
import { petMessages } from "./messages";
import { dashboardMessages } from "./dashboard-messages";
import { petArchiveMessages } from "./archive-messages";
import type { Pet } from "./types";

export function PetHeroCover({
  pet,
  locale,
  badgeLabel,
  updatedLabel,
  editHref,
}: {
  pet: Pet;
  locale: Locale;
  badgeLabel: string;
  updatedLabel?: string;
  editHref?: string;
}) {
  const t = petMessages[locale];
  const d = dashboardMessages[locale];
  const tags = pet.tagi ?? [];

  const identificationLabel =
    pet.identyfikacja === "none" || pet.identyfikacja === "unknown"
      ? `${t.identyfikacja}: ${t[pet.identyfikacja].toLocaleLowerCase(locale)}`
      : t[pet.identyfikacja];

  return (
    <section
      className={`household-cover${
        pet.archived_at
          ? pet.archive_reason === "deceased"
            ? " household-cover--archived household-cover--deceased"
            : " household-cover--archived"
          : ""
      }`}
    >
      <Image
        src={assets.lunaCover}
        alt=""
        fill
        sizes="(min-width: 1280px) 1184px, 100vw"
        className="household-cover-image"
        preload
      />
      <div className="household-cover-top">
        <span>
          {pet.archived_at
            ? pet.archive_reason === "deceased"
              ? `${petArchiveMessages[locale].heroBadgeDeceased}${
                  pet.closed_on
                    ? pet.data_urodzenia
                      ? ` · ${pet.data_urodzenia.slice(0, 4)}–${pet.closed_on.slice(0, 4)}`
                      : ` · ${pet.closed_on}`
                    : ""
                }`
              : petArchiveMessages[locale].heroBadgeClosed
            : badgeLabel}
        </span>
        {updatedLabel ? <small>{updatedLabel}</small> : null}
      </div>
      <div className="household-profile-glass">
        <div className="household-profile-identity">
          <div className="household-portrait">
            <PetIcon
              species={pet.gatunek}
              src={pet.avatar_url}
              name={pet.imie}
            />
            {!pet.avatar_url && <small>{d.noPhoto}</small>}
          </div>
          <div className="household-profile-details">
            <div className="household-profile-name">
              <h1>{pet.imie}</h1>
              <span className="household-tag">{t[pet.gatunek]}</span>
            </div>
            <p>
              {pet.rasa || t.missing} · {t[pet.plec]}
            </p>
            <div className="household-profile-tags">
              <span className="household-tag">
                {t.kastracja}:{" "}
                {pet.kastracja == null
                  ? t.unknown
                  : pet.kastracja
                    ? t.yes
                    : t.no}
              </span>
              <span className="household-tag">
                {identificationLabel}
                {pet.numer_id ? `: ${pet.numer_id}` : ""}
              </span>
            </div>
            {tags.length > 0 && (
              <div className="household-profile-care-tags" aria-label={t.tagi}>
                {tags.map((tag) => (
                  <span key={tag} className="household-care-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <GuardianNoteCard
          petName={pet.imie}
          note={pet.notatki}
          buttonLabel={t.aboutMe}
          dialogTitle={t.notatki}
          locale={locale}
          editHref={pet.archived_at ? undefined : editHref}
        />
      </div>
    </section>
  );
}
