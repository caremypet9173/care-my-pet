export const ARCHIVE_TTL_DAYS = 7;
export const ARCHIVE_TTL_MS = ARCHIVE_TTL_DAYS * 24 * 60 * 60 * 1000;
export const ARCHIVE_MAX_FAILED_ATTEMPTS = 5;
export const ARCHIVE_LOCK_MS = 15 * 60 * 1000;
export const ARCHIVE_SESSION_TTL_MS = 30 * 60 * 1000;
export const ARCHIVE_CODE_LENGTH = 8;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 znaki, bez mylących 0/O/1/I
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function normalizeArchiveEmail(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export function isValidArchiveEmail(raw) {
  const email = normalizeArchiveEmail(raw);
  return email.length >= 3 && email.length <= 254 && EMAIL_RE.test(email);
}

export function normalizeArchiveLabel(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 120);
}

export function normalizeAccessCode(raw) {
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatAccessCode(code) {
  const clean = normalizeAccessCode(code);
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function generateAccessCode() {
  const bytes = new Uint8Array(ARCHIVE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function generateArchiveToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function maskEmail(rawEmail) {
  const email = normalizeArchiveEmail(rawEmail);
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
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

function fromBase64Url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSaltHex() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashAccessCode(rawCode, saltHex) {
  const normalized = normalizeAccessCode(rawCode);
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
      iterations: 10000,
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

export async function verifyAccessCode(rawCode, saltHex, expectedHashHex) {
  const clean = normalizeAccessCode(rawCode);
  if (clean.length !== ARCHIVE_CODE_LENGTH) return false;
  const computed = await hashAccessCode(clean, saltHex);
  return constantTimeEqualHex(computed, expectedHashHex);
}

async function importSessionKey(secret) {
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(`caremypet-archive-session-v1:${secret}`),
  );
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signArchiveSession(secret, payload, nowMs = Date.now()) {
  const body = {
    link_id: String(payload.link_id),
    pet_id: String(payload.pet_id),
    exp: nowMs + ARCHIVE_SESSION_TTL_MS,
  };
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(body)));
  const key = await importSessionKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyArchiveSession(secret, token, nowMs = Date.now()) {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  try {
    const key = await importSessionKey(secret);
    const sigBytes = fromBase64Url(sigB64);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payloadB64));
    if (!valid) return null;
    const parsed = JSON.parse(dec.decode(fromBase64Url(payloadB64)));
    if (
      !parsed ||
      typeof parsed.link_id !== "string" ||
      typeof parsed.pet_id !== "string" ||
      typeof parsed.exp !== "number" ||
      nowMs > parsed.exp
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
