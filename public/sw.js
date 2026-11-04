/* Care My Pet - Service Worker (PWA) */

const CACHE_NAME = "caremypet-v1";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/brand/favicon.png",
  "/brand/apple-touch-icon.png",
  "/brand/mark.png",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/brand/icon-maskable.png",
];

// Install: precache static shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Precache failed:", err);
      })
  );
});

// Activate: clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-First for HTML navigations, Cache-First/SWR for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Skip browser extensions or cross-origin API calls (like Supabase storage / auth endpoints)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Bypass service worker for Supabase API & Auth requests to prevent stale security tokens
  if (url.pathname.includes("/auth/") || url.hostname.includes("supabase")) {
    return;
  }

  // Navigation requests (HTML pages) -> Network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const fallbackShell = await caches.match("/");
          if (fallbackShell) {
            return fallbackShell;
          }
          return new Response(
            "<!DOCTYPE html><html lang='pl'><head><meta charset='utf-8'><title>Care My Pet — Offline</title></head><body><h1>Brak połączenia z internetem</h1><p>Aplikacja Care My Pet działa w trybie offline. Wróć, gdy odzyskasz połączenie z siecią.</p></body></html>",
            {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        })
    );
    return;
  }

  // Static assets (Next.js chunks, brand images, fonts, styles) -> Cache first / Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Revalidate in background
          fetch(request)
            .then((fresh) => {
              if (fresh && fresh.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, fresh));
              }
            })
            .catch(() => undefined);
          return cached;
        }

        return fetch(request).then((fresh) => {
          if (fresh && fresh.status === 200) {
            const copy = fresh.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return fresh;
        });
      })
    );
  }
});
