// backend/src/modules/org/services/dashboard.service.js
// backend/src/modules/org/services/dashboard.service.js

const Department = require('../models/Department')
const Position = require('../models/Position')
const Employee = require('../models/Employee')

function buildMonthBuckets(monthCount = 6) {
  const now = new Date()
  const buckets = []

  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleString('en-US', {
      month: 'short',
      year: '2-digit',
    })

    buckets.push({
      key,
      label,
      startDate: date,
    })
  }

  return buckets
}

async function buildBasicMasterSummary(Model, options = {}) {
  const monthCount = Number(options.monthCount || 6)
  const monthBuckets = buildMonthBuckets(monthCount)
  const fromDate = monthBuckets[0]?.startDate || new Date()

  const [total, active, inactive, monthlyRows] = await Promise.all([
    Model.countDocuments({}),
    Model.countDocuments({ isActive: true }),
    Model.countDocuments({ isActive: false }),
    Model.aggregate([
      {
        $match: {
          createdAt: {
            $gte: fromDate,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
        },
      },
    ]),
  ])

  const monthlyMap = new Map()

  monthlyRows.forEach((row) => {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`
    monthlyMap.set(key, row.count || 0)
  })

  const monthlyTrend = monthBuckets.map((bucket) => ({
    label: bucket.label,
    count: monthlyMap.get(bucket.key) || 0,
  }))

  return {
    total,
    active,
    inactive,
    activeRate: total > 0 ? Math.round((active / total) * 100) : 0,
    inactiveRate: total > 0 ? Math.round((inactive / total) * 100) : 0,
    statusChart: {
      labels: ['Active', 'Inactive'],
      data: [active, inactive],
    },
    monthlyTrend: {
      labels: monthlyTrend.map((item) => item.label),
      data: monthlyTrend.map((item) => item.count),
    },
  }
}

async function getDepartmentDashboardSummary() {
  return buildBasicMasterSummary(Department)
}

async function getPositionDashboardSummary() {
  return buildBasicMasterSummary(Position)
}

async function getEmployeeDashboardSummary() {
  return buildBasicMasterSummary(Employee)
}

module.exports = {
  getDepartmentDashboardSummary,
  getPositionDashboardSummary,
  getEmployeeDashboardSummary,
}