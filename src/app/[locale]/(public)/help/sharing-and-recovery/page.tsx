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
  const content = sharingRecoveryGuideContent[locale];
  return {
    title: content.metaTitle,
    description: content.metaDescription,
  };
}

export default async function HelpSharingRecoveryPage() {
  const locale = (await getLocale()) as Locale;
  const content = sharingRecoveryGuideContent[locale];
  const common = helpCommonMessages[locale];
  const prevGuide = medicalReportsGuideContent[locale];

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

        {common.screenshotNote && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <HelpCallout
              kind="info"
              title="Screenshots language"
              body={common.screenshotNote}
            />
          </div>
        )}

        <section id="vet-share" className="help-section">
          <div className="help-section-head">
            <span className="help-section-eyebrow">
              {content.vetSection.eyebrow}
            </span>
            <h2>{content.vetSection.title}</h2>
            <p>{content.vetSection.intro}</p>
          </div>
          <HelpStepList steps={content.vetSection.steps} />
        </section>

        <section id="recovery-key" className="help-section">
          <div className="help-section-head">
            <span className="help-section-eyebrow">
              {content.recoverySection.eyebrow}
            </span>
            <h2>{content.recoverySection.title}</h2>
            <p>{content.recoverySection.intro}</p>
          </div>
          <HelpCallout
            kind="warning"
            title={content.recoverySection.calloutTitle}
            body={content.recoverySection.calloutBody}
          />
          <HelpStepList steps={content.recoverySection.steps} />
        </section>

        <HelpFaq title={content.faqTitle} items={content.faq} />

        <HelpGuideNav
          locale={locale}
          prev={{ href: "/help/medical-reports", label: prevGuide.title }}
        />
      </Container>
    </Section>
  );
}
