import "@/styles/help.css";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/types";
import { IconCheck, IconClock } from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import {
  helpCommonMessages,
  medicalReportsGuideContent,
  notificationsGuideContent,
} from "@/features/help/content";
import {
  HelpBreadcrumbs,
  HelpCallout,
  HelpFaq,
  HelpGuideNav,
} from "@/features/help/help-components";
import { NotificationsPlatformGuide } from "@/features/help/notifications-platform-guide";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const content = notificationsGuideContent[locale];
  return {
    title: content.metaTitle,
    description: content.metaDescription,
  };
}

export default async function HelpNotificationsPage() {
  const locale = (await getLocale()) as Locale;
  const content = notificationsGuideContent[locale];
  const common = helpCommonMessages[locale];
  const nextGuide = medicalReportsGuideContent[locale];

  return (
    <Section>
      <Container>
        <HelpBreadcrumbs locale={locale} currentLabel={content.breadcrumb} />

        <div className="help-hero">
          <Badge dot>{content.eyebrow}</Badge>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
          <div className="help-hero-meta">
            <span className="help-meta-pill">
              <IconClock size={14} aria-hidden="true" />
              {content.readTime}
            </span>
            <span className="help-meta-pill">
              <IconCheck size={14} aria-hidden="true" />
              {content.updatedLabel}
            </span>
          </div>
        </div>

        {common.screenshotNote && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <HelpCallout
              kind="info"
              title="Screenshots language"
              body={common.screenshotNote}
            />
          </div>
        )}

        <NotificationsPlatformGuide content={content} />

        <HelpFaq title={content.faqTitle} items={content.faq} />

        <HelpGuideNav
          locale={locale}
          next={{ href: "/help/medical-reports", label: nextGuide.title }}
        />
      </Container>
    </Section>
  );
}
