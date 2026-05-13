// backend/src/modules/payment/services/paymentExcel.service.js

const XLSX = require('xlsx')

function s(value) {
  return String(value ?? '').trim()
}

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function getDenominations(data) {
  const denominations = data?.exchangeRate?.denominations

  if (Array.isArray(denominations) && denominations.length) {
    return [...new Set(
      denominations
        .map((item) => Math.round(n(item, 0)))
        .filter((item) => item > 0),
    )].sort((a, b) => b - a)
  }

  return [50000, 20000, 10000, 5000, 1000, 500, 100]
}

function buildBreakdownColumns(data, breakdown = {}) {
  return getDenominations(data).reduce((acc, denomination) => {
    acc[String(denomination)] = n(breakdown[String(denomination)], 0)
    return acc
  }, {})
}

function buildSalaryTemplateWorkbook() {
  const workbook = XLSX.utils.book_new()

  const rows = [
    ['Employee ID', 'Employee Name', 'Monthly Salary'],
    ['52520351', 'Sample Employee 1', 250],
    ['52520352', 'Sample Employee 2', 300],
    ['52520353', 'Sample Employee 3', 280],
  ]

  const sheet = XLSX.utils.aoa_to_sheet(rows)

  sheet['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
  ]

  XLSX.utils.book_append_sheet(workbook, sheet, 'Salary Template')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function buildSummaryRows(data) {
  const exchangeRate = data.exchangeRate || {}

  return [
    ['Period From', data.period.fromDateDisplay],
    ['Period To', data.period.toDateDisplay],

    ['Formula', `${data.formula.code} - ${data.formula.name}`],
    ['Formula Currency', data.formula.currency],

    ['Exchange Rate', `${exchangeRate.code || ''} - ${exchangeRate.name || ''}`],
    ['Rate', exchangeRate.rate || ''],
    ['From Currency', exchangeRate.fromCurrency || ''],
    ['To Currency', exchangeRate.toCurrency || ''],
    ['Rounding Mode', exchangeRate.roundingMode || ''],
    ['Rounding Unit', exchangeRate.roundingUnit || ''],
    ['Denominations', getDenominations(data).join(', ')],

    ['OT Requests', data.otRequestCount],
    ['Payment Rows', data.summary.totalItemCount],
    ['Payable Rows', data.summary.payableItemCount],
    ['Missing Salary Rows', data.summary.missingSalaryItemCount],

    ['Total Payable Minutes', data.summary.totalPayableMinutes],
    ['Total Payable Hours', data.summary.totalPayableHours],

    ['Total Amount USD', data.summary.totalAmountUsd],
    ['Total KHR Raw', data.summary.totalAmountKhrRaw],
    ['Total KHR Rounded', data.summary.totalAmountKhrRounded],
    ['Total KHR Round Difference', data.summary.totalKhrRoundDifference],

    ['Generated At', data.generatedAtDisplayHm],
    ['Exported By', s(data.exportedBy)],
  ]
}

function buildEmployeeSummaryRows(data) {
  return data.summary.summaryByEmployee.map((item, index) => ({
    No: index + 1,
    'Employee ID': item.employeeNo,
    'Employee Name': item.employeeName,
    Department: item.departmentName,
    Position: item.positionName,
    Line: item.lineName,

    'Monthly Salary': item.monthlySalary,
    Currency: item.currency,
    'Request Count': item.requestCount,
    'Payable Minutes': item.payableMinutes,
    'Payable Hours': item.payableHours,

    'Amount USD': item.amountUsd,
    Rate: data.exchangeRate?.rate || '',
    'Raw KHR': item.amountKhrRaw,
    'Rounded KHR': item.amountKhrRounded,
    'Round Diff KHR': item.khrRoundDifference,

    ...buildBreakdownColumns(data, item.khrBreakdown),
  }))
}

function buildDayTypeSummaryRows(data) {
  return data.summary.summaryByDayType.map((item, index) => ({
    No: index + 1,
    'Day Type': item.dayType,
    'Request Count': item.requestCount,
    'Payable Minutes': item.payableMinutes,
    'Payable Hours': item.payableHours,

    'Amount USD': item.amountUsd,
    Rate: data.exchangeRate?.rate || '',
    'Raw KHR': item.amountKhrRaw,
    'Rounded KHR': item.amountKhrRounded,
    'Round Diff KHR': item.khrRoundDifference,

    ...buildBreakdownColumns(data, item.khrBreakdown),
  }))
}

function buildDetailRows(data) {
  return data.items.map((item, index) => ({
    No: index + 1,

    'OT Request No': item.requestNo,
    'OT Date': item.otDateDisplay,
    'Day Type': item.dayType,
    Status: item.status,

    'Employee ID': item.employeeNo,
    'Employee Name': item.employeeName,
    Department: item.departmentName,
    Position: item.positionName,
    Line: item.lineName,
    Shift: item.shiftName,

    'OT Option': item.shiftOtOptionLabel,
    'Start Time': item.requestStartTime,
    'End Time': item.requestEndTime,

    'Requested Minutes': item.requestedMinutes,
    'Break Minutes': item.breakMinutes,
    'Paid Minutes': item.requestPaidMinutes,
    'Payable Minutes': item.payableMinutes,
    'Payable Hours': item.payableHours,

    'Monthly Salary': item.monthlySalary,
    'Hourly Rate': item.hourlyRate,
    Multiplier: item.multiplier,

    Currency: item.currency,
    'Amount USD': item.amountUsd,
    Rate: item.exchangeRate,
    'Raw KHR': item.amountKhrRaw,
    'Rounded KHR': item.amountKhrRounded,
    'Round Diff KHR': item.khrRoundDifference,

    ...buildBreakdownColumns(data, item.khrBreakdown),

    'Salary Found': item.hasSalary ? 'Yes' : 'No',
    'Salary Row No': item.salaryRowNo || '',
  }))
}

function buildCashSummaryRows(data) {
  const breakdown = data.summary.totalKhrBreakdown || {}

  return getDenominations(data).map((denomination, index) => ({
    No: index + 1,
    Denomination: denomination,
    Papers: n(breakdown[String(denomination)], 0),
    Total: denomination * n(breakdown[String(denomination)], 0),
  }))
}

function buildIssuesRows(data) {
  const rows = []

  for (const item of data.issues.invalidSalaryRows || []) {
    rows.push({
      Type: 'Invalid Salary Row',
      Row: item.rowNo || '',
      'Employee ID': item.employeeNo || '',
      Name: item.name || item.rawName || '',
      Reason: item.reason || '',
    })
  }

  for (const item of data.issues.duplicateSalaryRows || []) {
    rows.push({
      Type: 'Duplicate Salary Row',
      Row: item.rowNo || '',
      'Employee ID': item.employeeNo || '',
      Name: item.name || '',
      Reason: item.reason || '',
    })
  }

  for (const item of data.issues.missingSalaryEmployees || []) {
    rows.push({
      Type: 'Missing Salary',
      Row: '',
      'Employee ID': item.employeeNo || '',
      Name: item.employeeName || '',
      Reason: item.reason || '',
    })
  }

  return rows
}

function applyColumnWidths(sheet, widths = []) {
  sheet['!cols'] = widths.map((wch) => ({ wch }))
}

function appendAoaSheet(workbook, name, rows, widths = []) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  applyColumnWidths(sheet, widths)
  XLSX.utils.book_append_sheet(workbook, sheet, name)
}

function appendJsonSheet(workbook, name, rows, widths = []) {
  const sheet = XLSX.utils.json_to_sheet(rows)
  applyColumnWidths(sheet, widths)
  XLSX.utils.book_append_sheet(workbook, sheet, name)
}

function denominationWidths(data) {
  return getDenominations(data).map(() => 10)
}

function buildPaymentWorkbook(data) {
  const workbook = XLSX.utils.book_new()

  appendAoaSheet(workbook, 'Summary', buildSummaryRows(data), [30, 36])

  appendJsonSheet(
    workbook,
    'Employee Summary',
    buildEmployeeSummaryRows(data),
    [
      8, 16, 28, 22, 22, 18,
      16, 12, 14, 18, 18,
      14, 12, 14, 16, 16,
      ...denominationWidths(data),
    ],
  )

  appendJsonSheet(
    workbook,
    'Day Type Summary',
    buildDayTypeSummaryRows(data),
    [
      8, 18, 14, 18, 18,
      14, 12, 14, 16, 16,
      ...denominationWidths(data),
    ],
  )

  appendJsonSheet(
    workbook,
    'Details',
    buildDetailRows(data),
    [
      8, 18, 14, 16, 14,
      16, 28, 22, 22, 18, 18,
      24, 14, 14,
      18, 16, 14, 18, 18,
      16, 16, 12,
      12, 14, 12, 14, 16, 16,
      ...denominationWidths(data),
      14, 14,
    ],
  )

  appendJsonSheet(
    workbook,
    'Cash Summary',
    buildCashSummaryRows(data),
    [8, 16, 12, 18],
  )

  appendJsonSheet(
    workbook,
    'Issues',
    buildIssuesRows(data),
    [24, 10, 16, 28, 42],
  )

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

module.exports = {
  buildSalaryTemplateWorkbook,
  buildPaymentWorkbook,
}