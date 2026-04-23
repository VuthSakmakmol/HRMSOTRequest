// backend/src/modules/ot/controllers/otPolicy.controller.js
const mongoose = require('mongoose')
const otPolicyService = require('../services/otPolicy.service')
const {
  createOTCalculationPolicySchema,
  updateOTCalculationPolicySchema,
  listOTCalculationPoliciesQuerySchema,
  otCalculationPolicyIdParamSchema,
} = require('../validators/otPolicy.validation')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    throw err
  }

  return result.data
}

function parseObjectIdParam(value, label = 'id') {
  const id = String(value || '').trim()

  if (!mongoose.isValidObjectId(id)) {
    const err = new Error(`Invalid ${label}`)
    err.status = 400
    throw err
  }

  return id
}

async function createOTCalculationPolicy(req, res, next) {
  try {
    const payload = parse(createOTCalculationPolicySchema, req.body || {})
    const data = await otPolicyService.create(payload, req.user)

    res.status(201).json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function updateOTCalculationPolicy(req, res, next) {
  try {
    const params = parse(otCalculationPolicyIdParamSchema, req.params || {})
    const payload = parse(updateOTCalculationPolicySchema, req.body || {})
    const data = await otPolicyService.update(params.id, payload, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function listOTCalculationPolicies(req, res, next) {
  try {
    const query = parse(listOTCalculationPoliciesQuerySchema, req.query || {})
    const data = await otPolicyService.list(query)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getOTCalculationPolicyDetail(req, res, next) {
  try {
    const id = parseObjectIdParam(req.params.id, 'id')
    const data = await otPolicyService.getById(id)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createOTCalculationPolicy,
  updateOTCalculationPolicy,
  listOTCalculationPolicies,
  getOTCalculationPolicyDetail,
}