"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Badge } from "@/components/ui/badge";
import { LabResults } from "@/features/lab-results/lab-results";
import { useFormatters } from "@/lib/formatters";
import type { LabReport } from "@/features/lab-results/types";
import type { PetDocument } from "./types";

export function DocumentDialog({
  document,
  documents,
  report,
}: {
  document?: PetDocument;
  documents: readonly PetDocument[];
  report: LabReport;
}) {
  const t = useTranslations("copy");
  const { formatDate } = useFormatters();
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const isOpen = !!document;
  useEffect(() => {
    const element = dialog.current;
    if (!element || !isOpen) return;
    previousFocus.current =
      window.document.activeElement instanceof HTMLElement
        ? window.document.activeElement
        : null;
    element.showModal();
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      element.close();
      window.document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [isOpen]);
  const close = () => router.replace("/demo/luna/dokumenty", { scroll: false });
  const index = document
    ? documents.findIndex((item) => item.id === document.id)
    : -1;
  return (
    <dialog
      ref={dialog}
      className="document-dialog"
      aria-labelledby="document-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      {document ? (
        <>
          <header className="document-dialog-toolbar">
            <div>
              <Badge>{t("sampleDocument")}</Badge>
              <h2 id="document-dialog-title">{document.title}</h2>
            </div>
            <Button
              variant="ghost"
              onClick={close}
              aria-label={t("closePreview")}
            >
              <IconX size={22} aria-hidden="true" />
            </Button>
          </header>
          <div className="document-dialog-body">
            <article className="document-paper">
              <div className="document-paper-heading">
                <strong>{t("careMyPetDemoDocument")}</strong>
                <span>{t("fictionalData")}</span>
              </div>
              <h3>{document.title}</h3>
              <dl className="document-patient">
                <div>
                  <dt>{t("patient")}</dt>
                  <dd>{t("lunaEuropeanShorthairCat")}</dd>
                </div>
                <div>
                  <dt>{t("date")}</dt>
                  <dd>{formatDate(document.date)}</dd>
                </div>
                <div>
                  <dt>{t("owner")}</dt>
                  <dd>{t("sampleOwner")}</dd>
                </div>
                <div>
                  <dt>{t("source")}</dt>
                  <dd>{document.source}</dd>
                </div>
              </dl>
              {document.category === "lab" ? (
                <LabResults report={report} />
              ) : null}
              <div className="document-paragraphs">
                {document.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <p className="document-watermark">
                {t("demoMaterialThisIsNotAReal")}
              </p>
            </article>
            <aside className="document-metadata">
              <LanguageSwitch />
              <p className="caption">{t("demoDocumentLanguage")}</p>
              <h3>{t("documentInformation")}</h3>
              <dl>
                <div>
                  <dt>{t("dateIssued")}</dt>
                  <dd>{formatDate(document.date)}</dd>
                </div>
                <div>
                  <dt>{t("category")}</dt>
                  <dd>{document.label}</dd>
                </div>
                <div>
                  <dt>{t("source")}</dt>
                  <dd>{document.source}</dd>
                </div>
                <div>
                  <dt>{t("previewType")}</dt>
                  <dd>{t("examplePreparedForTheDemo")}</dd>
                </div>
              </dl>
              {document.relatedEventId ? (
                <Link
                  className="text-link"
                  href={`/demo/luna/historia#${document.relatedEventId}`}
                >
                  {t("goToTheHistoryEntry")}
                </Link>
              ) : null}
              <p className="caption">
                {t("allValuesComeFromTheSameFictional")}
              </p>
            </aside>
          </div>
          <footer className="document-dialog-footer">
            {index > 0 ? (
              <Link
                href={`/demo/luna/dokumenty?plik=${documents[index - 1].id}`}
                scroll={false}
              >
                <IconChevronLeft size={18} aria-hidden="true" />
                {t("previousDocument")}
              </Link>
            ) : (
              <span />
            )}
            <span aria-live="polite">
              {t("document")} {index + 1} {t("of")} {documents.length}
            </span>
            {index < documents.length - 1 ? (
              <Link
                href={`/demo/luna/dokumenty?plik=${documents[index + 1].id}`}
                scroll={false}
              >
                {t("nextDocument")}
                <IconChevronRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
