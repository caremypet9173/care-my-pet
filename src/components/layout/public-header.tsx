"use client";

import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/types";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useRef, useState } from "react";
import { IconMenu2, IconUser, IconX } from "@tabler/icons-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "./container";
import { LanguageSwitch } from "./language-switch";
import { AccountLink } from "@/features/auth/account-link";

function getLinks(t: Translator) {
  return [
    { href: "/features", label: t("features") },
    { href: "/how-it-works", label: t("howItWorks") },
  ];
}

export function PublicHeader({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("copy");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <header
      className="site-header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <Container className="header-inner">
        <BrandLogo />
        <nav className="desktop-nav" aria-label={t("mainNavigation")}>
          {getLinks(t).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <div className="desktop-language">
            <LanguageSwitch />
          </div>
          <AccountLink
            className="login-link"
            labelClassName="login-label"
            initialSignedIn={signedIn}
            onClick={() => setOpen(false)}
          >
            <span className="user-icon">
              <IconUser size={18} aria-hidden="true" />
            </span>
          </AccountLink>
          <button
            ref={toggle}
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <IconX aria-hidden="true" />
            ) : (
              <IconMenu2 aria-hidden="true" />
            )}
          </button>
        </div>
      </Container>
      <nav
        id="mobile-navigation"
        className="mobile-nav"
        aria-label={t("mobileNavigation")}
        hidden={!open}
      >
        <LanguageSwitch onChange={() => setOpen(false)} />
        {getLinks(t).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
