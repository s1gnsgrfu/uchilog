self.addEventListener('push', function (event) {
  let data = {
    title: 'UchiLog',
    body: '新しい日記が投稿されました。',
    url: '/timeline',
  }

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      }
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: data.url || '/timeline',
      },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const targetUrl = new URL(event.notification.data?.url || '/timeline', self.location.origin).href

  event.waitUntil((async function () {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windowClients) {
      if ('focus' in client && client.url === targetUrl) {
        return client.focus()
      }
    }

    if (clients.openWindow) {
      return clients.openWindow(targetUrl)
    }
  })())
})
