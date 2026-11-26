import { escapeHtml } from "./recovery-crypto.mjs";

export const DEFAULT_APP_ORIGIN = "https://caremypet.pl";
export const MAX_PILOT_WELCOME_BATCH = 50;

const PILOT_EMAIL_PATTERN =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const CONTROL_CHARS_PATTERN = /[\r\n\0]/;

/**
 * Resolves a safe public origin for Care My Pet links in emails.
 * @param {string | undefined} rawSiteUrl
 * @param {string | undefined} rawAppUrl
 * @returns {string}
 */
export function resolveAppOrigin(rawSiteUrl, rawAppUrl) {
  for (const candidate of [rawSiteUrl, rawAppUrl]) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed || CONTROL_CHARS_PATTERN.test(trimmed)) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.origin;
      }
    } catch {
      // ignore invalid URL and fall back
    }
  }
  return DEFAULT_APP_ORIGIN;
}

/**
 * Normalizes, validates, and deduplicates recipient email addresses for pilot welcome emails.
 * @param {unknown} rawInput
 * @param {number} [maxBatch]
 * @returns {{ valid: string[]; invalid: string[]; truncated: boolean }}
 */
export function normalizePilotWelcomeEmails(
  rawInput,
  maxBatch = MAX_PILOT_WELCOME_BATCH,
) {
  const list = Array.isArray(rawInput)
    ? rawInput
    : typeof rawInput === "string"
      ? [rawInput]
      : [];

  const valid = [];
  const invalid = [];
  const seen = new Set();
  let truncated = false;

  for (const item of list) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (CONTROL_CHARS_PATTERN.test(trimmed)) {
      invalid.push(trimmed.replace(/[\r\n\0]+/g, " "));
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (
      normalized.length < 3 ||
      normalized.length > 254 ||
      !PILOT_EMAIL_PATTERN.test(normalized)
    ) {
      invalid.push(trimmed);
      continue;
    }

    if (seen.has(normalized)) continue;
    if (valid.length >= maxBatch) {
      truncated = true;
      continue;
    }
    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid, truncated };
}

/**
 * Builds the subject, registration CTA URL, and email card payload for a pilot welcome email.
 * @param {{ email: string; locale?: "pl" | "en"; appOrigin?: string }} params
 */
export function buildPilotWelcomeEmailContent(params) {
  const locale = params.locale === "en" ? "en" : "pl";
  const origin = resolveAppOrigin(params.appOrigin, undefined);
  const registerUrl = `${origin}/${locale}/register`;
  const safeEmail = escapeHtml(params.email.trim().toLowerCase());

  if (locale === "en") {
    return {
      subject: "Care My Pet — your closed pilot access is now active",
      registerUrl,
      card: {
        locale: "en",
        subtitle: "Digital health record for your pets",
        badge: "Pilot invitation",
        heading: "Welcome to the Care My Pet closed pilot!",
        paragraphs: [
          `Your email address (<strong>${safeEmail}</strong>) has been added to the invited caregivers list. You can now create your account and start using the app.`,
          `<strong>How to get started in 2 minutes:</strong><br/>1. Click the button below to open the registration page.<br/>2. Choose <strong>Continue with Google</strong> (if this is your Google account) or enter your email address to receive a one-time activation link and set a password (min. 12 characters).<br/>3. Add your pet's profile and upload your first lab results (PDF or photo) — we will extract the values for you to review before saving.`,
          `Inside the pilot you can maintain pet health records, track lab trends and vitals (weight, blood pressure, glucose, temperature), manage medications and upcoming visits with reminders, use the AI assistant, and share records with co-caregivers or your vet.`,
          `We would love your feedback, ideas, and bug reports — use the pilot feedback button inside the app or simply reply to this email.`,
        ],
        cta: {
          label: "Create your Care My Pet account",
          url: registerUrl,
        },
        footerNote:
          "You are receiving this email because your address was invited to the Care My Pet closed pilot.",
      },
    };
  }

  return {
    subject: "Care My Pet — Twój dostęp do zamkniętego pilotażu jest już aktywny",
    registerUrl,
    card: {
      locale: "pl",
      subtitle: "Cyfrowa kartoteka zdrowia Twoich pupili",
      badge: "Zaproszenie do pilotażu",
      heading: "Witamy w zamkniętym pilotażu Care My Pet!",
      paragraphs: [
        `Twój adres e-mail (<strong>${safeEmail}</strong>) został dodany do listy zaproszonych opiekunów. Możesz już założyć swoje konto i zacząć korzystać z aplikacji.`,
        `<strong>Jak zacząć w 2 minuty:</strong><br/>1. Kliknij przycisk poniżej, aby przejść do strony rejestracji.<br/>2. Wybierz <strong>Kontynuuj z Google</strong> (jeśli to Twoje konto Google) albo podaj swój adres e-mail, aby otrzymać jednorazowy link aktywacyjny i ustalić hasło (min. 12 znaków).<br/>3. Dodaj profil swojego pupila i wgraj pierwsze wyniki badań (PDF lub zdjęcie) — odczytamy parametry za Ciebie i pokażemy je do zatwierdzenia przed zapisem.`,
        `W pilotażu czekają na Ciebie m.in. kartoteki pupili z analizą trendów wyników badań, historia wizyt i szczepień, pomiary życiowe (waga, ciśnienie, glukoza, temperatura), harmonogram leków, terminarz z przypomnieniami, asystent AI oraz bezpieczne udostępnianie kartoteki współopiekunom i weterynarzowi.`,
        `Będziemy wdzięczni za każdą uwagę, pomysł lub zgłoszenie błędu — w aplikacji znajdziesz przycisk do szybkiego przesyłania opinii, możesz też po prostu odpisać na tę wiadomość.`,
      ],
      cta: {
        label: "Załóż konto w Care My Pet",
        url: registerUrl,
      },
      footerNote:
        "Otrzymujesz tę wiadomość, ponieważ Twój adres został zaproszony do zamkniętego pilotażu Care My Pet.",
    },
  };
}
