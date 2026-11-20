"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { IconSparkles } from "@tabler/icons-react";
import "@/styles/waitlist-cta.css";

const WaitlistModal = dynamic(
  () => import("./waitlist-modal").then((m) => m.WaitlistModal),
  { ssr: false },
);

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

      {isOpen && <WaitlistModal isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}
