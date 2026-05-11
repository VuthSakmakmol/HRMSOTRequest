// backend/src/modules/payment/services/paymentFormula.service.js

const mongoose = require('mongoose')

const PaymentFormula = require('../models/PaymentFormula.model')
const {
  formatDateTimeToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400, messageKey = '') {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.messageKey = messageKey
  return error
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isValidObjectId(value) {
  return Boolean(s(value)) && mongoose.isValidObjectId(s(value))
}

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function normalizeLimit(value) {
  const limit = Number(value || 10)
  if (!Number.isFinite(limit)) return 10
  return Math.min(Math.max(Math.floor(limit), 1), 200)
}

function normalizeFormulaPayload(payload = {}) {
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

  if (Object.prototype.hasOwnProperty.call(data, 'salaryBasis')) {
    data.salaryBasis = upper(data.salaryBasis || 'MONTHLY_SALARY')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'currency')) {
    data.currency = upper(data.currency || 'USD')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'multipliers')) {
    data.multipliers = {
      ...(data.multipliers || {}),
    }
  }

  return data
}

function buildSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return null

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { code: regex },
      { name: regex },
      { description: regex },
      { currency: regex },
      { salaryBasis: regex },
    ],
  }
}

function buildFormulaFilter(query = {}) {
  const filter = {}

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  const searchFilter = buildSearchFilter(query.search)

  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildFormulaSort(query = {}) {
  const direction = query.sortOrder === 'asc' ? 1 : -1

  const sortField =
    {
      code: 'code',
      name: 'name',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      monthlyWorkingDays: 'monthlyWorkingDays',
      hoursPerDay: 'hoursPerDay',
      roundingDecimals: 'roundingDecimals',
      currency: 'currency',
      isActive: 'isActive',
    }[query.sortBy] || 'createdAt'

  return {
    [sortField]: direction,
    code: 1,
    _id: -1,
  }
}

function mapFormulaItem(doc = {}) {
  return {
    id: doc._id ? String(doc._id) : null,

    code: upper(doc.code),
    name: s(doc.name),
    description: s(doc.description),

    salaryBasis: upper(doc.salaryBasis || 'MONTHLY_SALARY'),

    monthlyWorkingDays: Number(doc.monthlyWorkingDays || 0),
    hoursPerDay: Number(doc.hoursPerDay || 0),

    multipliers: {
      WORKING_DAY: Number(doc.multipliers?.WORKING_DAY || 0),
      SUNDAY: Number(doc.multipliers?.SUNDAY || 0),
      HOLIDAY: Number(doc.multipliers?.HOLIDAY || 0),
    },

    roundingDecimals: Number(doc.roundingDecimals || 0),
    currency: upper(doc.currency || 'USD'),

    isActive: doc.isActive === true,

    createdBy: s(doc.createdBy),
    updatedBy: s(doc.updatedBy),

    createdAt: doc.createdAt || null,
    createdAtDisplay: formatDateTimeToDmy(doc.createdAt),
    createdAtDisplayHm: formatDateTimeToDmyHm(doc.createdAt),

    updatedAt: doc.updatedAt || null,
    updatedAtDisplay: formatDateTimeToDmy(doc.updatedAt),
    updatedAtDisplayHm: formatDateTimeToDmyHm(doc.updatedAt),
  }
}

function mapFormulaLookupItem(doc = {}) {
  const item = mapFormulaItem(doc)

  return {
    id: item.id,
    _id: item.id,

    code: item.code,
    name: item.name,
    label: `${item.code} - ${item.name}`,

    salaryBasis: item.salaryBasis,
    monthlyWorkingDays: item.monthlyWorkingDays,
    hoursPerDay: item.hoursPerDay,
    multipliers: item.multipliers,
    roundingDecimals: item.roundingDecimals,
    currency: item.currency,
    isActive: item.isActive,
  }
}

async function ensureFormulaCodeAvailable(code, excludeId = null) {
  const normalizedCode = upper(code)

  if (!normalizedCode) {
    throw createHttpError(
      'Payment formula code is required',
      400,
      'payment.formula.code_required',
    )
  }

  const filter = {
    code: normalizedCode,
  }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await PaymentFormula.findOne(filter).select({ _id: 1 }).lean()

  if (existing) {
    throw createHttpError(
      'Payment formula code already exists',
      409,
      'payment.formula.code_already_exists',
    )
  }
}

async function listPaymentFormulas(query = {}) {
  const page = normalizePage(query.page)
  const limit = normalizeLimit(query.limit)
  const skip = (page - 1) * limit

  const filter = buildFormulaFilter(query)
  const sort = buildFormulaSort(query)

  const [items, total] = await Promise.all([
    PaymentFormula.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    PaymentFormula.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    items: items.map(mapFormulaItem),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

async function lookupPaymentFormulas(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100)

  const filter = buildFormulaFilter({
    ...query,
    isActive: typeof query.isActive === 'boolean' ? query.isActive : true,
  })

  const items = await PaymentFormula.find(filter)
    .sort({
      name: 1,
      code: 1,
      _id: 1,
    })
    .limit(limit)
    .lean()

  return {
    items: items.map(mapFormulaLookupItem),
  }
}

async function getPaymentFormulaById(id) {
  if (!isValidObjectId(id)) {
    throw createHttpError(
      'Invalid payment formula id',
      400,
      'payment.formula.invalid_id',
    )
  }

  const doc = await PaymentFormula.findById(id).lean()

  if (!doc) {
    throw createHttpError(
      'Payment formula not found',
      404,
      'payment.formula.not_found',
    )
  }

  return mapFormulaItem(doc)
}

async function createPaymentFormula(payload = {}, actor = '') {
  const data = normalizeFormulaPayload(payload)

  await ensureFormulaCodeAvailable(data.code)

  const doc = await PaymentFormula.create({
    ...data,
    createdBy: s(actor),
    updatedBy: s(actor),
  })

  return mapFormulaItem(doc.toObject())
}

async function updatePaymentFormula(id, payload = {}, actor = '') {
  if (!isValidObjectId(id)) {
    throw createHttpError(
      'Invalid payment formula id',
      400,
      'payment.formula.invalid_id',
    )
  }

  const data = normalizeFormulaPayload(payload)

  if (Object.prototype.hasOwnProperty.call(data, 'code')) {
    await ensureFormulaCodeAvailable(data.code, id)
  }

  data.updatedBy = s(actor)

  const doc = await PaymentFormula.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).lean()

  if (!doc) {
    throw createHttpError(
      'Payment formula not found',
      404,
      'payment.formula.not_found',
    )
  }

  return mapFormulaItem(doc)
}

module.exports = {
  listPaymentFormulas,
  lookupPaymentFormulas,
  getPaymentFormulaById,
  createPaymentFormula,
  updatePaymentFormula,

  mapFormulaItem,
  mapFormulaLookupItem,
}