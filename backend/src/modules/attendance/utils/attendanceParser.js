// backend/src/modules/attendance/utils/attendanceParser.js
const XLSX = require('xlsx')

function s(value) {
  return String(value ?? '').trim()
}

function normalizeHeader(value) {
  return s(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeEmployeeNo(value) {
  return s(value).toUpperCase()
}

function isYMD(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s(value))
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function parseExcelSerialDate(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''

  const parsed = XLSX.SSF.parse_date_code(numeric)
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return ''

  return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
  }

  const raw = s(value)
  if (!raw) return ''

  if (isYMD(raw)) return raw

  if (/^\d{5}(\.\d+)?$/.test(raw) || /^\d{1,5}(\.\d+)?$/.test(raw)) {
    const serialParsed = parseExcelSerialDate(raw)
    if (serialParsed) return serialParsed
  }

  let match = raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/)
  if (match) {
    return `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`
  }

  match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (match) {
    const part1 = Number(match[1])
    const part2 = Number(match[2])
    const year = Number(match[3])

    let day = part1
    let month = part2

    if (part1 <= 12 && part2 > 12) {
      month = part1
      day = part2
    }

    return `${year}-${pad2(month)}-${pad2(day)}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`
  }

  return ''
}

function parseExcelTimeFraction(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''

  const fraction = numeric >= 1 ? numeric % 1 : numeric
  if (fraction < 0 || fraction >= 1) return ''

  let totalMinutes = Math.round(fraction * 24 * 60)
  if (totalMinutes >= 24 * 60) totalMinutes = 0

  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${pad2(hh)}:${pad2(mm)}`
}

function parseTimeValue(value) {
  if (value == null || value === '') return ''

  const raw = s(value)
  if (!raw) return ''

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const fractionTime = parseExcelTimeFraction(raw)
    if (fractionTime) return fractionTime
  }

  let match = raw.match(/^(\d{1,2}):(\d{1,2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])

    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  match = raw.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])

    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  match = raw.match(/^(\d{1,2})(\d{2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])

    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${pad2(hh)}:${pad2(mm)}`
    }
  }

  return ''
}

function parseMinutesValue(value) {
  const raw = s(value)
  if (!raw) return null

  const numeric = Number(raw)
  if (!Number.isFinite(numeric) || numeric < 0) return null

  return Math.round(numeric)
}

function toMinutes(hhmm) {
  const raw = s(hhmm)
  const match = raw.match(/^(\d{2}):(\d{2})$/)

  if (!match) return null

  const hh = Number(match[1])
  const mm = Number(match[2])
  return hh * 60 + mm
}

function calculateMinutesFromTimes(clockIn, clockOut) {
  const start = toMinutes(clockIn)
  const end = toMinutes(clockOut)

  if (start == null || end == null) return null

  let total = end - start
  if (total < 0) total += 24 * 60
  if (total < 0) return null

  return total
}

function normalizeAttendanceStatus(value) {
  const raw = s(value).toUpperCase()

  if (!raw) return 'PRESENT'
  if (['PRESENT', 'ATTENDED', 'WORKING', 'WORK'].includes(raw)) return 'PRESENT'
  if (['ABSENT', 'A'].includes(raw)) return 'ABSENT'
  if (['LEAVE', 'ONLEAVE'].includes(raw)) return 'LEAVE'
  if (['OFF', 'DAYOFF', 'RESTDAY'].includes(raw)) return 'OFF'

  return 'UNKNOWN'
}

function detectColumnIndexes(headerRow = []) {
  const normalizedHeaders = headerRow.map(normalizeHeader)

  const aliases = {
    employeeNo: [
      'employeeno',
      'empno',
      'employeecode',
      'empcode',
      'staffcode',
      'staffid',
      'employeeid',
    ],
    employeeName: [
      'employeename',
      'staffname',
      'name',
      'displayname',
    ],
    attendanceDate: [
      'attendancedate',
      'date',
      'workdate',
      'otdate',
    ],
    clockIn: [
      'clockin',
      'timein',
      'checkin',
      'intime',
      'firstin',
    ],
    clockOut: [
      'clockout',
      'timeout',
      'checkout',
      'outtime',
      'lastout',
    ],
    workMinutes: [
      'workminutes',
      'workingminutes',
      'minutesworked',
      'workedminutes',
      'workmins',
      'workmin',
    ],
    otMinutes: [
      'otminutes',
      'overtimeminutes',
      'otmins',
      'otmin',
    ],
    status: [
      'status',
      'attendancestatus',
      'daystatus',
    ],
  }

  const result = {}

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const index = normalizedHeaders.findIndex((item) => fieldAliases.includes(item))
    result[field] = index >= 0 ? index : -1
  }

  return result
}

function buildRawRowObject(headerRow = [], row = []) {
  const result = {}

  for (let i = 0; i < headerRow.length; i += 1) {
    const key = s(headerRow[i]) || `Column_${i + 1}`
    result[key] = row[i] ?? ''
  }

  return result
}

function hasMeaningfulValue(row = []) {
  return row.some((cell) => s(cell) !== '')
}

function parseAttendanceWorkbook(buffer, options = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    const err = new Error('Attendance file is empty or invalid')
    err.status = 400
    throw err
  }

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch (error) {
    const err = new Error('Unable to read attendance file')
    err.status = 400
    throw err
  }

  const firstSheetName = workbook.SheetNames?.[0]
  if (!firstSheetName) {
    const err = new Error('Attendance file does not contain any worksheet')
    err.status = 400
    throw err
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })

  if (!Array.isArray(rows) || !rows.length) {
    const err = new Error('Attendance worksheet is empty')
    err.status = 400
    throw err
  }

  const headerRowIndex = rows.findIndex((row) => Array.isArray(row) && hasMeaningfulValue(row))
  if (headerRowIndex === -1) {
    const err = new Error('Attendance worksheet header row not found')
    err.status = 400
    throw err
  }

  const headerRow = Array.isArray(rows[headerRowIndex]) ? rows[headerRowIndex] : []
  const columnIndexes = detectColumnIndexes(headerRow)

  if (columnIndexes.employeeNo === -1) {
    const err = new Error('Attendance file must contain an employee number column')
    err.status = 400
    throw err
  }

  if (columnIndexes.attendanceDate === -1) {
    const err = new Error('Attendance file must contain an attendance date column')
    err.status = 400
    throw err
  }

  const parsedRows = []
  const failedRows = []
  const duplicateKeySet = new Set()
  let duplicateRowCount = 0
  let rowCount = 0

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = Array.isArray(rows[i]) ? rows[i] : []

    if (!hasMeaningfulValue(row)) continue
    rowCount += 1

    const rawRowNo = i + 1
    const rawData = buildRawRowObject(headerRow, row)

    const employeeNo = normalizeEmployeeNo(row[columnIndexes.employeeNo])
    const employeeName =
      columnIndexes.employeeName >= 0 ? s(row[columnIndexes.employeeName]) : ''
    const attendanceDate = parseDateValue(row[columnIndexes.attendanceDate])

    const clockIn =
      columnIndexes.clockIn >= 0 ? parseTimeValue(row[columnIndexes.clockIn]) : ''
    const clockOut =
      columnIndexes.clockOut >= 0 ? parseTimeValue(row[columnIndexes.clockOut]) : ''

    let workMinutes =
      columnIndexes.workMinutes >= 0 ? parseMinutesValue(row[columnIndexes.workMinutes]) : null

    const otMinutes =
      columnIndexes.otMinutes >= 0 ? parseMinutesValue(row[columnIndexes.otMinutes]) : null

    const status =
      columnIndexes.status >= 0
        ? normalizeAttendanceStatus(row[columnIndexes.status])
        : 'PRESENT'

    if (!employeeNo) {
      failedRows.push({
        rawRowNo,
        message: 'Employee number is required',
        rawData,
      })
      continue
    }

    if (!attendanceDate) {
      failedRows.push({
        rawRowNo,
        message: 'Attendance date is missing or invalid',
        rawData,
      })
      continue
    }

    if (columnIndexes.clockIn >= 0 && s(row[columnIndexes.clockIn]) && !clockIn) {
      failedRows.push({
        rawRowNo,
        message: 'Clock in time is invalid',
        rawData,
      })
      continue
    }

    if (columnIndexes.clockOut >= 0 && s(row[columnIndexes.clockOut]) && !clockOut) {
      failedRows.push({
        rawRowNo,
        message: 'Clock out time is invalid',
        rawData,
      })
      continue
    }

    if (workMinutes == null && clockIn && clockOut) {
      workMinutes = calculateMinutesFromTimes(clockIn, clockOut)
    }

    const duplicateKey = `${employeeNo}|${attendanceDate}`
    if (duplicateKeySet.has(duplicateKey)) {
      duplicateRowCount += 1
      continue
    }

    duplicateKeySet.add(duplicateKey)

    parsedRows.push({
      rawRowNo,
      employeeNo,
      employeeName,
      attendanceDate,
      clockIn,
      clockOut,
      workMinutes,
      otMinutes,
      status,
      rawData,
    })
  }

  return {
    fileName: s(options.fileName),
    sheetName: firstSheetName,
    rowCount,
    duplicateRowCount,
    failedRows,
    rows: parsedRows,
    detectedColumns: columnIndexes,
  }
}

module.exports = {
  parseAttendanceWorkbook,
}