// backend/src/modules/payment/services/paymentExchangeRate.service.js

const PaymentExchangeRate = require('../models/PaymentExchangeRate.model')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function escapeRegex(value) {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createHttpError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
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

function mapPaymentExchangeRate(item) {
  if (!item) return null

  const obj = item.toObject ? item.toObject() : item

  return {
    id: String(obj._id),
    _id: String(obj._id),

    code: obj.code,
    name: obj.name,
    description: obj.description || '',

    fromCurrency: obj.fromCurrency,
    toCurrency: obj.toCurrency,
    rate: obj.rate,

    roundingUnit: obj.roundingUnit,
    roundingMode: obj.roundingMode,
    denominations: Array.isArray(obj.denominations) ? obj.denominations : [],

    isActive: Boolean(obj.isActive),

    createdBy: obj.createdBy || '',
    updatedBy: obj.updatedBy || '',
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  }
}

function mapLookupItem(item) {
  const mapped = mapPaymentExchangeRate(item)

  if (!mapped) return null

  return {
    id: mapped.id,
    _id: mapped._id,
    code: mapped.code,
    name: mapped.name,
    label: `${mapped.code} - ${mapped.name}`,
    description: `${mapped.fromCurrency} 1 = ${mapped.rate} ${mapped.toCurrency}`,
    fromCurrency: mapped.fromCurrency,
    toCurrency: mapped.toCurrency,
    rate: mapped.rate,
    roundingUnit: mapped.roundingUnit,
    roundingMode: mapped.roundingMode,
    denominations: mapped.denominations,
    isActive: mapped.isActive,
  }
}

function buildFilter(query = {}) {
  const filter = {}

  if (query.isActive !== undefined) {
    filter.isActive = Boolean(query.isActive)
  }

  const search = s(query.search)

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i')

    filter.$or = [
      { code: regex },
      { name: regex },
      { description: regex },
      { fromCurrency: regex },
      { toCurrency: regex },
    ]
  }

  return filter
}

function buildSort(query = {}) {
  const allowedFields = new Set([
    'code',
    'name',
    'rate',
    'fromCurrency',
    'toCurrency',
    'isActive',
    'createdAt',
    'updatedAt',
  ])

  const sortField = allowedFields.has(query.sortField) ? query.sortField : 'createdAt'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1

  return {
    [sortField]: sortOrder,
    _id: -1,
  }
}

async function assertCodeAvailable(code, excludeId = null) {
  const normalizedCode = upper(code)

  if (!normalizedCode) {
    throw createHttpError('Code is required', 400)
  }

  const filter = { code: normalizedCode }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await PaymentExchangeRate.exists(filter)

  if (existing) {
    throw createHttpError('Exchange rate code already exists', 409)
  }
}

async function listPaymentExchangeRates(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query)

  const [total, items] = await Promise.all([
    PaymentExchangeRate.countDocuments(filter),
    PaymentExchangeRate.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ])

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0

  return {
    items: items.map(mapPaymentExchangeRate),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

async function lookupPaymentExchangeRates(query = {}) {
  const filter = buildFilter(query)
  const limit = Number(query.limit || 50)

  const items = await PaymentExchangeRate.find(filter)
    .sort({ name: 1, code: 1 })
    .limit(limit)
    .lean()

  return {
    items: items.map(mapLookupItem),
  }
}

async function getPaymentExchangeRateById(id) {
  const item = await PaymentExchangeRate.findById(id).lean()

  if (!item) {
    throw createHttpError('Payment exchange rate not found', 404)
  }

  return mapPaymentExchangeRate(item)
}

async function getActivePaymentExchangeRateForCalculation(id) {
  const item = await PaymentExchangeRate.findById(id).lean()

  if (!item) {
    throw createHttpError('Payment exchange rate not found', 404)
  }

  if (!item.isActive) {
    throw createHttpError('Payment exchange rate is inactive', 400)
  }

  return mapPaymentExchangeRate(item)
}

async function createPaymentExchangeRate(payload = {}, actor = {}) {
  await assertCodeAvailable(payload.code)

  const actorLabel = s(normalizeActor(actor))

  const doc = await PaymentExchangeRate.create({
    ...payload,
    createdBy: actorLabel,
    updatedBy: actorLabel,
  })

  return mapPaymentExchangeRate(doc)
}

async function updatePaymentExchangeRate(id, payload = {}, actor = {}) {
  const existing = await PaymentExchangeRate.findById(id)

  if (!existing) {
    throw createHttpError('Payment exchange rate not found', 404)
  }

  if (payload.code !== undefined && upper(payload.code) !== existing.code) {
    await assertCodeAvailable(payload.code, id)
  }

  Object.entries(payload).forEach(([key, value]) => {
    existing[key] = value
  })

  existing.updatedBy = s(normalizeActor(actor))

  await existing.save()

  return mapPaymentExchangeRate(existing)
}

module.exports = {
  listPaymentExchangeRates,
  lookupPaymentExchangeRates,
  getPaymentExchangeRateById,
  getActivePaymentExchangeRateForCalculation,
  createPaymentExchangeRate,
  updatePaymentExchangeRate,
}