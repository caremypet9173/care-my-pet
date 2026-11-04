"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Button, ButtonLink } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { IconAlertTriangle, IconRefresh, IconHome } from "@tabler/icons-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const pl = locale === "pl";

  useEffect(() => {
    console.error("CareMyPet Application Error:", error);
  }, [error]);

  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container width="prose">
            <div
              className="page-heading"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "1.25rem",
                paddingBlock: "2rem",
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
                <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
                  {pl
                    ? "Wystąpił nieoczekiwany problem"
                    : "An unexpected error occurred"}
                </h1>
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {pl
                    ? "Przepraszamy, coś poszło nie tak podczas wczytywania strony. Twoje dane są bezpieczne. Spróbuj odświeżyć widok lub wróć na stronę główną."
                    : "We're sorry, something went wrong while loading this page. Your data is safe. Try refreshing the view or return home."}
                </p>
                {error.digest && (
                  <p
                    style={{
                      margin: 0,
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
                  href="/"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <IconHome size={18} aria-hidden="true" />
                  <span>{pl ? "Strona główna" : "Home page"}</span>
                </ButtonLink>
              </div>
            </div>
          </Container>
        </Section>
      </main>
      <PublicFooter />
    </>
  );
}
