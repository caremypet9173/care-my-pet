import "@/styles/help.css";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/types";
import {
  IconArrowRight,
  IconBellRinging,
  IconCheck,
  IconClock,
  IconFileAnalytics,
  IconQrcode,
  IconSparkles,
} from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { helpIndexContent } from "@/features/help/content";
import { HelpBreadcrumbs } from "@/features/help/help-components";

const GUIDE_ICONS = {
  notifications: IconBellRinging,
  "medical-reports": IconFileAnalytics,
  "sharing-and-recovery": IconQrcode,
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const content = helpIndexContent[locale];
  return {
    title: content.eyebrow,
    description: content.intro,
  };
}

export default async function HelpIndexPage() {
  const locale = (await getLocale()) as Locale;
  const content = helpIndexContent[locale];

  return (
    <Section>
      <Container>
        <HelpBreadcrumbs locale={locale} />
        <div className="help-hero">
          <Badge dot>{content.eyebrow}</Badge>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
        </div>

        <div className="help-index-grid">
          {content.guides.map((guide) => {
            const Icon = GUIDE_ICONS[guide.slug];
            return (
              <Link
                key={guide.slug}
                href={guide.href}
                className="help-index-card"
              >
                <div className="help-index-card-top">
                  <span className="icon-tile">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <span className="help-meta-pill">
                    <IconClock size={14} aria-hidden="true" />
                    {guide.readTime}
                  </span>
                </div>
                <h2>{guide.title}</h2>
                <p>{guide.description}</p>
                <ul className="help-index-card-list">
                  {guide.highlights.map((item) => (
                    <li key={item}>
                      <IconCheck size={16} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <span className="help-index-card-cta">
                  <span>{guide.cta}</span>
                  <IconArrowRight size={17} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>

        <aside className="help-shortcuts" aria-labelledby="help-shortcuts-heading">
          <h2 id="help-shortcuts-heading">
            <IconSparkles
              size={20}
              aria-hidden="true"
              style={{ verticalAlign: "-3px", marginRight: "0.45rem" }}
            />
            {content.shortcutsTitle}
          </h2>
          <div className="help-shortcuts-list">
            {content.shortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="help-shortcut-link"
              >
                <span>{shortcut.label}</span>
                <IconArrowRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </aside>
      </Container>
    </Section>
  );
}
