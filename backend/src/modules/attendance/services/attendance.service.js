// backend/src/modules/attendance/services/attendance.service.js
const path = require('path')
const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AttendanceImport = require('../models/AttendanceImport')
const AttendanceRecord = require('../models/AttendanceRecord')
const Employee = require('../../org/models/Employee')
const OTRequest = require('../../ot/models/OTRequest')
const Holiday = require('../../calendar/models/Holiday')
const OTCalculationPolicy = require('../../ot/models/OTCalculationPolicy')
const ShiftOTOption = require('../../ot/models/ShiftOTOption')
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
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((id) => s(id)).filter(Boolean)),
  )
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
    ['Employee ID', 'Clock In', 'Clock Out'],
    ['52520351', '06:45', '16:00'],
    ['52520352', '07:10', '16:00'],
    ['52520353', '07:00', '15:30'],
  ]

  const sampleSheet = XLSX.utils.aoa_to_sheet(sampleRows)

  sampleSheet['!cols'] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function buildVerificationRequestSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return {}

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { requestNo: regex },
      { requesterEmployeeNo: regex },
      { requesterName: regex },
      { shiftOtOptionLabel: regex },
      { shiftName: regex },
      { otDate: regex },
    ],
  }
}

function mapVerificationRequestSearchItem(doc) {
  const requestedEmployees = Array.isArray(doc?.requestedEmployees) ? doc.requestedEmployees : []
  const approvedEmployees = Array.isArray(doc?.approvedEmployees) ? doc.approvedEmployees : []
  const proposedApprovedEmployees = Array.isArray(doc?.proposedApprovedEmployees)
    ? doc.proposedApprovedEmployees
    : []

  const effectiveApprovedCount =
    upper(doc?.status) === 'PENDING_REQUESTER_CONFIRMATION' && proposedApprovedEmployees.length
      ? proposedApprovedEmployees.length
      : approvedEmployees.length

  return {
    id: String(doc._id),
    requestNo: s(doc.requestNo),
    otDate: s(doc.otDate),
    dayType: upper(doc.dayType),
    status: upper(doc.status),

    requesterEmployeeId: doc.requesterEmployeeId ? String(doc.requesterEmployeeId) : null,
    requesterEmployeeNo: s(doc.requesterEmployeeNo),
    requesterName: s(doc.requesterName),

    shiftId: doc.shiftId ? String(doc.shiftId) : null,
    shiftCode: upper(doc.shiftCode),
    shiftName: s(doc.shiftName),
    shiftType: upper(doc.shiftType),
    shiftStartTime: s(doc.shiftStartTime),
    shiftEndTime: s(doc.shiftEndTime),

    shiftOtOptionId: doc.shiftOtOptionId ? String(doc.shiftOtOptionId) : null,
    shiftOtOptionLabel: s(doc.shiftOtOptionLabel),

    // ✅ important for dropdown / frontend display
    shiftOtOptionTimingMode: upper(doc.shiftOtOptionTimingMode),
    shiftOtOptionStartAfterShiftEndMinutes: Number(
      doc.shiftOtOptionStartAfterShiftEndMinutes || 0,
    ),
    shiftOtOptionFixedStartTime: s(doc.shiftOtOptionFixedStartTime),
    shiftOtOptionFixedEndTime: s(doc.shiftOtOptionFixedEndTime),

    requestStartTime: s(doc.requestStartTime || doc.startTime),
    requestEndTime: s(doc.requestEndTime || doc.endTime),

    requestedMinutes: Number(doc.requestedMinutes || doc.totalMinutes || 0),
    totalMinutes: Number(doc.totalMinutes || 0),
    totalHours: Number(doc.totalHours || 0),

    otCalculationPolicyId: doc.otCalculationPolicyId ? String(doc.otCalculationPolicyId) : null,
    otCalculationPolicySnapshot: doc.otCalculationPolicySnapshot || {},

    requestedEmployeeCount: Number(doc.requestedEmployeeCount || requestedEmployees.length),
    approvedEmployeeCount: Number(doc.approvedEmployeeCount || effectiveApprovedCount || 0),

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

async function searchOTRequestsForVerification(query = {}) {
  const page = Math.max(Number(query.page || 1), 1)
  const limit = Math.min(Math.max(Number(query.limit || 10), 1), 20)
  const skip = (page - 1) * limit

  const filter = {
    ...buildVerificationRequestSearchFilter(query.search),
    status: {
      $nin: ['REJECTED', 'CANCELLED'],
    },
  }

  if (s(query.status)) {
    filter.status = upper(query.status)
  }

  if (s(query.otDateFrom) || s(query.otDateTo)) {
    filter.otDate = {}
    if (s(query.otDateFrom)) filter.otDate.$gte = s(query.otDateFrom)
    if (s(query.otDateTo)) filter.otDate.$lte = s(query.otDateTo)
  }

  const [items, total] = await Promise.all([
    OTRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    OTRequest.countDocuments(filter),
  ])

  return {
    items: items.map(mapVerificationRequestSearchItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
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
    overriddenRowCount: Number(doc.overriddenRowCount || 0),
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

  const attendanceDate = s(payload.attendanceDate)

  return AttendanceImport.create({
    importNo: await generateImportNo(),
    sourceType: upper(payload.sourceType || 'EXCEL'),
    fileName: s(file.originalname),
    storedFileName: s(file.filename),
    mimeType: s(file.mimetype),

    // ✅ one-day import
    periodFrom: attendanceDate,
    periodTo: attendanceDate,

    rowCount: 0,
    successRowCount: 0,
    failedRowCount: 0,
    duplicateRowCount: 0,
    overriddenRowCount: 0,
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

function buildOverrideDeleteFilter(recordsPayload = [], currentImportId = null) {
  const grouped = new Map()

  for (const item of Array.isArray(recordsPayload) ? recordsPayload : []) {
    const employeeNo = upper(item?.employeeNo)
    const attendanceDate = s(item?.attendanceDate)

    if (!employeeNo || !attendanceDate) continue

    if (!grouped.has(employeeNo)) {
      grouped.set(employeeNo, new Set())
    }

    grouped.get(employeeNo).add(attendanceDate)
  }

  const orConditions = Array.from(grouped.entries()).map(([employeeNo, dates]) => ({
    employeeNo,
    attendanceDate: { $in: Array.from(dates) },
  }))

  if (!orConditions.length) return null

  const filter = { $or: orConditions }

  if (currentImportId && mongoose.isValidObjectId(currentImportId)) {
    filter.importId = { $ne: currentImportId }
  }

  return filter
}

async function overrideExistingAttendanceRecords(recordsPayload = [], currentImportId = null) {
  const filter = buildOverrideDeleteFilter(recordsPayload, currentImportId)
  if (!filter) return 0

  const existingCount = await AttendanceRecord.countDocuments(filter)
  if (!existingCount) return 0

  await AttendanceRecord.deleteMany(filter)
  return existingCount
}

function buildImportRemark(baseRemark, extraRemarks = []) {
  return [s(baseRemark), ...extraRemarks.map((item) => s(item))]
    .filter(Boolean)
    .join(' | ')
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
      attendanceDate: payload.attendanceDate,
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

    let overriddenRowCount = 0

    if (recordsPayload.length) {
      overriddenRowCount = await overrideExistingAttendanceRecords(recordsPayload, importDoc._id)
      await AttendanceRecord.insertMany(recordsPayload, { ordered: false })
    }

    importDoc.periodFrom = s(payload.attendanceDate)
    importDoc.periodTo = s(payload.attendanceDate)
    importDoc.rowCount = Number(parsed.rowCount || 0)
    importDoc.successRowCount = Number(recordsPayload.length || 0)
    importDoc.failedRowCount = Number((parsed.failedRows || []).length || 0)
    importDoc.duplicateRowCount = Number(parsed.duplicateRowCount || 0)
    importDoc.overriddenRowCount = Number(overriddenRowCount || 0)
    importDoc.status = recordsPayload.length
      ? parsed.failedRows.length || parsed.duplicateRowCount
        ? 'PARTIAL_SUCCESS'
        : 'SUCCESS'
      : 'FAILED'
    importDoc.updatedBy = authUser?.accountId || authUser?._id || null

    const extraRemarks = []
    if (overriddenRowCount > 0) {
      extraRemarks.push(
        `Overrode ${overriddenRowCount} existing attendance record(s) by employee/date`,
      )
    }

    if (!recordsPayload.length) {
      extraRemarks.push('No valid attendance rows found')
    }

    importDoc.remark = buildImportRemark(payload.remark, extraRemarks)

    await importDoc.save()

    return {
      import: mapImportItem(importDoc.toObject()),
      overriddenRowCount,
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

function mapPolicySnapshotForVerification(snapshot = {}, fallbackPolicy = null) {
  const hasOwn = (obj, key) =>
    Object.prototype.hasOwnProperty.call(obj || {}, key)

  const pickString = (snapshotKey, fallbackKey = snapshotKey) => {
    const fromSnapshot = s(snapshot?.[snapshotKey])
    if (fromSnapshot) return fromSnapshot
    return s(fallbackPolicy?.[fallbackKey])
  }

  const pickNumber = (snapshotKey, fallbackKey = snapshotKey, defaultValue = 0) => {
    if (hasOwn(snapshot, snapshotKey)) return Number(snapshot?.[snapshotKey] || defaultValue)
    if (fallbackPolicy && hasOwn(fallbackPolicy, fallbackKey)) {
      return Number(fallbackPolicy?.[fallbackKey] || defaultValue)
    }
    return Number(defaultValue || 0)
  }

  const pickBoolean = (snapshotKey, fallbackKey = snapshotKey, defaultValue = false) => {
    if (hasOwn(snapshot, snapshotKey)) return snapshot?.[snapshotKey] === true
    if (fallbackPolicy && hasOwn(fallbackPolicy, fallbackKey)) {
      return fallbackPolicy?.[fallbackKey] === true
    }
    return defaultValue
  }

  return {
    calculationPolicyId:
      snapshot?.calculationPolicyId
        ? String(snapshot.calculationPolicyId)
        : fallbackPolicy?._id
          ? String(fallbackPolicy._id)
          : null,

    code: upper(pickString('code')),
    name: s(pickString('name')),

    minEligibleMinutes: pickNumber('minEligibleMinutes', 'minEligibleMinutes', 0),
    roundUnitMinutes: pickNumber('roundUnitMinutes', 'roundUnitMinutes', 30),
    roundMethod: upper(pickString('roundMethod') || 'CEIL'),
    graceAfterShiftEndMinutes: pickNumber(
      'graceAfterShiftEndMinutes',
      'graceAfterShiftEndMinutes',
      0,
    ),

    // ✅ REQUIRED for "Match Without Exact Clock-Out"
    allowApprovedOtWithoutExactClockOut: pickBoolean(
      'allowApprovedOtWithoutExactClockOut',
      'allowApprovedOtWithoutExactClockOut',
      false,
    ),

    allowPreShiftOT: pickBoolean('allowPreShiftOT', 'allowPreShiftOT', false),
    allowPostShiftOT: pickBoolean('allowPostShiftOT', 'allowPostShiftOT', true),
    capByRequestedMinutes: pickBoolean(
      'capByRequestedMinutes',
      'capByRequestedMinutes',
      true,
    ),
    treatForgetScanInAsPending: pickBoolean(
      'treatForgetScanInAsPending',
      'treatForgetScanInAsPending',
      true,
    ),
    treatForgetScanOutAsPending: pickBoolean(
      'treatForgetScanOutAsPending',
      'treatForgetScanOutAsPending',
      true,
    ),
  }
}

function getEffectiveApprovedEmployeesForVerification(otRequest) {
  const status = upper(otRequest?.status)

  if (
    status === 'PENDING_REQUESTER_CONFIRMATION' &&
    Array.isArray(otRequest?.proposedApprovedEmployees) &&
    otRequest.proposedApprovedEmployees.length
  ) {
    return otRequest.proposedApprovedEmployees
  }

  if (Array.isArray(otRequest?.approvedEmployees) && otRequest.approvedEmployees.length) {
    return otRequest.approvedEmployees
  }

  return Array.isArray(otRequest?.requestedEmployees) ? otRequest.requestedEmployees : []
}

function buildVerificationOTRequestPayload(otRequest, approvedEmployees = [], options = {}) {
  const requestedEmployees = Array.isArray(otRequest?.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const effectiveApprovedEmployees = Array.isArray(approvedEmployees) ? approvedEmployees : []

  const currentPolicy = options.currentPolicy || null
  const currentShiftOtOption = options.currentShiftOtOption || null

  const requestedMinutes = Number(otRequest?.requestedMinutes || otRequest?.totalMinutes || 0)

  const timingMode = upper(
    otRequest?.shiftOtOptionTimingMode ||
      currentShiftOtOption?.timingMode ||
      '',
  )

  const shiftOtOptionStartAfterShiftEndMinutes = Number(
    otRequest?.shiftOtOptionStartAfterShiftEndMinutes ??
      currentShiftOtOption?.startAfterShiftEndMinutes ??
      0,
  )

  const requestStartTime = s(otRequest.requestStartTime || otRequest.startTime)
  const requestEndTime = s(otRequest.requestEndTime || otRequest.endTime)

  const fixedStartTime =
    timingMode === 'FIXED_TIME'
      ? s(
          otRequest?.shiftOtOptionFixedStartTime ||
            currentShiftOtOption?.fixedStartTime ||
            requestStartTime,
        )
      : ''

  const fixedEndTime =
    timingMode === 'FIXED_TIME'
      ? s(
          otRequest?.shiftOtOptionFixedEndTime ||
            currentShiftOtOption?.fixedEndTime ||
            requestEndTime,
        )
      : ''

  return {
    id: String(otRequest._id),
    requestNo: s(otRequest.requestNo),

    requesterEmployeeId: otRequest.requesterEmployeeId
      ? String(otRequest.requesterEmployeeId)
      : null,
    requesterEmployeeNo: s(otRequest.requesterEmployeeNo),
    requesterName: s(otRequest.requesterName),

    otDate: s(otRequest.otDate),
    dayType: upper(otRequest.dayType),
    status: upper(otRequest.status),

    shiftId: otRequest.shiftId ? String(otRequest.shiftId) : null,
    shiftCode: upper(otRequest.shiftCode),
    shiftName: s(otRequest.shiftName),
    shiftType: upper(otRequest.shiftType),
    shiftStartTime: s(otRequest.shiftStartTime),
    shiftEndTime: s(otRequest.shiftEndTime),
    shiftCrossMidnight: otRequest.shiftCrossMidnight === true,

    shiftOtOptionId: otRequest.shiftOtOptionId ? String(otRequest.shiftOtOptionId) : null,
    shiftOtOptionLabel: s(
      otRequest.shiftOtOptionLabel || currentShiftOtOption?.label,
    ),

    // ✅ REQUIRED for Fixed OT / After Shift verification display and logic
    shiftOtOptionTimingMode: timingMode,
    shiftOtOptionStartAfterShiftEndMinutes,
    shiftOtOptionFixedStartTime: fixedStartTime,
    shiftOtOptionFixedEndTime: fixedEndTime,

    requestedMinutes,
    totalMinutes: Number(otRequest.totalMinutes || 0),
    totalHours: Number(otRequest.totalHours || 0),

    requestStartTime,
    requestEndTime,
    expectedOtStartTime: requestStartTime,
    expectedOtEndTime: requestEndTime,

    otCalculationPolicyId: otRequest.otCalculationPolicyId
      ? String(otRequest.otCalculationPolicyId)
      : currentPolicy?._id
        ? String(currentPolicy._id)
        : null,

    otCalculationPolicySnapshot: mapPolicySnapshotForVerification(
      otRequest.otCalculationPolicySnapshot || {},
      currentPolicy,
    ),

    requestedEmployeeCount: Number(
      otRequest.requestedEmployeeCount || requestedEmployees.length,
    ),
    approvedEmployeeCount: Number(
      effectiveApprovedEmployees.length || otRequest.approvedEmployeeCount || 0,
    ),
    proposedApprovedEmployeeCount: Number(
      otRequest.proposedApprovedEmployeeCount ||
        (Array.isArray(otRequest.proposedApprovedEmployees)
          ? otRequest.proposedApprovedEmployees.length
          : 0),
    ),

    requesterConfirmationStatus: upper(otRequest.requesterConfirmationStatus),
    requestedEmployees,
    approvedEmployees: effectiveApprovedEmployees,
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

  console.log('[ATT_VERIFY_OT_REQUEST_SNAPSHOT_DEBUG]', {
    requestNo: otRequest?.requestNo,
    otRequestId: String(otRequest?._id || ''),

    dayType: otRequest?.dayType,
    status: otRequest?.status,

    shiftOtOptionId: String(otRequest?.shiftOtOptionId || ''),
    shiftOtOptionLabel: otRequest?.shiftOtOptionLabel,
    shiftOtOptionTimingMode: otRequest?.shiftOtOptionTimingMode,
    shiftOtOptionStartAfterShiftEndMinutes:
      otRequest?.shiftOtOptionStartAfterShiftEndMinutes,
    shiftOtOptionFixedStartTime: otRequest?.shiftOtOptionFixedStartTime,
    shiftOtOptionFixedEndTime: otRequest?.shiftOtOptionFixedEndTime,

    requestStartTime: otRequest?.requestStartTime,
    requestEndTime: otRequest?.requestEndTime,
    requestedMinutes: otRequest?.requestedMinutes,

    otCalculationPolicyId: String(otRequest?.otCalculationPolicyId || ''),
    policySnapshot: otRequest?.otCalculationPolicySnapshot,
  })

  let currentPolicy = null

  if (
    otRequest?.otCalculationPolicyId &&
    mongoose.isValidObjectId(otRequest.otCalculationPolicyId)
  ) {
    currentPolicy = await OTCalculationPolicy.findById(
      otRequest.otCalculationPolicyId,
    ).lean()
  }

  let currentShiftOtOption = null

  if (
    otRequest?.shiftOtOptionId &&
    mongoose.isValidObjectId(otRequest.shiftOtOptionId)
  ) {
    currentShiftOtOption = await ShiftOTOption.findById(
      otRequest.shiftOtOptionId,
    ).lean()
  }

  // ✅ fallback: if old OT request has policyId missing but option still knows policy
  if (
    !currentPolicy &&
    currentShiftOtOption?.calculationPolicyId &&
    mongoose.isValidObjectId(currentShiftOtOption.calculationPolicyId)
  ) {
    currentPolicy = await OTCalculationPolicy.findById(
      currentShiftOtOption.calculationPolicyId,
    ).lean()
  }

  console.log('[ATT_VERIFY_CURRENT_POLICY_DB_DEBUG]', {
    requestNo: otRequest?.requestNo,
    policyId: String(
      otRequest?.otCalculationPolicyId ||
        currentShiftOtOption?.calculationPolicyId ||
        '',
    ),
    found: Boolean(currentPolicy),

    code: currentPolicy?.code,
    name: currentPolicy?.name,

    allowApprovedOtWithoutExactClockOut:
      currentPolicy?.allowApprovedOtWithoutExactClockOut,

    allowPreShiftOT: currentPolicy?.allowPreShiftOT,
    allowPostShiftOT: currentPolicy?.allowPostShiftOT,
    capByRequestedMinutes: currentPolicy?.capByRequestedMinutes,
    treatForgetScanInAsPending: currentPolicy?.treatForgetScanInAsPending,
    treatForgetScanOutAsPending: currentPolicy?.treatForgetScanOutAsPending,

    roundMethod: currentPolicy?.roundMethod,
    roundUnitMinutes: currentPolicy?.roundUnitMinutes,
    minEligibleMinutes: currentPolicy?.minEligibleMinutes,
    graceAfterShiftEndMinutes: currentPolicy?.graceAfterShiftEndMinutes,

    createdAt: currentPolicy?.createdAt,
    updatedAt: currentPolicy?.updatedAt,
  })

  console.log('[ATT_VERIFY_CURRENT_SHIFT_OT_OPTION_DB_DEBUG]', {
    requestNo: otRequest?.requestNo,
    shiftOtOptionId: String(otRequest?.shiftOtOptionId || ''),
    found: Boolean(currentShiftOtOption),

    label: currentShiftOtOption?.label,
    timingMode: currentShiftOtOption?.timingMode,
    startAfterShiftEndMinutes:
      currentShiftOtOption?.startAfterShiftEndMinutes,
    fixedStartTime: currentShiftOtOption?.fixedStartTime,
    fixedEndTime: currentShiftOtOption?.fixedEndTime,
    requestedMinutes: currentShiftOtOption?.requestedMinutes,

    calculationPolicyId: String(currentShiftOtOption?.calculationPolicyId || ''),
    isActive: currentShiftOtOption?.isActive,

    createdAt: currentShiftOtOption?.createdAt,
    updatedAt: currentShiftOtOption?.updatedAt,
  })

  const requestedEmployees = Array.isArray(otRequest.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const effectiveApprovedEmployees =
    getEffectiveApprovedEmployeesForVerification(otRequest)

  const requestedEmployeeIds = normalizeIdArray(
    requestedEmployees.map((item) => item?.employeeId),
  )

  const requestedEmployeeCodes = Array.from(
    new Set(
      requestedEmployees
        .map((item) => upper(item?.employeeCode))
        .filter(Boolean),
    ),
  )

  const attendanceOrConditions = []

  if (requestedEmployeeIds.length) {
    attendanceOrConditions.push({
      employeeId: {
        $in: requestedEmployeeIds,
      },
    })
  }

  if (requestedEmployeeCodes.length) {
    attendanceOrConditions.push({
      employeeNo: {
        $in: requestedEmployeeCodes,
      },
    })
  }

  const attendanceRecords = attendanceOrConditions.length
    ? await AttendanceRecord.find({
        attendanceDate: s(otRequest.otDate),
        $or: attendanceOrConditions,
      })
        .sort({
          createdAt: -1,
        })
        .lean()
    : []

  console.log('[ATT_VERIFY_ATTENDANCE_RECORDS_DEBUG]', {
    requestNo: otRequest?.requestNo,
    otDate: s(otRequest.otDate),
    requestedEmployeeCount: requestedEmployees.length,
    approvedEmployeeCount: effectiveApprovedEmployees.length,
    attendanceRecordCount: attendanceRecords.length,
  })

  const verificationOtRequest = buildVerificationOTRequestPayload(
    otRequest,
    effectiveApprovedEmployees,
    {
      currentPolicy,
      currentShiftOtOption,
    },
  )

  console.log('[ATT_VERIFY_FINAL_PAYLOAD_DEBUG]', {
    requestNo: verificationOtRequest?.requestNo,
    dayType: verificationOtRequest?.dayType,

    shiftOtOptionId: String(verificationOtRequest?.shiftOtOptionId || ''),
    shiftOtOptionLabel: verificationOtRequest?.shiftOtOptionLabel,
    shiftOtOptionTimingMode: verificationOtRequest?.shiftOtOptionTimingMode,
    shiftOtOptionStartAfterShiftEndMinutes:
      verificationOtRequest?.shiftOtOptionStartAfterShiftEndMinutes,
    shiftOtOptionFixedStartTime:
      verificationOtRequest?.shiftOtOptionFixedStartTime,
    shiftOtOptionFixedEndTime:
      verificationOtRequest?.shiftOtOptionFixedEndTime,

    requestStartTime: verificationOtRequest?.requestStartTime,
    requestEndTime: verificationOtRequest?.requestEndTime,
    requestedMinutes: verificationOtRequest?.requestedMinutes,

    policySnapshot: verificationOtRequest?.otCalculationPolicySnapshot,
  })

  const verification = verifyAttendanceAgainstOT({
    otRequest: verificationOtRequest,
    requestedEmployees,
    approvedEmployees: effectiveApprovedEmployees,
    attendanceRecords,
  })

  return {
    otRequest: verificationOtRequest,
    verification,
  }
}

module.exports = {
  importExcel,
  listImports,
  getImportById,
  listRecords,
  searchOTRequestsForVerification,
  verifyOTRequest,
  downloadImportSample,
}