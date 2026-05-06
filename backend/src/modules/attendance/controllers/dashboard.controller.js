// backend/src/modules/attendance/controllers/dashboard.controller.js
// backend/src/modules/attendance/controllers/dashboard.controller.js

const attendanceDashboardService = require('../services/attendanceDashboard.service')

async function getAttendanceDashboardSummary(req, res, next) {
  try {
    const data = await attendanceDashboardService.getAttendanceDashboardSummary()

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getAttendanceDashboardSummary,
}