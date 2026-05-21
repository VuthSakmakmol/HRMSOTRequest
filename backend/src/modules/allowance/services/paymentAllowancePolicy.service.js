// backend/src/modules/payment/services/paymentAllowancePolicy.service.js

const mongoose = require('mongoose')

const PaymentAllowancePolicy = require('../models/PaymentAllowancePolicy.model')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function escapeRegex(value) {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createHttpError(message, status = 400, messageKey = '') {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.messageKey = messageKey
  return error
}

function normalizeActor(actor) {
  return (
    actor?.loginId ||
    actor?.username ||
    actor?.employeeNo ||
    actor?.email ||
    actor?.accountId ||
    actor?._id ||
    s(actor)
  )
}

function isValidObjectId(value) {
  return Boolean(s(value)) && mongoose.isValidObjectId(s(value))
}

function normalizePayload(payload = {}) {
  const data = { ...payload }

  if (Object.prototype.hasOwnProperty.call(data, 'code')) {
    data.code = upper(data.code)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    data.name = s(data.name)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    data.description = s(data.description)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'allowanceType')) {
    data.allowanceType = upper(data.allowanceType || 'FOOD')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'triggerType')) {
    data.triggerType = upper(data.triggerType || 'OT_MINUTES')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'currency')) {
    data.currency = upper(data.currency || 'KHR')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'applyPer')) {
    data.applyPer = upper(data.applyPer || 'EMPLOYEE_PER_DAY')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'effectiveFrom')) {
    data.effectiveFrom = s(data.effectiveFrom)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'effectiveTo')) {
    data.effectiveTo = s(data.effectiveTo)
  }

  return data
}

function mapPaymentAllowancePolicy(item) {
  if (!item) return null

  const obj = item.toObject ? item.toObject() : item

  return {
    id: obj._id ? String(obj._id) : '',
    _id: obj._id ? String(obj._id) : '',

    code: upper(obj.code),
    name: s(obj.name),
    description: s(obj.description),

    allowanceType: upper(obj.allowanceType || 'FOOD'),
    triggerType: upper(obj.triggerType || 'OT_MINUTES'),

    minOtMinutes: Number(obj.minOtMinutes || 0),
    minOtHours: Number(obj.minOtMinutes || 0) / 60,

    amount: Number(obj.amount || 0),
    currency: upper(obj.currency || 'KHR'),

    applyPer: upper(obj.applyPer || 'EMPLOYEE_PER_DAY'),

    effectiveFrom: s(obj.effectiveFrom),
    effectiveTo: s(obj.effectiveTo),

    isActive: obj.isActive === true,

    createdBy: s(obj.createdBy),
    updatedBy: s(obj.updatedBy),
    createdAt: obj.createdAt || null,
    updatedAt: obj.updatedAt || null,
  }
}

function mapLookupItem(item) {
  const mapped = mapPaymentAllowancePolicy(item)

  if (!mapped) return null

  return {
    id: mapped.id,
    _id: mapped._id,
    code: mapped.code,
    name: mapped.name,
    label: `${mapped.code} - ${mapped.name}`,
    description: `${mapped.allowanceType} · OT >= ${mapped.minOtMinutes} min · ${mapped.amount} ${mapped.currency}`,
    allowanceType: mapped.allowanceType,
    triggerType: mapped.triggerType,
    minOtMinutes: mapped.minOtMinutes,
    amount: mapped.amount,
    currency: mapped.currency,
    applyPer: mapped.applyPer,
    isActive: mapped.isActive,
  }
}

function buildFilter(query = {}) {
  const filter = {}

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  const allowanceType = upper(query.allowanceType)

  if (allowanceType) {
    filter.allowanceType = allowanceType
  }

  const triggerType = upper(query.triggerType)

  if (triggerType) {
    filter.triggerType = triggerType
  }

  const search = s(query.search)

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i')

    filter.$or = [
      { code: regex },
      { name: regex },
      { description: regex },
      { allowanceType: regex },
      { triggerType: regex },
      { currency: regex },
      { applyPer: regex },
    ]
  }

  return filter
}

function buildSort(query = {}) {
  const allowedFields = new Set([
    'code',
    'name',
    'allowanceType',
    'triggerType',
    'minOtMinutes',
    'amount',
    'currency',
    'applyPer',
    'effectiveFrom',
    'effectiveTo',
    'isActive',
    'createdAt',
    'updatedAt',
  ])

  const sortField = allowedFields.has(query.sortField)
    ? query.sortField
    : 'createdAt'

  const sortOrder = query.sortOrder === 'asc' ? 1 : -1

  return {
    [sortField]: sortOrder,
    _id: -1,
  }
}

async function ensureCodeAvailable(code, excludeId = null) {
  const normalizedCode = upper(code)

  if (!normalizedCode) {
    throw createHttpError(
      'Allowance policy code is required',
      400,
      'payment.allowancePolicy.error.codeRequired',
    )
  }

  const filter = {
    code: normalizedCode,
  }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await PaymentAllowancePolicy.exists(filter)

  if (existing) {
    throw createHttpError(
      'Allowance policy code already exists',
      409,
      'payment.allowancePolicy.error.codeExists',
    )
  }
}

async function listPaymentAllowancePolicies(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query)

  const [total, items] = await Promise.all([
    PaymentAllowancePolicy.countDocuments(filter),
    PaymentAllowancePolicy.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ])

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0

  return {
    items: items.map(mapPaymentAllowancePolicy),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

async function lookupPaymentAllowancePolicies(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100)

  const filter = buildFilter({
    ...query,
    isActive: typeof query.isActive === 'boolean' ? query.isActive : true,
  })

  const items = await PaymentAllowancePolicy.find(filter)
    .sort({
      allowanceType: 1,
      minOtMinutes: 1,
      code: 1,
      _id: 1,
    })
    .limit(limit)
    .lean()

  return {
    items: items.map(mapLookupItem),
  }
}

async function getPaymentAllowancePolicyById(id) {
  if (!isValidObjectId(id)) {
    throw createHttpError(
      'Invalid allowance policy id',
      400,
      'payment.allowancePolicy.error.invalidId',
    )
  }

  const item = await PaymentAllowancePolicy.findById(id).lean()

  if (!item) {
    throw createHttpError(
      'Allowance policy not found',
      404,
      'payment.allowancePolicy.error.notFound',
    )
  }

  return mapPaymentAllowancePolicy(item)
}

async function createPaymentAllowancePolicy(payload = {}, actor = {}) {
  const data = normalizePayload(payload)

  await ensureCodeAvailable(data.code)

  const actorLabel = s(normalizeActor(actor))

  const doc = await PaymentAllowancePolicy.create({
    ...data,
    createdBy: actorLabel,
    updatedBy: actorLabel,
  })

  return mapPaymentAllowancePolicy(doc)
}

async function updatePaymentAllowancePolicy(id, payload = {}, actor = {}) {
  if (!isValidObjectId(id)) {
    throw createHttpError(
      'Invalid allowance policy id',
      400,
      'payment.allowancePolicy.error.invalidId',
    )
  }

  const existing = await PaymentAllowancePolicy.findById(id)

  if (!existing) {
    throw createHttpError(
      'Allowance policy not found',
      404,
      'payment.allowancePolicy.error.notFound',
    )
  }

  const data = normalizePayload(payload)

  if (
    Object.prototype.hasOwnProperty.call(data, 'code') &&
    upper(data.code) !== upper(existing.code)
  ) {
    await ensureCodeAvailable(data.code, id)
  }

  Object.entries(data).forEach(([key, value]) => {
    existing[key] = value
  })

  existing.updatedBy = s(normalizeActor(actor))

  await existing.save()

  return mapPaymentAllowancePolicy(existing)
}

async function getActiveAllowancePoliciesForCalculation() {
  const items = await PaymentAllowancePolicy.find({
    isActive: true,
  })
    .sort({
      allowanceType: 1,
      minOtMinutes: 1,
      code: 1,
      _id: 1,
    })
    .lean()

  return items.map(mapPaymentAllowancePolicy)
}


module.exports = {
  listPaymentAllowancePolicies,
  lookupPaymentAllowancePolicies,
  getPaymentAllowancePolicyById,
  createPaymentAllowancePolicy,
  updatePaymentAllowancePolicy,
  getActiveAllowancePoliciesForCalculation,

  mapPaymentAllowancePolicy,
  mapLookupItem,
}