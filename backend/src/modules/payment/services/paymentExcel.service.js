// backend/src/modules/payment/services/paymentExcel.service.js

const XLSX = require('xlsx')

const DEFAULT_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]
const COMPANY_NAME = 'Trax Apparel (Cambodia) Co., Ltd.'

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function roundAmount(value, decimals = 2) {
  const safeDecimals = Math.min(Math.max(Number(decimals || 0), 0), 6)
  const factor = 10 ** safeDecimals
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor
}

function getDenominations(data) {
  const denominations = data?.exchangeRate?.denominations

  if (Array.isArray(denominations) && denominations.length) {
    return [
      ...new Set(
        denominations
          .map((item) => Math.round(n(item, 0)))
          .filter((item) => item > 0),
      ),
    ].sort((a, b) => b - a)
  }

  return DEFAULT_DENOMINATIONS
}

function buildSalaryTemplateWorkbook() {
  const workbook = XLSX.utils.book_new()

  const rows = [
    ['Employee ID', 'Monthly Salary'],
    ['52520351', 250],
    ['52520352', 300],
    ['52520353', 280],
  ]

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 18 }, { wch: 18 }]

  XLSX.utils.book_append_sheet(workbook, sheet, 'Salary Template')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function normalizeSheetName(value, fallback = 'Sheet') {
  const cleaned = s(value)
    .replace(/[\\/?*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const name = cleaned || fallback
  return name.slice(0, 31)
}

function appendUniqueSheet(workbook, sheet, requestedName) {
  const base = normalizeSheetName(requestedName, `Sheet ${workbook.SheetNames.length + 1}`)
  const used = new Set(workbook.SheetNames.map((name) => name.toLowerCase()))

  let name = base
  let index = 2

  while (used.has(name.toLowerCase())) {
    const suffix = ` (${index})`
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`
    index += 1
  }

  XLSX.utils.book_append_sheet(workbook, sheet, name)
}

function applyColumnWidths(sheet, widths = []) {
  sheet['!cols'] = widths.map((wch) => ({ wch }))
}

function addMerges(sheet, merges = []) {
  sheet['!merges'] = merges.map(([sCell, eCell]) => ({
    s: XLSX.utils.decode_cell(sCell),
    e: XLSX.utils.decode_cell(eCell),
  }))
}

function parseYmd(value) {
  const raw = s(value)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function formatLongDate(value, fallback = '') {
  const date = parseYmd(value)
  if (!date) return fallback || s(value)

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatSheetDate(value, fallback = '') {
  const date = parseYmd(value)
  if (!date) return s(fallback || value)

  const day = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date)

  const month = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date)

  return `${day}${month}`
}

function displayDayType(value) {
  const dayType = upper(value)

  if (dayType === 'HOLIDAY') return 'Holiday'
  if (dayType === 'SUNDAY') return 'Sunday'
  if (dayType === 'WORKING_DAY') return 'Working Day'

  return s(value) || 'OT'
}

function getItemTotalUsd(item = {}) {
  return roundAmount(n(item.amountUsd, 0) + n(item.allowanceAmountUsd, 0), 2)
}

function getItemTotalKhrRaw(item = {}) {
  return n(item.totalPayableKhrRaw, 0) || n(item.amountKhrRaw, 0) + n(item.allowanceAmountKhrRaw, 0)
}

function getItemTotalKhrRounded(item = {}) {
  return (
    n(item.totalPayableKhrRounded, 0) ||
    n(item.amountKhrRounded, 0) + n(item.allowanceAmountKhrRounded, 0)
  )
}

function getItemBreakdown(item = {}, denominations = []) {
  const source = item.totalPayableKhrBreakdown || {}

  return denominations.reduce((acc, denomination) => {
    acc[String(denomination)] = n(source[String(denomination)], 0)
    return acc
  }, {})
}

function emptyBreakdown(denominations = []) {
  return denominations.reduce((acc, denomination) => {
    acc[String(denomination)] = 0
    return acc
  }, {})
}

function addBreakdown(target = {}, source = {}, denominations = []) {
  for (const denomination of denominations) {
    const key = String(denomination)
    target[key] = n(target[key], 0) + n(source[key], 0)
  }

  return target
}

function getRequestGroupKey(item = {}) {
  return (
    s(item.otRequestId) ||
    s(item.requestNo) ||
    [item.otDate, item.shiftName, item.lineName].map(s).filter(Boolean).join('|') ||
    'request'
  )
}

function buildRequestGroups(data = {}) {
  const items = Array.isArray(data.items) ? data.items : []
  const groups = new Map()

  for (const item of items) {
    const key = getRequestGroupKey(item)
    const existing = groups.get(key) || {
      key,
      requestNo: s(item.requestNo),
      otDate: s(item.otDate),
      otDateDisplay: s(item.otDateDisplay),
      dayType: upper(item.dayType),
      requesterName: s(item.requesterName),
      shiftCode: upper(item.shiftCode),
      shiftName: s(item.shiftName),
      shiftType: upper(item.shiftType),
      shiftOtOptionLabel: s(item.shiftOtOptionLabel),
      lineName: s(item.lineName),
      items: [],
    }

    if (!existing.requestNo) existing.requestNo = s(item.requestNo)
    if (!existing.otDate) existing.otDate = s(item.otDate)
    if (!existing.otDateDisplay) existing.otDateDisplay = s(item.otDateDisplay)
    if (!existing.dayType) existing.dayType = upper(item.dayType)
    if (!existing.shiftCode) existing.shiftCode = upper(item.shiftCode)
    if (!existing.shiftName) existing.shiftName = s(item.shiftName)
    if (!existing.shiftOtOptionLabel) existing.shiftOtOptionLabel = s(item.shiftOtOptionLabel)
    if (!existing.lineName) existing.lineName = s(item.lineName)

    existing.items.push(item)
    groups.set(key, existing)
  }

  return Array.from(groups.values()).sort((a, b) => {
    const byDate = s(a.otDate).localeCompare(s(b.otDate))
    if (byDate) return byDate

    const byShift = s(a.shiftCode || a.shiftName).localeCompare(s(b.shiftCode || b.shiftName))
    if (byShift) return byShift

    const byLine = s(a.lineName).localeCompare(s(b.lineName))
    if (byLine) return byLine

    return s(a.requestNo).localeCompare(s(b.requestNo))
  })
}

function summarizeItems(items = [], denominations = []) {
  const result = {
    headCount: items.length,
    payableHours: 0,
    otUsd: 0,
    allowanceUsd: 0,
    totalUsd: 0,
    totalKhrRaw: 0,
    totalKhrRounded: 0,
    breakdown: emptyBreakdown(denominations),
  }

  for (const item of items) {
    result.payableHours += n(item.payableHours, 0)
    result.otUsd += n(item.amountUsd, 0)
    result.allowanceUsd += n(item.allowanceAmountUsd, 0)
    result.totalUsd += getItemTotalUsd(item)
    result.totalKhrRaw += getItemTotalKhrRaw(item)
    result.totalKhrRounded += getItemTotalKhrRounded(item)
    addBreakdown(result.breakdown, getItemBreakdown(item, denominations), denominations)
  }

  result.payableHours = roundAmount(result.payableHours, 2)
  result.otUsd = roundAmount(result.otUsd, 2)
  result.allowanceUsd = roundAmount(result.allowanceUsd, 2)
  result.totalUsd = roundAmount(result.totalUsd, 2)
  result.totalKhrRaw = Math.round(result.totalKhrRaw)
  result.totalKhrRounded = Math.round(result.totalKhrRounded)
  result.variance = Math.round(result.totalKhrRaw - result.totalKhrRounded)

  return result
}

function requestLabel(group = {}) {
  return [
    s(group.requestNo),
    s(group.shiftCode || group.shiftName || group.shiftOtOptionLabel),
    s(group.lineName),
  ]
    .filter(Boolean)
    .join(' - ')
}

function detailTitle(group = {}) {
  const dateLabel = formatLongDate(group.otDate, group.otDateDisplay)
  const dayTypeLabel = displayDayType(group.dayType)
  const lineLabel = [
    s(group.shiftCode || group.shiftName || group.shiftOtOptionLabel),
    s(group.lineName),
  ]
    .filter(Boolean)
    .join('-')

  return [
    `Extra O.T. - ${dayTypeLabel}`,
    dateLabel,
    lineLabel,
    `${group.items.length} PAX`,
  ]
    .filter(Boolean)
    .join(' ')
}

function buildSummarySheet(data = {}, groups = [], denominations = []) {
  const rows = [
    [],
    [],
    ['', '', '', '', '', 'Bank Note'],
    [
      '',
      '',
      'HCs',
      'USD',
      'Riel',
      ...denominations,
      'Total',
      'Variance',
    ],
    [],
  ]

  const grand = {
    totalUsd: 0,
    totalKhrRaw: 0,
    totalKhrRounded: 0,
    headCount: 0,
    breakdown: emptyBreakdown(denominations),
  }

  for (const group of groups) {
    const summary = summarizeItems(group.items, denominations)

    grand.totalUsd += summary.totalUsd
    grand.totalKhrRaw += summary.totalKhrRaw
    grand.totalKhrRounded += summary.totalKhrRounded
    grand.headCount += summary.headCount
    addBreakdown(grand.breakdown, summary.breakdown, denominations)

    rows.push([
      group.otDateDisplay || group.otDate || '',
      requestLabel(group),
      summary.headCount,
      summary.totalUsd,
      summary.totalKhrRaw,
      ...denominations.map((denomination) => summary.breakdown[String(denomination)] || 0),
      summary.totalKhrRounded,
      summary.variance,
    ])
  }

  while (rows.length < 32) rows.push([])

  grand.totalUsd = roundAmount(grand.totalUsd, 2)
  grand.totalKhrRaw = Math.round(grand.totalKhrRaw)
  grand.totalKhrRounded = Math.round(grand.totalKhrRounded)

  rows.push([
    '',
    'Total',
    grand.headCount,
    grand.totalUsd,
    grand.totalKhrRaw,
    ...denominations.map((denomination) => grand.breakdown[String(denomination)] || 0),
    grand.totalKhrRounded,
    grand.totalKhrRaw - grand.totalKhrRounded,
  ])

  rows.push([], [], [], [], ['','Checked By'], [], [], [], ['', '', '', '', '', '', '', '', '', '', 'Received By'])

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  applyColumnWidths(sheet, [14, 24, 8, 12, 14, ...denominations.map(() => 9), 14, 12])

  return sheet
}

function buildDetailSheet(group = {}, data = {}, denominations = []) {
  const firstItem = group.items[0] || {}
  const multiplier = n(firstItem.multiplier, 0)
  const multiplierLabel = multiplier > 0 ? ` ${Math.round(multiplier * 100)}%` : ''
  const otAmountHeader = `OT ${displayDayType(group.dayType)}${multiplierLabel}`

  const rows = [
    [COMPANY_NAME],
    [detailTitle(group)],
    [],
    [
      'No',
      'Employee ID',
      'Employee Name',
      'Position',
      'Line',
      'Payable Hours',
      otAmountHeader,
      'Food\nAllowance',
      'Total Pay',
      'Total KHR',
      ...denominations,
    ],
  ]

  group.items.forEach((item, index) => {
    const breakdown = getItemBreakdown(item, denominations)

    rows.push([
      index + 1,
      s(item.employeeNo),
      s(item.employeeName),
      s(item.positionName),
      s(item.lineName),
      roundAmount(n(item.payableHours, 0), 2),
      roundAmount(n(item.amountUsd, 0), 2),
      roundAmount(n(item.allowanceAmountUsd, 0), 2),
      getItemTotalUsd(item),
      Math.round(getItemTotalKhrRounded(item)),
      ...denominations.map((denomination) => breakdown[String(denomination)] || 0),
    ])
  })

  const summary = summarizeItems(group.items, denominations)

  rows.push([
    'Total',
    '',
    '',
    '',
    '',
    summary.payableHours,
    summary.otUsd,
    summary.allowanceUsd,
    summary.totalUsd,
    summary.totalKhrRounded,
    ...denominations.map((denomination) => summary.breakdown[String(denomination)] || 0),
  ])

  rows.push([], [], [], [], [], [], [], [], [], [COMPANY_NAME], [], ['Page 1'])

  const sheet = XLSX.utils.aoa_to_sheet(rows)

  applyColumnWidths(sheet, [
    5,
    14,
    28,
    22,
    14,
    14,
    16,
    14,
    14,
    14,
    ...denominations.map(() => 8),
  ])

  const lastColumnIndex = 9 + denominations.length
  const lastColumn = XLSX.utils.encode_col(lastColumnIndex)
  const totalRowNumber = 5 + group.items.length

  addMerges(sheet, [
    ['A1', `${lastColumn}1`],
    ['A2', `${lastColumn}2`],
    ['A' + totalRowNumber, 'E' + totalRowNumber],
  ])

  return sheet
}

function buildRequestSheetName(group = {}) {
  const dateLabel = formatSheetDate(group.otDate, group.otDateDisplay)
  const label = [dateLabel, s(group.shiftCode || group.shiftName), s(group.lineName), s(group.requestNo)]
    .filter(Boolean)
    .join(' ')

  return label || `Request ${s(group.requestNo || '')}`
}

function buildPaymentWorkbook(data) {
  const workbook = XLSX.utils.book_new()
  const denominations = getDenominations(data)
  const groups = buildRequestGroups(data)

  appendUniqueSheet(workbook, buildSummarySheet(data, groups, denominations), 'Summary')

  for (const group of groups) {
    appendUniqueSheet(
      workbook,
      buildDetailSheet(group, data, denominations),
      buildRequestSheetName(group),
    )
  }

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

module.exports = {
  buildSalaryTemplateWorkbook,
  buildPaymentWorkbook,
}
