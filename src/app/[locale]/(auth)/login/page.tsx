import { getLocale } from "next-intl/server";
import { AuthShell } from "@/features/auth/auth-shell";
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
    <AuthShell>
        <AuthForm mode="login" configured={!!getSupabaseConfig()} initialError={error} />
    </AuthShell>
  );
}
