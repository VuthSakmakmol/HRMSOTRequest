// backend/src/modules/org/controllers/dashboard.controller.js

const dashboardService = require('../services/dashboard.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

async function getOrgDashboardSummary(req, res, next) {
  try {
    const item = await dashboardService.getOrgDashboardSummary()

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function getDepartmentDashboardSummary(req, res, next) {
  try {
    const item = await dashboardService.getDepartmentDashboardSummary()

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function getPositionDashboardSummary(req, res, next) {
  try {
    const item = await dashboardService.getPositionDashboardSummary()

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function getLineDashboardSummary(req, res, next) {
  try {
    const item = await dashboardService.getLineDashboardSummary()

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function getEmployeeDashboardSummary(req, res, next) {
  try {
    const item = await dashboardService.getEmployeeDashboardSummary()

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getOrgDashboardSummary,
  getDepartmentDashboardSummary,
  getPositionDashboardSummary,
  getLineDashboardSummary,
  getEmployeeDashboardSummary,
}