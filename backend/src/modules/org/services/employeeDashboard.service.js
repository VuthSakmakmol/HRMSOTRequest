// backend/src/modules/org/services/employeeDashboard.service.js
// backend/src/modules/org/services/employeeDashboard.service.js

const Employee = require('../models/Employee')
const { buildActiveInactiveSummary } = require('../../../utils/dashboard.util')

async function getEmployeeDashboardSummary() {
  return buildActiveInactiveSummary(Employee)
}

module.exports = {
  getEmployeeDashboardSummary,
}