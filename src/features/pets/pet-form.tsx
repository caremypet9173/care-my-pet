"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { IconCat, IconDog, IconPaw, IconCamera, IconShieldLock, IconArrowRight } from "@tabler/icons-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, ButtonLink } from "@/components/ui/button";
import { petMessages } from "./messages";
import { petFormMessages } from "./form-messages";
import { PhotoCropDialog } from "./photo-crop-dialog";
import { PetTagsInput } from "./pet-tags-input";
import type { Pet } from "./types";
import "@/styles/pet-form.css";

function Choices({ name, label, options, value, onChange, error }: {
  name: string; label: string; options: { value: string; label: string }[];
  value: string; onChange: (value: string) => void; error?: string;
}) {
  return <fieldset className="pet-choice-field"><legend>{label}</legend><div className="pet-choice-options">{options.map(option => <label key={option.value}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} aria-describedby={error ? `${name}-error` : undefined} /><span>{option.label}</span></label>)}</div>{error && <p className="pet-field-error" id={`${name}-error`}>{error}</p>}</fieldset>;
}

export function PetForm({ pet, householdId }: { pet?: Pet; householdId?: string }) {
  const locale = useLocale(); const t = petMessages[locale]; const d = petFormMessages[locale];
  const router = useRouter();
  const [species, setSpecies] = useState(pet?.gatunek ?? "");
  const [sex, setSex] = useState<Pet["plec"]>(pet?.plec ?? "unknown");
  const [neutered, setNeutered] = useState(pet?.kastracja == null ? "unknown" : pet.kastracja ? "yes" : "no");
  const [identification, setIdentification] = useState(pet?.identyfikacja ?? "unknown");
  const [birthdate, setBirthdate] = useState(pet?.data_urodzenia ?? "");
  const [approximate, setApproximate] = useState(pet?.data_urodzenia_przyblizona ?? false);
  const [tags, setTags] = useState<string[]>(pet?.tagi ?? []);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(pet?.avatar_url ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null); const details = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const PetSymbol = species === "cat" ? IconCat : species === "dog" ? IconDog : IconPaw;

  useEffect(() => {
    if (!isDirty || busy) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [isDirty, busy]);
  function report(next: Record<string, string>) {
    setErrors(next);
    if (Object.keys(next).some(key => ["numer_id", "tagi", "notatki", "identyfikacja", "kastracja"].includes(key)) && details.current) details.current.open = true;
    requestAnimationFrame(() => summary.current?.focus());
  }
  function acceptPhoto(blob: Blob) {
    const reader = new FileReader();
    reader.onload = () => { setPhoto(blob); setPreview(String(reader.result)); setRemovePhoto(false); setCropFile(null); setPhotoError(""); setIsDirty(true); };
    reader.onerror = () => setPhotoError(d.photoError);
    reader.readAsDataURL(blob);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget; const fields = new FormData(form);
    const next: Record<string, string> = {};
    for (const element of Array.from(form.elements)) {
      if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.name && !element.validity.valid) next[element.name] = d.fieldError;
    }
    if (!String(fields.get("imie") ?? "").trim()) next.imie = d.nameError;
    if (!species) next.gatunek = d.speciesError;
    if (next.numer_id && identification === "chip") next.numer_id = t.chipHint;
    if (Object.keys(next).length) { report(next); return; }
    setBusy(true); setError(""); setErrors({}); setPhotoError("");
    const client = createClient(); let uploaded: string | null = null;
    let saved = false;
    try {
      let avatarPath = removePhoto ? null : pet?.avatar_path ?? null;
      if (photo) {
        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error("Session expired");
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await client.storage.from("pet-avatars").upload(path, photo, { contentType: "image/jpeg", upsert: false });
        if (uploadError) { setPhotoError(d.uploadError); return; }
        uploaded = path; avatarPath = path;
      }
      const values = Object.fromEntries(fields.entries());
      const { data, error: invokeError } = await client.functions.invoke("pets", { body: {
        action: pet ? "update" : "create", id: pet?.id, updated_at: pet?.updated_at,
        ...(pet ? {} : householdId ? { household_id: householdId } : {}),
        pet: { ...values, gatunek: species, plec: sex, identyfikacja: identification,
          kastracja: neutered === "unknown" ? null : neutered === "yes",
          tagi: tags,
          data_urodzenia_przyblizona: !!birthdate && approximate, avatar_path: avatarPath },
      } });
      if (invokeError) {
        const response = invokeError.context;
        const body = response instanceof Response ? await response.json().catch(() => null) : null;
        if (body?.error === "recovery_key_required") {
          setError(
            locale === "pl"
              ? "Domostwo wymaga najpierw wygenerowania klucza odzyskania dostępu (tryb tylko do odczytu)."
              : "Household requires setting an emergency recovery key before adding or editing pets.",
          );
          return;
        }
        if (body?.error === "conflict_or_not_found") { setError(t.conflict); return; }
        if (body?.error === "invalid_input" && typeof body.field === "string" && body.field in t) { report({ [body.field]: `${t.invalid} ${t[body.field as keyof typeof t]}` }); return; }
        throw invokeError;
      }
      if (!data?.pet?.id) throw new Error("Missing pet");
      saved = true;
      setIsDirty(false);
      if (pet?.avatar_path && pet.avatar_path !== avatarPath) await client.storage.from("pet-avatars").remove([pet.avatar_path]).catch(() => undefined);
      router.push(`/app/pets/${data.pet.id}`); router.refresh();
    } catch { setError(t.failed); }
    finally {
      if (!saved && uploaded) await client.storage.from("pet-avatars").remove([uploaded]).catch(() => undefined);
      setBusy(false);
    }
  }
  const fieldError = (name: string) => errors[name] ? <p className="pet-field-error" id={`${name}-error`}>{errors[name]}</p> : null;
  return <>
    <form ref={formRef} className="pet-registration" onSubmit={submit} noValidate onChange={event => {
      setIsDirty(true);
      const field = event.target;
      if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && errors[field.name] && field.validity.valid
        && (field.name !== "imie" || field.value.trim())) {
        setErrors(current => { const next = { ...current }; delete next[field.name]; return next; });
      }
    }}>
      {Object.keys(errors).length > 0 && <div className="pet-validation-summary" role="alert" tabIndex={-1} ref={summary}><strong>{d.summary}</strong><ul>{Object.entries(errors).map(([name, message]) => <li key={name}><button type="button" onClick={() => formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus()}>{message}</button></li>)}</ul></div>}
      <fieldset disabled={busy} className="pet-registration-body"><legend className="sr-only">{t.basics}</legend>
        <aside className="pet-photo-column"><div className="pet-photo-box"><div className="pet-photo-preview">{preview ? /* Private signed URLs and local data URLs must bypass image optimization. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={locale === "pl" ? "Zdjęcie pupila" : "Pet photo"} /> : <PetSymbol size={48} stroke={1.4} aria-hidden="true" />}</div>
          <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label={d.addPhoto} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) { setPhotoError(d.photoError); return; }
            setPhotoError(""); setCropFile(file);
          }} />
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}><IconCamera size={16} aria-hidden="true" />{preview ? d.changePhoto : d.addPhoto}</Button>
          {preview && <Button variant="ghost" size="sm" onClick={() => { setPhoto(null); setPreview(null); setRemovePhoto(true); setIsDirty(true); }}>{d.removePhoto}</Button>}
          <small>{d.photoHint}</small><p className="pet-photo-privacy"><IconShieldLock size={18} aria-hidden="true" />{d.privatePhoto}</p>
        </div>{photoError && <p className="pet-field-error" role="alert">{photoError}</p>}</aside>
        <div className="pet-registration-fields">
          <div className="pet-form-field"><label htmlFor="pet-name">{t.imie} * <small>{d.required}</small></label><input id="pet-name" name="imie" required maxLength={80} defaultValue={pet?.imie} placeholder={d.namePlaceholder} autoComplete="off" aria-invalid={!!errors.imie} aria-describedby={errors.imie ? "imie-error" : undefined} />{fieldError("imie")}</div>
          <fieldset className="pet-species"><legend>{t.gatunek} * <small>{d.required}</small></legend><div>{(["cat", "dog"] as const).map(value => { const Icon = value === "cat" ? IconCat : IconDog; return <label key={value}><input type="radio" name="gatunek" value={value} checked={species === value} onChange={() => setSpecies(value)} required aria-describedby={errors.gatunek ? "gatunek-error" : undefined} /><Icon size={25} aria-hidden="true" /><span><strong>{t[value]}</strong><small>{value === "cat" ? d.catHint : d.dogHint}</small></span></label>; })}</div>{fieldError("gatunek")}</fieldset>
          <Choices name="plec" label={t.plec} options={[{ value: "female", label: t.female }, { value: "male", label: t.male }, { value: "unknown", label: t.unknown }]} value={sex} onChange={value => setSex(value as Pet["plec"])} />
          <div className="pet-form-field"><label htmlFor="pet-breed">{t.rasa}<small>{d.optional}</small></label><input id="pet-breed" name="rasa" maxLength={100} defaultValue={pet?.rasa ?? ""} placeholder={d.breedPlaceholder} aria-invalid={!!errors.rasa} aria-describedby="breed-hint" /><small id="breed-hint">{d.breedHint}</small>{fieldError("rasa")}</div>
          <div className="pet-form-field"><label htmlFor="pet-birthdate">{t.data_urodzenia}<small>{d.optional}</small></label><input id="pet-birthdate" name="data_urodzenia" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={birthdate} onChange={event => setBirthdate(event.target.value)} aria-invalid={!!errors.data_urodzenia} aria-describedby="date-hint" /><label className="pet-approximate"><input type="checkbox" checked={!!birthdate && approximate} disabled={!birthdate || busy} onChange={event => setApproximate(event.target.checked)} />{d.approximate}</label><small id="date-hint">{d.dateHint}</small>{fieldError("data_urodzenia")}</div>
          <details ref={details} className="pet-additional"><summary><span>{d.additional}<small>{d.additionalHint}</small></span><span>{d.optional}</span></summary><div>
            <Choices name="kastracja" label={t.kastracja} options={[{ value: "yes", label: t.yes }, { value: "no", label: t.no }, { value: "unknown", label: t.unknown }]} value={neutered} onChange={setNeutered} />
            <Choices name="identyfikacja" label={t.identyfikacja} options={(["chip", "tattoo", "none", "unknown"] as const).map(value => ({ value, label: t[value] }))} value={identification} onChange={value => setIdentification(value as Pet["identyfikacja"])} />
            {(identification === "chip" || identification === "tattoo") && <div className="pet-form-field"><label htmlFor="pet-number">{t.numer_id} *</label><input id="pet-number" name="numer_id" required maxLength={identification === "chip" ? 15 : 50} pattern={identification === "chip" ? "[0-9]{15}" : ".*\\S.*"} inputMode={identification === "chip" ? "numeric" : "text"} defaultValue={pet?.numer_id ?? ""} aria-invalid={!!errors.numer_id} aria-describedby={errors.numer_id ? "numer_id-error" : "chip-hint"} /><small id="chip-hint">{identification === "chip" ? t.chipHint : ""}</small>{fieldError("numer_id")}</div>}
            <PetTagsInput
              locale={locale}
              sex={sex}
              value={tags}
              onChange={(nextTags) => {
                setTags(nextTags);
                setIsDirty(true);
                if (errors.tagi) {
                  setErrors((current) => {
                    const next = { ...current };
                    delete next.tagi;
                    return next;
                  });
                }
              }}
              error={errors.tagi}
            />
            <div className="pet-form-field"><label htmlFor="pet-notes">{t.notatki}</label><textarea id="pet-notes" name="notatki" rows={4} maxLength={4000} defaultValue={pet?.notatki ?? ""} aria-invalid={!!errors.notatki} aria-describedby={errors.notatki ? "notes-hint notatki-error" : "notes-hint"} /><small id="notes-hint">{d.notesHint}</small>{fieldError("notatki")}</div>
          </div></details>
        </div>
      </fieldset>
      {error && <p className="pet-error" role="alert">{error}</p>}
      <div className="pet-registration-actions"><small>{d.requiredHint}</small>{busy ? <Button variant="ghost" disabled>{t.cancel}</Button> : <ButtonLink variant="ghost" href={pet ? `/app/pets/${pet.id}` : "/app"} onClick={event => { if (isDirty && !window.confirm(d.cancelWarning)) event.preventDefault(); }}>{t.cancel}</ButtonLink>}<Button type="submit" loading={busy}>{pet ? t.save : d.create}<IconArrowRight size={17} aria-hidden="true" /></Button></div>
    </form>
    {cropFile && <PhotoCropDialog file={cropFile} onCancel={() => setCropFile(null)} onSave={acceptPhoto} />}
  </>;
}
