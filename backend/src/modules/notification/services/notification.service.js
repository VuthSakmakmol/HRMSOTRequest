// backend/src/modules/notification/services/notification.service.js

const mongoose = require('mongoose')

const Account = require('../../auth/models/Account')
const Employee = require('../../org/models/Employee')

const Notification = require('../models/Notification')
const {
  NOTIFICATION_MODULES,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
} = require('../notification.constants')

let realtimeService = null

try {
  realtimeService = require('../../realtime/realtime.service')
} catch (_) {
  realtimeService = null
}

function s(value) {
  return String(value ?? '').trim()
}

function lower(value) {
  return s(value).toLowerCase()
}

function upper(value) {
  return s(value).toUpperCase()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function toObjectId(value) {
  const clean = s(value)

  if (!clean || !isObjectId(clean)) return null

  return new mongoose.Types.ObjectId(clean)
}

function unique(values = []) {
  return [...new Set(values.map(s).filter(Boolean))]
}

function normalizeChannels(channels = []) {
  const allowed = new Set(Object.values(NOTIFICATION_CHANNELS))
  const list = Array.isArray(channels) ? channels : []

  const normalized = list
    .map((item) => upper(item))
    .filter((item) => allowed.has(item))

  if (!normalized.length) {
    normalized.push(NOTIFICATION_CHANNELS.IN_APP)
  }

  return [...new Set(normalized)]
}

function normalizePayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return {}

  return payload
}

function buildNotificationRoute({ module, entityId, requestNo }) {
  if (module === NOTIFICATION_MODULES.OT && entityId) {
    return {
      routeName: 'ot-request-detail',
      routePath: `/ot/requests/${entityId}`,
    }
  }

  if (module === NOTIFICATION_MODULES.OT && requestNo) {
    return {
      routeName: 'ot-requests',
      routePath: '/ot/requests',
    }
  }

  return {
    routeName: '',
    routePath: '',
  }
}

function presentNotification(item = {}) {
  const id = String(item._id || item.id || '')

  return {
    id,
    _id: id,

    recipientAccountId: item.recipientAccountId
      ? String(item.recipientAccountId)
      : null,

    recipientEmployeeId: item.recipientEmployeeId
      ? String(item.recipientEmployeeId)
      : null,

    actorAccountId: item.actorAccountId ? String(item.actorAccountId) : null,
    actorEmployeeId: item.actorEmployeeId ? String(item.actorEmployeeId) : null,

    module: s(item.module),
    type: s(item.type),

    title: s(item.title),
    message: s(item.message),

    entityType: s(item.entityType),
    entityId: item.entityId ? String(item.entityId) : null,
    requestNo: s(item.requestNo),

    routeName: s(item.routeName),
    routePath: s(item.routePath),

    payload: normalizePayload(item.payload),
    channels: Array.isArray(item.channels) ? item.channels : [],

    isRead: item.isRead === true,
    readAt: item.readAt || null,

    deliveredSocketAt: item.deliveredSocketAt || null,
    deliveredTelegramAt: item.deliveredTelegramAt || null,

    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function emitNotification(item) {
  try {
    if (realtimeService?.emitNotificationCreated) {
      realtimeService.emitNotificationCreated(item)
    }
  } catch (error) {
    console.warn('[NOTIFICATION_SOCKET_EMIT_FAILED]', error?.message || error)
  }
}

async function createNotification(input = {}) {
  const module = upper(input.module)
  const type = upper(input.type)
  const title = s(input.title)
  const message = s(input.message)

  if (!module) {
    throw new Error('Notification module is required')
  }

  if (!type) {
    throw new Error('Notification type is required')
  }

  if (!title) {
    throw new Error('Notification title is required')
  }

  const route = buildNotificationRoute({
    module,
    entityId: input.entityId,
    requestNo: input.requestNo,
  })

  const doc = await Notification.create({
    recipientAccountId: toObjectId(input.recipientAccountId),
    recipientEmployeeId: toObjectId(input.recipientEmployeeId),

    actorAccountId: toObjectId(input.actorAccountId),
    actorEmployeeId: toObjectId(input.actorEmployeeId),

    module,
    type,

    title,
    message,

    entityType: s(input.entityType),
    entityId: toObjectId(input.entityId),
    requestNo: s(input.requestNo),

    routeName: s(input.routeName || route.routeName),
    routePath: s(input.routePath || route.routePath),

    payload: normalizePayload(input.payload),
    channels: normalizeChannels(input.channels),
  })

  const item = presentNotification(doc.toObject())

  emitNotification(item)

  return item
}

async function createManyNotifications(items = []) {
  const list = Array.isArray(items) ? items : []
  const results = []

  for (const item of list) {
    results.push(await createNotification(item))
  }

  return results
}

async function resolveNotificationOwnerIdentity({
  accountId = null,
  employeeId = null,
  loginId = '',
  displayName = '',
} = {}) {
  const accountIds = []
  const employeeIds = []
  const loginIds = []
  const displayNames = []

  const cleanAccountId = s(accountId)
  const cleanEmployeeId = s(employeeId)
  const cleanLoginId = lower(loginId)
  const cleanDisplayName = s(displayName)

  if (isObjectId(cleanAccountId)) {
    accountIds.push(cleanAccountId)
  }

  if (isObjectId(cleanEmployeeId)) {
    employeeIds.push(cleanEmployeeId)
  }

  if (cleanLoginId) {
    loginIds.push(cleanLoginId)
  }

  if (cleanDisplayName) {
    displayNames.push(cleanDisplayName)
  }

  let account = null

  if (isObjectId(cleanAccountId)) {
    account = await Account.findById(cleanAccountId)
      .select('_id loginId displayName employeeId isActive')
      .lean()

    if (account) {
      accountIds.push(String(account._id))

      if (account.employeeId) {
        employeeIds.push(String(account.employeeId))
      }

      if (account.loginId) {
        loginIds.push(lower(account.loginId))
      }

      if (account.displayName) {
        displayNames.push(s(account.displayName))
      }
    }
  }

  const employeeSearchOr = []

  for (const value of unique(loginIds)) {
    employeeSearchOr.push({
      employeeCode: upper(value),
    })
  }

  for (const value of unique(displayNames)) {
    employeeSearchOr.push({
      displayName: value,
    })
  }

  if (employeeSearchOr.length) {
    const employees = await Employee.find({
      isActive: { $ne: false },
      $or: employeeSearchOr,
    })
      .select('_id employeeCode displayName isActive')
      .lean()

    for (const employee of employees) {
      employeeIds.push(String(employee._id))

      if (employee.employeeCode) {
        loginIds.push(lower(employee.employeeCode))
      }

      if (employee.displayName) {
        displayNames.push(s(employee.displayName))
      }
    }
  }

  return {
    accountIds: unique(accountIds),
    employeeIds: unique(employeeIds),
    loginIds: unique(loginIds),
    displayNames: unique(displayNames),
  }
}

function buildOwnerFilterFromIdentity(identity = {}) {
  const or = []

  const accountIds = unique(identity.accountIds || [])
  const employeeIds = unique(identity.employeeIds || [])
  const loginIds = unique(identity.loginIds || [])
  const displayNames = unique(identity.displayNames || [])

  const objectAccountIds = accountIds
    .filter(isObjectId)
    .map((value) => new mongoose.Types.ObjectId(value))

  const objectEmployeeIds = employeeIds
    .filter(isObjectId)
    .map((value) => new mongoose.Types.ObjectId(value))

  if (objectAccountIds.length) {
    or.push({
      recipientAccountId: {
        $in: objectAccountIds,
      },
    })
  }

  if (objectEmployeeIds.length) {
    or.push({
      recipientEmployeeId: {
        $in: objectEmployeeIds,
      },
    })
  }

  if (loginIds.length) {
    or.push({
      'payload.recipientLoginId': {
        $in: loginIds,
      },
    })
  }

  if (displayNames.length) {
    or.push({
      'payload.recipientDisplayName': {
        $in: displayNames,
      },
    })
  }

  return or
}

async function buildOwnerFilter(authUser = {}) {
  const identity = await resolveNotificationOwnerIdentity(authUser)
  const or = buildOwnerFilterFromIdentity(identity)

  return {
    identity,
    or,
  }
}

async function listMyNotifications({
  accountId,
  employeeId,
  loginId,
  displayName,
  page = 1,
  limit = 20,
  unreadOnly = false,
} = {}) {
  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (safePage - 1) * safeLimit

  const { identity, or } = await buildOwnerFilter({
    accountId,
    employeeId,
    loginId,
    displayName,
  })

  if (!or.length) {
    return {
      items: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
      },
      unreadCount: 0,
      owner: identity,
    }
  }

  const filter = {
    $or: or,
  }

  if (unreadOnly) {
    filter.isRead = false
  }

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    Notification.countDocuments(filter),

    Notification.countDocuments({
      $or: or,
      isRead: false,
    }),
  ])

  return {
    items: items.map(presentNotification),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    unreadCount,
    owner: identity,
  }
}

async function markNotificationRead(id, authUser = {}) {
  const cleanId = s(id)

  if (!isObjectId(cleanId)) {
    throw new Error('Invalid notification id')
  }

  const { or } = await buildOwnerFilter(authUser)

  if (!or.length) {
    throw new Error('Notification owner is required')
  }

  const item = await Notification.findOneAndUpdate(
    {
      _id: cleanId,
      $or: or,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
    {
      new: true,
    },
  ).lean()

  return item ? presentNotification(item) : null
}

async function markAllNotificationsRead(authUser = {}) {
  const { or } = await buildOwnerFilter(authUser)

  if (!or.length) {
    return {
      matched: 0,
      modified: 0,
    }
  }

  const result = await Notification.updateMany(
    {
      $or: or,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
  )

  return {
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0,
  }
}

function buildOTNotification({
  type,
  recipientAccountId = null,
  recipientEmployeeId = null,
  actorAccountId = null,
  actorEmployeeId = null,
  otRequest = {},
  title,
  message,
  payload = {},
  channels = [NOTIFICATION_CHANNELS.IN_APP],
} = {}) {
  const requestId = otRequest?._id || otRequest?.id || null
  const requestNo = s(otRequest?.requestNo)

  return {
    recipientAccountId,
    recipientEmployeeId,

    actorAccountId,
    actorEmployeeId,

    module: NOTIFICATION_MODULES.OT,
    type,

    title,
    message,

    entityType: 'OT_REQUEST',
    entityId: requestId,
    requestNo,

    payload: {
      requestId: requestId ? String(requestId) : null,
      requestNo,
      otDate: s(otRequest?.otDate),
      status: s(otRequest?.status),
      ...normalizePayload(payload),
    },

    channels,
  }
}

module.exports = {
  NOTIFICATION_MODULES,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,

  createNotification,
  createManyNotifications,
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,

  buildOTNotification,
  presentNotification,
}