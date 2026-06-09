/**
 * Lekki service worker — bez cache offline.
 * Umożliwia instalację PWA (Chrome/Android) i szybką aktywację nowej wersji.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
