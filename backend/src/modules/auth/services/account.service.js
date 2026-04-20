// backend/src/modules/auth/services/account.service.js
const Account = require('../models/Account')

function s(v) {
  return String(v ?? '').trim()
}

function escapeRegex(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizePermissionCodes(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(v => s(v).toUpperCase()).filter(Boolean))]
}

function sanitize(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    loginId: doc.loginId,
    displayName: doc.displayName,
    employeeId: doc.employeeId ? String(doc.employeeId) : null,
    roleIds: Array.isArray(doc.roleIds) ? doc.roleIds.map(String) : [],
    directPermissionCodes: Array.isArray(doc.directPermissionCodes) ? doc.directPermissionCodes : [],
    passwordVersion: doc.passwordVersion || 1,
    mustChangePassword: !!doc.mustChangePassword,
    isActive: !!doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function list({ page, limit, search, isActive }) {
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

  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    Account.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Account.countDocuments(filter),
  ])

  return {
    items: items.map(sanitize),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

async function getById(id) {
  const doc = await Account.findById(id).lean()

  if (!doc) {
    const err = new Error('Account not found')
    err.status = 404
    throw err
  }

  return sanitize(doc)
}

async function create(payload) {
  const normalizedLoginId = s(payload.loginId).toLowerCase()

  const exists = await Account.findOne({ loginId: normalizedLoginId }).lean()
  if (exists) {
    const err = new Error('Login ID already exists')
    err.status = 409
    throw err
  }

  const passwordHash = await Account.hashPassword(payload.password)

  const doc = await Account.create({
    loginId: normalizedLoginId,
    passwordHash,
    displayName: s(payload.displayName),
    employeeId: payload.employeeId ?? null,
    roleIds: payload.roleIds ?? [],
    directPermissionCodes: normalizePermissionCodes(payload.directPermissionCodes),
    passwordVersion: 1,
    mustChangePassword: payload.mustChangePassword ?? false,
    isActive: payload.isActive ?? true,
  })

  return getById(doc._id)
}

async function update(id, payload) {
  const doc = await Account.findById(id)

  if (!doc) {
    const err = new Error('Account not found')
    err.status = 404
    throw err
  }

  if (payload.loginId !== undefined) {
    const normalizedLoginId = s(payload.loginId).toLowerCase()

    const exists = await Account.findOne({
      _id: { $ne: doc._id },
      loginId: normalizedLoginId,
    }).lean()

    if (exists) {
      const err = new Error('Login ID already exists')
      err.status = 409
      throw err
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
    doc.roleIds = payload.roleIds
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

async function resetPassword(id, { newPassword, mustChangePassword }) {
  const doc = await Account.findById(id)

  if (!doc) {
    const err = new Error('Account not found')
    err.status = 404
    throw err
  }

  doc.passwordHash = await Account.hashPassword(newPassword)
  doc.passwordVersion = (doc.passwordVersion || 1) + 1
  doc.mustChangePassword = mustChangePassword ?? true

  await doc.save()

  return {
    message: 'Password reset successfully',
    passwordVersion: doc.passwordVersion,
    mustChangePassword: doc.mustChangePassword,
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  resetPassword,
}