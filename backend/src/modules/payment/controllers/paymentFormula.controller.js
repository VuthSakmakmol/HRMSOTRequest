// backend/src/modules/payment/controllers/paymentFormula.controller.js

const {
  listPaymentFormulaQuerySchema,
  lookupPaymentFormulaQuerySchema,
  createPaymentFormulaSchema,
  updatePaymentFormulaSchema,
  paymentFormulaIdParamSchema,
} = require('../validations/paymentFormula.validation')

const paymentFormulaService = require('../services/paymentFormula.service')

function parse(schema, data) {
  const result = schema.safeParse(data)

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

async function listPaymentFormulas(req, res, next) {
  try {
    const query = parse(listPaymentFormulaQuerySchema, req.query || {})
    const data = await paymentFormulaService.listPaymentFormulas(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function lookupPaymentFormulas(req, res, next) {
  try {
    const query = parse(lookupPaymentFormulaQuerySchema, req.query || {})
    const data = await paymentFormulaService.lookupPaymentFormulas(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getPaymentFormulaById(req, res, next) {
  try {
    const params = parse(paymentFormulaIdParamSchema, req.params || {})
    const item = await paymentFormulaService.getPaymentFormulaById(params.id)

    res.json({
      success: true,
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function createPaymentFormula(req, res, next) {
  try {
    const payload = parse(createPaymentFormulaSchema, req.body || {})
    const item = await paymentFormulaService.createPaymentFormula(payload, getActor(req))

    res.status(201).json({
      success: true,
      message: 'Payment formula created successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function updatePaymentFormula(req, res, next) {
  try {
    const params = parse(paymentFormulaIdParamSchema, req.params || {})
    const payload = parse(updatePaymentFormulaSchema, req.body || {})

    const item = await paymentFormulaService.updatePaymentFormula(
      params.id,
      payload,
      getActor(req),
    )

    res.json({
      success: true,
      message: 'Payment formula updated successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listPaymentFormulas,
  lookupPaymentFormulas,
  getPaymentFormulaById,
  createPaymentFormula,
  updatePaymentFormula,
}