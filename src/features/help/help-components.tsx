import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBulb,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/types";
import {
  helpCommonMessages,
  type HelpFaqItem,
  type HelpShot,
  type HelpStep,
} from "./content";

export function HelpBreadcrumbs({
  locale,
  currentLabel,
}: {
  locale: Locale;
  currentLabel?: string;
}) {
  const c = helpCommonMessages[locale];
  return (
    <nav className="help-breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">{c.home}</Link>
      <span className="help-breadcrumbs-sep" aria-hidden="true">
        /
      </span>
      {currentLabel ? (
        <>
          <Link href="/help">{c.helpCenter}</Link>
          <span className="help-breadcrumbs-sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{currentLabel}</span>
        </>
      ) : (
        <span aria-current="page">{c.helpCenter}</span>
      )}
    </nav>
  );
}

export function HelpCallout({
  kind = "info",
  title,
  body,
}: {
  kind?: "info" | "warning";
  title: string;
  body: string;
}) {
  const Icon = kind === "warning" ? IconAlertTriangle : IconInfoCircle;
  return (
    <div className={`help-callout is-${kind}`} role="note">
      <Icon size={20} aria-hidden="true" />
      <div className="help-callout-body">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}

export function HelpScreenshot({ shot }: { shot: HelpShot }) {
  return (
    <figure className={`help-shot-figure${shot.wide ? " is-wide" : ""}`}>
      <div className={`help-shot-frame${shot.dark ? " is-dark" : ""}`}>
        <Image
          src={shot.src}
          width={shot.width}
          height={shot.height}
          alt={shot.alt}
          sizes={
            shot.wide
              ? "(max-width: 768px) 100vw, 1120px"
              : "(max-width: 768px) 90vw, 320px"
          }
        />
      </div>
      {shot.caption && (
        <figcaption className="help-shot-caption">{shot.caption}</figcaption>
      )}
    </figure>
  );
}

export function HelpStepList({ steps }: { steps: HelpStep[] }) {
  return (
    <ol className="help-steps-list">
      {steps.map((step) => {
        const shots = step.shots ?? [];
        const hasWide = shots.some((s) => s.wide);
        const hasMedia = shots.length > 0;
        const cardClass = [
          "help-step-card",
          hasWide ? "has-wide-media" : hasMedia ? "has-media" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={`${step.number}-${step.title}`} id={step.id} className={cardClass}>
            <div className="help-step-content">
              <div className="help-step-header">
                <span className="help-step-badge" aria-hidden="true">
                  {step.number}
                </span>
                <h3>{step.title}</h3>
              </div>
              <p>{step.body}</p>
              {step.bullets && step.bullets.length > 0 && (
                <ul className="help-step-bullets">
                  {step.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {step.tip && (
                <div className="help-step-tip">
                  <IconBulb size={18} aria-hidden="true" />
                  <span>{step.tip}</span>
                </div>
              )}
            </div>

            {hasMedia && (
              <div
                className={`help-media-grid${shots.length > 1 && !hasWide ? " is-pair" : ""}`}
              >
                {shots.map((shot) => (
                  <HelpScreenshot key={shot.src} shot={shot} />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function HelpFaq({
  title,
  items,
}: {
  title: string;
  items: HelpFaqItem[];
}) {
  return (
    <div className="faq">
      <h2>{title}</h2>
      {items.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function HelpGuideNav({
  locale,
  prev,
  next,
}: {
  locale: Locale;
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  const c = helpCommonMessages[locale];
  return (
    <nav className="help-footer-nav" aria-label={c.helpCenter}>
      <Link href="/help" className="help-footer-nav-link">
        <IconArrowLeft size={16} aria-hidden="true" />
        <span>{c.backToHelp}</span>
      </Link>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {prev && (
          <Link href={prev.href} className="help-footer-nav-link">
            <IconArrowLeft size={16} aria-hidden="true" />
            <span>{prev.label}</span>
          </Link>
        )}
        {next && (
          <Link href={next.href} className="help-footer-nav-link">
            <span>{next.label}</span>
            <IconArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </nav>
  );
}
