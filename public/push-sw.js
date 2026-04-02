self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {
      title: 'CBTooll',
      body: event.data ? event.data.text() : '',
    }
  }

  const title = payload.title || 'CBTooll'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    tag: payload.tag || 'cbtooll-browser-push',
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || '/',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if (client.url === targetUrl || client.url.startsWith(self.location.origin)) {
            if ('navigate' in client) {
              client.navigate(targetUrl)
            }
            return client.focus()
          }
        }
      }

      return self.clients.openWindow(targetUrl)
    })
  )
})
