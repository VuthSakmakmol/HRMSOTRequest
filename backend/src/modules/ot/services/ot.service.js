// backend/src/modules/ot/services/ot.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')

const OTRequest = require('../models/OTRequest')
const Notification = require('../../notification/models/Notification')

const Employee = require('../../org/models/Employee')
const Department = require('../../org/models/Department')
const Position = require('../../org/models/Position')
const ProductionLine = require('../../org/models/ProductionLine')
const Shift = require('../../shift/models/Shift')

const employeeScopeService = require('../../org/services/employeeScope.service')
const otTimingService = require('./otTiming.service')
const otApprovalCalendarRuleService = require('./otApprovalCalendarRule.service')
const { getTotalEmployeesForFilter } = require('./otRequestListSummary.service')

// One employee can only appear in one active/payable OT request per date.
// Final/closed requests such as CANCELLED must not block the employee from
// creating a new request for the same date.
const OT_DUPLICATE_BLOCKING_STATUSES = ['PENDING', 'APPROVED']

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

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }

  return 0
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
    APPROVED: 'ot.status.approved',
    REJECTED: 'ot.status.rejected',
    CANCELLED: 'ot.status.cancelled',
  }

  return map[value] || 'common.status.unknown'
}

function statusSeverity(status) {
  const value = upper(status)

  if (value === 'APPROVED') return 'success'
  if (value === 'REJECTED') return 'danger'
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

  if (employee && employee.isOTEligible === false) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_NOT_OT_ELIGIBLE',
      messageKey: 'ot.request.error.employeeNotEligible',
      message: 'This employee is not eligible for OT requests.',
      field: 'employeeId',
    })
  }

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
      requesterEmployeeId: doc?.requesterEmployeeId ? String(doc.requesterEmployeeId) : '',
      requesterCode: s(doc?.requesterEmployeeCode || doc?.requesterCode),
      requesterName: s(doc?.requesterName),
      requesterLabel: [s(doc?.requesterEmployeeCode || doc?.requesterCode), s(doc?.requesterName)]
        .filter(Boolean)
        .join(' - '),
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
      requesterEmployeeId: 1,
      requesterEmployeeCode: 1,
      requesterCode: 1,
      requesterName: 1,
      otDate: 1,
      status: 1,
      requestedEmployees: 1,
      approvedEmployees: 1,
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

// Attendance is final payment proof, not a request-creation gate.
// Requesters can create/edit OT before attendance is imported; payment verification
// will later set payable minutes to 0 when attendance is missing or mismatched.
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
      requesterEmployeeId: doc?.requesterEmployeeId ? String(doc.requesterEmployeeId) : '',
      requesterCode: s(doc?.requesterEmployeeCode || doc?.requesterCode),
      requesterName: s(doc?.requesterName),
      requesterLabel: [s(doc?.requesterEmployeeCode || doc?.requesterCode), s(doc?.requesterName)]
        .filter(Boolean)
        .join(' - '),
      otDate: s(doc?.otDate),
      status: upper(doc?.status),
      statusKey: statusKey(doc?.status),
      statusLabel: otUnavailableStatusLabel(doc?.status),
    })
  }
}

async function listUnavailableEmployeesForDate(query = {}) {
  const otDate = s(query.otDate)
  const excludeRequestId = s(query.excludeRequestId)

  const filter = {
    otDate,
    status: { $in: OT_DUPLICATE_BLOCKING_STATUSES },
  }

  if (excludeRequestId && isObjectId(excludeRequestId)) {
    filter._id = {
      $ne: new mongoose.Types.ObjectId(excludeRequestId),
    }
  }

  const docs = await OTRequest.find(filter)
    .select({
      _id: 1,
      requestNo: 1,
      requesterEmployeeId: 1,
      requesterEmployeeCode: 1,
      requesterCode: 1,
      requesterName: 1,
      otDate: 1,
      status: 1,
      requestedEmployees: 1,
      approvedEmployees: 1,
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

async function resolveApprovalFlow(requesterEmployeeId, dayType = 'WORKING_DAY') {
  const requesterId = s(requesterEmployeeId)
  const normalizedDayType = upper(dayType || 'WORKING_DAY')

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
  const explicitRoles = await otApprovalCalendarRuleService.getExplicitRolesByEmployeeIds(
    upwardChain.map((employee) => employee._id),
    normalizedDayType,
  )

  function legacyRoleForEmployee(employee = {}) {
    const value = upper(employee.otWorkflowRole || 'NONE')
    if (value === 'APPROVER') return 'APPROVER'
    if (value === 'ACKNOWLEDGE') return 'ACKNOWLEDGE'
    return 'SKIP'
  }

  // Calendar rules override an employee's existing OT workflow role only for
  // the selected day type. Missing rules still use the current flexible
  // organization workflow, so existing setup remains compatible.
  const workflowEmployees = upwardChain
    .map((employee) => {
      const explicitRole = explicitRoles.get(String(employee._id)) || 'USE_DEFAULT'
      const role = explicitRole === 'USE_DEFAULT'
        ? legacyRoleForEmployee(employee)
        : explicitRole

      return { employee, role: upper(role) }
    })
    .filter((item) => ['APPROVER', 'FINAL_APPROVER', 'ACKNOWLEDGE'].includes(item.role))

  const approverIndexes = workflowEmployees
    .map((item, index) => (['APPROVER', 'FINAL_APPROVER'].includes(item.role) ? index : -1))
    .filter((index) => index >= 0)

  if (!approverIndexes.length) {
    throw appError({
      statusCode: 400,
      code: 'OT_APPROVER_NOT_FOUND',
      messageKey: 'ot.request.error.approverNotFound',
      message: 'No OT approver found in organization chart',
    })
  }

  const configuredFinalIndexes = workflowEmployees
    .map((item, index) => (item.role === 'FINAL_APPROVER' ? index : -1))
    .filter((index) => index >= 0)

  if (configuredFinalIndexes.length > 1) {
    throw appError({
      statusCode: 400,
      code: 'OT_MULTIPLE_FINAL_APPROVERS',
      messageKey: 'ot.approvalCalendarRules.error.multipleFinalApprovers',
      message: 'Only one final approver may exist in the requester approval chain for this OT day type',
      params: { dayType: normalizedDayType },
    })
  }

  // If no day-type rule marks a final approver, preserve the legacy behavior:
  // the last ordinary approver in the upward chain remains final.
  const finalWorkflowIndex = configuredFinalIndexes.length
    ? configuredFinalIndexes[0]
    : approverIndexes[approverIndexes.length - 1]

  // A final approver must be the last approval action. Acknowledgement users
  // may remain after that step because they are notified only after approval.
  const laterApprover = workflowEmployees
    .slice(finalWorkflowIndex + 1)
    .find((item) => ['APPROVER', 'FINAL_APPROVER'].includes(item.role))

  if (laterApprover) {
    throw appError({
      statusCode: 400,
      code: 'OT_FINAL_APPROVER_NOT_LAST',
      messageKey: 'ot.approvalCalendarRules.error.finalApproverNotLast',
      message: 'The final approver must be the last approval step. Change later managers to Acknowledge or Skip for this day type.',
      params: {
        dayType: normalizedDayType,
        laterApproverEmployeeId: String(laterApprover.employee._id),
        laterApproverName: employeeName(laterApprover.employee),
      },
    })
  }

  let firstPendingAssigned = false

  const steps = workflowEmployees.map((item, index) => {
    const employee = item.employee
    const isApprover = ['APPROVER', 'FINAL_APPROVER'].includes(item.role)
    const isFinalApprover = index === finalWorkflowIndex

    let status = 'ACKNOWLEDGED'
    let actedAt = new Date()
    let remark = 'Auto acknowledged by workflow'

    if (isApprover) {
      status = firstPendingAssigned ? 'WAITING' : 'PENDING'
      actedAt = null
      remark = ''
      firstPendingAssigned = true
    }

    return {
      stepNo: index + 1,
      stepType: isApprover ? 'APPROVER' : 'ACKNOWLEDGE',
      workflowRole: isFinalApprover ? 'FINAL_APPROVER' : item.role,
      isFinalApprover,
      approverEmployeeId: employee._id,
      approverCode: employeeCode(employee),
      approverName: employeeName(employee),
      status,
      actedAt,
      actedBy: null,
      remark,
    }
  })

  const currentApproverStep = steps.find(
    (step) => step.stepType === 'APPROVER' && step.status === 'PENDING',
  )

  const finalApproverStep = steps.find((step) => step.isFinalApprover === true)

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
  const totalRequestPaidMinutes = firstPositiveNumber(
    item.totalRequestPaidMinutes,
    item.totalMinutes,
    item.requestedMinutes,
  )
  const storedTotalHours = Number(item.totalHours)
  const totalHours = Number.isFinite(storedTotalHours) && storedTotalHours > 0
    ? storedTotalHours
    : Number((totalRequestPaidMinutes / 60).toFixed(2))

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

    paidMinutes: totalRequestPaidMinutes,
    totalRequestPaidMinutes,
    totalMinutes: totalRequestPaidMinutes,
    totalHours,
    paidHours: totalHours,
  }
}

function mapApprovalStepOutput(step = {}) {
  return {
    stepNo: Number(step.stepNo || 0),
    stepType: upper(step.stepType || 'APPROVER'),
    workflowRole: upper(
      step.workflowRole || (step.isFinalApprover ? 'FINAL_APPROVER' : step.stepType || 'APPROVER'),
    ),
    isFinalApprover: step.isFinalApprover === true || upper(step.workflowRole) === 'FINAL_APPROVER',
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
  const totalRequestPaidMinutes = firstPositiveNumber(
    doc.totalRequestPaidMinutes,
    doc.totalMinutes,
    doc.requestedMinutes,
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
    paidMinutes: totalRequestPaidMinutes,
    totalRequestPaidMinutes,
    totalRequestPaidHours: Number((totalRequestPaidMinutes / 60).toFixed(2)),
    paidHours: Number((totalRequestPaidMinutes / 60).toFixed(2)),

    fixedStartTime: s(doc.shiftOtOptionFixedStartTime),
    fixedEndTime: s(doc.shiftOtOptionFixedEndTime),
    startAfterShiftEndMinutes: Number(doc.shiftOtOptionStartAfterShiftEndMinutes || 0),
  }
}

function effectiveEmployeesForDoc(doc = {}) {
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

function isRequesterOfOTRequest(doc = {}, authUser = {}) {
  const actorEmployeeId = s(authUser?.employeeId)
  const requesterEmployeeId = s(doc?.requesterEmployeeId)

  return Boolean(actorEmployeeId && requesterEmployeeId && actorEmployeeId === requesterEmployeeId)
}

function isWorkflowParticipantOfOTRequest(doc = {}, authUser = {}) {
  const actorEmployeeId = s(authUser?.employeeId)

  if (!actorEmployeeId) return false

  const steps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []

  return steps.some((step) => s(step?.approverEmployeeId) === actorEmployeeId)
}

function canViewOTRequest(doc = {}, authUser = {}) {
  if (authUser?.isRootAdmin === true) return true
  if (hasPermission(authUser, 'OT_REQUEST_VIEW_ALL')) return true

  return (
    isRequesterOfOTRequest(doc, authUser) ||
    isWorkflowParticipantOfOTRequest(doc, authUser)
  )
}

function canModifyOTRequestBeforeApproval(doc = {}, authUser = {}) {
  const status = upper(doc.status)

  if (status !== 'PENDING') return false
  if (hasApprovedStep(doc)) return false

  // Confidential rule: normal Request List is owner-only, so edit/cancel must also
  // stay owner-only. Approvers and acknowledge users can view from their own inboxes
  // but they must not edit/cancel the requester's own request.
  if (!authUser?.isRootAdmin && !isRequesterOfOTRequest(doc, authUser)) {
    return false
  }

  return hasPermission(authUser, 'OT_REQUEST_UPDATE')
}

function canEditOTRequest(doc = {}, authUser = {}) {
  return canModifyOTRequestBeforeApproval(doc, authUser)
}

function canCancelOTRequest(doc = {}, authUser = {}) {
  return canModifyOTRequestBeforeApproval(doc, authUser)
}

function canDeleteOTRequest(doc = {}, authUser = {}) {
  return authUser?.isRootAdmin === true || hasPermission(authUser, 'OT_REQUEST_DELETE')
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

function assertCanDeleteOTRequest(doc = {}, authUser = {}) {
  if (!canDeleteOTRequest(doc, authUser)) {
    throw appError({
      statusCode: 403,
      code: 'OT_REQUEST_DELETE_NOT_ALLOWED',
      messageKey: 'ot.request.error.deleteNotAllowed',
      message: 'You do not have permission to delete this OT request',
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

// This is intentionally final-approval only. A request can have several
// approver steps, but the table column must show the person who completed the
// request approval, not a pending approver or an earlier intermediate step.
function buildApprovedByOutput(doc = {}) {
  if (upper(doc.status) !== 'APPROVED') {
    return {
      approvedByEmployeeId: null,
      approvedByCode: '',
      approvedByName: '',
    }
  }

  const finalApprovedStep = findLastStepByStatus(
    (Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []).filter(
      (step) => upper(step?.stepType) === 'APPROVER',
    ),
    'APPROVED',
  )

  return {
    approvedByEmployeeId: finalApprovedStep?.approverEmployeeId
      ? String(finalApprovedStep.approverEmployeeId)
      : null,
    approvedByCode: s(finalApprovedStep?.approverCode),
    approvedByName: s(finalApprovedStep?.approverName),
  }
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
  const approvedIdSet = new Set(approvedEmployees.map((item) => s(item.employeeId)))

  return {
    requestedEmployeeCount: requestedEmployees.length,
    approvedEmployeeCount: approvedEmployees.length,
    removedFromOriginalCount: requestedEmployees.filter(
      (item) => !approvedIdSet.has(s(item.employeeId)),
    ).length,
  }
}

function mapListItem(doc = {}, authUser = {}) {
  const approvalSteps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  const effectiveEmployees = effectiveEmployeesForDoc(doc)
  const approvalContext = buildApprovalActionContext(doc, authUser)
  const approvalDisplay = buildApprovalDisplay(doc)
  const approvedBy = buildApprovedByOutput(doc)
  const totalRequestPaidMinutes = firstPositiveNumber(
    doc.totalRequestPaidMinutes,
    doc.totalMinutes,
    doc.requestedMinutes,
  )
  const storedTotalHours = Number(doc.totalHours)
  const totalHours = Number.isFinite(storedTotalHours) && storedTotalHours > 0
    ? storedTotalHours
    : Number((totalRequestPaidMinutes / 60).toFixed(2))

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
    paidMinutes: totalRequestPaidMinutes,
    totalRequestPaidMinutes,
    totalMinutes: totalRequestPaidMinutes,
    totalHours,
    paidHours: totalHours,

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

    // A separate stable field for all table pages. It is blank until the
    // whole request reaches APPROVED and then contains the final approver.
    approvedByEmployeeId: approvedBy.approvedByEmployeeId,
    approvedByCode: approvedBy.approvedByCode,
    approvedByName: approvedBy.approvedByName,

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
    canDelete: canDeleteOTRequest(doc, authUser),
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

  return {
    ...mapListItem(doc, authUser),

    requestedEmployees: requestedEmployees.map(mapEmployeeOutput),
    approvedEmployees: approvedEmployees.map(mapEmployeeOutput),
    comparisonSummary: buildComparisonSummary(doc),

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

function buildMyRequestListFilter(query = {}, authUser = {}) {
  const filter = buildListFilter(query)

  // Root Admin and users with OT_REQUEST_VIEW_ALL can see/export every employee's OT request.
  // Normal requesters stay owner-only.
  if (hasPermission(authUser, 'OT_REQUEST_VIEW_ALL')) {
    return filter
  }

  const requesterEmployeeId = s(authUser?.employeeId)

  filter.$and = filter.$and || []

  if (!requesterEmployeeId || !isObjectId(requesterEmployeeId)) {
    filter.$and.push({
      _id: { $exists: false },
    })

    return filter
  }

  filter.$and.push({
    requesterEmployeeId,
  })

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
    const paidMinutes = firstPositiveNumber(
      item.totalRequestPaidMinutes,
      item.totalMinutes,
      item.requestedMinutes,
    )

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
  const approvalSteps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  const totalRequestPaidMinutes = firstPositiveNumber(
    doc.totalRequestPaidMinutes,
    doc.totalMinutes,
    doc.requestedMinutes,
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
    ['Last Adjustment By', s(doc.lastAdjustmentByEmployeeName)],
    ['Last Adjustment Remark', s(doc.lastAdjustmentRemark)],
    ['Created At', formatDateTime(doc.createdAt)],
    ['Updated At', formatDateTime(doc.updatedAt)],
    [],
  ]

  appendEmployeeSection(rows, 'REQUESTED EMPLOYEES', requestedEmployees)
  appendEmployeeSection(rows, 'CURRENT APPROVED EMPLOYEES', approvedEmployees)


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


function formatOTExportDate(value) {
  if (!value) return 'No Date'

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  const text = s(value)
  if (!text) return 'No Date'

  // otDate is normally stored as YYYY-MM-DD. If it ever comes as an ISO
  // datetime, keep only the date so sheets are grouped correctly.
  const isoDateMatch = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoDateMatch) return isoDateMatch[0]

  return text
}

function makeOTDateSheetName(dateValue) {
  const dateText = formatOTExportDate(dateValue)
  return dateText === 'No Date' ? 'No Date Request' : `${dateText} Request`
}

function numberOrZero(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function formatExportHoursFromMinutes(minutes) {
  const hours = numberOrZero(minutes) / 60

  if (Number.isInteger(hours)) return hours

  return Number(hours.toFixed(2))
}

function exportRequestOtTime(doc = {}) {
  const minutes = firstPositiveNumber(
    doc.totalRequestPaidMinutes,
    doc.totalMinutes,
    doc.requestedMinutes,
  )

  if (minutes > 0) return `${formatExportHoursFromMinutes(minutes)}h`

  const start = s(doc.requestStartTime || doc.startTime)
  const end = s(doc.requestEndTime || doc.endTime)

  return [start, end].filter(Boolean).join(' - ')
}

function requestEmployeeRowsForExport(doc = {}) {
  const requestedEmployees = Array.isArray(doc.requestedEmployees)
    ? doc.requestedEmployees
    : []

  if (requestedEmployees.length) return requestedEmployees

  return [null]
}

function makeSimpleEmployeeExportRow(doc = {}, item = {}, rowNo = 1) {
  const paidMinutes = firstPositiveNumber(
    item?.totalRequestPaidMinutes,
    item?.totalMinutes,
    item?.requestedMinutes,
    doc.totalRequestPaidMinutes,
    doc.totalMinutes,
    doc.requestedMinutes,
  )

  const requestedMinutes = Number(
    item?.requestedMinutes ?? doc.requestedMinutes ?? 0,
  )

  const breakMinutes = Number(item?.breakMinutes ?? doc.breakMinutes ?? 0)

  return [
    rowNo,
    s(item?.employeeId),
    s(item?.employeeCode),
    s(item?.employeeName),
    s(item?.departmentName),
    s(item?.positionName),
    firstText(item?.lineLabel, item?.lineName, item?.lineCode),
    s(item?.startTime || doc.requestStartTime || doc.startTime),
    s(item?.endTime || doc.requestEndTime || doc.endTime),
    breakMinutes,
    requestedMinutes,
    paidMinutes,
    formatExportHoursFromMinutes(paidMinutes),
  ]
}

function makeAllRequestsExportRow(doc = {}, item = {}, rowNo = 1) {
  const employeeRow = makeSimpleEmployeeExportRow(doc, item, rowNo)

  return [
    rowNo,
    s(doc.requestNo),
    formatDateTime(doc.createdAt),
    s(doc.requesterEmployeeCode),
    s(doc.requesterName),
    exportRequestOtTime(doc),
    Number(doc.requestedEmployeeCount || requestEmployeeRowsForExport(doc).length || 0),
    formatOTExportDate(doc.otDate),
    upper(doc.status),
    upper(doc.dayType),
    firstText(doc.shiftName, doc.shiftCode, doc.shiftType),
    employeeRow[1],
    employeeRow[2],
    employeeRow[3],
    employeeRow[4],
    employeeRow[5],
    employeeRow[6],
    employeeRow[7],
    employeeRow[8],
    employeeRow[9],
    employeeRow[10],
    employeeRow[11],
    employeeRow[12],
    firstText(doc.currentApproverName, doc.currentApproverCode),
    s(doc.reason),
  ]
}

function buildCombinedDayEmployeeRows(dayItems = []) {
  const rows = [
    ['REQUESTED EMPLOYEES'],
    [
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
    ],
  ]

  let rowNo = 1

  for (const doc of Array.isArray(dayItems) ? dayItems : []) {
    const requestedEmployees = Array.isArray(doc?.requestedEmployees)
      ? doc.requestedEmployees
      : []

    for (const item of requestedEmployees) {
      rows.push(makeSimpleEmployeeExportRow(doc, item, rowNo))
      rowNo += 1
    }
  }

  if (rowNo === 1) {
    rows.push(['No employees found'])
  }

  return rows
}

function groupRequestsByOTDate(items = []) {
  const grouped = new Map()

  for (const doc of Array.isArray(items) ? items : []) {
    const key = formatOTExportDate(doc?.otDate)

    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(doc)
  }

  return grouped
}

function applyAllRequestsSheetLayout(worksheet, lastRow = 4) {
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 26 },
    { wch: 22 },
    { wch: 22 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 30 },
  ]

  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 24 } },
  ]

  worksheet['!autofilter'] = {
    ref: `A4:Y${Math.max(lastRow, 4)}`,
  }
}

function buildAllRequestsWorkbook(items = [], query = {}, sheetName = 'OT Requests') {
  const workbook = XLSX.utils.book_new()
  const list = Array.isArray(items) ? items : []
  const generatedAt = formatDateTime(new Date())
  const totalEmployeeRows = list.reduce(
    (total, doc) => total + requestEmployeeRowsForExport(doc).length,
    0,
  )

  const rows = [
    ['OT REQUEST LIST EXPORT'],
    [
      'Generated At',
      generatedAt,
      'Total Requests',
      Number(list.length || 0),
      'Total Employee Rows',
      totalEmployeeRows,
    ],
    [],
    [
      'No',
      'Request No',
      'Created At',
      'Requester ID',
      'Requester',
      'OT Time',
      'Request Staff',
      'OT Date',
      'Approval Status',
      'Day Type',
      'Shift',
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
      'Current Approver',
      'Reason',
    ],
  ]

  let rowNo = 1

  for (const doc of list) {
    const employeeRows = requestEmployeeRowsForExport(doc)

    for (const item of employeeRows) {
      rows.push(makeAllRequestsExportRow(doc, item, rowNo))
      rowNo += 1
    }
  }

  if (rowNo === 1) {
    rows.push(['No data found'])
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  applyAllRequestsSheetLayout(worksheet, rows.length)
  XLSX.utils.book_append_sheet(workbook, worksheet, makeSafeSheetName(sheetName))

  return workbook
}

function buildRequestsByDateWorkbook(items = [], query = {}, emptySheetName = 'OT Requests') {
  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set()

  if (!items.length) {
    const emptySheet = XLSX.utils.aoa_to_sheet([['No data found']])
    XLSX.utils.book_append_sheet(workbook, emptySheet, emptySheetName)
    return workbook
  }

  const grouped = groupRequestsByOTDate(items)
  const dateKeys = [...grouped.keys()]
  const dateDirection = query.sortOrder === 'asc' ? 1 : -1

  dateKeys.sort((left, right) => {
    if (left === 'No Date' && right !== 'No Date') return 1
    if (right === 'No Date' && left !== 'No Date') return -1
    return left.localeCompare(right) * dateDirection
  })

  for (const dateKey of dateKeys) {
    const dayItems = grouped.get(dateKey) || []
    const rows = buildCombinedDayEmployeeRows(dayItems)
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    applyRequestSheetLayout(worksheet)

    const sheetName = makeSafeSheetName(makeOTDateSheetName(dateKey), usedSheetNames)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  return workbook
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

  const approvalFlow = await resolveApprovalFlow(requesterEmployeeId, dayType)

  const doc = await OTRequest.create({
    requestNo: await generateRequestNo(),

    requesterEmployeeId: requesterSnapshot.employee._id,
    requesterEmployeeCode: employeeCode(requesterSnapshot.employee),
    requesterName: employeeName(requesterSnapshot.employee),

    requestedEmployees,
    requestedEmployeeCount: requestedEmployees.length,

    approvedEmployees: requestedEmployees,
    approvedEmployeeCount: requestedEmployees.length,

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

  const approvalFlow = await resolveApprovalFlow(requesterEmployeeId, dayType)

  doc.requesterEmployeeId = requesterSnapshot.employee._id
  doc.requesterEmployeeCode = employeeCode(requesterSnapshot.employee)
  doc.requesterName = employeeName(requesterSnapshot.employee)

  doc.requestedEmployees = requestedEmployees
  doc.requestedEmployeeCount = requestedEmployees.length

  doc.approvedEmployees = requestedEmployees
  doc.approvedEmployeeCount = requestedEmployees.length

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

async function deleteRequest(requestId, authUser) {
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

  assertCanDeleteOTRequest(doc, authUser)

  const itemBeforeDelete = mapDetail(doc, authUser)

  await OTRequest.deleteOne({ _id: doc._id })

  await Notification.deleteMany({
    entityType: 'OT_REQUEST',
    entityId: doc._id,
  })

  return itemBeforeDelete
}

async function list(query = {}, authUser = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildMyRequestListFilter(query, authUser)
  const sort = buildSort(query)

  const [items, total, totalEmployees] = await Promise.all([
    OTRequest.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    OTRequest.countDocuments(filter),
    getTotalEmployeesForFilter(filter),
  ])

  return {
    items: items.map((doc) => mapListItem(doc, authUser)),
    pagination: {
      page,
      limit,
      total,
      totalEmployees,
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

  const [items, total, totalEmployees] = await Promise.all([
    OTRequest.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    OTRequest.countDocuments(filter),
    getTotalEmployeesForFilter(filter),
  ])

  return {
    items: items.map((doc) => mapListItem(doc, authUser)),
    pagination: {
      page,
      limit,
      total,
      totalEmployees,
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

  if (!canViewOTRequest(doc, authUser)) {
    throw appError({
      statusCode: 403,
      code: 'OT_REQUEST_VIEW_NOT_ALLOWED',
      messageKey: 'ot.request.error.viewNotAllowed',
      message: 'You are not allowed to view this OT request',
    })
  }

  return mapDetail(doc, authUser)
}

async function exportRequestsExcel(query = {}, authUser = {}) {
  const filter = buildMyRequestListFilter(query, authUser)
  const sort = buildSort(query)

  const items = await OTRequest.find(filter).sort(sort).lean()
  const workbook = buildAllRequestsWorkbook(items, query, 'OT Requests')

  return {
    filename: `ot-requests-all-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
  const workbook = buildRequestsByDateWorkbook(items, query, 'Approval Inbox')

  return {
    filename: `ot-approval-inbox-by-date-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
  deleteRequest,
  list,
  listApprovalInbox,
  exportRequestsExcel,
  exportApprovalInboxExcel,
  getById,
  decide,
  getAllowedApproverChain,
  getShiftOTOptionsByShift,
  listUnavailableEmployeesForDate,
}