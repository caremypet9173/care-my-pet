"use client";

import { useLocale } from "next-intl";
import { Container } from "@/components/layout/container";
import "@/styles/pets.css";

export default function AppLoading() {
  const locale = useLocale();
  const pl = locale === "pl";

  return (
    <Container
      className="pets-page"
      aria-busy="true"
      aria-label={pl ? "Wczytywanie pulpitu pupili..." : "Loading pet dashboard..."}
    >
      <div style={{ marginBottom: "1.25rem" }}>
        <div className="skeleton-badge">
          <span className="skeleton-spinner" aria-hidden="true" />
          <span>{pl ? "Wczytywanie pulpitu opieki…" : "Loading care dashboard…"}</span>
        </div>
      </div>

      <div className="pets-heading" style={{ marginBottom: "2rem" }}>
        <div>
          <div
            className="skeleton-bone"
            style={{ width: "8rem", height: "0.875rem", marginBottom: "0.625rem", borderRadius: "9999px" }}
          />
          <div
            className="skeleton-bone"
            style={{ width: "18rem", maxWidth: "80%", height: "2.25rem", marginBottom: "0.625rem" }}
          />
          <div
            className="skeleton-bone"
            style={{ width: "26rem", maxWidth: "95%", height: "1rem" }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div
            className="skeleton-bone"
            style={{ width: "7.5rem", height: "2.25rem", borderRadius: "var(--radius-control)" }}
          />
          <div
            className="skeleton-bone"
            style={{ width: "7.5rem", height: "2.25rem", borderRadius: "var(--radius-control)" }}
          />
        </div>
      </div>

      <div className="pets-grid" style={{ marginBottom: "2rem" }}>
        {[1, 2, 3].map((cardId) => (
          <div
            key={cardId}
            className="pet-card skeleton-card"
            style={{ minHeight: "16rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                className="skeleton-bone"
                style={{ width: "3.5rem", height: "3.5rem", borderRadius: "9999px", flexShrink: 0 }}
              />
              <div style={{ flex: 1, display: "grid", gap: "0.5rem" }}>
                <div className="skeleton-bone" style={{ width: "65%", height: "1.25rem" }} />
                <div
                  className="skeleton-bone"
                  style={{ width: "40%", height: "0.875rem", borderRadius: "9999px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.5rem", flex: 1 }}>
              <div className="skeleton-bone" style={{ width: "85%", height: "0.875rem" }} />
              <div className="skeleton-bone" style={{ width: "60%", height: "0.875rem" }} />
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <div
                className="skeleton-bone"
                style={{ width: "5rem", height: "1.5rem", borderRadius: "9999px" }}
              />
              <div
                className="skeleton-bone"
                style={{ width: "4rem", height: "1.5rem", borderRadius: "9999px" }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pet-panel skeleton-card" style={{ padding: "2rem", display: "grid", gap: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="skeleton-bone" style={{ width: "12rem", height: "1.5rem" }} />
          <div
            className="skeleton-bone"
            style={{ width: "6rem", height: "2rem", borderRadius: "var(--radius-control)" }}
          />
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div
            className="skeleton-bone"
            style={{ width: "100%", height: "3.5rem", borderRadius: "var(--radius-control)" }}
          />
          <div
            className="skeleton-bone"
            style={{ width: "100%", height: "3.5rem", borderRadius: "var(--radius-control)" }}
          />
          <div
            className="skeleton-bone"
            style={{ width: "100%", height: "3.5rem", borderRadius: "var(--radius-control)" }}
          />
        </div>
      </div>
    </Container>
  );
}
