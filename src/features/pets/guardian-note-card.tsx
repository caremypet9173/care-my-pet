"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconChevronRight, IconEdit, IconHeart, IconX } from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/i18n/types";

export function GuardianNoteCard({
  petName,
  note,
  buttonLabel,
  dialogTitle,
  locale,
  editHref,
}: {
  petName: string;
  note: string | null | undefined;
  buttonLabel: string;
  dialogTitle: string;
  locale: Locale;
  editHref?: string;
}) {
  const pl = locale === "pl";
  const trimmedNote = note?.trim() ?? "";

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!trimmedNote) return null;

  function closeDialog() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="household-about-btn"
        aria-haspopup="dialog"
        aria-label={`${buttonLabel} — ${petName}`}
        onClick={() => setOpen(true)}
      >
        <IconHeart size={18} aria-hidden="true" />
        <span>{buttonLabel}</span>
        <IconChevronRight size={15} className="household-about-arrow" aria-hidden="true" />
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          className="guardian-note-dialog"
          aria-labelledby={titleId}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClick={(event) => {
            if (event.target === dialogRef.current) {
              closeDialog();
            }
          }}
        >
          <div className="guardian-note-dialog-shell">
            <header className="guardian-note-dialog-header">
              <div className="guardian-note-dialog-title-wrap">
                <span className="guardian-note-dialog-icon" aria-hidden="true">
                  <IconHeart size={20} />
                </span>
                <div>
                  <h2 id={titleId}>{dialogTitle}</h2>
                  <p>{petName}</p>
                </div>
              </div>
              <button
                type="button"
                className="guardian-note-dialog-close"
                onClick={closeDialog}
                aria-label={pl ? "Zamknij" : "Close"}
              >
                <IconX size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="guardian-note-dialog-body">
              <p className="pet-notes">{trimmedNote}</p>
            </div>

            <footer className="guardian-note-dialog-footer">
              {editHref && (
                <ButtonLink
                  href={editHref}
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  <IconEdit size={16} aria-hidden="true" />
                  <span>{pl ? "Edytuj opis" : "Edit description"}</span>
                </ButtonLink>
              )}
              <Button type="button" variant="primary" size="sm" onClick={closeDialog}>
                {pl ? "Zamknij" : "Close"}
              </Button>
            </footer>
          </div>
        </dialog>
      )}
    </>
  );
}
