"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { IconSparkles } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { Pet } from "@/features/pets/types";

const DischargeImportDialog = dynamic(
  () => import("./discharge-import-dialog").then((m) => m.DischargeImportDialog),
  { ssr: false },
);

interface DischargeImportButtonProps {
  pet: Pick<Pet, "id" | "imie"> & { gospodarstwo_id?: string };
  householdId?: string;
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "sm" | "md";
  className?: string;
}

export function DischargeImportButton({
  pet,
  householdId,
  variant = "secondary",
  size = "sm",
  className,
}: DischargeImportButtonProps) {
  const locale = useLocale();
  const pl = locale === "pl";
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        title={
          pl
            ? "Zaimportuj wielostronicowy wypis z lecznicy lub wyciąg leczenia (PDF)"
            : "Import clinical discharge or clinic history (PDF)"
        }
      >
        <IconSparkles size={16} aria-hidden="true" />
        <span>{pl ? "Zaimportuj wypis / kartotekę" : "Import clinical discharge"}</span>
      </Button>

      {open && (
        <DischargeImportDialog
          pet={pet}
          householdId={householdId || pet.gospodarstwo_id}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
