"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconCalendarEvent,
  IconCheck,
  IconDeviceFloppy,
  IconMail,
  IconPill,
  IconPlus,
  IconStethoscope,
  IconVaccine,
  IconX,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import type { Pet } from "@/features/pets/types";
import type { HealthEvent } from "@/features/history/types";
import {
  MAX_NOTIFY_EMAILS,
  parseNotifyEmailsInput,
  splitNotifyEmailDraft,
} from "../../../supabase/functions/pet-schedule/validation.mjs";
import type { ScheduleCategory, ScheduleItem } from "./types";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

export function ScheduleDialog({
  pets,
  defaultPetId,
  defaultDate,
  item,
  defaultCategory = "visit",
  onClose,
  onSave,
  onOpenMedicationSchedule,
}: {
  pets: Pick<Pet, "id" | "imie">[];
  defaultPetId?: string;
  defaultDate?: string;
  item: ScheduleItem | null;
  defaultCategory?: ScheduleCategory;
  onClose: () => void;
  onSave: (saved: ScheduleItem) => void;
  onOpenMedicationSchedule?: (petId: string, date: string) => void;
}) {
  const pl = useLocale() === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [petId, setPetId] = useState(
    item?.pet_id ?? defaultPetId ?? pets[0]?.id ?? "",
  );
  const [category, setCategory] = useState<ScheduleCategory>(
    item?.category ?? defaultCategory,
  );
  const [title, setTitle] = useState(item?.title ?? "");
  const [scheduledDate, setScheduledDate] = useState(
    item?.scheduled_date ?? defaultDate ?? todayIso(),
  );
  const [scheduledTime, setScheduledTime] = useState(
    item?.scheduled_time ?? "",
  );
  const [clinic, setClinic] = useState(item?.clinic ?? "");
  const [doctor, setDoctor] = useState(item?.doctor ?? "");
  const [prepNotes, setPrepNotes] = useState(item?.prep_notes ?? "");
  const [notifyEmails, setNotifyEmails] = useState<string[]>(() =>
    Array.isArray(item?.notify_emails) ? item.notify_emails : [],
  );
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
      focus?.focus();
    };
  }, []);

  const categories: {
    id: ScheduleCategory;
    label: string;
    icon: typeof IconStethoscope;
  }[] = [
    {
      id: "visit",
      label: pl ? "Wizyta" : "Visit",
      icon: IconStethoscope,
    },
    {
      id: "vaccination",
      label: pl ? "Szczepienie" : "Vaccination",
      icon: IconVaccine,
    },
    {
      id: "prevention",
      label: pl ? "Leki / profilaktyka" : "Meds / prevention",
      icon: IconPill,
    },
  ];

  function tryCommitEmailDraft(raw: string): { ok: boolean; emails: string[] } {
    const incoming = splitNotifyEmailDraft(raw);
    if (incoming.length === 0) {
      setEmailError("");
      return { ok: true, emails: notifyEmails };
    }
    const parsed = parseNotifyEmailsInput([...notifyEmails, ...incoming]);
    if (!parsed.ok) {
      setEmailError(
        parsed.error === "too_many_emails"
          ? pl
            ? `Możesz dodać maksymalnie ${MAX_NOTIFY_EMAILS} adresów e-mail.`
            : `You can add at most ${MAX_NOTIFY_EMAILS} email addresses.`
          : pl
            ? `Nieprawidłowy adres e-mail: ${parsed.invalidValue ?? ""}`
            : `Invalid email address: ${parsed.invalidValue ?? ""}`,
      );
      return { ok: false, emails: notifyEmails };
    }
    setNotifyEmails(parsed.emails);
    setEmailDraft("");
    setEmailError("");
    return { ok: true, emails: parsed.emails };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    const cleanTitle = title.trim();
    if (!petId || !cleanTitle || !scheduledDate) {
      setError(
        pl
          ? "Podaj tytuł terminu oraz datę."
          : "Please enter a title and date.",
      );
      return;
    }

    const emailCheck = tryCommitEmailDraft(emailDraft);
    if (!emailCheck.ok) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const client = createClient();
      const { data, error: fnError } = await client.functions.invoke(
        "pet-schedule",
        {
          body: {
            id,
            pet_id: petId,
            revision: item?.revision ?? 0,
            item: {
              category,
              title: cleanTitle,
              scheduled_date: scheduledDate,
              scheduled_time: scheduledTime.trim(),
              clinic: clinic.trim(),
              doctor: doctor.trim(),
              prep_notes: prepNotes.trim(),
              notify_emails: emailCheck.emails,
              status: item?.status ?? "planned",
            },
          },
        },
      );

      if (fnError || !data?.item) {
        setError(
          pl
            ? "Nie udało się zapisać terminu. Spróbuj ponownie."
            : "Could not save schedule item. Please retry.",
        );
        return;
      }

      onSave(data.item as ScheduleItem);
    } catch {
      setError(
        pl
          ? "Wystąpił błąd połączenia. Spróbuj ponownie."
          : "Connection error. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="weight-dialog history-dialog"
      aria-labelledby="schedule-dialog-title"
      onCancel={(e) => {
        if (saving) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !saving) onClose();
      }}
    >
      <form onSubmit={submit} noValidate>
        <header>
          <span
            className={`weight-dialog-icon history-dialog-icon is-${category}`}
            aria-hidden="true"
          >
            <IconCalendarEvent size={22} />
          </span>
          <div>
            <h2 id="schedule-dialog-title">
              {item
                ? pl
                  ? "Edytuj zaplanowany termin"
                  : "Edit scheduled item"
                : pl
                  ? "Zaplanuj wizytę lub przypomnienie"
                  : "Schedule a visit or reminder"}
            </h2>
            <p>
              {pl
                ? "Zapisz termin we wspólnym terminarzu domowym i przygotuj notatki przed wizytą."
                : "Save a date to the household calendar and prepare pre-visit notes."}
            </p>
          </div>
          <button
            type="button"
            className="weight-dialog-close"
            disabled={saving}
            onClick={onClose}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </header>

        <fieldset disabled={saving}>
          <label>{pl ? "Rodzaj terminu *" : "Category *"}</label>
          <div className="history-category-picker" role="radiogroup">
            {categories.map(({ id: catId, label, icon: Icon }) => (
              <button
                key={catId}
                type="button"
                role="radio"
                aria-checked={category === catId}
                className={`history-category-option is-${catId}${category === catId ? " is-active" : ""}`}
                onClick={() => setCategory(catId)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {category === "prevention" && onOpenMedicationSchedule && (
            <div className="flex items-center justify-between gap-3 p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-900 dark:text-teal-200 mt-2 mb-2">
              <div>
                <strong>{pl ? "Harmonogram dawek leku" : "Medication schedule"}</strong>
                <p className="mt-0.5 opacity-80">
                  {pl
                    ? "Chcesz zaplanować stałe codzienne podawanie lub dawkowanie cykliczne (np. co 4 tygodnie)?"
                    : "Want to schedule regular daily intake or recurring doses (e.g. every 4 weeks)?"}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold underline hover:no-underline whitespace-nowrap text-teal-800 dark:text-teal-100"
                onClick={() => onOpenMedicationSchedule(petId, scheduledDate)}
              >
                <IconPill size={14} />
                <span>{pl ? "Otwórz harmonogram →" : "Open scheduler →"}</span>
              </button>
            </div>
          )}

          <div className="history-dialog-grid">
            {pets.length > 1 ? (
              <div>
                <label htmlFor="schedule-pet">
                  {pl ? "Pupil *" : "Pet *"}
                </label>
                <select
                  id="schedule-pet"
                  value={petId}
                  onChange={(e) => setPetId(e.target.value)}
                  className="schedule-select"
                >
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.imie}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className={pets.length <= 1 ? "pet-fields-wide" : ""}>
              <label htmlFor="schedule-title">
                {pl ? "Tytuł wizyty / przypomnienia *" : "Title *"}
              </label>
              <input
                id="schedule-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === "vaccination"
                    ? pl
                      ? "np. Szczepienie przeciwko wściekliźnie"
                      : "e.g. Rabies vaccination"
                    : category === "prevention"
                      ? pl
                        ? "np. Odrobaczanie / krople na kleszcze"
                        : "e.g. Deworming / tick drops"
                      : pl
                        ? "np. Kontrolne USG jamy brzusznej"
                        : "e.g. Follow-up abdominal ultrasound"
                }
              />
            </div>
          </div>

          <div className="history-dialog-grid">
            <div>
              <label htmlFor="schedule-date">
                {pl ? "Planowana data *" : "Scheduled date *"}
              </label>
              <input
                id="schedule-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="schedule-time">
                {pl ? "Godzina (opcjonalnie)" : "Time (optional)"}
              </label>
              <input
                id="schedule-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <div className="history-dialog-grid">
            <div>
              <label htmlFor="schedule-clinic">
                {pl ? "Klinika / przychodnia" : "Clinic"}
              </label>
              <input
                id="schedule-clinic"
                value={clinic}
                maxLength={120}
                onChange={(e) => setClinic(e.target.value)}
                placeholder={
                  pl ? "np. Przychodnia Weterynaryjna" : "e.g. Vet Clinic"
                }
              />
            </div>
            <div>
              <label htmlFor="schedule-doctor">
                {pl ? "Lekarz weterynarii" : "Veterinarian"}
              </label>
              <input
                id="schedule-doctor"
                value={doctor}
                maxLength={120}
                onChange={(e) => setDoctor(e.target.value)}
                placeholder={pl ? "np. lek. wet. Anna Nowak" : "e.g. Dr. Smith"}
              />
            </div>
          </div>

          <div>
            <label htmlFor="schedule-notes">
              {pl
                ? "Notatki przedwizytowe (objawy, pytania do lekarza, leki do kupienia)"
                : "Pre-visit notes (symptoms, questions for the vet, meds)"}
            </label>
            <textarea
              id="schedule-notes"
              rows={3}
              maxLength={2000}
              value={prepNotes}
              onChange={(e) => setPrepNotes(e.target.value)}
              placeholder={
                pl
                  ? "np. Zapytać o dawkę preparatu, zabrać wyniki krwi, kot ma byc na czczo 8h…"
                  : "e.g. Ask about dosage, bring lab results, fast for 8 hours before visit…"
              }
            />
          </div>

          <div className="schedule-notify-box">
            <div className="schedule-notify-head">
              <label htmlFor="schedule-notify-email">
                <IconMail size={14} aria-hidden="true" />{" "}
                {pl
                  ? "Powiadom jeszcze (opcjonalnie, e-mail)"
                  : "Also notify (optional, email)"}
              </label>
              <span className="schedule-notify-count">
                {notifyEmails.length} / {MAX_NOTIFY_EMAILS}
              </span>
            </div>

            {notifyEmails.length > 0 && (
              <ul className="schedule-notify-chips">
                {notifyEmails.map((addr) => (
                  <li key={addr} className="schedule-notify-chip">
                    <span>{addr}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifyEmails((prev) =>
                          prev.filter((itemAddr) => itemAddr !== addr),
                        );
                        setEmailError("");
                      }}
                      aria-label={
                        pl ? `Usuń adres ${addr}` : `Remove ${addr}`
                      }
                    >
                      <IconX size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="schedule-notify-row">
              <input
                id="schedule-notify-email"
                type="email"
                value={emailDraft}
                maxLength={160}
                disabled={notifyEmails.length >= MAX_NOTIFY_EMAILS}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/[,\s;]$/.test(val)) {
                    tryCommitEmailDraft(val);
                  } else {
                    setEmailDraft(val);
                    if (emailError) setEmailError("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    tryCommitEmailDraft(emailDraft);
                  }
                }}
                placeholder={
                  notifyEmails.length >= MAX_NOTIFY_EMAILS
                    ? pl
                      ? `Osiągnięto limit ${MAX_NOTIFY_EMAILS} adresów`
                      : `Limit of ${MAX_NOTIFY_EMAILS} emails reached`
                    : pl
                      ? "np. opiekun@domena.pl (Enter lub +)"
                      : "e.g. caregiver@domain.com (Enter or +)"
                }
              />
              <button
                type="button"
                className="schedule-mini-btn is-primary"
                disabled={
                  notifyEmails.length >= MAX_NOTIFY_EMAILS ||
                  !emailDraft.trim()
                }
                onClick={() => tryCommitEmailDraft(emailDraft)}
              >
                <IconPlus size={14} aria-hidden="true" />
                <span>{pl ? "Dodaj" : "Add"}</span>
              </button>
            </div>

            {emailError && (
              <p className="weight-dialog-error" role="alert">
                {emailError}
              </p>
            )}

            <small className="schedule-notify-hint">
              {pl
                ? "Dodatkowe osoby otrzymają przypomnienie z terminarza wyłącznie o tym terminie (zgodnie z ustawieniami powiadomień domu)."
                : "Additional recipients will receive schedule reminders only for this visit (following household reminder timing)."}
            </small>
          </div>

          {error && (
            <p className="weight-dialog-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>

        <footer>
          <button
            type="button"
            className="weight-cancel"
            disabled={saving}
            onClick={onClose}
          >
            {pl ? "Anuluj" : "Cancel"}
          </button>
          <button type="submit" className="weight-save" disabled={saving}>
            <IconDeviceFloppy size={18} aria-hidden="true" />
            {saving
              ? pl
                ? "Zapisywanie…"
                : "Saving…"
              : pl
                ? "Zapisz w terminarzu"
                : "Save to schedule"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export type CompleteTarget = {
  sourceKind: "schedule_item" | "due_event";
  sourceId: string;
  petId: string;
  petName: string;
  category: ScheduleCategory;
  title: string;
  clinic: string;
  doctor: string;
  batchOrProduct: string;
  prepNotes: string;
};

export function ScheduleCompleteDialog({
  target,
  onClose,
  onCompleted,
}: {
  target: CompleteTarget;
  onClose: () => void;
  onCompleted: (result: {
    createdEvent: HealthEvent;
    updatedScheduleItem: ScheduleItem | null;
    clearedDueEventId: string | null;
  }) => void;
}) {
  const pl = useLocale() === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

  const [title, setTitle] = useState(target.title);
  const [eventDate, setEventDate] = useState(todayIso());
  const [nextDueDate, setNextDueDate] = useState("");
  const [clinic, setClinic] = useState(target.clinic);
  const [doctor, setDoctor] = useState(target.doctor);
  const [batchOrProduct, setBatchOrProduct] = useState(target.batchOrProduct);
  const [description, setDescription] = useState(target.prepNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
      focus?.focus();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!title.trim() || !eventDate) {
      setError(
        pl
          ? "Podaj tytuł oraz datę wykonania."
          : "Please enter a title and completion date.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const client = createClient();
      const { data, error: fnError } = await client.functions.invoke(
        "pet-schedule",
        {
          body: {
            action: "complete",
            source_kind: target.sourceKind,
            source_id: target.sourceId,
            pet_id: target.petId,
            category: target.category,
            title: title.trim(),
            event_date: eventDate,
            next_due_date: nextDueDate.trim() || null,
            clinic: clinic.trim(),
            doctor: doctor.trim(),
            batch_or_product: batchOrProduct.trim(),
            description: description.trim(),
          },
        },
      );

      if (fnError || !data?.created_event) {
        setError(
          pl
            ? "Nie udało się zapisać wykonanego wpisu w historii zdrowia."
            : "Could not save completed entry to health history.",
        );
        return;
      }

      onCompleted({
        createdEvent: data.created_event as HealthEvent,
        updatedScheduleItem: (data.schedule_item as ScheduleItem) ?? null,
        clearedDueEventId:
          target.sourceKind === "due_event" ? target.sourceId : null,
      });
    } catch {
      setError(
        pl
          ? "Wystąpił błąd połączenia. Spróbuj ponownie."
          : "Connection error. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="weight-dialog history-dialog"
      aria-labelledby="schedule-complete-title"
      onCancel={(e) => {
        if (saving) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !saving) onClose();
      }}
    >
      <form onSubmit={submit} noValidate>
        <header>
          <span
            className="weight-dialog-icon history-dialog-icon is-visit"
            aria-hidden="true"
          >
            <IconCheck size={22} />
          </span>
          <div>
            <h2 id="schedule-complete-title">
              {pl
                ? `Oznacz jako wykonane — ${target.petName}`
                : `Mark as completed — ${target.petName}`}
            </h2>
            <p>
              {pl
                ? "Wpis zostanie automatycznie dodany do osi czasu Historii zdrowia pupila."
                : "This entry will be automatically added to the pet's Health History timeline."}
            </p>
          </div>
          <button
            type="button"
            className="weight-dialog-close"
            disabled={saving}
            onClick={onClose}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </header>

        <fieldset disabled={saving}>
          <div className="history-dialog-grid">
            <div>
              <label htmlFor="complete-title">
                {pl ? "Tytuł wpisu w historii *" : "History entry title *"}
              </label>
              <input
                id="complete-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="complete-product">
                {pl
                  ? "Zastosowany preparat / zabieg"
                  : "Applied product / procedure"}
              </label>
              <input
                id="complete-product"
                value={batchOrProduct}
                maxLength={120}
                onChange={(e) => setBatchOrProduct(e.target.value)}
                placeholder={
                  pl ? "np. Nobivac Tricat / Simparica" : "e.g. Nobivac / Milbemax"
                }
              />
            </div>
          </div>

          <div className="history-dialog-grid">
            <div>
              <label htmlFor="complete-date">
                {pl ? "Data wykonania *" : "Completion date *"}
              </label>
              <input
                id="complete-date"
                type="date"
                max={todayIso()}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="complete-next-due">
                {pl
                  ? "Kolejny termin przypomnienia (opcjonalnie)"
                  : "Next due date reminder (optional)"}
              </label>
              <input
                id="complete-next-due"
                type="date"
                min={eventDate}
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="history-dialog-grid">
            <div>
              <label htmlFor="complete-clinic">
                {pl ? "Klinika / przychodnia" : "Clinic"}
              </label>
              <input
                id="complete-clinic"
                value={clinic}
                maxLength={120}
                onChange={(e) => setClinic(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="complete-doctor">
                {pl ? "Lekarz weterynarii" : "Veterinarian"}
              </label>
              <input
                id="complete-doctor"
                value={doctor}
                maxLength={120}
                onChange={(e) => setDoctor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="complete-desc">
              {pl
                ? "Podsumowanie wizyty / zalecenia lekarskie"
                : "Visit summary / vet recommendations"}
            </label>
            <textarea
              id="complete-desc"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <p className="weight-dialog-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>

        <footer>
          <button
            type="button"
            className="weight-cancel"
            disabled={saving}
            onClick={onClose}
          >
            {pl ? "Anuluj" : "Cancel"}
          </button>
          <button type="submit" className="weight-save" disabled={saving}>
            <IconCheck size={18} aria-hidden="true" />
            {saving
              ? pl
                ? "Zapisywanie…"
                : "Saving…"
              : pl
                ? "Zapisz w historii zdrowia"
                : "Save to health history"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
