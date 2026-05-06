// backend/src/modules/org/services/positionDashboard.service.js
// backend/src/modules/org/services/positionDashboard.service.js

const Position = require('../models/Position')
const { buildActiveInactiveSummary } = require('../../../utils/dashboard.util')

async function getPositionDashboardSummary() {
  return buildActiveInactiveSummary(Position)
}

module.exports = {
  getPositionDashboardSummary,
}