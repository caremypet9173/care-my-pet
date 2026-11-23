"use client";

import {
  IconAlertCircle,
  IconCalendar,
  IconFlask,
  IconHeart,
  IconPill,
  IconPlus,
  IconScale,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { usePetQuickAddOptional } from "./pet-quick-actions";

export interface SummaryStatsProps {
  locale: "pl" | "en";
  labels: {
    nextVisit: string;
    overdueVisit: string;
    weight: string;
    latest: string;
    care: string;
  };
  nextVisit: {
    date: string | null;
    title: string;
    isOverdue: boolean;
    overdueCount: number;
  };
  weight: {
    value: string;
    sub: string;
  };
  latestReport: {
    value: string;
    sub: string;
  };
  care: {
    hasActiveMeds: boolean;
    value: string;
    sub: string;
  };
}

function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}

export function SummaryStatTiles({
  locale,
  labels,
  nextVisit,
  weight,
  latestReport,
  care,
}: SummaryStatsProps) {
  const pl = locale === "pl";
  const quickAdd = usePetQuickAddOptional();
  const CareIcon = care.hasActiveMeds ? IconPill : IconHeart;
  const VisitIcon = nextVisit.isOverdue ? IconAlertCircle : IconCalendar;

  const visitSub =
    !nextVisit.isOverdue && nextVisit.overdueCount > 0
      ? `${nextVisit.title} · ${
          pl
            ? `+${nextVisit.overdueCount} ${
                nextVisit.overdueCount === 1 ? "zaległy" : "zaległe"
              }`
            : `+${nextVisit.overdueCount} overdue`
        }`
      : nextVisit.isOverdue && nextVisit.overdueCount > 1
        ? `${nextVisit.title} · ${
            pl
              ? `łącznie ${nextVisit.overdueCount} zaległych`
              : `${nextVisit.overdueCount} overdue total`
          }`
        : nextVisit.title;

  return (
    <div className="household-record-stats">
      <button
        type="button"
        className={`household-stat-card${nextVisit.isOverdue ? " is-overdue" : ""}`}
        onClick={() => scrollToAnchor("pet-schedule-anchor")}
      >
        <VisitIcon size={20} aria-hidden="true" />
        <h2>{nextVisit.isOverdue ? labels.overdueVisit : labels.nextVisit}</h2>
        <strong>{nextVisit.date ?? "—"}</strong>
        <p title={visitSub}>{visitSub}</p>
      </button>

      <button
        type="button"
        className="household-stat-card"
        onClick={() => quickAdd?.navigateTo(4, "weight")}
      >
        <IconScale size={20} aria-hidden="true" />
        <h2>{labels.weight}</h2>
        <strong>{weight.value}</strong>
        <p title={weight.sub}>{weight.sub}</p>
      </button>

      <button
        type="button"
        className="household-stat-card"
        onClick={() => quickAdd?.navigateTo(2)}
      >
        <IconFlask size={20} aria-hidden="true" />
        <h2>{labels.latest}</h2>
        <strong>{latestReport.value}</strong>
        <p title={latestReport.sub}>{latestReport.sub}</p>
      </button>

      <button
        type="button"
        className="household-stat-card"
        onClick={() => {
          if (care.hasActiveMeds) {
            scrollToAnchor("pet-medications-anchor");
          } else {
            quickAdd?.navigateTo(1);
          }
        }}
      >
        <CareIcon size={20} aria-hidden="true" />
        <h2>{labels.care}</h2>
        <strong>{care.value}</strong>
        <p title={care.sub}>{care.sub}</p>
      </button>
    </div>
  );
}

export function SummaryEmptyCta({
  kind,
  petId,
  locale,
}: {
  kind: "history" | "report";
  petId: string;
  locale: "pl" | "en";
}) {
  const pl = locale === "pl";
  const quickAdd = usePetQuickAddOptional();

  if (kind === "report") {
    return (
      <div className="household-empty-cta">
        <ButtonLink size="sm" variant="secondary" href={`/app/pets/${petId}/results/new`}>
          <IconPlus size={15} aria-hidden="true" />
          {pl ? "Dodaj pierwsze badanie" : "Add first report"}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="household-empty-cta">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => quickAdd?.openAction("history_manual")}
      >
        <IconPlus size={15} aria-hidden="true" />
        {pl ? "Dodaj wizytę lub szczepienie" : "Add visit or vaccination"}
      </Button>
      <Link className="household-summary-link" href={`/app/pets/${petId}?tab=history`}>
        {pl ? "Otwórz Historię →" : "Open History →"}
      </Link>
    </div>
  );
}
