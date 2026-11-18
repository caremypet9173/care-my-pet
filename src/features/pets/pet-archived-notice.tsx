import { IconHeartHandshake, IconLock } from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/types";
import { petArchiveMessages } from "./archive-messages";
import { PetRestoreButton } from "./pet-archive-controls";
import type { Pet } from "./types";

export function PetArchivedBanner({
  pet,
  locale,
  isOwner,
}: {
  pet: Pet;
  locale: Locale;
  isOwner: boolean;
}) {
  if (!pet.archived_at) return null;
  const m = petArchiveMessages[locale] ?? petArchiveMessages.pl;
  const isDeceased = pet.archive_reason === "deceased";
  const reasonLabel = pet.archive_reason
    ? m.reasons[pet.archive_reason]?.label
    : null;

  return (
    <section
      className={`pet-archived-banner${isDeceased ? " is-deceased" : ""}`}
      aria-label={isDeceased ? m.bannerTitleDeceased : m.bannerTitleClosed}
    >
      <div className="pet-archived-banner-copy">
        <div className="pet-archived-banner-title">
          {isDeceased ? (
            <IconHeartHandshake size={18} aria-hidden="true" />
          ) : (
            <IconLock size={18} aria-hidden="true" />
          )}
          <span>
            {isDeceased ? m.bannerTitleDeceased : m.bannerTitleClosed}
            {reasonLabel && !isDeceased ? ` · ${reasonLabel}` : ""}
            {isDeceased && pet.closed_on ? ` · ${pet.closed_on}` : ""}
          </span>
        </div>
        <p>{isOwner ? m.bannerBodyOwner : m.bannerBodyMember}</p>
        {pet.archive_note && (
          <p className="pet-archived-banner-note">{pet.archive_note}</p>
        )}
      </div>
      {isOwner && (
        <div className="pet-archived-banner-actions">
          <PetRestoreButton petId={pet.id} petName={pet.imie} />
        </div>
      )}
    </section>
  );
}

export function PetArchivedBlockedCard({
  pet,
  locale,
  isOwner = false,
}: {
  pet: Pet;
  locale: Locale;
  isOwner?: boolean;
}) {
  const m = petArchiveMessages[locale] ?? petArchiveMessages.pl;

  return (
    <section className="pet-archived-blocked-card">
      <h2>
        <IconLock size={20} aria-hidden="true" />
        {m.subpageBlockedTitle}
      </h2>
      <p>{m.subpageBlockedBody}</p>
      <div className="pet-archived-blocked-actions">
        <Link className="button button--primary" href={`/app/zwierzeta/${pet.id}`}>
          ← {m.backToRecord}
        </Link>
        {isOwner && <PetRestoreButton petId={pet.id} petName={pet.imie} />}
      </div>
    </section>
  );
}
