/* Care My Pet - Service Worker (PWA) */

const PUBLIC_CACHE = "caremypet-public-v4";
const STATIC_CACHE = "caremypet-static-v4";
const ACTIVE_CACHES = new Set([PUBLIC_CACHE, STATIC_CACHE]);
const MAX_STATIC_ENTRIES = 120;
const MAX_PUBLIC_ENTRIES = 40;

const IS_LOCALHOST =
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname === "localhost";

// Minimal shell precache (no authenticated routes, no heavy 500 KB icons)
const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/brand/favicon.png",
  "/brand/mark.png",
];

// Private, tokenized, and auth routes MUST NEVER be stored in or served from Cache Storage
const PRIVATE_NAV_PATTERN =
  /^\/(?:pl|en)\/(?:app|shared|archive|recover|invite|login|register|auth)(?:\/|$)/;

const OFFLINE_HTML =
  "<!DOCTYPE html><html lang='pl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Care My Pet — Offline</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#fbf9f4;color:#1f241f;margin:0;padding:2rem;display:grid;place-items:center;min-height:100vh}main{max-width:28rem;background:#fff;border:1px solid #dfd7c8;border-radius:16px;padding:1.5rem}h1{color:#164d34;font-size:1.25rem;margin-top:0}p{color:#526462;line-height:1.5}</style></head><body><main><h1>Brak połączenia z internetem</h1><p>Aplikacja Care My Pet wymaga połączenia z siecią, aby bezpiecznie wyświetlić prywatną kartotekę zdrowia pupila. Wróć, gdy odzyskasz połączenie.</p></main></body></html>";

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.slice(0, keys.length - maxEntries);
  await Promise.all(excess.map((req) => cache.delete(req)));
}

function isCacheablePublicHtml(response) {
  if (!response || response.status !== 200 || response.type !== "basic") {
    return false;
  }
  if (response.redirected) {
    return false;
  }
  const cc = (response.headers.get("Cache-Control") || "").toLowerCase();
  if (cc.includes("no-store") || cc.includes("private")) {
    return false;
  }
  return true;
}

// Install: precache minimal public assets (skip precache on localhost dev server)
self.addEventListener("install", (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches
      .open(PUBLIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Precache failed:", err);
      })
  );
});

// Activate: purge outdated caches (including legacy caremypet-v2 with cached HTML)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (IS_LOCALHOST || !ACTIVE_CACHES.has(name)) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: strict same-origin & privacy boundary
self.addEventListener("fetch", (event) => {
  if (IS_LOCALHOST) {
    return;
  }

  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/auth/")
  ) {
    return;
  }

  // Navigation requests (HTML documents)
  if (request.mode === "navigate") {
    // Private, tokenized & auth pages: strictly Network-Only (never cached on device)
    if (PRIVATE_NAV_PATTERN.test(url.pathname)) {
      event.respondWith(fetch(request).catch(() => offlineResponse()));
      return;
    }

    // Public marketing/legal pages: Network-First with bounded public cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheablePublicHtml(response)) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(PUBLIC_CACHE)
                .then((cache) => cache.put(request, copy))
                .then(() => trimCache(PUBLIC_CACHE, MAX_PUBLIC_ENTRIES))
                .catch(() => undefined)
            );
          }
          return response;
        })
        .catch(async () => {
          const publicCache = await caches.open(PUBLIC_CACHE);
          const cachedResponse = await publicCache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return offlineResponse();
        })
    );
    return;
  }

  // Immutable hashed/versioned static assets: pure Cache-First (no redundant background refetch)
  const isImmutableAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pdf-worker/") ||
    url.pathname.startsWith("/fonts/");

  if (isImmutableAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request).then((fresh) => {
            if (fresh && fresh.status === 200 && fresh.type === "basic") {
              const copy = fresh.clone();
              event.waitUntil(
                cache
                  .put(request, copy)
                  .then(() => trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES))
                  .catch(() => undefined)
              );
            }
            return fresh;
          });
        })
      )
    );
    return;
  }

  // Public same-origin brand/media assets: Stale-While-Revalidate with bounded cache
  const isPublicMediaAsset =
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname === "/manifest.webmanifest";

  if (isPublicMediaAsset) {
    event.respondWith(
      caches.open(PUBLIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((fresh) => {
              if (fresh && fresh.status === 200 && fresh.type === "basic") {
                const copy = fresh.clone();
                event.waitUntil(
                  cache
                    .put(request, copy)
                    .then(() => trimCache(PUBLIC_CACHE, MAX_PUBLIC_ENTRIES))
                    .catch(() => undefined)
                );
              }
              return fresh;
            })
            .catch(() => cached);

          return cached || networkFetch;
        })
      )
    );
  }
});

// Web Push Notifications
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Care My Pet",
      body: event.data
        ? event.data.text()
        : "Nowe przypomnienie z kartoteki zdrowia pupila.",
    };
  }

  const title = payload.title || "Care My Pet";
  const options = {
    body: payload.body || "Masz nowe przypomnienie o opiece nad pupilem.",
    icon: payload.icon || "/brand/icon-192.png",
    badge: "/brand/mark.png",
    tag: payload.tag || "caremypet-reminder",
    data: {
      url: payload.url || "/app",
    },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/app";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
