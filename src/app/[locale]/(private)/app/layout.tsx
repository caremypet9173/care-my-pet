import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const supabase = await createClient();
  const result = supabase ? await supabase.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect({ href: "/login", locale });
  return <><PublicHeader signedIn /><main id="main-content" tabIndex={-1}>{children}</main><PublicFooter signedIn /></>;
}
