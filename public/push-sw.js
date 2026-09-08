self.addEventListener('push', (event) => {
  let payload = { title: 'logmaster', body: '', linkUrl: '/' }
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() }
    }
  } catch {
    payload.body = event.data?.text?.() ?? payload.body
  }

  const options = {
    body: payload.body,
    data: { linkUrl: payload.linkUrl ?? '/' },
    icon: '/logo192.png',
    badge: '/logo192.png',
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const linkUrl = event.notification.data?.linkUrl ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(linkUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(linkUrl)
      }
      return undefined
    }),
  )
})
