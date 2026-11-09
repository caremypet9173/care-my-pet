"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconDroplet,
  IconX,
  IconInfoCircle,
  IconDeviceFloppy,
  IconBuildingHospital,
  IconHome,
  IconNeedle,
} from "@tabler/icons-react";
import { saveFluidTherapy } from "./actions";
import { COMMON_FLUIDS, type FluidLocation, type FluidRoute, type PetFluidTherapy } from "./types";

export function FluidDialog({
  petId,
  petName,
  therapy,
  onClose,
  onSave,
}: {
  petId: string;
  petName: string;
  therapy: PetFluidTherapy | null;
  onClose: () => void;
  onSave: (row: PetFluidTherapy) => void;
}) {
  const pl = useLocale() === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

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
        petId,
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
              ? "Wpis został zmieniony przez kogoś innego. Odśwież stronę."
              : "Entry modified elsewhere. Refresh page."
            : pl
              ? `Błąd zapisu: ${res.error}`
              : `Save error: ${res.error}`
        );
        return;
      }

      if (res.data) {
        onSave(res.data);
      }
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

  return (
    <dialog
      className="weight-dialog history-dialog fluid-therapy-dialog"
      ref={dialog}
      aria-labelledby="fluid-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={handleSave} noValidate className="fluid-dialog-form">
        <header>
          <span className="weight-dialog-icon history-dialog-icon is-fluid">
            <IconDroplet size={24} />
          </span>
          <div>
            <h2 id="fluid-dialog-title">
              {therapy
                ? pl
                  ? "Edytuj wpis kroplówki"
                  : "Edit infusion entry"
                : pl
                  ? "Dodaj płynoterapię / kroplówkę"
                  : "Add fluid therapy / infusion"}
            </h2>
            <p>
              {petName} • {pl ? "Wlewy i nawadnianie" : "Fluid therapy & infusions"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={pl ? "Zamknij okno" : "Close dialog"}
          >
            <IconX size={20} />
          </button>
        </header>

        <div className="weight-dialog-info">
          <IconInfoCircle size={18} />
          <p>
            {pl
              ? "Wpis automatycznie pojawi się w Osi Czasu zdrowia pupila i zostanie uwzględniony w historii leczenia."
              : "This entry will automatically appear on the pet's Health Timeline."}
          </p>
        </div>

        <fieldset disabled={saving} className="fluid-form-fieldset">
          {submitted && !isValid && (
            <p className="weight-error" role="alert">
              {pl
                ? "Popraw zaznaczone pola przed zapisaniem wlewu."
                : "Correct highlighted fields before saving."}
            </p>
          )}

          {/* SEKCJA 1: Płyn bazowy i objętość */}
          <div className="fluid-form-section">
            <div className="fluid-section-header">
              <IconDroplet size={17} className="text-cyan-600" />
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
              <IconNeedle size={17} className="text-cyan-600" />
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
              <IconBuildingHospital size={17} className="text-cyan-600" />
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
                rows={2}
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
            <p className="weight-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>

        <footer>
          <button type="button" onClick={onClose} disabled={saving}>
            {pl ? "Anuluj" : "Cancel"}
          </button>
          <button type="submit" disabled={saving}>
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
        </footer>
      </form>
    </dialog>
  );
}
