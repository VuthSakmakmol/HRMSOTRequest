// backend/src/modules/attendance/services/attendanceScan.service.js

const mongoose = require('mongoose')

const AttendanceRecord = require('../models/AttendanceRecord')
const AttendanceScanLog = require('../models/AttendanceScanLog')
const Employee = require('../../org/models/Employee')
const { classifyDayType } = require('../../calendar/services/dayType.service')
const { deriveAttendanceResult } = require('../utils/attendanceVerification')
const { mapRecordItem } = require('./attendanceRecord.service')

const CAMBODIA_TIME_ZONE = 'Asia/Phnom_Penh'
const DEFAULT_CLOCK_IN = '07:00'
const SCAN_STATION_SOURCE = 'SCAN_STATION'

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function createHttpError(message, status = 400, extra = {}) {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  Object.assign(error, extra)
  return error
}

function getActorAccountId(authUser = {}) {
  const value = authUser?.accountId || authUser?.id || authUser?._id || null
  return value && mongoose.isValidObjectId(String(value)) ? String(value) : null
}

function getCambodiaNow(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMBODIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return {
    attendanceDate: `${parts.year}-${parts.month}-${parts.day}`,
    clockOut: `${parts.hour}:${parts.minute}`,
    scannedAt: now,
  }
}

function toUtcMidnight(ymd) {
  const match = s(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function toMinutes(hhmm) {
  const match = s(hhmm).match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function latestClockOut(existingClockOut, nextClockOut) {
  const currentMinutes = toMinutes(existingClockOut)
  const nextMinutes = toMinutes(nextClockOut)

  if (currentMinutes == null) return s(nextClockOut)
  if (nextMinutes == null) return s(existingClockOut)

  return nextMinutes >= currentMinutes ? s(nextClockOut) : s(existingClockOut)
}

function getEmployeeLineDoc(employee = {}) {
  return employee?.lineId && typeof employee.lineId === 'object' ? employee.lineId : null
}

function normalizeScannedValue(value) {
  return upper(value).replace(/\s+/g, '')
}

function isValidScannedValue(value) {
  const raw = s(value)

  if (!raw || raw.length > 50) return false
  if(/[\x00-\x1F\x7F]/.test(raw)) return false

  return true
}

function buildEmployeeSnapshot(employee = {}) {
  const department = employee?.departmentId && typeof employee.departmentId === 'object'
    ? employee.departmentId
    : null
  const position = employee?.positionId && typeof employee.positionId === 'object'
    ? employee.positionId
    : null
  const shift = employee?.shiftId && typeof employee.shiftId === 'object'
    ? employee.shiftId
    : null
  const line = getEmployeeLineDoc(employee)

  return {
    employeeId: employee?._id || null,
    employeeNo: upper(employee?.employeeCode),
    employeeName: s(employee?.displayName),

    departmentId: department?._id || null,
    departmentCode: upper(department?.code),
    departmentName: s(department?.name),

    positionId: position?._id || null,
    positionCode: upper(position?.code),
    positionName: s(position?.name),

    shiftId: shift?._id || null,
    shiftCode: upper(shift?.code),
    shiftName: s(shift?.name),
    shiftType: upper(shift?.type),
    shiftStartTime: s(shift?.startTime),
    shiftEndTime: s(shift?.endTime),

    lineId: line?._id || null,
    lineCode: upper(line?.code),
    lineName: s(line?.name),
  }
}

function buildRecordTiming({ employee, attendanceDate, clockOut }) {
  const snapshot = buildEmployeeSnapshot(employee)

  const derivedResult = deriveAttendanceResult({
    attendanceDate,
    clockIn: DEFAULT_CLOCK_IN,
    clockOut,
    importedStatus: 'PRESENT',
    employeeMatched: true,
    // A scan is matched directly to the employee's assigned shift. It is not a
    // comparison against an imported shift label.
    shiftMatched: true,
    shiftTimeMatched: true,
    shiftStartTime: snapshot.shiftStartTime,
    shiftEndTime: snapshot.shiftEndTime,
    lateGraceMinutes: 0,
  })

  return {
    snapshot,
    derivedResult,
  }
}

async function findEmployeeByScannedValue(scannedValue) {
  return Employee.findOne({ employeeCode: upper(scannedValue) })
    .populate({ path: 'departmentId', select: { _id: 1, code: 1, name: 1 } })
    .populate({ path: 'positionId', select: { _id: 1, code: 1, name: 1 } })
    .populate({
      path: 'shiftId',
      select: { _id: 1, code: 1, name: 1, type: 1, startTime: 1, endTime: 1 },
    })
    .populate({ path: 'lineId', select: { _id: 1, code: 1, name: 1 } })
    .exec()
}

async function createScanLog(payload = {}) {
  return AttendanceScanLog.create(payload)
}

function mapScanLogItem(doc = {}) {
  return {
    id: doc?._id ? String(doc._id) : null,
    rawScannedValue: s(doc?.rawScannedValue),
    normalizedScannedValue: upper(doc?.normalizedScannedValue),
    attendanceDate: s(doc?.attendanceDate),
    scannedAt: doc?.scannedAt || null,
    result: upper(doc?.result),
    reason: s(doc?.reason),
    stationName: s(doc?.stationName),
    employeeId: doc?.employeeId ? String(doc.employeeId) : null,
    employeeNo: upper(doc?.employeeNo),
    employeeName: s(doc?.employeeName),
    attendanceRecordId: doc?.attendanceRecordId ? String(doc.attendanceRecordId) : null,
  }
}

function mapEmployeeForScan(employee = {}) {
  const snapshot = buildEmployeeSnapshot(employee)

  return {
    id: snapshot.employeeId ? String(snapshot.employeeId) : null,
    employeeNo: snapshot.employeeNo,
    employeeName: snapshot.employeeName,
    departmentName: snapshot.departmentName,
    positionName: snapshot.positionName,
    lineName: snapshot.lineName,
    shiftName: snapshot.shiftName,
  }
}

async function logAndReturnFailure({
  rawScannedValue,
  normalizedScannedValue,
  attendanceDate,
  scannedAt,
  stationName,
  result,
  reason,
  employee = null,
  authUser,
}) {
  const log = await createScanLog({
    rawScannedValue,
    normalizedScannedValue,
    attendanceDate,
    scannedAt,
    stationName,
    result,
    reason,
    employeeId: employee?._id || null,
    employeeNo: upper(employee?.employeeCode),
    employeeName: s(employee?.displayName),
    createdBy: getActorAccountId(authUser),
  })

  return {
    accepted: false,
    action: 'NOT_RECORDED',
    result,
    reason,
    attendanceDate,
    scannedAt,
    scanLog: mapScanLogItem(log.toObject()),
    employee: employee ? mapEmployeeForScan(employee) : null,
  }
}

async function submitScan(payload = {}, authUser = {}) {
  const rawScannedValue = s(payload.scannedValue)
  const normalizedScannedValue = normalizeScannedValue(rawScannedValue)
  const stationName = s(payload.stationName || 'SCAN_STATION') || 'SCAN_STATION'
  const cambodiaNow = getCambodiaNow()

  if (!isValidScannedValue(rawScannedValue)) {
    return logAndReturnFailure({
      rawScannedValue: rawScannedValue || '(empty)',
      normalizedScannedValue,
      attendanceDate: cambodiaNow.attendanceDate,
      scannedAt: cambodiaNow.scannedAt,
      stationName,
      result: 'INVALID_FORMAT',
      reason: 'Card value is empty, too long, or contains invalid characters.',
      authUser,
    })
  }

  const employee = await findEmployeeByScannedValue(normalizedScannedValue)

  if (!employee) {
    return logAndReturnFailure({
      rawScannedValue,
      normalizedScannedValue,
      attendanceDate: cambodiaNow.attendanceDate,
      scannedAt: cambodiaNow.scannedAt,
      stationName,
      result: 'EMPLOYEE_NOT_FOUND',
      reason: 'Card not recognized. No employee matches this Employee ID.',
      authUser,
    })
  }

  if (employee.isActive === false) {
    return logAndReturnFailure({
      rawScannedValue,
      normalizedScannedValue,
      attendanceDate: cambodiaNow.attendanceDate,
      scannedAt: cambodiaNow.scannedAt,
      stationName,
      result: 'EMPLOYEE_INACTIVE',
      reason: 'This employee is inactive. Attendance was not recorded.',
      employee,
      authUser,
    })
  }

  const existingRecord = await AttendanceRecord.findOne({
    employeeId: employee._id,
    attendanceDate: cambodiaNow.attendanceDate,
  })
    .sort({ updatedAt: -1, _id: -1 })
    .exec()

  const finalClockOut = latestClockOut(existingRecord?.clockOut, cambodiaNow.clockOut)
  const { snapshot, derivedResult } = buildRecordTiming({
    employee,
    attendanceDate: cambodiaNow.attendanceDate,
    clockOut: finalClockOut,
  })

  const actorAccountId = getActorAccountId(authUser)
  const scanRawData = {
    ...(existingRecord?.rawData && typeof existingRecord.rawData === 'object'
      ? existingRecord.rawData
      : {}),
    scanStation: {
      lastScannedValue: normalizedScannedValue,
      lastScannedAt: cambodiaNow.scannedAt.toISOString(),
      stationName,
      timeZone: CAMBODIA_TIME_ZONE,
    },
  }

  const recordPayload = {
    ...snapshot,
    employeeId: employee._id,
    attendanceDate: cambodiaNow.attendanceDate,
    attendanceDateValue: toUtcMidnight(cambodiaNow.attendanceDate),
    clockIn: DEFAULT_CLOCK_IN,
    clockOut: finalClockOut,

    importedEmployeeId: snapshot.employeeNo,
    importedEmployeeName: snapshot.employeeName,
    importedDepartmentName: snapshot.departmentName,
    importedPositionName: snapshot.positionName,
    importedShiftName: snapshot.shiftName,
    importedStatus: 'PRESENT',

    attendanceSource: SCAN_STATION_SOURCE,
    lastScanAt: cambodiaNow.scannedAt,
    lastScanValue: normalizedScannedValue,

    status: upper(derivedResult.derivedStatus || 'UNKNOWN'),
    derivedStatusReason: s(derivedResult.derivedStatusReason),
    derivedStatusReasonKey: s(derivedResult.derivedStatusReasonKey),
    messageKey: s(derivedResult.messageKey || derivedResult.derivedStatusReasonKey),
    dayType: upper((await classifyDayType(cambodiaNow.attendanceDate)).dayType || 'WORKING_DAY'),

    matchedBy: 'EMPLOYEE_NO',
    matchRemark: '',
    employeeMatched: true,
    nameMatched: true,
    departmentMatched: true,
    positionMatched: true,
    shiftMatched: true,
    shiftTimeMatched: true,
    shiftMatchStatus: 'MATCHED',

    hasClockIn: true,
    hasClockOut: true,
    isCrossMidnightShift:
      typeof derivedResult.isCrossMidnightShift === 'boolean'
        ? derivedResult.isCrossMidnightShift
        : null,
    workedMinutes: Number(derivedResult.workedMinutes || 0),
    lateMinutes: Number(derivedResult.lateMinutes || 0),
    earlyOutMinutes: Number(derivedResult.earlyOutMinutes || 0),
    validationIssues: [],
    rawRowNo: 0,
    rawData: scanRawData,
    updatedBy: actorAccountId,
  }

  let attendanceRecord
  let action

  if (existingRecord) {
    Object.assign(existingRecord, recordPayload)
    await existingRecord.save()
    attendanceRecord = existingRecord
    action = 'UPDATED'
  } else {
    attendanceRecord = await AttendanceRecord.create({
      ...recordPayload,
      importId: null,
      createdBy: actorAccountId,
    })
    action = 'CREATED'
  }

  const scanLog = await createScanLog({
    rawScannedValue,
    normalizedScannedValue,
    attendanceDate: cambodiaNow.attendanceDate,
    scannedAt: cambodiaNow.scannedAt,
    stationName,
    result: 'SUCCESS',
    reason:
      action === 'UPDATED'
        ? 'Attendance scan-out was updated to the latest scan time.'
        : 'Attendance was recorded successfully.',
    employeeId: employee._id,
    employeeNo: snapshot.employeeNo,
    employeeName: snapshot.employeeName,
    attendanceRecordId: attendanceRecord._id,
    createdBy: actorAccountId,
  })

  return {
    accepted: true,
    action,
    result: 'SUCCESS',
    attendanceDate: cambodiaNow.attendanceDate,
    scannedAt: cambodiaNow.scannedAt,
    scanTime: cambodiaNow.clockOut,
    scanIn: DEFAULT_CLOCK_IN,
    scanOut: finalClockOut,
    employee: mapEmployeeForScan(employee),
    attendanceRecord: mapRecordItem(attendanceRecord.toObject()),
    scanLog: mapScanLogItem(scanLog.toObject()),
  }
}

function buildLogSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return null

  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  return {
    $or: [
      { rawScannedValue: regex },
      { normalizedScannedValue: regex },
      { employeeNo: regex },
      { employeeName: regex },
      { result: regex },
      { reason: regex },
      { stationName: regex },
    ],
  }
}

async function listScanLogs(query = {}) {
  const page = Math.max(Number(query.page || 1), 1)
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 200)
  const skip = (page - 1) * limit

  const filter = {}
  if (s(query.attendanceDate)) filter.attendanceDate = s(query.attendanceDate)
  if (s(query.result)) filter.result = upper(query.result)

  const searchFilter = buildLogSearchFilter(query.search)
  if (searchFilter) filter.$and = [searchFilter]

  const [items, total] = await Promise.all([
    AttendanceScanLog.find(filter).sort({ scannedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    AttendanceScanLog.countDocuments(filter),
  ])

  return {
    items: items.map(mapScanLogItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  }
}

async function getScanSummary(query = {}) {
  const filter = {}
  if (s(query.attendanceDate)) filter.attendanceDate = s(query.attendanceDate)

  const [byResult, uniqueFailedCardValues] = await Promise.all([
    AttendanceScanLog.aggregate([
      { $match: filter },
      { $group: { _id: '$result', count: { $sum: 1 } } },
    ]),
    AttendanceScanLog.distinct('normalizedScannedValue', {
      ...filter,
      result: { $ne: 'SUCCESS' },
      normalizedScannedValue: { $ne: '' },
    }),
  ])

  const counts = new Map(byResult.map((item) => [upper(item._id), Number(item.count || 0)]))
  const totalScans = Array.from(counts.values()).reduce((sum, value) => sum + value, 0)
  const successCount = Number(counts.get('SUCCESS') || 0)

  return {
    attendanceDate: s(query.attendanceDate),
    totalScans,
    successCount,
    failedCount: Math.max(totalScans - successCount, 0),
    uniqueFailedCardCount: uniqueFailedCardValues.length,
    byResult: Object.fromEntries(counts),
  }
}

module.exports = {
  CAMBODIA_TIME_ZONE,
  DEFAULT_CLOCK_IN,
  submitScan,
  listScanLogs,
  getScanSummary,
}
