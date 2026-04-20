// backend/src/modules/access/services/systemRole.service.js
const mongoose = require('mongoose')
const SystemRole = require('../models/SystemRole')
const Permission = require('../models/Permission')

function s(v) {
  return String(v ?? '').trim()
}

function escapeRegex(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeObjectIds(values) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((v) => s(v))
        .filter((v) => mongoose.Types.ObjectId.isValid(v)),
    ),
  ]
}

async function validatePermissionIds(permissionIds = []) {
  if (!permissionIds.length) return []

  const ids = normalizeObjectIds(permissionIds)

  const found = await Permission.find({
    _id: { $in: ids },
    isActive: true,
  })
    .select('_id')
    .lean()

  const foundIds = new Set(found.map((item) => String(item._id)))
  const invalidIds = ids.filter((id) => !foundIds.has(id))

  if (invalidIds.length) {
    const err = new Error('Some permissions are invalid or inactive')
    err.status = 400
    throw err
  }

  return ids
}

function mapPermission(permission) {
  if (!permission) return null

  return {
    id: String(permission._id),
    code: permission.code,
    name: permission.name,
    module: permission.module,
    description: permission.description || '',
    isActive: !!permission.isActive,
  }
}

function buildPermissionGroups(permissions = []) {
  const map = new Map()

  for (const permission of permissions) {
    const moduleName = s(permission?.module) || 'GENERAL'

    if (!map.has(moduleName)) {
      map.set(moduleName, [])
    }

    map.get(moduleName).push(mapPermission(permission))
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([module, items]) => ({
      module,
      items: items.sort((a, b) => {
        const codeA = s(a?.code)
        const codeB = s(b?.code)
        return codeA.localeCompare(codeB)
      }),
    }))
}

function mapRole(doc) {
  const rawPermissions = Array.isArray(doc.permissionIds)
    ? doc.permissionIds.filter((item) => item && typeof item === 'object' && item.code)
    : []

  const permissions = rawPermissions.map(mapPermission)

  return {
    id: String(doc._id),
    code: doc.code,
    displayName: doc.displayName,
    permissionIds: Array.isArray(doc.permissionIds)
      ? doc.permissionIds.map((item) =>
          typeof item === 'string' ? item : String(item._id || item),
        )
      : [],
    permissions,
    permissionGroups: buildPermissionGroups(rawPermissions),
    permissionCount: permissions.length,
    isActive: !!doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
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
  const safeField = ['code', 'displayName', 'isActive', 'createdAt', 'updatedAt'].includes(
    sortField,
  )
    ? sortField
    : 'createdAt'

  const safeOrder = Number(sortOrder) === 1 ? 1 : -1

  return {
    [safeField]: safeOrder,
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
  const filter = buildFilter({ search, isActive })
  const skip = (page - 1) * limit
  const sort = buildSort(sortField, sortOrder)

  const [items, total] = await Promise.all([
    SystemRole.find(filter)
      .populate({
        path: 'permissionIds',
        select: 'code name module description isActive',
        options: { sort: { module: 1, code: 1 } },
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    SystemRole.countDocuments(filter),
  ])

  return {
    items: items.map(mapRole),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
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
  const doc = await SystemRole.findById(id)
    .populate({
      path: 'permissionIds',
      select: 'code name module description isActive',
      options: { sort: { module: 1, code: 1 } },
    })
    .lean()

  if (!doc) {
    const err = new Error('System role not found')
    err.status = 404
    throw err
  }

  return mapRole(doc)
}

async function create(payload) {
  const code = s(payload.code).toUpperCase()
  const displayName = s(payload.displayName)

  const exists = await SystemRole.findOne({ code }).lean()
  if (exists) {
    const err = new Error('Role code already exists')
    err.status = 409
    throw err
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
  const doc = await SystemRole.findById(id)

  if (!doc) {
    const err = new Error('System role not found')
    err.status = 404
    throw err
  }

  if (payload.code !== undefined) {
    const code = s(payload.code).toUpperCase()

    const exists = await SystemRole.findOne({
      _id: { $ne: doc._id },
      code,
    }).lean()

    if (exists) {
      const err = new Error('Role code already exists')
      err.status = 409
      throw err
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