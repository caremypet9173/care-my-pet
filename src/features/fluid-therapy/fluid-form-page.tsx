"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconDroplet,
  IconInfoCircle,
  IconDeviceFloppy,
  IconBuildingHospital,
  IconHome,
  IconNeedle,
  IconArrowLeft,
  IconNotes,
} from "@tabler/icons-react";
import { Link, useRouter } from "@/i18n/navigation";
import type { Pet } from "@/features/pets/types";
import { saveFluidTherapy } from "./actions";
import { COMMON_FLUIDS, type FluidLocation, type FluidRoute, type PetFluidTherapy } from "./types";

export function FluidFormPage({
  pet,
  therapy,
}: {
  pet: Pet;
  therapy: PetFluidTherapy | null;
}) {
  const pl = useLocale() === "pl";
  const router = useRouter();

  const [fluidName, setFluidName] = useState(
    therapy?.fluid_name ?? "PWE (Płyn wieloelektrolitowy)"
  );
  const [customFluid, setCustomFluid] = useState("");
  const isCustom = !COMMON_FLUIDS.some((f) => f.value === fluidName);

  const [volumeStr, setVolumeStr] = useState(therapy ? String(therapy.volume_ml) : "100");
  const [route, setRoute] = useState<FluidRoute>(therapy?.route ?? "iv");
  const [medicationsAdded, setMedicationsAdded] = useState(therapy?.medications_added ?? "");
  const [location, setLocation] = useState<FluidLocation>(therapy?.location ?? "clinic");
  const [clinicName, setClinicName] = useState(therapy?.clinic_name ?? "");
  const [doctorName, setDoctorName] = useState(therapy?.doctor_name ?? "");
  const [catheterStatus, setCatheterStatus] = useState(therapy?.catheter_status ?? "");

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());

  const [date, setDate] = useState(therapy?.administered_on ?? todayIso);
  const [time, setTime] = useState(() => {
    if (therapy?.administered_at) {
      try {
        return new Date(therapy.administered_at).toISOString().slice(11, 16);
      } catch {
        return "12:00";
      }
    }
    return new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }).slice(0, 5);
  });

  const [notes, setNotes] = useState(therapy?.notes ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const effectiveFluid = isCustom ? customFluid.trim() : fluidName.trim();
  const numVolume = Number(volumeStr.replace(",", "."));
  const isVolumeValid = !isNaN(numVolume) && numVolume > 0 && numVolume <= 5000;
  const isDateValid = Boolean(date && date >= "1900-01-01" && date <= todayIso);
  const isFluidValid = effectiveFluid.length >= 2;
  const isValid = isVolumeValid && isDateValid && isFluidValid;

  function appendMedication(item: string) {
    setMedicationsAdded((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return item;
      if (trimmed.toLowerCase().includes(item.toLowerCase())) return prev;
      return `${trimmed}, ${item}`;
    });
  }

  function appendCatheter(status: string) {
    setCatheterStatus((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return status;
      if (trimmed.toLowerCase().includes(status.toLowerCase())) return prev;
      return `${trimmed}, ${status}`;
    });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError("");

    if (!isValid || saving) return;

    setSaving(true);
    try {
      const combinedDateTime = `${date}T${time || "12:00"}:00`;
      const res = await saveFluidTherapy({
        id: therapy?.id,
        petId: pet.id,
        revision: therapy?.revision ?? 0,
        fluidName: effectiveFluid,
        volumeMl: Math.round(numVolume * 10) / 10,
        route,
        medicationsAdded,
        location,
        clinicName: location === "clinic" ? clinicName : "",
        doctorName: location === "clinic" ? doctorName : "",
        catheterStatus: route !== "sc" ? catheterStatus : "",
        administeredAt: new Date(combinedDateTime).toISOString(),
        administeredOn: date,
        notes,
      });

      if (res.error) {
        setError(
          res.isConflict
            ? pl
              ? "Wpis został zmodyfikowany w innej sesji. Odśwież stronę."
              : "Entry was modified elsewhere. Please refresh."
            : pl
              ? `Błąd zapisu: ${res.error}`
              : `Save error: ${res.error}`
        );
        return;
      }

      router.push(`/app/zwierzeta/${pet.id}?tab=history`);
      router.refresh();
    } catch {
      setError(
        pl
          ? "Nie udało się zapisać kroplówki. Spróbuj ponownie."
          : "Failed to save fluid therapy. Please retry."
      );
    } finally {
      setSaving(false);
    }
  }

  const volumePresets = ["50", "100", "120", "150", "200", "250"];

  const medSuggestions = [
    { label: "Duphalyte 10 ml", val: "Duphalyte 10 ml" },
    { label: "Cerenia 0.4 ml", val: "Cerenia 0.4 ml" },
    { label: "Catosal 1 ml", val: "Catosal 1 ml" },
    { label: "Wit. B12", val: "Witamina B12" },
    { label: "KCl (potas)", val: "KCl" },
    { label: "Heparyna", val: "Heparyna" },
  ];

  const catheterPresets = [
    pl ? "Wenflon drożny" : "Catheter patent",
    pl ? "Przepłukany heparyną" : "Flushed with heparin",
    pl ? "Nowy wenflon założony" : "New catheter placed",
    pl ? "Zmieniony opatrunek" : "Dressing changed",
  ];

  const backUrl = `/app/zwierzeta/${pet.id}?tab=history`;

  return (
    <div className="medical-review fluid-review-page">
      {/* Pasek procesu — dopasowany do ekranów desktopowych i mobilnych */}
      <header className="medical-process-header fluid-process-header">
        <Link href={backUrl}>
          <IconArrowLeft size={18} aria-hidden="true" />
          <span>{pl ? "Wróć do kartoteki" : "Back"}</span>
        </Link>
        <div>
          <strong>{pet.imie}</strong>
          <span>
            {therapy
              ? pl
                ? "Edycja wlewu"
                : "Edit infusion"
              : pl
                ? "Rejestracja płynoterapii"
                : "Register fluid therapy"}
          </span>
        </div>
        <span className="household-tag">
          {pl ? "Płynoterapia" : "Infusions"}
        </span>
      </header>

      {/* 2-kolumnowy układ zoptymalizowany pod desktop i mobile */}
      <form onSubmit={handleSave} noValidate className="fluid-split-grid">
        {/* LEWA KOLUMNA: Parametry medyczne płynu */}
        <div className="fluid-column">
          {/* Sekcja 1: Płyn bazowy i dawka */}
          <section className="medical-metadata">
            <header className="review-section-heading">
              <h2>
                <IconDroplet size={17} className="text-cyan-600" aria-hidden="true" />
                {pl ? "1. Płyn bazowy i objętość wlewu" : "1. Base fluid & volume"}
              </h2>
              <span className="review-source-badge">
                {pl ? "Parametry wlewu" : "Infusion specs"}
              </span>
            </header>

            <div className="fluid-row-2">
              <label>
                {pl ? "Płyn bazowy *" : "Base fluid *"}
                <select
                  id="fluid-select"
                  value={isCustom ? "custom" : fluidName}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setFluidName("custom");
                      setCustomFluid("");
                    } else {
                      setFluidName(e.target.value);
                    }
                  }}
                >
                  {COMMON_FLUIDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                  <option value="custom">
                    {pl ? "Inny płyn (wpisz własny)…" : "Other fluid (enter custom)…"}
                  </option>
                </select>
              </label>

              <label>
                {pl ? "Objętość *" : "Volume *"}
                <div className="fluid-volume-input-wrap">
                  <input
                    id="fluid-volume"
                    inputMode="decimal"
                    value={volumeStr}
                    placeholder="np. 120"
                    aria-invalid={submitted && !isVolumeValid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d{0,4}([.,]\d{0,1})?$/.test(val)) {
                        setVolumeStr(val);
                      }
                    }}
                  />
                  <span className="fluid-volume-unit">ml</span>
                </div>
              </label>
            </div>

            {isCustom && (
              <label style={{ marginBottom: "0.75rem", display: "block" }}>
                {pl ? "Nazwa własna płynu *" : "Custom fluid name *"}
                <input
                  id="custom-fluid"
                  value={customFluid}
                  placeholder={
                    pl
                      ? "np. Płyn Ringera z mleczanami + Glukoza 1:1"
                      : "e.g. Ringer lactate + 5% Glucose 1:1"
                  }
                  onChange={(e) => setCustomFluid(e.target.value)}
                  aria-invalid={submitted && effectiveFluid.length < 2}
                />
              </label>
            )}

            <div className="fluid-presets-row">
              <span className="fluid-presets-label">
                {pl ? "Szybki wybór:" : "Presets:"}
              </span>
              <div className="fluid-chips-scroll">
                {volumePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`fluid-chip ${volumeStr === preset ? "is-active" : ""}`}
                    onClick={() => setVolumeStr(preset)}
                  >
                    {preset} ml
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Sekcja 2: Droga podania i skład */}
          <section className="medical-metadata">
            <header className="review-section-heading">
              <h2>
                <IconNeedle size={17} className="text-cyan-600" aria-hidden="true" />
                {pl ? "2. Droga podania i skład wlewu" : "2. Route & medications"}
              </h2>
            </header>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ marginBottom: "0.35rem", display: "block", fontSize: "0.8125rem", fontWeight: 600 }}>
                {pl ? "Droga podania *" : "Route *"}</label>
              <div className="fluid-segmented-grid">
                <button
                  type="button"
                  className={`fluid-seg-btn ${route === "iv" ? "is-active" : ""}`}
                  onClick={() => setRoute("iv")}
                >
                  <span className="fluid-seg-icon">💉</span>
                  <span>{pl ? "Dożylna (IV)" : "IV"}</span>
                </button>
                <button
                  type="button"
                  className={`fluid-seg-btn ${route === "sc" ? "is-active" : ""}`}
                  onClick={() => setRoute("sc")}
                >
                  <span className="fluid-seg-icon">💧</span>
                  <span>{pl ? "Podskórna (SC)" : "SC"}</span>
                </button>
                <button
                  type="button"
                  className={`fluid-seg-btn ${route === "io" ? "is-active" : ""}`}
                  onClick={() => setRoute("io")}
                >
                  <span className="fluid-seg-icon">🦴</span>
                  <span>{pl ? "Doszpikowa (IO)" : "IO"}</span>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ marginBottom: "0.35rem", display: "block", fontSize: "0.8125rem", fontWeight: 600 }}>
                {pl
                  ? "Leki i dodatki włączone do wlewu (opcjonalnie)"
                  : "Medication additives (optional)"}
              </label>
              <input
                id="fluid-meds"
                value={medicationsAdded}
                placeholder={
                  pl
                    ? "np. Duphalyte 10 ml, Cerenia 0.4 ml, Catosal 1 ml, KCl"
                    : "e.g. Duphalyte 10 ml, Cerenia 0.4 ml, Catosal 1 ml"
                }
                onChange={(e) => setMedicationsAdded(e.target.value)}
              />
              <div className="fluid-presets-row">
                <span className="fluid-presets-label">
                  {pl ? "Popularne dodatki:" : "Additives:"}
                </span>
                <div className="fluid-chips-scroll">
                  {medSuggestions.map((med) => (
                    <button
                      key={med.label}
                      type="button"
                      className="fluid-chip is-add"
                      onClick={() => appendMedication(med.val)}
                    >
                      + {med.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {route !== "sc" && (
              <div className="fluid-catheter-block">
                <label style={{ marginBottom: "0.25rem", display: "block", fontSize: "0.8125rem", fontWeight: 600 }}>
                  {pl ? "Stan wenflonu / wkłucia (opcjonalnie)" : "Catheter status (optional)"}
                </label>
                <input
                  id="fluid-catheter"
                  value={catheterStatus}
                  placeholder={
                    pl
                      ? "np. Wenflon drożny w lewej przedniej łapce, przepłukany heparyną"
                      : "e.g. Catheter patent, flushed"
                  }
                  onChange={(e) => setCatheterStatus(e.target.value)}
                />
                <div className="fluid-presets-row">
                  <span className="fluid-presets-label">
                    {pl ? "Szybki stan:" : "Status:"}
                  </span>
                  <div className="fluid-chips-scroll">
                    {catheterPresets.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="fluid-chip is-add"
                        onClick={() => appendCatheter(status)}
                      >
                        + {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* PRAWA KOLUMNA: Miejsce, czas, notatki i zatwierdzenie */}
        <div className="fluid-column">
          {/* Sekcja 3: Miejsce wykonania i termin */}
          <section className="medical-metadata">
            <header className="review-section-heading">
              <h2>
                <IconBuildingHospital size={17} className="text-cyan-600" aria-hidden="true" />
                {pl ? "3. Miejsce i termin podania" : "3. Location & timing"}
              </h2>
            </header>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ marginBottom: "0.35rem", display: "block", fontSize: "0.8125rem", fontWeight: 600 }}>
                {pl ? "Miejsce wykonania" : "Location"}
              </label>
              <div className="fluid-segmented-grid fluid-segmented-location">
                <button
                  type="button"
                  className={`fluid-seg-btn ${location === "clinic" ? "is-active" : ""}`}
                  onClick={() => setLocation("clinic")}
                >
                  <IconBuildingHospital size={16} />
                  <span>{pl ? "W lecznicy" : "Clinic"}</span>
                </button>
                <button
                  type="button"
                  className={`fluid-seg-btn ${location === "home" ? "is-active" : ""}`}
                  onClick={() => setLocation("home")}
                >
                  <IconHome size={16} />
                  <span>{pl ? "W domu" : "Home"}</span>
                </button>
              </div>
            </div>

            {location === "clinic" ? (
              <div className="fluid-row-2-equal">
                <label>
                  {pl ? "Lecznica / Gabinet" : "Clinic"}
                  <input
                    id="fluid-clinic"
                    value={clinicName}
                    placeholder={pl ? "np. Przychodnia Weterynaryjna VETIS" : "Clinic name"}
                    onChange={(e) => setClinicName(e.target.value)}
                  />
                </label>
                <label>
                  {pl ? "Lekarz prowadzący" : "Veterinarian"}
                  <input
                    id="fluid-doctor"
                    value={doctorName}
                    placeholder={pl ? "np. lek. wet. Łukasz Bęben" : "Doctor name"}
                    onChange={(e) => setDoctorName(e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <div className="fluid-home-hint" style={{ marginBottom: "0.75rem" }}>
                <IconHome size={16} />
                <span>
                  {pl
                    ? "Wlew wykonany w domu przez opiekuna (brak konieczności uzupełniania gabinetu)."
                    : "Infusion administered at home by guardian."}
                </span>
              </div>
            )}

            <div className="fluid-row-2">
              <label>
                {pl ? "Data podania *" : "Date *"}
                <input
                  id="fluid-date"
                  type="date"
                  min="1900-01-01"
                  max={todayIso}
                  value={date}
                  aria-invalid={submitted && !isDateValid}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                {pl ? "Godzina" : "Time"}
                <input
                  id="fluid-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* Sekcja 4: Notatki i reakcja pupila */}
          <section className="medical-metadata">
            <header className="review-section-heading">
              <h2>
                <IconNotes size={17} className="text-cyan-600" aria-hidden="true" />
                {pl ? "4. Notatki i reakcja pupila (opcjonalnie)" : "4. Notes & pet response"}
              </h2>
              <small style={{ color: "#64748b" }}>{notes.length}/1000</small>
            </header>

            <textarea
              id="fluid-notes"
              rows={3}
              maxLength={1000}
              value={notes}
              placeholder={
                pl
                  ? "np. Wlew podany powoli przez 90 minut, pupil zniósł spokojnie, po powrocie miał lepszy apetyt."
                  : "e.g. Infused slowly over 90 mins, well tolerated."
              }
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>

          {/* Sekcja 5: Podsumowanie i pasek zapisu */}
          <section className="fluid-confirm-card">
            <div className="fluid-confirm-hint">
              <IconInfoCircle size={18} />
              <span>
                {pl
                  ? "Wpis automatycznie pojawi się w Osi Czasu zdrowia pupila i zostanie uwzględniony w pełnej historii leczenia."
                  : "This entry will automatically appear in pet's health timeline."}
              </span>
            </div>

            {submitted && !isValid && (
              <p className="weight-error" role="alert" style={{ margin: "0.25rem 0" }}>
                {pl
                  ? "Uzupełnij wymagane pola (płyn bazowy, objętość i poprawną datę) przed zapisaniem."
                  : "Fill in required fields before saving."}
              </p>
            )}

            {error && (
              <p className="weight-error" role="alert" style={{ margin: "0.25rem 0" }}>
                {error}
              </p>
            )}

            <div className="fluid-confirm-actions">
              <Link href={backUrl} className="fluid-btn-cancel">
                {pl ? "Anuluj" : "Cancel"}
              </Link>
              <button type="submit" disabled={saving} className="fluid-btn-save">
                <IconDeviceFloppy size={18} />
                {saving
                  ? pl
                    ? "Zapisywanie…"
                    : "Saving…"
                  : therapy
                    ? pl
                      ? "Zapisz zmiany"
                      : "Save changes"
                    : pl
                      ? "Zapisz kroplówkę"
                      : "Save infusion"}
              </button>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
