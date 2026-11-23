import { resolveSmtpConfig } from "./smtp-config.mjs";

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromEmail: string;
}

type ResolveSmtpConfigResult =
  | { ok: true; config: ResolvedSmtpConfig }
  | { ok: false; reason: string };

export type SmtpTransporter = {
  sendMail: (opts: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }) => Promise<unknown>;
  close?: () => void;
};

function readRuntimeSmtpConfig(): ResolveSmtpConfigResult {
  return resolveSmtpConfig((key: string) => Deno.env.get(key)) as ResolveSmtpConfigResult;
}

export function isSmtpConfigured(): boolean {
  return readRuntimeSmtpConfig().ok;
}

async function buildTransporter(
  config: ResolvedSmtpConfig,
  pooled: boolean,
): Promise<SmtpTransporter> {
  const { default: nodemailer } = await import("npm:nodemailer@6.9.16");
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(pooled ? { pool: true, maxConnections: 3, maxMessages: 50 } : {}),
    auth: {
      user: config.user,
      pass: config.pass,
    },
  }) as unknown as SmtpTransporter;
}

export async function createSmtpTransporter(options?: {
  pooled?: boolean;
}): Promise<{
  transporter: SmtpTransporter;
  from: string;
  config: ResolvedSmtpConfig;
}> {
  const resolved = readRuntimeSmtpConfig();
  if (!resolved.ok) {
    throw new Error(resolved.reason);
  }

  const { config } = resolved;
  const transporter = await buildTransporter(config, options?.pooled === true);
  return { transporter, from: config.from, config };
}

export async function sendSmtpEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const resolved = readRuntimeSmtpConfig();
  if (!resolved.ok) {
    console.warn(`SMTP not configured (${resolved.reason}); skipping email sending`);
    return false;
  }

  try {
    const transporter = await buildTransporter(resolved.config, false);
    await transporter.sendMail({
      from: resolved.config.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send SMTP email:", err);
    return false;
  }
}
