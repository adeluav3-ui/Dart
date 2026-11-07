// Custom service worker additions — compiled and merged by next-pwa into sw.js

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { return }

  event.waitUntil(
    self.registration.showNotification(data.title || 'GoCart', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'gocart',
      renotify: data.renotify !== false,
      requireInteraction: !!data.requireInteraction,
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          if (new URL(client.url).origin === location.origin) {
            client.focus()
            if (client.navigate) return client.navigate(url)
            return
          }
        } catch {}
      }
      return clients.openWindow(url)
    })
  )
})
