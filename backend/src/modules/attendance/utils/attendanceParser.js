// backend/src/modules/attendance/utils/attendanceParser.js
const XLSX = require('xlsx')

function s(value) {
  return String(value ?? '').trim()
}

function normalizeHeader(value) {
  return s(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeEmployeeId(value) {
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

  if (/^\d{1,5}(\.\d+)?$/.test(raw)) {
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
    employeeId: [
      'employeeid',
      'employeeno',
      'empid',
      'empno',
      'employeecode',
      'empcode',
      'staffid',
      'staffcode',
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
    status: [
      'status',
      'attendancestatus',
      'daystatus',
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

function parseAttendanceWorkbook(buffer, options = {}) {
  const fixedAttendanceDate = s(options.attendanceDate)

  if (!isYMD(fixedAttendanceDate)) {
    const err = new Error('Attendance date is required and must be in YYYY-MM-DD format')
    err.status = 400
    throw err
  }

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

  if (columnIndexes.employeeId === -1) {
    const err = new Error('Attendance file must contain an Employee ID column')
    err.status = 400
    throw err
  }

  if (columnIndexes.clockIn === -1) {
    const err = new Error('Attendance file must contain a Clock In column')
    err.status = 400
    throw err
  }

  if (columnIndexes.clockOut === -1) {
    const err = new Error('Attendance file must contain a Clock Out column')
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

    const importedEmployeeId = normalizeEmployeeId(row[columnIndexes.employeeId])

    const clockIn =
      columnIndexes.clockIn >= 0 ? parseTimeValue(row[columnIndexes.clockIn]) : ''

    const clockOut =
      columnIndexes.clockOut >= 0 ? parseTimeValue(row[columnIndexes.clockOut]) : ''

    if (!importedEmployeeId) {
      failedRows.push({
        rawRowNo,
        message: 'Employee ID is required',
        rawData,
      })
      continue
    }

    if (columnIndexes.clockIn >= 0 && s(row[columnIndexes.clockIn]) && !clockIn) {
      failedRows.push({
        rawRowNo,
        message: 'Clock In time is invalid',
        rawData,
      })
      continue
    }

    if (columnIndexes.clockOut >= 0 && s(row[columnIndexes.clockOut]) && !clockOut) {
      failedRows.push({
        rawRowNo,
        message: 'Clock Out time is invalid',
        rawData,
      })
      continue
    }

    const duplicateKey = `${importedEmployeeId}|${fixedAttendanceDate}`

    if (duplicateKeySet.has(duplicateKey)) {
      duplicateRowCount += 1
      continue
    }

    duplicateKeySet.add(duplicateKey)

    parsedRows.push({
      rawRowNo,
      importedEmployeeId,

      // ✅ no longer imported from Excel
      importedEmployeeName: '',
      importedDepartmentName: '',
      importedPositionName: '',
      importedShiftName: '',

      // ✅ selected once from dialog
      attendanceDate: fixedAttendanceDate,

      clockIn,
      clockOut,

      // Backend still derives final status using shift + clock.
      status: 'PRESENT',

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