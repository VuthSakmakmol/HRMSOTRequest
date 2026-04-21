// backend/src/modules/ot/services/ot.service.js
const mongoose = require('mongoose')
const XLSX = require('xlsx')
const OTRequest = require('../models/OTRequest')
const Employee = require('../../org/models/Employee')
const Department = require('../../org/models/Department')
const Position = require('../../org/models/Position')
const { getDayType } = require('../utils/dayClassifier')
const Holiday = require('../../calendar/models/Holiday')

function s(value) {
  return String(value ?? '').trim()
}

function toMinutes(hhmm) {
  const raw = s(hhmm)
  const match = raw.match(/^(\d{2}):(\d{2})$/)

  if (!match) {
    const err = new Error(`Invalid time format: ${raw}`)
    err.status = 400
    throw err
  }

  const hh = Number(match[1])
  const mm = Number(match[2])
  return hh * 60 + mm
}

function calculateDuration({ startTime, endTime, breakMinutes = 0 }) {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  const breakMin = Number(breakMinutes || 0)

  if (end <= start) {
    const err = new Error('End time must be later than start time')
    err.status = 400
    throw err
  }

  const totalMinutes = end - start - breakMin

  if (totalMinutes <= 0) {
    const err = new Error('Total OT minutes must be greater than zero')
    err.status = 400
    throw err
  }

  return {
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
  }
}

// backend/src/modules/ot/services/ot.service.js
function parseYMDToUtcRange(ymd) {
  const raw = String(ymd || '').trim()
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

async function resolveHolidayDateStrings(dateStrings = []) {
  const uniqueDates = Array.from(
    new Set((Array.isArray(dateStrings) ? dateStrings : []).map((d) => s(d)).filter(Boolean))
  )

  if (!uniqueDates.length) return []

  const orConditions = uniqueDates.map((ymd) => {
    const { start, end } = parseYMDToUtcRange(ymd)
    return {
      date: { $gte: start, $lt: end },
    }
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

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeIdArray(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((id) => s(id)).filter(Boolean)))
}

function mapEmployeeOutput(item) {
  return {
    employeeId: item?.employeeId ? String(item.employeeId) : null,
    employeeCode: s(item?.employeeCode),
    employeeName: s(item?.employeeName),
    departmentId: item?.departmentId ? String(item.departmentId) : null,
    departmentCode: s(item?.departmentCode),
    departmentName: s(item?.departmentName),
    positionId: item?.positionId ? String(item.positionId) : null,
    positionCode: s(item?.positionCode),
    positionName: s(item?.positionName),
  }
}

function getCollectionIds(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => s(item?.employeeId)).filter(Boolean)
}

function filterEmployeeSnapshotsByIds(sourceItems = [], allowedIds = []) {
  const allowedIdSet = new Set(normalizeIdArray(allowedIds))
  return (Array.isArray(sourceItems) ? sourceItems : []).filter((item) =>
    allowedIdSet.has(s(item?.employeeId))
  )
}

function areSameEmployeeSelections(sourceItems = [], selectedIds = []) {
  const sourceIds = getCollectionIds(sourceItems)
  const nextIds = getCollectionIds(filterEmployeeSnapshotsByIds(sourceItems, selectedIds))

  if (sourceIds.length !== nextIds.length) return false
  return sourceIds.every((id, index) => id === nextIds[index])
}

function countRemoved(baseItems = [], compareItems = []) {
  const compareIdSet = new Set(getCollectionIds(compareItems))
  return getCollectionIds(baseItems).filter((id) => !compareIdSet.has(id)).length
}

function effectiveEmployeesForDoc(doc) {
  if (
    s(doc?.status).toUpperCase() === 'PENDING_REQUESTER_CONFIRMATION' &&
    Array.isArray(doc?.proposedApprovedEmployees) &&
    doc.proposedApprovedEmployees.length
  ) {
    return doc.proposedApprovedEmployees
  }

  if (Array.isArray(doc?.approvedEmployees) && doc.approvedEmployees.length) {
    return doc.approvedEmployees
  }

  return Array.isArray(doc?.requestedEmployees) ? doc.requestedEmployees : []
}

function effectiveEmployeeCountForDoc(doc) {
  return effectiveEmployeesForDoc(doc).length
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
      { 'requestedEmployees.employeeCode': regex },
      { 'requestedEmployees.employeeName': regex },
      { 'requestedEmployees.departmentCode': regex },
      { 'requestedEmployees.departmentName': regex },
      { 'requestedEmployees.positionCode': regex },
      { 'requestedEmployees.positionName': regex },
      { 'approvedEmployees.employeeCode': regex },
      { 'approvedEmployees.employeeName': regex },
      { 'approvedEmployees.departmentCode': regex },
      { 'approvedEmployees.departmentName': regex },
      { 'approvedEmployees.positionCode': regex },
      { 'approvedEmployees.positionName': regex },
      { 'proposedApprovedEmployees.employeeCode': regex },
      { 'proposedApprovedEmployees.employeeName': regex },
      { reason: regex },
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

function buildListFilter(query) {
  const filter = {}

  if (s(query.status)) filter.status = s(query.status).toUpperCase()
  if (s(query.dayType)) filter.dayType = s(query.dayType).toUpperCase()

  if (s(query.employeeId) && mongoose.isValidObjectId(query.employeeId)) {
    pushMembershipFilter(filter, 'employeeId', query.employeeId)
  }

  if (s(query.departmentId) && mongoose.isValidObjectId(query.departmentId)) {
    pushMembershipFilter(filter, 'departmentId', query.departmentId)
  }

  if (s(query.positionId) && mongoose.isValidObjectId(query.positionId)) {
    pushMembershipFilter(filter, 'positionId', query.positionId)
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

function buildApprovalInboxFilter(query, authUser) {
  const filter = {}

  const normalizedStatus = s(query.status).toUpperCase()
  if (normalizedStatus) {
    filter.status = normalizedStatus
  }

  if (!authUser?.isRootAdmin) {
    const approverEmployeeId = s(authUser?.employeeId)

    if (!approverEmployeeId || !mongoose.isValidObjectId(approverEmployeeId)) {
      const err = new Error('Your account is not linked to an employee profile')
      err.status = 400
      throw err
    }

    if (normalizedStatus === 'PENDING') {
      filter.currentApproverEmployeeId = approverEmployeeId
      filter.status = 'PENDING'
    } else {
      filter.$or = [
        { currentApproverEmployeeId: approverEmployeeId },
        { 'approvalSteps.approverEmployeeId': approverEmployeeId },
      ]
    }
  }

  if (s(query.dayType)) {
    filter.dayType = s(query.dayType).toUpperCase()
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

function buildSort(query) {
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
  return { [sortField]: direction, createdAt: -1 }
}

function formatDateTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('en-CA')
  } catch {
    return String(value)
  }
}

function makeSafeSheetName(input, usedNames = new Set()) {
  const raw = s(input) || 'Sheet'
  let name = raw.replace(/[\\/*?:[\]]/g, ' ').trim()
  if (!name) name = 'Sheet'

  if (name.length > 31) {
    name = name.slice(0, 31).trim()
  }

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
    'Employee Code',
    'Employee Name',
    'Department Code',
    'Department Name',
    'Position Code',
    'Position Name',
  ])

  for (const [index, item] of employees.entries()) {
    rows.push([
      index + 1,
      s(item.employeeCode),
      s(item.employeeName),
      s(item.departmentCode),
      s(item.departmentName),
      s(item.positionCode),
      s(item.positionName),
    ])
  }

  rows.push([])
}

function buildRequestSheetRows(doc) {
  const requestedEmployees = Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees : []
  const approvedEmployees = Array.isArray(doc.approvedEmployees) ? doc.approvedEmployees : []
  const proposedApprovedEmployees = Array.isArray(doc.proposedApprovedEmployees)
    ? doc.proposedApprovedEmployees
    : []
  const approvalSteps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []

  const rows = [
    ['OT REQUEST SUMMARY'],
    [],
    ['Request No', s(doc.requestNo)],
    ['Request Owner', s(doc.requesterName)],
    ['Requester Employee No', s(doc.requesterEmployeeNo)],
    ['OT Date', s(doc.otDate)],
    ['Start Time', s(doc.startTime)],
    ['End Time', s(doc.endTime)],
    ['Break Minutes', Number(doc.breakMinutes || 0)],
    ['Total Hours', Number(doc.totalHours || 0)],
    ['Day Type', s(doc.dayType)],
    ['Status', s(doc.status)],
    ['Current Step', Number(doc.currentApprovalStep || 1)],
    ['Reason', s(doc.reason)],
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

  rows.push(['APPROVAL STEPS'])
  rows.push(['Step No', 'Approver Code', 'Approver Name', 'Status', 'Acted At', 'Remark'])

  for (const step of approvalSteps) {
    rows.push([
      Number(step.stepNo || 0),
      s(step.approverCode),
      s(step.approverName),
      s(step.status),
      formatDateTime(step.actedAt),
      s(step.remark),
    ])
  }

  return rows
}

function applyRequestSheetLayout(worksheet) {
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
  ]
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

async function resolveEmployeeSnapshot(employeeId) {
  if (!mongoose.isValidObjectId(employeeId)) {
    const err = new Error('Invalid employee id')
    err.status = 400
    throw err
  }

  const employee = await Employee.findById(employeeId).lean()
  if (!employee) {
    const err = new Error('Employee not found')
    err.status = 404
    throw err
  }

  if (!employee.isActive) {
    const err = new Error('Employee is inactive')
    err.status = 400
    throw err
  }

  const [department, position] = await Promise.all([
    employee.departmentId ? Department.findById(employee.departmentId).lean() : null,
    employee.positionId ? Position.findById(employee.positionId).lean() : null,
  ])

  return {
    employee,
    department,
    position,
  }
}

async function resolveEmployeesSnapshots(employeeIds = []) {
  const result = []

  for (const employeeId of employeeIds) {
    const { employee, department, position } = await resolveEmployeeSnapshot(employeeId)

    result.push({
      employeeId: employee._id,
      employeeCode: s(employee.employeeNo || employee.employeeCode || employee.code),
      employeeName: s(employee.displayName || employee.employeeName || employee.name),
      departmentId: department?._id || null,
      departmentCode: s(department?.code),
      departmentName: s(department?.name),
      positionId: position?._id || null,
      positionCode: s(position?.code),
      positionName: s(position?.name),
    })
  }

  return result
}

async function getUpwardApproverChain(employeeId, options = {}) {
  const maxDepth = Number(options.maxDepth || 20)
  const visited = new Set()
  const chain = []

  let current = await Employee.findById(employeeId).lean()

  if (!current) {
    const err = new Error('Employee not found')
    err.status = 404
    throw err
  }

  visited.add(String(current._id))

  let depth = 0
  let nextApproverId = current.reportsToEmployeeId

  while (nextApproverId) {
    const key = String(nextApproverId)

    if (visited.has(key)) {
      const err = new Error('Organization chart contains a cycle')
      err.status = 400
      throw err
    }

    visited.add(key)

    const approver = await Employee.findById(nextApproverId).lean()

    if (!approver) {
      const err = new Error('Organization chart is broken: approver not found')
      err.status = 400
      throw err
    }

    if (!approver.isActive) {
      const err = new Error(`Approver is inactive: ${s(approver.displayName) || key}`)
      err.status = 400
      throw err
    }

    chain.push(approver)
    nextApproverId = approver.reportsToEmployeeId

    depth += 1
    if (depth > maxDepth) {
      const err = new Error('Organization chart is too deep or cyclic')
      err.status = 400
      throw err
    }
  }

  return chain
}

async function resolveApprovalFlow(requesterEmployeeId, approverEmployeeIds = []) {
  const requesterId = s(requesterEmployeeId)
  const selectedIds = approverEmployeeIds.map((id) => s(id))

  if (!requesterId || !mongoose.isValidObjectId(requesterId)) {
    const err = new Error('Requester employee profile is required')
    err.status = 400
    throw err
  }

  if (!selectedIds.length) {
    const err = new Error('Please select at least 1 approver')
    err.status = 400
    throw err
  }

  if (selectedIds.length > 4) {
    const err = new Error('You can select up to 4 approvers only')
    err.status = 400
    throw err
  }

  if (selectedIds.some((id) => id === requesterId)) {
    const err = new Error('Requester cannot be an approver')
    err.status = 400
    throw err
  }

  const upwardChain = await getUpwardApproverChain(requesterEmployeeId)
  const orderIndexById = new Map(
    upwardChain.map((employee, index) => [String(employee._id), index])
  )

  let previousOrder = -1
  const steps = []

  for (let i = 0; i < selectedIds.length; i += 1) {
    const approverId = selectedIds[i]
    const order = orderIndexById.get(approverId)

    if (order === undefined) {
      const err = new Error(
        'Selected approver must be from the requester upward organization chain'
      )
      err.status = 400
      throw err
    }

    if (order <= previousOrder) {
      const err = new Error('Approvers must follow organization hierarchy order')
      err.status = 400
      throw err
    }

    previousOrder = order

    const approver = upwardChain[order]

    steps.push({
      stepNo: i + 1,
      approverEmployeeId: approver._id,
      approverCode: s(approver.employeeNo || approver.employeeCode || approver.code),
      approverName: s(approver.displayName || approver.employeeName || approver.name),
      status: i === 0 ? 'PENDING' : 'WAITING',
      actedAt: null,
      actedBy: null,
      remark: '',
    })
  }

  return {
    approvalSteps: steps,
    currentApprovalStep: 1,
    currentApproverEmployeeId: steps[0]?.approverEmployeeId || null,
    finalApproverEmployeeId: steps[steps.length - 1]?.approverEmployeeId || null,
  }
}

async function resolveActorIdentity(authUser, fallback = {}) {
  const actorEmployeeId = s(authUser?.employeeId)

  if (actorEmployeeId && mongoose.isValidObjectId(actorEmployeeId)) {
    try {
      const snapshot = await resolveEmployeeSnapshot(actorEmployeeId)
      return {
        employeeId: snapshot.employee._id,
        employeeNo: s(
          snapshot.employee.employeeNo ||
            snapshot.employee.employeeCode ||
            snapshot.employee.code
        ),
        employeeName: s(
          snapshot.employee.displayName ||
            snapshot.employee.employeeName ||
            snapshot.employee.name
        ),
      }
    } catch {
      // fallback below
    }
  }

  return {
    employeeId: fallback.employeeId || null,
    employeeNo: s(fallback.employeeNo || authUser?.loginId),
    employeeName: s(fallback.employeeName || authUser?.displayName || authUser?.loginId),
  }
}

function hasApprovedStep(doc) {
  const steps = Array.isArray(doc?.approvalSteps) ? doc.approvalSteps : []
  return steps.some((step) => s(step?.status).toUpperCase() === 'APPROVED')
}

function canEditOTRequest(doc, authUser) {
  const actorEmployeeId = s(authUser?.employeeId)
  const ownerEmployeeId = s(doc?.requesterEmployeeId)
  const status = s(doc?.status).toUpperCase()

  if (!actorEmployeeId || !ownerEmployeeId) return false
  if (actorEmployeeId !== ownerEmployeeId) return false
  if (status !== 'PENDING') return false
  if (hasApprovedStep(doc)) return false

  return true
}

function canRequesterConfirm(doc, authUser) {
  const actorEmployeeId = s(authUser?.employeeId)
  const ownerEmployeeId = s(doc?.requesterEmployeeId)
  const status = s(doc?.status).toUpperCase()
  const confirmation = s(doc?.requesterConfirmationStatus).toUpperCase()

  if (!actorEmployeeId || !ownerEmployeeId) return false
  if (actorEmployeeId !== ownerEmployeeId) return false
  if (status !== 'PENDING_REQUESTER_CONFIRMATION') return false
  if (confirmation !== 'PENDING') return false

  return true
}

function assertCanEditOTRequest(doc, authUser) {
  const actorEmployeeId = s(authUser?.employeeId)
  const ownerEmployeeId = s(doc?.requesterEmployeeId)

  if (!actorEmployeeId || !mongoose.isValidObjectId(actorEmployeeId)) {
    const err = new Error('Your account is not linked to an employee profile')
    err.status = 400
    throw err
  }

  if (!ownerEmployeeId || actorEmployeeId !== ownerEmployeeId) {
    const err = new Error('You can edit only your own OT request')
    err.status = 403
    throw err
  }

  if (s(doc?.status).toUpperCase() !== 'PENDING') {
    const err = new Error('Only pending OT requests can be edited')
    err.status = 400
    throw err
  }

  if (hasApprovedStep(doc)) {
    const err = new Error(
      'This OT request can no longer be edited because it already has an approved step'
    )
    err.status = 400
    throw err
  }
}

function assertCanRequesterConfirm(doc, authUser) {
  const actorEmployeeId = s(authUser?.employeeId)
  const ownerEmployeeId = s(doc?.requesterEmployeeId)

  if (!actorEmployeeId || !mongoose.isValidObjectId(actorEmployeeId)) {
    const err = new Error('Your account is not linked to an employee profile')
    err.status = 400
    throw err
  }

  if (!ownerEmployeeId || actorEmployeeId !== ownerEmployeeId) {
    const err = new Error('Only the request owner can confirm this OT request')
    err.status = 403
    throw err
  }

  if (s(doc?.status).toUpperCase() !== 'PENDING_REQUESTER_CONFIRMATION') {
    const err = new Error('This OT request is not waiting for requester confirmation')
    err.status = 400
    throw err
  }

  if (s(doc?.requesterConfirmationStatus).toUpperCase() !== 'PENDING') {
    const err = new Error('Requester confirmation is not available for this OT request')
    err.status = 400
    throw err
  }
}

function buildComparisonSummary(doc) {
  const requestedEmployees = Array.isArray(doc?.requestedEmployees) ? doc.requestedEmployees : []
  const approvedEmployees = Array.isArray(doc?.approvedEmployees) ? doc.approvedEmployees : []
  const proposedApprovedEmployees = Array.isArray(doc?.proposedApprovedEmployees)
    ? doc.proposedApprovedEmployees
    : []

  return {
    requestedEmployeeCount: requestedEmployees.length,
    approvedEmployeeCount: approvedEmployees.length,
    proposedApprovedEmployeeCount: proposedApprovedEmployees.length,
    removedFromOriginalCount: countRemoved(requestedEmployees, approvedEmployees),
    pendingRemovedCount: proposedApprovedEmployees.length
      ? countRemoved(approvedEmployees, proposedApprovedEmployees)
      : 0,
  }
}

function mapListItem(doc, authUser) {
  const approvalSteps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  const effectiveEmployees = effectiveEmployeesForDoc(doc)

  return {
    id: String(doc._id),
    requestNo: doc.requestNo,
    requesterEmployeeId: doc.requesterEmployeeId ? String(doc.requesterEmployeeId) : null,
    requesterEmployeeNo: s(doc.requesterEmployeeNo),
    requesterName: s(doc.requesterName),

    otDate: s(doc.otDate),
    startTime: s(doc.startTime),
    endTime: s(doc.endTime),
    breakMinutes: Number(doc.breakMinutes || 0),
    totalMinutes: Number(doc.totalMinutes || 0),
    totalHours: Number(doc.totalHours || 0),
    dayType: s(doc.dayType),
    reason: s(doc.reason),

    employeeCount: effectiveEmployeeCountForDoc(doc),
    requestedEmployeeCount: Number(
      doc.requestedEmployeeCount || (Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees.length : 0)
    ),
    approvedEmployeeCount: Number(
      doc.approvedEmployeeCount || (Array.isArray(doc.approvedEmployees) ? doc.approvedEmployees.length : 0)
    ),
    proposedApprovedEmployeeCount: Number(
      doc.proposedApprovedEmployeeCount ||
        (Array.isArray(doc.proposedApprovedEmployees) ? doc.proposedApprovedEmployees.length : 0)
    ),

    status: s(doc.status),
    requesterConfirmationStatus: s(doc.requesterConfirmationStatus),

    currentApprovalStep: Number(doc.currentApprovalStep || 1),
    currentApproverEmployeeId: doc.currentApproverEmployeeId
      ? String(doc.currentApproverEmployeeId)
      : null,
    finalApproverEmployeeId: doc.finalApproverEmployeeId
      ? String(doc.finalApproverEmployeeId)
      : null,

    approvalStepCount: approvalSteps.length,
    hasApprovedStep: hasApprovedStep(doc),
    canEdit: canEditOTRequest(doc, authUser),
    canRequesterConfirm: canRequesterConfirm(doc, authUser),

    employees: effectiveEmployees.map(mapEmployeeOutput),

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function mapDetail(doc, authUser) {
  const requestedEmployees = Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees : []
  const approvedEmployees = Array.isArray(doc.approvedEmployees) ? doc.approvedEmployees : []
  const proposedApprovedEmployees = Array.isArray(doc.proposedApprovedEmployees)
    ? doc.proposedApprovedEmployees
    : []
  const effectiveEmployees = effectiveEmployeesForDoc(doc)

  return {
    id: String(doc._id),
    requestNo: doc.requestNo,
    requesterEmployeeId: doc.requesterEmployeeId ? String(doc.requesterEmployeeId) : null,
    requesterEmployeeNo: s(doc.requesterEmployeeNo),
    requesterName: s(doc.requesterName),

    otDate: s(doc.otDate),
    startTime: s(doc.startTime),
    endTime: s(doc.endTime),
    breakMinutes: Number(doc.breakMinutes || 0),
    totalMinutes: Number(doc.totalMinutes || 0),
    totalHours: Number(doc.totalHours || 0),
    dayType: s(doc.dayType),
    reason: s(doc.reason),

    requestedEmployees: requestedEmployees.map(mapEmployeeOutput),
    approvedEmployees: approvedEmployees.map(mapEmployeeOutput),
    proposedApprovedEmployees: proposedApprovedEmployees.map(mapEmployeeOutput),

    // alias so old frontend still shows something
    employees: effectiveEmployees.map(mapEmployeeOutput),

    employeeCount: effectiveEmployees.length,
    requestedEmployeeCount: Number(doc.requestedEmployeeCount || requestedEmployees.length),
    approvedEmployeeCount: Number(doc.approvedEmployeeCount || approvedEmployees.length),
    proposedApprovedEmployeeCount: Number(
      doc.proposedApprovedEmployeeCount || proposedApprovedEmployees.length
    ),

    comparisonSummary: buildComparisonSummary(doc),

    approvalSteps: Array.isArray(doc.approvalSteps)
      ? doc.approvalSteps.map((step) => ({
          stepNo: Number(step.stepNo || 0),
          approverEmployeeId: step.approverEmployeeId ? String(step.approverEmployeeId) : null,
          approverCode: s(step.approverCode),
          approverName: s(step.approverName),
          status: s(step.status),
          actedAt: step.actedAt || null,
          actedBy: step.actedBy ? String(step.actedBy) : null,
          remark: s(step.remark),
        }))
      : [],

    currentApprovalStep: Number(doc.currentApprovalStep || 1),
    currentApproverEmployeeId: doc.currentApproverEmployeeId
      ? String(doc.currentApproverEmployeeId)
      : null,
    finalApproverEmployeeId: doc.finalApproverEmployeeId
      ? String(doc.finalApproverEmployeeId)
      : null,

    status: s(doc.status),
    requesterConfirmationStatus: s(doc.requesterConfirmationStatus),
    requesterConfirmedAt: doc.requesterConfirmedAt || null,
    requesterConfirmationRemark: s(doc.requesterConfirmationRemark),

    lastAdjustmentByEmployeeId: doc.lastAdjustmentByEmployeeId
      ? String(doc.lastAdjustmentByEmployeeId)
      : null,
    lastAdjustmentByEmployeeNo: s(doc.lastAdjustmentByEmployeeNo),
    lastAdjustmentByEmployeeName: s(doc.lastAdjustmentByEmployeeName),
    lastAdjustmentAt: doc.lastAdjustmentAt || null,
    lastAdjustmentRemark: s(doc.lastAdjustmentRemark),
    lastAdjustmentStepNo: Number(doc.lastAdjustmentStepNo || 0) || null,

    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,

    canEdit: canEditOTRequest(doc, authUser),
    canRequesterConfirm: canRequesterConfirm(doc, authUser),

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function create(payload, authUser, options = {}) {
  const requesterEmployeeId = s(authUser?.employeeId)

  if (!requesterEmployeeId || !mongoose.isValidObjectId(requesterEmployeeId)) {
    const err = new Error('Your account is not linked to an employee profile')
    err.status = 400
    throw err
  }

  const requesterSnapshot = await resolveEmployeeSnapshot(requesterEmployeeId)

  const uniqueEmployeeIds = normalizeIdArray(payload.employeeIds)

  if (!uniqueEmployeeIds.length) {
    const err = new Error('Please select at least 1 employee')
    err.status = 400
    throw err
  }

  const requestedEmployees = await resolveEmployeesSnapshots(uniqueEmployeeIds)

  const duration = calculateDuration({
    startTime: payload.startTime,
    endTime: payload.endTime,
    breakMinutes: payload.breakMinutes,
  })

  const holidayDates =
    Array.isArray(options.holidays) && options.holidays.length
      ? options.holidays
      : await resolveHolidayDateStrings([payload.otDate])

  const dayType = getDayType(payload.otDate, {
    holidays: holidayDates,
  })

  const approvalFlow = await resolveApprovalFlow(
    requesterEmployeeId,
    payload.approverEmployeeIds || []
  )

  const doc = await OTRequest.create({
    requestNo: await generateRequestNo(),

    requesterEmployeeId: requesterSnapshot.employee._id,
    requesterEmployeeNo: s(
      requesterSnapshot.employee.employeeNo ||
        requesterSnapshot.employee.employeeCode ||
        requesterSnapshot.employee.code
    ),
    requesterName: s(
      requesterSnapshot.employee.displayName ||
        requesterSnapshot.employee.employeeName ||
        requesterSnapshot.employee.name
    ),

    requestedEmployees,
    requestedEmployeeCount: requestedEmployees.length,

    approvedEmployees: requestedEmployees,
    approvedEmployeeCount: requestedEmployees.length,

    proposedApprovedEmployees: [],
    proposedApprovedEmployeeCount: 0,

    otDate: s(payload.otDate),
    startTime: s(payload.startTime),
    endTime: s(payload.endTime),
    breakMinutes: Number(payload.breakMinutes || 0),
    totalMinutes: duration.totalMinutes,
    totalHours: duration.totalHours,
    dayType,
    reason: s(payload.reason),

    approvalSteps: approvalFlow.approvalSteps.map((step) => ({
      ...step,
      approverEmployeeId: step.approverEmployeeId,
    })),
    currentApprovalStep: approvalFlow.currentApprovalStep,
    currentApproverEmployeeId: approvalFlow.currentApproverEmployeeId,
    finalApproverEmployeeId: approvalFlow.finalApproverEmployeeId,

    requesterConfirmationStatus: 'NOT_REQUIRED',
    requesterConfirmedAt: null,
    requesterConfirmationRemark: '',

    status: 'PENDING',
    createdBy: authUser?.accountId || authUser?._id || null,
    updatedBy: authUser?.accountId || authUser?._id || null,
  })

  return getById(doc._id, authUser)
}

async function update(id, payload, authUser, options = {}) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid OT request id')
    err.status = 400
    throw err
  }

  const doc = await OTRequest.findById(id)

  if (!doc) {
    const err = new Error('OT request not found')
    err.status = 404
    throw err
  }

  assertCanEditOTRequest(doc, authUser)

  const requesterEmployeeId = s(doc.requesterEmployeeId || authUser?.employeeId)
  const requesterSnapshot = await resolveEmployeeSnapshot(requesterEmployeeId)

  const uniqueEmployeeIds = normalizeIdArray(payload.employeeIds)

  if (!uniqueEmployeeIds.length) {
    const err = new Error('Please select at least 1 employee')
    err.status = 400
    throw err
  }

  const requestedEmployees = await resolveEmployeesSnapshots(uniqueEmployeeIds)

  const duration = calculateDuration({
    startTime: payload.startTime,
    endTime: payload.endTime,
    breakMinutes: payload.breakMinutes,
  })

  const holidayDates =
    Array.isArray(options.holidays) && options.holidays.length
      ? options.holidays
      : await resolveHolidayDateStrings([payload.otDate])

  const dayType = getDayType(payload.otDate, {
    holidays: holidayDates,
  })

  const approvalFlow = await resolveApprovalFlow(
    requesterEmployeeId,
    payload.approverEmployeeIds || []
  )

  doc.requesterEmployeeId = requesterSnapshot.employee._id
  doc.requesterEmployeeNo = s(
    requesterSnapshot.employee.employeeNo ||
      requesterSnapshot.employee.employeeCode ||
      requesterSnapshot.employee.code
  )
  doc.requesterName = s(
    requesterSnapshot.employee.displayName ||
      requesterSnapshot.employee.employeeName ||
      requesterSnapshot.employee.name
  )

  doc.requestedEmployees = requestedEmployees
  doc.requestedEmployeeCount = requestedEmployees.length

  doc.approvedEmployees = requestedEmployees
  doc.approvedEmployeeCount = requestedEmployees.length

  doc.proposedApprovedEmployees = []
  doc.proposedApprovedEmployeeCount = 0

  doc.otDate = s(payload.otDate)
  doc.startTime = s(payload.startTime)
  doc.endTime = s(payload.endTime)
  doc.breakMinutes = Number(payload.breakMinutes || 0)
  doc.totalMinutes = duration.totalMinutes
  doc.totalHours = duration.totalHours
  doc.dayType = dayType
  doc.reason = s(payload.reason)

  doc.approvalSteps = approvalFlow.approvalSteps.map((step) => ({
    ...step,
    approverEmployeeId: step.approverEmployeeId,
  }))
  doc.currentApprovalStep = approvalFlow.currentApprovalStep
  doc.currentApproverEmployeeId = approvalFlow.currentApproverEmployeeId
  doc.finalApproverEmployeeId = approvalFlow.finalApproverEmployeeId

  doc.requesterConfirmationStatus = 'NOT_REQUIRED'
  doc.requesterConfirmedAt = null
  doc.requesterConfirmationRemark = ''

  doc.lastAdjustmentByEmployeeId = null
  doc.lastAdjustmentByEmployeeNo = ''
  doc.lastAdjustmentByEmployeeName = ''
  doc.lastAdjustmentByAccountId = null
  doc.lastAdjustmentAt = null
  doc.lastAdjustmentRemark = ''
  doc.lastAdjustmentStepNo = null

  doc.status = 'PENDING'
  doc.updatedBy = authUser?.accountId || authUser?._id || null

  await doc.save()

  return getById(doc._id, authUser)
}

async function list(query, authUser) {
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
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

async function listApprovalInbox(query, authUser) {
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
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

async function exportRequestsExcel(query) {
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

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })

  const stamp = new Date().toISOString().slice(0, 10)

  return {
    filename: `ot-requests-${stamp}.xlsx`,
    buffer,
  }
}

async function exportApprovalInboxExcel(query, authUser) {
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

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })

  const stamp = new Date().toISOString().slice(0, 10)

  return {
    filename: `ot-approval-inbox-${stamp}.xlsx`,
    buffer,
  }
}

async function getById(id, authUser) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid OT request id')
    err.status = 400
    throw err
  }

  const doc = await OTRequest.findById(id).lean()

  if (!doc) {
    const err = new Error('OT request not found')
    err.status = 404
    throw err
  }

  const detail = mapDetail(doc, authUser)

  if (detail.requesterEmployeeId && mongoose.isValidObjectId(detail.requesterEmployeeId)) {
    try {
      const snapshot = await resolveEmployeeSnapshot(detail.requesterEmployeeId)

      detail.departmentId = snapshot.department?._id ? String(snapshot.department._id) : null
      detail.departmentName = s(snapshot.department?.name)

      detail.positionId = snapshot.position?._id ? String(snapshot.position._id) : null
      detail.positionName = s(snapshot.position?.name)
    } catch {
      detail.departmentId = null
      detail.departmentName = ''
      detail.positionId = null
      detail.positionName = ''
    }
  } else {
    detail.departmentId = null
    detail.departmentName = ''
    detail.positionId = null
    detail.positionName = ''
  }

  detail.approvalStepCount = Array.isArray(detail.approvalSteps)
    ? detail.approvalSteps.length
    : 0
  detail.hasApprovedStep = hasApprovedStep(doc)

  return detail
}

async function decide(id, payload, authUser) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid OT request id')
    err.status = 400
    throw err
  }

  const doc = await OTRequest.findById(id)

  if (!doc) {
    const err = new Error('OT request not found')
    err.status = 404
    throw err
  }

  if (s(doc.status).toUpperCase() !== 'PENDING') {
    const err = new Error('Only pending OT requests can be decided')
    err.status = 400
    throw err
  }

  const currentStepNo = Number(doc.currentApprovalStep || 1)
  const stepIndex = doc.approvalSteps.findIndex(
    (step) => Number(step.stepNo) === currentStepNo
  )

  if (stepIndex === -1) {
    const err = new Error('Current approval step not found')
    err.status = 400
    throw err
  }

  const currentStep = doc.approvalSteps[stepIndex]
  const actorEmployeeId = s(authUser?.employeeId)
  const currentApproverEmployeeId = s(doc.currentApproverEmployeeId)

  const canActAsRoot = !!authUser?.isRootAdmin
  const canActAsAssignedApprover =
    actorEmployeeId &&
    currentApproverEmployeeId &&
    actorEmployeeId === currentApproverEmployeeId

  if (!canActAsRoot && !canActAsAssignedApprover) {
    const err = new Error('This OT request is not waiting for your approval')
    err.status = 403
    throw err
  }

  const action = s(payload.action).toUpperCase()
  const remark = s(payload.remark)

  if (action === 'APPROVE') {
    const currentApprovedPool = Array.isArray(doc.approvedEmployees) && doc.approvedEmployees.length
      ? doc.approvedEmployees
      : doc.requestedEmployees

    const approvedEmployeeIds = normalizeIdArray(payload.approvedEmployeeIds)

    if (!approvedEmployeeIds.length) {
      const err = new Error('Please select at least 1 approved employee')
      err.status = 400
      throw err
    }

    const poolIdSet = new Set(getCollectionIds(currentApprovedPool))
    const invalidEmployeeId = approvedEmployeeIds.find((employeeId) => !poolIdSet.has(employeeId))

    if (invalidEmployeeId) {
      const err = new Error('Approved employees must be selected from the current OT employee list')
      err.status = 400
      throw err
    }

    const nextApprovedEmployees = filterEmployeeSnapshotsByIds(currentApprovedPool, approvedEmployeeIds)
    const isChanged = !areSameEmployeeSelections(currentApprovedPool, approvedEmployeeIds)

    currentStep.status = 'APPROVED'
    currentStep.actedAt = new Date()
    currentStep.actedBy = authUser?.accountId || authUser?._id || null
    currentStep.remark = remark

    if (isChanged) {
      const actorIdentity = await resolveActorIdentity(authUser, {
        employeeId: currentStep.approverEmployeeId || null,
        employeeNo: currentStep.approverCode,
        employeeName: currentStep.approverName,
      })

      doc.proposedApprovedEmployees = nextApprovedEmployees
      doc.proposedApprovedEmployeeCount = nextApprovedEmployees.length

      doc.lastAdjustmentByEmployeeId = actorIdentity.employeeId || null
      doc.lastAdjustmentByEmployeeNo = s(actorIdentity.employeeNo)
      doc.lastAdjustmentByEmployeeName = s(actorIdentity.employeeName)
      doc.lastAdjustmentByAccountId = authUser?.accountId || authUser?._id || null
      doc.lastAdjustmentAt = new Date()
      doc.lastAdjustmentRemark = remark
      doc.lastAdjustmentStepNo = Number(currentStep.stepNo || 0) || null

      doc.requesterConfirmationStatus = 'PENDING'
      doc.requesterConfirmedAt = null
      doc.requesterConfirmationRemark = ''

      doc.currentApproverEmployeeId = null
      doc.status = 'PENDING_REQUESTER_CONFIRMATION'
    } else {
      doc.proposedApprovedEmployees = []
      doc.proposedApprovedEmployeeCount = 0
      doc.requesterConfirmationStatus = 'NOT_REQUIRED'
      doc.requesterConfirmedAt = null
      doc.requesterConfirmationRemark = ''

      const nextStep = doc.approvalSteps[stepIndex + 1]

      if (nextStep) {
        nextStep.status = 'PENDING'
        doc.currentApprovalStep = Number(nextStep.stepNo)
        doc.currentApproverEmployeeId = nextStep.approverEmployeeId
        doc.status = 'PENDING'
      } else {
        doc.currentApprovalStep = Number(currentStep.stepNo)
        doc.currentApproverEmployeeId = null
        doc.status = 'APPROVED'
      }
    }
  } else if (action === 'REJECT') {
    currentStep.status = 'REJECTED'
    currentStep.actedAt = new Date()
    currentStep.actedBy = authUser?.accountId || authUser?._id || null
    currentStep.remark = remark

    doc.proposedApprovedEmployees = []
    doc.proposedApprovedEmployeeCount = 0
    doc.requesterConfirmationStatus = 'NOT_REQUIRED'
    doc.requesterConfirmedAt = null
    doc.requesterConfirmationRemark = ''

    doc.currentApproverEmployeeId = null
    doc.status = 'REJECTED'
  } else {
    const err = new Error('Invalid action')
    err.status = 400
    throw err
  }

  doc.updatedBy = authUser?.accountId || authUser?._id || null

  await doc.save()

  return getById(doc._id, authUser)
}

async function requesterConfirm(id, payload, authUser) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid OT request id')
    err.status = 400
    throw err
  }

  const doc = await OTRequest.findById(id)

  if (!doc) {
    const err = new Error('OT request not found')
    err.status = 404
    throw err
  }

  assertCanRequesterConfirm(doc, authUser)

  const action = s(payload.action).toUpperCase()
  const remark = s(payload.remark)

  if (action === 'AGREE') {
    if (!Array.isArray(doc.proposedApprovedEmployees) || !doc.proposedApprovedEmployees.length) {
      const err = new Error('There is no adjusted employee list to confirm')
      err.status = 400
      throw err
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
      (step) => Number(step.stepNo) === currentStepNo
    )

    if (stepIndex === -1) {
      const err = new Error('Current approval step not found')
      err.status = 400
      throw err
    }

    const nextStep = doc.approvalSteps[stepIndex + 1]

    if (nextStep) {
      nextStep.status = 'PENDING'
      doc.currentApprovalStep = Number(nextStep.stepNo)
      doc.currentApproverEmployeeId = nextStep.approverEmployeeId
      doc.status = 'PENDING'
    } else {
      doc.currentApproverEmployeeId = null
      doc.status = 'APPROVED'
    }
  } else if (action === 'DISAGREE') {
    doc.requesterConfirmationStatus = 'DISAGREED'
    doc.requesterConfirmedAt = new Date()
    doc.requesterConfirmationRemark = remark

    doc.currentApproverEmployeeId = null
    doc.status = 'REQUESTER_DISAGREED'
  } else {
    const err = new Error('Invalid requester confirmation action')
    err.status = 400
    throw err
  }

  doc.updatedBy = authUser?.accountId || authUser?._id || null

  await doc.save()

  return getById(doc._id, authUser)
}

async function getAllowedApproverChain(employeeId) {
  const chain = await getUpwardApproverChain(employeeId)

  return chain.map((employee, index) => ({
    orderNo: index + 1,
    employeeId: String(employee._id),
    employeeNo: s(employee.employeeNo || employee.employeeCode || employee.code),
    displayName: s(employee.displayName || employee.employeeName || employee.name),
    departmentId: employee.departmentId || null,
    positionId: employee.positionId || null,
  }))
}

module.exports = {
  create,
  update,
  list,
  listApprovalInbox,
  exportRequestsExcel,
  exportApprovalInboxExcel,
  getById,
  decide,
  requesterConfirm,
  calculateDuration,
  getAllowedApproverChain,
}