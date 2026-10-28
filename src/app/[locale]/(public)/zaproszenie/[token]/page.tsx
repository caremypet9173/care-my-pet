import { Container } from "@/components/layout/container";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitation } from "@/features/household/accept-invitation";
import "@/styles/pets.css";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const userRes = supabase ? await supabase.auth.getUser() : null;
  const initialUserEmail = userRes?.data?.user?.email ?? null;

  return (
    <Container className="pets-page">
      <AcceptInvitation token={token} initialUserEmail={initialUserEmail} />
    </Container>
  );
}
