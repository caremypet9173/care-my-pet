"use client";

import { useLocale } from "next-intl";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { IconArrowLeft, IconPaw, IconUsers } from "@tabler/icons-react";
import "@/styles/pets.css";

export default function PrivateNotFound() {
  const locale = useLocale();
  const pl = locale === "pl";

  return (
    <Container className="pets-page">
      <div
        className="pet-panel"
        style={{
          maxWidth: "38rem",
          margin: "3rem auto",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          padding: "3rem 1.5rem",
        }}
      >
        <div
          style={{
            width: "4.5rem",
            height: "4.5rem",
            borderRadius: "1.25rem",
            display: "grid",
            placeItems: "center",
            backgroundColor: "var(--color-surface-sand)",
            border: "1px solid var(--color-border)",
            color: "var(--color-primary)",
          }}
          aria-hidden="true"
        >
          <IconPaw size={36} />
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(1.35rem, 2.5vw, 1.75rem)" }}>
            {pl
              ? "Nie znaleziono profilu pupila"
              : "Pet profile not found"}
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
              fontSize: "0.9375rem",
            }}
          >
            {pl
              ? "Szukana kartoteka mogła zostać usunięta, przeniesiona lub nie masz do niej uprawnień w ramach aktywnego gospodarstwa."
              : "The pet record you are looking for may have been deleted, moved, or is not accessible within your active household."}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: "0.5rem",
          }}
        >
          <ButtonLink
            variant="primary"
            href="/app"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <IconArrowLeft size={18} aria-hidden="true" />
            <span>{pl ? "Wróć do listy pupili" : "Back to pet list"}</span>
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            href="/app/gospodarstwo"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <IconUsers size={18} aria-hidden="true" />
            <span>{pl ? "Zarządzaj gospodarstwem" : "Manage household"}</span>
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
