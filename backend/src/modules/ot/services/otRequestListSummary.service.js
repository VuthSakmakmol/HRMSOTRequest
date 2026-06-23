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

// Must match the employee list/count shown for every OT request:
// 1. While requester confirmation is pending, use the proposed employee list.
// 2. Otherwise, use the approved list when it exists.
// 3. Otherwise, use the originally requested list.
function effectiveEmployeeCountExpression() {
  return {
    $let: {
      vars: {
        requestedCount: safeArraySize('$requestedEmployees'),
        approvedCount: safeArraySize('$approvedEmployees'),
        proposedCount: safeArraySize('$proposedApprovedEmployees'),
      },
      in: {
        $cond: [
          {
            $and: [
              { $eq: ['$status', 'PENDING_REQUESTER_CONFIRMATION'] },
              { $gt: ['$$proposedCount', 0] },
            ],
          },
          '$$proposedCount',
          {
            $cond: [
              { $gt: ['$$approvedCount', 0] },
              '$$approvedCount',
              '$$requestedCount',
            ],
          },
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
