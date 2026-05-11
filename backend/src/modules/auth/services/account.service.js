// backend/src/modules/auth/services/account.service.js

const mongoose = require('mongoose')
const Account = require('../models/Account')
const AppError = require('../../../shared/errors/AppError')

function s(value) {
  return String(value ?? '').trim()
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizePermissionCodes(values) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => s(value).toUpperCase())
        .filter(Boolean),
    ),
  ]
}

function ensureObjectId(id, field = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid id',
      field,
      params: {
        value: id,
      },
    })
  }
}

function accountNotFoundError() {
  return new AppError({
    statusCode: 404,
    code: 'ACCOUNT_NOT_FOUND',
    messageKey: 'auth.account.error.notFound',
    message: 'Account not found',
  })
}

function duplicateLoginIdError(loginId) {
  return new AppError({
    statusCode: 409,
    code: 'ACCOUNT_LOGIN_ID_EXISTS',
    messageKey: 'auth.account.error.loginIdExists',
    message: 'Login ID already exists',
    field: 'loginId',
    params: {
      loginId,
    },
  })
}

function sanitize(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    loginId: doc.loginId,
    displayName: doc.displayName,
    employeeId: doc.employeeId ? String(doc.employeeId) : null,
    roleIds: Array.isArray(doc.roleIds) ? doc.roleIds.map(String) : [],
    directPermissionCodes: Array.isArray(doc.directPermissionCodes)
      ? normalizePermissionCodes(doc.directPermissionCodes)
      : [],
    passwordVersion: Number(doc.passwordVersion || 1),
    mustChangePassword: !!doc.mustChangePassword,
    isActive: !!doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function list({ page = 1, limit = 10, search = '', isActive = '' }) {
  const filter = {}

  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false

  const keyword = s(search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    filter.$or = [
      { loginId: regex },
      { displayName: regex },
      { directPermissionCodes: regex },
    ]
  }

  const safePage = Number(page || 1)
  const safeLimit = Number(limit || 10)
  const skip = (safePage - 1) * safeLimit

  const [items, total] = await Promise.all([
    Account.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Account.countDocuments(filter),
  ])

  return {
    items: items.map(sanitize),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      hasMore: safePage * safeLimit < total,
    },
  }
}

async function getById(id) {
  ensureObjectId(id)

  const doc = await Account.findById(id).lean()

  if (!doc) {
    throw accountNotFoundError()
  }

  return sanitize(doc)
}

async function create(payload) {
  const normalizedLoginId = s(payload.loginId).toLowerCase()

  const exists = await Account.findOne({
    loginId: normalizedLoginId,
  }).lean()

  if (exists) {
    throw duplicateLoginIdError(normalizedLoginId)
  }

  const passwordHash = await Account.hashPassword(payload.password)

  const doc = await Account.create({
    loginId: normalizedLoginId,
    passwordHash,
    displayName: s(payload.displayName),
    employeeId: payload.employeeId || null,
    roleIds: Array.isArray(payload.roleIds) ? payload.roleIds : [],
    directPermissionCodes: normalizePermissionCodes(payload.directPermissionCodes),
    passwordVersion: 1,
    mustChangePassword: payload.mustChangePassword ?? false,
    isActive: payload.isActive ?? true,
  })

  return getById(doc._id)
}

async function update(id, payload) {
  ensureObjectId(id)

  const doc = await Account.findById(id)

  if (!doc) {
    throw accountNotFoundError()
  }

  if (payload.loginId !== undefined) {
    const normalizedLoginId = s(payload.loginId).toLowerCase()

    const exists = await Account.findOne({
      _id: { $ne: doc._id },
      loginId: normalizedLoginId,
    }).lean()

    if (exists) {
      throw duplicateLoginIdError(normalizedLoginId)
    }

    doc.loginId = normalizedLoginId
  }

  if (payload.displayName !== undefined) {
    doc.displayName = s(payload.displayName)
  }

  if (payload.employeeId !== undefined) {
    doc.employeeId = payload.employeeId || null
  }

  if (payload.roleIds !== undefined) {
    doc.roleIds = Array.isArray(payload.roleIds) ? payload.roleIds : []
  }

  if (payload.directPermissionCodes !== undefined) {
    doc.directPermissionCodes = normalizePermissionCodes(payload.directPermissionCodes)
  }

  if (payload.mustChangePassword !== undefined) {
    doc.mustChangePassword = !!payload.mustChangePassword
  }

  if (payload.isActive !== undefined) {
    doc.isActive = !!payload.isActive
  }

  await doc.save()

  return getById(doc._id)
}

async function resetPassword(id, { newPassword, mustChangePassword = true }) {
  ensureObjectId(id)

  const doc = await Account.findById(id)

  if (!doc) {
    throw accountNotFoundError()
  }

  doc.passwordHash = await Account.hashPassword(newPassword)
  doc.passwordVersion = Number(doc.passwordVersion || 1) + 1
  doc.mustChangePassword = mustChangePassword

  await doc.save()

  return {
    id: String(doc._id),
    loginId: doc.loginId,
    passwordVersion: doc.passwordVersion,
    mustChangePassword: !!doc.mustChangePassword,
    messageKey: 'auth.account.success.passwordReset',
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  resetPassword,
}