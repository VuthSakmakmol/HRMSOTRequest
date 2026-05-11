// backend/src/modules/ot/controllers/dashboard.controller.js

const otDashboardService = require('../services/otDashboard.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

async function getOTDashboardSummary(req, res, next) {
  try {
    const item = await otDashboardService.getOTDashboardSummary(req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getOTDashboardSummary,
}