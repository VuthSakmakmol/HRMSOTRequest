// backend/src/modules/realtime/realtime.service.js

const Account = require('../auth/models/Account')
const { verifyAccessToken } = require('../../shared/utils/jwt')

let ioInstance = null

function s(value) {
  return String(value ?? '').trim()
}

function roomAccount(accountId) {
  const id = s(accountId)

  return id ? `account:${id}` : ''
}

function roomEmployee(employeeId) {
  const id = s(employeeId)

  return id ? `employee:${id}` : ''
}

function getTokenFromSocket(socket) {
  const authToken = s(socket.handshake?.auth?.token)

  if (authToken) return authToken

  const header = s(socket.handshake?.headers?.authorization)
  const [type, token] = header.split(' ')

  if (type === 'Bearer' && token) return token

  return ''
}

async function buildSocketUser(socket) {
  const token = getTokenFromSocket(socket)

  if (!token) return null

  let payload = null

  try {
    payload = verifyAccessToken(token)
  } catch (_) {
    return null
  }

  const account = await Account.findById(payload.sub)
    .select('_id loginId displayName employeeId passwordVersion isActive')
    .lean()

  if (!account || account.isActive === false) {
    return null
  }

  const tokenPasswordVersion = Number(payload.passwordVersion || 1)
  const currentPasswordVersion = Number(account.passwordVersion || 1)

  if (tokenPasswordVersion !== currentPasswordVersion) {
    return null
  }

  return {
    accountId: String(account._id),
    loginId: account.loginId,
    displayName: account.displayName,
    employeeId: account.employeeId ? String(account.employeeId) : null,
  }
}

function setRealtimeServer(io) {
  ioInstance = io
}

function getRealtimeServer() {
  return ioInstance
}

function emitToRoom(room, eventName, payload = {}) {
  const io = getRealtimeServer()

  if (!io || !room || !eventName) return false

  io.to(room).emit(eventName, payload)

  return true
}

function emitToAccount(accountId, eventName, payload = {}) {
  const room = roomAccount(accountId)

  return emitToRoom(room, eventName, payload)
}

function emitToEmployee(employeeId, eventName, payload = {}) {
  const room = roomEmployee(employeeId)

  return emitToRoom(room, eventName, payload)
}

function emitNotificationCreated(notification = {}) {
  const payload = {
    event: 'NOTIFICATION_CREATED',
    notification,
    unreadCountChanged: true,
  }

  let emitted = false

  if (notification.recipientAccountId) {
    emitted =
      emitToAccount(notification.recipientAccountId, 'notification:created', payload) ||
      emitted
  }

  if (notification.recipientEmployeeId) {
    emitted =
      emitToEmployee(notification.recipientEmployeeId, 'notification:created', payload) ||
      emitted
  }

  return emitted
}

function emitOTRequestChanged({
  requestId = '',
  requestNo = '',
  status = '',
  action = '',
  actorAccountId = '',
  actorEmployeeId = '',
  accountIds = [],
  employeeIds = [],
  payload = {},
} = {}) {
  const eventPayload = {
    event: 'OT_REQUEST_CHANGED',
    requestId: s(requestId),
    requestNo: s(requestNo),
    status: s(status),
    action: s(action),
    actorAccountId: s(actorAccountId),
    actorEmployeeId: s(actorEmployeeId),
    payload,
    changedAt: new Date().toISOString(),
  }

  const targetAccountIds = [
    actorAccountId,
    ...(Array.isArray(accountIds) ? accountIds : []),
  ]
    .map(s)
    .filter(Boolean)

  const targetEmployeeIds = [
    actorEmployeeId,
    ...(Array.isArray(employeeIds) ? employeeIds : []),
  ]
    .map(s)
    .filter(Boolean)

  let emitted = false

  for (const accountId of [...new Set(targetAccountIds)]) {
    emitted = emitToAccount(accountId, 'ot:request-changed', eventPayload) || emitted
  }

  for (const employeeId of [...new Set(targetEmployeeIds)]) {
    emitted = emitToEmployee(employeeId, 'ot:request-changed', eventPayload) || emitted
  }

  if (emitted) {
    console.log('[socket] ot:request-changed emitted:', {
      requestNo: eventPayload.requestNo,
      action: eventPayload.action,
      accounts: [...new Set(targetAccountIds)].length,
      employees: [...new Set(targetEmployeeIds)].length,
    })
  }

  return emitted
}

function attachSocketHandlers(io) {
  io.on('connection', async (socket) => {
    const socketUser = await buildSocketUser(socket)

    if (!socketUser?.accountId) {
      socket.emit('auth:error', {
        message: 'Unauthorized socket connection',
      })

      socket.disconnect(true)
      return
    }

    socket.data.user = socketUser

    const accountRoom = roomAccount(socketUser.accountId)
    const employeeRoom = roomEmployee(socketUser.employeeId)

    if (accountRoom) {
      socket.join(accountRoom)
    }

    if (employeeRoom) {
      socket.join(employeeRoom)
    }

    console.log('[socket] connected:', {
      socketId: socket.id,
      loginId: socketUser.loginId,
      accountId: socketUser.accountId,
      employeeId: socketUser.employeeId,
      rooms: [accountRoom, employeeRoom].filter(Boolean),
    })

    socket.emit('realtime:ready', {
      accountId: socketUser.accountId,
      employeeId: socketUser.employeeId,
      rooms: [accountRoom, employeeRoom].filter(Boolean),
    })

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', socket.id, reason)
    })
  })
}

module.exports = {
  setRealtimeServer,
  getRealtimeServer,
  attachSocketHandlers,

  emitToAccount,
  emitToEmployee,
  emitNotificationCreated,
  emitOTRequestChanged,

  roomAccount,
  roomEmployee,
}