// backend/src/modules/org/services/dashboard.service.js

const Department = require('../models/Department')
const Position = require('../models/Position')
const ProductionLine = require('../models/ProductionLine')
const Employee = require('../models/Employee')

function pad2(value) {
  return String(value).padStart(2, '0')
}

function buildMonthBuckets(monthCount = 6) {
  const now = new Date()
  const buckets = []

  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))

    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1

    buckets.push({
      key: `${year}-${pad2(month)}`,
      year,
      month,
      startDate: date,
    })
  }

  return buckets
}

function rate(part, total) {
  const safePart = Number(part || 0)
  const safeTotal = Number(total || 0)

  if (safeTotal <= 0) return 0

  return Math.round((safePart / safeTotal) * 100)
}

function buildMonthlyTrend(monthBuckets = [], monthlyRows = []) {
  const monthlyMap = new Map()

  for (const row of monthlyRows) {
    const key = `${row._id.year}-${pad2(row._id.month)}`
    monthlyMap.set(key, Number(row.count || 0))
  }

  return monthBuckets.map((bucket) => ({
    monthKey: bucket.key,
    year: bucket.year,
    month: bucket.month,
    count: monthlyMap.get(bucket.key) || 0,
  }))
}

async function buildMasterSummary(Model, options = {}) {
  const monthCount = Number(options.monthCount || 6)
  const dateField = String(options.dateField || 'createdAt').trim() || 'createdAt'

  const monthBuckets = buildMonthBuckets(monthCount)
  const fromDate = monthBuckets[0]?.startDate || new Date()

  const [total, active, inactive, monthlyRows] = await Promise.all([
    Model.countDocuments({}),
    Model.countDocuments({ isActive: true }),
    Model.countDocuments({ isActive: false }),
    Model.aggregate([
      {
        $match: {
          [dateField]: {
            $gte: fromDate,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: `$${dateField}` },
            month: { $month: `$${dateField}` },
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

  return {
    total,
    active,
    inactive,

    activeRate: rate(active, total),
    inactiveRate: rate(inactive, total),

    statusBreakdown: [
      {
        statusCode: 'ACTIVE',
        statusKey: 'common.status.active',
        count: active,
        rate: rate(active, total),
        severity: 'success',
      },
      {
        statusCode: 'INACTIVE',
        statusKey: 'common.status.inactive',
        count: inactive,
        rate: rate(inactive, total),
        severity: 'danger',
      },
    ],

    monthlyTrend: buildMonthlyTrend(monthBuckets, monthlyRows),
  }
}

async function getDepartmentDashboardSummary() {
  return buildMasterSummary(Department)
}

async function getPositionDashboardSummary() {
  return buildMasterSummary(Position)
}

async function getLineDashboardSummary() {
  return buildMasterSummary(ProductionLine)
}

async function getEmployeeDashboardSummary() {
  return buildMasterSummary(Employee)
}

async function getOrgDashboardSummary() {
  const [departments, positions, lines, employees] = await Promise.all([
    getDepartmentDashboardSummary(),
    getPositionDashboardSummary(),
    getLineDashboardSummary(),
    getEmployeeDashboardSummary(),
  ])

  return {
    departments,
    positions,
    lines,
    employees,
  }
}

module.exports = {
  getOrgDashboardSummary,
  getDepartmentDashboardSummary,
  getPositionDashboardSummary,
  getLineDashboardSummary,
  getEmployeeDashboardSummary,
}