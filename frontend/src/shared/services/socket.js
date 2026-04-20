// frontend/src/shared/services/socket.js
import { io } from 'socket.io-client'

let socket

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:4112', {
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}