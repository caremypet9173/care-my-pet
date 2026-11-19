export const RECOVERY_KEY_PREFIX = "CMP";
export const RECOVERY_KEY_LENGTH = 20;
export const RECOVERY_KEY_GROUP_SIZE = 4;
export const RECOVERY_MAX_FAILED_ATTEMPTS = 5;
export const RECOVERY_LOCK_MINUTES = 15;
export const RECOVERY_CLAIM_TTL_HOURS = 24;
export const RECOVERY_PBKDF2_ITERATIONS = 100000;

// 32 jednoznaczne znaki (bez 0/O/1/I) -> 256 % 32 === 0 (brak biasu modulo)
export const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const enc = new TextEncoder();

export function normalizeEmail(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw) {
  const email = normalizeEmail(raw);
  return email.length >= 3 && email.length <= 254 && EMAIL_RE.test(email);
}

export function maskEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

export function normalizeRecoveryKey(raw) {
  if (typeof raw !== "string") return "";
  let clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.startsWith(RECOVERY_KEY_PREFIX) && clean.length === RECOVERY_KEY_LENGTH + RECOVERY_KEY_PREFIX.length) {
    clean = clean.slice(RECOVERY_KEY_PREFIX.length);
  }
  return clean;
}

export function isValidRecoveryKeyFormat(raw) {
  const clean = normalizeRecoveryKey(raw);
  if (clean.length !== RECOVERY_KEY_LENGTH) return false;
  for (let i = 0; i < clean.length; i += 1) {
    if (!RECOVERY_ALPHABET.includes(clean[i])) return false;
  }
  return true;
}

export function formatRecoveryKey(raw) {
  const clean = normalizeRecoveryKey(raw);
  if (!clean) return "";
  const groups = [];
  for (let i = 0; i < clean.length; i += RECOVERY_KEY_GROUP_SIZE) {
    groups.push(clean.slice(i, i + RECOVERY_KEY_GROUP_SIZE));
  }
  return `${RECOVERY_KEY_PREFIX}-${groups.join("-")}`;
}

export function formatRecoveryKeyHint(raw) {
  const clean = normalizeRecoveryKey(raw);
  if (clean.length < 4) return `${RECOVERY_KEY_PREFIX}-...`;
  return `${RECOVERY_KEY_PREFIX}-...${clean.slice(-4)}`;
}

export function generateRecoveryKey() {
  const bytes = new Uint8Array(RECOVERY_KEY_LENGTH);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (let i = 0; i < bytes.length; i += 1) {
    raw += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  return formatRecoveryKey(raw);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateSaltHex() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function generateSecureToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function hashRecoveryKey(rawKey, saltHex) {
  const normalized = normalizeRecoveryKey(rawKey);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalized),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: RECOVERY_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export function constantTimeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyRecoveryKey(rawKey, saltHex, expectedHashHex) {
  if (!isValidRecoveryKeyFormat(rawKey)) return false;
  const computed = await hashRecoveryKey(rawKey, saltHex);
  return constantTimeEqualHex(computed, expectedHashHex);
}

export function escapeHtml(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
