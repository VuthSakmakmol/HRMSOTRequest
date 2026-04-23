// backend/src/modules/ot/services/otPolicy.service.js
const mongoose = require('mongoose')
const OTCalculationPolicy = require('../models/OTCalculationPolicy')

function s(value) {
  return String(value ?? '').trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return null

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [{ code: regex }, { name: regex }, { description: regex }],
  }
}

function buildFilter(query) {
  const filter = {}

  if (s(query.isActive) === 'true') filter.isActive = true
  if (s(query.isActive) === 'false') filter.isActive = false

  if (s(query.roundMethod)) filter.roundMethod = s(query.roundMethod).toUpperCase()

  const searchFilter = buildSearchFilter(query.search)
  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildSort(query) {
  const direction = query.sortOrder === 'asc' ? 1 : -1
  const allowedSortMap = {
    createdAt: 'createdAt',
    code: 'code',
    name: 'name',
    roundMethod: 'roundMethod',
    roundUnitMinutes: 'roundUnitMinutes',
    isActive: 'isActive',
  }

  const sortField = allowedSortMap[query.sortBy] || 'createdAt'
  return { [sortField]: direction, createdAt: -1 }
}

function mapItem(doc) {
  return {
    id: String(doc._id),
    code: s(doc.code),
    name: s(doc.name),
    description: s(doc.description),
    minEligibleMinutes: Number(doc.minEligibleMinutes || 0),
    roundUnitMinutes: Number(doc.roundUnitMinutes || 0),
    roundMethod: s(doc.roundMethod),
    graceAfterShiftEndMinutes: Number(doc.graceAfterShiftEndMinutes || 0),
    allowPreShiftOT: doc.allowPreShiftOT === true,
    allowPostShiftOT: doc.allowPostShiftOT !== false,
    capByRequestedMinutes: doc.capByRequestedMinutes !== false,
    treatForgetScanInAsPending: doc.treatForgetScanInAsPending !== false,
    treatForgetScanOutAsPending: doc.treatForgetScanOutAsPending !== false,
    isActive: doc.isActive !== false,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function create(payload, authUser) {
  const exists = await OTCalculationPolicy.findOne({
    code: s(payload.code).toUpperCase(),
  }).lean()

  if (exists) {
    const err = new Error('OT calculation policy code already exists')
    err.status = 400
    throw err
  }

  const doc = await OTCalculationPolicy.create({
    ...payload,
    createdBy: authUser?.accountId || authUser?._id || null,
    updatedBy: authUser?.accountId || authUser?._id || null,
  })

  return getById(doc._id)
}

async function update(id, payload, authUser) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid OT calculation policy id')
    err.status = 400
    throw err
  }

  const doc = await OTCalculationPolicy.findById(id)

  if (!doc) {
    const err = new Error('OT calculation policy not found')
    err.status = 404
    throw err
  }

  if (payload.code) {
    const duplicate = await OTCalculationPolicy.findOne({
      _id: { $ne: id },
      code: s(payload.code).toUpperCase(),
    }).lean()

    if (duplicate) {
      const err = new Error('OT calculation policy code already exists')
      err.status = 400
      throw err
    }
  }

  Object.assign(doc, payload)
  doc.updatedBy = authUser?.accountId || authUser?._id || null

  await doc.save()

  return getById(doc._id)
}

async function list(query) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query)

  const [items, total] = await Promise.all([
    OTCalculationPolicy.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    OTCalculationPolicy.countDocuments(filter),
  ])

  return {
    items: items.map(mapItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

async function getById(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid OT calculation policy id')
    err.status = 400
    throw err
  }

  const doc = await OTCalculationPolicy.findById(id).lean()

  if (!doc) {
    const err = new Error('OT calculation policy not found')
    err.status = 404
    throw err
  }

  return mapItem(doc)
}

module.exports = {
  create,
  update,
  list,
  getById,
}