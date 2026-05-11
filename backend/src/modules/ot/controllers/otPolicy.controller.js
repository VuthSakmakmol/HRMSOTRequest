// backend/src/modules/ot/controllers/otPolicy.controller.js

const otPolicyService = require('../services/otPolicy.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createOTCalculationPolicySchema,
  updateOTCalculationPolicySchema,
  normalizeListQuery,
  normalizeLookupQuery,
  otCalculationPolicyIdParamSchema,
} = require('../validators/otPolicy.validation')

function parse(schema, data) {
  return schema.parse(data)
}

async function lookupOTCalculationPolicies(req, res, next) {
  try {
    const query = normalizeLookupQuery(req.query || {})
    const result = await otPolicyService.lookupOTCalculationPolicies(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function listOTCalculationPolicies(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await otPolicyService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getOTCalculationPolicyDetail(req, res, next) {
  try {
    const params = parse(otCalculationPolicyIdParamSchema, req.params || {})
    const item = await otPolicyService.getById(params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function createOTCalculationPolicy(req, res, next) {
  try {
    const payload = parse(createOTCalculationPolicySchema, req.body || {})
    const item = await otPolicyService.create(payload, req.user)

    return successResponse(
      res,
      {
        item,
      },
      201,
    )
  } catch (error) {
    return next(error)
  }
}

async function updateOTCalculationPolicy(req, res, next) {
  try {
    const params = parse(otCalculationPolicyIdParamSchema, req.params || {})
    const payload = parse(updateOTCalculationPolicySchema, req.body || {})
    const item = await otPolicyService.update(params.id, payload, req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  lookupOTCalculationPolicies,
  listOTCalculationPolicies,
  getOTCalculationPolicyDetail,
  createOTCalculationPolicy,
  updateOTCalculationPolicy,
}