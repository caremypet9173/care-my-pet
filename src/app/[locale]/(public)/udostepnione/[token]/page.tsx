import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { IconAlertTriangle, IconBan, IconClock } from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { fetchSharedPetRecord } from "@/features/share/data";
import { SharedVetRecordView } from "@/features/share/shared-vet-record-view";
import "@/styles/pets.css";
import "@/styles/medical.css";
import "@/styles/medical-profile.css";

export const dynamic = "force-dynamic";

export default async function SharedRecordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const pl = locale === "pl";
  const reqHeaders = await headers();
  const userAgent = reqHeaders.get("user-agent") ?? "";

  const result = await fetchSharedPetRecord(token, userAgent);

  if (result.status !== "ok") {
    const icon =
      result.status === "expired"
        ? IconClock
        : result.status === "revoked"
          ? IconBan
          : IconAlertTriangle;
    const StatusIcon = icon;

    const title =
      result.status === "expired"
        ? pl
          ? "Link do kartoteki wygasł"
          : "Record share link has expired"
        : result.status === "revoked"
          ? pl
            ? "Link do kartoteki został unieważniony"
            : "Record share link was revoked"
          : pl
            ? "Nie znaleziono udostępnionej kartoteki"
            : "Shared record not found";

    const description =
      result.status === "expired"
        ? pl
          ? "Czas ważności tego udostępnienia dobiegł końca. Poproś właściciela zwierzaka o wygenerowanie nowego linku lub kodu QR."
          : "The validity period for this shared record has ended. Please ask the pet owner to generate a new link or QR code."
        : result.status === "revoked"
          ? pl
            ? "Właściciel zwierzaka zakończył udostępnianie tej kartoteki."
            : "The pet owner has revoked access to this medical record."
          : pl
            ? "Sprawdź, czy adres linku jest kompletny, lub poproś właściciela o nowy kod QR."
            : "Please check that the link URL is complete or ask the owner for a new QR code.";

    return (
      <Container className="pets-page shared-unavailable-wrap">
        <section className="pet-panel shared-unavailable-card">
          <span className="shared-unavailable-icon" aria-hidden="true">
            <StatusIcon size={28} />
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>
      </Container>
    );
  }

  return (
    <Container className="pets-page household-record">
      <SharedVetRecordView token={token} payload={result.data} />
    </Container>
  );
}
