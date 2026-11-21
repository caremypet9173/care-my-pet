"use client";

import { useEffect, useRef, useState } from "react";
import { IconCat, IconChevronDown, IconDog, IconUpload } from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/button";
import type { Pet } from "./types";

interface PickerPet {
  id: string;
  imie: string;
  gatunek: Pet["gatunek"];
}

export function DashboardUploadPicker({
  pets,
  label,
  locale,
}: {
  pets: PickerPet[];
  label: string;
  locale: "pl" | "en";
}) {
  const pl = locale === "pl";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (pets.length === 0) return null;

  if (pets.length === 1) {
    return (
      <ButtonLink
        variant="secondary"
        size="sm"
        href={`/app/pets/${pets[0].id}/results/new`}
      >
        <IconUpload size={16} aria-hidden="true" />
        {label}
      </ButtonLink>
    );
  }

  return (
    <div className="dashboard-upload-picker" ref={rootRef}>
      <button
        type="button"
        className="button button--secondary button--sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconUpload size={16} aria-hidden="true" />
        <span>{label}</span>
        <IconChevronDown size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="dashboard-upload-menu"
          role="menu"
          aria-label={pl ? "Wybierz pupila dla badania" : "Choose pet for report"}
        >
          <span className="dashboard-upload-menu-title">
            {pl ? "Dla którego pupila dodać badanie?" : "Which pet is this report for?"}
          </span>
          {pets.map((pet) => {
            const SpeciesIcon = pet.gatunek === "cat" ? IconCat : IconDog;
            return (
              <Link
                key={pet.id}
                role="menuitem"
                href={`/app/pets/${pet.id}/results/new`}
                className="dashboard-upload-menu-item"
                onClick={() => setOpen(false)}
              >
                <SpeciesIcon size={16} aria-hidden="true" />
                <span>{pet.imie}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
