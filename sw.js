const CACHE_NAME = 'enreg-clients-v1';
const FILES_TO_CACHE = [
  './enregistrement_clients.html',
  './manifest.json'
];

// Installation — mise en cache des fichiers
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activation — supprime les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — sert depuis le cache si hors-ligne
self.addEventListener('fetch', event => {
  // Ne pas intercepter les requêtes Firebase (elles gèrent elles-mêmes le hors-ligne)
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Met en cache les nouvelles ressources
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Hors-ligne et pas en cache → page principale
        return caches.match('./enregistrement_clients.html');
      });
    })
  );
});

// Sync en arrière-plan quand le réseau revient
self.addEventListener('sync', event => {
  if (event.tag === 'sync-clients') {
    event.waitUntil(syncPendingClients());
  }
});

async function syncPendingClients() {
  // Notifie l'application que le réseau est revenu
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'NETWORK_BACK' }));
}
