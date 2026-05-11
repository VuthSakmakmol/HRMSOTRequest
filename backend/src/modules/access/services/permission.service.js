// backend/src/modules/access/services/permission.service.js

const mongoose = require('mongoose')
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

function permissionNotFoundError() {
  return new AppError({
    statusCode: 404,
    code: 'PERMISSION_NOT_FOUND',
    messageKey: 'access.permission.error.notFound',
    message: 'Permission not found',
  })
}

function mapPermission(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    code: doc.code || '',
    name: doc.name || '',
    module: doc.module || '',
    description: doc.description || '',
    isActive: !!doc.isActive,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function buildFilter(query = {}) {
  const filter = {}

  const keyword = s(query.search || query.q)
  const moduleValue = up(query.module)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    filter.$or = [
      { code: regex },
      { name: regex },
      { module: regex },
      { description: regex },
    ]
  }

  if (moduleValue) {
    filter.module = moduleValue
  }

  if (query.isActive === 'true') filter.isActive = true
  if (query.isActive === 'false') filter.isActive = false

  return filter
}

function buildSort(sortField = 'module', sortOrder = 1) {
  const allowedFields = new Set([
    'module',
    'code',
    'name',
    'isActive',
    'createdAt',
    'updatedAt',
  ])

  const field = allowedFields.has(sortField) ? sortField : 'module'
  const order = Number(sortOrder) === -1 ? -1 : 1

  return {
    [field]: order,
    module: 1,
    code: 1,
    _id: 1,
  }
}

async function list(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total, modules] = await Promise.all([
    Permission.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    Permission.countDocuments(filter),

    Permission.distinct('module', {}),
  ])

  return {
    items: items.map(mapPermission),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },

    filters: {
      search: s(query.search || query.q),
      module: up(query.module),
      isActive: query.isActive || '',
      sortField: query.sortField || 'module',
      sortOrder: Number(query.sortOrder) === -1 ? -1 : 1,
      modules: [...modules]
        .map((item) => up(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    },
  }
}

async function getById(id) {
  ensureObjectId(id)

  const doc = await Permission.findById(id).lean()

  if (!doc) {
    throw permissionNotFoundError()
  }

  return mapPermission(doc)
}

module.exports = {
  list,
  getById,
}