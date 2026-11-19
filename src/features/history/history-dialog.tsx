"use client";

import {useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceFloppy,
  IconFileText,
  IconPill,
  IconSparkles,
  IconStethoscope,
  IconTrash,
  IconUpload,
  IconVaccine,
  IconX,
} from '@tabler/icons-react';
import {createClient} from '@/lib/supabase/client';
import {
  fileMatches,
  MAX_FILE,
  mimeExtensions,
  today,
  validateHealthEvent,
} from '../../../supabase/functions/pet-history/validation.mjs';
import type {HealthEvent, HealthEventCategory} from './types';

type Props = {
  petId: string;
  householdId: string;
  petName: string;
  event: HealthEvent | null;
  defaultCategory?: HealthEventCategory;
  focusAiUpload?: boolean;
  onClose: () => void;
  onSave: (row: HealthEvent) => void;
};

export function HistoryDialog({
  petId,
  householdId,
  petName,
  event,
  defaultCategory = 'visit',
  focusAiUpload = false,
  onClose,
  onSave,
}: Props) {
  const pl = useLocale() === 'pl';
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const uploadRef = useRef<{id: string; path: string; uploaded: boolean} | null>(null);
  const savedRef = useRef(false);

  const [id] = useState(() => event?.id ?? crypto.randomUUID());
  const [category, setCategory] = useState<HealthEventCategory>(event?.category ?? defaultCategory);
  const [title, setTitle] = useState(event?.title ?? '');
  const [eventDate, setEventDate] = useState(event?.event_date ?? today());
  const [nextDueDate, setNextDueDate] = useState(event?.next_due_date ?? '');
  const [clinic, setClinic] = useState(event?.clinic ?? '');
  const [doctor, setDoctor] = useState(event?.doctor ?? '');
  const [batchOrProduct, setBatchOrProduct] = useState(event?.batch_or_product ?? '');
  const [description, setDescription] = useState(event?.description ?? '');

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [extracting, setExtracting] = useState(false);
  const [extractedSuccess, setExtractedSuccess] = useState(false);
  const [extractedPatient, setExtractedPatient] = useState('');
  const [fileError, setFileError] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const busy = saving || extracting;

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
      if (!savedRef.current && uploadRef.current?.uploaded) {
        void createClient().storage.from('medical-documents').remove([uploadRef.current.path]);
      }
    };
  }, []);

  useEffect(() => {
    if (focusAiUpload && !event) {
      uploadButtonRef.current?.focus();
    }
  }, [focusAiUpload, event]);

  async function selectFile(next?: File) {
    if (!next || busy) return;
    setFileError('');
    setExtractedSuccess(false);
    setExtractedPatient('');

    const ext = mimeExtensions[next.type];
    if (!ext || !next.size || next.size > MAX_FILE) {
      setFileError(
        pl
          ? 'Wybierz poprawny plik PDF, JPG lub PNG o rozmiarze do 12 MB.'
          : 'Choose a valid PDF, JPG, or PNG file up to 12 MB.',
      );
      return;
    }

    const headerBytes = new Uint8Array(await next.slice(0, 8).arrayBuffer());
    if (!fileMatches(headerBytes, next.type)) {
      setFileError(
        pl
          ? 'Zawartość pliku nie odpowiada formatowi PDF, JPG ani PNG.'
          : 'File content does not match PDF, JPG, or PNG format.',
      );
      return;
    }

    if (uploadRef.current?.uploaded) {
      await createClient().storage.from('medical-documents').remove([uploadRef.current.path]);
    }
    uploadRef.current = null;
    setFile(next);
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0];
    e.target.value = '';
    await selectFile(next);
  }

  function handleDragEnter(e: DragEvent<HTMLElement>) {
    if (busy || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    if (busy || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void selectFile(dropped);
  }

  async function removeSelectedFile() {
    if (busy) return;
    if (uploadRef.current?.uploaded) {
      await createClient().storage.from('medical-documents').remove([uploadRef.current.path]);
    }
    uploadRef.current = null;
    setFile(null);
    setFileError('');
    setExtractedSuccess(false);
    setExtractedPatient('');
  }

  async function extractFromFile() {
    if (!file || busy) return;
    setExtracting(true);
    setFileError('');
    setError('');
    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error('unauthorized');

      const fileExt = mimeExtensions[file.type];
      if (!uploadRef.current) {
        const uploadId = crypto.randomUUID();
        uploadRef.current = {
          id: uploadId,
          path: `${householdId}/${user.id}/${uploadId}.${fileExt}`,
          uploaded: false,
        };
      }
      if (!uploadRef.current.uploaded) {
        const { error: storageError } = await client.storage
          .from('medical-documents')
          .upload(uploadRef.current.path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: '0',
          });
        if (
          storageError &&
          String((storageError as { statusCode?: string }).statusCode) !== '409'
        ) {
          throw storageError;
        }
        uploadRef.current.uploaded = true;
      }

      const {data, error: invokeError} = await client.functions.invoke('pet-history', {
        body: {
          action: 'extract',
          pet_id: petId,
          mime: file.type,
          storage_path: uploadRef.current.path,
        },
      });

      if (invokeError || !data?.extracted) {
        const details = await invokeError?.context?.json?.().catch(() => null);
        const code = details?.error;
        setFileError(
          code === 'daily_limit'
            ? pl
              ? 'Wykorzystano dzienny limit 10 odczytów AI. Możesz uzupełnić pola ręcznie i zapisać wpis z załącznikiem.'
              : 'Daily limit of 10 AI reads reached. You can fill in the fields manually and still save the attachment.'
            : code === 'ai_billing'
              ? pl
                ? 'Odczyt AI jest chwilowo niedostępny (limit rozliczeniowy dostawcy). Wypełnij pola ręcznie.'
                : 'AI reading is temporarily unavailable (provider billing limit). Fill in the fields manually.'
              : pl
                ? 'Nie udało się automatycznie odczytać dokumentu. Możesz wpisać dane ręcznie — plik nadal zostanie zapisany jako załącznik.'
                : 'Could not automatically read the document. You can enter the details manually — the file will still be attached.',
        );
        return;
      }

      const ext = data.extracted as {
        category?: HealthEventCategory;
        title?: string;
        event_date?: string;
        next_due_date?: string;
        clinic?: string;
        doctor?: string;
        batch_or_product?: string;
        description?: string;
      };

      if (ext.category && ['visit', 'vaccination', 'prevention'].includes(ext.category)) {
        setCategory(ext.category);
      }
      if (ext.title) setTitle(ext.title);
      if (ext.event_date) setEventDate(ext.event_date);
      if (ext.next_due_date !== undefined) setNextDueDate(ext.next_due_date);
      if (ext.clinic) setClinic(ext.clinic);
      if (ext.doctor) setDoctor(ext.doctor);
      if (ext.batch_or_product) setBatchOrProduct(ext.batch_or_product);
      if (ext.description) setDescription(ext.description);

      setExtractedPatient(typeof data.patient_name === 'string' ? data.patient_name : '');
      setExtractedSuccess(true);
    } catch {
      setFileError(
        pl
          ? 'Wystąpił błąd podczas odczytu AI. Możesz uzupełnić formularz ręcznie.'
          : 'An error occurred during AI reading. You can fill in the form manually.',
      );
    } finally {
      setExtracting(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError('');
    if (!parsed.value || busy) return;
    setSaving(true);
    try {
      const client = createClient();
      let sourcePayload: {
        source_id?: string;
        source_name?: string;
        source_mime?: string;
      } = {};

      if (file) {
        const {
          data: {user},
        } = await client.auth.getUser();
        if (!user) throw new Error('unauthorized');
        const ext = mimeExtensions[file.type];
        if (!uploadRef.current) {
          const uploadId = crypto.randomUUID();
          uploadRef.current = {
            id: uploadId,
            path: `${householdId}/${user.id}/${uploadId}.${ext}`,
            uploaded: false,
          };
        }
        if (!uploadRef.current.uploaded) {
          const {error: storageError} = await client.storage
            .from('medical-documents')
            .upload(uploadRef.current.path, file, {
              contentType: file.type,
              upsert: false,
              cacheControl: '0',
            });
          if (
            storageError &&
            String((storageError as {statusCode?: string}).statusCode) !== '409'
          ) {
            throw storageError;
          }
          uploadRef.current.uploaded = true;
        }
        sourcePayload = {
          source_id: uploadRef.current.id,
          source_name: file.name.slice(0, 180),
          source_mime: file.type,
        };
      }

      const {data, error: invokeError} = await client.functions.invoke('pet-history', {
        body: {
          id,
          pet_id: petId,
          revision: event?.revision ?? 0,
          event: parsed.value,
          ...sourcePayload,
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
      savedRef.current = true;
      onSave((data.event ?? data.entry) as HealthEvent);
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

  const patientMismatch =
    extractedPatient.trim().length > 0 &&
    extractedPatient.trim().toLocaleLowerCase() !== petName.trim().toLocaleLowerCase();

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
        if (!busy) onClose();
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
            disabled={busy}
            aria-label={pl ? 'Zamknij okno' : 'Close dialog'}
          >
            <IconX size={20} />
          </button>
        </header>

        <fieldset disabled={busy}>
          <div
            className={`history-ai-box${dragging ? ' is-dragging' : ''}${focusAiUpload && !file ? ' is-highlighted' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              hidden
              onChange={handleFileSelect}
            />

            {!file ? (
              <div className="history-ai-empty">
                <div className="history-ai-empty-text">
                  <strong>
                    <IconSparkles size={15} aria-hidden="true" />
                    {pl
                      ? 'Wczytaj z pliku (AI) lub przeciągnij tutaj'
                      : 'Import from file (AI) or drag & drop here'}
                  </strong>
                  <small>
                    {event?.source_name
                      ? pl
                        ? `Obecny załącznik: ${event.source_name}. Wybierz nowy plik, aby go zastąpić.`
                        : `Current attachment: ${event.source_name}. Choose a new file to replace it.`
                      : pl
                        ? 'PDF, JPG lub PNG (do 12 MB) — AI uzupełni formularz i zapisze dokument.'
                        : 'PDF, JPG or PNG (up to 12 MB) — AI will pre-fill the form and save the document.'}
                  </small>
                </div>
                <button
                  ref={uploadButtonRef}
                  type="button"
                  className="history-ai-upload-btn"
                  onClick={() => fileInput.current?.click()}
                >
                  <IconUpload size={15} aria-hidden="true" />
                  {pl ? 'Wybierz plik' : 'Choose file'}
                </button>
              </div>
            ) : (
              <div className="history-ai-selected">
                <div className="history-ai-file-row">
                  <span className="history-ai-file-icon" aria-hidden="true">
                    <IconFileText size={18} />
                  </span>
                  <div className="history-ai-file-meta">
                    <strong>{file.name}</strong>
                    <small>
                      {(file.size / 1024).toFixed(0)} KB •{' '}
                      {pl
                        ? 'Zostanie zapisany jako załącznik wpisu'
                        : 'Will be saved as entry attachment'}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="history-ai-remove-btn"
                    onClick={removeSelectedFile}
                    aria-label={pl ? 'Usuń wybrany plik' : 'Remove selected file'}
                  >
                    <IconTrash size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="history-ai-actions">
                  <button
                    type="button"
                    className="history-ai-extract-btn"
                    onClick={extractFromFile}
                    disabled={extracting}
                  >
                    <IconSparkles size={16} aria-hidden="true" />
                    {extracting
                      ? pl
                        ? 'Odczytywanie karty wizyty przez AI…'
                        : 'Reading visit document with AI…'
                      : extractedSuccess
                        ? pl
                          ? 'Odczytaj ponownie z pliku (AI)'
                          : 'Re-read from file (AI)'
                        : pl
                          ? 'Odczytaj i wypełnij formularz (AI)'
                          : 'Read & pre-fill form (AI)'}
                  </button>
                </div>
              </div>
            )}

            {extractedSuccess && (
              <p className="history-ai-notice is-success" role="status">
                <IconCheck size={16} aria-hidden="true" />
                <span>
                  {pl
                    ? 'Formularz został uzupełniony na podstawie dokumentu. Sprawdź poprawność pól przed zapisaniem.'
                    : 'Form fields were pre-filled from the document. Review them before saving.'}
                </span>
              </p>
            )}

            {patientMismatch && (
              <p className="history-ai-notice is-warning" role="alert">
                <IconAlertTriangle size={16} aria-hidden="true" />
                <span>
                  {pl
                    ? `Uwaga: na dokumencie wykryto imię pacjenta „${extractedPatient}” (kartoteka: ${petName}). Upewnij się, że to właściwy dokument.`
                    : `Note: patient name on document is "${extractedPatient}" (record: ${petName}). Please verify this is the right file.`}
                </span>
              </p>
            )}

            {fileError && (
              <p className="weight-error" role="alert">
                {fileError}
              </p>
            )}
          </div>

          {submitted && !parsed.value && (
            <p className="weight-error" role="alert">
              {pl
                ? 'Popraw zaznaczone pola przed zapisaniem wpisu.'
                : 'Correct the highlighted fields before saving.'}
            </p>
          )}

          <label>{pl ? 'Rodzaj wpisu' : 'Entry category'} *</label>
          <div
            className="history-category-picker"
            role="radiogroup"
            aria-label={pl ? 'Rodzaj wpisu' : 'Entry category'}
          >
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

          <div className="history-dialog-grid">
            <div>
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
            </div>

            <div>
              <label htmlFor="history-product">{productLabel}</label>
              <input
                id="history-product"
                type="text"
                maxLength={120}
                value={batchOrProduct}
                placeholder={productPlaceholder}
                onChange={e => setBatchOrProduct(e.target.value)}
              />
            </div>
          </div>

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

          <div className="weight-note-label">
            <label htmlFor="history-description">
              {pl ? 'Opis i zalecenia (opcjonalnie)' : 'Notes & recommendations (optional)'}
            </label>
            <small>{description.length}/2000</small>
          </div>
          <textarea
            id="history-description"
            rows={3}
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
          <button type="button" onClick={onClose} disabled={busy}>
            {pl ? 'Anuluj' : 'Cancel'}
          </button>
          <button type="submit" disabled={busy}>
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
