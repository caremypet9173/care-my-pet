"use client";

import { MAX_FEEDBACK_SCREENSHOT_BYTES, type ScreenshotMime } from "@/lib/feedback-shared";

const PLACEHOLDER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface CapturedScreenshot {
  blob: Blob;
  mime: ScreenshotMime;
  previewUrl: string;
  source: "auto" | "upload" | "paste";
}

function shouldIncludeNode(node: HTMLElement, skipExternalImages: boolean): boolean {
  if (!(node instanceof Element)) return true;
  if (node.getAttribute("data-feedback-ignore") === "true") return false;
  const tag = node.tagName;
  if (tag === "SCRIPT" || tag === "NOSCRIPT") return false;
  if (skipExternalImages && tag === "IMG") {
    const src = node.getAttribute("src") ?? "";
    if (src.startsWith("http://") || src.startsWith("https://")) {
      try {
        if (new URL(src).origin !== window.location.origin) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }
  return true;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Captures the currently visible viewport as a compressed JPEG without blocking
 * the UI or pulling screenshot libraries into the initial bundle.
 */
export async function captureViewportScreenshot(): Promise<CapturedScreenshot | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  try {
    const { toJpeg } = await import("html-to-image");
    const target =
      (document.querySelector(".household-shell") as HTMLElement | null) ??
      document.body;
    const vw = Math.max(320, Math.round(window.innerWidth));
    const vh = Math.max(320, Math.round(window.innerHeight));
    const scale = vw > 1280 ? 1280 / vw : 1;
    const canvasWidth = Math.round(vw * scale);
    const canvasHeight = Math.round(vh * scale);
    const scrollX = Math.round(window.scrollX);
    const scrollY = Math.round(window.scrollY);

    const baseOptions = {
      width: vw,
      height: vh,
      canvasWidth,
      canvasHeight,
      pixelRatio: 1,
      quality: 0.78,
      backgroundColor: "#faf8f4",
      cacheBust: false,
      imagePlaceholder: PLACEHOLDER_PNG,
      style: {
        margin: "0",
        transform: `translate(${-scrollX}px, ${-scrollY}px)`,
        transformOrigin: "top left",
      },
    };

    let dataUrl: string | null = null;
    try {
      dataUrl = await toJpeg(target, {
        ...baseOptions,
        filter: (node) => shouldIncludeNode(node as HTMLElement, false),
      });
    } catch {
      // Fallback: skip cross-origin images and webfont embedding if strict CORS fails.
      dataUrl = await toJpeg(target, {
        ...baseOptions,
        skipFonts: true,
        filter: (node) => shouldIncludeNode(node as HTMLElement, true),
      });
    }

    if (!dataUrl || !dataUrl.startsWith("data:image/jpeg")) {
      return null;
    }

    const blob = await dataUrlToBlob(dataUrl);
    if (!blob.size || blob.size > MAX_FEEDBACK_SCREENSHOT_BYTES) {
      return null;
    }

    return {
      blob,
      mime: "image/jpeg",
      previewUrl: URL.createObjectURL(blob),
      source: "auto",
    };
  } catch {
    return null;
  }
}

/**
 * Compresses/normalizes a pasted or user-selected image so phone screenshots
 * (>2 MB) fit neatly into the 2 MB Storage bucket limit.
 */
export async function prepareUserScreenshotFile(
  file: File,
  source: "upload" | "paste",
): Promise<CapturedScreenshot | null> {
  if (!file.type.startsWith("image/")) return null;

  const allowedDirectly =
    (file.type === "image/webp" ||
      file.type === "image/jpeg" ||
      file.type === "image/png") &&
    file.size > 0 &&
    file.size <= MAX_FEEDBACK_SCREENSHOT_BYTES;

  if (allowedDirectly && file.size <= 1.2 * 1024 * 1024) {
    return {
      blob: file,
      mime: file.type as ScreenshotMime,
      previewUrl: URL.createObjectURL(file),
      source,
    };
  }

  // Re-encode / downscale via canvas to JPEG <= 1440px wide
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image_decode_failed"));
      el.src = objectUrl;
    });
    const maxDim = 1440;
    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round(img.naturalWidth * ratio));
    const height = Math.max(1, Math.round(img.naturalHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    if (!blob || !blob.size || blob.size > MAX_FEEDBACK_SCREENSHOT_BYTES) {
      return null;
    }

    return {
      blob,
      mime: "image/jpeg",
      previewUrl: URL.createObjectURL(blob),
      source,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
