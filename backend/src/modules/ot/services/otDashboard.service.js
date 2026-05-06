// backend/src/modules/ot/services/otDashboard.service.js
// backend/src/modules/ot/services/otDashboard.service.js

const OTRequest = require('../models/OTRequest')
const {
  upper,
  buildMonthBuckets,
  buildMonthlyTrendFromRows,
  rate,
} = require('../../../utils/dashboard.util')

function normalizeStatus(status) {
  const value = upper(status)

  if (!value) return 'UNKNOWN'
  if (value === 'APPROVED') return 'APPROVED'
  if (value === 'REJECTED') return 'REJECTED'
  if (value === 'CANCELLED') return 'CANCELLED'
  if (value === 'REQUESTER_DISAGREED') return 'REQUESTER_DISAGREED'

  if (value.includes('PENDING')) return 'PENDING'

  return value
}

function normalizeDayType(dayType) {
  const value = upper(dayType)

  if (value === 'WORKING_DAY') return 'WORKING_DAY'
  if (value === 'SUNDAY') return 'SUNDAY'
  if (value === 'HOLIDAY') return 'HOLIDAY'

  return 'UNKNOWN'
}

function statusLabel(status) {
  const value = upper(status)

  if (value === 'PENDING') return 'Pending'
  if (value === 'APPROVED') return 'Approved'
  if (value === 'REJECTED') return 'Rejected'
  if (value === 'CANCELLED') return 'Cancelled'
  if (value === 'REQUESTER_DISAGREED') return 'Requester Disagreed'

  return value || 'Unknown'
}

function dayTypeLabel(dayType) {
  const value = upper(dayType)

  if (value === 'WORKING_DAY') return 'Working Day'
  if (value === 'SUNDAY') return 'Sunday'
  if (value === 'HOLIDAY') return 'Holiday'

  return value || 'Unknown'
}

function buildOrderedChart(map, order, labelFn) {
  return order
    .map((key) => ({
      label: labelFn(key),
      value: map.get(key) || 0,
    }))
    .filter((item) => item.value > 0)
}

async function getOTDashboardSummary() {
  const monthBuckets = buildMonthBuckets(6)
  const fromDate = monthBuckets[0]?.startDate || new Date()

  const [total, statusRows, dayTypeRows, monthlyRows] = await Promise.all([
    OTRequest.countDocuments({}),

    OTRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    OTRequest.aggregate([
      {
        $group: {
          _id: '$dayType',
          count: { $sum: 1 },
        },
      },
    ]),

    OTRequest.aggregate([
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

  const statusMap = new Map()

  statusRows.forEach((row) => {
    const status = normalizeStatus(row?._id)
    statusMap.set(status, (statusMap.get(status) || 0) + Number(row?.count || 0))
  })

  const pending = statusMap.get('PENDING') || 0
  const approved = statusMap.get('APPROVED') || 0
  const rejected = statusMap.get('REJECTED') || 0
  const cancelled = statusMap.get('CANCELLED') || 0
  const requesterDisagreed = statusMap.get('REQUESTER_DISAGREED') || 0

  const statusChartItems = buildOrderedChart(
    statusMap,
    ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REQUESTER_DISAGREED'],
    statusLabel,
  )

  const dayTypeMap = new Map()

  dayTypeRows.forEach((row) => {
    const dayType = normalizeDayType(row?._id)
    dayTypeMap.set(dayType, (dayTypeMap.get(dayType) || 0) + Number(row?.count || 0))
  })

  const dayTypeChartItems = buildOrderedChart(
    dayTypeMap,
    ['WORKING_DAY', 'SUNDAY', 'HOLIDAY', 'UNKNOWN'],
    dayTypeLabel,
  )

  return {
    total,
    pending,
    approved,
    rejected,
    cancelled,
    requesterDisagreed,

    approvedRate: rate(approved, total),
    pendingRate: rate(pending, total),

    statusChart: {
      labels: statusChartItems.map((item) => item.label),
      data: statusChartItems.map((item) => item.value),
    },

    dayTypeChart: {
      labels: dayTypeChartItems.map((item) => item.label),
      data: dayTypeChartItems.map((item) => item.value),
    },

    monthlyTrend: buildMonthlyTrendFromRows(monthBuckets, monthlyRows),
  }
}

module.exports = {
  getOTDashboardSummary,
}