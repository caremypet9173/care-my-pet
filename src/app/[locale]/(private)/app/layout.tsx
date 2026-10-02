import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

// Closed by default until server-side authentication and RLS are integrated.
// Do not replace this with a client-only visibility check.
export default async function PrivateLayout() {
  redirect({ href: "/login", locale: await getLocale() });
}
