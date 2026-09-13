const CACHE_NAME = 'daily-thread-v7';
const FILES_TO_CACHE = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Daily Thread', body: 'You have a reminder.' };
  try{
    if(event.data) data = event.data.json();
  }catch(e){}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [400, 200, 400, 200, 400, 200, 400],
      requireInteraction: true,
      renotify: true,
      silent: false,
      tag: 'daily-thread-alarm',
      data: { id: data.id },
      actions: data.actions || []
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if(event.action === 'snooze'){
    const reminderId = event.notification.data && event.notification.data.id;
    event.waitUntil(
      self.registration.pushManager.getSubscription().then((subscription) => {
        if(!subscription || !reminderId) return;
        return fetch('/.netlify/functions/snooze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint, reminderId })
        });
      })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if(clientList.length > 0) return clientList[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
