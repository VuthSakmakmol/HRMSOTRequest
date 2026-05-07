// backend/src/modules/ot/services/otAcknowledgement.service.js
const mongoose = require('mongoose')

const OTRequest = require('../models/OTRequest')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
      { requesterEmployeeNo: regex },
      { requesterName: regex },
      { shiftCode: regex },
      { shiftName: regex },
      { shiftOtOptionLabel: regex },
      { reason: regex },

      { 'requestedEmployees.employeeCode': regex },
      { 'requestedEmployees.employeeName': regex },
      { 'requestedEmployees.departmentName': regex },
      { 'requestedEmployees.positionName': regex },

      { 'approvedEmployees.employeeCode': regex },
      { 'approvedEmployees.employeeName': regex },
      { 'approvedEmployees.departmentName': regex },
      { 'approvedEmployees.positionName': regex },

      { 'approvalSteps.approverCode': regex },
      { 'approvalSteps.approverName': regex },
    ],
  }
}

function buildSort(query = {}) {
  const direction = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1

  const allowedSortMap = {
    createdAt: 'createdAt',
    otDate: 'otDate',
    requestNo: 'requestNo',
    requesterName: 'requesterName',
    status: 'status',
  }

  const sortField = allowedSortMap[query.sortBy] || 'createdAt'

  return {
    [sortField]: direction,
    createdAt: -1,
  }
}

function buildFilter(query = {}, authUser = {}) {
  const andConditions = []

  const acknowledgementMatch = {
    stepType: 'ACKNOWLEDGE',
  }

  if (!authUser?.isRootAdmin) {
    const employeeId = s(authUser?.employeeId)

    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      const err = new Error('Your account is not linked to an employee profile')
      err.status = 400
      throw err
    }

    acknowledgementMatch.approverEmployeeId = new mongoose.Types.ObjectId(employeeId)
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

  if (s(query.otDateFrom) || s(query.otDateTo)) {
    const dateFilter = {}

    if (s(query.otDateFrom)) {
      dateFilter.$gte = s(query.otDateFrom)
    }

    if (s(query.otDateTo)) {
      dateFilter.$lte = s(query.otDateTo)
    }

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

function mapEmployeeOutput(item = {}) {
  return {
    employeeId: item?.employeeId ? String(item.employeeId) : null,
    employeeCode: s(item.employeeCode),
    employeeName: s(item.employeeName),
    departmentId: item?.departmentId ? String(item.departmentId) : null,
    departmentCode: s(item.departmentCode),
    departmentName: s(item.departmentName),
    positionId: item?.positionId ? String(item.positionId) : null,
    positionCode: s(item.positionCode),
    positionName: s(item.positionName),
  }
}

function findAcknowledgementStep(doc = {}, authUser = {}) {
  const steps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []

  const acknowledgementSteps = steps.filter((step) => {
    return upper(step?.stepType) === 'ACKNOWLEDGE'
  })

  if (!acknowledgementSteps.length) return null

  if (authUser?.isRootAdmin) {
    return acknowledgementSteps[0]
  }

  const employeeId = s(authUser?.employeeId)

  return (
    acknowledgementSteps.find((step) => {
      return s(step?.approverEmployeeId) === employeeId
    }) || null
  )
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

function buildAcknowledgementDisplay(step = null) {
  if (!step) {
    return {
      label: 'FYI',
      severity: 'info',
    }
  }

  const status = upper(step.status || 'ACKNOWLEDGED')

  if (status === 'ACKNOWLEDGED') {
    return {
      label: 'Acknowledged / FYI',
      severity: 'info',
    }
  }

  return {
    label: status || 'FYI',
    severity: 'secondary',
  }
}

function mapListItem(doc, authUser) {
  const acknowledgementStep = findAcknowledgementStep(doc, authUser)
  const acknowledgementDisplay = buildAcknowledgementDisplay(acknowledgementStep)
  const employees = effectiveEmployeesForDoc(doc)

  return {
    id: String(doc._id),
    _id: String(doc._id),

    requestNo: s(doc.requestNo),
    requesterEmployeeId: doc.requesterEmployeeId ? String(doc.requesterEmployeeId) : null,
    requesterEmployeeNo: s(doc.requesterEmployeeNo),
    requesterName: s(doc.requesterName),

    otDate: s(doc.otDate),
    startTime: s(doc.startTime),
    endTime: s(doc.endTime),
    breakMinutes: Number(doc.breakMinutes || 0),
    totalMinutes: Number(doc.totalMinutes || 0),
    totalHours: Number(doc.totalHours || 0),

    shiftCode: s(doc.shiftCode),
    shiftName: s(doc.shiftName),
    shiftType: s(doc.shiftType),
    shiftOtOptionLabel: s(doc.shiftOtOptionLabel),

    requestedMinutes: Number(doc.requestedMinutes || 0),
    requestStartTime: s(doc.requestStartTime || doc.startTime),
    requestEndTime: s(doc.requestEndTime || doc.endTime),

    dayType: upper(doc.dayType),
    status: upper(doc.status),
    reason: s(doc.reason),

    employeeCount: employees.length,
    employees: employees.map(mapEmployeeOutput),

    acknowledgementStep: acknowledgementStep
      ? {
          stepNo: Number(acknowledgementStep.stepNo || 0),
          stepType: upper(acknowledgementStep.stepType),
          approverEmployeeId: acknowledgementStep.approverEmployeeId
            ? String(acknowledgementStep.approverEmployeeId)
            : null,
          approverCode: s(acknowledgementStep.approverCode),
          approverName: s(acknowledgementStep.approverName),
          status: upper(acknowledgementStep.status),
          actedAt: acknowledgementStep.actedAt || null,
          remark: s(acknowledgementStep.remark),
        }
      : null,

    acknowledgementLabel: acknowledgementDisplay.label,
    acknowledgementSeverity: acknowledgementDisplay.severity,

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
    },
  }
}

module.exports = {
  list,
}