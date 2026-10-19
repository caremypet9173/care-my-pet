import { getLocale } from "next-intl/server";
import { AuthShell } from "@/features/auth/auth-shell";
import { AuthForm } from "@/features/auth/auth-form";
import { authMessages } from "@/features/auth/messages";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function generateMetadata() {
  return { title: authMessages[await getLocale()].register, robots: { index: false, follow: false } };
}
export default function RegisterPage() {
  return <AuthShell>
    <AuthForm mode="register" configured={!!getSupabaseConfig()} />
  </AuthShell>;
}
