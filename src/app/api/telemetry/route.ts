import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentUserClaims } from "@/lib/supabase/server";
import {
  sanitizeTelemetryEvent,
  type TelemetryEventPayload,
} from "@/lib/telemetry-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8192;
const MAX_EVENTS_PER_REQUEST = 20;

function noContentResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSameOriginRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestHost =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;
    return originUrl.host === requestHost;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return new NextResponse(null, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return noContentResponse();
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return noContentResponse();
  }

  if (!rawText || rawText.length > MAX_BODY_BYTES) {
    return noContentResponse();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return noContentResponse();
  }

  const rawEvents =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { events?: unknown }).events)
      ? ((parsed as { events: unknown[] }).events).slice(
          0,
          MAX_EVENTS_PER_REQUEST,
        )
      : [];

  const sanitized: TelemetryEventPayload[] = [];
  for (const item of rawEvents) {
    const clean = sanitizeTelemetryEvent(item);
    if (clean) sanitized.push(clean);
  }

  if (sanitized.length === 0) {
    return noContentResponse();
  }

  try {
    const [{ user }, client] = await Promise.all([
      getCurrentUserClaims(),
      createClient(),
    ]);
    if (!user || !client) {
      return noContentResponse();
    }

    await client.rpc("log_pilot_telemetry_batch", {
      p_events: sanitized,
    });
  } catch {
    // Telemetry failures must never surface to users.
  }

  return noContentResponse();
}
