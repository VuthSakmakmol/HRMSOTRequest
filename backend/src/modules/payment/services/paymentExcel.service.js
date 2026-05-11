// backend/src/modules/payment/services/paymentExcel.service.js

const XLSX = require('xlsx')

function s(value) {
  return String(value ?? '').trim()
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
  return [
    ['Period From', data.period.fromDateDisplay],
    ['Period To', data.period.toDateDisplay],
    ['Formula', `${data.formula.code} - ${data.formula.name}`],
    ['Currency', data.formula.currency],
    ['OT Requests', data.otRequestCount],
    ['Payment Rows', data.summary.totalItemCount],
    ['Payable Rows', data.summary.payableItemCount],
    ['Missing Salary Rows', data.summary.missingSalaryItemCount],
    ['Total Payable Minutes', data.summary.totalPayableMinutes],
    ['Total Payable Hours', data.summary.totalPayableHours],
    ['Total Amount', data.summary.totalAmount],
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
    Amount: item.amount,
  }))
}

function buildDayTypeSummaryRows(data) {
  return data.summary.summaryByDayType.map((item, index) => ({
    No: index + 1,
    'Day Type': item.dayType,
    'Request Count': item.requestCount,
    'Payable Minutes': item.payableMinutes,
    'Payable Hours': item.payableHours,
    Amount: item.amount,
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
    Amount: item.amount,

    'Salary Found': item.hasSalary ? 'Yes' : 'No',
    'Salary Row No': item.salaryRowNo || '',
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

function buildPaymentWorkbook(data) {
  const workbook = XLSX.utils.book_new()

  appendAoaSheet(workbook, 'Summary', buildSummaryRows(data), [28, 32])

  appendJsonSheet(
    workbook,
    'Employee Summary',
    buildEmployeeSummaryRows(data),
    [8, 16, 28, 22, 22, 18, 16, 12, 16, 18, 18, 16],
  )

  appendJsonSheet(
    workbook,
    'Day Type Summary',
    buildDayTypeSummaryRows(data),
    [8, 18, 16, 18, 18, 16],
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
      16, 16, 12, 12, 14,
      14, 14,
    ],
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