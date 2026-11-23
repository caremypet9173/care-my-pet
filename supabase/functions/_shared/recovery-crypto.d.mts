export declare const RECOVERY_KEY_PREFIX: string;
export declare const RECOVERY_KEY_LENGTH: number;
export declare const RECOVERY_KEY_GROUP_SIZE: number;
export declare const RECOVERY_MAX_FAILED_ATTEMPTS: number;
export declare const RECOVERY_LOCK_MINUTES: number;
export declare const RECOVERY_CLAIM_TTL_HOURS: number;
export declare const RECOVERY_PBKDF2_ITERATIONS: number;
export declare const RECOVERY_ALPHABET: string;

export declare function normalizeEmail(raw: unknown): string;
export declare function isValidEmail(raw: unknown): boolean;
export declare function maskEmail(rawEmail: unknown): string;
export declare function normalizeRecoveryKey(raw: unknown): string;
export declare function isValidRecoveryKeyFormat(raw: unknown): boolean;
export declare function formatRecoveryKey(raw: unknown): string;
export declare function formatRecoveryKeyHint(raw: unknown): string;
export declare function generateRecoveryKey(): string;
export declare function generateSaltHex(): string;
export declare function generateSecureToken(): string;
export declare function hashRecoveryKey(rawKey: string, saltHex: string): Promise<string>;
export declare function constantTimeEqualHex(a: string, b: string): boolean;
export declare function verifyRecoveryKey(
  rawKey: string,
  saltHex: string,
  expectedHashHex: string,
): Promise<boolean>;
export declare function escapeHtml(text: unknown): string;
