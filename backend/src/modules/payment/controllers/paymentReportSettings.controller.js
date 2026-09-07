const { successResponse } = require('../../../shared/utils/apiResponse')
const paymentReportSettingsService = require('../services/paymentReportSettings.service')
const {
  createPaymentReportSettingSchema,
  updatePaymentReportSettingSchema,
  parse,
} = require('../validations/paymentReportSettings.validation')

async function getSettings(req, res, next) {
  try {
    const item = await paymentReportSettingsService.getSettings()
    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

async function createPosition(req, res, next) {
  try {
    const payload = parse(createPaymentReportSettingSchema, req.body || {})
    const item = await paymentReportSettingsService.addPosition(payload.positionId, req.user)
    return successResponse(res, { item }, 201)
  } catch (error) {
    return next(error)
  }
}

async function updatePosition(req, res, next) {
  try {
    const payload = parse(updatePaymentReportSettingSchema, req.body || {})
    const item = await paymentReportSettingsService.updatePosition(
      req.params.positionId,
      payload.positionId,
      req.user,
    )
    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

async function deletePosition(req, res, next) {
  try {
    const item = await paymentReportSettingsService.deletePosition(
      req.params.positionId,
      req.user,
    )
    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getSettings,
  createPosition,
  updatePosition,
  deletePosition,
}
