const CACHE_NAME = 'enreg-clients-v3';
const FILES_TO_CACHE = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting(); // active immédiatement la nouvelle version, sans attendre la fermeture de l'app
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // prend le contrôle de l'app déjà ouverte/installée immédiatement
  );
});

// Stratégie "réseau d'abord" pour la page principale et le manifest :
// on essaie toujours de récupérer la dernière version en ligne.
// Le cache ne sert que de secours si le réseau est indisponible (hors-ligne).
self.addEventListener('fetch', event => {
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  const isAppShell = event.request.url.includes('index.html') ||
                      event.request.url.includes('manifest.json') ||
                      event.request.mode === 'navigate';

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Pour le reste (ressources statiques), cache d'abord, réseau en secours
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-clients') {
    event.waitUntil(syncPendingClients());
  }
});

async function syncPendingClients() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'NETWORK_BACK' }));
}
