// backend/src/modules/payment/services/paymentFormula.service.js

const PaymentFormula = require('../models/PaymentFormula.model')

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

function normalizeText(value) {
  return String(value || '').trim()
}

function buildSearchFilter(search) {
  const keyword = normalizeText(search)

  if (!keyword) return {}

  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  return {
    $or: [{ code: regex }, { name: regex }, { description: regex }],
  }
}

async function listPaymentFormulas(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = {
    ...buildSearchFilter(query.search),
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  const allowedSort = new Set([
    'code',
    'name',
    'createdAt',
    'updatedAt',
    'monthlyWorkingDays',
    'hoursPerDay',
  ])

  const sortBy = allowedSort.has(query.sortBy) ? query.sortBy : 'createdAt'
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1

  const [items, total] = await Promise.all([
    PaymentFormula.find(filter)
      .sort({ [sortBy]: sortOrder, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PaymentFormula.countDocuments(filter),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasMore: page * limit < total,
    },
  }
}

async function lookupPaymentFormulas(query = {}) {
  const filter = {
    ...buildSearchFilter(query.search),
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  const limit = Number(query.limit || 50)

  const items = await PaymentFormula.find(filter)
    .sort({ name: 1, code: 1 })
    .limit(limit)
    .select('_id code name monthlyWorkingDays hoursPerDay multipliers roundingDecimals currency isActive')
    .lean()

  return {
    items: items.map((item) => ({
      id: item._id,
      _id: item._id,
      code: item.code,
      name: item.name,
      label: `${item.code} - ${item.name}`,
      monthlyWorkingDays: item.monthlyWorkingDays,
      hoursPerDay: item.hoursPerDay,
      multipliers: item.multipliers,
      roundingDecimals: item.roundingDecimals,
      currency: item.currency,
      isActive: item.isActive,
    })),
  }
}

async function createPaymentFormula(payload = {}, actor = '') {
  const code = normalizeCode(payload.code)

  const existing = await PaymentFormula.findOne({ code }).lean()
  if (existing) {
    const error = new Error('Payment formula code already exists')
    error.statusCode = 409
    throw error
  }

  const doc = await PaymentFormula.create({
    ...payload,
    code,
    name: normalizeText(payload.name),
    description: normalizeText(payload.description),
    currency: normalizeCode(payload.currency || 'USD'),
    createdBy: actor,
    updatedBy: actor,
  })

  return doc.toObject()
}

async function updatePaymentFormula(id, payload = {}, actor = '') {
  const update = { ...payload }

  if (Object.prototype.hasOwnProperty.call(update, 'code')) {
    update.code = normalizeCode(update.code)

    const existing = await PaymentFormula.findOne({
      _id: { $ne: id },
      code: update.code,
    }).lean()

    if (existing) {
      const error = new Error('Payment formula code already exists')
      error.statusCode = 409
      throw error
    }
  }

  if (Object.prototype.hasOwnProperty.call(update, 'name')) {
    update.name = normalizeText(update.name)
  }

  if (Object.prototype.hasOwnProperty.call(update, 'description')) {
    update.description = normalizeText(update.description)
  }

  if (Object.prototype.hasOwnProperty.call(update, 'currency')) {
    update.currency = normalizeCode(update.currency || 'USD')
  }

  update.updatedBy = actor

  const doc = await PaymentFormula.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean()

  if (!doc) {
    const error = new Error('Payment formula not found')
    error.statusCode = 404
    throw error
  }

  return doc
}

async function getPaymentFormulaById(id) {
  const doc = await PaymentFormula.findById(id).lean()

  if (!doc) {
    const error = new Error('Payment formula not found')
    error.statusCode = 404
    throw error
  }

  return doc
}

module.exports = {
  listPaymentFormulas,
  lookupPaymentFormulas,
  createPaymentFormula,
  updatePaymentFormula,
  getPaymentFormulaById,
}