"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { IconSparkles } from "@tabler/icons-react";
import { WaitlistModal } from "./waitlist-modal";

export function WaitlistCtaButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className ?? "waitlist-submit-btn"}
      >
        <IconSparkles size={18} aria-hidden="true" />
        <span>{children ?? (pl ? "Jestem zainteresowany" : "Join waitlist")}</span>
      </button>

      <WaitlistModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
