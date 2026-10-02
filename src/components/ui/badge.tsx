import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/types";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: ComponentProps<"span"> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  dot?: boolean;
}) {
  return (
    <span {...props} className={cn("badge", `badge--${tone}`, className)}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function getStatuses(t: Translator) {
  return {
    within: { tone: "success", label: t("withinRange") },
    above: { tone: "danger", label: t("aboveRange") },
    below: { tone: "warning", label: t("belowRange") },
    unknown: { tone: "neutral", label: t("noReferenceRange") },
  } as const;
}

export function Status({
  status,
}: {
  status: keyof ReturnType<typeof getStatuses>;
}) {
  const t = useTranslations("copy");
  return (
    <Badge tone={getStatuses(t)[status].tone}>
      {getStatuses(t)[status].label}
    </Badge>
  );
}
