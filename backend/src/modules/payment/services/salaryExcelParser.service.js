// backend/src/modules/payment/services/salaryExcelParser.service.js

const XLSX = require('xlsx')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  return error
}

function normalizeHeader(value) {
  return upper(value)
    .replace(/\s+/g, '')
    .replace(/[_-]/g, '')
    .replace(/[^\w]/g, '')
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null

  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .trim()

  if (!cleaned) return null

  const number = Number(cleaned)

  return Number.isFinite(number) ? number : null
}

function findValue(row, possibleHeaders = []) {
  const normalizedRow = {}

  Object.entries(row || {}).forEach(([key, value]) => {
    normalizedRow[normalizeHeader(key)] = value
  })

  for (const header of possibleHeaders) {
    const key = normalizeHeader(header)

    if (Object.prototype.hasOwnProperty.call(normalizedRow, key)) {
      return normalizedRow[key]
    }
  }

  return undefined
}

function normalizeEmployeeNo(value) {
  return upper(value)
}

function parseSalaryRow(row = {}, index = 0) {
  const excelRowNo = index + 2

  const employeeNo = normalizeEmployeeNo(
    findValue(row, [
      'Employee ID',
      'Employee No',
      'EmployeeNo',
      'Employee Code',
      'EmployeeCode',
      'Emp ID',
      'EmpNo',
      'Staff ID',
      'Staff Code',
      'ID',
      'Code',
    ]),
  )

  const name = s(
    findValue(row, [
      'Name',
      'Employee Name',
      'EmployeeName',
      'Full Name',
      'FullName',
      'Staff Name',
    ]),
  )

  const salary = toNumber(
    findValue(row, [
      'Salary',
      'Monthly Salary',
      'MonthlySalary',
      'Base Salary',
      'BaseSalary',
      'Wage',
      'Basic Salary',
      'BasicSalary',
    ]),
  )

  return {
    excelRowNo,
    employeeNo,
    name,
    salary,
  }
}

function parseSalaryExcel(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw createHttpError('Salary Excel file is required', 400)
  }

  let workbook

  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
    })
  } catch (error) {
    throw createHttpError('Unable to read salary Excel file', 400)
  }

  const firstSheetName = workbook.SheetNames?.[0]

  if (!firstSheetName) {
    throw createHttpError('Salary Excel has no sheet', 400)
  }

  const sheet = workbook.Sheets[firstSheetName]

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  })

  const salaryMap = new Map()
  const invalidRows = []
  const duplicateRows = []

  rows.forEach((row, index) => {
    const parsed = parseSalaryRow(row, index)

    if (!parsed.employeeNo) {
      invalidRows.push({
        rowNo: parsed.excelRowNo,
        employeeNo: '',
        name: parsed.name,
        reason: 'Missing Employee ID',
      })
      return
    }

    if (parsed.salary === null || parsed.salary < 0) {
      invalidRows.push({
        rowNo: parsed.excelRowNo,
        employeeNo: parsed.employeeNo,
        name: parsed.name,
        reason: 'Invalid salary',
      })
      return
    }

    if (salaryMap.has(parsed.employeeNo)) {
      duplicateRows.push({
        rowNo: parsed.excelRowNo,
        employeeNo: parsed.employeeNo,
        name: parsed.name,
        reason: 'Duplicate employee ID in salary Excel',
      })
      return
    }

    salaryMap.set(parsed.employeeNo, {
      employeeNo: parsed.employeeNo,
      name: parsed.name,
      salary: parsed.salary,
      rowNo: parsed.excelRowNo,
    })
  })

  return {
    salaryMap,
    rowsCount: rows.length,
    validCount: salaryMap.size,
    invalidRows,
    duplicateRows,
    sheetName: firstSheetName,
  }
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

module.exports = {
  parseSalaryExcel,
  buildSalaryTemplateWorkbook,
}