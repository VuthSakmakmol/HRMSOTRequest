// backend/src/modules/access/services/permission.service.js
const Permission = require('../models/Permission')

function s(v) {
  return String(v ?? '').trim()
}

function up(v) {
  return s(v).toUpperCase()
}

function toObjectIdString(v) {
  return s(v)
}

function buildSort(sortField = 'module', sortOrder = 1) {
  const allowedFields = new Set([
    'module',
    'code',
    'name',
    'createdAt',
    'updatedAt',
  ])

  const field = allowedFields.has(sortField) ? sortField : 'module'
  const order = Number(sortOrder) === -1 ? -1 : 1

  const sort = { [field]: order }

  if (field !== 'module') sort.module = 1
  if (field !== 'code') sort.code = 1
  if (field !== '_id') sort._id = 1

  return sort
}

function buildFilter(query = {}) {
  const filter = {}

  const q = s(query.q)
  const moduleValue = up(query.module)

  if (q) {
    filter.$or = [
      { code: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
      { module: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ]
  }

  if (moduleValue) {
    filter.module = moduleValue
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  return filter
}

async function list(query = {}) {
  const page = Number(query.page) > 0 ? Number(query.page) : 1
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 10
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
    items: items.map((item) => ({
      id: toObjectIdString(item._id),
      code: item.code || '',
      name: item.name || '',
      module: item.module || '',
      description: item.description || '',
      isActive: Boolean(item.isActive),
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
    filters: {
      modules: [...modules]
        .map((item) => up(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    },
  }
}

async function getById(id) {
  const item = await Permission.findById(id).lean()

  if (!item) {
    const error = new Error('Permission not found.')
    error.status = 404
    throw error
  }

  return {
    id: toObjectIdString(item._id),
    code: item.code || '',
    name: item.name || '',
    module: item.module || '',
    description: item.description || '',
    isActive: Boolean(item.isActive),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

module.exports = {
  list,
  getById,
}