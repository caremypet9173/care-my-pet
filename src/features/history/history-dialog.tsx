"use client";

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {
  IconDeviceFloppy,
  IconInfoCircle,
  IconPill,
  IconStethoscope,
  IconVaccine,
  IconX,
} from '@tabler/icons-react';
import {createClient} from '@/lib/supabase/client';
import {today, validateHealthEvent} from '../../../supabase/functions/pet-history/validation.mjs';
import type {HealthEvent, HealthEventCategory} from './types';

type Props = {
  petId: string;
  petName: string;
  event: HealthEvent | null;
  defaultCategory?: HealthEventCategory;
  onClose: () => void;
  onSave: (row: HealthEvent) => void;
};

export function HistoryDialog({
  petId,
  petName,
  event,
  defaultCategory = 'visit',
  onClose,
  onSave,
}: Props) {
  const pl = useLocale() === 'pl';
  const dialog = useRef<HTMLDialogElement>(null);
  const [id] = useState(() => event?.id ?? crypto.randomUUID());
  const [category, setCategory] = useState<HealthEventCategory>(event?.category ?? defaultCategory);
  const [title, setTitle] = useState(event?.title ?? '');
  const [eventDate, setEventDate] = useState(event?.event_date ?? today());
  const [nextDueDate, setNextDueDate] = useState(event?.next_due_date ?? '');
  const [clinic, setClinic] = useState(event?.clinic ?? '');
  const [doctor, setDoctor] = useState(event?.doctor ?? '');
  const [batchOrProduct, setBatchOrProduct] = useState(event?.batch_or_product ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = validateHealthEvent({
    category,
    title,
    event_date: eventDate,
    next_due_date: nextDueDate,
    clinic,
    doctor,
    batch_or_product: batchOrProduct,
    description,
  });
  const errors = submitted ? parsed.errors : {};

  useEffect(() => {
    const el = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      el.close();
      document.body.style.overflow = previous;
      focus?.focus();
    };
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError('');
    if (!parsed.value || saving) return;
    setSaving(true);
    try {
      const {data, error: invokeError} = await createClient().functions.invoke('pet-history', {
        body: {
          id,
          pet_id: petId,
          revision: event?.revision ?? 0,
          event: parsed.value,
        },
      });
      if (invokeError) {
        setError(
          invokeError.context?.status === 409
            ? pl
              ? 'Wpis został zmieniony w innej karcie. Zamknij okno i odśwież stronę.'
              : 'This entry was modified elsewhere. Close and refresh the page.'
            : pl
              ? 'Nie udało się zapisać wpisu. Spróbuj ponownie.'
              : 'Could not save entry. Please retry.',
        );
        return;
      }
      onSave(data.event as HealthEvent);
    } catch {
      setError(
        pl
          ? 'Nie udało się zapisać wpisu. Spróbuj ponownie.'
          : 'Could not save entry. Please retry.',
      );
    } finally {
      setSaving(false);
    }
  }

  const categories: {id: HealthEventCategory; label: string; icon: typeof IconStethoscope}[] = [
    {
      id: 'visit',
      label: pl ? 'Wizyta kontrolna' : 'Check-up visit',
      icon: IconStethoscope,
    },
    {
      id: 'vaccination',
      label: pl ? 'Szczepienie' : 'Vaccination',
      icon: IconVaccine,
    },
    {
      id: 'prevention',
      label: pl ? 'Leki i profilaktyka' : 'Meds & prevention',
      icon: IconPill,
    },
  ];

  const titlePlaceholder =
    category === 'vaccination'
      ? pl
        ? 'Np. Szczepienie przeciwko wściekliźnie'
        : 'E.g. Rabies vaccination'
      : category === 'prevention'
        ? pl
          ? 'Np. Profilaktyka przeciwkleszczowa'
          : 'E.g. Tick & flea prevention'
        : pl
          ? 'Np. Wizyta kontrolna i przegląd jamy ustnej'
          : 'E.g. Annual check-up and dental exam';

  const productLabel =
    category === 'vaccination'
      ? pl
        ? 'Szczepionka i numer serii (opcjonalnie)'
        : 'Vaccine & batch number (optional)'
      : category === 'prevention'
        ? pl
          ? 'Preparat i dawka (opcjonalnie)'
          : 'Product & dosage (optional)'
        : pl
          ? 'Zastosowany preparat / zabieg (opcjonalnie)'
          : 'Applied product / procedure (optional)';

  const productPlaceholder =
    category === 'vaccination'
      ? pl
        ? 'Np. Nobivac Rabies • Seria #A89421B'
        : 'E.g. Nobivac Rabies • Batch #A89421B'
      : category === 'prevention'
        ? pl
          ? 'Np. Bravecto Spot-On (250 mg)'
          : 'E.g. Bravecto Spot-On (250 mg)'
        : pl
          ? 'Np. Otodine + przegląd stomatologiczny'
          : 'E.g. Dental check & ear cleaning';

  const nextDueLabel =
    category === 'vaccination'
      ? pl
        ? 'Ważne do / kolejne szczepienie (opcjonalnie)'
        : 'Valid until / next booster (optional)'
      : category === 'prevention'
        ? pl
          ? 'Następna dawka (opcjonalnie)'
          : 'Next dose due (optional)'
        : pl
          ? 'Kolejna wizyta kontrolna (opcjonalnie)'
          : 'Next check-up date (optional)';

  return (
    <dialog
      className="weight-dialog history-dialog"
      ref={dialog}
      aria-labelledby="history-dialog-title"
      onCancel={e => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={save} noValidate>
        <header>
          <span className={`weight-dialog-icon history-dialog-icon is-${category}`}>
            {category === 'vaccination' ? (
              <IconVaccine size={24} />
            ) : category === 'prevention' ? (
              <IconPill size={24} />
            ) : (
              <IconStethoscope size={24} />
            )}
          </span>
          <div>
            <h2 id="history-dialog-title">
              {event
                ? pl
                  ? 'Edytuj wpis w historii zdrowia'
                  : 'Edit health history entry'
                : pl
                  ? 'Dodaj wpis do historii zdrowia'
                  : 'Add health history entry'}
            </h2>
            <p>{petName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={pl ? 'Zamknij okno' : 'Close dialog'}
          >
            <IconX size={20} />
          </button>
        </header>

        <div className="weight-dialog-info">
          <IconInfoCircle size={18} />
          <p>
            {pl
              ? 'Zapisz wizytę, szczepienie lub podany preparat. Opcjonalna data kolejnego terminu pojawi się jako przypomnienie na osi czasu.'
              : 'Record a vet visit, vaccination, or preventative treatment. An optional next due date will appear as a reminder on the timeline.'}
          </p>
        </div>

        <fieldset disabled={saving}>
          {submitted && !parsed.value && (
            <p className="weight-error" role="alert">
              {pl
                ? 'Popraw zaznaczone pola przed zapisaniem wpisu.'
                : 'Correct the highlighted fields before saving.'}
            </p>
          )}

          <label>{pl ? 'Rodzaj wpisu' : 'Entry category'} *</label>
          <div className="history-category-picker" role="radiogroup" aria-label={pl ? 'Rodzaj wpisu' : 'Entry category'}>
            {categories.map(item => {
              const Icon = item.icon;
              const active = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`history-category-option is-${item.id}${active ? ' is-active' : ''}`}
                  onClick={() => setCategory(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <label htmlFor="history-title">{pl ? 'Tytuł wpisu' : 'Entry title'} *</label>
          <input
            id="history-title"
            autoFocus
            type="text"
            maxLength={120}
            value={title}
            placeholder={titlePlaceholder}
            aria-invalid={!!errors.title}
            onChange={e => setTitle(e.target.value)}
          />
          {errors.title && (
            <small className="weight-error">
              {pl ? 'Podaj tytuł wpisu (maks. 120 znaków).' : 'Enter a title (max 120 characters).'}
            </small>
          )}

          <div className="history-dialog-grid">
            <div>
              <label htmlFor="history-event-date">{pl ? 'Data zdarzenia' : 'Event date'} *</label>
              <input
                id="history-event-date"
                type="date"
                min="1900-01-01"
                max={today()}
                value={eventDate}
                aria-invalid={!!errors.event_date}
                onChange={e => setEventDate(e.target.value)}
              />
              {errors.event_date && (
                <small className="weight-error">
                  {pl
                    ? 'Podaj poprawną datę (nie późniejszą niż dzisiaj).'
                    : 'Enter a valid date (no later than today).'}
                </small>
              )}
            </div>

            <div>
              <label htmlFor="history-next-due">{nextDueLabel}</label>
              <input
                id="history-next-due"
                type="date"
                min={eventDate || '1900-01-01'}
                max="2100-12-31"
                value={nextDueDate}
                aria-invalid={!!errors.next_due_date}
                onChange={e => setNextDueDate(e.target.value)}
              />
              {errors.next_due_date && (
                <small className="weight-error">
                  {pl
                    ? 'Data kolejnego terminu nie może być wcześniejsza niż data zdarzenia.'
                    : 'Next due date cannot be earlier than the event date.'}
                </small>
              )}
            </div>
          </div>

          <div className="history-dialog-grid">
            <div>
              <label htmlFor="history-clinic">
                {pl ? 'Klinika / przychodnia (opcjonalnie)' : 'Clinic (optional)'}
              </label>
              <input
                id="history-clinic"
                type="text"
                maxLength={120}
                value={clinic}
                placeholder={pl ? 'Np. Klinika Weterynaryjna VetCare' : 'E.g. VetCare Clinic'}
                onChange={e => setClinic(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="history-doctor">
                {pl ? 'Lekarz weterynarii (opcjonalnie)' : 'Veterinarian (optional)'}
              </label>
              <input
                id="history-doctor"
                type="text"
                maxLength={120}
                value={doctor}
                placeholder={pl ? 'Np. lek. wet. Anna Nowak' : 'E.g. Dr. Anna Nowak'}
                onChange={e => setDoctor(e.target.value)}
              />
            </div>
          </div>

          <label htmlFor="history-product">{productLabel}</label>
          <input
            id="history-product"
            type="text"
            maxLength={120}
            value={batchOrProduct}
            placeholder={productPlaceholder}
            onChange={e => setBatchOrProduct(e.target.value)}
          />

          <div className="weight-note-label">
            <label htmlFor="history-description">
              {pl ? 'Opis i zalecenia (opcjonalnie)' : 'Notes & recommendations (optional)'}
            </label>
            <small>{description.length}/2000</small>
          </div>
          <textarea
            id="history-description"
            rows={4}
            maxLength={2000}
            value={description}
            placeholder={
              pl
                ? 'Np. Przegląd ogólny, osłuchiwanie serca i płuc w normie, brak odczynu poszczepiennego…'
                : 'E.g. General exam, heart and lungs normal, no adverse reaction…'
            }
            onChange={e => setDescription(e.target.value)}
          />

          {error && (
            <p className="weight-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>

        <footer>
          <button type="button" onClick={onClose} disabled={saving}>
            {pl ? 'Anuluj' : 'Cancel'}
          </button>
          <button type="submit" disabled={saving}>
            <IconDeviceFloppy size={18} />
            {saving
              ? pl
                ? 'Zapisywanie…'
                : 'Saving…'
              : event
                ? pl
                  ? 'Zapisz zmiany'
                  : 'Save changes'
                : pl
                  ? 'Zapisz wpis'
                  : 'Save entry'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
