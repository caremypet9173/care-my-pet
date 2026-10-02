"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { IconArrowRight, IconInfoCircle } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabResults } from "@/features/lab-results/lab-results";
import { useFormatters } from "@/lib/formatters";
import { WeightChart } from "./weight-chart";
import type { PetProfile } from "./types";

const tabs = ["history", "results"] as const;
type Tab = (typeof tabs)[number];

export function PetRecordPreview({
  pet,
  initialTab = "history",
}: {
  pet: PetProfile;
  initialTab?: Tab;
}) {
  const t = useTranslations("copy");
  const { formatDate, formatNumber } = useFormatters();
  const [active, setActive] = useState<Tab>(initialTab);
  const id = useId();
  const outsideRangeCount = pet.report.results.filter(
    (result) => result.status === "above" || result.status === "below",
  ).length;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectTab = (index: number) => {
    setActive(tabs[index]);
    refs.current[index]?.focus();
  };
  return (
    <Card className="pet-record" padding="lg">
      <div className="pet-record-header">
        <div className="pet-identity">
          <Image
            src={pet.image}
            width={56}
            height={56}
            alt={t("petPortrait", { name: pet.name })}
            className="pet-avatar"
          />
          <div>
            <div className="pet-name">
              <h3>{pet.name}</h3>
              <Badge>{formatNumber(pet.weightKg)} kg</Badge>
            </div>
            <p>{pet.description}</p>
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label={t("samplePetRecord")}>
          {tabs.map((tab, index) => (
            <button
              key={tab}
              ref={(node) => {
                refs.current[index] = node;
              }}
              id={`${id}-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={active === tab}
              aria-controls={`${id}-panel-${tab}`}
              tabIndex={active === tab ? 0 : -1}
              onClick={() => setActive(tab)}
              onKeyDown={(event) => {
                const target =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : null;
                if (target !== null) {
                  event.preventDefault();
                  selectTab(target);
                }
              }}
            >
              {tab === "history" ? pet.historyLabel : t("testResults")}
            </button>
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-history`}
        aria-labelledby={`${id}-tab-history`}
        hidden={active !== "history"}
        tabIndex={0}
      >
        <div className="history-grid">
          <Card padding="sm">
            <div className="mini-meta">
              <span>{pet.appointment.title}</span>
              <span className="accent-text">
                {formatDate(pet.appointment.previousDate)}
              </span>
            </div>
            <h4>{pet.appointment.summary}</h4>
            <Badge tone="accent" dot>
              {t("next")} {formatDate(pet.appointment.date)}
            </Badge>
            <p>{pet.appointment.note}</p>
          </Card>
          <Card padding="sm">
            <div className="mini-meta">
              <span>{t("bloodTests")}</span>
              <Badge tone={outsideRangeCount ? "warning" : "neutral"}>
                {outsideRangeCount
                  ? t("outsideRangeCount", { count: outsideRangeCount })
                  : t("viewRanges")}
              </Badge>
            </div>
            <h4>{pet.report.title}</h4>
            <p>
              {t("numberOfParameters")} {pet.report.results.length}
              {t("valuesAndRangesFromTheDocumentIn")}
            </p>
            <Button size="sm" onClick={() => selectTab(1)}>
              {t("viewResults")} <IconArrowRight size={16} aria-hidden="true" />
            </Button>
          </Card>
          <Card padding="sm">
            <div className="mini-meta">
              <span>
                {t("weight")} {formatNumber(pet.weightKg)} kg
              </span>
              <Badge tone="neutral">{pet.weightStatus}</Badge>
            </div>
            <h4>{t("bodyWeightTrend")}</h4>
            <WeightChart measurements={pet.weights} />
          </Card>
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-results`}
        aria-labelledby={`${id}-tab-results`}
        hidden={active !== "results"}
        tabIndex={0}
      >
        <LabResults report={pet.report} />
      </div>
      <div className="pet-record-footer">
        <IconInfoCircle size={18} aria-hidden="true" />
        <p>{t("youCanCheckAndCorrectTheExtracted")}</p>
      </div>
    </Card>
  );
}
