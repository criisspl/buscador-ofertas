// Service worker a mano, sin dependencias. El id del build (next.config.ts) va en el nombre de la caché:
// cada build crea una nueva y al activarse se borran las anteriores.
const sw = `
const CACHE = "ofertas-${process.env.BUILD_ID}";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo GET del mismo origen; nada de /api/ ni de peticiones RSC de Next ni .wasm.
  if (
    req.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js" ||
    url.pathname.endsWith(".wasm") ||
    req.headers.has("RSC") ||
    url.searchParams.has("_rsc")
  )
    return;

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return res;
          }),
      ),
    );
  } else if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
  }
});
`;

export function GET() {
  return new Response(sw, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
