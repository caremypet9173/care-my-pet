"use client";

import { useLocale } from "next-intl";
import { Container } from "@/components/layout/container";
import "@/styles/pets.css";
import "@/styles/medical.css";
import "@/styles/medical-profile.css";

export default function PetLoading() {
  const locale = useLocale();
  const pl = locale === "pl";

  return (
    <Container
      className="pets-page household-record"
      aria-busy="true"
      aria-label={pl ? "Wczytywanie profilu pupila..." : "Loading pet profile..."}
    >
      <div
        className="household-record-toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div className="skeleton-badge">
          <span className="skeleton-spinner" aria-hidden="true" />
          <span>{pl ? "Wczytywanie kartoteki pupila…" : "Loading pet record…"}</span>
        </div>
        <div className="skeleton-status-text">
          <small>
            {pl
              ? "Pobieranie historii, wyników badań i terminarza…"
              : "Fetching history, lab results, and schedule…"}
          </small>
        </div>
      </div>

      <section
        className="household-cover"
        style={{
          minHeight: "13.5rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div className="household-cover-top">
          <div
            className="skeleton-bone"
            style={{ width: "5rem", height: "1.5rem", borderRadius: "9999px" }}
          />
        </div>

        <div className="household-profile-glass">
          <div
            className="household-profile-identity"
            style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}
          >
            <div className="household-portrait">
              <div
                className="skeleton-bone"
                style={{ width: "4rem", height: "4rem", borderRadius: "9999px" }}
              />
            </div>
            <div
              className="household-profile-details"
              style={{ display: "grid", gap: "0.5rem", minWidth: "12rem" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="skeleton-bone" style={{ width: "10rem", height: "1.75rem" }} />
                <div
                  className="skeleton-bone"
                  style={{ width: "4rem", height: "1.25rem", borderRadius: "9999px" }}
                />
              </div>
              <div className="skeleton-bone" style={{ width: "12rem", height: "1rem" }} />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                <div
                  className="skeleton-bone"
                  style={{ width: "6rem", height: "1.25rem", borderRadius: "9999px" }}
                />
                <div
                  className="skeleton-bone"
                  style={{ width: "7rem", height: "1.25rem", borderRadius: "9999px" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="household-record-stats" style={{ marginTop: "1.5rem" }}>
        {[1, 2, 3, 4].map((statId) => (
          <section key={statId} style={{ display: "grid", gap: "0.5rem" }}>
            <div className="skeleton-bone" style={{ width: "50%", height: "0.75rem" }} />
            <div className="skeleton-bone" style={{ width: "75%", height: "1.5rem" }} />
            <div className="skeleton-bone" style={{ width: "85%", height: "0.75rem" }} />
          </section>
        ))}
      </div>

      <div
        className="household-record-tabs"
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBlock: "1.5rem 1rem",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "0.5rem",
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((tabId) => (
          <div
            key={tabId}
            className="skeleton-bone"
            style={{ width: "5.5rem", height: "2rem", borderRadius: "var(--radius-control)" }}
          />
        ))}
      </div>

      <div
        className="pet-panel skeleton-card"
        style={{ minHeight: "18rem", display: "grid", gap: "1rem", padding: "1.5rem" }}
      >
        <div className="skeleton-bone" style={{ width: "35%", height: "1.5rem" }} />
        <div
          className="skeleton-bone"
          style={{ width: "100%", height: "4rem", borderRadius: "var(--radius-control)" }}
        />
        <div
          className="skeleton-bone"
          style={{ width: "100%", height: "4rem", borderRadius: "var(--radius-control)" }}
        />
      </div>
    </Container>
  );
}
