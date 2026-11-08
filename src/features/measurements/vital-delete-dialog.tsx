"use client";
import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { IconAlertTriangle, IconTrash, IconX } from "@tabler/icons-react";

export function VitalDeleteDialog({
  title,
  detail,
  date,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  detail: string;
  date: string;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const pl = useLocale() === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <dialog
      className="weight-dialog weight-delete-dialog"
      ref={dialog}
      aria-labelledby="vital-delete-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
      >
        <header>
          <span className="weight-dialog-icon weight-dialog-icon-danger">
            <IconAlertTriangle size={24} />
          </span>
          <div>
            <h2 id="vital-delete-title">
              {pl ? "Usunąć pomiar?" : "Delete measurement?"}
            </h2>
            <p>{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={pl ? "Zamknij okno" : "Close dialog"}
          >
            <IconX size={20} />
          </button>
        </header>

        <p className="weight-delete-prompt">
          {pl
            ? "Czy na pewno chcesz usunąć ten pomiar? Tej operacji nie można cofnąć."
            : "Are you sure you want to delete this measurement? This action cannot be undone."}
        </p>

        <dl className="weight-delete-summary">
          <div>
            <dt>{pl ? "Wartość pomiaru" : "Measurement"}</dt>
            <dd>
              <strong>{detail}</strong>
            </dd>
          </div>
          <div>
            <dt>{pl ? "Data pomiaru" : "Measurement date"}</dt>
            <dd>{date}</dd>
          </div>
        </dl>

        {error && (
          <p className="weight-error" role="alert">
            {error}
          </p>
        )}

        <footer>
          <button type="button" onClick={onClose} disabled={pending}>
            {pl ? "Anuluj" : "Cancel"}
          </button>
          <button
            type="submit"
            className="weight-button-danger"
            disabled={pending}
          >
            <IconTrash size={18} />
            {pending
              ? pl
                ? "Usuwanie…"
                : "Deleting…"
              : pl
                ? "Usuń pomiar"
                : "Delete"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
