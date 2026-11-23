import "@/styles/help.css";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/types";
import { IconClock } from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import {
  helpCommonMessages,
  medicalReportsGuideContent,
  notificationsGuideContent,
  sharingRecoveryGuideContent,
} from "@/features/help/content";
import {
  HelpBreadcrumbs,
  HelpCallout,
  HelpFaq,
  HelpGuideNav,
  HelpStepList,
} from "@/features/help/help-components";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const content = medicalReportsGuideContent[locale];
  return {
    title: content.metaTitle,
    description: content.metaDescription,
  };
}

export default async function HelpMedicalReportsPage() {
  const locale = (await getLocale()) as Locale;
  const content = medicalReportsGuideContent[locale];
  const common = helpCommonMessages[locale];
  const prevGuide = notificationsGuideContent[locale];
  const nextGuide = sharingRecoveryGuideContent[locale];

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
          </div>
        </div>

        <section className="help-section">
          <h2 className="sr-only">{content.title}</h2>
          <HelpCallout
            kind="info"
            title={content.calloutTitle}
            body={content.calloutBody}
          />
          {common.screenshotNote && (
            <HelpCallout
              kind="info"
              title="Screenshots language"
              body={common.screenshotNote}
            />
          )}
          <HelpStepList steps={content.steps} />
        </section>

        <section className="help-section">
          <div className="help-section-head">
            <h2>{content.tipsTitle}</h2>
          </div>
          <div className="help-card-grid">
            {content.tips.map((tip) => (
              <div key={tip.title} className="help-simple-card">
                <h3>{tip.title}</h3>
                <p>{tip.body}</p>
              </div>
            ))}
          </div>
        </section>

        <HelpFaq title={content.faqTitle} items={content.faq} />

        <HelpGuideNav
          locale={locale}
          prev={{ href: "/help/notifications", label: prevGuide.title }}
          next={{ href: "/help/sharing-and-recovery", label: nextGuide.title }}
        />
      </Container>
    </Section>
  );
}
