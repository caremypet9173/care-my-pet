"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconFlag,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface DischargePdfPageViewerProps {
  file: File;
  activePage: number;
  onPageChange: (page: number) => void;
  selectedStart: number;
  selectedEnd: number;
  onSetStart: (page: number) => void;
  onSetEnd: (page: number) => void;
}

export function DischargePdfPageViewer({
  file,
  activePage,
  onPageChange,
  selectedStart,
  selectedEnd,
  onSetStart,
  onSetEnd,
}: DischargePdfPageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
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
          setTotalPages(loadedDoc.numPages);
          setLoading(false);
        });
      })
      .catch(() => {
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

  // Renderowanie aktualnej strony na canvasie
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let active = true;
    let renderTask: RenderTask | undefined;

    doc
      .getPage(activePage)
      .then(async (page) => {
        if (!active || !canvasRef.current) return;
        const unscaledViewport = page.getViewport({ scale: 1 });
        // Dopasowanie do szerokości kontenera podglądu (ok. 450-520px)
        const targetWidth = 460;
        const scale = Math.min(1.5, targetWidth / unscaledViewport.width);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvas,
          viewport,
        });
        await renderTask.promise;
      })
      .catch((err) => {
        if (active && err?.name !== "RenderingCancelledException") {
          console.warn("PDF render error", err);
        }
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [doc, activePage]);

  const isPageSelected =
    activePage >= selectedStart && activePage <= selectedEnd;

  return (
    <div className="discharge-pv-container">
      {/* Pasek nawigacji i statusu podglądu */}
      <div className="discharge-pv-header">
        <div className="discharge-pv-nav">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={activePage <= 1}
            onClick={() => onPageChange(activePage - 1)}
            aria-label="Poprzednia strona"
          >
            <IconArrowLeft size={16} />
          </Button>
          <span className="discharge-pv-counter">
            Strona <strong>{activePage}</strong> z {totalPages || "—"}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={totalPages === 0 || activePage >= totalPages}
            onClick={() => onPageChange(activePage + 1)}
            aria-label="Następna strona"
          >
            <IconArrowRight size={16} />
          </Button>
        </div>

        {/* Wskaźnik podświetlenia wyboru na podglądzie */}
        <div
          className={`discharge-pv-badge${
            isPageSelected ? " is-selected" : " is-unselected"
          }`}
        >
          {isPageSelected ? (
            <>
              <IconCheck size={14} aria-hidden="true" />
              <span>Strona w analizie</span>
            </>
          ) : (
            <>
              <IconX size={14} aria-hidden="true" />
              <span>Poza zakresem</span>
            </>
          )}
        </div>
      </div>

      {/* Szybkie zaznaczanie granic badania bezpośrednio z podglądu */}
      <div className="discharge-pv-boundary-actions">
        <button
          type="button"
          className="discharge-pv-action-btn"
          onClick={() => onSetStart(activePage)}
          title="Ustaw tę stronę jako początek zakresu analizy"
        >
          <IconFlag size={14} aria-hidden="true" />
          <span>Ustaw jako początek (str. {activePage})</span>
        </button>
        <button
          type="button"
          className="discharge-pv-action-btn"
          onClick={() => onSetEnd(activePage)}
          title="Ustaw tę stronę jako koniec zakresu analizy"
        >
          <IconCheck size={14} aria-hidden="true" />
          <span>Ustaw jako koniec (str. {activePage})</span>
        </button>
      </div>

      {/* Kontener canvasu z dynamicznym podświetleniem zaznaczenia */}
      <div className="discharge-pv-canvas-wrapper">
        {loading && <div className="discharge-pv-loading">Wczytywanie podglądu PDF…</div>}
        {error && (
          <div className="discharge-pv-error">
            Nie udało się wyrenderować podglądu strony.
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`discharge-pv-canvas${
            isPageSelected ? " is-highlighted" : ""
          }`}
        />
      </div>
    </div>
  );
}
