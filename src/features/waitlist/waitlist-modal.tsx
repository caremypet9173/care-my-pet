"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconCheck,
  IconSparkles,
  IconX,
  IconArrowRight,
  IconAlertCircle,
} from "@tabler/icons-react";
import { joinWaitlist } from "./actions";

export function WaitlistModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [petsCount, setPetsCount] = useState(1);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        document.body.style.overflow = "hidden";
      }
    } else {
      if (dialog.open) {
        dialog.close();
        document.body.style.overflow = "";
      }
    }
  }, [isOpen]);

  function handleClose() {
    setIsSuccess(false);
    setErrorMessage("");
    onClose();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    const result = await joinWaitlist(formData);

    setIsPending(false);

    if (result.ok) {
      setIsSuccess(true);
      setEmail("");
      setPetsCount(1);
    } else {
      setErrorMessage(
        result.error === "invalid_email"
          ? pl
            ? "Wpisz poprawny adres e-mail."
            : "Please enter a valid email address."
          : pl
            ? "Wystąpił błąd podczas zapisu. Spróbuj ponownie."
            : "Could not save your request. Please try again.",
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="waitlist-dialog"
      aria-labelledby="waitlist-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          handleClose();
        }
      }}
    >
      <div className="waitlist-dialog-content">
        <button
          type="button"
          onClick={handleClose}
          className="waitlist-dialog-close"
          aria-label={pl ? "Zamknij" : "Close"}
        >
          <IconX size={18} aria-hidden="true" />
        </button>

        {!isSuccess ? (
          <>
            <div className="waitlist-dialog-header">
              <span className="waitlist-badge">
                <IconSparkles size={14} aria-hidden="true" />
                {pl ? "Zamknięty pilotaż" : "Closed Pilot"}
              </span>
              <h2 id="waitlist-dialog-title">
                {pl
                  ? "Zadbaj o zdrowie pupili bez chaosu"
                  : "Care for your pets without chaos"}
              </h2>
              <p>
                {pl
                  ? "Dołącz do grona opiekunów i zyskaj darmowy dostęp w dniu startu kolejnej tury pilotażu."
                  : "Join fellow caregivers and get free early access when the next pilot batch opens."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="waitlist-form">
              {/* Honeypot field dla botów */}
              <input
                type="text"
                name="website"
                className="waitlist-honeypot"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="waitlist-field">
                <label htmlFor="waitlist-email">
                  {pl ? "Twój adres e-mail" : "Your email address"} *
                </label>
                <input
                  id="waitlist-email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    pl ? "np. twoj.email@gmail.com" : "e.g. your.email@example.com"
                  }
                  disabled={isPending}
                />
              </div>

              <div className="waitlist-field">
                <input type="hidden" name="pets_count" value={petsCount} />

                {/* Widok Desktop: Elegancki suwak */}
                <div className="waitlist-slider-desktop">
                  <div className="waitlist-slider-field">
                    <div className="waitlist-slider-header">
                      <label htmlFor="waitlist-pets-desktop">
                        {pl
                          ? "Ile pupili masz pod opieką?"
                          : "How many pets do you care for?"}
                      </label>
                      <span className="waitlist-slider-badge" aria-live="polite">
                        <strong>{petsCount >= 10 ? "10+" : petsCount}</strong>{" "}
                        {pl
                          ? petsCount === 1
                            ? "pupil"
                            : petsCount < 5
                              ? "pupile"
                              : "pupili"
                          : petsCount === 1
                            ? "pet"
                            : "pets"}
                      </span>
                    </div>

                    <div className="waitlist-slider-track-wrap">
                      <input
                        id="waitlist-pets-desktop"
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={petsCount}
                        onChange={(e) => setPetsCount(Number(e.target.value))}
                        disabled={isPending}
                        aria-valuemin={1}
                        aria-valuemax={10}
                        aria-valuenow={petsCount}
                        className="waitlist-range-slider"
                      />
                      <div className="waitlist-slider-ticks" aria-hidden="true">
                        <span>1</span>
                        <span>2</span>
                        <span>3</span>
                        <span>4</span>
                        <span>5</span>
                        <span>6</span>
                        <span>7</span>
                        <span>8</span>
                        <span>9</span>
                        <span>10+</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Widok Mobile: Pigułki szybkiego wyboru [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5+ ] */}
                <div className="waitlist-pills-mobile">
                  <div className="waitlist-pills-field">
                    <div className="waitlist-pills-header">
                      <span className="waitlist-pills-label">
                        {pl
                          ? "Ile pupili masz pod opieką?"
                          : "How many pets do you care for?"}
                      </span>
                      <span className="waitlist-slider-badge" aria-live="polite">
                        <strong>{petsCount >= 5 ? "5+" : petsCount}</strong>{" "}
                        {pl
                          ? petsCount === 1
                            ? "pupil"
                            : petsCount < 5
                              ? "pupile"
                              : "pupili"
                          : petsCount === 1
                            ? "pet"
                            : "pets"}
                      </span>
                    </div>

                    <div
                      className="waitlist-pills-row"
                      role="group"
                      aria-label={
                        pl
                          ? "Wybierz liczbę pupili"
                          : "Select number of pets"
                      }
                    >
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected =
                          val === 5 ? petsCount >= 5 : petsCount === val;
                        const label = val === 5 ? "5+" : String(val);
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`waitlist-pill-btn ${isSelected ? "is-active" : ""}`}
                            onClick={() => setPetsCount(val)}
                            disabled={isPending}
                            aria-pressed={isSelected}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div
                  className="auth-alert is-error"
                  role="alert"
                  style={{ margin: 0, padding: ".65rem .85rem" }}
                >
                  <IconAlertCircle size={18} aria-hidden="true" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                className="waitlist-submit-btn"
                disabled={isPending}
              >
                {isPending ? (
                  pl ? "Zapisywanie…" : "Saving…"
                ) : (
                  <>
                    {pl ? "Zapisz mnie na start!" : "Sign me up!"}
                    <IconArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>

              <p className="waitlist-legal">
                {pl
                  ? "Podając e-mail, zgadzasz się na powiadomienie o pilotażu CareMyPet. Możesz się wypisać w każdej chwili."
                  : "By providing your email, you agree to receive notification about CareMyPet pilot. Unsubscribe anytime."}
              </p>
            </form>
          </>
        ) : (
          <div className="waitlist-success-view">
            <div className="waitlist-success-icon" aria-hidden="true">
              <IconCheck size={32} />
            </div>
            <h2>
              {pl
                ? "Dziękujemy! Jesteś na liście!"
                : "Thank you! You're on the list!"}
            </h2>
            <p>
              {pl
                ? "Zapisaliśmy Twój adres. Skontaktujemy się z Tobą mailowo, gdy tylko otworzymy kolejne miejsca w pilotażu."
                : "Your email has been saved. We will contact you as soon as the next pilot batch opens."}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="waitlist-submit-btn"
              style={{ marginTop: "0.5rem" }}
            >
              {pl ? "Super, zamknij okno" : "Close window"}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
