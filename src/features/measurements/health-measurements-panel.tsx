"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  IconScale,
  IconHeartRateMonitor,
  IconDroplet,
  IconTemperature,
  IconInfoCircle,
} from "@tabler/icons-react";
import { WeightView } from "./weight-view";
import { BloodPressureView } from "./blood-pressure-view";
import { GlucoseView } from "./glucose-view";
import { TemperatureView } from "./temperature-view";
import { MeasurementTips } from "./measurement-tips";
import type { WeightMeasurement } from "@/features/weight/types";
import type { MetricType, VitalMeasurement } from "./types";
import "@/styles/weight.css";
import "@/styles/measurements.css";

export function HealthMeasurementsPanel({
  petId,
  petName,
  weights,
  vitalMeasurements = [],
  initialMetric = "weight",
}: {
  petId: string;
  petName: string;
  weights: WeightMeasurement[];
  vitalMeasurements?: VitalMeasurement[];
  initialMetric?: MetricType;
}) {
  const pl = useLocale() === "pl";
  const [activeType, setActiveType] = useState<MetricType>(initialMetric);

  const bpRows = vitalMeasurements.filter((m) => m.metric_type === "blood_pressure");
  const glucoseRows = vitalMeasurements.filter((m) => m.metric_type === "glucose");
  const tempRows = vitalMeasurements.filter((m) => m.metric_type === "temperature");

  const subTabs = [
    {
      id: "weight" as const,
      label: pl ? "Masa ciała" : "Weight",
      icon: IconScale,
      count: weights.length,
    },
    {
      id: "blood_pressure" as const,
      label: pl ? "Ciśnienie krwi" : "Blood pressure",
      icon: IconHeartRateMonitor,
      count: bpRows.length,
    },
    {
      id: "glucose" as const,
      label: pl ? "Glukoza" : "Glucose",
      icon: IconDroplet,
      count: glucoseRows.length,
    },
    {
      id: "temperature" as const,
      label: pl ? "Temperatura" : "Temperature",
      icon: IconTemperature,
      count: tempRows.length,
    },
  ];

  return (
    <div>
      {/* Sub-nawigacja między pomiarami */}
      <nav
        className="measurements-subtabs"
        role="tablist"
        aria-label={pl ? "Kategorie pomiarów zdrowia" : "Health measurement categories"}
      >
        {subTabs.map(({ id, label, icon: Icon, count }) => {
          const isActive = activeType === id;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={isActive}
              className={`measurements-subtab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveType(id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {count > 0 && (
                <span className="measurements-subtab-badge" aria-label={`${count} ${pl ? "pomiarów" : "records"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="weight-layout">
        <div className="weight-main">
          {activeType === "weight" && (
            <WeightView
              petId={petId}
              petName={petName}
              measurements={weights}
            />
          )}

          {activeType === "blood_pressure" && (
            <BloodPressureView
              petId={petId}
              petName={petName}
              initialRows={bpRows}
            />
          )}

          {activeType === "glucose" && (
            <GlucoseView
              petId={petId}
              petName={petName}
              initialRows={glucoseRows}
            />
          )}

          {activeType === "temperature" && (
            <TemperatureView
              petId={petId}
              petName={petName}
              initialRows={tempRows}
            />
          )}
        </div>

        <aside className="weight-aside">
          <MeasurementTips activeType={activeType} />
          <div className="weight-info">
            <IconInfoCircle size={18} />
            <p>
              {pl
                ? "Pomiary i notatki są bezpiecznie synchronizowane i dostępne dla wszystkich domowników opiekujących się pupilem."
                : "Measurements and clinical notes are synced and accessible to all pet guardians in the household."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Alias dla kompatybilności wstecznej
export const WeightPanel = HealthMeasurementsPanel;
