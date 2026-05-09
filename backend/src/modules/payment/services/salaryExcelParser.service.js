// backend/src/modules/payment/services/salaryExcelParser.service.js

const XLSX = require('xlsx')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizeHeader(value) {
  return upper(value)
    .replace(/\s+/g, '')
    .replace(/[_-]/g, '')
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null

  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/\$/g, '')
    .trim()

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

function parseSalaryExcel(buffer) {
  if (!buffer) {
    const error = new Error('Salary Excel file is required')
    error.statusCode = 400
    throw error
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheetName = workbook.SheetNames?.[0]

  if (!firstSheetName) {
    const error = new Error('Salary Excel has no sheet')
    error.statusCode = 400
    throw error
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
    const excelRowNo = index + 2

    const employeeNo = upper(
      findValue(row, [
        'Employee ID',
        'Employee No',
        'EmployeeNo',
        'Emp ID',
        'EmpNo',
        'ID',
        'Code',
      ])
    )

    const name = s(
      findValue(row, [
        'Name',
        'Employee Name',
        'Full Name',
      ])
    )

    const salary = toNumber(
      findValue(row, [
        'Salary',
        'Monthly Salary',
        'Base Salary',
        'Wage',
      ])
    )

    if (!employeeNo) {
      invalidRows.push({
        rowNo: excelRowNo,
        reason: 'Missing Employee ID',
        rawName: name,
      })
      return
    }

    if (salary === null || salary < 0) {
      invalidRows.push({
        rowNo: excelRowNo,
        employeeNo,
        name,
        reason: 'Invalid salary',
      })
      return
    }

    if (salaryMap.has(employeeNo)) {
      duplicateRows.push({
        rowNo: excelRowNo,
        employeeNo,
        name,
        reason: 'Duplicate employee ID in salary Excel',
      })
      return
    }

    salaryMap.set(employeeNo, {
      employeeNo,
      name,
      salary,
      rowNo: excelRowNo,
    })
  })

  return {
    salaryMap,
    rowsCount: rows.length,
    validCount: salaryMap.size,
    invalidRows,
    duplicateRows,
  }
}

module.exports = {
  parseSalaryExcel,
}