// backend/src/modules/attendance/services/attendanceDashboard.service.js
// backend/src/modules/attendance/services/attendanceDashboard.service.js

const AttendanceRecord = require('../models/AttendanceRecord')
const {
  upper,
  buildMonthBuckets,
  buildMonthlyTrendFromRows,
  rate,
} = require('../../../utils/dashboard.util')

function normalizeAttendanceStatus(status) {
  const value = upper(status)

  if (!value) return 'UNKNOWN'
  if (value === 'PRESENT') return 'PRESENT'
  if (value === 'ABSENT') return 'ABSENT'
  if (value === 'LATE') return 'LATE'
  if (value === 'EARLY_LEAVE') return 'EARLY_LEAVE'
  if (value === 'FORGET_SCAN') return 'FORGET_SCAN'
  if (value === 'FORGET_SCAN_IN') return 'FORGET_SCAN'
  if (value === 'FORGET_SCAN_OUT') return 'FORGET_SCAN'
  if (value.includes('FORGET')) return 'FORGET_SCAN'
  if (value.includes('MISS')) return 'FORGET_SCAN'

  return value
}

function statusLabel(status) {
  const value = upper(status)

  if (value === 'PRESENT') return 'Present'
  if (value === 'ABSENT') return 'Absent'
  if (value === 'LATE') return 'Late'
  if (value === 'EARLY_LEAVE') return 'Early Leave'
  if (value === 'FORGET_SCAN') return 'Forget Scan'

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

async function getAttendanceDashboardSummary() {
  const monthBuckets = buildMonthBuckets(6)
  const fromDate = monthBuckets[0]?.startDate || new Date()

  const [total, statusRows, monthlyRows] = await Promise.all([
    AttendanceRecord.countDocuments({}),

    AttendanceRecord.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    AttendanceRecord.aggregate([
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
    const status = normalizeAttendanceStatus(row?._id)
    statusMap.set(status, (statusMap.get(status) || 0) + Number(row?.count || 0))
  })

  const present = statusMap.get('PRESENT') || 0
  const absent = statusMap.get('ABSENT') || 0
  const late = statusMap.get('LATE') || 0
  const earlyLeave = statusMap.get('EARLY_LEAVE') || 0
  const forgetScan = statusMap.get('FORGET_SCAN') || 0

  const statusChartItems = buildOrderedChart(
    statusMap,
    ['PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE', 'FORGET_SCAN', 'UNKNOWN'],
    statusLabel,
  )

  return {
    total,
    present,
    absent,
    late,
    earlyLeave,
    forgetScan,

    presentRate: rate(present, total),
    absentRate: rate(absent, total),
    issueRate: rate(absent + late + earlyLeave + forgetScan, total),

    statusChart: {
      labels: statusChartItems.map((item) => item.label),
      data: statusChartItems.map((item) => item.value),
    },

    monthlyTrend: buildMonthlyTrendFromRows(monthBuckets, monthlyRows),
  }
}

module.exports = {
  getAttendanceDashboardSummary,
}