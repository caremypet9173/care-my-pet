"use client";

import dynamic from "next/dynamic";

function TabPanelLoading() {
  return (
    <div
      className="pet-panel skeleton-card"
      role="status"
      aria-busy="true"
      style={{
        minHeight: "14rem",
        display: "grid",
        gap: "0.875rem",
        padding: "1.5rem",
      }}
    >
      <div
        className="skeleton-bone"
        style={{ width: "32%", height: "1.35rem" }}
      />
      <div
        className="skeleton-bone"
        style={{
          width: "100%",
          height: "3.5rem",
          borderRadius: "var(--radius-control)",
        }}
      />
      <div
        className="skeleton-bone"
        style={{
          width: "100%",
          height: "3.5rem",
          borderRadius: "var(--radius-control)",
        }}
      />
    </div>
  );
}

export const LazyHistoryPanel = dynamic(
  () => import("@/features/history/history-panel").then((m) => m.HistoryPanel),
  { ssr: false, loading: TabPanelLoading },
);

export const LazyHealthMeasurementsPanel = dynamic(
  () =>
    import("@/features/measurements/health-measurements-panel").then(
      (m) => m.HealthMeasurementsPanel,
    ),
  { ssr: false, loading: TabPanelLoading },
);

export const LazyMedicalResults = dynamic(
  () => import("@/features/medical/results").then((m) => m.MedicalResults),
  { ssr: false, loading: TabPanelLoading },
);

export const LazyMedicalDocuments = dynamic(
  () => import("@/features/medical/documents").then((m) => m.MedicalDocuments),
  { ssr: false, loading: TabPanelLoading },
);

export const LazyAssistantPanel = dynamic(
  () =>
    import("@/features/assistant/assistant-panel").then(
      (m) => m.AssistantPanel,
    ),
  { ssr: false, loading: TabPanelLoading },
);
