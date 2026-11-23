"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { IconKey, IconLock } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const RecoveryKeyDialog = dynamic(
  () => import("./recovery-key-controls").then((m) => m.RecoveryKeyDialog),
  { ssr: false },
);

export function HouseholdRecoveryBanner({
  householdId,
  householdName,
  ownerEmail,
  recoveryEmail,
  canManage,
  hasRecoveryKey,
  isEmptyHousehold = false,
}: {
  householdId?: string;
  householdName: string;
  ownerEmail: string;
  recoveryEmail?: string | null;
  canManage: boolean;
  hasRecoveryKey: boolean;
  isEmptyHousehold?: boolean;
}) {
  const locale = useLocale() === "en" ? "en" : "pl";
  const pl = locale === "pl";
  const [dialogOpen, setDialogOpen] = useState(false);

  if (hasRecoveryKey) return null;

  const heading =
    isEmptyHousehold && canManage
      ? pl
        ? "Krok 1: Wygeneruj klucz odzyskania, aby dodać pierwszego pupila"
        : "Step 1: Set your recovery key to add your first pet"
      : pl
        ? "Tryb tylko do odczytu — ustaw jednorazowy klucz odzyskania"
        : "Read-only mode — set your emergency recovery key";

  const description = canManage
    ? isEmptyHousehold
      ? pl
        ? `Nowe domostwo „${householdName}” wymaga ustawienia jednorazowego klucza odzyskania dostępu. Zapisz go raz (PDF lub menedżer haseł), aby natychmiast odblokować dodawanie i edycję kartotek pupili.`
        : `Your new household "${householdName}" requires a one-time recovery key first. Save it once (PDF or password manager) to immediately unlock adding and editing pet records.`
      : pl
        ? `Domostwo „${householdName}” nie ma aktywnego klucza odzyskania dostępu. Dopóki nie wygenerujesz i nie zabezpieczysz jednorazowego klucza, kartoteki pupili działają wyłącznie w trybie odczytu i eksportu.`
        : `Household "${householdName}" has no active recovery key. Until you generate one, pet records stay in read-only & export mode.`
    : pl
      ? `Domostwo „${householdName}” nie ma aktywnego klucza odzyskania, dlatego edycja kartotek jest tymczasowo zablokowana. Właściciel domostwa musi najpierw wygenerować klucz.`
      : `Household "${householdName}" has no active recovery key, so edits are locked until the household owner generates one.`;

  return (
    <>
      <section
        className="recovery-readonly-banner"
        role="status"
        aria-live="polite"
      >
        <div className="recovery-readonly-banner-icon" aria-hidden="true">
          <IconLock size={20} />
        </div>
        <div className="recovery-readonly-banner-content">
          <h2>{heading}</h2>
          <p>{description}</p>
        </div>
        <div className="recovery-readonly-banner-actions">
          {canManage ? (
            <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
              <IconKey size={16} aria-hidden="true" />
              {pl ? "Wygeneruj klucz odzyskania" : "Generate recovery key"}
            </Button>
          ) : (
            <Link href="/app/household" className="btn btn-secondary btn-sm">
              {pl ? "Ustawienia domostwa" : "Household settings"}
            </Link>
          )}
        </div>
      </section>

      {canManage && dialogOpen && (
        <RecoveryKeyDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          householdId={householdId}
          householdName={householdName}
          ownerEmail={ownerEmail}
          recoveryEmail={recoveryEmail}
          hasExistingKey={false}
        />
      )}
    </>
  );
}

export function RecoveryKeyActionButton({
  householdId,
  householdName,
  ownerEmail,
  recoveryEmail,
  label,
}: {
  householdId?: string;
  householdName: string;
  ownerEmail: string;
  recoveryEmail?: string | null;
  label: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
        <IconKey size={16} aria-hidden="true" />
        {label}
      </Button>
      {dialogOpen && (
        <RecoveryKeyDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          householdId={householdId}
          householdName={householdName}
          ownerEmail={ownerEmail}
          recoveryEmail={recoveryEmail}
          hasExistingKey={false}
        />
      )}
    </>
  );
}
