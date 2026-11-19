import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { createClient } from "@/lib/supabase/server";
import { RecoveryConfirmView } from "@/features/household/recovery-confirm-view";
import "@/styles/pets.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const pl = locale === "pl";
  return {
    title: pl
      ? "Potwierdzenie odzyskania domostwa"
      : "Confirm Household Recovery",
    robots: { index: false, follow: false },
  };
}

export default async function ConfirmRecoveryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const userRes = supabase ? await supabase.auth.getUser() : null;
  const initialUserEmail = userRes?.data?.user?.email ?? null;

  return (
    <Container className="pets-page recovery-page">
      <RecoveryConfirmView token={token} initialUserEmail={initialUserEmail} />
    </Container>
  );
}
