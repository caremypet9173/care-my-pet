import { escapeHtml } from "./recovery-crypto.mjs";
export { sendSmtpEmail } from "./smtp.ts";

export function renderEmailCard(params: {
  locale?: "pl" | "en";
  subtitle?: string;
  badge?: string;
  tone?: "default" | "warning";
  heading: string;
  paragraphs: string[];
  highlightBox?: { label: string; value: string; monospace?: boolean };
  cta?: { label: string; url: string };
  footerNote?: string;
}): string {
  const pl = params.locale !== "en";
  const subtitleText =
    params.subtitle ??
    (pl
      ? "Cyfrowa kartoteka zdrowia i bezpieczeństwo domostwa"
      : "Digital Pet Health Record & Household Security");

  const isWarning = params.tone === "warning";
  const badgeStyle = isWarning
    ? "display:inline-block;margin:0 0 14px;padding:4px 10px;border-radius:999px;background:#fff7e6;border:1px solid #f2c97d;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94520b;"
    : "display:inline-block;margin:0 0 14px;padding:4px 10px;border-radius:999px;background:#f4faf6;border:1px solid #b8d4c5;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#164d34;";

  const badgeHtml = params.badge
    ? `<span style="${badgeStyle}">${escapeHtml(params.badge)}</span>`
    : "";

  const paragraphsHtml = params.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:14px;color:#333c3a;line-height:1.58;">${p}</p>`,
    )
    .join("");

  const highlightHtml = params.highlightBox
    ? `<div style="margin:20px 0;padding:16px 18px;border-radius:10px;background:#f4faf6;border:1px solid #b8d4c5;text-align:center;">
         <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#4d6d5c;margin-bottom:6px;">${escapeHtml(params.highlightBox.label)}</div>
         <div style="font-size:20px;font-weight:700;color:#164d34;${params.highlightBox.monospace ? "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0.08em;" : ""}">${escapeHtml(params.highlightBox.value)}</div>
       </div>`
    : "";

  const ctaHtml = params.cta
    ? `<div style="text-align:center;margin:24px 0 10px;">
         <a href="${escapeHtml(params.cta.url)}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#164d34;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
           ${escapeHtml(params.cta.label)}
         </a>
       </div>
       <p style="margin:10px 0 0;font-size:12px;color:#526462;line-height:1.45;text-align:center;">
         ${pl ? "Bezpośredni link:" : "Direct link:"}
         <a href="${escapeHtml(params.cta.url)}" style="color:#164d34;word-break:break-all;">${escapeHtml(params.cta.url)}</a>
       </p>`
    : "";

  const defaultFooter = pl
    ? "Care My Pet · Wspólna opieka nad zdrowiem zwierząt"
    : "Care My Pet · Collaborative pet health care";

  const footerNoteHtml = params.footerNote
    ? `<p style="margin:0 0 6px;font-size:11px;color:#526462;line-height:1.5;text-align:center;">${escapeHtml(params.footerNote)}</p>`
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:12px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;width:100%;margin:0 auto;padding:24px;background:#fbf9f4;color:#1f241f;border:1px solid #ece5d8;border-radius:16px;text-align:left;box-sizing:border-box;">
            <div style="text-align:center;margin-bottom:20px;">
              <h1 style="color:#164d34;font-size:22px;font-weight:700;margin:0 0 6px 0;">Care My Pet</h1>
              <p style="color:#526462;font-size:13px;margin:0;">${escapeHtml(subtitleText)}</p>
            </div>
            <div style="background:#ffffff;border:1px solid #dfd7c8;border-radius:12px;padding:24px;margin-bottom:18px;">
              ${badgeHtml}
              <h2 style="margin:0 0 14px;font-size:18px;line-height:1.35;color:#1f241f;">${escapeHtml(params.heading)}</h2>
              ${paragraphsHtml}
              ${highlightHtml}
              ${ctaHtml}
            </div>
            ${footerNoteHtml}
            <p style="text-align:center;font-size:11px;color:#718b80;margin:0;">
              ${escapeHtml(defaultFooter)}
            </p>
          </div>
        </td>
      </tr>
    </table>
  `;
}
