export declare const DEFAULT_APP_ORIGIN: string;
export declare const MAX_PILOT_WELCOME_BATCH: number;

export declare function resolveAppOrigin(
  rawSiteUrl: string | undefined,
  rawAppUrl: string | undefined,
): string;

export declare function normalizePilotWelcomeEmails(
  rawInput: unknown,
  maxBatch?: number,
): {
  valid: string[];
  invalid: string[];
  truncated: boolean;
};

export interface PilotWelcomeCardPayload {
  locale: "pl" | "en";
  subtitle: string;
  badge: string;
  heading: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  footerNote: string;
}

export declare function buildPilotWelcomeEmailContent(params: {
  email: string;
  locale?: "pl" | "en";
  appOrigin?: string;
}): {
  subject: string;
  registerUrl: string;
  card: PilotWelcomeCardPayload;
};
