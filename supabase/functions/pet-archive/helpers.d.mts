export const ARCHIVE_TTL_DAYS: number;
export const ARCHIVE_TTL_MS: number;
export const ARCHIVE_MAX_FAILED_ATTEMPTS: number;
export const ARCHIVE_LOCK_MS: number;
export const ARCHIVE_SESSION_TTL_MS: number;
export const ARCHIVE_CODE_LENGTH: number;

export function normalizeArchiveEmail(raw: unknown): string;
export function isValidArchiveEmail(raw: unknown): boolean;
export function normalizeArchiveLabel(raw: unknown): string;
export function normalizeAccessCode(raw: unknown): string;
export function formatAccessCode(code: string): string;
export function generateAccessCode(): string;
export function generateArchiveToken(): string;
export function maskEmail(rawEmail: unknown): string;
export function generateSaltHex(): string;
export function hashAccessCode(rawCode: string, saltHex: string): Promise<string>;
export function constantTimeEqualHex(a: unknown, b: unknown): boolean;
export function verifyAccessCode(
  rawCode: unknown,
  saltHex: string,
  expectedHashHex: string,
): Promise<boolean>;
export function signArchiveSession(
  secret: string,
  payload: { link_id: string; pet_id: string },
  nowMs?: number,
): Promise<string>;
export function verifyArchiveSession(
  secret: string,
  token: unknown,
  nowMs?: number,
): Promise<{ link_id: string; pet_id: string; exp: number } | null>;
