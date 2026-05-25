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

function normalizeObjectId(value) {
  const clean = s(value)

  if (!clean) return null

  return mongoose.Types.ObjectId.isValid(clean) ? clean : null
}

function ensureObjectId(id, field = 'id') {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
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

function duplicateEmployeeAccountError(employeeId) {
  return new AppError({
    statusCode: 409,
    code: 'ACCOUNT_EMPLOYEE_ALREADY_LINKED',
    messageKey: 'auth.account.error.employeeAlreadyLinked',
    message: 'This employee is already linked to another account',
    field: 'employeeId',
    params: {
      employeeId,
    },
  })
}

function normalizeEmployeeOutput(employee) {
  if (!employee) return null

  const id = String(employee._id || employee.id || '')
  const employeeCode = s(employee.employeeCode || employee.employeeNo || employee.code)
  const displayName = s(employee.displayName || employee.name || employee.fullName)

  const department =
    employee.departmentId && typeof employee.departmentId === 'object'
      ? employee.departmentId
      : null

  const position =
    employee.positionId && typeof employee.positionId === 'object'
      ? employee.positionId
      : null

  return {
    id,
    _id: id,
    employeeId: id,

    employeeCode,
    employeeNo: employeeCode,
    code: employeeCode,

    displayName,
    name: displayName,
    employeeName: displayName,

    label:
      [employeeCode, displayName].filter(Boolean).join(' - ') ||
      displayName ||
      employeeCode ||
      id,

    departmentId: department?._id
      ? String(department._id)
      : employee.departmentId
        ? String(employee.departmentId)
        : null,

    departmentName: s(department?.name || employee.departmentName),

    positionId: position?._id
      ? String(position._id)
      : employee.positionId
        ? String(employee.positionId)
        : null,

    positionName: s(position?.name || employee.positionName),

    isActive: employee.isActive !== false,
  }
}

function sanitize(doc) {
  if (!doc) return null

  const id = String(doc._id || doc.id || '')

  const linkedEmployee =
    doc.employeeId && typeof doc.employeeId === 'object'
      ? normalizeEmployeeOutput(doc.employeeId)
      : null

  const employeeId = linkedEmployee
    ? linkedEmployee.id
    : doc.employeeId
      ? String(doc.employeeId)
      : null

  return {
    id,
    _id: id,

    loginId: doc.loginId,
    displayName: doc.displayName,

    // Source of truth for linked account employee.
    employeeId,
    employee: linkedEmployee,

    // Compatibility for existing frontend picker/table code.
    employeeLabel: linkedEmployee?.label || '',
    employeeCode: linkedEmployee?.employeeCode || '',
    employeeName: linkedEmployee?.displayName || '',
    departmentName: linkedEmployee?.departmentName || '',
    positionName: linkedEmployee?.positionName || '',

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

function applyAccountPopulate(query) {
  return query.populate({
    path: 'employeeId',
    select: 'employeeCode displayName departmentId positionId isActive',
    populate: [
      {
        path: 'departmentId',
        select: 'code name',
      },
      {
        path: 'positionId',
        select: 'code name',
      },
    ],
  })
}

async function assertEmployeeAvailableForAccount(employeeId, currentAccountId = null) {
  const cleanEmployeeId = normalizeObjectId(employeeId)

  if (!cleanEmployeeId) return

  const filter = {
    employeeId: cleanEmployeeId,
  }

  if (currentAccountId) {
    filter._id = {
      $ne: currentAccountId,
    }
  }

  const existing = await Account.findOne(filter)
    .select('_id loginId displayName employeeId')
    .lean()

  if (existing) {
    throw duplicateEmployeeAccountError(cleanEmployeeId)
  }
}

async function list({ page = 1, limit = 10, search = '', isActive = '' } = {}) {
  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10))
  const skip = (safePage - 1) * safeLimit

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

  const [items, total] = await Promise.all([
    applyAccountPopulate(
      Account.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(safeLimit),
    ).lean(),

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

  const doc = await applyAccountPopulate(Account.findById(id)).lean()

  if (!doc) {
    throw accountNotFoundError()
  }

  return sanitize(doc)
}

async function create(payload = {}) {
  const normalizedLoginId = s(payload.loginId).toLowerCase()
  const employeeId = normalizeObjectId(payload.employeeId)

  const exists = await Account.findOne({
    loginId: normalizedLoginId,
  }).lean()

  if (exists) {
    throw duplicateLoginIdError(normalizedLoginId)
  }

  await assertEmployeeAvailableForAccount(employeeId)

  const passwordHash = await Account.hashPassword(payload.password)

  const doc = await Account.create({
    loginId: normalizedLoginId,
    passwordHash,
    displayName: s(payload.displayName),
    employeeId,
    roleIds: Array.isArray(payload.roleIds) ? payload.roleIds : [],
    directPermissionCodes: normalizePermissionCodes(payload.directPermissionCodes),
    passwordVersion: 1,
    mustChangePassword: payload.mustChangePassword ?? false,
    isActive: payload.isActive ?? true,
  })

  return getById(doc._id)
}

async function update(id, payload = {}) {
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
    const employeeId = normalizeObjectId(payload.employeeId)

    await assertEmployeeAvailableForAccount(employeeId, doc._id)

    doc.employeeId = employeeId
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

async function resetPassword(id, { newPassword, mustChangePassword = true } = {}) {
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
    _id: String(doc._id),
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