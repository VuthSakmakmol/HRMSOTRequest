// backend/src/modules/attendance/services/otDailyVerification.service.js
// Daily employee-level OT / Attendance reconciliation.
// Backend is the source of truth for all generated attendance and OT requests.

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AttendanceRecord = require('../models/AttendanceRecord')
const AttendanceVerificationAudit = require('../models/AttendanceVerificationAudit')
const OTRequest = require('../../ot/models/OTRequest')
const Employee = require('../../org/models/Employee')
const { classifyDayType } = require('../../calendar/services/dayType.service')
const { deriveAttendanceResult } = require('../utils/attendanceVerification')
const otService = require('../../ot/services/ot.service')
const otTimingService = require('../../ot/services/otTiming.service')

const ACTIVE_OT_STATUSES = ['PENDING', 'APPROVED']
const VERIFICATION_ATTENDANCE_SOURCE = 'OT_VERIFICATION'

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function asId(value) {
  return value ? String(value?._id || value?.id || value) : ''
}

function normalizedEmployeeNo(...values) {
  for (const value of values) {
    const employeeNo = upper(value)
    if (employeeNo) return employeeNo
  }
  return ''
}

// Old attendance imports and older OT records are not always linked by the
// same Mongo employeeId. Use the ObjectId first, then safely fall back to the
// immutable employee code stored on the record/request snapshot.
function employeeIdentityKeys(record = {}) {
  const keys = []
  const id = asId(record?.employeeId)
  const employeeNo = normalizedEmployeeNo(
    record?.employeeNo,
    record?.employeeCode,
    record?.importedEmployeeId,
  )

  if (id) keys.push(`ID:${id}`)
  if (employeeNo) keys.push(`NO:${employeeNo}`)

  return keys
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function appError(message, status = 400, code = 'ATTENDANCE_VERIFICATION_ERROR') {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.code = code
  return error
}

function getActorAccountId(authUser = {}) {
  const accountId = authUser?.accountId || authUser?.id || authUser?._id || null
  return isObjectId(accountId) ? accountId : null
}

function normalizeYmd(value) {
  const raw = s(value)
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw

  // attendanceDateValue is stored at UTC midnight. UTC protects historical
  // records from browser/server local-time drift while preserving its day key.
  return date.toISOString().slice(0, 10)
}

function toUtcMidnight(ymd) {
  const match = s(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s(value))
}

function toMinutes(value) {
  if (!isHHmm(value)) return null
  const [hours, minutes] = s(value).split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToLabel(value) {
  const minutes = Math.max(0, Math.round(Number(value || 0)))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  if (!rest) return `${hours}h`
  return `${hours}h ${rest}m`
}

function timeDifferenceMinutes(startTime, endTime, isCrossMidnight = false) {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start == null || end == null) return 0
  if (end >= start) return end - start
  return isCrossMidnight ? end + 1440 - start : 0
}

function currentValue(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (value !== undefined && value !== null && s(value)) return value
  }
  return ''
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return Math.round(number)
  }
  return 0
}

function effectiveOtEmployees(request = {}) {
  const requested = Array.isArray(request.requestedEmployees) ? request.requestedEmployees : []
  const approved = Array.isArray(request.approvedEmployees) ? request.approvedEmployees : []

  if (!approved.length) return requested

  const requestedByEmployee = new Map(
    requested
      .filter((item) => asId(item?.employeeId))
      .map((item) => [asId(item.employeeId), item]),
  )

  return approved.map((approvedItem) => {
    const requestedItem = requestedByEmployee.get(asId(approvedItem?.employeeId)) || {}

    return {
      ...requestedItem,
      ...approvedItem,
      startTime: currentValue(approvedItem, 'startTime', 'requestStartTime') || currentValue(requestedItem, 'startTime', 'requestStartTime'),
      endTime: currentValue(approvedItem, 'endTime', 'requestEndTime') || currentValue(requestedItem, 'endTime', 'requestEndTime'),
      requestStartTime: currentValue(approvedItem, 'requestStartTime', 'startTime') || currentValue(requestedItem, 'requestStartTime', 'startTime'),
      requestEndTime: currentValue(approvedItem, 'requestEndTime', 'endTime') || currentValue(requestedItem, 'requestEndTime', 'endTime'),
      requestedMinutes: firstPositiveNumber(
        approvedItem?.requestedMinutes,
        approvedItem?.totalRequestPaidMinutes,
        approvedItem?.totalMinutes,
        requestedItem?.requestedMinutes,
        requestedItem?.totalRequestPaidMinutes,
        requestedItem?.totalMinutes,
      ),
      totalRequestPaidMinutes: firstPositiveNumber(
        approvedItem?.totalRequestPaidMinutes,
        approvedItem?.totalMinutes,
        requestedItem?.totalRequestPaidMinutes,
        requestedItem?.totalMinutes,
      ),
    }
  })
}

function mapAttendance(record = {}) {
  if (!record) return null
  return {
    id: asId(record._id),
    employeeId: asId(record.employeeId),
    attendanceDate: normalizeYmd(record.attendanceDate || record.attendanceDateValue),
    clockIn: s(record.clockIn),
    clockOut: s(record.clockOut),
    attendanceSource: upper(record.attendanceSource || 'IMPORT'),
    status: upper(record.status),
    importedStatus: upper(record.importedStatus),
    shiftStartTime: s(record.shiftStartTime),
    shiftEndTime: s(record.shiftEndTime),
    isCrossMidnightShift: record.isCrossMidnightShift === true,
    dayType: upper(record.dayType || 'WORKING_DAY'),
    employeeNo: normalizedEmployeeNo(record.employeeNo, record.importedEmployeeId),
    employeeName: s(record.employeeName || record.importedEmployeeName),
    lineId: asId(record.lineId),
    lineCode: upper(record.lineCode),
    lineName: s(record.lineName),
    shiftId: asId(record.shiftId),
    shiftName: s(record.shiftName || record.importedShiftName),
    departmentName: s(record.departmentName || record.importedDepartmentName),
    positionName: s(record.positionName || record.importedPositionName),
    verificationMeta: record.verificationMeta || null,
  }
}

function mapAudit(doc = {}) {
  return {
    id: asId(doc._id),
    action: upper(doc.action),
    attendanceDate: s(doc.attendanceDate),
    employeeId: asId(doc.employeeId),
    employeeNo: upper(doc.employeeNo),
    employeeName: s(doc.employeeName),
    sourceOTRequestId: asId(doc.sourceOTRequestId),
    sourceOTRequestNo: upper(doc.sourceOTRequestNo),
    attendanceRecordId: asId(doc.attendanceRecordId),
    generatedOTRequestId: asId(doc.generatedOTRequestId),
    generatedOTRequestNo: upper(doc.generatedOTRequestNo),
    requesterEmployeeId: asId(doc.requesterEmployeeId),
    requesterEmployeeCode: upper(doc.requesterEmployeeCode),
    requesterName: s(doc.requesterName),
    before: doc.before || null,
    after: doc.after || null,
    createdAt: doc.createdAt || null,
  }
}

function mapRequestHeader(request = {}) {
  return {
    id: asId(request._id),
    requestNo: upper(request.requestNo),
    requesterEmployeeId: asId(request.requesterEmployeeId),
    requesterEmployeeCode: upper(request.requesterEmployeeCode),
    requesterName: s(request.requesterName),
    otDate: s(request.otDate),
    dayType: upper(request.dayType || 'WORKING_DAY'),
    status: upper(request.status),
    shiftId: asId(request.shiftId),
    shiftCode: upper(request.shiftCode),
    shiftName: s(request.shiftName),
    shiftStartTime: s(request.shiftStartTime),
    shiftEndTime: s(request.shiftEndTime),
    shiftCrossMidnight: request.shiftCrossMidnight === true,
    shiftOtOptionId: asId(request.shiftOtOptionId),
    shiftOtOptionLabel: s(request.shiftOtOptionLabel),
    otCalculationPolicyId: asId(request.otCalculationPolicyId),
    otCalculationPolicySnapshot: request.otCalculationPolicySnapshot || {},
  }
}

function mapOtEmployee(employee = {}) {
  return {
    employeeId: asId(employee.employeeId),
    employeeNo: normalizedEmployeeNo(employee.employeeCode, employee.employeeNo),
    employeeName: s(employee.employeeName || employee.displayName),
    departmentName: s(employee.departmentName),
    positionName: s(employee.positionName),
    lineId: asId(employee.lineId),
    lineCode: upper(employee.lineCode),
    lineName: s(employee.lineName || employee.lineLabel),
    requestedMinutes: firstPositiveNumber(
      employee.totalRequestPaidMinutes,
      employee.totalMinutes,
      employee.requestedMinutes,
    ),
    startTime: currentValue(employee, 'requestStartTime', 'startTime'),
    endTime: currentValue(employee, 'requestEndTime', 'endTime'),
    breakMinutes: Math.max(0, Number(employee.breakMinutes || 0)),
  }
}

function buildAttendanceOnlyEmployee(record = {}) {
  return {
    employeeId: asId(record.employeeId),
    employeeNo: normalizedEmployeeNo(record.employeeNo, record.importedEmployeeId),
    employeeName: s(record.employeeName || record.importedEmployeeName),
    departmentName: s(record.departmentName || record.importedDepartmentName),
    positionName: s(record.positionName || record.importedPositionName),
    lineId: asId(record.lineId),
    lineCode: upper(record.lineCode),
    lineName: s(record.lineName),
  }
}

function calculatePotentialOtMinutes(attendance = {}) {
  if (!attendance?.clockOut || !attendance?.shiftEndTime) return 0

  const minutes = timeDifferenceMinutes(
    attendance.shiftEndTime,
    attendance.clockOut,
    attendance.isCrossMidnightShift === true,
  )

  // For a normal shift, a scan-out before the shift end is not OT. For a
  // cross-midnight shift, timeDifferenceMinutes already carries the end time
  // into the following day when appropriate.
  return minutes > 0 ? minutes : 0
}

function createVerificationRow({ request = null, employee, attendance = null }) {
  const requestHeader = request ? mapRequestHeader(request) : null
  const otEmployee = employee && employee.requestedMinutes !== undefined
    ? mapOtEmployee(employee)
    : buildAttendanceOnlyEmployee(attendance || {})

  const attendanceOutput = mapAttendance(attendance)
  const potentialOtMinutes = requestHeader
    ? firstPositiveNumber(otEmployee.requestedMinutes)
    : calculatePotentialOtMinutes(attendanceOutput || {})

  const hasAttendance = Boolean(attendanceOutput?.id)
  const hasRequest = Boolean(requestHeader?.id)
  const result = hasRequest
    ? hasAttendance
      ? 'MATCHED'
      : 'MISSING_ATTENDANCE'
    : potentialOtMinutes > 0
      ? 'MISSING_OT_REQUEST'
      : 'ATTENDANCE_ONLY'

  return {
    id: hasRequest
      ? `REQUEST:${requestHeader.id}:${otEmployee.employeeId}`
      : `ATTENDANCE:${attendanceOutput?.id || otEmployee.employeeId}`,
    rowType: hasRequest ? 'REQUEST_EMPLOYEE' : 'ATTENDANCE_ONLY',
    attendanceDate: hasRequest ? requestHeader.otDate : attendanceOutput?.attendanceDate || '',
    request: requestHeader,
    employee: otEmployee,
    attendance: attendanceOutput,
    requestedOtMinutes: hasRequest ? potentialOtMinutes : 0,
    potentialOtMinutes: hasRequest ? 0 : potentialOtMinutes,
    result,
    canCreateAttendance: result === 'MISSING_ATTENDANCE' && ACTIVE_OT_STATUSES.includes(requestHeader?.status),
    canCreateOTRequest: result === 'MISSING_OT_REQUEST' && potentialOtMinutes > 0,
    canRecoverAttendance:
      attendanceOutput?.attendanceSource === VERIFICATION_ATTENDANCE_SOURCE &&
      Boolean(attendanceOutput?.verificationMeta?.createdFromOTRequestId),
  }
}

function matchesText(value, search) {
  const keyword = s(search).toLowerCase()
  if (!keyword) return true
  return s(value).toLowerCase().includes(keyword)
}

function matchesRow(row, query = {}) {
  const text = s(query.search).toLowerCase()
  const requester = s(query.requester).toLowerCase()
  const employee = s(query.employee).toLowerCase()

  const searchBag = [
    row?.request?.requestNo,
    row?.request?.requesterEmployeeCode,
    row?.request?.requesterName,
    row?.employee?.employeeNo,
    row?.employee?.employeeName,
    row?.employee?.lineCode,
    row?.employee?.lineName,
    row?.attendance?.clockIn,
    row?.attendance?.clockOut,
    row?.result,
  ].join(' ').toLowerCase()

  if (text && !searchBag.includes(text)) return false

  if (requester) {
    const requesterText = `${row?.request?.requesterEmployeeCode || ''} ${row?.request?.requesterName || ''}`.toLowerCase()
    if (!requesterText.includes(requester)) return false
  }

  if (employee) {
    const employeeText = `${row?.employee?.employeeNo || ''} ${row?.employee?.employeeName || ''}`.toLowerCase()
    if (!employeeText.includes(employee)) return false
  }

  if (s(query.result) && upper(row.result) !== upper(query.result)) return false
  if (s(query.status) && upper(row?.request?.status) !== upper(query.status)) return false
  if (s(query.line) && !matchesText(`${row?.employee?.lineCode || ''} ${row?.employee?.lineName || ''}`, query.line)) return false

  return true
}

function buildSummary(rows = []) {
  const uniqueRequests = new Set()
  const uniqueEmployees = new Set()
  const count = (result) => rows.filter((row) => row.result === result).length

  for (const row of rows) {
    if (row?.request?.id) uniqueRequests.add(row.request.id)

    // Daily totals must include both sides of reconciliation: OT-request
    // employees and attendance-only employees.
    const identity = employeeIdentityKeys(row.employee)[0]
    if (identity) uniqueEmployees.add(identity)
  }

  return {
    requestCount: uniqueRequests.size,
    employeeCount: uniqueEmployees.size,
    totalRows: rows.length,
    matchedCount: count('MATCHED'),
    missingAttendanceCount: count('MISSING_ATTENDANCE'),
    missingRequestCount: count('MISSING_OT_REQUEST'),
    attendanceOnlyCount: count('ATTENDANCE_ONLY'),
  }
}

function nextUtcDay(ymd) {
  const start = toUtcMidnight(ymd)
  if (!start) return null
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

async function hydrateLegacyAttendanceEmployees(records = []) {
  const employeeNos = Array.from(new Set(
    records
      .filter((record) => !asId(record?.employeeId))
      .map((record) => normalizedEmployeeNo(record?.employeeNo, record?.importedEmployeeId))
      .filter(Boolean),
  ))

  if (!employeeNos.length) return records

  const employees = await Employee.find({
    employeeCode: { $in: employeeNos },
  })
    .select({ _id: 1, employeeCode: 1, displayName: 1, isActive: 1 })
    .lean()

  const employeeByNo = new Map(
    employees.map((employee) => [normalizedEmployeeNo(employee.employeeCode), employee]),
  )

  return records.map((record) => {
    if (asId(record?.employeeId)) return record

    const employee = employeeByNo.get(
      normalizedEmployeeNo(record?.employeeNo, record?.importedEmployeeId),
    )
    if (!employee) return record

    return {
      ...record,
      employeeId: employee._id,
      employeeNo: normalizedEmployeeNo(record.employeeNo, employee.employeeCode),
      employeeName: s(record.employeeName || employee.displayName),
    }
  })
}

async function listDailyVerification(query = {}) {
  const attendanceDate = normalizeYmd(query.attendanceDate)
  if (!attendanceDate) throw appError('Verification date is required', 400, 'VERIFICATION_DATE_REQUIRED')

  const dateStart = toUtcMidnight(attendanceDate)
  const dateEnd = nextUtcDay(attendanceDate)

  // Do not silently hide rejected/cancelled/history rows. The status filter on
  // the page decides what is visible; creation buttons remain restricted to
  // active request statuses only.
  const requestFilter = { otDate: attendanceDate }
  if (s(query.status)) requestFilter.status = upper(query.status)

  const attendanceDateFilter = dateStart && dateEnd
    ? {
        $or: [
          { attendanceDate },
          { attendanceDateValue: { $gte: dateStart, $lt: dateEnd } },
        ],
      }
    : { attendanceDate }

  const [requests, rawAttendanceRecords] = await Promise.all([
    OTRequest.find(requestFilter)
      .sort({ requestNo: 1, createdAt: 1, _id: 1 })
      .lean(),
    AttendanceRecord.find({
      ...attendanceDateFilter,
      $and: [{ $or: [{ employeeId: { $ne: null } }, { employeeNo: { $ne: '' } }, { importedEmployeeId: { $ne: '' } }] }],
    })
      .sort({ employeeNo: 1, importedEmployeeId: 1, updatedAt: -1, _id: -1 })
      .lean(),
  ])

  const attendanceRecords = await hydrateLegacyAttendanceEmployees(rawAttendanceRecords)
  const attendanceByEmployeeId = new Map()
  const attendanceByEmployeeNo = new Map()

  for (const record of attendanceRecords) {
    const id = asId(record.employeeId)
    const employeeNo = normalizedEmployeeNo(record.employeeNo, record.importedEmployeeId)
    const updatedAt = new Date(record.updatedAt || record.createdAt || 0).getTime()

    if (id) {
      const previous = attendanceByEmployeeId.get(id)
      if (!previous || updatedAt >= new Date(previous.updatedAt || previous.createdAt || 0).getTime()) {
        attendanceByEmployeeId.set(id, record)
      }
    }

    if (employeeNo) {
      const previous = attendanceByEmployeeNo.get(employeeNo)
      if (!previous || updatedAt >= new Date(previous.updatedAt || previous.createdAt || 0).getTime()) {
        attendanceByEmployeeNo.set(employeeNo, record)
      }
    }
  }

  function getAttendanceForEmployee(employee = {}) {
    const id = asId(employee.employeeId)
    const employeeNo = normalizedEmployeeNo(employee.employeeNo, employee.employeeCode)
    return (id && attendanceByEmployeeId.get(id)) ||
      (employeeNo && attendanceByEmployeeNo.get(employeeNo)) ||
      null
  }

  const rows = []
  const requestEmployeeKeys = new Set()

  for (const request of requests) {
    for (const employee of effectiveOtEmployees(request)) {
      const keys = employeeIdentityKeys(employee)
      if (!keys.length) continue
      keys.forEach((key) => requestEmployeeKeys.add(key))

      rows.push(
        createVerificationRow({
          request,
          employee,
          attendance: getAttendanceForEmployee(employee),
        }),
      )
    }
  }

  for (const record of attendanceRecords) {
    const keys = employeeIdentityKeys(record)
    if (!keys.length || keys.some((key) => requestEmployeeKeys.has(key))) continue
    rows.push(createVerificationRow({ attendance: record }))
  }

  const filteredRows = rows
    .filter((row) => matchesRow(row, query))
    .sort((a, b) => {
      const aEmployee = `${a?.employee?.employeeNo || ''} ${a?.employee?.employeeName || ''}`
      const bEmployee = `${b?.employee?.employeeNo || ''} ${b?.employee?.employeeName || ''}`
      const employeeCompare = aEmployee.localeCompare(bEmployee)
      if (employeeCompare) return employeeCompare
      return s(a?.request?.requestNo).localeCompare(s(b?.request?.requestNo))
    })

  const page = Math.max(Number(query.page || 1), 1)
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 5000)
  const start = (page - 1) * limit
  const items = filteredRows.slice(start, start + limit)

  return {
    attendanceDate,
    items,
    summary: buildSummary(filteredRows),
    pagination: {
      page,
      limit,
      total: filteredRows.length,
      totalPages: Math.max(Math.ceil(filteredRows.length / limit), 1),
    },
  }
}

async function loadEmployeeForVerification(employeeId) {
  if (!isObjectId(employeeId)) {
    throw appError('Employee is invalid', 400, 'INVALID_EMPLOYEE_ID')
  }

  const employee = await Employee.findById(employeeId)
    .populate({ path: 'departmentId', select: { _id: 1, code: 1, name: 1 } })
    .populate({ path: 'positionId', select: { _id: 1, code: 1, name: 1 } })
    .populate({
      path: 'shiftId',
      select: { _id: 1, code: 1, name: 1, type: 1, startTime: 1, endTime: 1 },
    })
    .populate({ path: 'lineId', select: { _id: 1, code: 1, name: 1 } })
    .exec()

  if (!employee) throw appError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND')
  if (employee.isActive === false) throw appError('Employee is inactive', 409, 'EMPLOYEE_INACTIVE')
  return employee
}

function employeeSnapshot(employee = {}) {
  const department = employee.departmentId && typeof employee.departmentId === 'object' ? employee.departmentId : null
  const position = employee.positionId && typeof employee.positionId === 'object' ? employee.positionId : null
  const shift = employee.shiftId && typeof employee.shiftId === 'object' ? employee.shiftId : null
  const line = employee.lineId && typeof employee.lineId === 'object' ? employee.lineId : null

  return {
    employeeId: employee._id,
    employeeNo: upper(employee.employeeCode),
    employeeName: s(employee.displayName),
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

async function createAttendanceFromOTRequest(payload = {}, authUser = {}) {
  const otRequestId = s(payload.otRequestId)
  const employeeId = s(payload.employeeId)

  if (!isObjectId(otRequestId) || !isObjectId(employeeId)) {
    throw appError('OT request and employee are required', 400, 'INVALID_VERIFICATION_TARGET')
  }

  const request = await OTRequest.findById(otRequestId).lean()
  if (!request) throw appError('OT request not found', 404, 'OT_REQUEST_NOT_FOUND')
  if (!ACTIVE_OT_STATUSES.includes(upper(request.status))) {
    throw appError('Attendance can only be generated from Pending or Approved OT requests', 409, 'OT_REQUEST_NOT_ACTIVE')
  }

  const requestEmployee = effectiveOtEmployees(request).find((item) => asId(item.employeeId) === employeeId)
  if (!requestEmployee) throw appError('Employee is not inside this OT request', 404, 'OT_REQUEST_EMPLOYEE_NOT_FOUND')

  const existing = await AttendanceRecord.findOne({ employeeId, attendanceDate: request.otDate }).exec()
  if (existing) {
    if (
      upper(existing.attendanceSource) === VERIFICATION_ATTENDANCE_SOURCE &&
      asId(existing?.verificationMeta?.createdFromOTRequestId) === otRequestId
    ) {
      return {
        action: 'ALREADY_CREATED',
        attendanceRecord: mapAttendance(existing.toObject()),
      }
    }

    throw appError(
      'Attendance already exists for this employee and date. Verification will not overwrite Scan or Import attendance.',
      409,
      'ATTENDANCE_ALREADY_EXISTS',
    )
  }

  const employee = await loadEmployeeForVerification(employeeId)
  const snapshot = employeeSnapshot(employee)
  const clockIn = s(request.shiftStartTime || snapshot.shiftStartTime || '07:00')
  const clockOut = currentValue(requestEmployee, 'requestEndTime', 'endTime') || currentValue(request, 'requestEndTime', 'endTime')

  if (!isHHmm(clockIn) || !isHHmm(clockOut)) {
    throw appError(
      'The OT request does not have valid shift and OT end time. Please correct the OT timing first.',
      409,
      'OT_TIMING_NOT_READY',
    )
  }

  const dayInfo = await classifyDayType(request.otDate)
  const derived = deriveAttendanceResult({
    attendanceDate: request.otDate,
    clockIn,
    clockOut,
    importedStatus: 'PRESENT',
    employeeMatched: true,
    shiftMatched: true,
    shiftTimeMatched: true,
    shiftStartTime: snapshot.shiftStartTime || s(request.shiftStartTime),
    shiftEndTime: snapshot.shiftEndTime || s(request.shiftEndTime),
    lateGraceMinutes: 0,
  })

  const actorAccountId = getActorAccountId(authUser)
  const record = await AttendanceRecord.create({
    ...snapshot,
    attendanceDate: request.otDate,
    attendanceDateValue: toUtcMidnight(request.otDate),
    clockIn,
    clockOut,
    importedEmployeeId: snapshot.employeeNo,
    importedEmployeeName: snapshot.employeeName,
    importedDepartmentName: snapshot.departmentName,
    importedPositionName: snapshot.positionName,
    importedShiftName: snapshot.shiftName,
    importedStatus: 'PRESENT',
    attendanceSource: VERIFICATION_ATTENDANCE_SOURCE,
    verificationMeta: {
      createdFromOTRequestId: request._id,
      createdFromOTRequestNo: request.requestNo,
      createdFromEmployeeId: employee._id,
      generatedAt: new Date(),
      generatedBy: actorAccountId,
    },
    status: upper(derived.derivedStatus || 'PRESENT'),
    derivedStatusReason: s(derived.derivedStatusReason),
    derivedStatusReasonKey: s(derived.derivedStatusReasonKey),
    messageKey: s(derived.messageKey || derived.derivedStatusReasonKey),
    dayType: upper(dayInfo?.dayType || request.dayType || 'WORKING_DAY'),
    matchedBy: 'EMPLOYEE_NO',
    matchRemark: 'Created by OT Attendance Verification from the saved OT option and policy timing.',
    employeeMatched: true,
    nameMatched: true,
    departmentMatched: true,
    positionMatched: true,
    shiftMatched: true,
    shiftTimeMatched: true,
    shiftMatchStatus: 'MATCHED',
    hasClockIn: true,
    hasClockOut: true,
    isCrossMidnightShift: derived.isCrossMidnightShift === true,
    workedMinutes: Number(derived.workedMinutes || 0),
    lateMinutes: Number(derived.lateMinutes || 0),
    earlyOutMinutes: Number(derived.earlyOutMinutes || 0),
    validationIssues: [],
    rawRowNo: 0,
    rawData: {
      verification: {
        type: 'OT_REQUEST_TO_ATTENDANCE',
        requestNo: request.requestNo,
        requestId: asId(request._id),
        employeeRequestedMinutes: firstPositiveNumber(
          requestEmployee.totalRequestPaidMinutes,
          requestEmployee.totalMinutes,
          requestEmployee.requestedMinutes,
        ),
        employeeOtStartTime: currentValue(requestEmployee, 'requestStartTime', 'startTime'),
        employeeOtEndTime: clockOut,
      },
    },
    createdBy: actorAccountId,
    updatedBy: actorAccountId,
  })

  await AttendanceVerificationAudit.create({
    action: 'CREATE_ATTENDANCE',
    attendanceDate: request.otDate,
    employeeId: employee._id,
    employeeNo: snapshot.employeeNo,
    employeeName: snapshot.employeeName,
    sourceOTRequestId: request._id,
    sourceOTRequestNo: request.requestNo,
    attendanceRecordId: record._id,
    after: record.toObject(),
    createdBy: actorAccountId,
  })

  return {
    action: 'CREATED',
    attendanceRecord: mapAttendance(record.toObject()),
  }
}

async function recoverVerificationAttendance(payload = {}, authUser = {}) {
  const attendanceRecordId = s(payload.attendanceRecordId)
  if (!isObjectId(attendanceRecordId)) {
    throw appError('Attendance record is required', 400, 'INVALID_ATTENDANCE_RECORD')
  }

  const record = await AttendanceRecord.findById(attendanceRecordId).exec()
  if (!record) throw appError('Attendance record not found', 404, 'ATTENDANCE_NOT_FOUND')

  if (
    upper(record.attendanceSource) !== VERIFICATION_ATTENDANCE_SOURCE ||
    !record?.verificationMeta?.createdFromOTRequestId
  ) {
    throw appError(
      'Only attendance created by OT Verification can be recovered from this page.',
      409,
      'ATTENDANCE_RECOVERY_NOT_ALLOWED',
    )
  }

  const before = record.toObject()
  const actorAccountId = getActorAccountId(authUser)

  await AttendanceVerificationAudit.create({
    action: 'RECOVER_ATTENDANCE',
    attendanceDate: record.attendanceDate,
    employeeId: record.employeeId,
    employeeNo: record.employeeNo,
    employeeName: record.employeeName,
    sourceOTRequestId: record.verificationMeta.createdFromOTRequestId,
    sourceOTRequestNo: record.verificationMeta.createdFromOTRequestNo,
    attendanceRecordId: record._id,
    before,
    after: {
      recovered: true,
      result: 'NO_ATTENDANCE',
    },
    createdBy: actorAccountId,
  })

  await record.deleteOne()

  return {
    action: 'RECOVERED',
    attendanceDate: before.attendanceDate,
    employeeId: asId(before.employeeId),
  }
}

function optionId(option = {}) {
  return asId(option?.id || option?._id || option?.shiftOtOptionId)
}

function optionMinutes(option = {}) {
  return firstPositiveNumber(
    option.totalRequestPaidMinutes,
    option.totalMinutes,
    option.requestedMinutes,
  )
}

async function resolveShiftOptionForAttendance(employee = {}, attendance = {}) {
  const shiftId = asId(employee.shiftId)
  if (!shiftId) throw appError('Employee has no assigned shift. OT request cannot be generated.', 409, 'EMPLOYEE_SHIFT_MISSING')

  const lookup = await otTimingService.getShiftOTOptionsByShift(shiftId, {
    otDate: attendance.attendanceDate,
  })

  const rows = Array.isArray(lookup)
    ? lookup
    : Array.isArray(lookup?.items)
      ? lookup.items
      : []

  const expectedMinutes = calculatePotentialOtMinutes(mapAttendance(attendance))
  const option = rows
    .filter((item) => optionId(item))
    .sort((a, b) => {
      const aDefault = a?.isDefault === true ? 0 : 1
      const bDefault = b?.isDefault === true ? 0 : 1
      if (aDefault !== bDefault) return aDefault - bDefault
      return Math.abs(optionMinutes(a) - expectedMinutes) - Math.abs(optionMinutes(b) - expectedMinutes)
    })[0]

  if (!option) {
    throw appError(
      'No active OT option is configured for this employee shift and date.',
      409,
      'SHIFT_OT_OPTION_NOT_FOUND',
    )
  }

  return optionId(option)
}

async function createOTRequestFromAttendance(payload = {}, authUser = {}) {
  const attendanceRecordId = s(payload.attendanceRecordId)
  if (!isObjectId(attendanceRecordId)) {
    throw appError('Attendance record is required', 400, 'INVALID_ATTENDANCE_RECORD')
  }

  const attendance = await AttendanceRecord.findById(attendanceRecordId).lean()
  if (!attendance) throw appError('Attendance record not found', 404, 'ATTENDANCE_NOT_FOUND')
  if (!attendance.employeeId) throw appError('Attendance record has no matched employee', 409, 'ATTENDANCE_EMPLOYEE_MISSING')

  const potentialMinutes = calculatePotentialOtMinutes(mapAttendance(attendance))
  if (potentialMinutes <= 0) {
    throw appError(
      'Attendance scan-out does not show overtime after the shift end time.',
      409,
      'ATTENDANCE_HAS_NO_OVERTIME',
    )
  }

  const employee = await loadEmployeeForVerification(asId(attendance.employeeId))
  const managerId = asId(employee.reportsToEmployeeId)
  if (!managerId) {
    throw appError(
      'Employee has no direct manager. Set Reports To before generating this OT request.',
      409,
      'EMPLOYEE_MANAGER_MISSING',
    )
  }

  const manager = await Employee.findById(managerId).lean()
  if (!manager || manager.isActive === false) {
    throw appError('Employee direct manager is missing or inactive.', 409, 'EMPLOYEE_MANAGER_INVALID')
  }

  const activeDuplicate = await OTRequest.findOne({
    otDate: attendance.attendanceDate,
    status: { $in: ACTIVE_OT_STATUSES },
    $or: [
      { 'requestedEmployees.employeeId': employee._id },
      { 'approvedEmployees.employeeId': employee._id },
    ],
  })
    .select({ _id: 1, requestNo: 1 })
    .lean()

  if (activeDuplicate) {
    throw appError(
      `Employee already has an active OT request for this date (${activeDuplicate.requestNo}).`,
      409,
      'OT_REQUEST_ALREADY_EXISTS',
    )
  }

  const shiftOptionId = await resolveShiftOptionForAttendance(employee, attendance)
  const customStartTime = s(attendance.shiftEndTime || employee?.shiftId?.endTime)
  const customEndTime = s(attendance.clockOut)

  const generatedCrossMidnight = attendance.isCrossMidnightShift === true

  if (
    !isHHmm(customStartTime) ||
    !isHHmm(customEndTime) ||
    timeDifferenceMinutes(customStartTime, customEndTime, generatedCrossMidnight) <= 0
  ) {
    throw appError(
      'Attendance or shift time is incomplete. A generated OT request needs a scan-out after the employee shift end time.',
      409,
      'ATTENDANCE_OT_TIMING_INVALID',
    )
  }

  // The OT service remains the only place that builds the timing, policy snapshot,
  // approval chain, notifications, and duplicate protection. We deliberately use
  // CUSTOM_FIXED so the request follows the actual scan-out time; the selected
  // shift option supplies the correct OT policy for that shift/date.
  const generatedRequesterAuth = {
    ...authUser,
    employeeId: String(manager._id),
    isRootAdmin: true,
  }

  const created = await otService.create(
    {
      employeeIds: [String(employee._id)],
      otDate: attendance.attendanceDate,
      otTimingSource: 'CUSTOM_FIXED',
      shiftOtOptionId,
      customStartTime,
      customEndTime,
      customBreakMinutes: 0,
      employeeTimeOverrides: [],
      reason: `Generated from attendance verification using the employee's actual scan-out: ${customEndTime}.`,
    },
    generatedRequesterAuth,
  )

  const generatedId = asId(created?.id || created?._id)
  const generatedDoc = generatedId
    ? await OTRequest.findById(generatedId).lean()
    : null

  const actorAccountId = getActorAccountId(authUser)
  await AttendanceVerificationAudit.create({
    action: 'CREATE_OT_REQUEST',
    attendanceDate: attendance.attendanceDate,
    employeeId: employee._id,
    employeeNo: employee.employeeCode,
    employeeName: employee.displayName,
    attendanceRecordId: attendance._id,
    generatedOTRequestId: generatedDoc?._id || generatedId || null,
    generatedOTRequestNo: generatedDoc?.requestNo || created?.requestNo || '',
    requesterEmployeeId: manager._id,
    requesterEmployeeCode: manager.employeeCode,
    requesterName: manager.displayName,
    before: mapAttendance(attendance),
    after: generatedDoc || created || null,
    createdBy: actorAccountId,
  })

  return {
    action: 'CREATED',
    otRequest: {
      id: generatedId || null,
      requestNo: upper(generatedDoc?.requestNo || created?.requestNo),
      requesterEmployeeId: String(manager._id),
      requesterEmployeeCode: upper(manager.employeeCode),
      requesterName: s(manager.displayName),
      otDate: attendance.attendanceDate,
      status: upper(generatedDoc?.status || created?.status || 'PENDING'),
      scanOut: customEndTime,
      generatedFromAttendance: true,
    },
  }
}

async function listHistory(query = {}) {
  const filter = {}
  if (s(query.attendanceDate)) filter.attendanceDate = s(query.attendanceDate)
  if (isObjectId(query.attendanceRecordId)) filter.attendanceRecordId = query.attendanceRecordId
  if (isObjectId(query.otRequestId)) {
    filter.$or = [
      { sourceOTRequestId: query.otRequestId },
      { generatedOTRequestId: query.otRequestId },
    ]
  }

  const docs = await AttendanceVerificationAudit.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(Math.max(Number(query.limit || 100), 1), 500))
    .lean()

  return { items: docs.map(mapAudit) }
}

function buildExportRows(items = []) {
  return items.map((row, index) => ({
    No: index + 1,
    Date: row.attendanceDate,
    'Request No': row.request?.requestNo || '',
    'Requester ID': row.request?.requesterEmployeeCode || '',
    Requester: row.request?.requesterName || '',
    'Employee ID': row.employee?.employeeNo || '',
    Employee: row.employee?.employeeName || '',
    Line: row.employee?.lineName || '',
    Shift: row.request?.shiftName || row.attendance?.shiftName || '',
    'Requested OT': row.requestedOtMinutes ? minutesToLabel(row.requestedOtMinutes) : '',
    'Potential OT': row.potentialOtMinutes ? minutesToLabel(row.potentialOtMinutes) : '',
    'Clock In': row.attendance?.clockIn || '',
    'Clock Out': row.attendance?.clockOut || '',
    'Attendance Source': row.attendance?.attendanceSource || '',
    Result: row.result,
  }))
}

async function exportDailyVerification(query = {}) {
  const result = await listDailyVerification({
    ...query,
    page: 1,
    limit: 5000,
  })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(buildExportRows(result.items))
  worksheet['!cols'] = [
    { wch: 6 }, { wch: 13 }, { wch: 16 }, { wch: 15 }, { wch: 22 },
    { wch: 15 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
  ]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'OT Verification')

  return {
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    fileName: `OT_Verification_${s(query.attendanceDate) || 'Export'}.xlsx`,
    summary: result.summary,
  }
}

module.exports = {
  listDailyVerification,
  createAttendanceFromOTRequest,
  recoverVerificationAttendance,
  createOTRequestFromAttendance,
  listHistory,
  exportDailyVerification,
}
