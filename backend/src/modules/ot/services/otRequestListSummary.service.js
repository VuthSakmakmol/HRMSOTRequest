// backend/src/modules/ot/services/otRequestListSummary.service.js

const OTRequest = require('../models/OTRequest')

function safeArraySize(fieldPath) {
  return {
    $size: {
      $cond: [
        { $isArray: fieldPath },
        fieldPath,
        [],
      ],
    },
  }
}

// The number must use the same staff list displayed in OT tables:
// approved staff when available; otherwise, requested staff.
function effectiveEmployeeCountExpression() {
  return {
    $let: {
      vars: {
        requestedCount: safeArraySize('$requestedEmployees'),
        approvedCount: safeArraySize('$approvedEmployees'),
      },
      in: {
        $cond: [
          { $gt: ['$$approvedCount', 0] },
          '$$approvedCount',
          '$$requestedCount',
        ],
      },
    },
  }
}

async function getTotalEmployeesForFilter(filter = {}) {
  const [summary] = await OTRequest.aggregate([
    { $match: filter && typeof filter === 'object' ? filter : {} },
    {
      $group: {
        _id: null,
        totalEmployees: {
          $sum: effectiveEmployeeCountExpression(),
        },
      },
    },
  ])

  const totalEmployees = Number(summary?.totalEmployees || 0)

  return Number.isFinite(totalEmployees) && totalEmployees > 0
    ? Math.floor(totalEmployees)
    : 0
}

module.exports = {
  getTotalEmployeesForFilter,
}
