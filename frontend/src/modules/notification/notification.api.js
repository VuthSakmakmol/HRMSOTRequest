// frontend/src/modules/notification/notification.api.js

import api from '@/shared/services/api'

function withNoCacheParams(params = {}) {
  return {
    ...params,
    _ts: Date.now(),
  }
}

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
}

export function getMyNotifications(params = {}) {
  return api.get('/notifications', {
    params: withNoCacheParams({
      page: 1,
      limit: 20,
      unreadOnly: false,
      ...params,
    }),
    headers: NO_CACHE_HEADERS,
  })
}

export function markNotificationRead(id) {
  return api.patch(
    `/notifications/${id}/read`,
    {},
    {
      headers: NO_CACHE_HEADERS,
    },
  )
}

export function markAllNotificationsRead() {
  return api.patch(
    '/notifications/read-all',
    {},
    {
      headers: NO_CACHE_HEADERS,
    },
  )
}