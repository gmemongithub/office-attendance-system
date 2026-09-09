// Receives push events from the backend (pushService.js) and shows them
// as a system notification, even if this tab/app isn't open (Spec §6).
self.addEventListener('push', function (event) {
  let data = { title: 'DailyTracker', body: 'You have a new notification.' };
  try { data = event.data.json(); } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});