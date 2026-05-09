// backend/src/modules/payment/controllers/paymentFormula.controller.js

const {
  listPaymentFormulaQuerySchema,
  lookupPaymentFormulaQuerySchema,
  createPaymentFormulaSchema,
  updatePaymentFormulaSchema,
} = require('../validations/paymentFormula.validation')

const paymentFormulaService = require('../services/paymentFormula.service')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const message = result.error.errors?.[0]?.message || 'Invalid request'
    const error = new Error(message)
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
    req.user?._id ||
    ''
  )
}

async function listPaymentFormulas(req, res, next) {
  try {
    const query = parse(listPaymentFormulaQuerySchema, req.query)

    const result = await paymentFormulaService.listPaymentFormulas(query)

    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

async function lookupPaymentFormulas(req, res, next) {
  try {
    const query = parse(lookupPaymentFormulaQuerySchema, req.query)

    const result = await paymentFormulaService.lookupPaymentFormulas(query)

    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

async function getPaymentFormulaById(req, res, next) {
  try {
    const item = await paymentFormulaService.getPaymentFormulaById(req.params.id)

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
    const payload = parse(createPaymentFormulaSchema, req.body)

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
    const payload = parse(updatePaymentFormulaSchema, req.body)

    const item = await paymentFormulaService.updatePaymentFormula(
      req.params.id,
      payload,
      getActor(req)
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