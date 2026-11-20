import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { RecoveryPortal } from "@/features/household/recovery-portal";
import "@/styles/pets.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const pl = locale === "pl";
  return {
    title: pl ? "Odzyskiwanie dostępu do domostwa" : "Household Access Recovery",
    robots: { index: false, follow: false },
  };
}

export default function RecoveryPage() {
  return (
    <Container className="pets-page recovery-page">
      <RecoveryPortal />
    </Container>
  );
}
