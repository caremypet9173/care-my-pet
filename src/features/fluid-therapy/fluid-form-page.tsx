"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconDroplet,
  IconDeviceFloppy,
  IconBuildingHospital,
  IconHome,
  IconNeedle,
  IconArrowLeft,
  IconNotes,
  IconTrash,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { Link, useRouter } from "@/i18n/navigation";
import type { Pet } from "@/features/pets/types";
import { saveFluidTherapy, deleteFluidTherapy } from "./actions";
import { FluidDeleteDialog } from "./fluid-delete-dialog";
import { COMMON_FLUIDS, type FluidLocation, type FluidRoute, type PetFluidTherapy } from "./types";
import "@/styles/fluid-form.css";

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

  const [volumeStr, setVolumeStr] = useState(therapy ? String(therapy.volume_ml) : "150");
  const [route, setRoute] = useState<FluidRoute>(therapy?.route ?? "sc");
  const [medicationsAdded, setMedicationsAdded] = useState(therapy?.medications_added ?? "");
  const [location, setLocation] = useState<FluidLocation>(therapy?.location ?? "home");
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
        return "20:00";
      }
    }
    return new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }).slice(0, 5);
  });

  const [notes, setNotes] = useState(therapy?.notes ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  async function handleDeleteConfirm() {
    if (!therapy || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const res = await deleteFluidTherapy({
        id: therapy.id,
        petId: pet.id,
        revision: therapy.revision,
      });

      if (!res.success) {
        setError(res.error || (pl ? "Nie udało się usunąć wpisu." : "Failed to delete entry."));
        setDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      setShowDeleteModal(false);
      router.push(`/app/zwierzeta/${pet.id}?tab=history`);
      router.refresh();
    } catch {
      setError(pl ? "Wystąpił nieoczekiwany błąd podczas usuwania." : "An error occurred during deletion.");
      setDeleting(false);
      setShowDeleteModal(false);
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
    <Container width="demo" className="pets-page fluid-page-shell">
      {/* 1. Nawigacja powrotu */}
      <Link href={backUrl} className="fluid-back-link">
        <IconArrowLeft size={16} aria-hidden="true" />
        <span>{pl ? `Wróć do kartoteki: ${pet.imie}` : `Back to record: ${pet.imie}`}</span>
      </Link>

      {/* 2. Nagłówek strony */}
      <header className="fluid-header-block">
        <div className="fluid-header-tag">
          <IconDroplet size={14} aria-hidden="true" />
          <span>{pl ? "Płynoterapia i wlewy" : "Fluid therapy"}</span>
        </div>
        <h1 className="fluid-header-title">
          {therapy
            ? pl
              ? `Edycja wpisu płynoterapii: ${pet.imie}`
              : `Edit fluid therapy: ${pet.imie}`
            : pl
              ? `Nowa płynoterapia / kroplówka: ${pet.imie}`
              : `New fluid therapy: ${pet.imie}`}
        </h1>
        <p className="fluid-header-subtitle">
          {pl
            ? "Wprowadź parametry wlewu. Wpis automatycznie zasili historię leczenia oraz dzienny plan opieki pupila."
            : "Record fluid therapy parameters for timeline and daily care."}
        </p>
      </header>

      {/* 3. Karta formularza */}
      <form onSubmit={handleSave} noValidate className="fluid-form-card">
        {/* Sekcja 1: Płyn bazowy i objętość */}
        <section className="fluid-section">
          <div className="fluid-section-header">
            <span className="fluid-section-icon is-cyan" aria-hidden="true">
              <IconDroplet size={18} />
            </span>
            <h2 className="fluid-section-title">
              {pl ? "1. Płyn bazowy i objętość wlewu" : "1. Base fluid & volume"}
            </h2>
          </div>

          <div className="fluid-grid-2">
            <div className="fluid-field">
              <label htmlFor="fluid-select" className="fluid-label">
                <span>{pl ? "Płyn bazowy *" : "Base fluid *"}</span>
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

            <div className="fluid-field">
              <label htmlFor="fluid-volume" className="fluid-label">
                <span>{pl ? "Objętość wlewu *" : "Volume *"}</span>
                {submitted && !isVolumeValid && (
                  <small style={{ color: "#dc2626" }}>{pl ? "Podaj 1-5000 ml" : "1-5000 ml"}</small>
                )}
              </label>
              <div className="fluid-volume-wrap">
                <input
                  id="fluid-volume"
                  className="fluid-input"
                  inputMode="decimal"
                  value={volumeStr}
                  placeholder="np. 150"
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
            <div className="fluid-field">
              <label htmlFor="custom-fluid" className="fluid-label">
                <span>{pl ? "Własna nazwa płynu *" : "Custom fluid name *"}</span>
              </label>
              <input
                id="custom-fluid"
                className="fluid-input"
                value={customFluid}
                placeholder={
                  pl
                    ? "np. Płyn Ringera z mleczanami + Glukoza 1:1"
                    : "e.g. Ringer lactate + 5% Glucose 1:1"
                }
                aria-invalid={submitted && effectiveFluid.length < 2}
                onChange={(e) => setCustomFluid(e.target.value)}
              />
            </div>
          )}

          <div className="fluid-chips-group">
            <span className="fluid-chips-hint">{pl ? "Szybki wybór:" : "Presets:"}</span>
            {volumePresets.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`fluid-chip-btn ${volumeStr === preset ? "is-active" : ""}`}
                onClick={() => setVolumeStr(preset)}
              >
                {preset} ml
              </button>
            ))}
          </div>
        </section>

        {/* Sekcja 2: Droga podania i skład */}
        <section className="fluid-section">
          <div className="fluid-section-header">
            <span className="fluid-section-icon" aria-hidden="true">
              <IconNeedle size={18} />
            </span>
            <h2 className="fluid-section-title">
              {pl ? "2. Droga podania i skład wlewu" : "2. Route & medications"}
            </h2>
          </div>

          <div className="fluid-field">
            <label className="fluid-label">
              <span>{pl ? "Droga podania *" : "Route *"}</span>
            </label>
            <div className="fluid-segment-grid">
              <button
                type="button"
                className={`fluid-segment-btn ${route === "iv" ? "is-active" : ""}`}
                onClick={() => setRoute("iv")}
              >
                <span>💉</span>
                <span>{pl ? "Dożylna (IV)" : "IV"}</span>
              </button>
              <button
                type="button"
                className={`fluid-segment-btn ${route === "sc" ? "is-active" : ""}`}
                onClick={() => setRoute("sc")}
              >
                <span>💧</span>
                <span>{pl ? "Podskórna (SC)" : "SC"}</span>
              </button>
              <button
                type="button"
                className={`fluid-segment-btn ${route === "io" ? "is-active" : ""}`}
                onClick={() => setRoute("io")}
              >
                <span>🦴</span>
                <span>{pl ? "Doszpikowa (IO)" : "IO"}</span>
              </button>
            </div>
          </div>

          <div className="fluid-field">
            <label htmlFor="fluid-meds" className="fluid-label">
              <span>{pl ? "Leki i dodatki włączone do wlewu (opcjonalnie)" : "Additives (optional)"}</span>
            </label>
            <input
              id="fluid-meds"
              className="fluid-input"
              value={medicationsAdded}
              placeholder={
                pl
                  ? "np. Duphalyte 10 ml, Cerenia 0.4 ml, Catosal 1 ml, KCl"
                  : "e.g. Duphalyte 10 ml, Cerenia 0.4 ml, Catosal 1 ml"
              }
              onChange={(e) => setMedicationsAdded(e.target.value)}
            />
            <div className="fluid-chips-group">
              <span className="fluid-chips-hint">{pl ? "Popularne:" : "Additives:"}</span>
              {medSuggestions.map((med) => (
                <button
                  key={med.label}
                  type="button"
                  className="fluid-chip-btn is-add"
                  onClick={() => appendMedication(med.val)}
                >
                  + {med.label}
                </button>
              ))}
            </div>
          </div>

          {route !== "sc" && (
            <div className="fluid-catheter-box">
              <div className="fluid-field">
                <label htmlFor="fluid-catheter" className="fluid-label">
                  <span>{pl ? "Stan wenflonu / wkłucia (opcjonalnie)" : "Catheter status (optional)"}</span>
                </label>
                <input
                  id="fluid-catheter"
                  className="fluid-input"
                  value={catheterStatus}
                  placeholder={
                    pl
                      ? "np. Wenflon drożny w lewej przedniej łapce, przepłukany heparyną"
                      : "e.g. Catheter patent, flushed"
                  }
                  onChange={(e) => setCatheterStatus(e.target.value)}
                />
              </div>
              <div className="fluid-chips-group">
                <span className="fluid-chips-hint">{pl ? "Szybki stan:" : "Status:"}</span>
                {catheterPresets.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="fluid-chip-btn is-add"
                    onClick={() => appendCatheter(status)}
                  >
                    + {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sekcja 3: Miejsce wykonania i data */}
        <section className="fluid-section">
          <div className="fluid-section-header">
            <span className="fluid-section-icon" aria-hidden="true">
              <IconBuildingHospital size={18} />
            </span>
            <h2 className="fluid-section-title">
              {pl ? "3. Miejsce i termin podania" : "3. Location & timing"}
            </h2>
          </div>

          <div className="fluid-field">
            <label className="fluid-label">
              <span>{pl ? "Miejsce wykonania *" : "Location *"}</span>
            </label>
            <div className="fluid-segment-grid is-2-col">
              <button
                type="button"
                className={`fluid-segment-btn ${location === "home" ? "is-active" : ""}`}
                onClick={() => setLocation("home")}
              >
                <IconHome size={17} aria-hidden="true" />
                <span>{pl ? "W domu (opiekun)" : "At home"}</span>
              </button>
              <button
                type="button"
                className={`fluid-segment-btn ${location === "clinic" ? "is-active" : ""}`}
                onClick={() => setLocation("clinic")}
              >
                <IconBuildingHospital size={17} aria-hidden="true" />
                <span>{pl ? "W lecznicy weterynaryjnej" : "At clinic"}</span>
              </button>
            </div>
          </div>

          {location === "clinic" ? (
            <div className="fluid-grid-2-equal">
              <div className="fluid-field">
                <label htmlFor="fluid-clinic" className="fluid-label">
                  <span>{pl ? "Lecznica / Gabinet" : "Clinic name"}</span>
                </label>
                <input
                  id="fluid-clinic"
                  className="fluid-input"
                  value={clinicName}
                  placeholder={pl ? "np. Przychodnia Weterynaryjna VETIS" : "Clinic name"}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>
              <div className="fluid-field">
                <label htmlFor="fluid-doctor" className="fluid-label">
                  <span>{pl ? "Lekarz prowadzący" : "Veterinarian"}</span>
                </label>
                <input
                  id="fluid-doctor"
                  className="fluid-input"
                  value={doctorName}
                  placeholder={pl ? "np. lek. wet. Anna Kowalska" : "Doctor name"}
                  onChange={(e) => setDoctorName(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="fluid-home-box">
              <IconHome size={18} aria-hidden="true" />
              <span>
                {pl
                  ? "Wlew wykonany w domu przez opiekuna (brak konieczności wpisywania danych gabinetu)."
                  : "Infusion administered at home by guardian."}
              </span>
            </div>
          )}

          <div className="fluid-grid-2-equal">
            <div className="fluid-field">
              <label htmlFor="fluid-date" className="fluid-label">
                <span>{pl ? "Data podania *" : "Date *"}</span>
                {submitted && !isDateValid && (
                  <small style={{ color: "#dc2626" }}>{pl ? "Nie późniejsza niż dziś" : "Max today"}</small>
                )}
              </label>
              <input
                id="fluid-date"
                type="date"
                className="fluid-input"
                min="1900-01-01"
                max={todayIso}
                value={date}
                aria-invalid={submitted && !isDateValid}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="fluid-field">
              <label htmlFor="fluid-time" className="fluid-label">
                <span>{pl ? "Godzina podania" : "Time"}</span>
              </label>
              <input
                id="fluid-time"
                type="time"
                className="fluid-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Sekcja 4: Notatki */}
        <section className="fluid-section">
          <div className="fluid-section-header">
            <span className="fluid-section-icon" aria-hidden="true">
              <IconNotes size={18} />
            </span>
            <h2 className="fluid-section-title">
              {pl ? "4. Notatki i samopoczucie pupila (opcjonalnie)" : "4. Notes & observations"}
            </h2>
          </div>

          <div className="fluid-field">
            <div className="fluid-label">
              <span>{pl ? "Obserwacje / reakcja pupila" : "Observations"}</span>
              <small>{notes.length}/1000</small>
            </div>
            <textarea
              id="fluid-notes"
              className="fluid-textarea"
              rows={3}
              maxLength={1000}
              value={notes}
              placeholder={
                pl
                  ? "np. Wlew podany powoli przez 45 minut, pupil zniósł spokojnie, po podaniu chętniej pił wodę."
                  : "e.g. Infused slowly over 45 mins, tolerated well."
              }
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </section>

        {/* Komunikat o błędzie */}
        {error && (
          <div className="fluid-error-alert" role="alert">
            <IconAlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {submitted && !isValid && (
          <div className="fluid-error-alert" role="alert">
            <IconAlertCircle size={18} aria-hidden="true" />
            <span>
              {pl
                ? "Uzupełnij wymagane pola (płyn bazowy, objętość i poprawną datę) przed zapisaniem."
                : "Please fill in all required fields before saving."}
            </span>
          </div>
        )}

        {/* Pasek akcji na dole karty */}
        <footer className="fluid-actions-bar">
          <div className="fluid-actions-left">
            {therapy && (
              <button
                type="button"
                className="fluid-btn fluid-btn-danger"
                onClick={() => setShowDeleteModal(true)}
                disabled={saving || deleting}
              >
                <IconTrash size={16} aria-hidden="true" />
                <span>{pl ? "Usuń wpis" : "Delete"}</span>
              </button>
            )}
          </div>

          <div className="fluid-actions-right">
            <Link href={backUrl} className="fluid-btn fluid-btn-secondary">
              {pl ? "Anuluj" : "Cancel"}
            </Link>

            <button
              type="submit"
              className="fluid-btn fluid-btn-primary"
              disabled={saving || deleting}
            >
              {saving ? (
                <span>{pl ? "Zapisywanie…" : "Saving…"}</span>
              ) : (
                <>
                  <IconDeviceFloppy size={18} aria-hidden="true" />
                  <span>
                    {therapy
                      ? pl
                        ? "Zapisz zmiany"
                        : "Save changes"
                      : pl
                        ? "Zapisz kroplówkę"
                        : "Save infusion"}
                  </span>
                </>
              )}
            </button>
          </div>
        </footer>
      </form>

      {/* Modal potwierdzenia usunięcia wpisu */}
      {showDeleteModal && therapy && (
        <FluidDeleteDialog
          title={`${therapy.fluid_name} (${therapy.volume_ml} ml)`}
          volumeMl={therapy.volume_ml}
          fluidName={therapy.fluid_name}
          date={therapy.administered_on}
          pending={deleting}
          error={error}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => void handleDeleteConfirm()}
        />
      )}
    </Container>
  );
}
