// frontend/src/modules/realtime/realtimeSocket.js

import { io } from 'socket.io-client'

let socket = null

function s(value) {
  return String(value ?? '').trim()
}

function getSocketBaseUrl() {
  const apiBase = s(import.meta.env.VITE_API_BASE_URL)

  if (apiBase) {
    return apiBase.replace(/\/api\/v1\/?$/, '')
  }

  return 'http://localhost:4112'
}

function getAccessToken() {
  return s(localStorage.getItem('ot_access_token'))
}

function dispatchAppEvent(name, detail = {}) {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail,
    }),
  )
}

function attachDefaultListeners(nextSocket) {
  nextSocket.off('connect')
  nextSocket.on('connect', () => {
    console.log('[REALTIME_CONNECTED]', nextSocket.id)
  })

  nextSocket.off('connect_error')
  nextSocket.on('connect_error', (error) => {
    console.warn('[REALTIME_CONNECT_ERROR]', error?.message || error)
  })

  nextSocket.off('auth:error')
  nextSocket.on('auth:error', (payload) => {
    console.warn('[REALTIME_AUTH_ERROR]', payload)
  })

  nextSocket.off('disconnect')
  nextSocket.on('disconnect', (reason) => {
    console.log('[REALTIME_DISCONNECTED]', reason)
  })

  nextSocket.off('ot:request-changed')
  nextSocket.on('ot:request-changed', (payload = {}) => {
    console.log('[REALTIME_OT_CHANGED]', payload)

    dispatchAppEvent('ot:request-changed', payload)
  })
}

export function connectRealtimeSocket() {
  const token = getAccessToken()

  if (!token) {
    disconnectRealtimeSocket()
    return null
  }

  if (socket?.connected) {
    attachDefaultListeners(socket)
    return socket
  }

  if (socket) {
    socket.disconnect()
    socket = null
  }

  socket = io(getSocketBaseUrl(), {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  })

  attachDefaultListeners(socket)

  return socket
}

export function getRealtimeSocket() {
  return socket
}

export function disconnectRealtimeSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}