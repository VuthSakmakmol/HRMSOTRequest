// backend/src/utils/dashboard.util.js
// backend/src/utils/dashboard.util.js

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

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

function buildMonthlyTrendFromRows(monthBuckets = [], monthlyRows = []) {
  const monthlyMap = new Map()

  monthlyRows.forEach((row) => {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`
    monthlyMap.set(key, Number(row.count || 0))
  })

  const items = monthBuckets.map((bucket) => ({
    label: bucket.label,
    count: monthlyMap.get(bucket.key) || 0,
  }))

  return {
    labels: items.map((item) => item.label),
    data: items.map((item) => item.count),
  }
}

function rate(part, total) {
  const safeTotal = Number(total || 0)
  const safePart = Number(part || 0)

  if (safeTotal <= 0) return 0

  return Math.round((safePart / safeTotal) * 100)
}

async function buildActiveInactiveSummary(Model, options = {}) {
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
    statusChart: {
      labels: ['Active', 'Inactive'],
      data: [active, inactive],
    },
    monthlyTrend: buildMonthlyTrendFromRows(monthBuckets, monthlyRows),
  }
}

module.exports = {
  s,
  upper,
  buildMonthBuckets,
  buildMonthlyTrendFromRows,
  rate,
  buildActiveInactiveSummary,
}