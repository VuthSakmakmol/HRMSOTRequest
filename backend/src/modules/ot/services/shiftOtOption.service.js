// backend/src/modules/ot/services/shiftOtOption.service.js
const mongoose = require('mongoose')

const ShiftOTOption = require('../models/ShiftOTOption')
const Shift = require('../../shift/models/Shift')
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
    $or: [{ label: regex }],
  }
}

function buildFilter(query) {
  const filter = {}

  if (s(query.shiftId) && mongoose.isValidObjectId(query.shiftId)) {
    filter.shiftId = query.shiftId
  }

  if (s(query.calculationPolicyId) && mongoose.isValidObjectId(query.calculationPolicyId)) {
    filter.calculationPolicyId = query.calculationPolicyId
  }

  if (s(query.isActive) === 'true') filter.isActive = true
  if (s(query.isActive) === 'false') filter.isActive = false

  const searchFilter = buildSearchFilter(query.search)
  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildSort(query) {
  const direction = query.sortOrder === 'desc' ? -1 : 1
  const allowedSortMap = {
    createdAt: 'createdAt',
    label: 'label',
    requestedMinutes: 'requestedMinutes',
    sequence: 'sequence',
    isActive: 'isActive',
  }

  const sortField = allowedSortMap[query.sortBy] || 'sequence'
  return { [sortField]: direction, sequence: 1, createdAt: -1 }
}

async function assertShiftExists(shiftId) {
  if (!mongoose.isValidObjectId(shiftId)) {
    const err = new Error('Invalid shift id')
    err.status = 400
    throw err
  }

  const shift = await Shift.findById(shiftId).lean()

  if (!shift) {
    const err = new Error('Shift not found')
    err.status = 404
    throw err
  }

  return shift
}

async function assertPolicyExists(policyId) {
  if (!mongoose.isValidObjectId(policyId)) {
    const err = new Error('Invalid OT calculation policy id')
    err.status = 400
    throw err
  }

  const policy = await OTCalculationPolicy.findById(policyId).lean()

  if (!policy) {
    const err = new Error('OT calculation policy not found')
    err.status = 404
    throw err
  }

  return policy
}

function mapItem(doc) {
  const shift = doc.shiftId || {}
  const policy = doc.calculationPolicyId || {}

  return {
    id: String(doc._id),
    shiftId: shift?._id ? String(shift._id) : String(doc.shiftId?._id || doc.shiftId || ''),
    shift: {
      id: shift?._id ? String(shift._id) : null,
      code: s(shift?.code),
      name: s(shift?.name),
      type: s(shift?.type),
      startTime: s(shift?.startTime),
      endTime: s(shift?.endTime),
      crossMidnight: shift?.crossMidnight === true,
      isActive: shift?.isActive !== false,
    },
    label: s(doc.label),
    requestedMinutes: Number(doc.requestedMinutes || 0),
    requestedHours: Number((Number(doc.requestedMinutes || 0) / 60).toFixed(2)),
    calculationPolicyId: policy?._id
      ? String(policy._id)
      : String(doc.calculationPolicyId?._id || doc.calculationPolicyId || ''),
    calculationPolicy: {
      id: policy?._id ? String(policy._id) : null,
      code: s(policy?.code),
      name: s(policy?.name),
      roundMethod: s(policy?.roundMethod),
      roundUnitMinutes: Number(policy?.roundUnitMinutes || 0),
      minEligibleMinutes: Number(policy?.minEligibleMinutes || 0),
      graceAfterShiftEndMinutes: Number(policy?.graceAfterShiftEndMinutes || 0),
      isActive: policy?.isActive !== false,
    },
    sequence: Number(doc.sequence || 0),
    isActive: doc.isActive !== false,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function create(payload, authUser) {
  await assertShiftExists(payload.shiftId)
  await assertPolicyExists(payload.calculationPolicyId)

  const duplicateLabel = await ShiftOTOption.findOne({
    shiftId: payload.shiftId,
    label: s(payload.label),
    isActive: true,
  }).lean()

  if (duplicateLabel) {
    const err = new Error('Active OT option label already exists for this shift')
    err.status = 400
    throw err
  }

  const duplicateSequence = await ShiftOTOption.findOne({
    shiftId: payload.shiftId,
    sequence: Number(payload.sequence || 0),
    isActive: true,
  }).lean()

  if (duplicateSequence) {
    const err = new Error('Active OT option sequence already exists for this shift')
    err.status = 400
    throw err
  }

  const doc = await ShiftOTOption.create({
    ...payload,
    createdBy: authUser?.accountId || authUser?._id || null,
    updatedBy: authUser?.accountId || authUser?._id || null,
  })

  return getById(doc._id)
}

async function update(id, payload, authUser) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid shift OT option id')
    err.status = 400
    throw err
  }

  const doc = await ShiftOTOption.findById(id)

  if (!doc) {
    const err = new Error('Shift OT option not found')
    err.status = 404
    throw err
  }

  const nextShiftId = payload.shiftId || doc.shiftId
  const nextPolicyId = payload.calculationPolicyId || doc.calculationPolicyId
  const nextLabel = Object.prototype.hasOwnProperty.call(payload, 'label') ? payload.label : doc.label
  const nextSequence = Object.prototype.hasOwnProperty.call(payload, 'sequence')
    ? payload.sequence
    : doc.sequence
  const nextIsActive = Object.prototype.hasOwnProperty.call(payload, 'isActive')
    ? payload.isActive
    : doc.isActive

  await assertShiftExists(nextShiftId)
  await assertPolicyExists(nextPolicyId)

  if (nextIsActive !== false) {
    const duplicateLabel = await ShiftOTOption.findOne({
      _id: { $ne: id },
      shiftId: nextShiftId,
      label: s(nextLabel),
      isActive: true,
    }).lean()

    if (duplicateLabel) {
      const err = new Error('Active OT option label already exists for this shift')
      err.status = 400
      throw err
    }

    const duplicateSequence = await ShiftOTOption.findOne({
      _id: { $ne: id },
      shiftId: nextShiftId,
      sequence: Number(nextSequence || 0),
      isActive: true,
    }).lean()

    if (duplicateSequence) {
      const err = new Error('Active OT option sequence already exists for this shift')
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
    ShiftOTOption.find(filter)
      .populate({
        path: 'shiftId',
        select: {
          _id: 1,
          code: 1,
          name: 1,
          type: 1,
          startTime: 1,
          endTime: 1,
          crossMidnight: 1,
          isActive: 1,
        },
      })
      .populate({
        path: 'calculationPolicyId',
        select: {
          _id: 1,
          code: 1,
          name: 1,
          roundMethod: 1,
          roundUnitMinutes: 1,
          minEligibleMinutes: 1,
          graceAfterShiftEndMinutes: 1,
          isActive: 1,
        },
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    ShiftOTOption.countDocuments(filter),
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
    const err = new Error('Invalid shift OT option id')
    err.status = 400
    throw err
  }

  const doc = await ShiftOTOption.findById(id)
    .populate({
      path: 'shiftId',
      select: {
        _id: 1,
        code: 1,
        name: 1,
        type: 1,
        startTime: 1,
        endTime: 1,
        crossMidnight: 1,
        isActive: 1,
      },
    })
    .populate({
      path: 'calculationPolicyId',
      select: {
        _id: 1,
        code: 1,
        name: 1,
        roundMethod: 1,
        roundUnitMinutes: 1,
        minEligibleMinutes: 1,
        graceAfterShiftEndMinutes: 1,
        isActive: 1,
      },
    })
    .lean()

  if (!doc) {
    const err = new Error('Shift OT option not found')
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