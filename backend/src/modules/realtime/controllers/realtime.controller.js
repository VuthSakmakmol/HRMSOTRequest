// backend/src/modules/realtime/controllers/realtime.controller.js
const { emitToAll } = require('../../../shared/services/socket.service')

async function ping(req, res) {
  const payload = {
    message: 'Realtime ping from backend',
    time: new Date().toISOString(),
  }

  emitToAll('system:ping', payload)

  return res.json({
    ok: true,
    data: payload,
  })
}

module.exports = {
  ping,
}