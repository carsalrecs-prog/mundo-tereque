const CACHE_NAME = 'mundo-tereque-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // Si tienes un archivo style.css u otras fotos, añádelos aquí. Ejemplo: './style.css', './foto_de_nosotros.jpg'
];

// Instalar el Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptar peticiones para que funcione rápido y cargue incluso si falla el internet
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
