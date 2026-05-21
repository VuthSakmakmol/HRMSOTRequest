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
    return [
      ...new Set(
        denominations
          .map((item) => Math.round(n(item, 0)))
          .filter((item) => item > 0),
      ),
    ].sort((a, b) => b - a)
  }

  return [50000, 20000, 10000, 5000, 1000, 500, 100]
}

function buildBreakdownColumns(data, breakdown = {}) {
  return getDenominations(data).reduce((acc, denomination) => {
    acc[String(denomination)] = n(breakdown[String(denomination)], 0)
    return acc
  }, {})
}

function allowancePolicyText(item = {}) {
  const policies = Array.isArray(item.allowancePolicies) ? item.allowancePolicies : []

  if (!policies.length) return ''

  return policies
    .map((policy) => {
      const code = s(policy.code)
      const name = s(policy.name)
      const amount = n(policy.amount, 0)
      const currency = s(policy.currency)

      return [code, name, amount ? `${amount} ${currency}` : '']
        .filter(Boolean)
        .join(' - ')
    })
    .join('; ')
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

  sheet['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 18 }]

  XLSX.utils.book_append_sheet(workbook, sheet, 'Salary Template')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function buildSummaryRows(data) {
  const exchangeRate = data.exchangeRate || {}
  const summary = data.summary || {}
  const issues = data.issues || {}

  return [
    ['Period From', data.period?.fromDateDisplay || data.period?.fromDate || ''],
    ['Period To', data.period?.toDateDisplay || data.period?.toDate || ''],

    ['Formula', `${data.formula?.code || ''} - ${data.formula?.name || ''}`],
    ['Formula Currency', data.formula?.currency || ''],

    ['Exchange Rate', `${exchangeRate.code || ''} - ${exchangeRate.name || ''}`],
    ['Rate', exchangeRate.rate || ''],
    ['From Currency', exchangeRate.fromCurrency || ''],
    ['To Currency', exchangeRate.toCurrency || ''],
    ['Rounding Mode', exchangeRate.roundingMode || ''],
    ['Rounding Unit', exchangeRate.roundingUnit || ''],
    ['Denominations', getDenominations(data).join(', ')],

    ['OT Requests', data.otRequestCount || 0],
    ['Payment Rows', summary.totalItemCount || 0],
    ['Payable Rows', summary.payableItemCount || 0],
    ['Rows With Allowance', summary.allowanceItemCount || 0],
    ['Missing Salary Rows', summary.missingSalaryItemCount || 0],

    [
      'Missing Payable Employees',
      Array.isArray(issues.missingPayableEmployees)
        ? issues.missingPayableEmployees.length
        : 0,
    ],

    ['Total Payable Minutes', summary.totalPayableMinutes || 0],
    ['Total Payable Hours', summary.totalPayableHours || 0],

    ['OT Amount USD', summary.totalAmountUsd || 0],
    ['OT KHR Raw', summary.totalAmountKhrRaw || 0],
    ['OT KHR Rounded', summary.totalAmountKhrRounded || 0],
    ['OT KHR Round Difference', summary.totalKhrRoundDifference || 0],

    ['Allowance USD', summary.totalAllowanceUsd || 0],
    ['Allowance KHR Raw', summary.totalAllowanceKhrRaw || 0],
    ['Allowance KHR Rounded', summary.totalAllowanceKhrRounded || 0],

    ['Total Payable KHR Raw', summary.totalPayableKhrRaw || 0],
    ['Total Payable KHR Rounded', summary.totalPayableKhrRounded || 0],

    ['Generated At', data.generatedAtDisplayHm || ''],
    ['Exported By', s(data.exportedBy)],
  ]
}

function buildEmployeeSummaryRows(data) {
  const rows = Array.isArray(data.summary?.summaryByEmployee)
    ? data.summary.summaryByEmployee
    : []

  return rows.map((item, index) => ({
    No: index + 1,
    'Employee ID': item.employeeNo || '',
    'Employee Name': item.employeeName || '',
    Department: item.departmentName || '',
    Position: item.positionName || '',
    Line: item.lineName || '',

    'Monthly Salary': n(item.monthlySalary, 0),
    Currency: item.currency || '',
    'Request Count': n(item.requestCount, 0),
    'Allowance Count': n(item.allowanceCount, 0),

    'Payable Minutes': n(item.payableMinutes, 0),
    'Payable Hours': n(item.payableHours, 0),

    'OT Amount USD': n(item.amountUsd, 0),
    Rate: data.exchangeRate?.rate || '',
    'OT Raw KHR': n(item.amountKhrRaw, 0),
    'OT Rounded KHR': n(item.amountKhrRounded, 0),
    'OT Round Diff KHR': n(item.khrRoundDifference, 0),

    'Allowance USD': n(item.allowanceAmountUsd, 0),
    'Allowance Raw KHR': n(item.allowanceAmountKhrRaw, 0),
    'Allowance Rounded KHR': n(item.allowanceAmountKhrRounded, 0),

    'Total Payable Raw KHR': n(item.totalPayableKhrRaw, 0),
    'Total Payable Rounded KHR': n(item.totalPayableKhrRounded, 0),

    ...buildBreakdownColumns(data, item.totalPayableKhrBreakdown),
  }))
}

function buildDayTypeSummaryRows(data) {
  const rows = Array.isArray(data.summary?.summaryByDayType)
    ? data.summary.summaryByDayType
    : []

  return rows.map((item, index) => ({
    No: index + 1,
    'Day Type': item.dayType || '',
    'Request Count': n(item.requestCount, 0),
    'Allowance Count': n(item.allowanceCount, 0),

    'Payable Minutes': n(item.payableMinutes, 0),
    'Payable Hours': n(item.payableHours, 0),

    'OT Amount USD': n(item.amountUsd, 0),
    Rate: data.exchangeRate?.rate || '',
    'OT Raw KHR': n(item.amountKhrRaw, 0),
    'OT Rounded KHR': n(item.amountKhrRounded, 0),
    'OT Round Diff KHR': n(item.khrRoundDifference, 0),

    'Allowance USD': n(item.allowanceAmountUsd, 0),
    'Allowance Raw KHR': n(item.allowanceAmountKhrRaw, 0),
    'Allowance Rounded KHR': n(item.allowanceAmountKhrRounded, 0),

    'Total Payable Raw KHR': n(item.totalPayableKhrRaw, 0),
    'Total Payable Rounded KHR': n(item.totalPayableKhrRounded, 0),

    ...buildBreakdownColumns(data, item.totalPayableKhrBreakdown),
  }))
}

function buildDetailRows(data) {
  const rows = Array.isArray(data.items) ? data.items : []

  return rows.map((item, index) => ({
    No: index + 1,

    'OT Request No': item.requestNo || '',
    'OT Date': item.otDateDisplay || item.otDate || '',
    'Day Type': item.dayType || '',
    Status: item.status || '',

    'Employee ID': item.employeeNo || '',
    'Employee Name': item.employeeName || '',
    Department: item.departmentName || '',
    Position: item.positionName || '',
    Line: item.lineName || '',
    Shift: item.shiftName || '',

    'Start Time': item.requestStartTime || '',
    'End Time': item.requestEndTime || '',

    'Requested Minutes': n(item.requestedMinutes, 0),
    'Break Minutes': n(item.breakMinutes, 0),
    'Request Paid Minutes': n(item.requestPaidMinutes, 0),

    'Actual OT Minutes': n(item.actualOtMinutes, 0),
    'Eligible OT Minutes': n(item.eligibleOtMinutes, 0),
    'Rounded OT Minutes': n(item.roundedOtMinutes, 0),

    'Payable Minutes': n(item.payableMinutes, 0),
    'Payable Hours': n(item.payableHours, 0),

    'Attendance Status': item.attendanceStatus || '',
    'OT Result': item.otResult || '',
    'OT Result Reason': item.otResultReason || '',
    'Payment Blocked Reason': item.paymentBlockedReason || '',

    'Policy Code': item.policyCode || '',
    'Policy Name': item.policyName || '',
    'Policy Round Method': item.policyRoundMethod || '',
    'Policy Round Unit Minutes': n(item.policyRoundUnitMinutes, 0),
    'Policy Min Eligible Minutes': n(item.policyMinEligibleMinutes, 0),

    'Monthly Salary': n(item.monthlySalary, 0),
    'Hourly Rate': n(item.hourlyRate, 0),
    Multiplier: n(item.multiplier, 0),

    Currency: item.currency || '',
    'OT Amount USD': n(item.amountUsd, 0),
    Rate: n(item.exchangeRate, 0),
    'OT Raw KHR': n(item.amountKhrRaw, 0),
    'OT Rounded KHR': n(item.amountKhrRounded, 0),
    'OT Round Diff KHR': n(item.khrRoundDifference, 0),

    'Allowance Policies': allowancePolicyText(item),
    'Allowance Count': n(item.allowanceCount, 0),
    'Allowance USD': n(item.allowanceAmountUsd, 0),
    'Allowance Raw KHR': n(item.allowanceAmountKhrRaw, 0),
    'Allowance Rounded KHR': n(item.allowanceAmountKhrRounded, 0),

    'Total Payable Raw KHR': n(item.totalPayableKhrRaw, 0),
    'Total Payable Rounded KHR': n(item.totalPayableKhrRounded, 0),

    ...buildBreakdownColumns(data, item.totalPayableKhrBreakdown),

    'Salary Found': item.hasSalary ? 'Yes' : 'No',
    'Attendance/Policy Payable Found': item.hasAttendancePolicyPayable ? 'Yes' : 'No',
    'Payment Eligible': item.paymentEligible ? 'Yes' : 'No',
    'Salary Row No': item.salaryRowNo || '',
  }))
}

function buildCashSummaryRows(data) {
  const breakdown =
    data.summary?.totalPayableKhrBreakdown ||
    data.summary?.totalKhrBreakdown ||
    {}

  return getDenominations(data).map((denomination, index) => ({
    No: index + 1,
    Denomination: denomination,
    Papers: n(breakdown[String(denomination)], 0),
    Total: denomination * n(breakdown[String(denomination)], 0),
  }))
}

function buildIssuesRows(data) {
  const rows = []
  const issues = data.issues || {}

  for (const item of issues.invalidSalaryRows || []) {
    rows.push({
      Type: 'Invalid Salary Row',
      Row: item.rowNo || item.excelRowNo || '',
      'OT Request No': '',
      'OT Date': '',
      'Employee ID': item.employeeNo || '',
      Name: item.name || item.rawName || '',
      Department: '',
      Position: '',
      Line: '',
      'OT Result': '',
      Reason: item.reason || '',
    })
  }

  for (const item of issues.duplicateSalaryRows || []) {
    rows.push({
      Type: 'Duplicate Salary Row',
      Row: item.rowNo || item.excelRowNo || '',
      'OT Request No': '',
      'OT Date': '',
      'Employee ID': item.employeeNo || '',
      Name: item.name || '',
      Department: '',
      Position: '',
      Line: '',
      'OT Result': '',
      Reason: item.reason || '',
    })
  }

  for (const item of issues.missingSalaryEmployees || []) {
    rows.push({
      Type: 'Missing Salary',
      Row: '',
      'OT Request No': '',
      'OT Date': '',
      'Employee ID': item.employeeNo || '',
      Name: item.employeeName || '',
      Department: item.departmentName || '',
      Position: item.positionName || '',
      Line: item.lineName || '',
      'OT Result': '',
      Reason: item.reason || 'Salary not found in uploaded salary Excel',
    })
  }

  for (const item of issues.missingPayableEmployees || []) {
    rows.push({
      Type: 'No Attendance/Policy Payable Minutes',
      Row: '',
      'OT Request No': item.requestNo || '',
      'OT Date': item.otDate || '',
      'Employee ID': item.employeeNo || '',
      Name: item.employeeName || '',
      Department: item.departmentName || '',
      Position: item.positionName || '',
      Line: item.lineName || '',
      'OT Result': item.otResult || '',
      Reason: item.reason || 'No attendance/policy payable minutes found',
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

  appendAoaSheet(workbook, 'Summary', buildSummaryRows(data), [34, 42])

  appendJsonSheet(
    workbook,
    'Employee Summary',
    buildEmployeeSummaryRows(data),
    [
      8, 16, 28, 22, 22, 18,
      16, 12, 14, 16,
      18, 18,
      16, 12, 14, 16, 16,
      16, 18, 20,
      22, 24,
      ...denominationWidths(data),
    ],
  )

  appendJsonSheet(
    workbook,
    'Day Type Summary',
    buildDayTypeSummaryRows(data),
    [
      8, 18, 14, 16,
      18, 18,
      16, 12, 14, 16, 16,
      16, 18, 20,
      22, 24,
      ...denominationWidths(data),
    ],
  )

  appendJsonSheet(
    workbook,
    'Details',
    buildDetailRows(data),
    [
      8,

      18, 14, 16, 14,

      16, 28, 22, 22, 18, 18,

      14, 14,

      18, 16, 18,
      18, 18, 18,
      18, 18,

      18, 14, 36, 36,

      16, 24, 18, 18, 20,

      16, 16, 12,

      12, 14, 12, 14, 16, 16,

      34, 16, 16, 18, 22,
      24, 26,

      ...denominationWidths(data),

      14, 28, 16, 14,
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
    [34, 10, 18, 14, 16, 28, 22, 22, 18, 18, 48],
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