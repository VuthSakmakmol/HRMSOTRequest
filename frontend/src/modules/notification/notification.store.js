// frontend/src/modules/notification/notification.store.js

import { defineStore } from 'pinia'

import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification.api'

import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
} from '@/modules/realtime/realtimeSocket'

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.notifications)) return payload.notifications
  if (Array.isArray(payload?.rows)) return payload.rows

  return []
}

function normalizeUnreadCount(payload, items = []) {
  const count = Number(payload?.unreadCount)

  if (Number.isFinite(count)) return count

  return items.filter((item) => item?.isRead !== true).length
}

function normalizeNotification(item = {}) {
  const id = String(item.id || item._id || '').trim()

  return {
    ...item,

    id,
    _id: id,

    title: String(item.title || '').trim(),
    message: String(item.message || '').trim(),

    module: String(item.module || '').trim(),
    type: String(item.type || '').trim(),

    requestNo: String(item.requestNo || '').trim(),
    routePath: String(item.routePath || '').trim(),

    isRead: item.isRead === true,

    createdAt: item.createdAt || null,
    readAt: item.readAt || null,
  }
}

function upsertNotification(items = [], nextItem = {}) {
  const normalized = normalizeNotification(nextItem)

  if (!normalized.id) return items

  const index = items.findIndex((item) => item.id === normalized.id)

  if (index >= 0) {
    return items.map((item, currentIndex) =>
      currentIndex === index ? normalized : item,
    )
  }

  return [normalized, ...items].slice(0, 20)
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    items: [],
    unreadCount: 0,

    loading: false,
    marking: false,
    loaded: false,
    error: null,

    pollTimer: null,
    realtimeStarted: false,
  }),

  getters: {
    hasUnread: (state) => Number(state.unreadCount || 0) > 0,

    latestItems: (state) => {
      return [...state.items].slice(0, 20)
    },
  },

  actions: {
    async fetchNotifications(params = {}) {
      this.loading = true
      this.error = null

      try {
        const res = await getMyNotifications({
          page: 1,
          limit: 20,
          unreadOnly: false,
          ...params,
        })

        const payload = normalizePayload(res)
        const items = normalizeItems(payload).map(normalizeNotification)

        this.items = items
        this.unreadCount = normalizeUnreadCount(payload, items)
        this.loaded = true

        return {
          items,
          unreadCount: this.unreadCount,
        }
      } catch (error) {
        this.error = error
        throw error
      } finally {
        this.loading = false
      }
    },

    startRealtime() {
      const socket = connectRealtimeSocket()

      if (!socket) return

      socket.off('notification:created')

      socket.on('notification:created', (payload = {}) => {
        const item = payload.notification

        if (item?.id || item?._id) {
          this.items = upsertNotification(this.items, item)
          this.unreadCount = this.items.filter((row) => row.isRead !== true).length
          this.loaded = true
        }

        this.fetchNotifications().catch(() => {})
      })

      socket.off('realtime:ready')

      socket.on('realtime:ready', () => {
        this.realtimeStarted = true
        this.fetchNotifications().catch(() => {})
      })
    },

    stopRealtime() {
      disconnectRealtimeSocket()
      this.realtimeStarted = false
    },

    async markRead(id) {
      const cleanId = String(id || '').trim()

      if (!cleanId) return null

      this.marking = true

      try {
        const res = await markNotificationRead(cleanId)

        this.items = this.items.map((item) => {
          if (item.id !== cleanId && item._id !== cleanId) return item

          return {
            ...item,
            isRead: true,
            readAt: item.readAt || new Date().toISOString(),
          }
        })

        this.unreadCount = this.items.filter((item) => item.isRead !== true).length

        return normalizePayload(res)?.item || null
      } finally {
        this.marking = false
      }
    },

    async markAllRead() {
      this.marking = true

      try {
        const res = await markAllNotificationsRead()

        this.items = this.items.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        }))

        this.unreadCount = 0

        return normalizePayload(res)?.item || null
      } finally {
        this.marking = false
      }
    },

    startPolling() {
      this.stopPolling()

      this.fetchNotifications().catch(() => {})

      this.pollTimer = window.setInterval(() => {
        this.fetchNotifications().catch(() => {})
      }, 120000)
    },

    stopPolling() {
      if (this.pollTimer) {
        window.clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },

    reset() {
      this.stopPolling()
      this.stopRealtime()

      this.items = []
      this.unreadCount = 0
      this.loading = false
      this.marking = false
      this.loaded = false
      this.error = null
    },
  },
})