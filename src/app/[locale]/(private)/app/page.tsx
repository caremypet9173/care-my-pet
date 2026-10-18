import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { SignOut } from "@/features/auth/sign-out";
import { authMessages } from "@/features/auth/messages";

export default async function AppPage() {
  const locale = await getLocale();
  const t = authMessages[locale];
  const supabase = await createClient();
  const result = supabase ? await supabase.auth.getUser() : null;
  if (!result?.data.user || result.error) return redirect({ href: "/login", locale });
  return <Container width="prose"><Card className="login-panel" padding="lg">
    <h1>{t.account}</h1><p>{t.signedIn} <strong>{result.data.user.email}</strong></p>
    <p>{t.next}</p><SignOut />
  </Card></Container>;
}
