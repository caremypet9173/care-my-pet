"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  IconCheck,
  IconHistory,
  IconLoader2,
  IconFileText,
} from "@tabler/icons-react";

interface DischargePdfPageViewerProps {
  file: File;
  totalPages: number;
  selectedPages: number[];
  importedPages?: number[];
  onTogglePage?: (pageNumber: number) => void;
  activeScrollToPage?: number | null;
  readOnly?: boolean;
}

interface PageItemProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  totalPages: number;
  isSelected: boolean;
  isImported: boolean;
  readOnly?: boolean;
  onToggle?: (pageNumber: number) => void;
  pl: boolean;
}

function PageCard({
  doc,
  pageNumber,
  totalPages,
  isSelected,
  isImported,
  readOnly = false,
  onToggle,
  pl,
}: PageItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Pierwsze 2 strony renderujemy natychmiast, reszta leniwie podczas przewijania
  const [hasEnteredView, setHasEnteredView] = useState(pageNumber <= 2);
  const [rendered, setRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);

  // Lazy loading stron za pomocą IntersectionObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasEnteredView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasEnteredView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasEnteredView]);

  // Renderowanie canvasu po wejściu w obszar widoku
  useEffect(() => {
    if (!hasEnteredView || !doc || !canvasRef.current || rendered) return;

    let active = true;
    let renderTask: RenderTask | undefined;

    doc
      .getPage(pageNumber)
      .then(async (page) => {
        if (!active || !canvasRef.current) return;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current?.clientWidth || 480;
        const targetWidth = Math.max(480, containerWidth);
        const dpr = Math.min(
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          2,
        );
        const baseScale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale: baseScale * dpr });

        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        renderTask = page.render({
          canvas,
          viewport,
        });
        await renderTask.promise;
        if (active) setRendered(true);
      })
      .catch((err) => {
        if (active && err?.name !== "RenderingCancelledException") {
          console.warn(`Error rendering page ${pageNumber}`, err);
          setRenderError(true);
        }
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [hasEnteredView, doc, pageNumber, rendered]);

  return (
    <div
      ref={containerRef}
      id={`discharge-page-card-${pageNumber}`}
      className={`discharge-pv-page-card${isSelected ? " is-selected" : ""}${
        isImported ? " is-imported" : ""
      }${readOnly ? " is-readonly" : ""}`}
      onClick={readOnly ? undefined : () => onToggle?.(pageNumber)}
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={
        readOnly
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle?.(pageNumber);
              }
            }
      }
      aria-label={
        pl
          ? `Strona ${pageNumber} z ${totalPages}${
              readOnly
                ? isImported
                  ? ", zaimportowana"
                  : ""
                : isSelected
                  ? ", zaznaczona"
                  : ", niezaznaczona"
            }`
          : `Page ${pageNumber} of ${totalPages}${
              readOnly
                ? isImported
                  ? ", imported"
                  : ""
                : isSelected
                  ? ", selected"
                  : ", not selected"
            }`
      }
    >
      <div className="discharge-pv-card-header">
        {readOnly ? (
          <div className="discharge-pv-card-title-wrap">
            <span className="discharge-pv-card-title">
              {pl ? "Strona" : "Page"} <strong>{pageNumber}</strong>{" "}
              <span className="discharge-pv-card-total">/ {totalPages}</span>
            </span>
          </div>
        ) : (
          <label
            className="discharge-pv-card-toggle"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle?.(pageNumber)}
              aria-label={pl ? `Zaznacz stronę ${pageNumber}` : `Select page ${pageNumber}`}
            />
            <span className="discharge-pv-card-title">
              {pl ? "Strona" : "Page"} <strong>{pageNumber}</strong>{" "}
              <span className="discharge-pv-card-total">/ {totalPages}</span>
            </span>
          </label>
        )}

        <div className="discharge-pv-card-badges">
          {isSelected && (
            <span className="discharge-pv-badge is-selected">
              <IconCheck size={13} aria-hidden="true" />
              <span>{pl ? "Wybrana" : "Selected"}</span>
            </span>
          )}
          {isImported && !isSelected && (
            <span className="discharge-pv-badge is-imported">
              <IconHistory size={13} aria-hidden="true" />
              <span>{pl ? "Zaimportowana" : "Imported"}</span>
            </span>
          )}
          {!readOnly && !isSelected && !isImported && (
            <span className="discharge-pv-badge is-unselected">
              <span>{pl ? "Kliknij, aby zaznaczyć" : "Click to select"}</span>
            </span>
          )}
        </div>
      </div>

      <div className="discharge-pv-card-body">
        <canvas
          ref={canvasRef}
          className={`discharge-pv-canvas${rendered ? " is-ready" : ""}`}
        />
        {!rendered && !renderError && (
          <div className="discharge-pv-card-skeleton">
            <IconLoader2 size={24} className="animate-spin text-gray-400" />
            <span>
              {pl ? `Wczytywanie strony ${pageNumber}...` : `Loading page ${pageNumber}...`}
            </span>
          </div>
        )}
        {renderError && (
          <div className="discharge-pv-card-skeleton is-error">
            <span>
              {pl
                ? `Nie udało się wyrenderować podglądu strony ${pageNumber}.`
                : `Failed to render preview of page ${pageNumber}.`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DischargePdfPageViewer({
  file,
  totalPages,
  selectedPages,
  importedPages = [],
  onTogglePage,
  activeScrollToPage,
  readOnly = false,
}: DischargePdfPageViewerProps) {
  const pl = useLocale() !== "en";
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [docPages, setDocPages] = useState<number>(totalPages);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Załaduj dokument z obiektu File (jako blob URL)
  useEffect(() => {
    let active = true;
    let destroy: (() => void) | undefined;
    const blobUrl = URL.createObjectURL(file);

    import("pdfjs-dist")
      .then((pdf) => {
        if (!active) return;
        pdf.GlobalWorkerOptions.workerSrc = `/pdf-worker/${pdf.version}/pdf.worker.min.mjs`;
        const task = pdf.getDocument({
          url: blobUrl,
          useSystemFonts: true,
          disableAutoFetch: true,
          disableStream: true,
        });
        destroy = () => {
          void task.destroy();
        };
        return task.promise.then((loadedDoc) => {
          if (!active) return;
          setDoc(loadedDoc);
          setDocPages(loadedDoc.numPages);
          setLoading(false);
        });
      })
      .catch((err) => {
        console.error("[DischargePdfPageViewer] load error:", err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      destroy?.();
      URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  // Obsługa przewijania do konkretnej strony wywołanej z listy guzików po prawej stronie
  useEffect(() => {
    if (!activeScrollToPage || !containerRef.current) return;
    const target = containerRef.current.querySelector(
      `#discharge-page-card-${activeScrollToPage}`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeScrollToPage]);

  const count = docPages || totalPages;
  const pageList = Array.from({ length: count }, (_, i) => i + 1);
  const importedSet = new Set(importedPages);
  const selectedSet = new Set(selectedPages);

  return (
    <div className="discharge-pv-container">
      <div className="discharge-pv-header">
        <div className="discharge-pv-header-info">
          <IconFileText size={16} className="text-gray-500" />
          <span className="discharge-pv-counter">
            {pl
              ? `Podgląd dokumentu (${count} ${count === 1 ? "strona" : "stron"})`
              : `Document preview (${count} ${count === 1 ? "page" : "pages"})`}
          </span>
        </div>
        <span className="discharge-pv-subhint">
          {readOnly
            ? pl
              ? "Przeglądaj zawartość dokumentu"
              : "Browse document contents"
            : pl
              ? "Przewijaj w dół i zaznaczaj strony"
              : "Scroll down and select pages"}
        </span>
      </div>

      <div className="discharge-pv-scroll-container" ref={containerRef}>
        {loading && (
          <div className="discharge-pv-loading">
            <IconLoader2 size={24} className="animate-spin text-primary" />
            <p>
              {pl
                ? "Przygotowywanie podglądu stron dokumentu..."
                : "Preparing document page previews..."}
            </p>
          </div>
        )}

        {error && (
          <div className="discharge-pv-error">
            {pl
              ? "Nie udało się wczytać podglądu stron PDF. Możesz kontynuować wybierając numery stron po prawej stronie."
              : "Could not load PDF page previews. You can continue by selecting page numbers on the right."}
          </div>
        )}

        {!loading &&
          !error &&
          doc &&
          pageList.map((pageNum) => (
            <PageCard
              key={pageNum}
              doc={doc}
              pageNumber={pageNum}
              totalPages={count}
              isSelected={selectedSet.has(pageNum)}
              isImported={importedSet.has(pageNum)}
              readOnly={readOnly}
              onToggle={onTogglePage}
              pl={pl}
            />
          ))}
      </div>
    </div>
  );
}
