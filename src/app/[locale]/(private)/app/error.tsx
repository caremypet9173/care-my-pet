"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { Container } from "@/components/layout/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { IconAlertTriangle, IconRefresh, IconArrowLeft } from "@tabler/icons-react";
import "@/styles/pets.css";

export default function PrivateAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const pl = locale === "pl";

  useEffect(() => {
    console.error("CareMyPet Private Section Error:", error);
  }, [error]);

  return (
    <Container className="pets-page">
      <div
        className="pet-panel"
        style={{
          maxWidth: "40rem",
          margin: "2rem auto",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          padding: "2.5rem 1.5rem",
        }}
      >
        <div
          style={{
            width: "4.5rem",
            height: "4.5rem",
            borderRadius: "1.25rem",
            display: "grid",
            placeItems: "center",
            backgroundColor: "var(--color-danger-surface)",
            border: "1px solid var(--color-danger-border)",
            color: "var(--color-danger)",
          }}
          aria-hidden="true"
        >
          <IconAlertTriangle size={36} />
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(1.35rem, 2.5vw, 1.75rem)" }}>
            {pl
              ? "Nie udało się wczytać danych kartoteki"
              : "Failed to load pet record data"}
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
              ? "Wystąpił problem z połączeniem lub pobraniem informacji o Twoich pupilach. Twoje dane są bezpieczne na serwerze. Spróbuj odświeżyć dane lub wróć do listy pupili."
              : "There was a problem loading information about your pets. Your data is safe. Try refreshing the view or return to the pet list."}
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                opacity: 0.7,
              }}
            >
              {pl ? "Kod błędu: " : "Error code: "}
              <code>{error.digest}</code>
            </p>
          )}
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
          <Button
            variant="primary"
            onClick={() => reset()}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <IconRefresh size={18} aria-hidden="true" />
            <span>{pl ? "Spróbuj ponownie" : "Try again"}</span>
          </Button>
          <ButtonLink
            variant="secondary"
            href="/app"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <IconArrowLeft size={18} aria-hidden="true" />
            <span>{pl ? "Wróć do pupili" : "Back to pets"}</span>
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
