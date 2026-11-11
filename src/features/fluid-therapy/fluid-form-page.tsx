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
    <div className="fluid-page-container">
      {/* Pasek nagłówkowy strony */}
      <header className="fluid-page-header">
        <Link href={backUrl} className="fluid-page-back">
          <IconArrowLeft size={18} aria-hidden="true" />
          <span>{pl ? "Wróć do osi czasu pupila" : "Back to pet timeline"}</span>
        </Link>
        <div className="fluid-page-title-wrap">
          <span className="fluid-page-icon-badge">
            <IconDroplet size={24} />
          </span>
          <div className="fluid-page-title-text">
            <h1>
              {therapy
                ? pl
                  ? "Edytuj wpis płynoterapii"
                  : "Edit fluid therapy"
                : pl
                  ? "Nowa płynoterapia / kroplówka"
                  : "New fluid therapy / infusion"}
            </h1>
            <p>
              {pet.imie} • {pl ? "Wlewy i nawadnianie" : "Fluid therapy & infusions"}
            </p>
          </div>
        </div>
        <span className="fluid-page-tag">
          {pl ? "Kroplówki i wlewy" : "Infusions"}
        </span>
      </header>

      {/* Komunikat informacyjny */}
      <div className="fluid-page-info">
        <IconInfoCircle size={19} />
        <p>
          {pl
            ? "Wpis automatycznie pojawi się w Osi Czasu zdrowia pupila i zostanie uwzględniony w pełnej historii leczenia."
            : "This entry will automatically appear on the pet's Health Timeline."}
        </p>
      </div>

      <form onSubmit={handleSave} noValidate className="fluid-page-form">
        <fieldset disabled={saving} className="fluid-page-fieldset">
          {submitted && !isValid && (
            <p className="weight-error" role="alert" style={{ marginBottom: "1rem" }}>
              {pl
                ? "Popraw zaznaczone pola przed zapisaniem wlewu."
                : "Correct highlighted fields before saving."}
            </p>
          )}

          {/* SEKCJA 1: Płyn bazowy i objętość */}
          <div className="fluid-form-section">
            <div className="fluid-section-header">
              <IconDroplet size={18} className="text-cyan-600" />
              <h3>{pl ? "1. Płyn bazowy i objętość wlewu" : "1. Base fluid & volume"}</h3>
            </div>

            <div className="history-dialog-grid">
              <div>
                <label htmlFor="fluid-select">
                  {pl ? "Płyn bazowy *" : "Base fluid *"}
                </label>
                <select
                  id="fluid-select"
                  className="fluid-select"
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
              </div>

              <div>
                <label htmlFor="fluid-volume">
                  {pl ? "Objętość wlewu *" : "Volume *"}
                </label>
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
              </div>
            </div>

            {isCustom && (
              <div>
                <label htmlFor="custom-fluid">
                  {pl ? "Nazwa własna płynu *" : "Custom fluid name *"}
                </label>
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
              </div>
            )}

            <div className="fluid-presets-row">
              <span className="fluid-presets-label">
                {pl ? "Szybki wybór objętości:" : "Quick volume:"}
              </span>
              <div className="fluid-chips">
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
          </div>

          {/* SEKCJA 2: Droga podania i leki włączone */}
          <div className="fluid-form-section">
            <div className="fluid-section-header">
              <IconNeedle size={18} className="text-cyan-600" />
              <h3>{pl ? "2. Droga podania i skład wlewu" : "2. Route & medication additives"}</h3>
            </div>

            <div>
              <label>{pl ? "Droga podania *" : "Route *"}</label>
              <div className="fluid-segmented-grid">
                <button
                  type="button"
                  className={`fluid-seg-btn ${route === "iv" ? "is-active" : ""}`}
                  onClick={() => setRoute("iv")}
                >
                  <span className="fluid-seg-icon">💉</span>
                  <span>{pl ? "Dożylna (IV — wenflon)" : "Intravenous (IV)"}</span>
                </button>
                <button
                  type="button"
                  className={`fluid-seg-btn ${route === "sc" ? "is-active" : ""}`}
                  onClick={() => setRoute("sc")}
                >
                  <span className="fluid-seg-icon">💧</span>
                  <span>{pl ? "Podskórna (SC)" : "Subcutaneous (SC)"}</span>
                </button>
                <button
                  type="button"
                  className={`fluid-seg-btn ${route === "io" ? "is-active" : ""}`}
                  onClick={() => setRoute("io")}
                >
                  <span className="fluid-seg-icon">🦴</span>
                  <span>{pl ? "Doszpikowa (IO)" : "Intraosseous (IO)"}</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="fluid-meds">
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
                  {pl ? "Popularne dodatki:" : "Popular additives:"}
                </span>
                <div className="fluid-chips">
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
                <label htmlFor="fluid-catheter">
                  {pl ? "Stan wenflonu / wkłucia (opcjonalnie)" : "Catheter status (optional)"}
                </label>
                <input
                  id="fluid-catheter"
                  value={catheterStatus}
                  placeholder={
                    pl
                      ? "np. Wenflon drożny w lewej przedniej łapce, przepłukany heparyną"
                      : "e.g. Patent in left foreleg, flushed"
                  }
                  onChange={(e) => setCatheterStatus(e.target.value)}
                />
                <div className="fluid-presets-row">
                  <span className="fluid-presets-label">
                    {pl ? "Szybki stan:" : "Quick status:"}
                  </span>
                  <div className="fluid-chips">
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
          </div>

          {/* SEKCJA 3: Miejsce wykonania i termin */}
          <div className="fluid-form-section">
            <div className="fluid-section-header">
              <IconBuildingHospital size={18} className="text-cyan-600" />
              <h3>{pl ? "3. Miejsce wykonania i data wlewu" : "3. Location & administration time"}</h3>
            </div>

            <div>
              <label>{pl ? "Miejsce wykonania" : "Location"}</label>
              <div className="fluid-segmented-grid fluid-segmented-location">
                <button
                  type="button"
                  className={`fluid-seg-btn ${location === "clinic" ? "is-active" : ""}`}
                  onClick={() => setLocation("clinic")}
                >
                  <IconBuildingHospital size={17} />
                  <span>{pl ? "W lecznicy weterynaryjnej" : "At vet clinic"}</span>
                </button>
                <button
                  type="button"
                  className={`fluid-seg-btn ${location === "home" ? "is-active" : ""}`}
                  onClick={() => setLocation("home")}
                >
                  <IconHome size={17} />
                  <span>{pl ? "W domu (opiekun)" : "At home (by guardian)"}</span>
                </button>
              </div>
            </div>

            {location === "clinic" ? (
              <div className="history-dialog-grid">
                <div>
                  <label htmlFor="fluid-clinic">
                    {pl ? "Lecznica / Gabinet" : "Clinic"}
                  </label>
                  <input
                    id="fluid-clinic"
                    value={clinicName}
                    placeholder={pl ? "np. Przychodnia Weterynaryjna VETIS" : "Clinic name"}
                    onChange={(e) => setClinicName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="fluid-doctor">
                    {pl ? "Lekarz prowadzący" : "Veterinarian"}
                  </label>
                  <input
                    id="fluid-doctor"
                    value={doctorName}
                    placeholder={pl ? "np. lek. wet. Łukasz Bęben" : "Doctor name"}
                    onChange={(e) => setDoctorName(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="fluid-home-hint">
                <IconHome size={16} />
                <span>
                  {pl
                    ? "Wlew wykonany w domu przez opiekuna (brak konieczności uzupełniania danych gabinetu)."
                    : "Infusion administered at home by guardian."}
                </span>
              </div>
            )}

            <div className="history-dialog-grid">
              <div>
                <label htmlFor="fluid-date">
                  {pl ? "Data podania *" : "Date *"}
                </label>
                <input
                  id="fluid-date"
                  type="date"
                  min="1900-01-01"
                  max={todayIso}
                  value={date}
                  aria-invalid={submitted && !isDateValid}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="fluid-time">
                  {pl ? "Godzina" : "Time"}
                </label>
                <input
                  id="fluid-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="weight-note-label">
                <label htmlFor="fluid-notes">
                  {pl ? "Notatki / samopoczucie pupila (opcjonalnie)" : "Notes (optional)"}
                </label>
                <small>{notes.length}/1000</small>
              </div>
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
            </div>
          </div>

          {error && (
            <p className="weight-error" role="alert" style={{ marginTop: "1rem" }}>
              {error}
            </p>
          )}

          <div className="fluid-page-actions-bar">
            <Link href={backUrl} className="fluid-page-cancel-btn">
              {pl ? "Anuluj" : "Cancel"}
            </Link>
            <button type="submit" disabled={saving} className="fluid-page-submit-btn">
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
        </fieldset>
      </form>
    </div>
  );
}
