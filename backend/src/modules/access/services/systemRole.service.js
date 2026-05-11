// backend/src/modules/access/services/systemRole.service.js

const mongoose = require('mongoose')
const SystemRole = require('../models/SystemRole')
const Permission = require('../models/Permission')
const AppError = require('../../../shared/errors/AppError')

function s(value) {
  return String(value ?? '').trim()
}

function up(value) {
  return s(value).toUpperCase()
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

function normalizeObjectIds(values) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

function roleNotFoundError() {
  return new AppError({
    statusCode: 404,
    code: 'SYSTEM_ROLE_NOT_FOUND',
    messageKey: 'access.role.error.notFound',
    message: 'System role not found',
  })
}

function duplicateRoleCodeError(code) {
  return new AppError({
    statusCode: 409,
    code: 'SYSTEM_ROLE_CODE_EXISTS',
    messageKey: 'access.role.error.codeExists',
    message: 'Role code already exists',
    field: 'code',
    params: {
      code,
    },
  })
}

async function validatePermissionIds(permissionIds = []) {
  const ids = normalizeObjectIds(permissionIds)

  if (!ids.length) return []

  const invalidFormatIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id))

  if (invalidFormatIds.length) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_PERMISSION_IDS',
      messageKey: 'access.role.error.invalidPermissionIds',
      message: 'Some permission ids are invalid',
      field: 'permissionIds',
      params: {
        invalidIds: invalidFormatIds,
      },
    })
  }

  const found = await Permission.find({
    _id: { $in: ids },
    isActive: true,
  })
    .select('_id')
    .lean()

  const foundIds = new Set(found.map((item) => String(item._id)))
  const inactiveOrMissingIds = ids.filter((id) => !foundIds.has(id))

  if (inactiveOrMissingIds.length) {
    throw new AppError({
      statusCode: 400,
      code: 'PERMISSION_INACTIVE_OR_NOT_FOUND',
      messageKey: 'access.role.error.permissionInactiveOrNotFound',
      message: 'Some permissions are invalid or inactive',
      field: 'permissionIds',
      params: {
        invalidIds: inactiveOrMissingIds,
      },
    })
  }

  return ids
}

function mapPermission(permission) {
  if (!permission) return null

  return {
    id: String(permission._id),
    code: permission.code || '',
    name: permission.name || '',
    module: permission.module || '',
    description: permission.description || '',
    isActive: !!permission.isActive,
  }
}

function buildPermissionGroups(permissions = []) {
  const groupMap = new Map()

  for (const permission of permissions) {
    const moduleName = up(permission?.module) || 'GENERAL'

    if (!groupMap.has(moduleName)) {
      groupMap.set(moduleName, [])
    }

    groupMap.get(moduleName).push(mapPermission(permission))
  }

  return Array.from(groupMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([module, items]) => ({
      module,
      items: items
        .filter(Boolean)
        .sort((a, b) => s(a.code).localeCompare(s(b.code))),
    }))
}

function mapRole(doc) {
  const rawPermissions = Array.isArray(doc.permissionIds)
    ? doc.permissionIds.filter((item) => item && typeof item === 'object' && item.code)
    : []

  const permissions = rawPermissions.map(mapPermission).filter(Boolean)

  return {
    id: String(doc._id),
    code: doc.code || '',
    displayName: doc.displayName || '',
    permissionIds: Array.isArray(doc.permissionIds)
      ? doc.permissionIds.map((item) =>
          typeof item === 'string' ? item : String(item._id || item),
        )
      : [],
    permissions,
    permissionGroups: buildPermissionGroups(rawPermissions),
    permissionCount: permissions.length,
    isActive: !!doc.isActive,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function buildFilter({ search = '', isActive = '' } = {}) {
  const filter = {}

  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false

  const keyword = s(search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')
    filter.$or = [{ code: regex }, { displayName: regex }]
  }

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const allowedFields = new Set([
    'code',
    'displayName',
    'isActive',
    'createdAt',
    'updatedAt',
  ])

  const field = allowedFields.has(sortField) ? sortField : 'createdAt'
  const order = Number(sortOrder) === 1 ? 1 : -1

  return {
    [field]: order,
    _id: -1,
  }
}

async function list({
  page = 1,
  limit = 10,
  search = '',
  isActive = '',
  sortField = 'createdAt',
  sortOrder = -1,
} = {}) {
  const safePage = Number(page || 1)
  const safeLimit = Number(limit || 10)

  const filter = buildFilter({ search, isActive })
  const sort = buildSort(sortField, sortOrder)
  const skip = (safePage - 1) * safeLimit

  const [items, total] = await Promise.all([
    SystemRole.find(filter)
      .populate({
        path: 'permissionIds',
        select: 'code name module description isActive',
        options: {
          sort: {
            module: 1,
            code: 1,
          },
        },
      })
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    SystemRole.countDocuments(filter),
  ])

  return {
    items: items.map(mapRole),

    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      hasMore: safePage * safeLimit < total,
    },

    filters: {
      search: s(search),
      isActive,
      sortField,
      sortOrder: Number(sortOrder) === 1 ? 1 : -1,
    },
  }
}

async function getById(id) {
  ensureObjectId(id)

  const doc = await SystemRole.findById(id)
    .populate({
      path: 'permissionIds',
      select: 'code name module description isActive',
      options: {
        sort: {
          module: 1,
          code: 1,
        },
      },
    })
    .lean()

  if (!doc) {
    throw roleNotFoundError()
  }

  return mapRole(doc)
}

async function create(payload) {
  const code = up(payload.code)
  const displayName = s(payload.displayName)

  const exists = await SystemRole.findOne({ code }).lean()

  if (exists) {
    throw duplicateRoleCodeError(code)
  }

  const permissionIds = await validatePermissionIds(payload.permissionIds || [])

  const doc = await SystemRole.create({
    code,
    displayName,
    permissionIds,
    isActive: payload.isActive ?? true,
  })

  return getById(doc._id)
}

async function update(id, payload) {
  ensureObjectId(id)

  const doc = await SystemRole.findById(id)

  if (!doc) {
    throw roleNotFoundError()
  }

  if (payload.code !== undefined) {
    const code = up(payload.code)

    const exists = await SystemRole.findOne({
      _id: { $ne: doc._id },
      code,
    }).lean()

    if (exists) {
      throw duplicateRoleCodeError(code)
    }

    doc.code = code
  }

  if (payload.displayName !== undefined) {
    doc.displayName = s(payload.displayName)
  }

  if (payload.permissionIds !== undefined) {
    doc.permissionIds = await validatePermissionIds(payload.permissionIds)
  }

  if (payload.isActive !== undefined) {
    doc.isActive = !!payload.isActive
  }

  await doc.save()

  return getById(doc._id)
}

module.exports = {
  list,
  getById,
  create,
  update,
}