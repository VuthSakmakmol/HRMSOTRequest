// backend/src/modules/attendance/services/attendanceImport.service.js

const path = require('path')
const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AttendanceImport = require('../models/AttendanceImport')
const AttendanceRecord = require('../models/AttendanceRecord')
const Employee = require('../../org/models/Employee')
const { classifyDayType, toYmd } = require('../../calendar/services/dayType.service')
const {
  formatYmdToDmy,
  formatDateTimeToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')
const { parseAttendanceWorkbook } = require('../utils/attendanceParser')
const { deriveAttendanceResult } = require('../utils/attendanceVerification')
const { mapRecordItem } = require('./attendanceRecord.service')

const SHIFT_IN_TOLERANCE_MINUTES = 240
const SHIFT_OUT_TOLERANCE_MINUTES = 360
const LATE_GRACE_MINUTES = 0

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

function isValidObjectId(value) {
  return Boolean(s(value)) && mongoose.isValidObjectId(s(value))
}

function parseYMDToUtcRange(ymd) {
  const raw = s(ymd)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    throw createHttpError(`Invalid date format: ${raw}`, 400)
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
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
  ]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
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
      { status: regex },
      { sourceType: regex },
    ],
  }
}

function buildImportFilter(query = {}) {
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

function buildImportSort(query = {}) {
  const direction = query.sortOrder === 'asc' ? 1 : -1

  const sortField =
    {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      importedAt: 'importedAt',
      importNo: 'importNo',
      periodFrom: 'periodFrom',
      periodTo: 'periodTo',
      status: 'status',
      rowCount: 'rowCount',
      successRowCount: 'successRowCount',
      failedRowCount: 'failedRowCount',
      duplicateRowCount: 'duplicateRowCount',
      overriddenRowCount: 'overriddenRowCount',
    }[query.sortBy] || 'createdAt'

  return {
    [sortField]: direction,
    createdAt: -1,
    _id: -1,
  }
}

function mapImportItem(doc = {}) {
  return {
    id: doc._id ? String(doc._id) : null,

    importNo: s(doc.importNo),
    sourceType: upper(doc.sourceType),

    fileName: s(doc.fileName),
    storedFileName: s(doc.storedFileName),
    mimeType: s(doc.mimeType),

    periodFrom: s(doc.periodFrom),
    periodFromDisplay: formatYmdToDmy(doc.periodFrom),

    periodTo: s(doc.periodTo),
    periodToDisplay: formatYmdToDmy(doc.periodTo),

    rowCount: Number(doc.rowCount || 0),
    successRowCount: Number(doc.successRowCount || 0),
    failedRowCount: Number(doc.failedRowCount || 0),
    duplicateRowCount: Number(doc.duplicateRowCount || 0),
    overriddenRowCount: Number(doc.overriddenRowCount || 0),

    status: upper(doc.status),
    remark: s(doc.remark),

    importedAt: doc.importedAt || null,
    importedAtDisplay: formatDateTimeToDmy(doc.importedAt),
    importedAtDisplayHm: formatDateTimeToDmyHm(doc.importedAt),

    importedBy: doc.importedBy ? String(doc.importedBy) : null,
    importedByEmployeeId: doc.importedByEmployeeId ? String(doc.importedByEmployeeId) : null,

    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,

    createdAt: doc.createdAt || null,
    createdAtDisplay: formatDateTimeToDmy(doc.createdAt),
    createdAtDisplayHm: formatDateTimeToDmyHm(doc.createdAt),

    updatedAt: doc.updatedAt || null,
    updatedAtDisplay: formatDateTimeToDmy(doc.updatedAt),
    updatedAtDisplayHm: formatDateTimeToDmyHm(doc.updatedAt),
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
    if (Number.isFinite(lastPart)) {
      nextNumber = lastPart + 1
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`
}

function isSupportedAttendanceFile(file) {
  const ext = s(path.extname(file?.originalname)).toLowerCase()
  return ['.xlsx', '.xls', '.csv'].includes(ext)
}

function getActorAccountId(authUser) {
  if (isValidObjectId(authUser?.accountId)) return authUser.accountId
  if (isValidObjectId(authUser?._id)) return authUser._id

  return null
}

function getActorEmployeeId(authUser) {
  if (isValidObjectId(authUser?.employeeId)) return authUser.employeeId

  return null
}

async function createImportHeader(file, payload, authUser) {
  const attendanceDate = toYmd(payload.attendanceDate) || s(payload.attendanceDate)
  const actorAccountId = getActorAccountId(authUser)
  const actorEmployeeId = getActorEmployeeId(authUser)

  return AttendanceImport.create({
    importNo: await generateImportNo(),
    sourceType: 'EXCEL',

    fileName: s(file.originalname),
    storedFileName: s(file.filename),
    mimeType: s(file.mimetype),

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
    importedBy: actorAccountId,
    importedByEmployeeId: actorEmployeeId,

    createdBy: actorAccountId,
    updatedBy: actorAccountId,
  })
}

function getEmployeeLineDoc(employee) {
  return employee?.lineId || employee?.productionLineId || null
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

  if (nameMatched === false) {
    issues.push('Employee name does not match Employee master')
  }

  if (departmentMatched === false) {
    issues.push('Department does not match Employee master')
  }

  if (positionMatched === false) {
    issues.push('Position does not match Employee master')
  }

  if (shiftMatched === false) {
    issues.push('Shift does not match Employee master')
  }

  if (shiftTimeMatched === false) {
    issues.push('Clock in/out does not align with assigned shift time')
  }

  const derivedStatus = upper(derivedResult?.derivedStatus)
  const derivedReason = s(derivedResult?.derivedStatusReason)

  if (['FORGET_SCAN_IN', 'FORGET_SCAN_OUT', 'UNKNOWN'].includes(derivedStatus) && derivedReason) {
    issues.push(derivedReason)
  }

  return Array.from(new Set(issues.map((item) => s(item)).filter(Boolean)))
}

function buildOverrideDeleteFilter(recordsPayload = [], currentImportId = null) {
  const byEmployeeId = new Map()
  const byEmployeeNo = new Map()

  for (const item of Array.isArray(recordsPayload) ? recordsPayload : []) {
    const employeeId = s(item?.employeeId)
    const employeeNo = upper(item?.employeeNo)
    const attendanceDate = s(item?.attendanceDate)

    if (!attendanceDate) continue

    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      if (!byEmployeeId.has(employeeId)) {
        byEmployeeId.set(employeeId, new Set())
      }

      byEmployeeId.get(employeeId).add(attendanceDate)
      continue
    }

    if (employeeNo) {
      if (!byEmployeeNo.has(employeeNo)) {
        byEmployeeNo.set(employeeNo, new Set())
      }

      byEmployeeNo.get(employeeNo).add(attendanceDate)
    }
  }

  const orConditions = [
    ...Array.from(byEmployeeId.entries()).map(([employeeId, dates]) => ({
      employeeId,
      attendanceDate: { $in: Array.from(dates) },
    })),
    ...Array.from(byEmployeeNo.entries()).map(([employeeNo, dates]) => ({
      employeeId: null,
      employeeNo,
      attendanceDate: { $in: Array.from(dates) },
    })),
  ]

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

async function fetchEmployeesByNos(employeeNos = []) {
  if (!employeeNos.length) return []

  return Employee.find({ employeeNo: { $in: employeeNos } })
    .select({
      _id: 1,
      employeeNo: 1,
      displayName: 1,
      departmentId: 1,
      positionId: 1,
      shiftId: 1,
      lineId: 1,
      productionLineId: 1,
    })
    .populate({ path: 'departmentId', select: { _id: 1, code: 1, name: 1 } })
    .populate({ path: 'positionId', select: { _id: 1, code: 1, name: 1 } })
    .populate({
      path: 'shiftId',
      select: {
        _id: 1,
        code: 1,
        name: 1,
        type: 1,
        startTime: 1,
        endTime: 1,
      },
    })
    .populate({
      path: 'lineId',
      select: {
        _id: 1,
        code: 1,
        name: 1,
      },
    })
    .lean()
}

async function buildRecordPayloadFromParsedRow({
  parsedRow,
  importDoc,
  employeeMap,
  authUser,
}) {
  const attendanceDate = toYmd(parsedRow.attendanceDate) || s(parsedRow.attendanceDate)
  const dayInfo = await classifyDayType(attendanceDate)

  const matchedEmployee = employeeMap.get(upper(parsedRow.importedEmployeeId))
  const departmentDoc = matchedEmployee?.departmentId || null
  const positionDoc = matchedEmployee?.positionId || null
  const shiftDoc = matchedEmployee?.shiftId || null
  const lineDoc = getEmployeeLineDoc(matchedEmployee)

  const nameMatched = matchedEmployee
    ? compareImportedValue(parsedRow.importedEmployeeName, [matchedEmployee.displayName])
    : null

  const departmentMatched = matchedEmployee
    ? compareImportedValue(parsedRow.importedDepartmentName, [
        departmentDoc?.code,
        departmentDoc?.name,
      ])
    : null

  const positionMatched = matchedEmployee
    ? compareImportedValue(parsedRow.importedPositionName, [
        positionDoc?.code,
        positionDoc?.name,
      ])
    : null

  const shiftMatched = matchedEmployee
    ? compareImportedValue(parsedRow.importedShiftName, buildShiftCandidates(shiftDoc))
    : null

  const shiftTimeResult = matchedEmployee
    ? evaluateShiftTimeMatch({
        clockIn: parsedRow.clockIn,
        clockOut: parsedRow.clockOut,
        shiftStartTime: shiftDoc?.startTime,
        shiftEndTime: shiftDoc?.endTime,
      })
    : { shiftTimeMatched: null, issues: [] }

  const shiftTimeMatched = shiftTimeResult.shiftTimeMatched
  const shiftMatchStatus = resolveShiftMatchStatus({ shiftMatched, shiftTimeMatched })

  const derivedResult = deriveAttendanceResult({
    attendanceDate,
    clockIn: parsedRow.clockIn,
    clockOut: parsedRow.clockOut,
    importedStatus: parsedRow.status,
    employeeMatched: Boolean(matchedEmployee),
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

  const actorAccountId = getActorAccountId(authUser)

  const derivedStatusReasonKey = s(derivedResult.derivedStatusReasonKey)
  const messageKey = s(derivedResult.messageKey || derivedStatusReasonKey)

  return {
    importId: importDoc._id,

    employeeId: matchedEmployee?._id || null,
    employeeNo: upper(matchedEmployee?.employeeNo || parsedRow.importedEmployeeId),
    employeeName: s(matchedEmployee?.displayName || parsedRow.importedEmployeeName),

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

    lineId: lineDoc?._id || null,
    lineCode: upper(lineDoc?.code),
    lineName: s(lineDoc?.name),

    importedEmployeeId: upper(parsedRow.importedEmployeeId),
    importedEmployeeName: s(parsedRow.importedEmployeeName),
    importedDepartmentName: s(parsedRow.importedDepartmentName),
    importedPositionName: s(parsedRow.importedPositionName),
    importedShiftName: s(parsedRow.importedShiftName),
    importedStatus: upper(parsedRow.status),

    attendanceDate,
    attendanceDateValue: toUtcMidnight(attendanceDate),

    clockIn: s(parsedRow.clockIn),
    clockOut: s(parsedRow.clockOut),

    status: upper(derivedResult.derivedStatus || 'UNKNOWN'),
    derivedStatusReason: s(derivedResult.derivedStatusReason),
    derivedStatusReasonKey,
    messageKey,

    dayType: upper(dayInfo.dayType || 'WORKING_DAY'),

    matchedBy: matchedEmployee ? 'EMPLOYEE_NO' : 'NONE',
    matchRemark: validationIssues.join('; '),

    employeeMatched: Boolean(matchedEmployee),
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

    rawRowNo: Number(parsedRow.rawRowNo || 0),
    rawData: parsedRow.rawData || {},

    createdBy: actorAccountId,
    updatedBy: actorAccountId,
  }
}

async function importExcel(file, payload, authUser) {
  if (!file) {
    throw createHttpError('Attendance file is required', 400)
  }

  if (!file.buffer || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw createHttpError('Attendance file is empty or invalid', 400)
  }

  if (!isSupportedAttendanceFile(file)) {
    throw createHttpError('Only .xlsx, .xls, or .csv files are supported', 400)
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

    const employees = await fetchEmployeesByNos(employeeNos)
    const employeeMap = new Map(employees.map((employee) => [upper(employee.employeeNo), employee]))

    const recordsPayload = await Promise.all(
      parsed.rows.map((parsedRow) =>
        buildRecordPayloadFromParsedRow({
          parsedRow,
          importDoc,
          employeeMap,
          authUser,
        }),
      ),
    )

    let overriddenRowCount = 0

    if (recordsPayload.length) {
      overriddenRowCount = await overrideExistingAttendanceRecords(recordsPayload, importDoc._id)
      await AttendanceRecord.insertMany(recordsPayload, { ordered: false })
    }

    const attendanceDate = toYmd(payload.attendanceDate) || s(payload.attendanceDate)

    importDoc.periodFrom = attendanceDate
    importDoc.periodTo = attendanceDate

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

    importDoc.updatedBy = getActorAccountId(authUser)

    const extraRemarks = []

    if (overriddenRowCount > 0) {
      extraRemarks.push(`Overrode ${overriddenRowCount} existing attendance record(s) by employee/date`)
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
    importDoc.updatedBy = getActorAccountId(authUser)
    importDoc.remark = s(error.message || importDoc.remark)

    await importDoc.save()

    throw error
  }
}

async function listImports(query = {}) {
  const page = Math.max(Number(query.page || 1), 1)
  const limit = Math.min(Math.max(Number(query.limit || 10), 1), 100)
  const skip = (page - 1) * limit

  const filter = buildImportFilter(query)
  const sort = buildImportSort(query)

  const [items, total] = await Promise.all([
    AttendanceImport.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AttendanceImport.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    items: items.map(mapImportItem),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

async function getImportById(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw createHttpError('Invalid attendance import id', 400)
  }

  const doc = await AttendanceImport.findById(id).lean()

  if (!doc) {
    throw createHttpError('Attendance import not found', 404)
  }

  const recentRecords = await AttendanceRecord.find({ importId: id })
    .sort({
      rawRowNo: 1,
      employeeNo: 1,
      _id: 1,
    })
    .limit(50)
    .lean()

  return {
    ...mapImportItem(doc),
    previewRecords: recentRecords.map(mapRecordItem),
  }
}

async function downloadImportSample() {
  return {
    filename: 'attendance-import-sample.xlsx',
    buffer: buildAttendanceImportSampleWorkbook(),
  }
}

module.exports = {
  importExcel,
  listImports,
  getImportById,
  downloadImportSample,
  mapImportItem,
}