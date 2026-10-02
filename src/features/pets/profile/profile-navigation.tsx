"use client";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/types";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import {
  IconLayoutDashboard,
  IconHistory,
  IconFlask,
  IconFiles,
} from "@tabler/icons-react";
function getItems(t: Translator) {
  return [
    { href: "/demo/luna", label: t("summary"), icon: IconLayoutDashboard },
    { href: "/demo/luna/historia", label: t("history"), icon: IconHistory },
    { href: "/demo/luna/wyniki", label: t("testResults"), icon: IconFlask },
    { href: "/demo/luna/dokumenty", label: t("documents"), icon: IconFiles },
  ];
}
export function ProfileNavigation() {
  const t = useTranslations("copy");
  const pathname = usePathname();
  return (
    <nav className="profile-navigation" aria-label={t("lunasPetRecord")}>
      {getItems(t).map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
