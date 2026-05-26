// frontend/src/shared/services/socket.js
import { io } from 'socket.io-client'

let socket

function getSocketBaseUrl() {
  return (
    import.meta.env.VITE_SOCKET_BASE_URL ||
    // Local development:
    // http://localhost:4112
    //
    // Production on droplet with Nginx port 8081:
    // /
    (import.meta.env.DEV ? 'http://localhost:4112' : '/')
  )
}

export function getSocket() {
  if (!socket) {
    socket = io(getSocketBaseUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })
  }

  return socket
}