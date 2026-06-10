// backend/src/modules/payment/services/paymentFormula.service.js

const mongoose = require('mongoose')

const PaymentFormula = require('../models/PaymentFormula.model')
const {
  formatDateTimeToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')

const DEFAULT_MULTIPLIERS = {
  WORKING_DAY: 1.5,
  SUNDAY: 2,
  HOLIDAY: 3,
}

const DEFAULT_CASH_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]
const CASH_ROUNDING_MODES = ['CEIL', 'FLOOR', 'ROUND', 'NONE']

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

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safePositiveNumber(value, fallback = 1) {
  const num = safeNumber(value, fallback)
  return num > 0 ? num : fallback
}

function normalizeRoundingMode(value, fallback = 'ROUND') {
  const mode = upper(value || fallback)
  return CASH_ROUNDING_MODES.includes(mode) ? mode : fallback
}

function normalizeDenominations(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_CASH_DENOMINATIONS

  const normalized = [
    ...new Set(
      source
        .map((item) => Math.round(safeNumber(item, 0)))
        .filter((item) => item > 0),
    ),
  ].sort((a, b) => b - a)

  return normalized.length ? normalized : DEFAULT_CASH_DENOMINATIONS
}

function normalizeHourRules(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback

  const normalized = source
    .map((item, index) => {
      const minHours = safeNumber(item?.minHours, index === 0 ? 0 : index)
      const rawMaxHours = item?.maxHours
      const maxHours =
        rawMaxHours === null || rawMaxHours === undefined || rawMaxHours === ''
          ? null
          : safeNumber(rawMaxHours, 0)

      return {
        label: s(item?.label).slice(0, 120),
        minHours: Math.max(0, minHours),
        maxHours: maxHours !== null && maxHours > minHours ? maxHours : null,
        multiplier: Math.max(0, safeNumber(item?.multiplier, 1)),
        allowanceEligible: item?.allowanceEligible === true,
      }
    })
    .filter((item) => Number.isFinite(item.minHours) && Number.isFinite(item.multiplier))
    .sort((a, b) => a.minHours - b.minHours)

  return normalized
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

  if (Object.prototype.hasOwnProperty.call(data, 'payoutCurrency')) {
    data.payoutCurrency = upper(data.payoutCurrency || 'KHR')
  }

  if (Object.prototype.hasOwnProperty.call(data, 'cashRoundingUnit')) {
    data.cashRoundingUnit = Math.round(safePositiveNumber(data.cashRoundingUnit, 100))
  }

  if (Object.prototype.hasOwnProperty.call(data, 'cashRoundingMode')) {
    data.cashRoundingMode = normalizeRoundingMode(data.cashRoundingMode)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'cashDenominations')) {
    data.cashDenominations = normalizeDenominations(data.cashDenominations)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'multipliers')) {
    data.multipliers = {
      ...(data.multipliers || {}),
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'hourRules')) {
    data.hourRules = normalizeHourRules(data.hourRules)
  }

  return data
}

function normalizeMultipliers(value = {}) {
  return {
    WORKING_DAY: safeNumber(value.WORKING_DAY, DEFAULT_MULTIPLIERS.WORKING_DAY),
    SUNDAY: safeNumber(value.SUNDAY, DEFAULT_MULTIPLIERS.SUNDAY),
    HOLIDAY: safeNumber(value.HOLIDAY, DEFAULT_MULTIPLIERS.HOLIDAY),
  }
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
      { payoutCurrency: regex },
      { salaryBasis: regex },
      { cashRoundingMode: regex },
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
      payoutCurrency: 'payoutCurrency',
      cashRoundingUnit: 'cashRoundingUnit',
      cashRoundingMode: 'cashRoundingMode',
      isActive: 'isActive',
    }[query.sortBy] || 'createdAt'

  return {
    [sortField]: direction,
    code: 1,
    _id: -1,
  }
}

function mapFormulaItem(doc = {}) {
  const multipliers = normalizeMultipliers(doc.multipliers || {})
  const cashDenominations = normalizeDenominations(doc.cashDenominations)

  return {
    id: doc._id ? String(doc._id) : null,

    code: upper(doc.code),
    name: s(doc.name),
    description: s(doc.description),

    salaryBasis: upper(doc.salaryBasis || 'MONTHLY_SALARY'),

    monthlyWorkingDays: safeNumber(doc.monthlyWorkingDays, 26),
    hoursPerDay: safeNumber(doc.hoursPerDay, 8),

    multipliers,
    hourRules: normalizeHourRules(doc.hourRules),

    roundingDecimals: safeNumber(doc.roundingDecimals, 2),
    currency: upper(doc.currency || 'USD'),

    payoutCurrency: upper(doc.payoutCurrency || 'KHR'),
    cashRoundingUnit: Math.round(safePositiveNumber(doc.cashRoundingUnit, 100)),
    cashRoundingMode: normalizeRoundingMode(doc.cashRoundingMode),
    cashDenominations,

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
    hourRules: item.hourRules,
    roundingDecimals: item.roundingDecimals,
    currency: item.currency,

    payoutCurrency: item.payoutCurrency,
    cashRoundingUnit: item.cashRoundingUnit,
    cashRoundingMode: item.cashRoundingMode,
    cashDenominations: item.cashDenominations,

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

  if (Object.prototype.hasOwnProperty.call(data, 'multipliers')) {
    const existing = await PaymentFormula.findById(id).select({ multipliers: 1 }).lean()

    if (!existing) {
      throw createHttpError(
        'Payment formula not found',
        404,
        'payment.formula.not_found',
      )
    }

    data.multipliers = normalizeMultipliers({
      ...(existing.multipliers || DEFAULT_MULTIPLIERS),
      ...(data.multipliers || {}),
    })
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