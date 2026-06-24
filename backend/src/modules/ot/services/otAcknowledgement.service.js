// backend/src/modules/ot/services/otAcknowledgement.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')
const OTRequest = require('../models/OTRequest')
const { getTotalEmployeesForFilter } = require('./otRequestListSummary.service')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
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

function firstText(...values) {
  for (const value of values) {
    const text = s(value)
    if (text) return text
  }

  return ''
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

function acknowledgementStatusKey(status) {
  const value = upper(status)

  if (value === 'ACKNOWLEDGED') return 'ot.acknowledgement.status.acknowledged'
  if (value === 'WAITING') return 'ot.acknowledgement.status.waiting'
  if (value === 'PENDING') return 'ot.acknowledgement.status.pending'

  return 'ot.acknowledgement.status.fyi'
}

function acknowledgementSeverity(status) {
  const value = upper(status)

  if (value === 'ACKNOWLEDGED') return 'info'
  if (value === 'PENDING') return 'warning'
  if (value === 'WAITING') return 'secondary'

  return 'info'
}

function normalizePage(value) {
  const page = Number(value || 1)

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function normalizeLimit(value) {
  const limit = Number(value || 10)

  if (!Number.isFinite(limit)) return 10

  return Math.min(Math.max(Math.floor(limit), 1), 100)
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
      { reason: regex },

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


      { 'approvalSteps.approverCode': regex },
      { 'approvalSteps.approverName': regex },
    ],
  }
}

function pushMembershipFilter(andConditions, fieldName, value) {
  if (!value || !isObjectId(value)) return

  andConditions.push({
    $or: [
      { [`requestedEmployees.${fieldName}`]: value },
      { [`approvedEmployees.${fieldName}`]: value },
    ],
  })
}

function buildFilter(query = {}, authUser = {}) {
  const andConditions = []

  const acknowledgementMatch = {
    stepType: 'ACKNOWLEDGE',
  }

  if (!authUser?.isRootAdmin) {
    const employeeId = s(authUser?.employeeId)

    if (!employeeId || !isObjectId(employeeId)) {
      throw appError({
        statusCode: 400,
        code: 'ACCOUNT_EMPLOYEE_LINK_REQUIRED',
        messageKey: 'auth.error.employeeLinkRequired',
        message: 'Your account is not linked to an employee profile',
      })
    }

    acknowledgementMatch.approverEmployeeId = employeeId
  }

  andConditions.push({
    approvalSteps: {
      $elemMatch: acknowledgementMatch,
    },
  })

  if (s(query.status)) {
    andConditions.push({
      status: upper(query.status),
    })
  }

  if (s(query.dayType)) {
    andConditions.push({
      dayType: upper(query.dayType),
    })
  }

  pushMembershipFilter(andConditions, 'employeeId', s(query.employeeId))
  pushMembershipFilter(andConditions, 'departmentId', s(query.departmentId))
  pushMembershipFilter(andConditions, 'positionId', s(query.positionId))
  pushMembershipFilter(andConditions, 'lineId', s(query.lineId))

  if (s(query.otDateFrom) || s(query.otDateTo)) {
    const dateFilter = {}

    if (s(query.otDateFrom)) dateFilter.$gte = s(query.otDateFrom)
    if (s(query.otDateTo)) dateFilter.$lte = s(query.otDateTo)

    andConditions.push({
      otDate: dateFilter,
    })
  }

  const searchFilter = buildSearchFilter(query.search)

  if (searchFilter) {
    andConditions.push(searchFilter)
  }

  return andConditions.length ? { $and: andConditions } : {}
}

function buildSort(query = {}) {
  const direction = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1

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

function effectiveEmployeesForDoc(doc = {}) {
  if (Array.isArray(doc.approvedEmployees) && doc.approvedEmployees.length) {
    return doc.approvedEmployees
  }

  return Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees : []
}

function mapEmployeeOutput(item = {}) {
  const lineCode = s(item.lineCode)
  const lineName = s(item.lineName)

  const totalRequestPaidMinutes = Number(
    item.totalRequestPaidMinutes ?? item.totalMinutes ?? 0,
  )

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
    totalRequestPaidMinutes,
    totalMinutes: totalRequestPaidMinutes,
    totalHours: Number(item.totalHours || 0),
  }
}

function findAcknowledgementStep(doc = {}, authUser = {}) {
  const steps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []

  const acknowledgementSteps = steps.filter(
    (step) => upper(step?.stepType) === 'ACKNOWLEDGE',
  )

  if (!acknowledgementSteps.length) return null

  if (authUser?.isRootAdmin) {
    return acknowledgementSteps[0]
  }

  const employeeId = s(authUser?.employeeId)

  return (
    acknowledgementSteps.find(
      (step) => s(step?.approverEmployeeId) === employeeId,
    ) || null
  )
}

function mapAcknowledgementStep(step = null) {
  if (!step) return null

  const status = upper(step.status || 'ACKNOWLEDGED')

  return {
    stepNo: Number(step.stepNo || 0),
    stepType: upper(step.stepType || 'ACKNOWLEDGE'),

    approverEmployeeId: step.approverEmployeeId
      ? String(step.approverEmployeeId)
      : null,
    approverCode: s(step.approverCode),
    approverName: s(step.approverName),

    status,
    statusKey: acknowledgementStatusKey(status),
    severity: acknowledgementSeverity(status),

    actedAt: step.actedAt || null,
    actedBy: step.actedBy ? String(step.actedBy) : null,
    remark: s(step.remark),
  }
}

function buildAcknowledgementDisplay(step = null) {
  const status = upper(step?.status || 'ACKNOWLEDGED')

  return {
    status,
    statusKey: acknowledgementStatusKey(status),
    severity: acknowledgementSeverity(status),
  }
}

function buildApprovedByOutput(doc = {}) {
  if (upper(doc.status) !== 'APPROVED') {
    return {
      approvedByEmployeeId: null,
      approvedByCode: '',
      approvedByName: '',
    }
  }

  const finalApprovedStep = [...(Array.isArray(doc.approvalSteps) ? doc.approvalSteps : [])]
    .filter(
      (step) =>
        upper(step?.stepType) === 'APPROVER' &&
        upper(step?.status) === 'APPROVED',
    )
    .sort((a, b) => Number(a?.stepNo || 0) - Number(b?.stepNo || 0))
    .pop()

  return {
    approvedByEmployeeId: finalApprovedStep?.approverEmployeeId
      ? String(finalApprovedStep.approverEmployeeId)
      : null,
    approvedByCode: s(finalApprovedStep?.approverCode),
    approvedByName: s(finalApprovedStep?.approverName),
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

function mapListItem(doc = {}, authUser = {}) {
  const acknowledgementStep = findAcknowledgementStep(doc, authUser)
  const acknowledgementDisplay = buildAcknowledgementDisplay(acknowledgementStep)
  const approvedBy = buildApprovedByOutput(doc)
  const employees = effectiveEmployeesForDoc(doc)

  const totalRequestPaidMinutes = Number(
    doc.totalRequestPaidMinutes ?? doc.totalMinutes ?? 0,
  )

  return {
    id: String(doc._id),
    _id: String(doc._id),

    requestNo: s(doc.requestNo),

    requesterEmployeeId: doc.requesterEmployeeId
      ? String(doc.requesterEmployeeId)
      : null,
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

    employeeCount: employees.length,
    approvedEmployeeCount: employees.length,
    requestedEmployeeCount: Number(
      doc.requestedEmployeeCount ||
        (Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees.length : 0),
    ),
    proposedApprovedEmployeeCount: Number(doc.proposedApprovedEmployeeCount || 0),

    employees: employees.map(mapEmployeeOutput),

    acknowledgementStep: mapAcknowledgementStep(acknowledgementStep),

    acknowledgementStatus: acknowledgementDisplay.status,
    acknowledgementStatusKey: acknowledgementDisplay.statusKey,
    acknowledgementSeverity: acknowledgementDisplay.severity,

    // Matches the request and approval inbox response contract.
    approvedByEmployeeId: approvedBy.approvedByEmployeeId,
    approvedByCode: approvedBy.approvedByCode,
    approvedByName: approvedBy.approvedByName,

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function list(query = {}, authUser = {}) {
  const page = normalizePage(query.page)
  const limit = normalizeLimit(query.limit)
  const skip = (page - 1) * limit

  const filter = buildFilter(query, authUser)
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

module.exports = {
  list,
}