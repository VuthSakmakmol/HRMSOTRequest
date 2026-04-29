// backend/src/modules/ot/controllers/otPolicy.controller.js
const otPolicyService = require('../services/otPolicy.service')

async function lookupOTCalculationPolicies(req, res, next) {
  try {
    const result = await otPolicyService.lookupOTCalculationPolicies(req.query)

    return res.json({
      ok: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function createOTCalculationPolicy(req, res, next) {
  try {
    const result = await otPolicyService.create(req.body || {}, req.user)

    return res.status(201).json({
      ok: true,
      message: 'OT calculation policy created successfully',
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function updateOTCalculationPolicy(req, res, next) {
  try {
    const result = await otPolicyService.update(req.params.id, req.body || {}, req.user)

    return res.json({
      ok: true,
      message: 'OT calculation policy updated successfully',
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function listOTCalculationPolicies(req, res, next) {
  try {
    const result = await otPolicyService.list(req.query || {})
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

async function getOTCalculationPolicyDetail(req, res, next) {
  try {
    const result = await otPolicyService.getById(req.params.id)

    return res.json({
      ok: true,
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  lookupOTCalculationPolicies,
  createOTCalculationPolicy,
  updateOTCalculationPolicy,
  listOTCalculationPolicies,
  getOTCalculationPolicyDetail,
}