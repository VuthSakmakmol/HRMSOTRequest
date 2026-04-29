// backend/src/modules/ot/services/otPolicy.service.js
const OTCalculationPolicy = require('../models/OTCalculationPolicy')
const {
  objectIdSchema,
  createOTCalculationPolicySchema,
  updateOTCalculationPolicySchema,
  listOTCalculationPoliciesQuerySchema,
  lookupOTCalculationPoliciesQuerySchema,
} = require('../validators/otPolicy.validation')

function s(value) {
  return String(value ?? '').trim()
}

function createHttpError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

function parseSchema(schema, data) {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error?.name === 'ZodError') {
      throw createHttpError(error.issues?.[0]?.message || 'Validation error', 400)
    }

    throw error
  }
}

function escapeRegex(value) {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildListQuery(query = {}) {
  const filter = {}

  const search = s(query.search)
  if (search) {
    const keyword = escapeRegex(search)

    filter.$or = [
      { code: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
    ]
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = Boolean(query.isActive)
  }

  if (query.roundMethod) {
    filter.roundMethod = s(query.roundMethod).toUpperCase()
  }

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const direction = Number(sortOrder) === 1 ? 1 : -1

  if (sortField === 'code') return { code: direction, _id: -1 }
  if (sortField === 'name') return { name: direction, _id: -1 }
  if (sortField === 'roundMethod') return { roundMethod: direction, code: 1, _id: -1 }
  if (sortField === 'roundUnitMinutes') return { roundUnitMinutes: direction, code: 1, _id: -1 }
  if (sortField === 'minEligibleMinutes') return { minEligibleMinutes: direction, code: 1, _id: -1 }
  if (sortField === 'graceAfterShiftEndMinutes') {
    return { graceAfterShiftEndMinutes: direction, code: 1, _id: -1 }
  }
  if (sortField === 'isActive') return { isActive: direction, code: 1, _id: -1 }
  if (sortField === 'updatedAt') return { updatedAt: direction, _id: -1 }

  return { createdAt: direction, _id: -1 }
}

function normalizePolicy(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    _id: String(doc._id),

    code: s(doc.code),
    name: s(doc.name),
    description: s(doc.description),

    minEligibleMinutes: Number(doc.minEligibleMinutes || 0),
    roundUnitMinutes: Number(doc.roundUnitMinutes || 0),
    roundMethod: s(doc.roundMethod).toUpperCase(),
    graceAfterShiftEndMinutes: Number(doc.graceAfterShiftEndMinutes || 0),
    allowApprovedOtWithoutExactClockOut:
    doc.allowApprovedOtWithoutExactClockOut === true,

    allowPreShiftOT: doc.allowPreShiftOT === true,
    allowPostShiftOT: doc.allowPostShiftOT !== false,
    capByRequestedMinutes: doc.capByRequestedMinutes !== false,
    treatForgetScanInAsPending: doc.treatForgetScanInAsPending !== false,
    treatForgetScanOutAsPending: doc.treatForgetScanOutAsPending !== false,

    isActive: doc.isActive !== false,

    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function normalizePolicyLookupItem(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    _id: String(doc._id),
    code: s(doc.code),
    name: s(doc.name),
    label: [s(doc.code), s(doc.name)].filter(Boolean).join(' - '),
    roundMethod: s(doc.roundMethod).toUpperCase(),
    roundUnitMinutes: Number(doc.roundUnitMinutes || 0),
    minEligibleMinutes: Number(doc.minEligibleMinutes || 0),
    graceAfterShiftEndMinutes: Number(doc.graceAfterShiftEndMinutes || 0),
      allowApprovedOtWithoutExactClockOut:
    doc.allowApprovedOtWithoutExactClockOut === true,
    isActive: doc.isActive !== false,
  }
}

async function ensureUniqueCode(code, excludeId = null) {
  const filter = {
    code: s(code).toUpperCase(),
  }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await OTCalculationPolicy.findOne(filter).lean()

  if (existing) {
    throw createHttpError('OT calculation policy code already exists', 409)
  }
}

function actorAccountId(authUser) {
  return authUser?.accountId || authUser?._id || null
}

async function lookupOTCalculationPolicies(query = {}) {
  const parsed = parseSchema(lookupOTCalculationPoliciesQuerySchema, query)

  const filter = buildListQuery(parsed)

  const items = await OTCalculationPolicy.find(filter)
    .sort({ name: 1, code: 1, _id: -1 })
    .limit(parsed.limit)
    .lean()

  return {
    items: items.map(normalizePolicyLookupItem),
    meta: {
      limit: parsed.limit,
      count: items.length,
    },
  }
}

async function create(payload, authUser) {
  const data = parseSchema(createOTCalculationPolicySchema, payload)

  await ensureUniqueCode(data.code)

  const doc = await OTCalculationPolicy.create({
    ...data,
    createdBy: actorAccountId(authUser),
    updatedBy: actorAccountId(authUser),
  })

  return normalizePolicy(doc.toObject())
}

async function update(id, payload, authUser) {
  const policyId = parseSchema(objectIdSchema, id)
  const data = parseSchema(updateOTCalculationPolicySchema, payload)

  const doc = await OTCalculationPolicy.findById(policyId)

  if (!doc) {
    throw createHttpError('OT calculation policy not found', 404)
  }

  if (data.code) {
    await ensureUniqueCode(data.code, policyId)
  }

  Object.assign(doc, data)
  doc.updatedBy = actorAccountId(authUser)

  await doc.save()

  return normalizePolicy(doc.toObject())
}

async function list(query = {}) {
  const parsed = parseSchema(listOTCalculationPoliciesQuerySchema, query)

  const page = parsed.page
  const limit = parsed.limit
  const skip = (page - 1) * limit

  const filter = buildListQuery(parsed)
  const sort = buildSort(parsed.sortField, parsed.sortOrder)

  const [items, total] = await Promise.all([
    OTCalculationPolicy.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    OTCalculationPolicy.countDocuments(filter),
  ])

  return {
    ok: true,
    data: {
      items: items.map(normalizePolicy),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
      },
    },
  }
}

async function getById(id) {
  const policyId = parseSchema(objectIdSchema, id)

  const doc = await OTCalculationPolicy.findById(policyId).lean()

  if (!doc) {
    throw createHttpError('OT calculation policy not found', 404)
  }

  return normalizePolicy(doc)
}

module.exports = {
  lookupOTCalculationPolicies,
  create,
  update,
  list,
  getById,
}