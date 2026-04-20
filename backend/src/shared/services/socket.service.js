// backend/src/shared/services/socket.service.js
let ioInstance = null

function setIo(io) {
  ioInstance = io
}

function getIo() {
  return ioInstance
}

function emitToAll(event, payload) {
  if (!ioInstance) return
  ioInstance.emit(event, payload)
}

module.exports = {
  setIo,
  getIo,
  emitToAll,
}