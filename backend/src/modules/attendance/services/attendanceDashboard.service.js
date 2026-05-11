// backend/src/modules/attendance/services/attendanceDashboard.service.js

const AttendanceRecord = require('../models/AttendanceRecord')
const {
  upper,
  buildMonthBuckets,
  buildMonthlyTrendFromRows,
  rate,
} = require('../../../utils/dashboard.util')

function s(value) {
  return String(value ?? '').trim()
}

function normalizeAttendanceStatus(status) {
  const value = upper(status)

  if (!value) return 'UNKNOWN'
  if (value === 'PRESENT') return 'PRESENT'
  if (value === 'ABSENT') return 'ABSENT'
  if (value === 'LATE') return 'LATE'
  if (value === 'LEAVE') return 'LEAVE'
  if (value === 'OFF') return 'OFF'
  if (value === 'SHIFT_MISMATCH') return 'SHIFT_MISMATCH'
  if (value === 'FORGET_SCAN_IN') return 'FORGET_SCAN_IN'
  if (value === 'FORGET_SCAN_OUT') return 'FORGET_SCAN_OUT'

  if (value === 'FORGET_SCAN') return 'FORGET_SCAN'
  if (value.includes('FORGET')) return 'FORGET_SCAN'
  if (value.includes('MISS')) return 'FORGET_SCAN'

  return value || 'UNKNOWN'
}

function statusLabel(status) {
  const value = upper(status)

  if (value === 'PRESENT') return 'Present'
  if (value === 'ABSENT') return 'Absent'
  if (value === 'LATE') return 'Late'
  if (value === 'LEAVE') return 'Leave'
  if (value === 'OFF') return 'Off'
  if (value === 'SHIFT_MISMATCH') return 'Shift Mismatch'
  if (value === 'FORGET_SCAN_IN') return 'Forget Scan In'
  if (value === 'FORGET_SCAN_OUT') return 'Forget Scan Out'
  if (value === 'FORGET_SCAN') return 'Forget Scan'

  return value || 'Unknown'
}

function statusSeverity(status) {
  const value = upper(status)

  if (value === 'PRESENT') return 'success'
  if (value === 'LATE') return 'warning'
  if (value === 'ABSENT') return 'danger'
  if (value === 'LEAVE') return 'info'
  if (value === 'OFF') return 'secondary'
  if (value === 'SHIFT_MISMATCH') return 'danger'
  if (value === 'FORGET_SCAN_IN') return 'warning'
  if (value === 'FORGET_SCAN_OUT') return 'warning'
  if (value === 'FORGET_SCAN') return 'warning'

  return 'secondary'
}

function dayTypeLabel(dayType) {
  const value = upper(dayType)

  if (value === 'WORKING_DAY') return 'Working Day'
  if (value === 'SUNDAY') return 'Sunday'
  if (value === 'HOLIDAY') return 'Holiday'

  return value || 'Unknown'
}

function dayTypeSeverity(dayType) {
  const value = upper(dayType)

  if (value === 'WORKING_DAY') return 'success'
  if (value === 'SUNDAY') return 'warning'
  if (value === 'HOLIDAY') return 'danger'

  return 'secondary'
}

function shiftMatchLabel(status) {
  const value = upper(status)

  if (value === 'MATCHED') return 'Matched'
  if (value === 'MISMATCH') return 'Mismatch'
  if (value === 'UNKNOWN') return 'Unknown'

  return value || 'Unknown'
}

function shiftMatchSeverity(status) {
  const value = upper(status)

  if (value === 'MATCHED') return 'success'
  if (value === 'MISMATCH') return 'danger'

  return 'secondary'
}

function buildOrderedChart(map, order, labelFn, severityFn) {
  return order
    .map((key) => ({
      key,
      label: labelFn(key),
      value: map.get(key) || 0,
      severity: severityFn ? severityFn(key) : 'secondary',
    }))
    .filter((item) => item.value > 0)
}

function mapCountRows(rows = [], normalizer = upper) {
  const map = new Map()

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = normalizer(row?._id)
    map.set(key, (map.get(key) || 0) + Number(row?.count || 0))
  }

  return map
}

function buildTopList(rows = [], options = {}) {
  const limit = Number(options.limit || 8)

  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      key: s(row?._id),
      label: s(row?._id) || 'Unknown',
      value: Number(row?.count || 0),
    }))
    .filter((item) => item.value > 0)
    .slice(0, limit)
}

async function getAttendanceDashboardSummary() {
  const monthBuckets = buildMonthBuckets(6)
  const fromDate = monthBuckets[0]?.startDate || new Date()

  const [
    total,
    statusRows,
    dayTypeRows,
    shiftMatchRows,
    departmentRows,
    lineRows,
    monthlyRows,
  ] = await Promise.all([
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
        $group: {
          _id: '$dayType',
          count: { $sum: 1 },
        },
      },
    ]),

    AttendanceRecord.aggregate([
      {
        $group: {
          _id: '$shiftMatchStatus',
          count: { $sum: 1 },
        },
      },
    ]),

    AttendanceRecord.aggregate([
      {
        $group: {
          _id: '$departmentName',
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
          _id: 1,
        },
      },
      {
        $limit: 8,
      },
    ]),

    AttendanceRecord.aggregate([
      {
        $group: {
          _id: '$lineName',
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
          _id: 1,
        },
      },
      {
        $limit: 8,
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

  const statusMap = mapCountRows(statusRows, normalizeAttendanceStatus)
  const dayTypeMap = mapCountRows(dayTypeRows, upper)
  const shiftMatchMap = mapCountRows(shiftMatchRows, upper)

  const present = statusMap.get('PRESENT') || 0
  const absent = statusMap.get('ABSENT') || 0
  const late = statusMap.get('LATE') || 0
  const leave = statusMap.get('LEAVE') || 0
  const off = statusMap.get('OFF') || 0
  const shiftMismatch = statusMap.get('SHIFT_MISMATCH') || 0
  const forgetScanIn = statusMap.get('FORGET_SCAN_IN') || 0
  const forgetScanOut = statusMap.get('FORGET_SCAN_OUT') || 0
  const forgetScan = (statusMap.get('FORGET_SCAN') || 0) + forgetScanIn + forgetScanOut
  const unknown = statusMap.get('UNKNOWN') || 0

  const issueCount = absent + late + shiftMismatch + forgetScan + unknown
  const normalCount = present + leave + off

  const matchedShift = shiftMatchMap.get('MATCHED') || 0
  const mismatchedShift = shiftMatchMap.get('MISMATCH') || 0
  const unknownShiftMatch = shiftMatchMap.get('UNKNOWN') || 0

  const workingDay = dayTypeMap.get('WORKING_DAY') || 0
  const sunday = dayTypeMap.get('SUNDAY') || 0
  const holiday = dayTypeMap.get('HOLIDAY') || 0

  const statusChartItems = buildOrderedChart(
    statusMap,
    [
      'PRESENT',
      'LATE',
      'ABSENT',
      'FORGET_SCAN_IN',
      'FORGET_SCAN_OUT',
      'SHIFT_MISMATCH',
      'LEAVE',
      'OFF',
      'UNKNOWN',
      'FORGET_SCAN',
    ],
    statusLabel,
    statusSeverity,
  )

  const dayTypeChartItems = buildOrderedChart(
    dayTypeMap,
    ['WORKING_DAY', 'SUNDAY', 'HOLIDAY', 'UNKNOWN'],
    dayTypeLabel,
    dayTypeSeverity,
  )

  const shiftMatchChartItems = buildOrderedChart(
    shiftMatchMap,
    ['MATCHED', 'MISMATCH', 'UNKNOWN'],
    shiftMatchLabel,
    shiftMatchSeverity,
  )

  return {
    total,

    present,
    absent,
    late,
    leave,
    off,
    shiftMismatch,
    forgetScan,
    forgetScanIn,
    forgetScanOut,
    unknown,

    normalCount,
    issueCount,

    workingDay,
    sunday,
    holiday,

    matchedShift,
    mismatchedShift,
    unknownShiftMatch,

    presentRate: rate(present, total),
    absentRate: rate(absent, total),
    lateRate: rate(late, total),
    forgetScanRate: rate(forgetScan, total),
    issueRate: rate(issueCount, total),
    shiftMismatchRate: rate(shiftMismatch, total),
    shiftMatchedRate: rate(matchedShift, matchedShift + mismatchedShift + unknownShiftMatch),

    statusChart: {
      labels: statusChartItems.map((item) => item.label),
      data: statusChartItems.map((item) => item.value),
      items: statusChartItems,
    },

    dayTypeChart: {
      labels: dayTypeChartItems.map((item) => item.label),
      data: dayTypeChartItems.map((item) => item.value),
      items: dayTypeChartItems,
    },

    shiftMatchChart: {
      labels: shiftMatchChartItems.map((item) => item.label),
      data: shiftMatchChartItems.map((item) => item.value),
      items: shiftMatchChartItems,
    },

    departmentChart: {
      labels: buildTopList(departmentRows).map((item) => item.label),
      data: buildTopList(departmentRows).map((item) => item.value),
      items: buildTopList(departmentRows),
    },

    lineChart: {
      labels: buildTopList(lineRows).map((item) => item.label),
      data: buildTopList(lineRows).map((item) => item.value),
      items: buildTopList(lineRows),
    },

    monthlyTrend: buildMonthlyTrendFromRows(monthBuckets, monthlyRows),
  }
}

module.exports = {
  getAttendanceDashboardSummary,
}