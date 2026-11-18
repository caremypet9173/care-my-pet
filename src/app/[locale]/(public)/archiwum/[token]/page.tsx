import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { IconAlertTriangle, IconBan, IconClock } from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { fetchPetArchiveMeta } from "@/features/archive/data";
import { ArchivePortalView } from "@/features/archive/archive-portal-view";
import { archiveMessages } from "@/features/archive/messages";
import type { Locale } from "@/i18n/types";
import "@/styles/pets.css";
import "@/styles/medical.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = ((await getLocale()) as Locale) === "en" ? "en" : "pl";
  const t = archiveMessages[locale].portal;
  return {
    title: t.eyebrow,
    robots: { index: false, follow: false },
  };
}

export default async function PetArchivePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = ((await getLocale()) as Locale) === "en" ? "en" : "pl";
  const t = archiveMessages[locale].portal;

  const result = await fetchPetArchiveMeta(token);

  if (result.status === "expired" || result.status === "revoked" || result.status === "not_found") {
    const StatusIcon =
      result.status === "expired"
        ? IconClock
        : result.status === "revoked"
          ? IconBan
          : IconAlertTriangle;
    const title =
      result.status === "expired"
        ? t.expiredTitle
        : result.status === "revoked"
          ? t.revokedTitle
          : t.notFoundTitle;
    const description =
      result.status === "expired"
        ? t.expiredBody
        : result.status === "revoked"
          ? t.revokedBody
          : t.notFoundBody;

    return (
      <Container className="pets-page shared-unavailable-wrap">
        <section className="pet-panel shared-unavailable-card">
          <span className="shared-unavailable-icon" aria-hidden="true">
            <StatusIcon size={28} />
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>
      </Container>
    );
  }

  return (
    <Container className="pets-page archive-portal-wrap">
      <ArchivePortalView token={token} initialMeta={result.data} />
    </Container>
  );
}
