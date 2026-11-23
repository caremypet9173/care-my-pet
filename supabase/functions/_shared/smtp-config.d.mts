export declare const DEFAULT_SMTP_HOST: string;
export declare const DEFAULT_SMTP_PORT: number;
export declare const DEFAULT_SMTP_USER: string;
export declare const DEFAULT_SMTP_SENDER_NAME: string;

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromEmail: string;
}

export type ResolveSmtpConfigResult =
  | { ok: true; config: ResolvedSmtpConfig }
  | { ok: false; reason: string };

export declare function sanitizeHeaderValue(raw: unknown): string;
export declare function extractEmailAddress(raw: unknown): string | null;
export declare function parseSmtpPort(
  raw: string | undefined,
  fallback?: number,
): number;
export declare function parseSmtpSecure(
  raw: string | undefined,
  port: number,
): boolean;
export declare function formatSmtpFrom(
  rawFrom: string | undefined,
  rawSenderName: string | undefined,
  fallbackEmail: string | null,
): { from: string; fromEmail: string };
export declare function resolveSmtpConfig(
  getEnv: (key: string) => string | undefined,
): ResolveSmtpConfigResult;
export declare function resolveAdminNotifyEmail(
  getEnv: (key: string) => string | undefined,
): string;
