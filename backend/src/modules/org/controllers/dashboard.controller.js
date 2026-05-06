// backend/src/modules/org/controllers/dashboard.controller.js
// backend/src/modules/org/controllers/dashboard.controller.js

const departmentDashboardService = require('../services/departmentDashboard.service')
const positionDashboardService = require('../services/positionDashboard.service')
const employeeDashboardService = require('../services/employeeDashboard.service')

async function getDepartmentDashboardSummary(req, res, next) {
  try {
    const data = await departmentDashboardService.getDepartmentDashboardSummary()

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getPositionDashboardSummary(req, res, next) {
  try {
    const data = await positionDashboardService.getPositionDashboardSummary()

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getEmployeeDashboardSummary(req, res, next) {
  try {
    const data = await employeeDashboardService.getEmployeeDashboardSummary()

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getDepartmentDashboardSummary,
  getPositionDashboardSummary,
  getEmployeeDashboardSummary,
}