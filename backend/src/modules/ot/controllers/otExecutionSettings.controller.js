// backend/src/modules/ot/controllers/otExecutionSettings.controller.js

const { successResponse } = require('../../../shared/utils/apiResponse')
const otExecutionSettingsService = require('../services/otExecutionSettings.service')
const {
  updateOTExecutionSettingsSchema,
  parse,
} = require('../validators/otExecutionSettings.validation')

async function getOTExecutionSettings(req, res, next) {
  try {
    const item = await otExecutionSettingsService.getSettings()
    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

async function getOTRequestAccess(req, res, next) {
  try {
    const item = await otExecutionSettingsService.getRequestAccess()
    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

async function getPaymentApprovalRule(req, res, next) {
  try {
    const item = await otExecutionSettingsService.getPaymentApprovalRule()
    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

async function updateOTExecutionSettings(req, res, next) {
  try {
    const payload = parse(updateOTExecutionSettingsSchema, req.body || {})
    const item = await otExecutionSettingsService.updateSettings(payload, req.user)
    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getOTExecutionSettings,
  getOTRequestAccess,
  getPaymentApprovalRule,
  updateOTExecutionSettings,
}
