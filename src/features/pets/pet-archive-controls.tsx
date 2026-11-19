"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconAlertTriangle,
  IconArchive,
  IconCalendarEvent,
  IconDots,
  IconHeartHandshake,
  IconHomeMove,
  IconRotateClockwise,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/types";
import {
  MAX_ARCHIVE_NOTE_LENGTH,
  validateArchivePet,
} from "../../../supabase/functions/pets/validation.mjs";
import { petArchiveMessages } from "./archive-messages";
import type { ArchiveReason, Pet } from "./types";

const REASON_OPTIONS: readonly ArchiveReason[] = ["deceased", "rehomed", "other"];

function localTodayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function mapArchiveError(
  errorCode: string | undefined,
  field: string | undefined,
  m: (typeof petArchiveMessages)[Locale],
): string {
  if (errorCode === "recovery_key_required") {
    return "Domostwo wymaga najpierw wygenerowania klucza odzyskania dostępu (tryb tylko do odczytu).";
  }
  if (field && field in m.errors) {
    return m.errors[field as keyof typeof m.errors];
  }
  if (errorCode && errorCode in m.errors) {
    return m.errors[errorCode as keyof typeof m.errors];
  }
  return m.errors.generic;
}

export function PetArchiveSection({ pet }: { pet: Pet }) {
  const locale = useLocale() as Locale;
  const m = petArchiveMessages[locale] ?? petArchiveMessages.pl;
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closedOnId = useId();
  const noteId = useId();

  const [reason, setReason] = useState<ArchiveReason>("deceased");
  const [closedOn, setClosedOn] = useState("");
  const [note, setNote] = useState("");
  const [todayIso, setTodayIso] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setReason("deceased");
    setClosedOn("");
    setNote("");
    setError(null);
    setTodayIso(localTodayIso());
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    if (submitting) return;
    dialogRef.current?.close();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const maxDate = todayIso || localTodayIso();
    const parsed = validateArchivePet(
      {
        archive_reason: reason,
        closed_on: reason === "deceased" ? closedOn || null : null,
        archive_note: note || null,
      },
      maxDate,
      pet.data_urodzenia,
    );

    if (!parsed.ok || !parsed.value) {
      setError(mapArchiveError(undefined, parsed.field, m));
      return;
    }

    setSubmitting(true);
    try {
      const client = createClient();
      const { error: invokeError } = await client.functions.invoke("pets", {
        body: {
          action: "archive",
          id: pet.id,
          archive: parsed.value,
        },
      });

      if (invokeError) {
        const res = invokeError.context;
        const body =
          res instanceof Response ? await res.json().catch(() => null) : null;
        setError(mapArchiveError(body?.error, body?.field, m));
        setSubmitting(false);
        return;
      }

      dialogRef.current?.close();
      router.push(`/app/zwierzeta/${pet.id}`);
      router.refresh();
    } catch {
      setError(m.errors.generic);
      setSubmitting(false);
    }
  };

  return (
    <section className="pet-archive-section" aria-labelledby={titleId}>
      <div className="pet-archive-section-copy">
        <h2 id={titleId}>
          <IconArchive size={18} aria-hidden="true" />
          {m.sectionTitle}
        </h2>
        <p>{m.sectionHint}</p>
      </div>
      <div className="pet-archive-section-actions">
        <Button type="button" variant="secondary" onClick={openDialog}>
          <IconArchive size={16} aria-hidden="true" />
          {m.closeButton}
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        className="pet-archive-dialog"
        aria-labelledby={`${titleId}-dialog`}
        onCancel={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        <form className="pet-archive-dialog-shell" onSubmit={handleSubmit}>
          <header className="pet-archive-dialog-header">
            <div>
              <h3 id={`${titleId}-dialog`}>
                {m.dialogTitle} ({pet.imie})
              </h3>
              <p>{m.dialogSubtitle}</p>
            </div>
            <button
              type="button"
              className="pet-archive-dialog-close"
              onClick={closeDialog}
              disabled={submitting}
              aria-label={m.cancel}
            >
              <IconX size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="pet-archive-dialog-body">
            <fieldset className="pet-archive-reasons">
              <legend>{m.reasonLabel}</legend>
              <div className="pet-archive-reason-grid">
                {REASON_OPTIONS.map((option) => {
                  const selected = reason === option;
                  const meta = m.reasons[option];
                  return (
                    <label
                      key={option}
                      className={`pet-archive-reason-card${selected ? " is-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="archive_reason"
                        value={option}
                        checked={selected}
                        onChange={() => {
                          setReason(option);
                          if (option !== "deceased") setClosedOn("");
                          setError(null);
                        }}
                      />
                      <span className="pet-archive-reason-icon" aria-hidden="true">
                        {option === "deceased" ? (
                          <IconHeartHandshake size={18} />
                        ) : option === "rehomed" ? (
                          <IconHomeMove size={18} />
                        ) : (
                          <IconDots size={18} />
                        )}
                      </span>
                      <span className="pet-archive-reason-text">
                        <strong>{meta.label}</strong>
                        <span>{meta.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {reason === "deceased" && (
              <div className="pet-archive-field">
                <label htmlFor={closedOnId}>
                  <IconCalendarEvent size={16} aria-hidden="true" />
                  {m.closedOnLabel}
                </label>
                <input
                  id={closedOnId}
                  type="date"
                  value={closedOn}
                  min={pet.data_urodzenia ?? "1900-01-01"}
                  max={todayIso || undefined}
                  onChange={(e) => {
                    setClosedOn(e.target.value);
                    setError(null);
                  }}
                />
                <small>{m.closedOnHint}</small>
              </div>
            )}

            <div className="pet-archive-field">
              <div className="pet-archive-note-label-row">
                <label htmlFor={noteId}>{m.noteLabel}</label>
                <span>
                  {note.length}/{MAX_ARCHIVE_NOTE_LENGTH}
                </span>
              </div>
              <textarea
                id={noteId}
                rows={3}
                maxLength={MAX_ARCHIVE_NOTE_LENGTH}
                value={note}
                placeholder={m.notePlaceholder}
                onChange={(e) => {
                  setNote(e.target.value);
                  setError(null);
                }}
              />
            </div>

            <div className="pet-archive-effects">
              <strong>
                <IconAlertTriangle size={16} aria-hidden="true" />
                {m.effectsTitle}
              </strong>
              <ul>
                {m.effects.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {error && (
              <p className="pet-archive-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <footer className="pet-archive-dialog-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDialog}
              disabled={submitting}
            >
              {m.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? m.closing : m.confirmClose}
            </Button>
          </footer>
        </form>
      </dialog>
    </section>
  );
}

export function PetRestoreButton({
  petId,
  petName,
}: {
  petId: string;
  petName: string;
}) {
  const locale = useLocale() as Locale;
  const m = petArchiveMessages[locale] ?? petArchiveMessages.pl;
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setError(null);
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    if (submitting) return;
    dialogRef.current?.close();
  };

  const handleRestore = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const client = createClient();
      const { error: invokeError } = await client.functions.invoke("pets", {
        body: {
          action: "restore",
          id: petId,
        },
      });

      if (invokeError) {
        const res = invokeError.context;
        const body =
          res instanceof Response ? await res.json().catch(() => null) : null;
        setError(mapArchiveError(body?.error, body?.field, m));
        setSubmitting(false);
        return;
      }

      dialogRef.current?.close();
      router.refresh();
    } catch {
      setError(m.errors.generic);
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={openDialog}>
        <IconRotateClockwise size={16} aria-hidden="true" />
        {m.restoreButton}
      </Button>

      <dialog
        ref={dialogRef}
        className="pet-archive-dialog pet-archive-dialog--compact"
        aria-labelledby={titleId}
        onCancel={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        <div className="pet-archive-dialog-shell">
          <header className="pet-archive-dialog-header">
            <div>
              <h3 id={titleId}>
                {m.restoreConfirmTitle} ({petName})
              </h3>
            </div>
            <button
              type="button"
              className="pet-archive-dialog-close"
              onClick={closeDialog}
              disabled={submitting}
              aria-label={m.cancel}
            >
              <IconX size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="pet-archive-dialog-body">
            <p className="pet-archive-restore-copy">{m.restoreConfirmBody}</p>
            {error && (
              <p className="pet-archive-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="pet-archive-dialog-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDialog}
              disabled={submitting}
            >
              {m.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleRestore}
              disabled={submitting}
            >
              <IconRotateClockwise size={16} aria-hidden="true" />
              {submitting ? m.restoring : m.restoreConfirmAction}
            </Button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
