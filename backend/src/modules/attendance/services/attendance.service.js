// backend/src/modules/attendance/services/attendance.service.js
const path = require('path')
const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AttendanceImport = require('../models/AttendanceImport')
const AttendanceRecord = require('../models/AttendanceRecord')
const Employee = require('../../org/models/Employee')
const OTRequest = require('../../ot/models/OTRequest')
const Holiday = require('../../calendar/models/Holiday')
const { getDayType } = require('../../ot/utils/dayClassifier')
const { parseAttendanceWorkbook } = require('../utils/attendanceParser')
const {
  deriveAttendanceResult,
  verifyAttendanceAgainstOT,
} = require('../utils/attendanceVerification')

const SHIFT_IN_TOLERANCE_MINUTES = 240
const SHIFT_OUT_TOLERANCE_MINUTES = 360
const LATE_GRACE_MINUTES = 0

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizeComparable(value) {
  return s(value)
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeIdArray(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((id) => s(id)).filter(Boolean)))
}

function parseYMDToUtcRange(ymd) {
  const raw = s(ymd)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    const err = new Error(`Invalid date format: ${raw}`)
    err.status = 400
    throw err
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))

  return { start, end }
}

function toUtcMidnight(ymd) {
  const { start } = parseYMDToUtcRange(ymd)
  return start
}

function toMinutes(hhmm) {
  const raw = s(hhmm)
  const match = raw.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const hh = Number(match[1])
  const mm = Number(match[2])

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function compareImportedValue(importedValue, masterCandidates = []) {
  const imported = normalizeComparable(importedValue)
  if (!imported) return null

  const normalizedCandidates = masterCandidates
    .map((item) => normalizeComparable(item))
    .filter(Boolean)

  if (!normalizedCandidates.length) return false
  return normalizedCandidates.includes(imported)
}

function buildShiftCandidates(shiftDoc) {
  return [shiftDoc?.code, shiftDoc?.name, shiftDoc?.type]
}

function evaluateShiftTimeMatch({ clockIn, clockOut, shiftStartTime, shiftEndTime }) {
  const startMinutes = toMinutes(shiftStartTime)
  const endMinutes = toMinutes(shiftEndTime)

  if (startMinutes == null || endMinutes == null) {
    return {
      shiftTimeMatched: null,
      issues: [],
    }
  }

  const inMinutes = toMinutes(clockIn)
  const outMinutes = toMinutes(clockOut)

  if (inMinutes == null && outMinutes == null) {
    return {
      shiftTimeMatched: null,
      issues: [],
    }
  }

  const isCrossMidnight = endMinutes <= startMinutes
  let isMatched = true

  if (inMinutes != null) {
    const inDiff = Math.abs(inMinutes - startMinutes)
    if (inDiff > SHIFT_IN_TOLERANCE_MINUTES) {
      isMatched = false
    }
  }

  if (outMinutes != null) {
    let actualOut = outMinutes
    let expectedOut = endMinutes

    if (isCrossMidnight) {
      expectedOut += 24 * 60

      if (actualOut <= startMinutes) {
        actualOut += 24 * 60
      }
    }

    const outDiff = Math.abs(actualOut - expectedOut)
    if (outDiff > SHIFT_OUT_TOLERANCE_MINUTES) {
      isMatched = false
    }
  }

  return {
    shiftTimeMatched: isMatched,
    issues: isMatched ? [] : ['Clock in/out does not align with assigned shift time'],
  }
}

function resolveShiftMatchStatus({ shiftMatched, shiftTimeMatched }) {
  if (shiftMatched === false || shiftTimeMatched === false) return 'MISMATCH'
  if (shiftMatched === true || shiftTimeMatched === true) return 'MATCHED'
  return 'UNKNOWN'
}

async function resolveHolidayDateStrings(dateStrings = []) {
  const uniqueDates = Array.from(
    new Set((Array.isArray(dateStrings) ? dateStrings : []).map((d) => s(d)).filter(Boolean)),
  )

  if (!uniqueDates.length) return []

  const orConditions = uniqueDates.map((ymd) => {
    const { start, end } = parseYMDToUtcRange(ymd)
    return { date: { $gte: start, $lt: end } }
  })

  const docs = await Holiday.find({
    isActive: true,
    $or: orConditions,
  })
    .select({ date: 1 })
    .lean()

  return docs
    .map((doc) => {
      if (!(doc?.date instanceof Date) || Number.isNaN(doc.date.getTime())) return ''
      return doc.date.toISOString().slice(0, 10)
    })
    .filter(Boolean)
}

function buildAttendanceImportSampleWorkbook() {
  const workbook = XLSX.utils.book_new()

  const sampleRows = [
    [
      'Employee ID',
      'Employee Name',
      'Attendance Date',
      'Clock In',
      'Clock Out',
      'Status',
      'Position',
      'Department',
      'Shift',
    ],
    ['52520351', 'Sakmakmol', '2026-04-21', '08:00', '17:30', 'PRESENT', 'Leader', 'IT', 'DAY'],
    ['52520352', 'Sok Dara', '2026-04-21', '18:00', '03:00', 'PRESENT', 'Operator', 'Sewing', 'NIGHT'],
    ['52520353', 'Chan Rithy', '2026-04-21', '', '', 'ABSENT', 'Staff', 'HR', 'DAY'],
  ]

  const guideRows = [
    ['Attendance Import Guide'],
    [],
    ['1. Download this sample file.'],
    ['2. Fill your attendance rows in the same column format as the Sample sheet.'],
    [
      '3. Required columns: Employee ID, Employee Name, Attendance Date, Clock In, Clock Out, Status, Position, Department, Shift.',
    ],
    ['4. Employee ID maps to employeeNo in Employee master.'],
    ['5. Attendance Date format: YYYY-MM-DD'],
    ['6. Time format: HH:mm'],
    ['7. Imported Status is only a hint. Backend derives final attendance status from punches + assigned shift.'],
    ['8. Department / Position / Shift are validated against Employee master, not used as source of truth.'],
    ['9. Night shift rows are validated against assigned shift time logic.'],
  ]

  const sampleSheet = XLSX.utils.aoa_to_sheet(sampleRows)
  sampleSheet['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ]

  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)
  guideSheet['!cols'] = [{ wch: 110 }]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

async function downloadImportSample() {
  return {
    filename: 'attendance-import-sample.xlsx',
    buffer: buildAttendanceImportSampleWorkbook(),
  }
}

function buildImportSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return null

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { importNo: regex },
      { fileName: regex },
      { storedFileName: regex },
      { mimeType: regex },
      { remark: regex },
    ],
  }
}

function buildRecordSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return null

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { employeeNo: regex },
      { importedEmployeeId: regex },
      { employeeName: regex },
      { importedEmployeeName: regex },
      { importedDepartmentName: regex },
      { importedPositionName: regex },
      { importedShiftName: regex },
      { importedStatus: regex },
      { status: regex },
      { derivedStatusReason: regex },
      { matchRemark: regex },
      { validationIssues: regex },
      { 'rawData.Employee ID': regex },
      { 'rawData.Employee Name': regex },
    ],
  }
}

function buildImportFilter(query) {
  const filter = {}

  if (s(query.status)) filter.status = upper(query.status)
  if (s(query.sourceType)) filter.sourceType = upper(query.sourceType)

  if (s(query.periodFrom) || s(query.periodTo)) {
    filter.$and = filter.$and || []

    if (s(query.periodFrom)) {
      filter.$and.push({
        $or: [{ periodTo: { $gte: s(query.periodFrom) } }, { periodTo: '' }],
      })
    }

    if (s(query.periodTo)) {
      filter.$and.push({
        $or: [{ periodFrom: { $lte: s(query.periodTo) } }, { periodFrom: '' }],
      })
    }
  }

  const searchFilter = buildImportSearchFilter(query.search)
  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildRecordFilter(query) {
  const filter = {}

  if (s(query.importId) && mongoose.isValidObjectId(query.importId)) {
    filter.importId = query.importId
  }

  if (s(query.employeeId) && mongoose.isValidObjectId(query.employeeId)) {
    filter.employeeId = query.employeeId
  }

  if (s(query.employeeNo)) {
    filter.employeeNo = upper(query.employeeNo)
  }

  if (s(query.status)) filter.status = upper(query.status)
  if (s(query.importedStatus)) filter.importedStatus = upper(query.importedStatus)
  if (s(query.dayType)) filter.dayType = upper(query.dayType)
  if (s(query.matchedBy)) filter.matchedBy = upper(query.matchedBy)
  if (s(query.shiftMatchStatus)) filter.shiftMatchStatus = upper(query.shiftMatchStatus)

  if (s(query.attendanceDateFrom) || s(query.attendanceDateTo)) {
    filter.attendanceDate = {}
    if (s(query.attendanceDateFrom)) filter.attendanceDate.$gte = s(query.attendanceDateFrom)
    if (s(query.attendanceDateTo)) filter.attendanceDate.$lte = s(query.attendanceDateTo)
  }

  const searchFilter = buildRecordSearchFilter(query.search)
  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildImportSort(query) {
  const direction = query.sortOrder === 'asc' ? 1 : -1
  const sortField =
    {
      createdAt: 'createdAt',
      importNo: 'importNo',
      periodFrom: 'periodFrom',
      periodTo: 'periodTo',
      status: 'status',
      rowCount: 'rowCount',
    }[query.sortBy] || 'createdAt'

  return { [sortField]: direction, createdAt: -1 }
}

function buildRecordSort(query) {
  const direction = query.sortOrder === 'asc' ? 1 : -1
  const sortField =
    {
      createdAt: 'createdAt',
      attendanceDate: 'attendanceDate',
      employeeNo: 'employeeNo',
      employeeName: 'employeeName',
      status: 'status',
      importedStatus: 'importedStatus',
      dayType: 'dayType',
      shiftMatchStatus: 'shiftMatchStatus',
      workedMinutes: 'workedMinutes',
      lateMinutes: 'lateMinutes',
      earlyOutMinutes: 'earlyOutMinutes',
    }[query.sortBy] || 'attendanceDate'

  return { [sortField]: direction, createdAt: -1 }
}

function mapImportItem(doc) {
  return {
    id: String(doc._id),
    importNo: s(doc.importNo),
    sourceType: upper(doc.sourceType),
    fileName: s(doc.fileName),
    storedFileName: s(doc.storedFileName),
    mimeType: s(doc.mimeType),
    periodFrom: s(doc.periodFrom),
    periodTo: s(doc.periodTo),
    rowCount: Number(doc.rowCount || 0),
    successRowCount: Number(doc.successRowCount || 0),
    failedRowCount: Number(doc.failedRowCount || 0),
    duplicateRowCount: Number(doc.duplicateRowCount || 0),
    status: upper(doc.status),
    remark: s(doc.remark),
    importedAt: doc.importedAt || null,
    importedBy: doc.importedBy ? String(doc.importedBy) : null,
    importedByEmployeeId: doc.importedByEmployeeId ? String(doc.importedByEmployeeId) : null,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function mapRecordItem(doc) {
  return {
    id: String(doc._id),
    importId: doc.importId ? String(doc.importId) : null,
    employeeId: doc.employeeId ? String(doc.employeeId) : null,
    employeeNo: upper(doc.employeeNo),
    employeeName: s(doc.employeeName),

    importedEmployeeId: upper(doc.importedEmployeeId),
    importedEmployeeName: s(doc.importedEmployeeName),
    importedDepartmentName: s(doc.importedDepartmentName),
    importedPositionName: s(doc.importedPositionName),
    importedShiftName: s(doc.importedShiftName),
    importedStatus: upper(doc.importedStatus),

    departmentId: doc.departmentId ? String(doc.departmentId) : null,
    departmentCode: upper(doc.departmentCode),
    departmentName: s(doc.departmentName),

    positionId: doc.positionId ? String(doc.positionId) : null,
    positionCode: upper(doc.positionCode),
    positionName: s(doc.positionName),

    shiftId: doc.shiftId ? String(doc.shiftId) : null,
    shiftCode: upper(doc.shiftCode),
    shiftName: s(doc.shiftName),
    shiftType: upper(doc.shiftType),
    shiftStartTime: s(doc.shiftStartTime),
    shiftEndTime: s(doc.shiftEndTime),

    attendanceDate: s(doc.attendanceDate),
    clockIn: s(doc.clockIn),
    clockOut: s(doc.clockOut),
    status: upper(doc.status),
    derivedStatusReason: s(doc.derivedStatusReason),
    dayType: upper(doc.dayType),
    matchedBy: upper(doc.matchedBy),
    matchRemark: s(doc.matchRemark),

    employeeMatched: doc.employeeMatched === true,
    nameMatched: typeof doc.nameMatched === 'boolean' ? doc.nameMatched : null,
    departmentMatched: typeof doc.departmentMatched === 'boolean' ? doc.departmentMatched : null,
    positionMatched: typeof doc.positionMatched === 'boolean' ? doc.positionMatched : null,
    shiftMatched: typeof doc.shiftMatched === 'boolean' ? doc.shiftMatched : null,
    shiftTimeMatched: typeof doc.shiftTimeMatched === 'boolean' ? doc.shiftTimeMatched : null,
    shiftMatchStatus: upper(doc.shiftMatchStatus),

    hasClockIn: typeof doc.hasClockIn === 'boolean' ? doc.hasClockIn : Boolean(s(doc.clockIn)),
    hasClockOut: typeof doc.hasClockOut === 'boolean' ? doc.hasClockOut : Boolean(s(doc.clockOut)),
    isCrossMidnightShift:
      typeof doc.isCrossMidnightShift === 'boolean' ? doc.isCrossMidnightShift : null,
    workedMinutes: Number(doc.workedMinutes || 0),
    lateMinutes: Number(doc.lateMinutes || 0),
    earlyOutMinutes: Number(doc.earlyOutMinutes || 0),

    validationIssues: Array.isArray(doc.validationIssues) ? doc.validationIssues : [],

    rawRowNo: Number(doc.rawRowNo || 0),
    rawData: doc.rawData || {},
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function generateImportNo() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `ATT-${yyyy}${mm}`

  const latest = await AttendanceImport.findOne({
    importNo: { $regex: `^${prefix}-\\d{4}$` },
  })
    .sort({ importNo: -1 })
    .lean()

  let nextNumber = 1
  if (latest?.importNo) {
    const lastPart = Number(String(latest.importNo).split('-').pop())
    if (Number.isFinite(lastPart)) nextNumber = lastPart + 1
  }

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`
}

function isSupportedAttendanceFile(file) {
  const ext = s(path.extname(file?.originalname)).toLowerCase()
  return ['.xlsx', '.xls', '.csv'].includes(ext)
}

async function createImportHeader(file, payload, authUser) {
  const actorEmployeeId =
    s(authUser?.employeeId) && mongoose.isValidObjectId(authUser.employeeId)
      ? authUser.employeeId
      : null

  return AttendanceImport.create({
    importNo: await generateImportNo(),
    sourceType: upper(payload.sourceType || 'EXCEL'),
    fileName: s(file.originalname),
    storedFileName: s(file.filename),
    mimeType: s(file.mimetype),
    periodFrom: s(payload.periodFrom),
    periodTo: s(payload.periodTo),
    rowCount: 0,
    successRowCount: 0,
    failedRowCount: 0,
    duplicateRowCount: 0,
    status: 'PROCESSING',
    remark: s(payload.remark),
    importedAt: new Date(),
    importedBy: authUser?.accountId || authUser?._id || null,
    importedByEmployeeId: actorEmployeeId,
    createdBy: authUser?.accountId || authUser?._id || null,
    updatedBy: authUser?.accountId || authUser?._id || null,
  })
}

function getPeriodRangeFromRows(rows = []) {
  const dates = rows.map((item) => s(item.attendanceDate)).filter(Boolean).sort()
  return {
    periodFrom: dates[0] || '',
    periodTo: dates[dates.length - 1] || '',
  }
}

function buildValidationIssues({
  matchedEmployee,
  nameMatched,
  departmentMatched,
  positionMatched,
  shiftMatched,
  shiftTimeMatched,
  derivedResult,
}) {
  const issues = []

  if (!matchedEmployee) {
    issues.push('Employee not found by Employee ID')
    return issues
  }

  if (nameMatched === false) issues.push('Employee name does not match Employee master')
  if (departmentMatched === false) issues.push('Department does not match Employee master')
  if (positionMatched === false) issues.push('Position does not match Employee master')
  if (shiftMatched === false) issues.push('Shift does not match Employee master')
  if (shiftTimeMatched === false) issues.push('Clock in/out does not align with assigned shift time')

  const derivedStatus = upper(derivedResult?.derivedStatus)
  const derivedReason = s(derivedResult?.derivedStatusReason)

  if (['FORGET_SCAN_IN', 'FORGET_SCAN_OUT', 'UNKNOWN'].includes(derivedStatus) && derivedReason) {
    issues.push(derivedReason)
  }

  return Array.from(new Set(issues.map((item) => s(item)).filter(Boolean)))
}

async function importExcel(file, payload, authUser) {
  if (!file) {
    const err = new Error('Attendance file is required')
    err.status = 400
    throw err
  }

  if (!file.buffer || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    const err = new Error('Attendance file is empty or invalid')
    err.status = 400
    throw err
  }

  if (!isSupportedAttendanceFile(file)) {
    const err = new Error('Only .xlsx, .xls, or .csv files are supported')
    err.status = 400
    throw err
  }

  const importDoc = await createImportHeader(file, payload, authUser)

  try {
    const parsed = parseAttendanceWorkbook(file.buffer, {
      fileName: file.originalname,
    })

    const employeeNos = Array.from(
      new Set(parsed.rows.map((item) => upper(item.importedEmployeeId)).filter(Boolean)),
    )

    const employees = employeeNos.length
      ? await Employee.find({ employeeNo: { $in: employeeNos } })
          .select({
            _id: 1,
            employeeNo: 1,
            displayName: 1,
            departmentId: 1,
            positionId: 1,
            shiftId: 1,
          })
          .populate({ path: 'departmentId', select: { _id: 1, code: 1, name: 1 } })
          .populate({ path: 'positionId', select: { _id: 1, code: 1, name: 1 } })
          .populate({
            path: 'shiftId',
            select: { _id: 1, code: 1, name: 1, type: 1, startTime: 1, endTime: 1 },
          })
          .lean()
      : []

    const employeeMap = new Map(employees.map((employee) => [upper(employee.employeeNo), employee]))

    const holidayDates = await resolveHolidayDateStrings(
      parsed.rows.map((item) => item.attendanceDate),
    )

    const recordsPayload = parsed.rows.map((item) => {
      const matchedEmployee = employeeMap.get(upper(item.importedEmployeeId))
      const departmentDoc = matchedEmployee?.departmentId || null
      const positionDoc = matchedEmployee?.positionId || null
      const shiftDoc = matchedEmployee?.shiftId || null

      const nameMatched = matchedEmployee
        ? compareImportedValue(item.importedEmployeeName, [matchedEmployee.displayName])
        : null

      const departmentMatched = matchedEmployee
        ? compareImportedValue(item.importedDepartmentName, [departmentDoc?.code, departmentDoc?.name])
        : null

      const positionMatched = matchedEmployee
        ? compareImportedValue(item.importedPositionName, [positionDoc?.code, positionDoc?.name])
        : null

      const shiftMatched = matchedEmployee
        ? compareImportedValue(item.importedShiftName, buildShiftCandidates(shiftDoc))
        : null

      const shiftTimeResult = matchedEmployee
        ? evaluateShiftTimeMatch({
            clockIn: item.clockIn,
            clockOut: item.clockOut,
            shiftStartTime: shiftDoc?.startTime,
            shiftEndTime: shiftDoc?.endTime,
          })
        : { shiftTimeMatched: null, issues: [] }

      const shiftTimeMatched = shiftTimeResult.shiftTimeMatched
      const shiftMatchStatus = resolveShiftMatchStatus({ shiftMatched, shiftTimeMatched })

      const derivedResult = deriveAttendanceResult({
        attendanceDate: item.attendanceDate,
        clockIn: item.clockIn,
        clockOut: item.clockOut,
        importedStatus: item.status,
        employeeMatched: !!matchedEmployee,
        shiftMatched,
        shiftTimeMatched,
        shiftStartTime: shiftDoc?.startTime,
        shiftEndTime: shiftDoc?.endTime,
        lateGraceMinutes: LATE_GRACE_MINUTES,
      })

      const validationIssues = buildValidationIssues({
        matchedEmployee,
        nameMatched,
        departmentMatched,
        positionMatched,
        shiftMatched,
        shiftTimeMatched,
        derivedResult,
      })

      return {
        importId: importDoc._id,

        employeeId: matchedEmployee?._id || null,
        employeeNo: upper(matchedEmployee?.employeeNo || item.importedEmployeeId),
        employeeName: s(matchedEmployee?.displayName || item.importedEmployeeName),

        departmentId: departmentDoc?._id || null,
        departmentCode: upper(departmentDoc?.code),
        departmentName: s(departmentDoc?.name),

        positionId: positionDoc?._id || null,
        positionCode: upper(positionDoc?.code),
        positionName: s(positionDoc?.name),

        shiftId: shiftDoc?._id || null,
        shiftCode: upper(shiftDoc?.code),
        shiftName: s(shiftDoc?.name),
        shiftType: upper(shiftDoc?.type),
        shiftStartTime: s(shiftDoc?.startTime),
        shiftEndTime: s(shiftDoc?.endTime),

        importedEmployeeId: upper(item.importedEmployeeId),
        importedEmployeeName: s(item.importedEmployeeName),
        importedDepartmentName: s(item.importedDepartmentName),
        importedPositionName: s(item.importedPositionName),
        importedShiftName: s(item.importedShiftName),
        importedStatus: upper(item.status),

        attendanceDate: s(item.attendanceDate),
        attendanceDateValue: toUtcMidnight(item.attendanceDate),
        clockIn: s(item.clockIn),
        clockOut: s(item.clockOut),
        status: upper(derivedResult.derivedStatus || 'UNKNOWN'),
        derivedStatusReason: s(derivedResult.derivedStatusReason),
        dayType: getDayType(item.attendanceDate, { holidays: holidayDates }),

        matchedBy: matchedEmployee ? 'EMPLOYEE_NO' : 'NONE',
        matchRemark: validationIssues.join('; '),

        employeeMatched: !!matchedEmployee,
        nameMatched,
        departmentMatched,
        positionMatched,
        shiftMatched,
        shiftTimeMatched,
        shiftMatchStatus,

        hasClockIn: derivedResult.hasClockIn === true,
        hasClockOut: derivedResult.hasClockOut === true,
        isCrossMidnightShift:
          typeof derivedResult.isCrossMidnightShift === 'boolean'
            ? derivedResult.isCrossMidnightShift
            : null,
        workedMinutes: Number(derivedResult.workedMinutes || 0),
        lateMinutes: Number(derivedResult.lateMinutes || 0),
        earlyOutMinutes: Number(derivedResult.earlyOutMinutes || 0),

        validationIssues,

        rawRowNo: Number(item.rawRowNo || 0),
        rawData: item.rawData || {},
        createdBy: authUser?.accountId || authUser?._id || null,
        updatedBy: authUser?.accountId || authUser?._id || null,
      }
    })

    if (recordsPayload.length) {
      await AttendanceRecord.insertMany(recordsPayload, { ordered: false })
    }

    const periodRange = getPeriodRangeFromRows(parsed.rows)

    importDoc.periodFrom = s(payload.periodFrom) || periodRange.periodFrom
    importDoc.periodTo = s(payload.periodTo) || periodRange.periodTo
    importDoc.rowCount = Number(parsed.rowCount || 0)
    importDoc.successRowCount = Number(recordsPayload.length || 0)
    importDoc.failedRowCount = Number((parsed.failedRows || []).length || 0)
    importDoc.duplicateRowCount = Number(parsed.duplicateRowCount || 0)
    importDoc.status = recordsPayload.length
      ? parsed.failedRows.length || parsed.duplicateRowCount
        ? 'PARTIAL_SUCCESS'
        : 'SUCCESS'
      : 'FAILED'
    importDoc.updatedBy = authUser?.accountId || authUser?._id || null

    if (!recordsPayload.length) {
      importDoc.remark = s(importDoc.remark || 'No valid attendance rows found')
    }

    await importDoc.save()

    return {
      import: mapImportItem(importDoc.toObject()),
      failedRows: parsed.failedRows || [],
      detectedColumns: parsed.detectedColumns || {},
      sheetName: s(parsed.sheetName),
    }
  } catch (error) {
    importDoc.status = 'FAILED'
    importDoc.updatedBy = authUser?.accountId || authUser?._id || null
    importDoc.remark = s(error.message || importDoc.remark)
    await importDoc.save()

    throw error
  }
}

async function listImports(query) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildImportFilter(query)
  const sort = buildImportSort(query)

  const [items, total] = await Promise.all([
    AttendanceImport.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AttendanceImport.countDocuments(filter),
  ])

  return {
    items: items.map(mapImportItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

async function getImportById(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid attendance import id')
    err.status = 400
    throw err
  }

  const doc = await AttendanceImport.findById(id).lean()

  if (!doc) {
    const err = new Error('Attendance import not found')
    err.status = 404
    throw err
  }

  const recentRecords = await AttendanceRecord.find({ importId: id })
    .sort({ rawRowNo: 1 })
    .limit(50)
    .lean()

  return {
    ...mapImportItem(doc),
    previewRecords: recentRecords.map(mapRecordItem),
  }
}

async function listRecords(query) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildRecordFilter(query)
  const sort = buildRecordSort(query)

  const [items, total] = await Promise.all([
    AttendanceRecord.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AttendanceRecord.countDocuments(filter),
  ])

  return {
    items: items.map(mapRecordItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

async function verifyOTRequest(otRequestId) {
  if (!mongoose.isValidObjectId(otRequestId)) {
    const err = new Error('Invalid OT request id')
    err.status = 400
    throw err
  }

  const otRequest = await OTRequest.findById(otRequestId).lean()

  if (!otRequest) {
    const err = new Error('OT request not found')
    err.status = 404
    throw err
  }

  const status = upper(otRequest.status)
  if (['REJECTED', 'CANCELLED'].includes(status)) {
    const err = new Error(`Cannot verify attendance for OT request status: ${status}`)
    err.status = 400
    throw err
  }

  const requestedEmployees = Array.isArray(otRequest.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const approvedEmployees = Array.isArray(otRequest.approvedEmployees)
    ? otRequest.approvedEmployees
    : []

  const requestedEmployeeIds = normalizeIdArray(requestedEmployees.map((item) => item?.employeeId))
  const requestedEmployeeCodes = Array.from(
    new Set(requestedEmployees.map((item) => upper(item?.employeeCode)).filter(Boolean)),
  )

  const attendanceOrConditions = []
  if (requestedEmployeeIds.length) {
    attendanceOrConditions.push({ employeeId: { $in: requestedEmployeeIds } })
  }
  if (requestedEmployeeCodes.length) {
    attendanceOrConditions.push({ employeeNo: { $in: requestedEmployeeCodes } })
  }

  const attendanceRecords = attendanceOrConditions.length
    ? await AttendanceRecord.find({
        attendanceDate: s(otRequest.otDate),
        $or: attendanceOrConditions,
      })
        .sort({ createdAt: -1 })
        .lean()
    : []

  const verification = verifyAttendanceAgainstOT({
    requestedEmployees,
    approvedEmployees,
    attendanceRecords,
  })

  return {
    otRequest: {
      id: String(otRequest._id),
      requestNo: s(otRequest.requestNo),
      requesterEmployeeId: otRequest.requesterEmployeeId ? String(otRequest.requesterEmployeeId) : null,
      requesterEmployeeNo: s(otRequest.requesterEmployeeNo),
      requesterName: s(otRequest.requesterName),
      otDate: s(otRequest.otDate),
      dayType: upper(otRequest.dayType),
      status,
      requestedEmployeeCount: Number(otRequest.requestedEmployeeCount || requestedEmployees.length),
      approvedEmployeeCount: Number(otRequest.approvedEmployeeCount || approvedEmployees.length),
      proposedApprovedEmployeeCount: Number(
        otRequest.proposedApprovedEmployeeCount ||
          (Array.isArray(otRequest.proposedApprovedEmployees)
            ? otRequest.proposedApprovedEmployees.length
            : 0),
      ),
      requesterConfirmationStatus: upper(otRequest.requesterConfirmationStatus),
    },
    verification,
  }
}

module.exports = {
  importExcel,
  listImports,
  getImportById,
  listRecords,
  verifyOTRequest,
  downloadImportSample,
}