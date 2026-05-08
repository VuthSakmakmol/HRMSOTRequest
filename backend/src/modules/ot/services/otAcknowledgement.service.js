// backend/src/modules/ot/services/otAcknowledgement.service.js
const mongoose = require('mongoose')

const OTRequest = require('../models/OTRequest')
const Employee = require('../../org/models/Employee')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function firstText(...values) {
  for (const value of values) {
    const text = s(value)
    if (text) return text
  }

  return ''
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

function normalizeLineSnapshot(source = {}) {
  if (!source || typeof source !== 'object') {
    return {
      lineId: null,
      lineCode: '',
      lineName: '',
      lineLabel: '',
    }
  }

  const lineId = firstText(source._id, source.id, source.lineId, source.productionLineId)

  const lineCode = firstText(
    source.code,
    source.lineCode,
    source.productionLineCode,
    source.employeeLineCode,
    source.assignedLineCode,
  )

  const lineName = firstText(
    source.name,
    source.lineName,
    source.productionLineName,
    source.employeeLineName,
    source.assignedLineName,
  )

  const lineLabel = firstText(
    source.lineLabel,
    source.productionLineLabel,
    source.employeeLineLabel,
    source.assignedLineLabel,
    source.displayName,
    source.label,
    lineCode && lineName ? `${lineCode} · ${lineName}` : '',
    lineCode,
    lineName,
  )

  return {
    lineId: lineId && mongoose.isValidObjectId(lineId) ? lineId : null,
    lineCode,
    lineName,
    lineLabel,
  }
}

function getDirectLineSnapshotFromEmployee(employee = {}) {
  const nestedLine =
    employee.line ||
    employee.productionLine ||
    employee.lineId ||
    employee.productionLineId ||
    null

  if (nestedLine && typeof nestedLine === 'object') {
    const nestedSnapshot = normalizeLineSnapshot(nestedLine)

    if (nestedSnapshot.lineCode || nestedSnapshot.lineName || nestedSnapshot.lineLabel) {
      return nestedSnapshot
    }
  }

  const directSnapshot = normalizeLineSnapshot({
    lineId: firstText(employee.lineId, employee.productionLineId),
    lineCode: firstText(
      employee.lineCode,
      employee.productionLineCode,
      employee.employeeLineCode,
      employee.assignedLineCode,
    ),
    lineName: firstText(
      employee.lineName,
      employee.productionLineName,
      employee.employeeLineName,
      employee.assignedLineName,
    ),
    lineLabel: firstText(
      employee.lineLabel,
      employee.productionLineLabel,
      employee.employeeLineLabel,
      employee.assignedLineLabel,
    ),
  })

  if (directSnapshot.lineCode || directSnapshot.lineName || directSnapshot.lineLabel) {
    return directSnapshot
  }

  return {
    lineId: directSnapshot.lineId,
    lineCode: '',
    lineName: '',
    lineLabel: '',
  }
}

function collectLineCandidateIds(employee = {}) {
  const values = [
    employee.lineId,
    employee.productionLineId,
    employee.employeeLineId,
    employee.assignedLineId,
    employee.line?._id,
    employee.line?.id,
    employee.productionLine?._id,
    employee.productionLine?.id,
  ]

  return Array.from(
    new Set(
      values
        .map((value) => s(value))
        .filter((value) => value && mongoose.isValidObjectId(value)),
    ),
  )
}

async function findLineDocumentById(lineId) {
  if (!lineId || !mongoose.isValidObjectId(lineId)) return null

  const objectId = new mongoose.Types.ObjectId(lineId)

  const collectionNames = [
    'productionlines',
    'production_lines',
    'lines',
    'orglines',
    'production_line',
  ]

  for (const collectionName of collectionNames) {
    try {
      const doc = await mongoose.connection.collection(collectionName).findOne(
        { _id: objectId },
        {
          projection: {
            _id: 1,
            code: 1,
            name: 1,
            lineCode: 1,
            lineName: 1,
            productionLineCode: 1,
            productionLineName: 1,
            displayName: 1,
            label: 1,
            isActive: 1,
          },
        },
      )

      if (doc) return doc
    } catch {
      // Try next possible collection name.
    }
  }

  return null
}

async function resolveLineSnapshotFromEmployee(employee = {}) {
  const directSnapshot = getDirectLineSnapshotFromEmployee(employee)

  if (directSnapshot.lineCode || directSnapshot.lineName || directSnapshot.lineLabel) {
    return directSnapshot
  }

  const candidateIds = collectLineCandidateIds(employee)

  for (const lineId of candidateIds) {
    const lineDoc = await findLineDocumentById(lineId)

    if (lineDoc) {
      return normalizeLineSnapshot(lineDoc)
    }
  }

  return directSnapshot
}

function collectEmployeeIdsFromSnapshots(items = [], idSet = new Set()) {
  for (const item of Array.isArray(items) ? items : []) {
    const employeeId = s(item?.employeeId)

    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      idSet.add(employeeId)
    }
  }

  return idSet
}

function collectEmployeeIdsFromOTDocs(docs = []) {
  const idSet = new Set()

  for (const doc of Array.isArray(docs) ? docs : []) {
    collectEmployeeIdsFromSnapshots(doc?.requestedEmployees, idSet)
    collectEmployeeIdsFromSnapshots(doc?.approvedEmployees, idSet)
    collectEmployeeIdsFromSnapshots(doc?.proposedApprovedEmployees, idSet)
  }

  return Array.from(idSet)
}

async function buildEmployeeMasterMapForOTDocs(docs = []) {
  const employeeIds = collectEmployeeIdsFromOTDocs(docs)

  if (!employeeIds.length) return new Map()

  const objectIds = employeeIds.map((id) => new mongoose.Types.ObjectId(id))

  const employees = await Employee.find({
    _id: { $in: objectIds },
  }).lean()

  const map = new Map()

  for (const employee of employees) {
    const line = await resolveLineSnapshotFromEmployee(employee)

    map.set(String(employee._id), {
      employeeId: String(employee._id),
      employeeCode: s(employee.employeeNo || employee.employeeCode || employee.code),
      employeeName: s(employee.displayName || employee.employeeName || employee.name),
      lineId: line.lineId,
      lineCode: line.lineCode,
      lineName: line.lineName,
      lineLabel: line.lineLabel,
    })
  }

  return map
}

function enrichEmployeeSnapshotWithMaster(item = {}, employeeMasterMap = new Map()) {
  const employeeId = s(item?.employeeId)
  const master = employeeMasterMap.get(employeeId) || {}

  const lineId = firstText(item?.lineId, master.lineId)
  const lineCode = firstText(item?.lineCode, master.lineCode)
  const lineName = firstText(item?.lineName, master.lineName)

  const lineLabel = firstText(
    item?.lineLabel,
    master.lineLabel,
    lineCode && lineName ? `${lineCode} · ${lineName}` : '',
    lineCode,
    lineName,
  )

  return {
    ...item,
    employeeCode: firstText(item?.employeeCode, master.employeeCode),
    employeeName: firstText(item?.employeeName, master.employeeName),

    lineId: lineId && mongoose.isValidObjectId(lineId) ? lineId : null,
    lineCode,
    lineName,
    lineLabel,
  }
}

function enrichOTDocEmployeeSnapshots(doc = {}, employeeMasterMap = new Map()) {
  return {
    ...doc,

    requestedEmployees: Array.isArray(doc.requestedEmployees)
      ? doc.requestedEmployees.map((item) =>
          enrichEmployeeSnapshotWithMaster(item, employeeMasterMap),
        )
      : [],

    approvedEmployees: Array.isArray(doc.approvedEmployees)
      ? doc.approvedEmployees.map((item) =>
          enrichEmployeeSnapshotWithMaster(item, employeeMasterMap),
        )
      : [],

    proposedApprovedEmployees: Array.isArray(doc.proposedApprovedEmployees)
      ? doc.proposedApprovedEmployees.map((item) =>
          enrichEmployeeSnapshotWithMaster(item, employeeMasterMap),
        )
      : [],
  }
}

async function enrichOTDocsWithEmployeeMasterData(docs = []) {
  const items = Array.isArray(docs) ? docs : []
  const employeeMasterMap = await buildEmployeeMasterMapForOTDocs(items)

  return items.map((doc) => enrichOTDocEmployeeSnapshots(doc, employeeMasterMap))
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
  const lineCode = s(item?.lineCode)
  const lineName = s(item?.lineName)

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

    lineId: item?.lineId ? String(item.lineId) : null,
    lineCode,
    lineName,
    lineLabel: firstText(
      item?.lineLabel,
      lineCode && lineName ? `${lineCode} · ${lineName}` : '',
      lineCode,
      lineName,
    ),
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
    approvedEmployeeCount: employees.length,
    requestedEmployeeCount: Number(
      doc.requestedEmployeeCount ||
        (Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees.length : 0),
    ),

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

  const enrichedItems = await enrichOTDocsWithEmployeeMasterData(items)

  return {
    items: enrichedItems.map((doc) => mapListItem(doc, authUser)),
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