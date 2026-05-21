// backend/src/modules/allowance/controllers/paymentAllowancePolicy.controller.js

const {
  createPaymentAllowancePolicySchema,
  updatePaymentAllowancePolicySchema,
  paymentAllowancePolicyIdParamSchema,
  listPaymentAllowancePolicyQuerySchema,
  lookupPaymentAllowancePolicyQuerySchema,
} = require('../validators/paymentAllowancePolicy.validation')

const paymentAllowancePolicyService = require('../services/paymentAllowancePolicy.service')

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

async function listPaymentAllowancePolicies(req, res, next) {
  try {
    const query = parse(listPaymentAllowancePolicyQuerySchema, req.query || {})

    const data = await paymentAllowancePolicyService.listPaymentAllowancePolicies(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function lookupPaymentAllowancePolicies(req, res, next) {
  try {
    const query = parse(lookupPaymentAllowancePolicyQuerySchema, req.query || {})

    const data = await paymentAllowancePolicyService.lookupPaymentAllowancePolicies(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getPaymentAllowancePolicyById(req, res, next) {
  try {
    const params = parse(paymentAllowancePolicyIdParamSchema, req.params || {})

    const item = await paymentAllowancePolicyService.getPaymentAllowancePolicyById(params.id)

    res.json({
      success: true,
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function createPaymentAllowancePolicy(req, res, next) {
  try {
    const payload = parse(createPaymentAllowancePolicySchema, req.body || {})

    const item = await paymentAllowancePolicyService.createPaymentAllowancePolicy(
      payload,
      getActor(req),
    )

    res.status(201).json({
      success: true,
      message: 'Payment allowance policy created successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function updatePaymentAllowancePolicy(req, res, next) {
  try {
    const params = parse(paymentAllowancePolicyIdParamSchema, req.params || {})
    const payload = parse(updatePaymentAllowancePolicySchema, req.body || {})

    const item = await paymentAllowancePolicyService.updatePaymentAllowancePolicy(
      params.id,
      payload,
      getActor(req),
    )

    res.json({
      success: true,
      message: 'Payment allowance policy updated successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listPaymentAllowancePolicies,
  lookupPaymentAllowancePolicies,
  getPaymentAllowancePolicyById,
  createPaymentAllowancePolicy,
  updatePaymentAllowancePolicy,
}