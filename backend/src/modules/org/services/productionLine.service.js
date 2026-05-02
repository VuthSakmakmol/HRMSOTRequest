// backend/src/modules/org/services/productionLine.service.js

const mongoose = require('mongoose')

const ProductionLine = require('../models/ProductionLine')
const Department = require('../models/Department')
const Position = require('../models/Position')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function escapeRegex(value) {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toObjectId(value) {
  return new mongoose.Types.ObjectId(String(value))
}

function getActorId(user) {
  const id = user?.id || user?._id || user?.accountId
  return mongoose.isValidObjectId(id) ? id : null
}

function mapLine(doc) {
  if (!doc) return null

  const item = typeof doc.toObject === 'function' ? doc.toObject() : doc

  const department = item.departmentId && typeof item.departmentId === 'object' ? item.departmentId : null
  const positions = Array.isArray(item.positionIds) ? item.positionIds : []

  return {
    id: String(item._id),
    _id: item._id,

    code: item.code,
    name: item.name,
    description: item.description || '',
    isActive: Boolean(item.isActive),

    departmentId: department?._id || item.departmentId || null,
    departmentCode: department?.code || '',
    departmentName: department?.name || '',

    positionIds: positions.map((position) =>
      position && typeof position === 'object' ? position._id : position,
    ),

    positions: positions
      .filter((position) => position && typeof position === 'object')
      .map((position) => ({
        id: String(position._id),
        _id: position._id,
        code: position.code || '',
        name: position.name || '',
      })),

    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

async function assertDepartmentExists(departmentId) {
  if (!mongoose.isValidObjectId(departmentId)) {
    const err = new Error('Invalid department id')
    err.status = 400
    throw err
  }

  const department = await Department.findById(departmentId).lean()

  if (!department) {
    const err = new Error('Department not found')
    err.status = 404
    throw err
  }

  return department
}

async function normalizeAndValidatePositions(positionIds = [], departmentId) {
  const uniqueIds = [...new Set((Array.isArray(positionIds) ? positionIds : []).map(String))]

  if (!uniqueIds.length) return []

  const invalidId = uniqueIds.find((id) => !mongoose.isValidObjectId(id))
  if (invalidId) {
    const err = new Error('Invalid position id')
    err.status = 400
    throw err
  }

  const positions = await Position.find({
    _id: { $in: uniqueIds.map(toObjectId) },
  }).lean()

  if (positions.length !== uniqueIds.length) {
    const err = new Error('One or more positions were not found')
    err.status = 404
    throw err
  }

  const wrongDepartment = positions.find(
    (position) => String(position.departmentId) !== String(departmentId),
  )

  if (wrongDepartment) {
    const err = new Error('Selected positions must belong to the selected department')
    err.status = 400
    throw err
  }

  return uniqueIds
}

async function assertCodeAvailable(code, excludeId = null) {
  const filter = {
    code: upper(code),
  }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await ProductionLine.findOne(filter).lean()

  if (existing) {
    const err = new Error('Line code already exists')
    err.status = 409
    throw err
  }
}

function buildListFilter(query) {
  const filter = {}

  const search = s(query.search)
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ code: regex }, { name: regex }, { description: regex }]
  }

  if (query.isActive === 'true') {
    filter.isActive = true
  }

  if (query.isActive === 'false') {
    filter.isActive = false
  }

  if (query.departmentId) {
    filter.departmentId = query.departmentId
  }

  return filter
}

function buildSort(query) {
  const direction = Number(query.sortOrder) === -1 ? -1 : 1

  const sortFieldMap = {
    code: 'code',
    name: 'name',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }

  const field = sortFieldMap[query.sortField] || 'code'

  return {
    [field]: direction,
    _id: 1,
  }
}

async function list(query) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildListFilter(query)
  const sort = buildSort(query)

  const [rows, total] = await Promise.all([
    ProductionLine.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('departmentId', 'code name')
      .populate('positionIds', 'code name')
      .lean(),

    ProductionLine.countDocuments(filter),
  ])

  return {
    items: rows.map(mapLine),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  }
}

async function lookup(query) {
  const limit = Number(query.limit || 50)

  const filter = buildListFilter({
    ...query,
    isActive: query.isActive || 'true',
  })

  const rows = await ProductionLine.find(filter)
    .sort({ code: 1, name: 1 })
    .limit(limit)
    .populate('departmentId', 'code name')
    .lean()

  return {
    items: rows.map((line) => {
      const mapped = mapLine(line)

      return {
        id: mapped.id,
        _id: mapped._id,
        code: mapped.code,
        name: mapped.name,
        label: `${mapped.code} - ${mapped.name}`,
        departmentId: mapped.departmentId,
        departmentCode: mapped.departmentCode,
        departmentName: mapped.departmentName,
        isActive: mapped.isActive,
      }
    }),
  }
}

async function getById(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid line id')
    err.status = 400
    throw err
  }

  const line = await ProductionLine.findById(id)
    .populate('departmentId', 'code name')
    .populate('positionIds', 'code name')
    .lean()

  if (!line) {
    const err = new Error('Line not found')
    err.status = 404
    throw err
  }

  return mapLine(line)
}

async function create(payload, user) {
  const departmentId = String(payload.departmentId)

  await assertDepartmentExists(departmentId)
  await assertCodeAvailable(payload.code)

  const positionIds = await normalizeAndValidatePositions(payload.positionIds, departmentId)

  try {
    const line = await ProductionLine.create({
      code: upper(payload.code),
      name: s(payload.name),
      departmentId,
      positionIds,
      description: s(payload.description),
      isActive: payload.isActive !== false,
      createdBy: getActorId(user),
      updatedBy: getActorId(user),
    })

    return getById(line._id)
  } catch (error) {
    if (error?.code === 11000) {
      const err = new Error('Line code already exists')
      err.status = 409
      throw err
    }

    throw error
  }
}

async function update(id, payload, user) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid line id')
    err.status = 400
    throw err
  }

  const line = await ProductionLine.findById(id)

  if (!line) {
    const err = new Error('Line not found')
    err.status = 404
    throw err
  }

  if (payload.code !== undefined) {
    await assertCodeAvailable(payload.code, id)
    line.code = upper(payload.code)
  }

  if (payload.name !== undefined) {
    line.name = s(payload.name)
  }

  if (payload.description !== undefined) {
    line.description = s(payload.description)
  }

  if (payload.isActive !== undefined) {
    line.isActive = Boolean(payload.isActive)
  }

  const nextDepartmentId =
    payload.departmentId !== undefined ? String(payload.departmentId) : String(line.departmentId)

  if (payload.departmentId !== undefined) {
    await assertDepartmentExists(nextDepartmentId)
    line.departmentId = nextDepartmentId
  }

  if (payload.positionIds !== undefined || payload.departmentId !== undefined) {
    const positionIds = await normalizeAndValidatePositions(
      payload.positionIds !== undefined ? payload.positionIds : line.positionIds,
      nextDepartmentId,
    )

    line.positionIds = positionIds
  }

  line.updatedBy = getActorId(user)

  try {
    await line.save()
  } catch (error) {
    if (error?.code === 11000) {
      const err = new Error('Line code already exists')
      err.status = 409
      throw err
    }

    throw error
  }

  return getById(line._id)
}

module.exports = {
  list,
  lookup,
  getById,
  create,
  update,
}