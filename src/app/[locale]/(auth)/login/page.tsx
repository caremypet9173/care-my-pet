import { getLocale } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/features/auth/auth-form";
import { authMessages } from "@/features/auth/messages";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function generateMetadata() {
  return {
    title: authMessages[await getLocale()].login,
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Container width="prose">
      <Card className="login-panel" padding="lg">
        <AuthForm mode="login" configured={!!getSupabaseConfig()} initialError={error} />
      </Card>
    </Container>
  );
}
