"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

function LanguageFlag({ locale }: { locale: "pl" | "en" }) {
  return (
    <svg
      className="language-flag"
      viewBox={locale === "pl" ? "0 0 60 40" : "0 0 60 30"}
      width="30"
      height={locale === "pl" ? 20 : 15}
      aria-hidden="true"
      focusable="false"
    >
      {locale === "pl" ? (
        <>
          <path fill="#fff" d="M0 0h60v40H0z" />
          <path fill="#dc143c" d="M0 20h60v20H0z" />
        </>
      ) : (
        <>
          <path fill="#012169" d="M0 0h60v30H0z" />
          <path stroke="#fff" strokeWidth="6" d="m0 0 60 30m0-30L0 30" />
          <path
            fill="#c8102e"
            d="M0 0v2.236L25.528 15H30L0 0Zm30 15 30 15v-2.236L34.472 15H30ZM60 0h-4.472L30 12.764V15L60 0ZM30 15 0 30h4.472L30 17.236V15Z"
          />
          <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
          <path stroke="#c8102e" strokeWidth="6" d="M30 0v30M0 15h60" />
        </>
      )}
    </svg>
  );
}

export function LanguageSwitch({ onChange }: { onChange?: () => void }) {
  const locale = useLocale();
  const t = useTranslations("copy");
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={t("language")}
      aria-busy={pending}
    >
      {routing.locales.map((target) => (
        <button
          key={target}
          type="button"
          lang={target}
          aria-label={target === "pl" ? "Polski" : "English"}
          title={target === "pl" ? "Polski" : "English"}
          aria-pressed={locale === target}
          disabled={pending}
          onClick={() => {
            if (target === locale) return;
            const href = `${pathname}${window.location.search}${window.location.hash}`;
            startTransition(() =>
              router.replace(href, { locale: target, scroll: false }),
            );
            onChange?.();
          }}
        >
          <LanguageFlag locale={target} />
        </button>
      ))}
    </div>
  );
}
