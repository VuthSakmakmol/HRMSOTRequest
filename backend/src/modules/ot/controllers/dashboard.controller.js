// backend/src/modules/ot/controllers/dashboard.controller.js
// backend/src/modules/ot/controllers/dashboard.controller.js

const otDashboardService = require('../services/otDashboard.service')

async function getOTDashboardSummary(req, res, next) {
  try {
    const data = await otDashboardService.getOTDashboardSummary()

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getOTDashboardSummary,
}