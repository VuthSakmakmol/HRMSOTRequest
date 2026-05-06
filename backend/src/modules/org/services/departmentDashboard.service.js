// backend/src/modules/org/services/departmentDashboard.service.js
// backend/src/modules/org/services/departmentDashboard.service.js

const Department = require('../models/Department')
const { buildActiveInactiveSummary } = require('../../../utils/dashboard.util')

async function getDepartmentDashboardSummary() {
  return buildActiveInactiveSummary(Department)
}

module.exports = {
  getDepartmentDashboardSummary,
}