// backend/src/modules/attendance/utils/attendanceParser.js

const XLSX = require('xlsx')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400) {
  const err = new Error(message)
  err.status = status
  err.statusCode = status
  return err
}

function normalizeHeader(value) {
  return s(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeEmployeeId(value) {
  return upper(value)
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
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(
      value.getUTCDate(),
    )}`
  }

  const raw = s(value)
  if (!raw) return ''

  if (isYMD(raw)) return raw

  if (/^\d{1,5}(\.\d+)?$/.test(raw)) {
    const serialParsed = parseExcelSerialDate(raw)
    if (serialParsed) return serialParsed
  }

  let match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (match) {
    return `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`
  }

  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const part1 = Number(match[1])
    const part2 = Number(match[2])
    const year = Number(match[3])

    // Prefer DD/MM/YYYY. If impossible, safely swap.
    let day = part1
    let month = part2

    if (part1 <= 12 && part2 > 12) {
      month = part1
      day = part2
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(
      parsed.getUTCDate(),
    )}`
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

function parseDateTimeTimeValue(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''

  const hh = value.getUTCHours()
  const mm = value.getUTCMinutes()

  return `${pad2(hh)}:${pad2(mm)}`
}

function parseTimeValue(value) {
  if (value == null || value === '') return ''

  if (value instanceof Date) {
    const parsedDateTime = parseDateTimeTimeValue(value)
    if (parsedDateTime) return parsedDateTime
  }

  const raw = s(value)
  if (!raw) return ''

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const fractionTime = parseExcelTimeFraction(raw)
    if (fractionTime) return fractionTime
  }

  let match = raw.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/)
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

function normalizeAttendanceStatus(value) {
  const raw = upper(value)

  if (!raw) return 'PRESENT'

  if (['PRESENT', 'ATTENDED', 'WORKING', 'WORK', 'P'].includes(raw)) {
    return 'PRESENT'
  }

  if (['ABSENT', 'A'].includes(raw)) {
    return 'ABSENT'
  }

  if (['LEAVE', 'ONLEAVE', 'ON LEAVE', 'L'].includes(raw)) {
    return 'LEAVE'
  }

  if (['OFF', 'DAYOFF', 'DAY OFF', 'RESTDAY', 'REST DAY'].includes(raw)) {
    return 'OFF'
  }

  return 'UNKNOWN'
}

function detectColumnIndexes(headerRow = []) {
  const normalizedHeaders = headerRow.map(normalizeHeader)

  const aliases = {
    employeeId: [
      'employeeid',
      'employeeno',
      'employee',
      'empid',
      'empno',
      'employeecode',
      'empcode',
      'staffid',
      'staffcode',
      'id',
    ],

    employeeName: [
      'employeename',
      'staffname',
      'name',
      'displayname',
      'fullname',
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
      'in',
    ],

    clockOut: [
      'clockout',
      'timeout',
      'checkout',
      'outtime',
      'lastout',
      'out',
    ],

    status: [
      'status',
      'attendancestatus',
      'daystatus',
      'remark',
    ],

    position: [
      'position',
      'positionname',
      'jobtitle',
      'title',
    ],

    department: [
      'department',
      'departmentname',
      'dept',
      'deptname',
    ],

    shift: [
      'shift',
      'shiftname',
      'shiftcode',
      'shifttype',
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

function normalizeWorksheetRows(worksheet) {
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  })
}

function getCell(row, index) {
  if (!Array.isArray(row)) return ''
  if (index < 0) return ''
  return row[index] ?? ''
}

function parseAttendanceWorkbook(buffer, options = {}) {
  const fixedAttendanceDate = s(options.attendanceDate)

  if (!isYMD(fixedAttendanceDate)) {
    throw createHttpError('Attendance date is required and must be in YYYY-MM-DD format', 400)
  }

  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw createHttpError('Attendance file is empty or invalid', 400)
  }

  let workbook

  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
    })
  } catch (error) {
    throw createHttpError('Unable to read attendance file', 400)
  }

  const firstSheetName = workbook.SheetNames?.[0]

  if (!firstSheetName) {
    throw createHttpError('Attendance file does not contain any worksheet', 400)
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = normalizeWorksheetRows(worksheet)

  if (!Array.isArray(rows) || !rows.length) {
    throw createHttpError('Attendance worksheet is empty', 400)
  }

  const headerRowIndex = rows.findIndex((row) => Array.isArray(row) && hasMeaningfulValue(row))

  if (headerRowIndex === -1) {
    throw createHttpError('Attendance worksheet header row not found', 400)
  }

  const headerRow = Array.isArray(rows[headerRowIndex]) ? rows[headerRowIndex] : []
  const columnIndexes = detectColumnIndexes(headerRow)

  if (columnIndexes.employeeId === -1) {
    throw createHttpError('Attendance file must contain an Employee ID column', 400)
  }

  if (columnIndexes.clockIn === -1) {
    throw createHttpError('Attendance file must contain a Clock In column', 400)
  }

  if (columnIndexes.clockOut === -1) {
    throw createHttpError('Attendance file must contain a Clock Out column', 400)
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

    const importedEmployeeId = normalizeEmployeeId(getCell(row, columnIndexes.employeeId))
    const importedEmployeeName =
      columnIndexes.employeeName >= 0 ? s(getCell(row, columnIndexes.employeeName)) : ''

    const importedDepartmentName =
      columnIndexes.department >= 0 ? s(getCell(row, columnIndexes.department)) : ''

    const importedPositionName =
      columnIndexes.position >= 0 ? s(getCell(row, columnIndexes.position)) : ''

    const importedShiftName =
      columnIndexes.shift >= 0 ? s(getCell(row, columnIndexes.shift)) : ''

    const rowAttendanceDate =
      columnIndexes.attendanceDate >= 0
        ? parseDateValue(getCell(row, columnIndexes.attendanceDate))
        : ''

    const attendanceDate = rowAttendanceDate || fixedAttendanceDate

    const rawClockIn = getCell(row, columnIndexes.clockIn)
    const rawClockOut = getCell(row, columnIndexes.clockOut)

    const clockIn = parseTimeValue(rawClockIn)
    const clockOut = parseTimeValue(rawClockOut)

    const status =
      columnIndexes.status >= 0
        ? normalizeAttendanceStatus(getCell(row, columnIndexes.status))
        : 'PRESENT'

    if (!importedEmployeeId) {
      failedRows.push({
        rawRowNo,
        message: 'Employee ID is required',
        rawData,
      })
      continue
    }

    if (!isYMD(attendanceDate)) {
      failedRows.push({
        rawRowNo,
        message: 'Attendance date is invalid',
        rawData,
      })
      continue
    }

    if (s(rawClockIn) && !clockIn) {
      failedRows.push({
        rawRowNo,
        message: 'Clock In time is invalid',
        rawData,
      })
      continue
    }

    if (s(rawClockOut) && !clockOut) {
      failedRows.push({
        rawRowNo,
        message: 'Clock Out time is invalid',
        rawData,
      })
      continue
    }

    const duplicateKey = `${importedEmployeeId}|${attendanceDate}`

    if (duplicateKeySet.has(duplicateKey)) {
      duplicateRowCount += 1
      continue
    }

    duplicateKeySet.add(duplicateKey)

    parsedRows.push({
      rawRowNo,
      importedEmployeeId,
      importedEmployeeName,
      importedDepartmentName,
      importedPositionName,
      importedShiftName,

      // Backend/import dialog remains source of truth.
      // Row date is accepted only for compatibility, but dialog date is still enough.
      attendanceDate,

      clockIn,
      clockOut,
      status,

      rawData,
    })
  }

  return {
    fileName: s(options.fileName),
    sheetName: firstSheetName,
    attendanceDate: fixedAttendanceDate,

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