// backend/src/modules/payment/controllers/paymentExchangeRate.controller.js

const {
  paymentExchangeRateIdParamSchema,
  listPaymentExchangeRateQuerySchema,
  lookupPaymentExchangeRateQuerySchema,
  createPaymentExchangeRateSchema,
  updatePaymentExchangeRateSchema,
} = require('../validations/paymentExchangeRate.validation')

const paymentExchangeRateService = require('../services/paymentExchangeRate.service')

function parse(schema, data) {
  const result = schema.safeParse(data || {})

  if (!result.success) {
    const message = result.error.issues?.[0]?.message || 'Invalid request'
    const error = new Error(message)
    error.status = 400
    error.statusCode = 400
    throw error
  }

  return result.data
}

function getActor(req) {
  return (
    req.user?.loginId ||
    req.user?.username ||
    req.user?.employeeNo ||
    req.user?.email ||
    req.user?.accountId ||
    req.user?._id ||
    ''
  )
}

async function listPaymentExchangeRates(req, res, next) {
  try {
    const query = parse(listPaymentExchangeRateQuerySchema, req.query || {})
    const data = await paymentExchangeRateService.listPaymentExchangeRates(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function lookupPaymentExchangeRates(req, res, next) {
  try {
    const query = parse(lookupPaymentExchangeRateQuerySchema, req.query || {})
    const data = await paymentExchangeRateService.lookupPaymentExchangeRates(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getPaymentExchangeRateById(req, res, next) {
  try {
    const params = parse(paymentExchangeRateIdParamSchema, req.params || {})
    const item = await paymentExchangeRateService.getPaymentExchangeRateById(params.id)

    res.json({
      success: true,
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function createPaymentExchangeRate(req, res, next) {
  try {
    const payload = parse(createPaymentExchangeRateSchema, req.body || {})
    const item = await paymentExchangeRateService.createPaymentExchangeRate(payload, getActor(req))

    res.status(201).json({
      success: true,
      message: 'Payment exchange rate created successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function updatePaymentExchangeRate(req, res, next) {
  try {
    const params = parse(paymentExchangeRateIdParamSchema, req.params || {})
    const payload = parse(updatePaymentExchangeRateSchema, req.body || {})

    const item = await paymentExchangeRateService.updatePaymentExchangeRate(
      params.id,
      payload,
      getActor(req),
    )

    res.json({
      success: true,
      message: 'Payment exchange rate updated successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listPaymentExchangeRates,
  lookupPaymentExchangeRates,
  getPaymentExchangeRateById,
  createPaymentExchangeRate,
  updatePaymentExchangeRate,
}