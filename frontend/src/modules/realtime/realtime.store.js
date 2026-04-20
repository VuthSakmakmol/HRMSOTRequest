// frontend/src/modules/realtime/realtime.store.js
import { defineStore } from 'pinia'
import { getSocket } from '@/shared/services/socket'

export const useRealtimeStore = defineStore('realtime', {
  state: () => ({
    connected: false,
    lastPing: null,
  }),

  actions: {
    init() {
      const socket = getSocket()

      socket.on('connect', () => {
        this.connected = true
      })

      socket.on('disconnect', () => {
        this.connected = false
      })

      socket.on('system:ping', (payload) => {
        this.lastPing = payload
      })
    },
  },
})