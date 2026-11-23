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
}: {
  householdId?: string;
  householdName: string;
  ownerEmail: string;
  recoveryEmail?: string | null;
  canManage: boolean;
  hasRecoveryKey: boolean;
}) {
  const locale = useLocale() === "en" ? "en" : "pl";
  const pl = locale === "pl";
  const [dialogOpen, setDialogOpen] = useState(false);

  if (hasRecoveryKey) return null;

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
          <h2>
            {pl
              ? "Tryb tylko do odczytu — ustaw jednorazowy klucz odzyskania"
              : "Read-only mode — set your emergency recovery key"}
          </h2>
          <p>
            {canManage
              ? pl
                ? `Domostwo „${householdName}” nie ma aktywnego klucza odzyskania dostępu. Dopóki nie wygenerujesz i nie zabezpieczysz jednorazowego klucza, kartoteki pupili działają wyłącznie w trybie odczytu i eksportu.`
                : `Household "${householdName}" has no active recovery key. Until you generate one, pet records stay in read-only & export mode.`
              : pl
                ? `Domostwo „${householdName}” nie ma aktywnego klucza odzyskania, dlatego edycja kartotek jest tymczasowo zablokowana. Właściciel domostwa musi najpierw wygenerować klucz.`
                : `Household "${householdName}" has no active recovery key, so edits are locked until the household owner generates one.`}
          </p>
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
