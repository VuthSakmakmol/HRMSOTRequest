// backend/src/modules/ot/services/ot.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')

const OTRequest = require('../models/OTRequest')
const AttendanceRecord = require('../../attendance/models/AttendanceRecord')

const Employee = require('../../org/models/Employee')
const Department = require('../../org/models/Department')
const Position = require('../../org/models/Position')
const ProductionLine = require('../../org/models/ProductionLine')
const Shift = require('../../shift/models/Shift')

const employeeScopeService = require('../../org/services/employeeScope.service')
const otTimingService = require('./otTiming.service')

// One employee can only appear in one OT request per date.
// Keep this broad so Create, Edit, and the employee picker all treat any existing
// request record for the selected date as unavailable.
const OT_DUPLICATE_BLOCKING_STATUSES = [
  'PENDING',
  'PENDING_REQUESTER_CONFIRMATION',
  'APPROVED',
  'REJECTED',
  'REQUESTER_DISAGREED',
  'CANCELLED',
]

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function id(value) {
  return value ? String(value?._id || value?.id || value) : ''
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function appError({
  statusCode = 400,
  code,
  messageKey,
  message,
  field = null,
  params = {},
}) {
  return new AppError({
    statusCode,
    code,
    messageKey,
    message,
    field,
    params,
  })
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeIdArray(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

function employeeLineIds(employee = {}) {
  return normalizeIdArray([
    ...(Array.isArray(employee.lineIds) ? employee.lineIds : []),
    employee.lineId,
  ])
}

function hasEmployeeLine(employee = {}) {
  return employeeLineIds(employee).length > 0
}

function actorAccountId(authUser) {
  const actorId = authUser?.accountId || authUser?.id || authUser?._id
  return isObjectId(actorId) ? actorId : null
}

function todayYMDInPhnomPenh() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(new Date())
  const map = {}

  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }

  return `${map.year}-${map.month}-${map.day}`
}

function isTodayInPhnomPenh(ymd) {
  return s(ymd) === todayYMDInPhnomPenh()
}

function firstText(...values) {
  for (const value of values) {
    const text = s(value)
    if (text) return text
  }

  return ''
}

function formatDateTime(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function employeeCode(employee = {}) {
  return s(employee.employeeNo || employee.employeeCode || employee.code)
}

function employeeName(employee = {}) {
  return s(employee.displayName || employee.employeeName || employee.name)
}

function buildEmployeeLabel(item = {}) {
  return (
    [s(item.employeeCode), s(item.employeeName)].filter(Boolean).join(' - ') ||
    s(item.employeeId)
  )
}

function statusKey(status) {
  const value = upper(status)

  const map = {
    PENDING: 'ot.status.pending',
    PENDING_REQUESTER_CONFIRMATION: 'ot.status.pendingRequesterConfirmation',
    APPROVED: 'ot.status.approved',
    REJECTED: 'ot.status.rejected',
    REQUESTER_DISAGREED: 'ot.status.requesterDisagreed',
    CANCELLED: 'ot.status.cancelled',
  }

  return map[value] || 'common.status.unknown'
}

function statusSeverity(status) {
  const value = upper(status)

  if (value === 'APPROVED') return 'success'
  if (value === 'REJECTED') return 'danger'
  if (value === 'REQUESTER_DISAGREED') return 'danger'
  if (value === 'PENDING_REQUESTER_CONFIRMATION') return 'info'
  if (value === 'CANCELLED') return 'secondary'

  return 'warning'
}

function dayTypeKey(dayType) {
  const value = upper(dayType)

  if (value === 'HOLIDAY') return 'ot.dayType.holiday'
  if (value === 'SUNDAY') return 'ot.dayType.sunday'

  return 'ot.dayType.workingDay'
}

function dayTypeSeverity(dayType) {
  const value = upper(dayType)

  if (value === 'HOLIDAY') return 'danger'
  if (value === 'SUNDAY') return 'warning'

  return 'success'
}

function otUnavailableStatusLabel(status) {
  const normalized = upper(status)

  if (normalized === 'PENDING') return 'Pending for approval'
  if (normalized === 'PENDING_REQUESTER_CONFIRMATION') return 'Waiting requester confirmation'
  if (normalized === 'APPROVED') return 'Already approved'

  return normalized || 'Unavailable'
}

async function generateRequestNo() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `OT-${yyyy}${mm}`

  const latest = await OTRequest.findOne({
    requestNo: { $regex: `^${prefix}-\\d{4}$` },
  })
    .sort({ requestNo: -1 })
    .lean()

  let nextNumber = 1

  if (latest?.requestNo) {
    const lastPart = Number(String(latest.requestNo).split('-').pop())
    if (Number.isFinite(lastPart)) nextNumber = lastPart + 1
  }

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`
}

async function resolveLineSnapshot(lineId) {
  const cleanLineId = s(lineId)

  if (!cleanLineId || !isObjectId(cleanLineId)) {
    return {
      lineId: null,
      lineCode: '',
      lineName: '',
      lineLabel: '',
    }
  }

  const line = await ProductionLine.findById(cleanLineId).lean()

  if (!line) {
    return {
      lineId: cleanLineId,
      lineCode: '',
      lineName: '',
      lineLabel: '',
    }
  }

  const lineCode = s(line.code)
  const lineName = s(line.name)

  return {
    lineId: String(line._id),
    lineCode,
    lineName,
    lineLabel: [lineCode, lineName].filter(Boolean).join(' · '),
  }
}

async function resolveEmployeeSnapshot(employeeId) {
  const cleanEmployeeId = s(employeeId)

  if (!isObjectId(cleanEmployeeId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_EMPLOYEE_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid employee id',
      field: 'employeeId',
    })
  }

  const employee = await Employee.findById(cleanEmployeeId).lean()

  if (!employee) {
    throw appError({
      statusCode: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      messageKey: 'employee.error.notFound',
      message: 'Employee not found',
      field: 'employeeId',
    })
  }

  if (employee.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_INACTIVE',
      messageKey: 'employee.error.inactive',
      message: 'Employee is inactive',
      field: 'employeeId',
    })
  }

  const [department, position, shift, line] = await Promise.all([
    employee.departmentId ? Department.findById(employee.departmentId).lean() : null,
    employee.positionId ? Position.findById(employee.positionId).lean() : null,
    employee.shiftId ? Shift.findById(employee.shiftId).lean() : null,
    resolveLineSnapshot(employee.lineId),
  ])

  return {
    employee,
    department,
    position,
    shift: shift
      ? {
          _id: shift._id,
          code: s(shift.code),
          name: s(shift.name),
          type: upper(shift.type),
          startTime: s(shift.startTime),
          breakStartTime: s(shift.breakStartTime),
          breakEndTime: s(shift.breakEndTime),
          endTime: s(shift.endTime),
          crossMidnight: shift.crossMidnight === true,
          isActive: shift.isActive !== false,
        }
      : null,
    line,
  }
}

async function resolveEmployeesSnapshotsWithContext(employeeIds = []) {
  const result = []

  for (const employeeId of employeeIds) {
    const { employee, department, position, shift, line } =
      await resolveEmployeeSnapshot(employeeId)

    result.push({
      snapshot: {
        employeeId: employee._id,

        employeeCode: employeeCode(employee),
        employeeName: employeeName(employee),

        departmentId: department?._id || null,
        departmentCode: s(department?.code),
        departmentName: s(department?.name),

        positionId: position?._id || null,
        positionCode: s(position?.code),
        positionName: s(position?.name),

        lineId: line?.lineId || null,
        lineCode: s(line?.lineCode),
        lineName: s(line?.lineName),
        lineLabel: s(line?.lineLabel),
      },
      shift,
    })
  }

  return result
}

async function assertSelectedEmployeesInsideRequesterScope(authUser, employeeIds = []) {
  await employeeScopeService.assertEmployeesInsideManagedScope(authUser, employeeIds)
}

function collectEmployeeSnapshotsFromRequest(doc) {
  return [
    ...(Array.isArray(doc?.requestedEmployees) ? doc.requestedEmployees : []),
    ...(Array.isArray(doc?.approvedEmployees) ? doc.approvedEmployees : []),
    ...(Array.isArray(doc?.proposedApprovedEmployees)
      ? doc.proposedApprovedEmployees
      : []),
  ]
}

function collectDuplicateEmployeesFromRequest(doc, selectedIdSet, duplicateMap) {
  const collections = collectEmployeeSnapshotsFromRequest(doc)

  for (const item of collections) {
    const employeeId = s(item?.employeeId)

    if (!employeeId || !selectedIdSet.has(employeeId)) continue
    if (duplicateMap.has(employeeId)) continue

    duplicateMap.set(employeeId, {
      employeeId,
      employeeCode: s(item?.employeeCode),
      employeeName: s(item?.employeeName),
      employeeLabel: buildEmployeeLabel(item),
      requestId: doc?._id ? String(doc._id) : '',
      requestNo: s(doc?.requestNo),
      otDate: s(doc?.otDate),
      status: upper(doc?.status),
      statusKey: statusKey(doc?.status),
      statusLabel: otUnavailableStatusLabel(doc?.status),
    })
  }
}

async function ensureNoDuplicateOTEmployeesForDate({
  otDate,
  employeeIds = [],
  excludeRequestId = null,
}) {
  const date = s(otDate)
  const uniqueEmployeeIds = normalizeIdArray(employeeIds)

  if (!date || !uniqueEmployeeIds.length) return

  const employeeObjectIds = uniqueEmployeeIds
    .filter(isObjectId)
    .map((item) => new mongoose.Types.ObjectId(item))

  if (!employeeObjectIds.length) return

  const filter = {
    otDate: date,
    status: { $in: OT_DUPLICATE_BLOCKING_STATUSES },
    $or: [
      { 'requestedEmployees.employeeId': { $in: employeeObjectIds } },
      { 'approvedEmployees.employeeId': { $in: employeeObjectIds } },
      { 'proposedApprovedEmployees.employeeId': { $in: employeeObjectIds } },
    ],
  }

  if (excludeRequestId && isObjectId(excludeRequestId)) {
    filter._id = {
      $ne: new mongoose.Types.ObjectId(excludeRequestId),
    }
  }

  const existingRequests = await OTRequest.find(filter)
    .select({
      _id: 1,
      requestNo: 1,
      otDate: 1,
      status: 1,
      requestedEmployees: 1,
      approvedEmployees: 1,
      proposedApprovedEmployees: 1,
    })
    .lean()

  if (!existingRequests.length) return

  const selectedIdSet = new Set(uniqueEmployeeIds)
  const duplicateMap = new Map()

  for (const request of existingRequests) {
    collectDuplicateEmployeesFromRequest(request, selectedIdSet, duplicateMap)
  }

  const duplicates = Array.from(duplicateMap.values())

  if (!duplicates.length) return

  throw appError({
    statusCode: 409,
    code: 'OT_EMPLOYEE_DUPLICATE_DATE',
    messageKey: 'ot.request.error.employeeDuplicateDate',
    message: 'Some employees already have OT request on this date',
    field: 'employeeIds',
    params: {
      otDate: date,
      duplicates,
      duplicateEmployeeIds: duplicates.map((item) => item.employeeId),
    },
  })
}

async function ensureEmployeesHaveProductionLine(employeeIds = []) {
  const uniqueEmployeeIds = normalizeIdArray(employeeIds)

  if (!uniqueEmployeeIds.length) return

  const employees = await Employee.find({
    _id: {
      $in: uniqueEmployeeIds
        .filter(isObjectId)
        .map((item) => new mongoose.Types.ObjectId(item)),
    },
  })
    .select({
      _id: 1,
      employeeNo: 1,
      employeeCode: 1,
      displayName: 1,
      lineId: 1,
      lineIds: 1,
    })
    .lean()

  const employeeById = new Map(
    employees.map((employee) => [String(employee._id), employee]),
  )

  const missingLineEmployees = uniqueEmployeeIds
    .map((employeeId) => employeeById.get(employeeId))
    .filter(Boolean)
    .filter((employee) => !hasEmployeeLine(employee))
    .map((employee) => ({
      employeeId: String(employee._id),
      employeeCode: employeeCode(employee),
      employeeName: employeeName(employee),
      employeeLabel: [employeeCode(employee), employeeName(employee)]
        .filter(Boolean)
        .join(' - '),
    }))

  if (!missingLineEmployees.length) return

  throw appError({
    statusCode: 400,
    code: 'OT_EMPLOYEE_LINE_REQUIRED',
    messageKey: 'ot.request.error.employeeLineRequired',
    message:
      'Some selected employees have no production line and cannot be selected for OT',
    field: 'employeeIds',
    params: {
      employees: missingLineEmployees,
      employeeIds: missingLineEmployees.map((item) => item.employeeId),
    },
  })
}

async function ensureEmployeesHaveTodayClockIn({ otDate, employeeIds = [] }) {
  const date = s(otDate)
  const uniqueEmployeeIds = normalizeIdArray(employeeIds)

  if (!date || !uniqueEmployeeIds.length) return
  if (!isTodayInPhnomPenh(date)) return

  const employeeObjectIds = uniqueEmployeeIds
    .filter(isObjectId)
    .map((item) => new mongoose.Types.ObjectId(item))

  if (!employeeObjectIds.length) return

  const records = await AttendanceRecord.find({
    attendanceDate: date,
    employeeId: { $in: employeeObjectIds },
    $or: [{ hasClockIn: true }, { clockIn: { $exists: true, $ne: '' } }],
  })
    .select({
      employeeId: 1,
      clockIn: 1,
      hasClockIn: 1,
    })
    .lean()

  const clockInEmployeeIdSet = new Set(
    records.map((record) => s(record.employeeId)).filter(Boolean),
  )

  const missingEmployeeIds = uniqueEmployeeIds.filter(
    (employeeId) => !clockInEmployeeIdSet.has(employeeId),
  )

  if (!missingEmployeeIds.length) return

  const employees = await Employee.find({
    _id: {
      $in: missingEmployeeIds
        .filter(isObjectId)
        .map((item) => new mongoose.Types.ObjectId(item)),
    },
  })
    .select({
      employeeNo: 1,
      displayName: 1,
    })
    .lean()

  const missingEmployees = employees.map((employee) => ({
    employeeId: String(employee._id),
    employeeCode: employeeCode(employee),
    employeeName: employeeName(employee),
    employeeLabel: [employeeCode(employee), employeeName(employee)]
      .filter(Boolean)
      .join(' - '),
  }))

  throw appError({
    statusCode: 400,
    code: 'OT_TODAY_ATTENDANCE_TIME_IN_REQUIRED',
    messageKey: 'ot.request.error.todayAttendanceTimeInRequired',
    message: 'Cannot create OT request for today because some employees do not have attendance time-in',
    field: 'employeeIds',
    params: {
      otDate: date,
      missingEmployees,
      missingEmployeeIds,
    },
  })
}

function collectUnavailableEmployeesFromRequest(doc, map) {
  const collections = collectEmployeeSnapshotsFromRequest(doc)

  for (const item of collections) {
    const employeeId = s(item?.employeeId)

    if (!employeeId) continue
    if (map.has(employeeId)) continue

    map.set(employeeId, {
      employeeId,
      employeeCode: s(item?.employeeCode),
      employeeName: s(item?.employeeName),
      employeeLabel: buildEmployeeLabel(item),
      requestId: doc?._id ? String(doc._id) : '',
      requestNo: s(doc?.requestNo),
      otDate: s(doc?.otDate),
      status: upper(doc?.status),
      statusKey: statusKey(doc?.status),
      statusLabel: otUnavailableStatusLabel(doc?.status),
    })
  }
}

async function listUnavailableEmployeesForDate(query = {}) {
  const otDate = s(query.otDate)

  const docs = await OTRequest.find({
    otDate,
    status: { $in: OT_DUPLICATE_BLOCKING_STATUSES },
  })
    .select({
      _id: 1,
      requestNo: 1,
      otDate: 1,
      status: 1,
      requestedEmployees: 1,
      approvedEmployees: 1,
      proposedApprovedEmployees: 1,
    })
    .lean()

  const map = new Map()

  for (const doc of docs) {
    collectUnavailableEmployeesFromRequest(doc, map)
  }

  const items = Array.from(map.values()).sort((a, b) =>
    `${a.employeeCode} ${a.employeeName}`.localeCompare(
      `${b.employeeCode} ${b.employeeName}`,
    ),
  )

  return {
    otDate,
    items,
    employeeIds: items.map((item) => item.employeeId),
    total: items.length,
  }
}

async function getUpwardApproverChain(employeeId, options = {}) {
  const maxDepth = Number(options.maxDepth || 20)
  const requesterId = s(employeeId)

  if (!isObjectId(requesterId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_EMPLOYEE_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid employee id',
      field: 'employeeId',
    })
  }

  const current = await Employee.findById(requesterId).lean()

  if (!current) {
    throw appError({
      statusCode: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      messageKey: 'employee.error.notFound',
      message: 'Employee not found',
      field: 'employeeId',
    })
  }

  const visited = new Set([String(current._id)])
  const chain = []

  let depth = 0
  let nextApproverId = current.reportsToEmployeeId

  while (nextApproverId) {
    const key = String(nextApproverId)

    if (visited.has(key)) {
      throw appError({
        statusCode: 400,
        code: 'ORG_CHART_CYCLE',
        messageKey: 'org.error.chartCycle',
        message: 'Organization chart contains a cycle',
      })
    }

    visited.add(key)

    const approver = await Employee.findById(nextApproverId).lean()

    if (!approver) {
      throw appError({
        statusCode: 400,
        code: 'ORG_CHART_BROKEN',
        messageKey: 'org.error.approverNotFound',
        message: 'Organization chart is broken: approver not found',
      })
    }

    if (approver.isActive === false) {
      throw appError({
        statusCode: 400,
        code: 'APPROVER_INACTIVE',
        messageKey: 'ot.request.error.approverInactive',
        message: 'Approver is inactive',
        params: {
          approverEmployeeId: String(approver._id),
          approverName: employeeName(approver),
        },
      })
    }

    chain.push(approver)
    nextApproverId = approver.reportsToEmployeeId

    depth += 1

    if (depth > maxDepth) {
      throw appError({
        statusCode: 400,
        code: 'ORG_CHART_TOO_DEEP',
        messageKey: 'org.error.chartTooDeep',
        message: 'Organization chart is too deep or cyclic',
      })
    }
  }

  return chain
}

async function resolveApprovalFlow(requesterEmployeeId) {
  const requesterId = s(requesterEmployeeId)

  if (!isObjectId(requesterId)) {
    throw appError({
      statusCode: 400,
      code: 'REQUESTER_EMPLOYEE_REQUIRED',
      messageKey: 'ot.request.error.requesterEmployeeRequired',
      message: 'Requester employee profile is required',
      field: 'requesterEmployeeId',
    })
  }

  const upwardChain = await getUpwardApproverChain(requesterId)

  const workflowEmployees = upwardChain
    .map((employee) => ({
      employee,
      role: upper(employee.otWorkflowRole || 'NONE'),
    }))
    .filter((item) => ['APPROVER', 'ACKNOWLEDGE'].includes(item.role))

  const approverEmployees = workflowEmployees.filter(
    (item) => item.role === 'APPROVER',
  )

  if (!approverEmployees.length) {
    throw appError({
      statusCode: 400,
      code: 'OT_APPROVER_NOT_FOUND',
      messageKey: 'ot.request.error.approverNotFound',
      message: 'No OT approver found in organization chart',
    })
  }

  const firstApproverIndex = workflowEmployees.findIndex(
    (item) => item.role === 'APPROVER',
  )

  const steps = workflowEmployees.map((item, index) => {
    const employee = item.employee
    const isApprover = item.role === 'APPROVER'

    return {
      stepNo: index + 1,
      stepType: item.role,
      approverEmployeeId: employee._id,
      approverCode: employeeCode(employee),
      approverName: employeeName(employee),
      status: isApprover
        ? index === firstApproverIndex
          ? 'PENDING'
          : 'WAITING'
        : 'ACKNOWLEDGED',
      actedAt: isApprover ? null : new Date(),
      actedBy: null,
      remark: isApprover ? '' : 'Auto acknowledged by workflow',
    }
  })

  const currentApproverStep = steps.find(
    (step) => step.stepType === 'APPROVER' && step.status === 'PENDING',
  )

  const finalApproverStep = [...steps]
    .reverse()
    .find((step) => step.stepType === 'APPROVER')

  return {
    approvalSteps: steps,
    currentApprovalStep: currentApproverStep?.stepNo || 1,
    currentApproverEmployeeId: currentApproverStep?.approverEmployeeId || null,
    finalApproverEmployeeId: finalApproverStep?.approverEmployeeId || null,
  }
}

function mapEmployeeOutput(item = {}) {
  const lineCode = s(item.lineCode)
  const lineName = s(item.lineName)

  return {
    employeeId: item.employeeId ? String(item.employeeId) : null,
    employeeCode: s(item.employeeCode),
    employeeName: s(item.employeeName),

    departmentId: item.departmentId ? String(item.departmentId) : null,
    departmentCode: s(item.departmentCode),
    departmentName: s(item.departmentName),

    positionId: item.positionId ? String(item.positionId) : null,
    positionCode: s(item.positionCode),
    positionName: s(item.positionName),

    lineId: item.lineId ? String(item.lineId) : null,
    lineCode,
    lineName,
    lineLabel: firstText(
      item.lineLabel,
      lineCode && lineName ? `${lineCode} · ${lineName}` : '',
      lineCode,
      lineName,
    ),

    otTimeMode: upper(item.otTimeMode || 'DEFAULT'),
    startTime: s(item.startTime),
    endTime: s(item.endTime),

    breakMinutes: Number(item.breakMinutes || 0),
    requestedMinutes: Number(item.requestedMinutes || 0),

    totalRequestPaidMinutes: Number(
      item.totalRequestPaidMinutes ?? item.totalMinutes ?? 0,
    ),
    totalMinutes: Number(item.totalRequestPaidMinutes ?? item.totalMinutes ?? 0),
    totalHours: Number(item.totalHours || 0),
  }
}

function mapApprovalStepOutput(step = {}) {
  return {
    stepNo: Number(step.stepNo || 0),
    stepType: upper(step.stepType || 'APPROVER'),
    approverEmployeeId: step.approverEmployeeId ? String(step.approverEmployeeId) : null,
    approverCode: s(step.approverCode),
    approverName: s(step.approverName),
    status: upper(step.status),
    actedAt: step.actedAt || null,
    actedBy: step.actedBy ? String(step.actedBy) : null,
    remark: s(step.remark),
  }
}

function buildOtOptionOutput(doc = {}) {
  const requestedMinutes = Number(doc.requestedMinutes || 0)
  const breakMinutes = Number(doc.breakMinutes || 0)
  const totalRequestPaidMinutes = Number(
    doc.totalRequestPaidMinutes ?? doc.totalMinutes ?? 0,
  )

  return {
    id: doc.shiftOtOptionId ? String(doc.shiftOtOptionId) : null,
    label: s(doc.shiftOtOptionLabel),
    timingMode: s(doc.shiftOtOptionTimingMode),
    timingSource: upper(doc.otTimingSource || 'SHIFT_OPTION'),

    requestStartTime: s(doc.requestStartTime || doc.startTime),
    requestEndTime: s(doc.requestEndTime || doc.endTime),

    requestedMinutes,
    breakMinutes,
    totalRequestPaidMinutes,
    totalRequestPaidHours: Number((totalRequestPaidMinutes / 60).toFixed(2)),

    fixedStartTime: s(doc.shiftOtOptionFixedStartTime),
    fixedEndTime: s(doc.shiftOtOptionFixedEndTime),
    startAfterShiftEndMinutes: Number(doc.shiftOtOptionStartAfterShiftEndMinutes || 0),
  }
}

function effectiveEmployeesForDoc(doc = {}) {
  if (
    upper(doc.status) === 'PENDING_REQUESTER_CONFIRMATION' &&
    Array.isArray(doc.proposedApprovedEmployees) &&
    doc.proposedApprovedEmployees.length
  ) {
    return doc.proposedApprovedEmployees
  }

  if (Array.isArray(doc.approvedEmployees) && doc.approvedEmployees.length) {
    return doc.approvedEmployees
  }

  return Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees : []
}

function effectiveEmployeeCountForDoc(doc = {}) {
  return effectiveEmployeesForDoc(doc).length
}

function sortApprovalSteps(steps = []) {
  return [...(Array.isArray(steps) ? steps : [])].sort(
    (a, b) => Number(a.stepNo || 0) - Number(b.stepNo || 0),
  )
}

function findCurrentApprovalStep(doc = {}) {
  const steps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  const currentStepNo = Number(doc.currentApprovalStep || 1)

  return (
    steps.find((step) => Number(step.stepNo || 0) === currentStepNo) ||
    steps.find((step) => upper(step.status) === 'PENDING') ||
    null
  )
}

function findMyApprovalStep(doc = {}, authUser = {}) {
  const actorEmployeeId = s(authUser.employeeId)

  if (!actorEmployeeId) return null

  const steps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []

  return steps.find((step) => s(step.approverEmployeeId) === actorEmployeeId) || null
}

function hasApprovedStep(doc = {}) {
  const steps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  return steps.some((step) => upper(step.status) === 'APPROVED')
}

function permissionCodesOf(authUser = {}) {
  return Array.isArray(authUser.effectivePermissionCodes)
    ? authUser.effectivePermissionCodes.map((item) => upper(item)).filter(Boolean)
    : []
}

function hasPermission(authUser = {}, permissionCode) {
  if (authUser?.isRootAdmin === true) return true

  const target = upper(permissionCode)
  if (!target) return false

  return permissionCodesOf(authUser).includes(target)
}

function canModifyOTRequestBeforeApproval(doc = {}, authUser = {}) {
  const status = upper(doc.status)

  if (status !== 'PENDING') return false
  if (hasApprovedStep(doc)) return false

  return hasPermission(authUser, 'OT_REQUEST_UPDATE')
}

function canEditOTRequest(doc = {}, authUser = {}) {
  return canModifyOTRequestBeforeApproval(doc, authUser)
}

function canCancelOTRequest(doc = {}, authUser = {}) {
  return canModifyOTRequestBeforeApproval(doc, authUser)
}

function canRequesterConfirm(doc = {}, authUser = {}) {
  const actorEmployeeId = s(authUser.employeeId)
  const ownerEmployeeId = s(doc.requesterEmployeeId)
  const status = upper(doc.status)
  const confirmation = upper(doc.requesterConfirmationStatus)

  if (!actorEmployeeId || !ownerEmployeeId) return false
  if (actorEmployeeId !== ownerEmployeeId) return false
  if (status !== 'PENDING_REQUESTER_CONFIRMATION') return false
  if (confirmation !== 'PENDING') return false

  return true
}

function assertCanEditOTRequest(doc = {}, authUser = {}) {
  if (!canEditOTRequest(doc, authUser)) {
    throw appError({
      statusCode: 403,
      code: 'OT_REQUEST_EDIT_NOT_ALLOWED',
      messageKey: 'ot.request.error.editNotAllowed',
      message: 'This OT request cannot be edited',
    })
  }
}

function assertCanCancelOTRequest(doc = {}, authUser = {}) {
  if (!canCancelOTRequest(doc, authUser)) {
    throw appError({
      statusCode: 403,
      code: 'OT_REQUEST_CANCEL_NOT_ALLOWED',
      messageKey: 'ot.request.error.cancelNotAllowed',
      message: 'This OT request cannot be cancelled',
    })
  }
}

function assertCanRequesterConfirm(doc = {}, authUser = {}) {
  if (!canRequesterConfirm(doc, authUser)) {
    throw appError({
      statusCode: 403,
      code: 'OT_REQUEST_CONFIRM_NOT_ALLOWED',
      messageKey: 'ot.request.error.confirmNotAllowed',
      message: 'Requester confirmation is not available for this OT request',
    })
  }
}

function buildApprovalActionContext(doc = {}, authUser = {}) {
  const requestStatus = upper(doc.status)
  const actorEmployeeId = s(authUser.employeeId)
  const currentApproverEmployeeId = s(doc.currentApproverEmployeeId)

  const currentStep = findCurrentApprovalStep(doc)
  const myStep = findMyApprovalStep(doc, authUser)

  const currentStepStatus = upper(currentStep?.status)
  const myApprovalStatus = upper(myStep?.status)

  const isAssignedCurrentApprover =
    actorEmployeeId &&
    currentApproverEmployeeId &&
    actorEmployeeId === currentApproverEmployeeId

  const isMyTurn =
    requestStatus === 'PENDING' &&
    currentStepStatus === 'PENDING' &&
    isAssignedCurrentApprover

  const canDecideAsRoot =
    authUser?.isRootAdmin === true &&
    requestStatus === 'PENDING' &&
    currentStepStatus === 'PENDING'

  const canDecide = isMyTurn || canDecideAsRoot

  return {
    currentApprovalStepStatus: currentStepStatus,
    currentApproverName: s(currentStep?.approverName),
    currentApproverCode: s(currentStep?.approverCode),

    myApprovalStep: myStep ? mapApprovalStepOutput(myStep) : null,
    myApprovalStepNo: myStep ? Number(myStep.stepNo || 0) : null,
    myApprovalStatus: myApprovalStatus || (canDecide ? 'PENDING' : ''),
    isMyTurn,
    canDecide,
  }
}

function findLastStepByStatus(steps = [], status) {
  const normalizedStatus = upper(status)
  const sorted = sortApprovalSteps(steps)

  return [...sorted].reverse().find((step) => upper(step.status) === normalizedStatus) || null
}

function approverDisplayName(step = {}) {
  return s(step.approverName) || 'Unknown approver'
}

function buildApprovalDisplay(doc = {}) {
  const status = upper(doc.status)
  const steps = sortApprovalSteps(doc.approvalSteps)
  const totalApproverSteps = steps.filter(
    (step) => upper(step.stepType) === 'APPROVER',
  ).length

  const currentStep =
    findCurrentApprovalStep(doc) ||
    steps.find((step) => upper(step.status) === 'PENDING') ||
    null

  const rejectedStep = findLastStepByStatus(steps, 'REJECTED')
  const lastApprovedStep = findLastStepByStatus(steps, 'APPROVED')

  if (status === 'APPROVED') {
    return {
      type: 'APPROVED',
      severity: 'success',
      labelKey: 'ot.approvalDisplay.approved',
      label: lastApprovedStep
        ? `Approved by ${approverDisplayName(lastApprovedStep)}`
        : 'Approved',
      subLabel: lastApprovedStep
        ? `Final approval step ${Number(lastApprovedStep.stepNo || 0)}`
        : '',
      stepNo: lastApprovedStep ? Number(lastApprovedStep.stepNo || 0) : null,
      approverName: s(lastApprovedStep?.approverName),
      approverCode: s(lastApprovedStep?.approverCode),
      actedAt: lastApprovedStep?.actedAt || null,
    }
  }

  if (status === 'REJECTED') {
    return {
      type: 'REJECTED',
      severity: 'danger',
      labelKey: 'ot.approvalDisplay.rejected',
      label: rejectedStep
        ? `Rejected by ${approverDisplayName(rejectedStep)}`
        : 'Rejected',
      subLabel: rejectedStep ? `Step ${Number(rejectedStep.stepNo || 0)}` : '',
      stepNo: rejectedStep ? Number(rejectedStep.stepNo || 0) : null,
      approverName: s(rejectedStep?.approverName),
      approverCode: s(rejectedStep?.approverCode),
      actedAt: rejectedStep?.actedAt || null,
    }
  }

  if (status === 'PENDING_REQUESTER_CONFIRMATION') {
    return {
      type: 'REQUESTER_CONFIRMATION',
      severity: 'warning',
      labelKey: 'ot.approvalDisplay.waitingRequesterConfirmation',
      label: 'Waiting for requester confirmation',
      subLabel: 'Approver adjusted employee list',
      stepNo: Number(doc.currentApprovalStep || 0) || null,
      approverName: '',
      approverCode: '',
      actedAt: null,
    }
  }

  if (status === 'REQUESTER_DISAGREED') {
    return {
      type: 'REQUESTER_DISAGREED',
      severity: 'danger',
      labelKey: 'ot.approvalDisplay.requesterDisagreed',
      label: 'Requester disagreed',
      subLabel: 'Adjusted employee list was not accepted',
      stepNo: Number(doc.currentApprovalStep || 0) || null,
      approverName: '',
      approverCode: '',
      actedAt: doc.requesterConfirmedAt || null,
    }
  }

  if (status === 'CANCELLED') {
    return {
      type: 'CANCELLED',
      severity: 'secondary',
      labelKey: 'ot.approvalDisplay.cancelled',
      label: 'Cancelled',
      subLabel: '',
      stepNo: null,
      approverName: '',
      approverCode: '',
      actedAt: null,
    }
  }

  return {
    type: 'WAITING',
    severity: 'warning',
    labelKey: 'ot.approvalDisplay.waitingApproval',
    label: currentStep
      ? `Waiting for ${approverDisplayName(currentStep)} to approve`
      : 'Waiting for approval',
    subLabel: currentStep
      ? `Approval step ${Number(currentStep.stepNo || 0)} / ${totalApproverSteps}`
      : '',
    stepNo: currentStep ? Number(currentStep.stepNo || 0) : null,
    approverName: s(currentStep?.approverName),
    approverCode: s(currentStep?.approverCode),
    actedAt: null,
  }
}

function buildComparisonSummary(doc = {}) {
  const requestedEmployees = Array.isArray(doc.requestedEmployees)
    ? doc.requestedEmployees
    : []
  const approvedEmployees = Array.isArray(doc.approvedEmployees)
    ? doc.approvedEmployees
    : []
  const proposedApprovedEmployees = Array.isArray(doc.proposedApprovedEmployees)
    ? doc.proposedApprovedEmployees
    : []

  const approvedIdSet = new Set(approvedEmployees.map((item) => s(item.employeeId)))
  const proposedIdSet = new Set(
    proposedApprovedEmployees.map((item) => s(item.employeeId)),
  )

  return {
    requestedEmployeeCount: requestedEmployees.length,
    approvedEmployeeCount: approvedEmployees.length,
    proposedApprovedEmployeeCount: proposedApprovedEmployees.length,

    removedFromOriginalCount: requestedEmployees.filter(
      (item) => !approvedIdSet.has(s(item.employeeId)),
    ).length,

    pendingRemovedCount: proposedApprovedEmployees.length
      ? approvedEmployees.filter((item) => !proposedIdSet.has(s(item.employeeId))).length
      : 0,
  }
}

function mapListItem(doc = {}, authUser = {}) {
  const approvalSteps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  const effectiveEmployees = effectiveEmployeesForDoc(doc)
  const approvalContext = buildApprovalActionContext(doc, authUser)
  const approvalDisplay = buildApprovalDisplay(doc)
  const totalRequestPaidMinutes = Number(
    doc.totalRequestPaidMinutes ?? doc.totalMinutes ?? 0,
  )

  return {
    id: String(doc._id),
    _id: String(doc._id),

    requestNo: s(doc.requestNo),

    requesterEmployeeId: doc.requesterEmployeeId ? String(doc.requesterEmployeeId) : null,
    requesterEmployeeCode: s(doc.requesterEmployeeCode),
    requesterName: s(doc.requesterName),

    otDate: s(doc.otDate),

    dayType: upper(doc.dayType),
    dayTypeKey: s(doc.dayTypeKey || dayTypeKey(doc.dayType)),
    dayTypeSeverity: s(doc.dayTypeSeverity || dayTypeSeverity(doc.dayType)),

    status: upper(doc.status),
    statusKey: statusKey(doc.status),
    statusSeverity: statusSeverity(doc.status),

    startTime: s(doc.startTime),
    endTime: s(doc.endTime),
    requestStartTime: s(doc.requestStartTime || doc.startTime),
    requestEndTime: s(doc.requestEndTime || doc.endTime),

    requestedMinutes: Number(doc.requestedMinutes || 0),
    breakMinutes: Number(doc.breakMinutes || 0),
    totalRequestPaidMinutes,
    totalMinutes: totalRequestPaidMinutes,
    totalHours: Number(doc.totalHours || 0),

    shiftId: doc.shiftId ? String(doc.shiftId) : null,
    shiftCode: s(doc.shiftCode),
    shiftName: s(doc.shiftName),
    shiftType: s(doc.shiftType),
    shiftStartTime: s(doc.shiftStartTime),
    shiftEndTime: s(doc.shiftEndTime),
    shiftCrossMidnight: doc.shiftCrossMidnight === true,

    otTimingSource: upper(doc.otTimingSource || 'SHIFT_OPTION'),

    shiftOtOptionId: doc.shiftOtOptionId ? String(doc.shiftOtOptionId) : null,
    shiftOtOptionLabel: s(doc.shiftOtOptionLabel),
    shiftOtOptionTimingMode: s(doc.shiftOtOptionTimingMode),
    shiftOtOptionStartAfterShiftEndMinutes: Number(
      doc.shiftOtOptionStartAfterShiftEndMinutes || 0,
    ),
    shiftOtOptionFixedStartTime: s(doc.shiftOtOptionFixedStartTime),
    shiftOtOptionFixedEndTime: s(doc.shiftOtOptionFixedEndTime),

    otOption: buildOtOptionOutput(doc),

    otCalculationPolicyId: doc.otCalculationPolicyId
      ? String(doc.otCalculationPolicyId)
      : null,
    otCalculationPolicySnapshot: doc.otCalculationPolicySnapshot || {},

    reason: s(doc.reason),

    employeeCount: effectiveEmployeeCountForDoc(doc),
    requestedEmployeeCount: Number(doc.requestedEmployeeCount || 0),
    approvedEmployeeCount: Number(doc.approvedEmployeeCount || 0),
    proposedApprovedEmployeeCount: Number(doc.proposedApprovedEmployeeCount || 0),

    requesterConfirmationStatus: upper(doc.requesterConfirmationStatus),

    currentApprovalStep: Number(doc.currentApprovalStep || 1),
    currentApproverEmployeeId: doc.currentApproverEmployeeId
      ? String(doc.currentApproverEmployeeId)
      : null,
    finalApproverEmployeeId: doc.finalApproverEmployeeId
      ? String(doc.finalApproverEmployeeId)
      : null,

    approvalStepCount: approvalSteps.length,
    approvalSteps: approvalSteps.map(mapApprovalStepOutput),

    approvalDisplay,
    approvalDisplayType: approvalDisplay.type,
    approvalDisplayLabel: approvalDisplay.label,
    approvalDisplayLabelKey: approvalDisplay.labelKey,
    approvalDisplaySubLabel: approvalDisplay.subLabel,
    approvalDisplaySeverity: approvalDisplay.severity,
    approvalDisplayStepNo: approvalDisplay.stepNo,
    approvalDisplayApproverName: approvalDisplay.approverName,
    approvalDisplayApproverCode: approvalDisplay.approverCode,
    approvalDisplayActedAt: approvalDisplay.actedAt,

    currentApprovalStepStatus: approvalContext.currentApprovalStepStatus,
    currentApproverName: approvalContext.currentApproverName,
    currentApproverCode: approvalContext.currentApproverCode,

    myApprovalStep: approvalContext.myApprovalStep,
    myApprovalStepNo: approvalContext.myApprovalStepNo,
    myApprovalStatus: approvalContext.myApprovalStatus,
    isMyTurn: approvalContext.isMyTurn,
    canDecide: approvalContext.canDecide,
    canApprove: approvalContext.canDecide,

    hasApprovedStep: hasApprovedStep(doc),
    canEdit: canEditOTRequest(doc, authUser),
    canCancel: canCancelOTRequest(doc, authUser),
    canRequesterConfirm: canRequesterConfirm(doc, authUser),

    employees: effectiveEmployees.map(mapEmployeeOutput),

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function mapDetail(doc = {}, authUser = {}) {
  const requestedEmployees = Array.isArray(doc.requestedEmployees)
    ? doc.requestedEmployees
    : []
  const approvedEmployees = Array.isArray(doc.approvedEmployees)
    ? doc.approvedEmployees
    : []
  const proposedApprovedEmployees = Array.isArray(doc.proposedApprovedEmployees)
    ? doc.proposedApprovedEmployees
    : []

  return {
    ...mapListItem(doc, authUser),

    requestedEmployees: requestedEmployees.map(mapEmployeeOutput),
    approvedEmployees: approvedEmployees.map(mapEmployeeOutput),
    proposedApprovedEmployees: proposedApprovedEmployees.map(mapEmployeeOutput),

    comparisonSummary: buildComparisonSummary(doc),

    requesterConfirmedAt: doc.requesterConfirmedAt || null,
    requesterConfirmationRemark: s(doc.requesterConfirmationRemark),

    lastAdjustmentByEmployeeId: doc.lastAdjustmentByEmployeeId
      ? String(doc.lastAdjustmentByEmployeeId)
      : null,
    lastAdjustmentByEmployeeCode: s(doc.lastAdjustmentByEmployeeCode),
    lastAdjustmentByEmployeeName: s(doc.lastAdjustmentByEmployeeName),
    lastAdjustmentAt: doc.lastAdjustmentAt || null,
    lastAdjustmentRemark: s(doc.lastAdjustmentRemark),
    lastAdjustmentStepNo: Number(doc.lastAdjustmentStepNo || 0) || null,

    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
  }
}

function buildSearchFilter(search) {
  const keyword = s(search)

  if (!keyword) return null

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { requestNo: regex },
      { requesterEmployeeCode: regex },
      { requesterName: regex },

      { shiftCode: regex },
      { shiftName: regex },
      { shiftType: regex },
      { shiftOtOptionLabel: regex },

      { 'requestedEmployees.employeeCode': regex },
      { 'requestedEmployees.employeeName': regex },
      { 'requestedEmployees.departmentCode': regex },
      { 'requestedEmployees.departmentName': regex },
      { 'requestedEmployees.positionCode': regex },
      { 'requestedEmployees.positionName': regex },
      { 'requestedEmployees.lineCode': regex },
      { 'requestedEmployees.lineName': regex },

      { 'approvedEmployees.employeeCode': regex },
      { 'approvedEmployees.employeeName': regex },
      { 'approvedEmployees.departmentCode': regex },
      { 'approvedEmployees.departmentName': regex },
      { 'approvedEmployees.positionCode': regex },
      { 'approvedEmployees.positionName': regex },
      { 'approvedEmployees.lineCode': regex },
      { 'approvedEmployees.lineName': regex },

      { 'proposedApprovedEmployees.employeeCode': regex },
      { 'proposedApprovedEmployees.employeeName': regex },

      { reason: regex },
      { 'otCalculationPolicySnapshot.code': regex },
      { 'otCalculationPolicySnapshot.name': regex },
    ],
  }
}

function pushMembershipFilter(filter, fieldName, value) {
  filter.$and = filter.$and || []

  filter.$and.push({
    $or: [
      { [`requestedEmployees.${fieldName}`]: value },
      { [`approvedEmployees.${fieldName}`]: value },
      { [`proposedApprovedEmployees.${fieldName}`]: value },
    ],
  })
}

function buildListFilter(query = {}) {
  const filter = {}

  if (s(query.status)) filter.status = upper(query.status)
  if (s(query.dayType)) filter.dayType = upper(query.dayType)

  if (s(query.employeeId) && isObjectId(query.employeeId)) {
    pushMembershipFilter(filter, 'employeeId', query.employeeId)
  }

  if (s(query.departmentId) && isObjectId(query.departmentId)) {
    pushMembershipFilter(filter, 'departmentId', query.departmentId)
  }

  if (s(query.positionId) && isObjectId(query.positionId)) {
    pushMembershipFilter(filter, 'positionId', query.positionId)
  }

  if (s(query.lineId) && isObjectId(query.lineId)) {
    pushMembershipFilter(filter, 'lineId', query.lineId)
  }

  if (s(query.otDateFrom) || s(query.otDateTo)) {
    filter.otDate = {}

    if (s(query.otDateFrom)) filter.otDate.$gte = s(query.otDateFrom)
    if (s(query.otDateTo)) filter.otDate.$lte = s(query.otDateTo)
  }

  const searchFilter = buildSearchFilter(query.search)

  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildApprovalInboxFilter(query = {}, authUser = {}) {
  const filter = {}

  if (s(query.status)) {
    filter.status = upper(query.status)
  }

  if (!authUser.isRootAdmin) {
    const approverEmployeeId = s(authUser.employeeId)

    if (!approverEmployeeId || !isObjectId(approverEmployeeId)) {
      throw appError({
        statusCode: 400,
        code: 'ACCOUNT_EMPLOYEE_LINK_REQUIRED',
        messageKey: 'auth.error.employeeLinkRequired',
        message: 'Your account is not linked to an employee profile',
      })
    }

    filter.$or = [
      { currentApproverEmployeeId: approverEmployeeId },
      { 'approvalSteps.approverEmployeeId': approverEmployeeId },
    ]
  }

  if (s(query.dayType)) {
    filter.dayType = upper(query.dayType)
  }

  if (s(query.employeeId) && isObjectId(query.employeeId)) {
    pushMembershipFilter(filter, 'employeeId', query.employeeId)
  }

  if (s(query.departmentId) && isObjectId(query.departmentId)) {
    pushMembershipFilter(filter, 'departmentId', query.departmentId)
  }

  if (s(query.positionId) && isObjectId(query.positionId)) {
    pushMembershipFilter(filter, 'positionId', query.positionId)
  }

  if (s(query.lineId) && isObjectId(query.lineId)) {
    pushMembershipFilter(filter, 'lineId', query.lineId)
  }

  if (s(query.otDateFrom) || s(query.otDateTo)) {
    filter.otDate = {}

    if (s(query.otDateFrom)) filter.otDate.$gte = s(query.otDateFrom)
    if (s(query.otDateTo)) filter.otDate.$lte = s(query.otDateTo)
  }

  const searchFilter = buildSearchFilter(query.search)

  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildSort(query = {}) {
  const direction = query.sortOrder === 'asc' ? 1 : -1

  const allowedSortMap = {
    createdAt: 'createdAt',
    otDate: 'otDate',
    requestNo: 'requestNo',
    requesterName: 'requesterName',
    status: 'status',
    totalHours: 'totalHours',
    employeeCount: 'approvedEmployeeCount',
  }

  const sortField = allowedSortMap[query.sortBy] || 'createdAt'

  return {
    [sortField]: direction,
    createdAt: -1,
    _id: -1,
  }
}

function makeSafeSheetName(input, usedNames = new Set()) {
  const raw = s(input) || 'Sheet'
  let name = raw.replace(/[\\/*?:[\]]/g, ' ').trim()

  if (!name) name = 'Sheet'
  if (name.length > 31) name = name.slice(0, 31).trim()

  let finalName = name
  let counter = 1

  while (usedNames.has(finalName)) {
    const suffix = ` (${counter})`
    const base = name.slice(0, Math.max(1, 31 - suffix.length)).trim()
    finalName = `${base}${suffix}`
    counter += 1
  }

  usedNames.add(finalName)

  return finalName
}

function appendEmployeeSection(rows, title, employees = []) {
  rows.push([title])
  rows.push([
    'No',
    'Employee ID',
    'Employee Code',
    'Employee Name',
    'Department',
    'Position',
    'Line',
    'Start Time',
    'End Time',
    'Break Minutes',
    'Requested Minutes',
    'Paid Minutes',
    'Paid Hours',
  ])

  for (const [index, item] of employees.entries()) {
    const paidMinutes = Number(item.totalRequestPaidMinutes ?? item.totalMinutes ?? 0)

    rows.push([
      index + 1,
      s(item.employeeId),
      s(item.employeeCode),
      s(item.employeeName),
      s(item.departmentName),
      s(item.positionName),
      firstText(item.lineLabel, item.lineName, item.lineCode),
      s(item.startTime),
      s(item.endTime),
      Number(item.breakMinutes || 0),
      Number(item.requestedMinutes || 0),
      paidMinutes,
      Number((paidMinutes / 60).toFixed(2)),
    ])
  }

  rows.push([])
}

function buildRequestSheetRows(doc = {}) {
  const requestedEmployees = Array.isArray(doc.requestedEmployees)
    ? doc.requestedEmployees
    : []
  const approvedEmployees = Array.isArray(doc.approvedEmployees)
    ? doc.approvedEmployees
    : []
  const proposedApprovedEmployees = Array.isArray(doc.proposedApprovedEmployees)
    ? doc.proposedApprovedEmployees
    : []
  const approvalSteps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  const totalRequestPaidMinutes = Number(
    doc.totalRequestPaidMinutes ?? doc.totalMinutes ?? 0,
  )

  const rows = [
    ['OT REQUEST SUMMARY'],
    [],
    ['Request No', s(doc.requestNo)],
    ['Requester Employee ID', s(doc.requesterEmployeeId)],
    ['Requester Code', s(doc.requesterEmployeeCode)],
    ['Requester Name', s(doc.requesterName)],
    ['OT Date', s(doc.otDate)],
    ['Day Type', s(doc.dayType)],
    ['Status', s(doc.status)],
    ['Current Step', Number(doc.currentApprovalStep || 1)],
    ['Reason', s(doc.reason)],
    [],
    ['Shift Code', s(doc.shiftCode)],
    ['Shift Name', s(doc.shiftName)],
    ['Shift Type', s(doc.shiftType)],
    ['Shift Start Time', s(doc.shiftStartTime)],
    ['Shift End Time', s(doc.shiftEndTime)],
    ['Shift Cross Midnight', doc.shiftCrossMidnight === true ? 'YES' : 'NO'],
    [],
    ['OT Option', s(doc.shiftOtOptionLabel)],
    ['Requested Minutes', Number(doc.requestedMinutes || 0)],
    ['Request Start Time', s(doc.requestStartTime || doc.startTime)],
    ['Request End Time', s(doc.requestEndTime || doc.endTime)],
    ['Break Minutes', Number(doc.breakMinutes || 0)],
    ['Paid Minutes', totalRequestPaidMinutes],
    ['Paid Hours', Number((totalRequestPaidMinutes / 60).toFixed(2))],
    [],
    ['Policy Code', s(doc.otCalculationPolicySnapshot?.code)],
    ['Policy Name', s(doc.otCalculationPolicySnapshot?.name)],
    [
      'Policy Min Eligible Minutes',
      Number(doc.otCalculationPolicySnapshot?.minEligibleMinutes || 0),
    ],
    [
      'Policy Round Unit Minutes',
      Number(doc.otCalculationPolicySnapshot?.roundUnitMinutes || 0),
    ],
    ['Policy Round Method', s(doc.otCalculationPolicySnapshot?.roundMethod)],
    [
      'Policy Grace After Shift End',
      Number(doc.otCalculationPolicySnapshot?.graceAfterShiftEndMinutes || 0),
    ],
    [],
    ['Requested Staff', Number(doc.requestedEmployeeCount || requestedEmployees.length)],
    ['Approved Staff', Number(doc.approvedEmployeeCount || approvedEmployees.length)],
    ['Requester Confirmation', s(doc.requesterConfirmationStatus)],
    ['Last Adjustment By', s(doc.lastAdjustmentByEmployeeName)],
    ['Last Adjustment Remark', s(doc.lastAdjustmentRemark)],
    ['Created At', formatDateTime(doc.createdAt)],
    ['Updated At', formatDateTime(doc.updatedAt)],
    [],
  ]

  appendEmployeeSection(rows, 'REQUESTED EMPLOYEES', requestedEmployees)
  appendEmployeeSection(rows, 'CURRENT APPROVED EMPLOYEES', approvedEmployees)

  if (proposedApprovedEmployees.length) {
    appendEmployeeSection(rows, 'PROPOSED APPROVED EMPLOYEES', proposedApprovedEmployees)
  }

  rows.push(['APPROVAL WORKFLOW'])
  rows.push([
    'Step No',
    'Step Type',
    'Approver Employee ID',
    'Approver Code',
    'Approver Name',
    'Status',
    'Acted At',
    'Remark',
  ])

  for (const step of approvalSteps) {
    rows.push([
      Number(step.stepNo || 0),
      upper(step.stepType || 'APPROVER'),
      s(step.approverEmployeeId),
      s(step.approverCode),
      s(step.approverName),
      upper(step.status),
      formatDateTime(step.actedAt),
      s(step.remark),
    ])
  }

  return rows
}

function applyRequestSheetLayout(worksheet) {
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 26 },
    { wch: 18 },
    { wch: 26 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
  ]
}

async function create(payload, authUser) {
  const requesterEmployeeId = s(authUser?.employeeId)

  if (!requesterEmployeeId || !isObjectId(requesterEmployeeId)) {
    throw appError({
      statusCode: 400,
      code: 'ACCOUNT_EMPLOYEE_LINK_REQUIRED',
      messageKey: 'auth.error.employeeLinkRequired',
      message: 'Your account is not linked to an employee profile',
    })
  }

  const requesterSnapshot = await resolveEmployeeSnapshot(requesterEmployeeId)
  const uniqueEmployeeIds = normalizeIdArray(payload.employeeIds)

  if (!uniqueEmployeeIds.length) {
    throw appError({
      statusCode: 400,
      code: 'OT_EMPLOYEE_REQUIRED',
      messageKey: 'ot.request.validation.employeeRequired',
      message: 'Please select at least 1 employee',
      field: 'employeeIds',
    })
  }

  await assertSelectedEmployeesInsideRequesterScope(authUser, uniqueEmployeeIds)

  await ensureEmployeesHaveProductionLine(uniqueEmployeeIds)

  await ensureNoDuplicateOTEmployeesForDate({
    otDate: payload.otDate,
    employeeIds: uniqueEmployeeIds,
  })

  await ensureEmployeesHaveTodayClockIn({
    otDate: payload.otDate,
    employeeIds: uniqueEmployeeIds,
  })

  const employeeContexts = await resolveEmployeesSnapshotsWithContext(uniqueEmployeeIds)

  const dayTypeInfo = await otTimingService.resolveOTDayType(payload.otDate)

  const timingContext = await otTimingService.buildOTTimingContext(
    payload,
    employeeContexts,
    {
      dayTypeInfo,
    },
  )

  const dayType = upper(timingContext.dayType || dayTypeInfo.dayType)

  const requestedEmployees = otTimingService.buildTimedEmployeeSnapshots(
    employeeContexts,
    timingContext,
    payload,
  )

  const approvalFlow = await resolveApprovalFlow(requesterEmployeeId)

  const doc = await OTRequest.create({
    requestNo: await generateRequestNo(),

    requesterEmployeeId: requesterSnapshot.employee._id,
    requesterEmployeeCode: employeeCode(requesterSnapshot.employee),
    requesterName: employeeName(requesterSnapshot.employee),

    requestedEmployees,
    requestedEmployeeCount: requestedEmployees.length,

    approvedEmployees: requestedEmployees,
    approvedEmployeeCount: requestedEmployees.length,

    proposedApprovedEmployees: [],
    proposedApprovedEmployeeCount: 0,

    otDate: s(payload.otDate),
    dayType,
    dayTypeKey: dayTypeInfo.dayTypeKey,
    dayTypeSeverity: dayTypeInfo.dayTypeSeverity,

    otTimingSource: timingContext.otTimingSource,

    startTime: timingContext.startTime,
    endTime: timingContext.endTime,
    requestStartTime: timingContext.requestStartTime,
    requestEndTime: timingContext.requestEndTime,

    requestedMinutes: timingContext.requestedMinutes,
    breakMinutes: timingContext.breakMinutes,
    totalRequestPaidMinutes: timingContext.totalRequestPaidMinutes,
    totalMinutes: timingContext.totalRequestPaidMinutes,
    totalHours: timingContext.totalHours,

    shiftId: timingContext.shiftId,
    shiftCode: timingContext.shiftCode,
    shiftName: timingContext.shiftName,
    shiftType: timingContext.shiftType,
    shiftStartTime: timingContext.shiftStartTime,
    shiftEndTime: timingContext.shiftEndTime,
    shiftCrossMidnight: timingContext.shiftCrossMidnight,

    shiftOtOptionId: timingContext.shiftOtOptionId,
    shiftOtOptionLabel: timingContext.shiftOtOptionLabel,
    shiftOtOptionTimingMode: timingContext.shiftOtOptionTimingMode,
    shiftOtOptionStartAfterShiftEndMinutes:
      timingContext.shiftOtOptionStartAfterShiftEndMinutes,
    shiftOtOptionFixedStartTime: timingContext.shiftOtOptionFixedStartTime,
    shiftOtOptionFixedEndTime: timingContext.shiftOtOptionFixedEndTime,

    otCalculationPolicyId: timingContext.otCalculationPolicyId,
    otCalculationPolicySnapshot: timingContext.otCalculationPolicySnapshot,

    reason: s(payload.reason),

    approvalSteps: approvalFlow.approvalSteps,
    currentApprovalStep: approvalFlow.currentApprovalStep,
    currentApproverEmployeeId: approvalFlow.currentApproverEmployeeId,
    finalApproverEmployeeId: approvalFlow.finalApproverEmployeeId,

    requesterConfirmationStatus: 'NOT_REQUIRED',
    requesterConfirmedAt: null,
    requesterConfirmationRemark: '',

    status: 'PENDING',
    createdBy: actorAccountId(authUser),
    updatedBy: actorAccountId(authUser),
  })

  return getById(doc._id, authUser)
}

async function update(requestId, payload, authUser) {
  if (!isObjectId(requestId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_OT_REQUEST_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid OT request id',
      field: 'id',
    })
  }

  const doc = await OTRequest.findById(requestId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'OT_REQUEST_NOT_FOUND',
      messageKey: 'ot.request.error.notFound',
      message: 'OT request not found',
    })
  }

  assertCanEditOTRequest(doc, authUser)

  const requesterEmployeeId = s(doc.requesterEmployeeId || authUser.employeeId)
  const requesterSnapshot = await resolveEmployeeSnapshot(requesterEmployeeId)
  const uniqueEmployeeIds = normalizeIdArray(payload.employeeIds)

  if (!uniqueEmployeeIds.length) {
    throw appError({
      statusCode: 400,
      code: 'OT_EMPLOYEE_REQUIRED',
      messageKey: 'ot.request.validation.employeeRequired',
      message: 'Please select at least 1 employee',
      field: 'employeeIds',
    })
  }

  await assertSelectedEmployeesInsideRequesterScope(authUser, uniqueEmployeeIds)

  await ensureEmployeesHaveProductionLine(uniqueEmployeeIds)

  await ensureNoDuplicateOTEmployeesForDate({
    otDate: payload.otDate,
    employeeIds: uniqueEmployeeIds,
    excludeRequestId: requestId,
  })

  await ensureEmployeesHaveTodayClockIn({
    otDate: payload.otDate,
    employeeIds: uniqueEmployeeIds,
  })

  const employeeContexts = await resolveEmployeesSnapshotsWithContext(uniqueEmployeeIds)

  const dayTypeInfo = await otTimingService.resolveOTDayType(payload.otDate)

  const timingContext = await otTimingService.buildOTTimingContext(
    payload,
    employeeContexts,
    {
      dayTypeInfo,
    },
  )

  const dayType = upper(timingContext.dayType || dayTypeInfo.dayType)

  const requestedEmployees = otTimingService.buildTimedEmployeeSnapshots(
    employeeContexts,
    timingContext,
    payload,
  )

  const approvalFlow = await resolveApprovalFlow(requesterEmployeeId)

  doc.requesterEmployeeId = requesterSnapshot.employee._id
  doc.requesterEmployeeCode = employeeCode(requesterSnapshot.employee)
  doc.requesterName = employeeName(requesterSnapshot.employee)

  doc.requestedEmployees = requestedEmployees
  doc.requestedEmployeeCount = requestedEmployees.length

  doc.approvedEmployees = requestedEmployees
  doc.approvedEmployeeCount = requestedEmployees.length

  doc.proposedApprovedEmployees = []
  doc.proposedApprovedEmployeeCount = 0

  doc.otDate = s(payload.otDate)
  doc.dayType = dayType
  doc.dayTypeKey = dayTypeInfo.dayTypeKey
  doc.dayTypeSeverity = dayTypeInfo.dayTypeSeverity

  doc.otTimingSource = timingContext.otTimingSource

  doc.startTime = timingContext.startTime
  doc.endTime = timingContext.endTime
  doc.requestStartTime = timingContext.requestStartTime
  doc.requestEndTime = timingContext.requestEndTime

  doc.requestedMinutes = timingContext.requestedMinutes
  doc.breakMinutes = timingContext.breakMinutes
  doc.totalRequestPaidMinutes = timingContext.totalRequestPaidMinutes
  doc.totalMinutes = timingContext.totalRequestPaidMinutes
  doc.totalHours = timingContext.totalHours

  doc.shiftId = timingContext.shiftId
  doc.shiftCode = timingContext.shiftCode
  doc.shiftName = timingContext.shiftName
  doc.shiftType = timingContext.shiftType
  doc.shiftStartTime = timingContext.shiftStartTime
  doc.shiftEndTime = timingContext.shiftEndTime
  doc.shiftCrossMidnight = timingContext.shiftCrossMidnight

  doc.shiftOtOptionId = timingContext.shiftOtOptionId
  doc.shiftOtOptionLabel = timingContext.shiftOtOptionLabel
  doc.shiftOtOptionTimingMode = timingContext.shiftOtOptionTimingMode
  doc.shiftOtOptionStartAfterShiftEndMinutes =
    timingContext.shiftOtOptionStartAfterShiftEndMinutes
  doc.shiftOtOptionFixedStartTime = timingContext.shiftOtOptionFixedStartTime
  doc.shiftOtOptionFixedEndTime = timingContext.shiftOtOptionFixedEndTime

  doc.otCalculationPolicyId = timingContext.otCalculationPolicyId
  doc.otCalculationPolicySnapshot = timingContext.otCalculationPolicySnapshot

  doc.reason = s(payload.reason)

  doc.approvalSteps = approvalFlow.approvalSteps
  doc.currentApprovalStep = approvalFlow.currentApprovalStep
  doc.currentApproverEmployeeId = approvalFlow.currentApproverEmployeeId
  doc.finalApproverEmployeeId = approvalFlow.finalApproverEmployeeId

  doc.requesterConfirmationStatus = 'NOT_REQUIRED'
  doc.requesterConfirmedAt = null
  doc.requesterConfirmationRemark = ''

  doc.lastAdjustmentByEmployeeId = null
  doc.lastAdjustmentByEmployeeCode = ''
  doc.lastAdjustmentByEmployeeName = ''
  doc.lastAdjustmentByAccountId = null
  doc.lastAdjustmentAt = null
  doc.lastAdjustmentRemark = ''
  doc.lastAdjustmentStepNo = null

  doc.status = 'PENDING'
  doc.updatedBy = actorAccountId(authUser)

  await doc.save()

  return getById(doc._id, authUser)
}

async function cancel(requestId, authUser) {
  if (!isObjectId(requestId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_OT_REQUEST_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid OT request id',
      field: 'id',
    })
  }

  const doc = await OTRequest.findById(requestId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'OT_REQUEST_NOT_FOUND',
      messageKey: 'ot.request.error.notFound',
      message: 'OT request not found',
    })
  }

  assertCanCancelOTRequest(doc, authUser)

  doc.status = 'CANCELLED'
  doc.currentApproverEmployeeId = null
  doc.updatedBy = actorAccountId(authUser)

  if (Array.isArray(doc.approvalSteps)) {
    doc.approvalSteps = doc.approvalSteps.map((step) => {
      const stepStatus = upper(step.status)

      if (stepStatus === 'PENDING') {
        step.status = 'WAITING'
      }

      return step
    })
  }

  await doc.save()

  return getById(doc._id, authUser)
}

async function list(query = {}, authUser = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildListFilter(query)
  const sort = buildSort(query)

  const [items, total] = await Promise.all([
    OTRequest.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    OTRequest.countDocuments(filter),
  ])

  return {
    items: items.map((doc) => mapListItem(doc, authUser)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function listApprovalInbox(query = {}, authUser = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildApprovalInboxFilter(query, authUser)
  const sort = buildSort(query)

  const [items, total] = await Promise.all([
    OTRequest.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    OTRequest.countDocuments(filter),
  ])

  return {
    items: items.map((doc) => mapListItem(doc, authUser)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function getById(requestId, authUser = {}) {
  if (!isObjectId(requestId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_OT_REQUEST_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid OT request id',
      field: 'id',
    })
  }

  const doc = await OTRequest.findById(requestId).lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'OT_REQUEST_NOT_FOUND',
      messageKey: 'ot.request.error.notFound',
      message: 'OT request not found',
    })
  }

  return mapDetail(doc, authUser)
}

async function exportRequestsExcel(query = {}) {
  const filter = buildListFilter(query)
  const sort = buildSort(query)

  const items = await OTRequest.find(filter).sort(sort).lean()

  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set()

  if (!items.length) {
    const emptySheet = XLSX.utils.aoa_to_sheet([['No data found']])
    XLSX.utils.book_append_sheet(workbook, emptySheet, 'OT Requests')
  } else {
    for (const doc of items) {
      const rows = buildRequestSheetRows(doc)
      const worksheet = XLSX.utils.aoa_to_sheet(rows)

      applyRequestSheetLayout(worksheet)

      const baseSheetName = s(doc.requestNo) || `Request-${String(doc._id).slice(-6)}`
      const sheetName = makeSafeSheetName(baseSheetName, usedSheetNames)

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    }
  }

  return {
    filename: `ot-requests-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }),
  }
}

async function exportApprovalInboxExcel(query = {}, authUser = {}) {
  const filter = buildApprovalInboxFilter(query, authUser)
  const sort = buildSort(query)

  const items = await OTRequest.find(filter).sort(sort).lean()

  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set()

  if (!items.length) {
    const emptySheet = XLSX.utils.aoa_to_sheet([['No data found']])
    XLSX.utils.book_append_sheet(workbook, emptySheet, 'Approval Inbox')
  } else {
    for (const doc of items) {
      const rows = buildRequestSheetRows(doc)
      const worksheet = XLSX.utils.aoa_to_sheet(rows)

      applyRequestSheetLayout(worksheet)

      const baseSheetName = s(doc.requestNo) || `Request-${String(doc._id).slice(-6)}`
      const sheetName = makeSafeSheetName(baseSheetName, usedSheetNames)

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    }
  }

  return {
    filename: `ot-approval-inbox-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }),
  }
}

function findNextApproverStepAfter(steps = [], currentIndex = -1) {
  for (let i = currentIndex + 1; i < steps.length; i += 1) {
    const step = steps[i]

    if (upper(step.stepType || 'APPROVER') !== 'APPROVER') continue
    if (['APPROVED', 'REJECTED'].includes(upper(step.status))) continue

    return {
      step,
      index: i,
    }
  }

  return null
}

function moveToNextApproverOrApprove(doc, currentStepIndex) {
  const next = findNextApproverStepAfter(doc.approvalSteps, currentStepIndex)

  if (next?.step) {
    next.step.status = 'PENDING'
    doc.currentApprovalStep = Number(next.step.stepNo)
    doc.currentApproverEmployeeId = next.step.approverEmployeeId
    doc.status = 'PENDING'
    return
  }

  doc.currentApproverEmployeeId = null
  doc.status = 'APPROVED'
}

async function decide(requestId, payload = {}, authUser = {}) {
  if (!isObjectId(requestId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_OT_REQUEST_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid OT request id',
      field: 'id',
    })
  }

  const doc = await OTRequest.findById(requestId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'OT_REQUEST_NOT_FOUND',
      messageKey: 'ot.request.error.notFound',
      message: 'OT request not found',
    })
  }

  if (upper(doc.status) !== 'PENDING') {
    throw appError({
      statusCode: 400,
      code: 'OT_REQUEST_NOT_PENDING',
      messageKey: 'ot.request.error.onlyPendingCanDecide',
      message: 'Only pending OT requests can be decided',
    })
  }

  const currentStepNo = Number(doc.currentApprovalStep || 1)
  const stepIndex = doc.approvalSteps.findIndex(
    (step) => Number(step.stepNo) === currentStepNo,
  )

  if (stepIndex === -1) {
    throw appError({
      statusCode: 400,
      code: 'CURRENT_APPROVAL_STEP_NOT_FOUND',
      messageKey: 'ot.request.error.currentApprovalStepNotFound',
      message: 'Current approval step not found',
    })
  }

  const currentStep = doc.approvalSteps[stepIndex]

  if (upper(currentStep.stepType || 'APPROVER') !== 'APPROVER') {
    throw appError({
      statusCode: 400,
      code: 'CURRENT_STEP_NOT_APPROVER',
      messageKey: 'ot.request.error.currentStepNotApprover',
      message: 'Current workflow step is not an approver step',
    })
  }

  const actorEmployeeId = s(authUser.employeeId)
  const currentApproverEmployeeId = s(doc.currentApproverEmployeeId)

  const canActAsRoot = authUser.isRootAdmin === true
  const canActAsAssignedApprover =
    actorEmployeeId &&
    currentApproverEmployeeId &&
    actorEmployeeId === currentApproverEmployeeId

  if (!canActAsRoot && !canActAsAssignedApprover) {
    throw appError({
      statusCode: 403,
      code: 'OT_REQUEST_NOT_WAITING_FOR_YOU',
      messageKey: 'ot.request.error.notWaitingForYourApproval',
      message: 'This OT request is not waiting for your approval',
    })
  }

  const action = upper(payload.action)
  const remark = s(payload.remark)

  if (action === 'APPROVE') {
    const requestedEmployees = Array.isArray(doc.requestedEmployees)
      ? doc.requestedEmployees
      : []

    if (!requestedEmployees.length) {
      throw appError({
        statusCode: 400,
        code: 'OT_REQUEST_NO_EMPLOYEES',
        messageKey: 'ot.request.error.noEmployeesToApprove',
        message: 'This OT request has no employee to approve',
      })
    }

    currentStep.status = 'APPROVED'
    currentStep.actedAt = new Date()
    currentStep.actedBy = actorAccountId(authUser)
    currentStep.remark = remark

    doc.approvedEmployees = requestedEmployees
    doc.approvedEmployeeCount = requestedEmployees.length

    doc.proposedApprovedEmployees = []
    doc.proposedApprovedEmployeeCount = 0

    doc.requesterConfirmationStatus = 'NOT_REQUIRED'
    doc.requesterConfirmedAt = null
    doc.requesterConfirmationRemark = ''

    doc.lastAdjustmentByEmployeeId = null
    doc.lastAdjustmentByEmployeeCode = ''
    doc.lastAdjustmentByEmployeeName = ''
    doc.lastAdjustmentByAccountId = null
    doc.lastAdjustmentAt = null
    doc.lastAdjustmentRemark = ''
    doc.lastAdjustmentStepNo = null

    moveToNextApproverOrApprove(doc, stepIndex)
  } else if (action === 'REJECT') {
    if (!remark) {
      throw appError({
        statusCode: 400,
        code: 'REJECTION_REASON_REQUIRED',
        messageKey: 'ot.request.validation.rejectionReasonRequired',
        message: 'Please enter rejection reason',
        field: 'remark',
      })
    }

    currentStep.status = 'REJECTED'
    currentStep.actedAt = new Date()
    currentStep.actedBy = actorAccountId(authUser)
    currentStep.remark = remark

    doc.proposedApprovedEmployees = []
    doc.proposedApprovedEmployeeCount = 0

    doc.requesterConfirmationStatus = 'NOT_REQUIRED'
    doc.requesterConfirmedAt = null
    doc.requesterConfirmationRemark = ''

    doc.currentApproverEmployeeId = null
    doc.status = 'REJECTED'
  } else {
    throw appError({
      statusCode: 400,
      code: 'INVALID_APPROVAL_ACTION',
      messageKey: 'ot.request.validation.approvalActionInvalid',
      message: 'Invalid approval action',
      field: 'action',
    })
  }

  doc.updatedBy = actorAccountId(authUser)

  await doc.save()

  return getById(doc._id, authUser)
}

async function requesterConfirm(requestId, payload = {}, authUser = {}) {
  if (!isObjectId(requestId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_OT_REQUEST_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid OT request id',
      field: 'id',
    })
  }

  const doc = await OTRequest.findById(requestId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'OT_REQUEST_NOT_FOUND',
      messageKey: 'ot.request.error.notFound',
      message: 'OT request not found',
    })
  }

  assertCanRequesterConfirm(doc, authUser)

  const action = upper(payload.action)
  const remark = s(payload.remark)

  if (action === 'AGREE') {
    if (!Array.isArray(doc.proposedApprovedEmployees) || !doc.proposedApprovedEmployees.length) {
      throw appError({
        statusCode: 400,
        code: 'NO_ADJUSTED_EMPLOYEE_LIST',
        messageKey: 'ot.request.error.noAdjustedEmployeeList',
        message: 'There is no adjusted employee list to confirm',
      })
    }

    doc.approvedEmployees = doc.proposedApprovedEmployees
    doc.approvedEmployeeCount = doc.proposedApprovedEmployees.length

    doc.proposedApprovedEmployees = []
    doc.proposedApprovedEmployeeCount = 0

    doc.requesterConfirmationStatus = 'AGREED'
    doc.requesterConfirmedAt = new Date()
    doc.requesterConfirmationRemark = remark

    const currentStepNo = Number(doc.currentApprovalStep || 1)
    const stepIndex = doc.approvalSteps.findIndex(
      (step) => Number(step.stepNo) === currentStepNo,
    )

    if (stepIndex === -1) {
      throw appError({
        statusCode: 400,
        code: 'CURRENT_APPROVAL_STEP_NOT_FOUND',
        messageKey: 'ot.request.error.currentApprovalStepNotFound',
        message: 'Current approval step not found',
      })
    }

    moveToNextApproverOrApprove(doc, stepIndex)
  } else if (action === 'DISAGREE') {
    doc.requesterConfirmationStatus = 'DISAGREED'
    doc.requesterConfirmedAt = new Date()
    doc.requesterConfirmationRemark = remark

    doc.currentApproverEmployeeId = null
    doc.status = 'REQUESTER_DISAGREED'
  } else {
    throw appError({
      statusCode: 400,
      code: 'INVALID_REQUESTER_CONFIRMATION_ACTION',
      messageKey: 'ot.request.validation.requesterConfirmationActionInvalid',
      message: 'Invalid requester confirmation action',
      field: 'action',
    })
  }

  doc.updatedBy = actorAccountId(authUser)

  await doc.save()

  return getById(doc._id, authUser)
}

async function getAllowedApproverChain(employeeId) {
  const chain = await getUpwardApproverChain(employeeId)

  return chain.map((employee, index) => ({
    orderNo: index + 1,
    employeeId: String(employee._id),
    employeeCode: employeeCode(employee),
    displayName: employeeName(employee),
    departmentId: employee.departmentId || null,
    positionId: employee.positionId || null,
    otWorkflowRole: upper(employee.otWorkflowRole || 'NONE'),
    isWorkflowStep: ['APPROVER', 'ACKNOWLEDGE'].includes(
      upper(employee.otWorkflowRole || 'NONE'),
    ),
  }))
}

async function getShiftOTOptionsByShift(shiftId, query = {}) {
  return otTimingService.getShiftOTOptionsByShift(shiftId, query)
}

module.exports = {
  create,
  update,
  cancel,
  list,
  listApprovalInbox,
  exportRequestsExcel,
  exportApprovalInboxExcel,
  getById,
  decide,
  requesterConfirm,
  getAllowedApproverChain,
  getShiftOTOptionsByShift,
  listUnavailableEmployeesForDate,
}