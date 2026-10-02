import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconFileTypePdf, IconEye } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useFormatters } from "@/lib/formatters";
import type { PetDocument } from "./types";
export function DocumentRow({
  document,
  compact = false,
}: {
  document: PetDocument;
  compact?: boolean;
}) {
  const t = useTranslations("copy");
  const { formatDate } = useFormatters();
  return (
    <div className={`document-row ${compact ? "document-row--compact" : ""}`}>
      <span className="document-icon">
        <IconFileTypePdf size={24} aria-hidden="true" />
      </span>
      <div className="document-row-copy">
        <h3>{document.title}</h3>
        <p>
          {formatDate(document.date)}
          {!compact ? ` · ${document.source}` : ""}
        </p>
        {!compact ? <Badge>{document.label}</Badge> : null}
      </div>
      <Link
        className="document-preview-link"
        href={`/demo/luna/dokumenty?plik=${document.id}`}
        scroll={false}
        aria-label={t("previewDocument", { title: document.title })}
      >
        <IconEye size={17} aria-hidden="true" />
        <span>{t("preview")}</span>
      </Link>
    </div>
  );
}
