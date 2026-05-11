// backend/src/modules/ot/services/otPolicy.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')
const OTCalculationPolicy = require('../models/OTCalculationPolicy')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function id(value) {
  return value ? String(value?._id || value?.id || value) : ''
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function appError({
  statusCode = 400,
  code,
  messageKey,
  message,
  field = null,
  params = {},
}) {
  return new AppError({
    statusCode,
    code,
    messageKey,
    message,
    field,
    params,
  })
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function actorAccountId(authUser) {
  const actorId = authUser?.accountId || authUser?.id || authUser?._id

  return isObjectId(actorId) ? actorId : null
}

function buildFilter(query = {}) {
  const filter = {}

  const keyword = s(query.search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    filter.$or = [{ code: regex }, { name: regex }, { description: regex }]
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  if (query.roundMethod) {
    filter.roundMethod = upper(query.roundMethod)
  }

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const allowedFields = new Set([
    'createdAt',
    'updatedAt',
    'code',
    'name',
    'roundMethod',
    'roundUnitMinutes',
    'minEligibleMinutes',
    'graceAfterShiftEndMinutes',
    'isActive',
  ])

  const field = allowedFields.has(sortField) ? sortField : 'createdAt'
  const direction = Number(sortOrder) === 1 ? 1 : -1

  return {
    [field]: direction,
    _id: -1,
  }
}

function mapPolicy(doc) {
  if (!doc) return null

  return {
    id: id(doc._id),
    _id: id(doc._id),

    code: doc.code || '',
    name: doc.name || '',
    label: [doc.code, doc.name].filter(Boolean).join(' - '),

    description: doc.description || '',

    minEligibleMinutes: Number(doc.minEligibleMinutes || 0),
    roundUnitMinutes: Number(doc.roundUnitMinutes || 0),
    roundMethod: upper(doc.roundMethod || 'CEIL'),
    roundMethodKey: `ot.policy.roundMethod.${upper(doc.roundMethod || 'CEIL').toLowerCase()}`,

    graceAfterShiftEndMinutes: Number(doc.graceAfterShiftEndMinutes || 0),

    allowApprovedOtWithoutExactClockOut:
      doc.allowApprovedOtWithoutExactClockOut === true,

    allowPreShiftOT: doc.allowPreShiftOT === true,
    allowPostShiftOT: doc.allowPostShiftOT !== false,
    capByRequestedMinutes: doc.capByRequestedMinutes !== false,
    treatForgetScanInAsPending: doc.treatForgetScanInAsPending !== false,
    treatForgetScanOutAsPending: doc.treatForgetScanOutAsPending !== false,

    isActive: doc.isActive !== false,
    statusCode: doc.isActive !== false ? 'ACTIVE' : 'INACTIVE',
    statusKey:
      doc.isActive !== false ? 'common.status.active' : 'common.status.inactive',
    statusSeverity: doc.isActive !== false ? 'success' : 'danger',

    createdBy: id(doc.createdBy) || null,
    updatedBy: id(doc.updatedBy) || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapPolicy(doc)

  return {
    id: item.id,
    _id: item._id,

    code: item.code,
    name: item.name,
    label: item.label,

    minEligibleMinutes: item.minEligibleMinutes,
    roundUnitMinutes: item.roundUnitMinutes,
    roundMethod: item.roundMethod,
    roundMethodKey: item.roundMethodKey,
    graceAfterShiftEndMinutes: item.graceAfterShiftEndMinutes,

    allowApprovedOtWithoutExactClockOut:
      item.allowApprovedOtWithoutExactClockOut,

    allowPreShiftOT: item.allowPreShiftOT,
    allowPostShiftOT: item.allowPostShiftOT,
    capByRequestedMinutes: item.capByRequestedMinutes,
    treatForgetScanInAsPending: item.treatForgetScanInAsPending,
    treatForgetScanOutAsPending: item.treatForgetScanOutAsPending,

    isActive: item.isActive,
  }
}

async function ensureObjectId(value, field = 'id') {
  if (!isObjectId(value)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid id',
      field,
      params: { value },
    })
  }
}

async function ensureUniqueCode(code, excludeId = null) {
  const normalizedCode = upper(code)

  const filter = {
    code: normalizedCode,
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await OTCalculationPolicy.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'OT_POLICY_CODE_EXISTS',
      messageKey: 'ot.policy.error.codeExists',
      message: 'OT calculation policy code already exists',
      field: 'code',
      params: {
        code: normalizedCode,
      },
    })
  }
}

async function lookupOTCalculationPolicies(query = {}) {
  const limit = Number(query.limit || 50)
  const filter = buildFilter(query)

  const items = await OTCalculationPolicy.find(filter)
    .sort({ name: 1, code: 1, _id: 1 })
    .limit(limit)
    .lean()

  return {
    items: items.map(mapLookupItem),
    meta: {
      limit,
      count: items.length,
    },
  }
}

async function list(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    OTCalculationPolicy.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    OTCalculationPolicy.countDocuments(filter),
  ])

  return {
    items: items.map(mapPolicy),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function getById(policyId) {
  await ensureObjectId(policyId, 'policyId')

  const doc = await OTCalculationPolicy.findById(policyId).lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'OT_POLICY_NOT_FOUND',
      messageKey: 'ot.policy.error.notFound',
      message: 'OT calculation policy not found',
      field: 'policyId',
    })
  }

  return mapPolicy(doc)
}

async function create(payload, authUser) {
  const code = upper(payload.code)

  await ensureUniqueCode(code)

  try {
    const doc = await OTCalculationPolicy.create({
      code,
      name: s(payload.name),
      description: s(payload.description),

      minEligibleMinutes: Number(payload.minEligibleMinutes || 0),
      roundUnitMinutes: Number(payload.roundUnitMinutes || 30),
      roundMethod: upper(payload.roundMethod || 'CEIL'),
      graceAfterShiftEndMinutes: Number(payload.graceAfterShiftEndMinutes || 0),

      allowApprovedOtWithoutExactClockOut:
        payload.allowApprovedOtWithoutExactClockOut === true,

      allowPreShiftOT: payload.allowPreShiftOT === true,
      allowPostShiftOT: payload.allowPostShiftOT !== false,
      capByRequestedMinutes: payload.capByRequestedMinutes !== false,
      treatForgetScanInAsPending: payload.treatForgetScanInAsPending !== false,
      treatForgetScanOutAsPending: payload.treatForgetScanOutAsPending !== false,

      isActive: payload.isActive !== false,
      createdBy: actorAccountId(authUser),
      updatedBy: actorAccountId(authUser),
    })

    return getById(doc._id)
  } catch (error) {
    if (error?.code === 11000) {
      throw appError({
        statusCode: 409,
        code: 'OT_POLICY_CODE_EXISTS',
        messageKey: 'ot.policy.error.codeExists',
        message: 'OT calculation policy code already exists',
        field: 'code',
      })
    }

    throw error
  }
}

async function update(policyId, payload, authUser) {
  await ensureObjectId(policyId, 'policyId')

  const doc = await OTCalculationPolicy.findById(policyId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'OT_POLICY_NOT_FOUND',
      messageKey: 'ot.policy.error.notFound',
      message: 'OT calculation policy not found',
      field: 'policyId',
    })
  }

  if (payload.code !== undefined) {
    const nextCode = upper(payload.code)

    if (nextCode !== doc.code) {
      await ensureUniqueCode(nextCode, doc._id)
    }

    doc.code = nextCode
  }

  if (payload.name !== undefined) {
    doc.name = s(payload.name)
  }

  if (payload.description !== undefined) {
    doc.description = s(payload.description)
  }

  if (payload.minEligibleMinutes !== undefined) {
    doc.minEligibleMinutes = Number(payload.minEligibleMinutes || 0)
  }

  if (payload.roundUnitMinutes !== undefined) {
    doc.roundUnitMinutes = Number(payload.roundUnitMinutes || 30)
  }

  if (payload.roundMethod !== undefined) {
    doc.roundMethod = upper(payload.roundMethod || 'CEIL')
  }

  if (payload.graceAfterShiftEndMinutes !== undefined) {
    doc.graceAfterShiftEndMinutes = Number(payload.graceAfterShiftEndMinutes || 0)
  }

  if (payload.allowApprovedOtWithoutExactClockOut !== undefined) {
    doc.allowApprovedOtWithoutExactClockOut =
      payload.allowApprovedOtWithoutExactClockOut === true
  }

  if (payload.allowPreShiftOT !== undefined) {
    doc.allowPreShiftOT = payload.allowPreShiftOT === true
  }

  if (payload.allowPostShiftOT !== undefined) {
    doc.allowPostShiftOT = payload.allowPostShiftOT !== false
  }

  if (payload.capByRequestedMinutes !== undefined) {
    doc.capByRequestedMinutes = payload.capByRequestedMinutes !== false
  }

  if (payload.treatForgetScanInAsPending !== undefined) {
    doc.treatForgetScanInAsPending = payload.treatForgetScanInAsPending !== false
  }

  if (payload.treatForgetScanOutAsPending !== undefined) {
    doc.treatForgetScanOutAsPending = payload.treatForgetScanOutAsPending !== false
  }

  if (payload.isActive !== undefined) {
    doc.isActive = payload.isActive !== false
  }

  doc.updatedBy = actorAccountId(authUser)

  try {
    await doc.save()
    return getById(doc._id)
  } catch (error) {
    if (error?.code === 11000) {
      throw appError({
        statusCode: 409,
        code: 'OT_POLICY_CODE_EXISTS',
        messageKey: 'ot.policy.error.codeExists',
        message: 'OT calculation policy code already exists',
        field: 'code',
      })
    }

    throw error
  }
}

module.exports = {
  lookupOTCalculationPolicies,
  list,
  getById,
  create,
  update,

  // Used later by OT Request / Attendance / Payment.
  mapPolicy,
  mapLookupItem,
}