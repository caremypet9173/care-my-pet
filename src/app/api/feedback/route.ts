import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentUserClaims } from "@/lib/supabase/server";
import {
  sanitizeFeedbackPayload,
  type FeedbackCategory,
  type FeedbackListItem,
  type FeedbackStatus,
} from "@/lib/feedback-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24 * 1024;

function jsonReply(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
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

export async function GET(): Promise<NextResponse> {
  try {
    const [{ user }, client] = await Promise.all([
      getCurrentUserClaims(),
      createClient(),
    ]);
    if (!user || !client) {
      return jsonReply({ error: "unauthorized" }, 401);
    }

    const { data, error } = await client
      .from("pilot_feedback")
      .select(
        "id, category, message, route_template, active_tab, status, screenshot_path, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[feedback GET error]", error.code ?? error.message);
      return jsonReply({ error: "load_failed" }, 500);
    }

    const items: FeedbackListItem[] = (data ?? []).map((row) => ({
      id: String(row.id),
      category: row.category as FeedbackCategory,
      message: String(row.message ?? ""),
      route_template: String(row.route_template ?? "/"),
      active_tab: String(row.active_tab ?? ""),
      status: row.status as FeedbackStatus,
      has_screenshot: Boolean(row.screenshot_path),
      created_at: String(row.created_at ?? ""),
    }));

    return jsonReply({ items });
  } catch {
    return jsonReply({ error: "load_failed" }, 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return jsonReply({ error: "forbidden" }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonReply({ error: "payload_too_large" }, 413);
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return jsonReply({ error: "invalid_input" }, 400);
  }

  if (!rawText || rawText.length > MAX_BODY_BYTES) {
    return jsonReply({ error: "invalid_input" }, 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return jsonReply({ error: "invalid_input" }, 400);
  }

  const payload = sanitizeFeedbackPayload(
    parsed,
    request.headers.get("user-agent") ?? "",
  );
  if (!payload) {
    return jsonReply({ error: "invalid_input" }, 400);
  }

  try {
    const [{ user }, client] = await Promise.all([
      getCurrentUserClaims(),
      createClient(),
    ]);
    if (!user || !client) {
      return jsonReply({ error: "unauthorized" }, 401);
    }

    if (
      payload.screenshot_path &&
      !payload.screenshot_path.startsWith(`${user.id}/`)
    ) {
      return jsonReply({ error: "invalid_screenshot_path" }, 403);
    }

    const { data, error } = await client
      .from("pilot_feedback")
      .insert({
        user_id: user.id,
        category: payload.category,
        message: payload.message,
        route_template: payload.route_template,
        active_tab: payload.active_tab,
        locale: payload.locale,
        device_class: payload.device_class,
        is_pwa: payload.is_pwa,
        viewport: payload.viewport,
        user_agent: payload.user_agent,
        breadcrumbs: payload.breadcrumbs,
        recent_errors: payload.recent_errors,
        screenshot_path: payload.screenshot_path,
        screenshot_mime: payload.screenshot_mime,
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      if (error.code === "PT429") {
        return jsonReply({ error: "daily_limit" }, 429);
      }
      console.error("[feedback POST error]", error.code ?? error.message);
      return jsonReply({ error: "save_failed" }, 500);
    }

    return jsonReply(
      {
        id: data.id,
        status: data.status,
        created_at: data.created_at,
      },
      201,
    );
  } catch {
    return jsonReply({ error: "save_failed" }, 500);
  }
}
