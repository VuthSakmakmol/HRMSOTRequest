// backend/src/modules/org/services/employee.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')
const Employee = require('../models/Employee')
const Department = require('../models/Department')
const Position = require('../models/Position')
const ProductionLine = require('../models/ProductionLine')
const Shift = require('../../shift/models/Shift')
const Account = require('../../auth/models/Account')
const employeeScopeService = require('./employeeScope.service')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function id(value) {
  return value ? String(value?._id || value?.id || value) : ''
}

function sameId(a, b) {
  const aa = id(a)
  const bb = id(b)

  return aa !== '' && aa === bb
}

function uniqueIds(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => id(value))
        .filter(Boolean),
    ),
  ]
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function objectId(value) {
  return new mongoose.Types.ObjectId(String(value))
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

const importProgressJobs = new Map()
const IMPORT_PROGRESS_JOB_TTL_MS = 60 * 60 * 1000

function clampPercent(value) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(100, Math.round(number)))
}

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

function cleanupOldImportProgressJobs() {
  const now = Date.now()

  for (const [jobId, job] of importProgressJobs.entries()) {
    const updatedAtMs = new Date(job.updatedAt || job.createdAt || 0).getTime()

    if (!updatedAtMs || now - updatedAtMs > IMPORT_PROGRESS_JOB_TTL_MS) {
      importProgressJobs.delete(jobId)
    }
  }
}

function defaultImportProgressJob(jobId = '') {
  const now = new Date().toISOString()

  return {
    jobId: s(jobId),
    status: 'WAITING_UPLOAD',
    phase: 'UPLOAD',
    percent: 0,
    messageKey: 'org.employee.importProgress.waitingUpload',
    message: 'Waiting for file upload...',
    totalRows: 0,
    processedRows: 0,
    summary: null,
    createdAt: now,
    updatedAt: now,
    completedPhases: [],
  }
}

function startImportProgress(jobId, payload = {}) {
  cleanupOldImportProgressJobs()

  const cleanJobId = s(jobId)

  if (!cleanJobId) return defaultImportProgressJob('')

  const now = new Date().toISOString()

  const job = {
    ...defaultImportProgressJob(cleanJobId),
    ...payload,
    jobId: cleanJobId,
    status: payload.status || 'RUNNING',
    percent: clampPercent(payload.percent ?? 1),
    createdAt: now,
    updatedAt: now,
    completedPhases: uniqueStrings(payload.completedPhases || []),
  }

  importProgressJobs.set(cleanJobId, job)

  return job
}

function updateImportProgress(jobId, payload = {}) {
  cleanupOldImportProgressJobs()

  const cleanJobId = s(jobId)

  if (!cleanJobId) return defaultImportProgressJob('')

  const previous = importProgressJobs.get(cleanJobId) || defaultImportProgressJob(cleanJobId)

  const nextCompletedPhases = uniqueStrings([
    ...(previous.completedPhases || []),
    ...(payload.completedPhases || []),
  ])

  const next = {
    ...previous,
    ...payload,
    jobId: cleanJobId,
    status: payload.status || previous.status || 'RUNNING',
    percent: clampPercent(payload.percent ?? previous.percent),
    completedPhases: nextCompletedPhases,
    updatedAt: new Date().toISOString(),
  }

  importProgressJobs.set(cleanJobId, next)

  return next
}

function completeImportProgress(jobId, payload = {}) {
  if (!s(jobId)) return defaultImportProgressJob('')

  return updateImportProgress(jobId, {
    ...payload,
    status: 'SUCCESS',
    phase: 'COMPLETE',
    percent: 100,
    messageKey: payload.messageKey || 'org.employee.importProgress.completed',
    message: payload.message || 'Employee import completed.',
    completedPhases: [
      'UPLOAD',
      'READ_FILE',
      'PARSE_ROWS',
      'VALIDATE_BASIC',
      'MATCH_DEPARTMENT',
      'MATCH_POSITION',
      'MATCH_LINE',
      'MATCH_SHIFT',
      'MATCH_EMPLOYEE',
      'MATCH_ACCOUNT',
      'VALIDATE_RELATION',
      'IMPORT_EMPLOYEE',
      'RESOLVE_MANAGER',
      'CREATE_ACCOUNT',
      'SYNC_MANAGER',
      'COMPLETE',
    ],
  })
}

function getImportProgress(jobId) {
  cleanupOldImportProgressJobs()

  const cleanJobId = s(jobId)

  if (!cleanJobId) return defaultImportProgressJob('')

  return importProgressJobs.get(cleanJobId) || defaultImportProgressJob(cleanJobId)
}

function failImportProgress(jobId, error = {}) {
  if (!s(jobId)) return null

  return updateImportProgress(jobId, {
    status: 'FAILED',
    phase: 'FAILED',
    messageKey:
      error?.messageKey ||
      error?.code ||
      'org.employee.importProgress.failed',
    message:
      error?.message ||
      'Employee import failed. Please fix the Excel file and try again.',
  })
}

function emitImportProgress(options = {}, payload = {}) {
  const progressJobId = s(options.progressJobId)

  if (!progressJobId) return null

  return updateImportProgress(progressJobId, payload)
}

async function bulkWriteInChunks(
  model,
  operations = [],
  {
    session = null,
    ordered = true,
    chunkSize = 500,
    onProgress = null,
  } = {},
) {
  if (!operations.length) return null

  let result = null

  for (let index = 0; index < operations.length; index += chunkSize) {
    const chunk = operations.slice(index, index + chunkSize)

    result = await model.bulkWrite(chunk, {
      ordered,
      session,
    })

    if (typeof onProgress === 'function') {
      await onProgress({
        processed: Math.min(index + chunk.length, operations.length),
        total: operations.length,
      })
    }
  }

  return result
}

async function insertManyInChunks(
  model,
  docs = [],
  {
    session = null,
    ordered = true,
    chunkSize = 500,
    onProgress = null,
  } = {},
) {
  if (!docs.length) return null

  let result = null

  for (let index = 0; index < docs.length; index += chunkSize) {
    const chunk = docs.slice(index, index + chunkSize)

    result = await model.insertMany(chunk, {
      ordered,
      session,
    })

    if (typeof onProgress === 'function') {
      await onProgress({
        processed: Math.min(index + chunk.length, docs.length),
        total: docs.length,
      })
    }
  }

  return result
}

async function loadAccountMapForEmployeeIds(employeeIds = []) {
  const ids = uniqueIds(employeeIds).filter(isObjectId)

  if (!ids.length) return new Map()

  const accounts = await Account.find(
    {
      employeeId: {
        $in: ids.map(objectId),
      },
    },
    'employeeId loginId isActive',
  ).lean()

  const accountByEmployeeId = new Map()

  for (const account of accounts) {
    if (account.employeeId) {
      accountByEmployeeId.set(id(account.employeeId), account)
    }
  }

  return accountByEmployeeId
}

async function buildAccountDocsInBatches({
  validRows = [],
  importedEmployeeByCode = new Map(),
  accountByEmployeeId = new Map(),
  options = {},
  batchSize = 16,
}) {
  const accountRows = validRows.filter((row) => row.shouldCreateAccount)
  const accountDocs = []
  const total = accountRows.length

  if (!total) {
    emitImportProgress(options, {
      phase: 'CREATE_ACCOUNT',
      percent: 97,
      totalRows: validRows.length,
      processedRows: validRows.length,
      messageKey: 'org.employee.importProgress.createAccount',
      message: 'No login accounts requested. Skipping account creation...',
      completedPhases: ['RESOLVE_MANAGER'],
    })

    return accountDocs
  }

  for (let index = 0; index < accountRows.length; index += batchSize) {
    const batch = accountRows.slice(index, index + batchSize)

    const docs = await Promise.all(
      batch.map(async (row) => {
        const employeeDoc = importedEmployeeByCode.get(row.employeeCode)

        if (!employeeDoc) return null
        if (accountByEmployeeId.has(id(employeeDoc._id))) return null

        const passwordHash = await Account.hashPassword(row.accountPassword)

        return {
          loginId: row.accountLoginId,
          passwordHash,
          displayName: s(employeeDoc.displayName || row.displayName),
          employeeId: employeeDoc._id,
          roleIds: [],
          directPermissionCodes: [],
          passwordVersion: 1,
          mustChangePassword: true,
          isActive: true,
        }
      }),
    )

    accountDocs.push(...docs.filter(Boolean))

    const processed = Math.min(index + batch.length, total)
    const percent = 92 + Math.round((processed / Math.max(total, 1)) * 5)

    emitImportProgress(options, {
      phase: 'CREATE_ACCOUNT',
      percent,
      totalRows: validRows.length,
      processedRows: processed,
      messageKey: 'org.employee.importProgress.createAccount',
      message: `Hashing requested accounts ${processed}/${total}...`,
      completedPhases: ['RESOLVE_MANAGER'],
    })
  }

  return accountDocs
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeOTWorkflowRole(value) {
  const role = upper(value || 'NONE')

  return ['NONE', 'APPROVER', 'ACKNOWLEDGE'].includes(role) ? role : 'NONE'
}

function getPositionHierarchyScope(position) {
  return upper(position?.hierarchyScope || position?.managerScope || 'SAME_LINE')
}

function otWorkflowRoleKey(value) {
  const role = normalizeOTWorkflowRole(value)

  if (role === 'APPROVER') return 'org.employee.otWorkflowRole.approver'
  if (role === 'ACKNOWLEDGE') return 'org.employee.otWorkflowRole.acknowledge'

  return 'org.employee.otWorkflowRole.none'
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isValidDateParts(year, month, day) {
  if (!year || !month || !day) return false
  if (year < 1900 || year > 2200) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  )
}

function formatDateYYYYMMDD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 10)
}

function formatDateDDMMYYYY(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  if (!isValidDateParts(year, month, day)) return ''

  return `${pad2(day)}/${pad2(month)}/${year}`
}

function parseExcelSerialDate(value) {
  const serial = Number(value)

  if (!Number.isFinite(serial) || serial <= 0) return null

  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()

  if (!isValidDateParts(year, month, day)) return null

  return new Date(Date.UTC(year, month - 1, day))
}

function parseImportDate(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'number') {
    return parseExcelSerialDate(value)
  }

  const raw = s(value)

  if (!raw) return null

  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    if (!isValidDateParts(year, month, day)) return 'INVALID_DATE'

    return new Date(Date.UTC(year, month - 1, day))
  }

  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    if (!isValidDateParts(year, month, day)) return 'INVALID_DATE'

    return new Date(Date.UTC(year, month - 1, day))
  }

  return 'INVALID_DATE'
}

function normalizeImportStatus(value) {
  const raw = s(value)

  if (!raw) return true

  const text = raw.toLowerCase()

  if (['active', 'true', 'yes', 'y', '1'].includes(text)) return true
  if (['inactive', 'false', 'no', 'n', '0'].includes(text)) return false

  return 'INVALID_BOOLEAN'
}

function normalizeImportCreateAccount(value) {
  const raw = s(value)

  if (!raw) return false

  const text = raw.toLowerCase()

  if (['yes', 'y', 'true', '1', 'create', 'account'].includes(text)) return true
  if (['no', 'n', 'false', '0', 'skip', 'none'].includes(text)) return false

  return 'INVALID_CREATE_ACCOUNT'
}

function getImportField(raw = {}, keys = []) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && s(raw[key]) !== '') {
      return raw[key]
    }
  }

  const normalized = Object.entries(raw || {}).reduce((acc, [key, value]) => {
    acc[upper(key)] = value
    return acc
  }, {})

  for (const key of keys) {
    const value = normalized[upper(key)]

    if (value !== undefined && value !== null && s(value) !== '') {
      return value
    }
  }

  return ''
}

function normalizeImportCodeToken(value) {
  const text = upper(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''

  const labelParts = text.split(/\s+-\s+/)

  return upper(labelParts[0])
}

function splitImportCodes(value) {
  return uniqueStrings(
    String(value || '')
      .split(/[,，;\n\r\t|]+/)
      .map(normalizeImportCodeToken)
      .filter(Boolean),
  )
}

function excelBufferFromWorkbook(workbook) {
  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function buildAccountSummary(accountDoc) {
  if (!accountDoc) {
    return {
      hasAccount: false,
      accountId: null,
      accountLoginId: null,
      accountIsActive: false,
    }
  }

  return {
    hasAccount: true,
    accountId: id(accountDoc._id),
    accountLoginId: accountDoc.loginId || '',
    accountIsActive: !!accountDoc.isActive,
  }
}

function buildShiftSummary(shiftValue) {
  const shiftId = id(shiftValue)
  const shiftCode = shiftValue?.code || ''
  const shiftName = shiftValue?.name || ''
  const shiftType = shiftValue?.type || ''
  const shiftStartTime = shiftValue?.startTime || ''
  const shiftEndTime = shiftValue?.endTime || ''
  const shiftBreakStartTime = shiftValue?.breakStartTime || ''
  const shiftBreakEndTime = shiftValue?.breakEndTime || ''
  const shiftCrossMidnight = !!shiftValue?.crossMidnight

  const hasShiftPayload = Boolean(
    shiftId ||
      shiftCode ||
      shiftName ||
      shiftType ||
      shiftStartTime ||
      shiftEndTime,
  )

  return {
    shiftId: shiftId || null,
    shiftCode,
    shiftName,
    shiftType,
    shiftStartTime,
    shiftEndTime,
    shiftBreakStartTime,
    shiftBreakEndTime,
    shiftCrossMidnight,
    shift: hasShiftPayload
      ? {
          id: shiftId || null,
          _id: shiftId || null,
          code: shiftCode,
          name: shiftName,
          type: shiftType,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          breakStartTime: shiftBreakStartTime,
          breakEndTime: shiftBreakEndTime,
          crossMidnight: shiftCrossMidnight,
        }
      : null,
  }
}

function buildLineItem(lineValue) {
  const lineId = id(lineValue)

  if (!lineId) return null

  return {
    id: lineId,
    _id: lineId,
    code: lineValue?.code || '',
    name: lineValue?.name || '',
    label: [lineValue?.code, lineValue?.name].filter(Boolean).join(' - '),
  }
}

function buildLineSummary(docOrLineValue) {
  const rawLines = []

  if (Array.isArray(docOrLineValue?.lineIds)) {
    rawLines.push(...docOrLineValue.lineIds)
  }

  if (docOrLineValue?.lineId) {
    rawLines.unshift(docOrLineValue.lineId)
  }

  if (!rawLines.length && id(docOrLineValue)) {
    rawLines.push(docOrLineValue)
  }

  const seen = new Set()
  const lines = rawLines
    .map(buildLineItem)
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line.id)) return false
      seen.add(line.id)
      return true
    })

  const primaryLine = lines[0] || null

  return {
    lineId: primaryLine?.id || null,
    lineCode: primaryLine?.code || '',
    lineName: primaryLine?.name || '',
    line: primaryLine,

    lineIds: lines.map((line) => line.id),
    lines,
    lineCodes: lines.map((line) => line.code).filter(Boolean),
    lineNames: lines.map((line) => line.name).filter(Boolean),
    linesLabel: lines
      .map((line) => line.label || line.code || line.name)
      .filter(Boolean)
      .join(', '),
  }
}

function normalizeLineIdsFromPayload(payload = {}) {
  const values = []

  if (Array.isArray(payload.lineIds)) {
    values.push(...payload.lineIds)
  }

  if (payload.lineId) {
    values.unshift(payload.lineId)
  }

  return uniqueIds(values)
}

function employeeLineIds(employee = {}) {
  return uniqueIds([
    ...(Array.isArray(employee.lineIds) ? employee.lineIds : []),
    employee.lineId,
  ])
}

function hasAnySameLine(a = {}, b = {}) {
  const aLineIds = employeeLineIds(a)
  const bLineIds = new Set(employeeLineIds(b))

  return aLineIds.some((lineId) => bLineIds.has(lineId))
}

function buildLineManagersSummary(lineManagers = []) {
  const managers = Array.isArray(lineManagers) ? lineManagers : []

  return managers
    .filter(Boolean)
    .map((manager) => {
      const managerId = id(manager)

      return {
        id: managerId,
        _id: managerId,
        employeeCode: manager.employeeCode || '',
        displayName: manager.displayName || '',
      }
    })
    .filter((manager) => manager.id)
}

function getLineManagerIdsFromDoc(doc) {
  return uniqueIds(doc?.lineManagerIds || [])
}

function employeeDisplayLabel(doc) {
  return (
    [doc?.employeeCode, doc?.displayName].filter(Boolean).join(' - ') ||
    s(doc?.displayName)
  )
}

function sanitize(doc, accountDoc = null) {
  if (!doc) return null

  const lineManagers = buildLineManagersSummary(doc.lineManagerIds)
  const workflowRole = normalizeOTWorkflowRole(doc.otWorkflowRole)
  const hierarchyScope = getPositionHierarchyScope(doc.positionId)

  return {
    id: id(doc._id),
    _id: id(doc._id),

    employeeId: id(doc._id),
    employeeCode: doc.employeeCode || '',
    displayName: doc.displayName || '',
    label: employeeDisplayLabel(doc),

    departmentId: id(doc.departmentId) || null,
    departmentCode: doc.departmentId?.code || '',
    departmentName: doc.departmentId?.name || '',

    positionId: id(doc.positionId) || null,
    positionCode: doc.positionId?.code || '',
    positionName: doc.positionId?.name || '',
    reportsToPositionId: doc.positionId?.reportsToPositionId
      ? id(doc.positionId.reportsToPositionId)
      : null,
    reportsToPositionCode: doc.positionId?.reportsToPositionCode || '',
    reportsToPositionName: doc.positionId?.reportsToPositionName || '',
    hierarchyScope,
    managerScope: hierarchyScope,

    ...buildLineSummary(doc),
    ...buildShiftSummary(doc.shiftId),

    reportsToEmployeeId: id(doc.reportsToEmployeeId) || null,
    reportsToEmployeeCode: doc.reportsToEmployeeId?.employeeCode || '',
    reportsToEmployeeName: doc.reportsToEmployeeId?.displayName || '',

    lineManagerIds: getLineManagerIdsFromDoc(doc),
    lineManagers,
    lineManagerNames: lineManagers
      .map((manager) =>
        [manager.employeeCode, manager.displayName].filter(Boolean).join(' - '),
      )
      .filter(Boolean)
      .join(', '),

    otWorkflowRole: workflowRole,
    otWorkflowRoleKey: otWorkflowRoleKey(workflowRole),

    phone: doc.phone || '',
    email: doc.email || '',
    joinDate: doc.joinDate || null,
    joinDateText: formatDateDDMMYYYY(doc.joinDate),
    isActive: !!doc.isActive,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,

    ...buildAccountSummary(accountDoc),
  }
}

function sanitizeOrgNode(doc) {
  const item = doc?.employeeId && doc?.employeeCode ? doc : sanitize(doc)

  if (!item) return null

  return {
    id: item.id,
    _id: item._id,
    employeeId: item.employeeId,
    employeeCode: item.employeeCode,
    displayName: item.displayName,
    label: item.label,

    departmentId: item.departmentId,
    departmentName: item.departmentName,

    positionId: item.positionId,
    positionName: item.positionName,

    lineId: item.lineId,
    lineCode: item.lineCode,
    lineName: item.lineName,
    lineIds: item.lineIds,
    lines: item.lines,
    lineCodes: item.lineCodes,
    lineNames: item.lineNames,
    linesLabel: item.linesLabel,

    shiftId: item.shiftId,
    shiftCode: item.shiftCode,
    shiftName: item.shiftName,
    shiftType: item.shiftType,
    shiftStartTime: item.shiftStartTime,
    shiftEndTime: item.shiftEndTime,

    reportsToEmployeeId: item.reportsToEmployeeId,
    reportsToEmployeeCode: item.reportsToEmployeeCode,
    reportsToEmployeeName: item.reportsToEmployeeName,

    lineManagerIds: item.lineManagerIds,
    lineManagers: item.lineManagers,
    lineManagerNames: item.lineManagerNames,

    otWorkflowRole: item.otWorkflowRole,
    otWorkflowRoleKey: item.otWorkflowRoleKey,
    isActive: item.isActive,
  }
}

function addAndFilter(filter, condition) {
  if (!condition || !Object.keys(condition).length) return

  if (!Array.isArray(filter.$and)) {
    filter.$and = []
  }

  filter.$and.push(condition)
}

function buildEmployeeListFilter(
  {
    search = '',
    departmentId = '',
    positionId = '',
    lineId = '',
    shiftId = '',
    isActive,
  } = {},
  scopeFilter = {},
) {
  const filter = { ...scopeFilter }
  const keyword = s(search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    addAndFilter(filter, {
      $or: [
        { employeeCode: regex },
        { displayName: regex },
        { phone: regex },
        { email: regex },
        { otWorkflowRole: regex },
      ],
    })
  }

  if (departmentId && isObjectId(departmentId)) {
    filter.departmentId = objectId(departmentId)
  }

  if (positionId && isObjectId(positionId)) {
    filter.positionId = objectId(positionId)
  }

  if (lineId && isObjectId(lineId)) {
    addAndFilter(filter, {
      $or: [
        { lineId: objectId(lineId) },
        { lineIds: objectId(lineId) },
      ],
    })
  }

  if (shiftId && isObjectId(shiftId)) {
    filter.shiftId = objectId(shiftId)
  }

  if (typeof isActive === 'boolean') {
    filter.isActive = isActive
  }

  return filter
}

function buildEmployeeSort(sortBy = 'createdAt', sortOrder = 'desc') {
  const allowed = new Set([
    'createdAt',
    'updatedAt',
    'employeeCode',
    'displayName',
    'joinDate',
    'isActive',
    'otWorkflowRole',
  ])

  const field = allowed.has(sortBy) ? sortBy : 'createdAt'
  const direction = sortOrder === 'asc' ? 1 : -1

  return {
    [field]: direction,
    _id: -1,
  }
}

async function loadAccountMapForEmployees() {
  const accounts = await Account.find({}, 'employeeId loginId isActive').lean()
  const accountByEmployeeId = new Map()

  for (const account of accounts) {
    if (account.employeeId) {
      accountByEmployeeId.set(id(account.employeeId), account)
    }
  }

  return accountByEmployeeId
}

function normalizeAccountLoginId(employeeCode, loginId = '') {
  const rawLoginId = s(loginId) || s(employeeCode)

  return rawLoginId.toLowerCase()
}

function normalizePhoneForPassword(phone = '') {
  return s(phone).replace(/\s+/g, '')
}

function buildDefaultAccountPassword(employeeCode = '', phone = '') {
  return `${upper(employeeCode)}${normalizePhoneForPassword(phone)}`
}

function buildImportAccountLoginId(employeeCode = '') {
  return normalizeAccountLoginId(employeeCode)
}

function buildImportAccountPassword(row = {}) {
  const cleanEmployeeCode = upper(row.employeeCode)
  const cleanPhone = normalizePhoneForPassword(row.phone)

  return `${cleanEmployeeCode}${cleanPhone}`
}

function isPasswordLengthValid(password = '') {
  const text = s(password)

  return text.length >= 6 && text.length <= 100
}

async function ensureAccountLoginIdAvailable(loginId) {
  const normalizedLoginId = s(loginId).toLowerCase()

  if (!normalizedLoginId) {
    throw appError({
      statusCode: 400,
      code: 'ACCOUNT_LOGIN_ID_REQUIRED',
      messageKey: 'auth.account.validation.loginIdRequired',
      message: 'Login ID is required',
      field: 'createAccount.loginId',
    })
  }

  const exists = await Account.exists({ loginId: normalizedLoginId })

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'ACCOUNT_LOGIN_ID_EXISTS',
      messageKey: 'auth.account.error.loginIdExists',
      message: 'Login ID already exists',
      field: 'createAccount.loginId',
      params: {
        loginId: normalizedLoginId,
      },
    })
  }
}

async function ensureEmployeeHasNoAccount(employeeId) {
  const exists = await Account.exists({ employeeId })

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'EMPLOYEE_ACCOUNT_EXISTS',
      messageKey: 'org.employee.error.accountExists',
      message: 'This employee already has an account',
      field: 'createAccount.enabled',
    })
  }
}

function normalizeCreateAccountPayload(payload = {}, employeePayload = {}) {
  const enabled = payload?.enabled === true

  if (!enabled) {
    return {
      enabled: false,
      loginId: '',
      password: '',
      mustChangePassword: true,
      isActive: true,
    }
  }

  const loginId = normalizeAccountLoginId(employeePayload.employeeCode, payload.loginId)
  const password =
    s(payload.password) ||
    buildDefaultAccountPassword(employeePayload.employeeCode, employeePayload.phone)

  return {
    enabled: true,
    loginId,
    password,
    mustChangePassword: payload.mustChangePassword !== false,
    isActive: payload.isActive !== false,
  }
}

async function validateCreateAccountOption(accountPayload = {}, employeePayload = {}) {
  const account = normalizeCreateAccountPayload(accountPayload, employeePayload)

  if (!account.enabled) return account

  if (!s(employeePayload.phone)) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_PHONE_REQUIRED_FOR_ACCOUNT',
      messageKey: 'org.employee.validation.phoneRequiredForAccount',
      message: 'Phone number is required when creating a login account for an employee',
      field: 'phone',
    })
  }

  if (account.password.length < 6) {
    throw appError({
      statusCode: 400,
      code: 'ACCOUNT_PASSWORD_TOO_SHORT',
      messageKey: 'auth.account.validation.passwordMinLength',
      message: 'Password must be at least 6 characters',
      field: 'createAccount.password',
    })
  }

  if (account.password.length > 100) {
    throw appError({
      statusCode: 400,
      code: 'ACCOUNT_PASSWORD_TOO_LONG',
      messageKey: 'auth.account.validation.passwordMaxLength',
      message: 'Password is too long',
      field: 'createAccount.password',
    })
  }

  await ensureAccountLoginIdAvailable(account.loginId)

  return account
}

async function createAccountForEmployee(employeeDoc, accountPayload = {}) {
  if (!accountPayload?.enabled) return null

  await ensureEmployeeHasNoAccount(employeeDoc._id)

  const passwordHash = await Account.hashPassword(accountPayload.password)

  return Account.create({
    loginId: accountPayload.loginId,
    passwordHash,
    displayName: s(employeeDoc.displayName),
    employeeId: employeeDoc._id,
    roleIds: [],
    directPermissionCodes: [],
    passwordVersion: 1,
    mustChangePassword: accountPayload.mustChangePassword !== false,
    isActive: accountPayload.isActive !== false,
  })
}

async function ensureObjectId(value, field = 'id') {
  if (!isObjectId(value)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid id',
      field,
      params: {
        value,
      },
    })
  }
}

async function ensureDepartmentExists(departmentId) {
  await ensureObjectId(departmentId, 'departmentId')

  const department = await Department.findById(departmentId)
    .select('_id code name isActive')
    .lean()

  if (!department) {
    throw appError({
      statusCode: 404,
      code: 'DEPARTMENT_NOT_FOUND',
      messageKey: 'org.department.error.notFound',
      message: 'Department not found',
      field: 'departmentId',
    })
  }

  return department
}

async function ensurePositionExists(positionId, departmentId = null) {
  await ensureObjectId(positionId, 'positionId')

  const position = await Position.findById(positionId)
    .select(
      '_id code name departmentId reportsToPositionId reportsToPositionCode reportsToPositionName hierarchyScope managerScope isActive',
    )
    .lean()

  if (!position) {
    throw appError({
      statusCode: 404,
      code: 'POSITION_NOT_FOUND',
      messageKey: 'org.position.error.notFound',
      message: 'Position not found',
      field: 'positionId',
    })
  }

  if (departmentId && !sameId(position.departmentId, departmentId)) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_DEPARTMENT_MISMATCH',
      messageKey: 'org.position.error.departmentMismatch',
      message: 'Position does not belong to selected department',
      field: 'positionId',
    })
  }

  return position
}

async function ensureLinesAllowed(lineIds = [], departmentId, positionId) {
  const ids = uniqueIds(lineIds)

  if (!ids.length) return []

  const objectIdValues = ids.filter(isObjectId).map(objectId)
  const codeValues = ids.map(upper).filter(Boolean)

  const queryOr = []

  if (objectIdValues.length) {
    queryOr.push({
      _id: {
        $in: objectIdValues,
      },
    })
  }

  if (codeValues.length) {
    queryOr.push({
      code: {
        $in: codeValues,
      },
    })
  }

  const lines = queryOr.length
    ? await ProductionLine.find({
        $or: queryOr,
      })
        .select('_id code name departmentId departmentIds positionIds isActive')
        .lean()
    : []

  const lineById = new Map(lines.map((line) => [id(line._id), line]))
  const lineByCode = new Map(lines.map((line) => [upper(line.code), line]))

  const sortedLines = ids
    .map((lineValue) => {
      return lineById.get(lineValue) || lineByCode.get(upper(lineValue)) || null
    })
    .filter(Boolean)

  const foundIds = new Set(sortedLines.map((line) => id(line._id)))
  const foundCodes = new Set(sortedLines.map((line) => upper(line.code)))

  const missingValues = ids.filter((lineValue) => {
    return !foundIds.has(lineValue) && !foundCodes.has(upper(lineValue))
  })

  if (missingValues.length) {
    throw appError({
      statusCode: 404,
      code: 'LINE_NOT_FOUND',
      messageKey: 'org.line.error.notFound',
      message: 'Some selected lines were not found',
      field: 'lineIds',
      params: {
        missingValues,
      },
    })
  }

  for (const line of sortedLines) {
    if (line.isActive === false) {
      throw appError({
        statusCode: 400,
        code: 'LINE_INACTIVE',
        messageKey: 'org.line.error.inactive',
        message: 'Line is inactive',
        field: 'lineIds',
        params: {
          lineId: id(line._id),
          lineCode: line.code || '',
        },
      })
    }

    const allowedDepartmentIds = uniqueIds([
      ...(Array.isArray(line.departmentIds) ? line.departmentIds : []),
      line.departmentId,
    ])

    if (
      departmentId &&
      allowedDepartmentIds.length &&
      !allowedDepartmentIds.includes(id(departmentId))
    ) {
      throw appError({
        statusCode: 400,
        code: 'LINE_DEPARTMENT_MISMATCH',
        messageKey: 'org.line.error.departmentMismatch',
        message: 'Selected line does not support this employee department',
        field: 'lineIds',
        params: {
          lineId: id(line._id),
          lineCode: line.code || '',
          departmentId: id(departmentId),
        },
      })
    }

    const allowedPositionIds = uniqueIds(line.positionIds || [])

    if (
      allowedPositionIds.length &&
      positionId &&
      !allowedPositionIds.includes(id(positionId))
    ) {
      throw appError({
        statusCode: 400,
        code: 'LINE_POSITION_NOT_ALLOWED',
        messageKey: 'org.line.error.positionNotAllowed',
        message: 'Selected line does not allow this employee position',
        field: 'lineIds',
        params: {
          lineId: id(line._id),
          lineCode: line.code || '',
          positionId: id(positionId),
        },
      })
    }
  }

  return sortedLines
}

async function ensureLineAllowed(lineId, departmentId, positionId) {
  const lines = await ensureLinesAllowed(lineId ? [lineId] : [], departmentId, positionId)

  return lines[0] || null
}

async function ensureShiftExists(shiftId) {
  await ensureObjectId(shiftId, 'shiftId')

  const shift = await Shift.findOne({
    _id: shiftId,
    isActive: true,
  })
    .select(
      '_id code name type startTime endTime breakStartTime breakEndTime crossMidnight isActive',
    )
    .lean()

  if (!shift) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_NOT_FOUND_OR_INACTIVE',
      messageKey: 'shift.error.notFoundOrInactive',
      message: 'Shift not found or inactive',
      field: 'shiftId',
    })
  }

  return shift
}

async function ensureReportsToEmployeeExists(employeeId) {
  if (!employeeId) return null

  await ensureObjectId(employeeId, 'reportsToEmployeeId')

  const employee = await Employee.findById(employeeId)
    .select('_id employeeCode displayName isActive')
    .lean()

  if (!employee) {
    throw appError({
      statusCode: 404,
      code: 'REPORTS_TO_EMPLOYEE_NOT_FOUND',
      messageKey: 'org.employee.error.reportsToEmployeeNotFound',
      message: 'Reports-to employee not found',
      field: 'reportsToEmployeeId',
    })
  }

  return employee
}

async function ensureEmployeeCodeUnique(employeeCode, excludeId = null) {
  const code = upper(employeeCode)

  if (!code) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_CODE_REQUIRED',
      messageKey: 'org.employee.validation.employeeCodeRequired',
      message: 'Employee code is required',
      field: 'employeeCode',
    })
  }

  const filter = {
    employeeCode: code,
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await Employee.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'EMPLOYEE_CODE_EXISTS',
      messageKey: 'org.employee.error.employeeCodeExists',
      message: 'Employee code already exists',
      field: 'employeeCode',
      params: {
        employeeCode: code,
      },
    })
  }
}

async function ensureEmailUnique(email, excludeId = null) {
  const normalized = s(email).toLowerCase()

  if (!normalized) return

  const filter = {
    email: normalized,
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await Employee.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'EMPLOYEE_EMAIL_EXISTS',
      messageKey: 'org.employee.error.emailExists',
      message: 'Email already exists',
      field: 'email',
      params: {
        email: normalized,
      },
    })
  }
}

async function findAutoManagerIdsByPositionAndLine({
  employeeId = null,
  departmentId,
  position,
  lineId = null,
  lineIds = [],
}) {
  if (!position?.reportsToPositionId) return []

  const hierarchyScope = getPositionHierarchyScope(position)
  const cleanLineIds = uniqueIds([...lineIds, lineId])

  const filter = {
    positionId: position.reportsToPositionId,
    isActive: true,
  }

  if (hierarchyScope === 'SAME_LINE') {
    if (!cleanLineIds.length) return []

    filter.$or = [
      {
        lineId: {
          $in: cleanLineIds.map(objectId),
        },
      },
      {
        lineIds: {
          $in: cleanLineIds.map(objectId),
        },
      },
    ]
  }

  if (hierarchyScope === 'GLOBAL') {
    if (departmentId) {
      filter.departmentId = departmentId
    }
  }

  if (employeeId) {
    filter._id = {
      $ne: employeeId,
    }
  }

  const managers = await Employee.find(filter)
    .select('_id employeeCode displayName departmentId positionId lineId lineIds')
    .sort({ employeeCode: 1, displayName: 1, _id: 1 })
    .lean()

  return managers.map((manager) => manager._id)
}

async function resolveFinalManagerIds({
  employeeId = null,
  departmentId,
  position,
  lineId = null,
  lineIds = [],
  manualReportsToEmployeeId = null,
}) {
  const autoManagerIds = await findAutoManagerIdsByPositionAndLine({
    employeeId,
    departmentId,
    position,
    lineId,
    lineIds,
  })

  if (autoManagerIds.length) {
    return {
      primaryManagerId: autoManagerIds[0],
      lineManagerIds: autoManagerIds,
    }
  }

  if (!manualReportsToEmployeeId) {
    return {
      primaryManagerId: null,
      lineManagerIds: [],
    }
  }

  if (employeeId && sameId(manualReportsToEmployeeId, employeeId)) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_REPORT_TO_SELF',
      messageKey: 'org.employee.error.reportToSelf',
      message: 'Employee cannot report to self',
      field: 'reportsToEmployeeId',
    })
  }

  await ensureReportsToEmployeeExists(manualReportsToEmployeeId)

  return {
    primaryManagerId: manualReportsToEmployeeId,
    lineManagerIds: [manualReportsToEmployeeId],
  }
}

async function assertReadableEmployee(currentUser, employeeId) {
  if (!currentUser) return
  if (employeeScopeService.canViewAllEmployees(currentUser)) return

  const scopedIds = await employeeScopeService.getScopedEmployeeIds(currentUser, {
    allowAll: false,
  })

  if (!scopedIds.has(id(employeeId))) {
    throw appError({
      statusCode: 403,
      code: 'EMPLOYEE_NOT_IN_SCOPE',
      messageKey: 'org.employee.error.notInScope',
      message: 'Employee is outside your scope',
      field: 'employeeId',
      params: {
        employeeId: id(employeeId),
      },
    })
  }
}

async function buildEmployeeLookupScopeFilter(query, currentUser) {
  if (query.scope === 'ALL') {
    if (!employeeScopeService.canLookupAllEmployees(currentUser)) {
      throw appError({
        statusCode: 403,
        code: 'MISSING_PERMISSION',
        messageKey: 'access.error.missingPermission',
        message: 'Missing required permission: EMPLOYEE_LOOKUP_ALL',
        params: {
          requiredPermission: 'EMPLOYEE_LOOKUP_ALL',
        },
      })
    }

    return {}
  }

  return employeeScopeService.buildEmployeeScopeFilter(currentUser)
}

function buildEmployeeLookupItem(doc) {
  const item = sanitize(doc)

  return {
    id: item.id,
    _id: item._id,
    employeeId: item.employeeId,
    employeeCode: item.employeeCode,
    displayName: item.displayName,
    label: item.label,

    departmentId: item.departmentId,
    departmentCode: item.departmentCode,
    departmentName: item.departmentName,

    positionId: item.positionId,
    positionCode: item.positionCode,
    positionName: item.positionName,

    lineId: item.lineId,
    lineCode: item.lineCode,
    lineName: item.lineName,
    lineIds: item.lineIds,
    lines: item.lines,
    lineCodes: item.lineCodes,
    lineNames: item.lineNames,
    linesLabel: item.linesLabel,

    shiftId: item.shiftId,
    shiftCode: item.shiftCode,
    shiftName: item.shiftName,
    shiftStartTime: item.shiftStartTime,
    shiftEndTime: item.shiftEndTime,

    reportsToEmployeeId: item.reportsToEmployeeId,
    reportsToEmployeeCode: item.reportsToEmployeeCode,
    reportsToEmployeeName: item.reportsToEmployeeName,

    lineManagerIds: item.lineManagerIds,
    lineManagers: item.lineManagers,
    lineManagerNames: item.lineManagerNames,

    otWorkflowRole: item.otWorkflowRole,
    otWorkflowRoleKey: item.otWorkflowRoleKey,

    phone: item.phone,
    email: item.email,
    isActive: item.isActive,
  }
}

const POSITION_POPULATE_FIELDS =
  'name code reportsToPositionId reportsToPositionCode reportsToPositionName hierarchyScope managerScope'

const SHIFT_POPULATE_FIELDS =
  'code name type startTime breakStartTime breakEndTime endTime crossMidnight'

async function lookup(query = {}, currentUser = null) {
  const scopeFilter = await buildEmployeeLookupScopeFilter(query, currentUser)

  const filter = buildEmployeeListFilter(
    {
      search: query.search,
      departmentId: query.departmentId,
      positionId: query.positionId,
      lineId: query.lineId,
      shiftId: query.shiftId,
      isActive: query.isActive,
    },
    scopeFilter,
  )

  if (query.reportsToEmployeeId && isObjectId(query.reportsToEmployeeId)) {
    filter.reportsToEmployeeId = objectId(query.reportsToEmployeeId)
  }

  const skip = (query.page - 1) * query.limit

  const [items, total] = await Promise.all([
    Employee.find(filter)
      .populate('departmentId', 'name code')
      .populate('positionId', POSITION_POPULATE_FIELDS)
      .populate('lineId', 'code name')
      .populate('lineIds', 'code name')
      .populate('shiftId', SHIFT_POPULATE_FIELDS)
      .populate('reportsToEmployeeId', 'employeeCode displayName')
      .populate('lineManagerIds', 'employeeCode displayName')
      .sort({ displayName: 1, employeeCode: 1, _id: 1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),

    Employee.countDocuments(filter),
  ])

  const totalPages = Math.max(1, Math.ceil(total / query.limit))

  return {
    items: items.map(buildEmployeeLookupItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasMore: query.page < totalPages,
    },
    meta: {
      scope: query.scope,
      count: items.length,
    },
  }
}

async function list(query, currentUser = null) {
  const scopeFilter = await employeeScopeService.buildEmployeeScopeFilter(currentUser)
  const filter = buildEmployeeListFilter(query, scopeFilter)
  const sort = buildEmployeeSort(query.sortBy, query.sortOrder)
  const skip = (query.page - 1) * query.limit

  const [items, total] = await Promise.all([
    Employee.find(filter)
      .populate('departmentId', 'name code')
      .populate('positionId', POSITION_POPULATE_FIELDS)
      .populate('lineId', 'code name')
      .populate('lineIds', 'code name')
      .populate('shiftId', SHIFT_POPULATE_FIELDS)
      .populate('reportsToEmployeeId', 'employeeCode displayName')
      .populate('lineManagerIds', 'employeeCode displayName')
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),

    Employee.countDocuments(filter),
  ])

  const accountByEmployeeId = await loadAccountMapForEmployeeIds(
    items.map((item) => item._id).filter(Boolean),
  )

  return {
    items: items.map((item) =>
      sanitize(item, accountByEmployeeId.get(id(item._id)) || null),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
      hasMore: query.page * query.limit < total,
    },
  }
}

function buildEmployeeExportRows(items = []) {
  return items.map((item, index) => ({
    No: index + 1,
    'Employee Code': item.employeeCode || '',
    'Display Name': item.displayName || '',
    'Department Code': item.departmentCode || '',
    Department: item.departmentName || '',
    'Position Code': item.positionCode || '',
    Position: item.positionName || '',
    'Line Codes': item.lineCodes?.join(',') || item.lineCode || '',
    'Line Names': item.lineNames?.join(', ') || item.lineName || '',
    'Line Managers': item.lineManagerNames || '',
    'Reports To Employee Code': item.reportsToEmployeeCode || '',
    'Reports To Employee Name': item.reportsToEmployeeName || '',
    'OT Workflow Role': item.otWorkflowRole || 'NONE',
    'Shift Code': item.shiftCode || '',
    'Shift Name': item.shiftName || '',
    'Shift Type': item.shiftType || '',
    Phone: item.phone || '',
    Email: item.email || '',
    'Join Date': formatDateDDMMYYYY(item.joinDate),
    Status: item.isActive ? 'Active' : 'Inactive',
    'Has Account': item.hasAccount ? 'Yes' : 'No',
    'Account Login ID': item.accountLoginId || '',
    'Created At': formatDateDDMMYYYY(item.createdAt),
    'Updated At': formatDateDDMMYYYY(item.updatedAt),
  }))
}

async function exportExcel(query = {}, currentUser = null) {
  const scopeFilter = await employeeScopeService.buildEmployeeScopeFilter(currentUser)
  const filter = buildEmployeeListFilter(query, scopeFilter)
  const sort = buildEmployeeSort(query.sortBy, query.sortOrder)

  const [items, accountByEmployeeId] = await Promise.all([
    Employee.find(filter)
      .populate('departmentId', 'name code')
      .populate('positionId', POSITION_POPULATE_FIELDS)
      .populate('lineId', 'code name')
      .populate('lineIds', 'code name')
      .populate('shiftId', SHIFT_POPULATE_FIELDS)
      .populate('reportsToEmployeeId', 'employeeCode displayName')
      .populate('lineManagerIds', 'employeeCode displayName')
      .sort(sort)
      .lean(),

    loadAccountMapForEmployees(),
  ])

  const rows = items.map((item) =>
    sanitize(item, accountByEmployeeId.get(id(item._id)) || null),
  )

  const worksheet = XLSX.utils.json_to_sheet(buildEmployeeExportRows(rows))
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees')

  return {
    filename: `employees-export-${formatDateYYYYMMDD(new Date()) || 'today'}.xlsx`,
    buffer: excelBufferFromWorkbook(workbook),
  }
}

async function downloadImportSample() {
  const sampleRows = [
    {
      'Employee Code': 'TRX001',
      'Display Name': 'Mr A',
      'Department Code': 'SEWING',
      'Position Code': 'SEWER_SUPERVISOR',
      'Line Code': 'LINE-01,LINE-02',
      'Shift Code': 'DAY',
      'Reports To Employee Code': '',
      'OT Workflow Role': 'APPROVER',
      Phone: '012345678',
      Email: 'mra@company.com',
      'Join Date': '30/04/2026',
      Status: 'Active',
      'Create Account': 'Yes',
    },
    {
      'Employee Code': 'TRX002',
      'Display Name': 'Worker 001',
      'Department Code': 'SEWING',
      'Position Code': 'SEWER',
      'Line Code': 'LINE-01',
      'Shift Code': 'DAY',
      'Reports To Employee Code': 'TRX001',
      'OT Workflow Role': 'NONE',
      Phone: '',
      Email: '',
      'Join Date': '30/04/2026',
      Status: 'Active',
      'Create Account': 'No',
    },
  ]

  const guideRows = [
    ['Employee Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    [
      'Employee Code',
      'Required. Human-readable employee code. If it already exists, the row updates that employee. If it does not exist, the row creates a new employee.',
    ],
    ['Display Name', 'Required.'],
    ['Department Code', 'Required. Must already exist in Department master.'],
    ['Position Code', 'Required. Must already exist and belong to Department Code.'],
    [
      'Line Code',
      'Optional. Use one or many line codes separated by comma. Example: LINE-01,LINE-02. First line becomes the primary line.',
    ],
    ['Shift Code', 'Required. Must already exist and be active.'],
    [
      'Reports To Employee Code',
      'Optional. Use employee code of the manager/supervisor. Do not use Mongo ID.',
    ],
    ['OT Workflow Role', 'Use NONE, APPROVER, or ACKNOWLEDGE. Blank = NONE.'],
    [
      'Phone',
      'Optional for normal employee import. Required only when Create Account = Yes because default password = Employee Code + Phone.',
    ],
    ['Email', 'Optional. Must be unique if provided.'],
    ['Join Date', 'Optional. Use DD/MM/YYYY format.'],
    ['Status', 'Use Active or Inactive. Blank = Active.'],
    [
      'Create Account',
      'Optional. Use Yes/No. Blank = No. If Yes, backend creates login account only when the employee does not already have one. Existing accounts are not reset.',
    ],
    [
      'Account Strategy',
      'For large imports, set Create Account = Yes only for employees who need login access. Example: 1,700 employees imported, but only 100 accounts created.',
    ],
  ]

  const workbook = XLSX.utils.book_new()
  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return {
    filename: 'employee-import-sample.xlsx',
    buffer: excelBufferFromWorkbook(workbook),
  }
}

function normalizeImportOTWorkflowRole(value) {
  const raw = s(value)

  if (!raw) return 'NONE'

  const role = upper(raw)

  if (['NONE', 'APPROVER', 'ACKNOWLEDGE'].includes(role)) return role

  return 'INVALID_ROLE'
}

function isValidImportEmail(value) {
  const email = s(value).toLowerCase()

  if (!email) return true

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function makeImportError({
  rowNo,
  field,
  value = '',
  code,
  messageKey,
  reason,
  params = {},
}) {
  return {
    rowNo,
    row: rowNo,
    field,
    value: s(value),
    code,
    messageKey,
    reason,
    message: reason,
    params: {
      rowNo,
      field,
      value: s(value),
      ...params,
    },
  }
}

function addImportError(errors, error) {
  errors.push(makeImportError(error))
}

function throwImportValidationError(errors) {
  if (!errors.length) return

  throw appError({
    statusCode: 400,
    code: 'EMPLOYEE_IMPORT_VALIDATION_FAILED',
    messageKey: 'org.employee.import.error.validationFailed',
    message: `Import failed. ${errors.length} problem${errors.length > 1 ? 's' : ''} found. Please fix all errors and try again.`,
    params: {
      errorCount: errors.length,
      errors,
    },
  })
}

function normalizeImportRow(raw = {}, index = 0) {
  const rowNo = index + 2

  const rawEmployeeCode = getImportField(raw, [
    'Employee Code',
    'employeeCode',
    'EmployeeCode',
  ])
  const rawDisplayName = getImportField(raw, ['Display Name', 'displayName', 'Name'])
  const rawDepartmentCode = getImportField(raw, [
    'Department Code',
    'departmentCode',
  ])
  const rawPositionCode = getImportField(raw, ['Position Code', 'positionCode'])
  const rawLineCode = getImportField(raw, ['Line Code', 'lineCode'])
  const rawShiftCode = getImportField(raw, ['Shift Code', 'shiftCode'])
  const rawReportsToEmployeeCode = getImportField(raw, [
    'Reports To Employee Code',
    'reportsToEmployeeCode',
    'ReportsToEmployeeCode',
  ])
  const rawOTWorkflowRole = getImportField(raw, [
    'OT Workflow Role',
    'otWorkflowRole',
  ])
  const rawPhone = getImportField(raw, ['Phone', 'phone'])
  const rawEmail = getImportField(raw, ['Email', 'email'])
  const rawJoinDate = getImportField(raw, ['joinDate', 'Join Date', 'JOIN DATE'])
  const rawStatus = getImportField(raw, ['isActive', 'Status', 'STATUS'])
  const rawCreateAccount = getImportField(raw, [
    'Create Account',
    'createAccount',
    'Account',
    'CREATE ACCOUNT',
  ])

  const joinDate = parseImportDate(rawJoinDate)
  const lineCodes = splitImportCodes(rawLineCode)

  const isBlankRow = [
    rawEmployeeCode,
    rawDisplayName,
    rawDepartmentCode,
    rawPositionCode,
    rawLineCode,
    rawShiftCode,
    rawReportsToEmployeeCode,
    rawOTWorkflowRole,
    rawPhone,
    rawEmail,
    rawJoinDate,
    rawStatus,
    rawCreateAccount,
  ].every((value) => !s(value))

  if (isBlankRow) return null

  return {
    rowNo,

    rawEmployeeCode,
    rawDisplayName,
    rawDepartmentCode,
    rawPositionCode,
    rawLineCode,
    rawShiftCode,
    rawReportsToEmployeeCode,
    rawOTWorkflowRole,
    rawPhone,
    rawEmail,
    rawJoinDate,
    rawStatus,
    rawCreateAccount,

    employeeCode: upper(rawEmployeeCode),
    displayName: s(rawDisplayName),
    departmentCode: upper(rawDepartmentCode),
    positionCode: upper(rawPositionCode),
    lineCode: lineCodes[0] || '',
    lineCodes,
    shiftCode: upper(rawShiftCode),
    reportsToEmployeeCode: upper(rawReportsToEmployeeCode),
    otWorkflowRole: normalizeImportOTWorkflowRole(rawOTWorkflowRole),
    phone: s(rawPhone),
    email: s(rawEmail).toLowerCase(),
    joinDate,
    isActive: normalizeImportStatus(rawStatus),
    createAccount: normalizeImportCreateAccount(rawCreateAccount),
  }
}

function validateBasicEmployeeImportRows(normalizedRows = []) {
  const errors = []
  const seenEmployeeCodes = new Map()
  const seenEmails = new Map()
  const candidateRows = []

  for (const row of normalizedRows) {
    let hasRowError = false

    if (!row.employeeCode) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Employee Code',
        value: row.rawEmployeeCode,
        code: 'EMPLOYEE_IMPORT_EMPLOYEE_CODE_REQUIRED',
        messageKey: 'org.employee.import.error.employeeCodeRequired',
        reason: `Row ${row.rowNo}: Employee Code is required.`,
      })
    } else if (row.employeeCode.length > 50) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Employee Code',
        value: row.rawEmployeeCode,
        code: 'EMPLOYEE_IMPORT_EMPLOYEE_CODE_TOO_LONG',
        messageKey: 'org.employee.import.error.employeeCodeTooLong',
        reason: `Row ${row.rowNo}: Employee Code must not be longer than 50 characters.`,
      })
    }

    if (!row.displayName) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Display Name',
        value: row.rawDisplayName,
        code: 'EMPLOYEE_IMPORT_DISPLAY_NAME_REQUIRED',
        messageKey: 'org.employee.import.error.displayNameRequired',
        reason: `Row ${row.rowNo}: Display Name is required.`,
      })
    } else if (row.displayName.length > 150) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Display Name',
        value: row.rawDisplayName,
        code: 'EMPLOYEE_IMPORT_DISPLAY_NAME_TOO_LONG',
        messageKey: 'org.employee.import.error.displayNameTooLong',
        reason: `Row ${row.rowNo}: Display Name must not be longer than 150 characters.`,
      })
    }

    if (!row.departmentCode) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Code',
        value: row.rawDepartmentCode,
        code: 'EMPLOYEE_IMPORT_DEPARTMENT_CODE_REQUIRED',
        messageKey: 'org.employee.import.error.departmentCodeRequired',
        reason: `Row ${row.rowNo}: Department Code is required.`,
      })
    } else if (row.departmentCode.length > 50) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Code',
        value: row.rawDepartmentCode,
        code: 'EMPLOYEE_IMPORT_DEPARTMENT_CODE_TOO_LONG',
        messageKey: 'org.employee.import.error.departmentCodeTooLong',
        reason: `Row ${row.rowNo}: Department Code must not be longer than 50 characters.`,
      })
    }

    if (!row.positionCode) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Code',
        value: row.rawPositionCode,
        code: 'EMPLOYEE_IMPORT_POSITION_CODE_REQUIRED',
        messageKey: 'org.employee.import.error.positionCodeRequired',
        reason: `Row ${row.rowNo}: Position Code is required.`,
      })
    } else if (row.positionCode.length > 50) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Code',
        value: row.rawPositionCode,
        code: 'EMPLOYEE_IMPORT_POSITION_CODE_TOO_LONG',
        messageKey: 'org.employee.import.error.positionCodeTooLong',
        reason: `Row ${row.rowNo}: Position Code must not be longer than 50 characters.`,
      })
    }

    const tooLongLineCodes = (row.lineCodes || []).filter(
      (lineCode) => lineCode.length > 50,
    )

    if (tooLongLineCodes.length) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Line Code',
        value: row.rawLineCode,
        code: 'EMPLOYEE_IMPORT_LINE_CODE_TOO_LONG',
        messageKey: 'org.employee.import.error.lineCodeTooLong',
        reason: `Row ${row.rowNo}: Line Code must not be longer than 50 characters: ${tooLongLineCodes.join(', ')}.`,
        params: {
          lineCodes: tooLongLineCodes,
        },
      })
    }

    if (!row.shiftCode) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Shift Code',
        value: row.rawShiftCode,
        code: 'EMPLOYEE_IMPORT_SHIFT_CODE_REQUIRED',
        messageKey: 'org.employee.import.error.shiftCodeRequired',
        reason: `Row ${row.rowNo}: Shift Code is required.`,
      })
    } else if (row.shiftCode.length > 50) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Shift Code',
        value: row.rawShiftCode,
        code: 'EMPLOYEE_IMPORT_SHIFT_CODE_TOO_LONG',
        messageKey: 'org.employee.import.error.shiftCodeTooLong',
        reason: `Row ${row.rowNo}: Shift Code must not be longer than 50 characters.`,
      })
    }

    if (row.reportsToEmployeeCode.length > 50) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Reports To Employee Code',
        value: row.rawReportsToEmployeeCode,
        code: 'EMPLOYEE_IMPORT_MANAGER_CODE_TOO_LONG',
        messageKey: 'org.employee.import.error.managerCodeTooLong',
        reason: `Row ${row.rowNo}: Reports To Employee Code must not be longer than 50 characters.`,
      })
    }

    if (row.reportsToEmployeeCode && row.reportsToEmployeeCode === row.employeeCode) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Reports To Employee Code',
        value: row.rawReportsToEmployeeCode,
        code: 'EMPLOYEE_IMPORT_REPORT_TO_SELF',
        messageKey: 'org.employee.import.error.reportToSelf',
        reason: `Row ${row.rowNo}: Employee cannot report to self.`,
      })
    }

    if (row.otWorkflowRole === 'INVALID_ROLE') {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'OT Workflow Role',
        value: row.rawOTWorkflowRole,
        code: 'EMPLOYEE_IMPORT_INVALID_OT_WORKFLOW_ROLE',
        messageKey: 'org.employee.import.error.invalidOTWorkflowRole',
        reason: `Row ${row.rowNo}: OT Workflow Role must be NONE, APPROVER, or ACKNOWLEDGE.`,
      })
    }

    if (row.phone.length > 30) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Phone',
        value: row.rawPhone,
        code: 'EMPLOYEE_IMPORT_PHONE_TOO_LONG',
        messageKey: 'org.employee.import.error.phoneTooLong',
        reason: `Row ${row.rowNo}: Phone must not be longer than 30 characters.`,
      })
    }

    if (row.email.length > 150) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Email',
        value: row.rawEmail,
        code: 'EMPLOYEE_IMPORT_EMAIL_TOO_LONG',
        messageKey: 'org.employee.import.error.emailTooLong',
        reason: `Row ${row.rowNo}: Email must not be longer than 150 characters.`,
      })
    } else if (row.email && !isValidImportEmail(row.email)) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Email',
        value: row.rawEmail,
        code: 'EMPLOYEE_IMPORT_EMAIL_INVALID',
        messageKey: 'org.employee.import.error.emailInvalid',
        reason: `Row ${row.rowNo}: Email format is invalid.`,
      })
    }

    if (row.rawJoinDate && row.joinDate === 'INVALID_DATE') {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Join Date',
        value: row.rawJoinDate,
        code: 'EMPLOYEE_IMPORT_INVALID_JOIN_DATE',
        messageKey: 'org.employee.import.error.invalidJoinDate',
        reason: `Row ${row.rowNo}: Join Date must use DD/MM/YYYY or YYYY-MM-DD format.`,
      })
    }

    if (row.rawStatus && row.isActive === 'INVALID_BOOLEAN') {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Status',
        value: row.rawStatus,
        code: 'EMPLOYEE_IMPORT_INVALID_STATUS',
        messageKey: 'org.employee.import.error.invalidStatus',
        reason: `Row ${row.rowNo}: Status must be Active or Inactive.`,
      })
    }

    if (row.rawCreateAccount && row.createAccount === 'INVALID_CREATE_ACCOUNT') {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Create Account',
        value: row.rawCreateAccount,
        code: 'EMPLOYEE_IMPORT_INVALID_CREATE_ACCOUNT',
        messageKey: 'org.employee.import.error.invalidCreateAccount',
        reason: `Row ${row.rowNo}: Create Account must be Yes or No. Blank = No.`,
      })
    }

    if (row.employeeCode) {
      const firstRowNo = seenEmployeeCodes.get(row.employeeCode)

      if (firstRowNo) {
        hasRowError = true
        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Employee Code',
          value: row.rawEmployeeCode,
          code: 'EMPLOYEE_IMPORT_DUPLICATE_EMPLOYEE_CODE',
          messageKey: 'org.employee.import.error.duplicateEmployeeCode',
          reason: `Row ${row.rowNo}: Duplicate Employee Code "${row.employeeCode}" in Excel file. First found at row ${firstRowNo}.`,
          params: {
            employeeCode: row.employeeCode,
            firstRowNo,
          },
        })
      } else {
        seenEmployeeCodes.set(row.employeeCode, row.rowNo)
      }
    }

    if (row.email) {
      const firstRowNo = seenEmails.get(row.email)

      if (firstRowNo) {
        hasRowError = true
        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Email',
          value: row.rawEmail,
          code: 'EMPLOYEE_IMPORT_DUPLICATE_EMAIL',
          messageKey: 'org.employee.import.error.duplicateEmail',
          reason: `Row ${row.rowNo}: Duplicate Email "${row.email}" in Excel file. First found at row ${firstRowNo}.`,
          params: {
            email: row.email,
            firstRowNo,
          },
        })
      } else {
        seenEmails.set(row.email, row.rowNo)
      }
    }

    if (!hasRowError) {
      candidateRows.push(row)
    }
  }

  return {
    errors,
    candidateRows,
  }
}

async function validateEmployeeImportRows(normalizedRows = [], progressOptions = {}) {
  const { errors, candidateRows } = validateBasicEmployeeImportRows(normalizedRows)

  emitImportProgress(progressOptions, {
    phase: 'VALIDATE_BASIC',
    percent: 16,
    totalRows: normalizedRows.length,
    processedRows: candidateRows.length,
    messageKey: 'org.employee.importProgress.validateBasic',
    message: 'Checking required fields and duplicate rows...',
    completedPhases: ['UPLOAD', 'READ_FILE', 'PARSE_ROWS'],
  })

  const employeeCodes = [
    ...new Set(
      candidateRows
        .flatMap((row) => [row.employeeCode, row.reportsToEmployeeCode])
        .map(upper)
        .filter(Boolean),
    ),
  ]

  const candidateEmployeeCodeSet = new Set(
    candidateRows.map((row) => row.employeeCode).filter(Boolean),
  )

  const emails = [...new Set(candidateRows.map((row) => row.email).filter(Boolean))]
  const departmentCodes = [
    ...new Set(candidateRows.map((row) => row.departmentCode).filter(Boolean)),
  ]
  const positionCodes = [
    ...new Set(candidateRows.map((row) => row.positionCode).filter(Boolean)),
  ]
  const lineCodes = [
    ...new Set(candidateRows.flatMap((row) => row.lineCodes || []).filter(Boolean)),
  ]
  const shiftCodes = [
    ...new Set(candidateRows.map((row) => row.shiftCode).filter(Boolean)),
  ]
  const importLoginIds = [
    ...new Set(
      candidateRows
        .filter((row) => row.createAccount === true)
        .map((row) => buildImportAccountLoginId(row.employeeCode))
        .filter(Boolean),
    ),
  ]

  emitImportProgress(progressOptions, {
    phase: 'MATCH_DEPARTMENT',
    percent: 24,
    totalRows: candidateRows.length,
    messageKey: 'org.employee.importProgress.matchDepartment',
    message: 'Matching department codes...',
    completedPhases: ['VALIDATE_BASIC'],
  })

  const departments = departmentCodes.length
    ? await Department.find(
        { code: { $in: departmentCodes } },
        '_id code name isActive',
      ).lean()
    : []

  emitImportProgress(progressOptions, {
    phase: 'MATCH_POSITION',
    percent: 34,
    totalRows: candidateRows.length,
    messageKey: 'org.employee.importProgress.matchPosition',
    message: 'Matching position codes...',
    completedPhases: ['MATCH_DEPARTMENT'],
  })

  const positions = positionCodes.length
    ? await Position.find(
        { code: { $in: positionCodes } },
        '_id code name departmentId reportsToPositionId reportsToPositionCode reportsToPositionName hierarchyScope managerScope isActive',
      ).lean()
    : []

  emitImportProgress(progressOptions, {
    phase: 'MATCH_LINE',
    percent: 44,
    totalRows: candidateRows.length,
    messageKey: 'org.employee.importProgress.matchLine',
    message: 'Matching production line codes...',
    completedPhases: ['MATCH_POSITION'],
  })

  const lines = lineCodes.length
    ? await ProductionLine.find(
        { code: { $in: lineCodes } },
        '_id code name departmentId departmentIds positionIds isActive',
      ).lean()
    : []

  emitImportProgress(progressOptions, {
    phase: 'MATCH_SHIFT',
    percent: 54,
    totalRows: candidateRows.length,
    messageKey: 'org.employee.importProgress.matchShift',
    message: 'Matching shift codes...',
    completedPhases: ['MATCH_LINE'],
  })

  const shifts = shiftCodes.length
    ? await Shift.find(
        {
          code: { $in: shiftCodes },
          isActive: true,
        },
        '_id code name type startTime endTime breakStartTime breakEndTime crossMidnight isActive',
      ).lean()
    : []

  emitImportProgress(progressOptions, {
    phase: 'MATCH_EMPLOYEE',
    percent: 62,
    totalRows: candidateRows.length,
    messageKey: 'org.employee.importProgress.matchEmployee',
    message: 'Checking existing employees and manager codes...',
    completedPhases: ['MATCH_SHIFT'],
  })

  const [existingEmployees, existingEmailOwners] = await Promise.all([
    employeeCodes.length
      ? Employee.find(
          { employeeCode: { $in: employeeCodes } },
          '_id employeeCode displayName email departmentId positionId lineId lineIds shiftId reportsToEmployeeId lineManagerIds otWorkflowRole isActive',
        ).lean()
      : [],

    emails.length
      ? Employee.find(
          { email: { $in: emails } },
          '_id employeeCode email',
        ).lean()
      : [],
  ])

  const existingEmployeeIds = existingEmployees.map((item) => item._id).filter(Boolean)
  const accountOr = []

  if (importLoginIds.length) {
    accountOr.push({
      loginId: {
        $in: importLoginIds,
      },
    })
  }

  if (existingEmployeeIds.length) {
    accountOr.push({
      employeeId: {
        $in: existingEmployeeIds,
      },
    })
  }

  emitImportProgress(progressOptions, {
    phase: 'MATCH_ACCOUNT',
    percent: 66,
    totalRows: candidateRows.length,
    messageKey: 'org.employee.importProgress.matchAccount',
    message: 'Checking employee login accounts...',
    completedPhases: ['MATCH_EMPLOYEE'],
  })

  const existingAccounts = accountOr.length
    ? await Account.find(
        {
          $or: accountOr,
        },
        '_id loginId employeeId isActive',
      ).lean()
    : []

  const departmentByCode = new Map(
    departments.map((item) => [upper(item.code), item]),
  )
  const positionByCode = new Map(positions.map((item) => [upper(item.code), item]))
  const lineByCode = new Map(lines.map((item) => [upper(item.code), item]))
  const shiftByCode = new Map(shifts.map((item) => [upper(item.code), item]))
  const employeeByCode = new Map(
    existingEmployees.map((item) => [upper(item.employeeCode), item]),
  )
  const emailOwnerByEmail = new Map(
    existingEmailOwners.map((item) => [s(item.email).toLowerCase(), item]),
  )
  const accountByEmployeeId = new Map(
    existingAccounts
      .filter((item) => item.employeeId)
      .map((item) => [id(item.employeeId), item]),
  )
  const accountByLoginId = new Map(
    existingAccounts
      .filter((item) => item.loginId)
      .map((item) => [s(item.loginId).toLowerCase(), item]),
  )

  const validRows = []

  for (let rowIndex = 0; rowIndex < candidateRows.length; rowIndex += 1) {
    const row = candidateRows[rowIndex]

    if (rowIndex % 100 === 0 || rowIndex === candidateRows.length - 1) {
      const percent = 68 + Math.round(((rowIndex + 1) / candidateRows.length) * 7)

      emitImportProgress(progressOptions, {
        phase: 'VALIDATE_RELATION',
        percent,
        totalRows: candidateRows.length,
        processedRows: rowIndex + 1,
        messageKey: 'org.employee.importProgress.validateRelation',
        message: 'Validating department, position, line, shift, manager, and account rules...',
        completedPhases: ['MATCH_ACCOUNT'],
      })
    }

    let hasRowError = false
    const existing = employeeByCode.get(row.employeeCode) || null

    const department = departmentByCode.get(row.departmentCode)

    if (!department) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Code',
        value: row.rawDepartmentCode,
        code: 'EMPLOYEE_IMPORT_DEPARTMENT_NOT_FOUND',
        messageKey: 'org.employee.import.error.departmentNotFound',
        reason: `Row ${row.rowNo}: Department Code "${row.departmentCode}" was not found.`,
        params: {
          departmentCode: row.departmentCode,
        },
      })
    }

    const position = positionByCode.get(row.positionCode)

    if (!position) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Code',
        value: row.rawPositionCode,
        code: 'EMPLOYEE_IMPORT_POSITION_NOT_FOUND',
        messageKey: 'org.employee.import.error.positionNotFound',
        reason: `Row ${row.rowNo}: Position Code "${row.positionCode}" was not found.`,
        params: {
          positionCode: row.positionCode,
        },
      })
    }

    if (department && position && !sameId(position.departmentId, department._id)) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Code',
        value: row.rawPositionCode,
        code: 'EMPLOYEE_IMPORT_POSITION_DEPARTMENT_MISMATCH',
        messageKey: 'org.employee.import.error.positionDepartmentMismatch',
        reason: `Row ${row.rowNo}: Position Code "${row.positionCode}" does not belong to Department Code "${row.departmentCode}".`,
        params: {
          departmentCode: row.departmentCode,
          positionCode: row.positionCode,
        },
      })
    }

    const selectedLines = []
    const missingLineCodes = []
    const inactiveLineCodes = []
    const departmentMismatchLineCodes = []
    const positionNotAllowedLineCodes = []

    ;(row.lineCodes || []).forEach((lineCode) => {
      const line = lineByCode.get(lineCode)

      if (!line) {
        missingLineCodes.push(lineCode)
        return
      }

      selectedLines.push(line)

      if (line.isActive === false) {
        inactiveLineCodes.push(lineCode)
      }

      const allowedDepartmentIds = uniqueIds([
        ...(Array.isArray(line.departmentIds) ? line.departmentIds : []),
        line.departmentId,
      ])

      if (
        department &&
        allowedDepartmentIds.length &&
        !allowedDepartmentIds.includes(id(department._id))
      ) {
        departmentMismatchLineCodes.push(lineCode)
      }

      const allowedPositionIds = uniqueIds(line.positionIds || [])

      if (
        position &&
        allowedPositionIds.length &&
        !allowedPositionIds.includes(id(position._id))
      ) {
        positionNotAllowedLineCodes.push(lineCode)
      }
    })

    if (missingLineCodes.length) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Line Code',
        value: row.rawLineCode,
        code: 'EMPLOYEE_IMPORT_LINE_NOT_FOUND',
        messageKey: 'org.employee.import.error.lineNotFound',
        reason: `Row ${row.rowNo}: Line Code not found: ${missingLineCodes.join(', ')}.`,
        params: {
          lineCodes: missingLineCodes,
        },
      })
    }

    if (inactiveLineCodes.length) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Line Code',
        value: row.rawLineCode,
        code: 'EMPLOYEE_IMPORT_LINE_INACTIVE',
        messageKey: 'org.employee.import.error.lineInactive',
        reason: `Row ${row.rowNo}: Inactive Line Code(s): ${inactiveLineCodes.join(', ')}.`,
        params: {
          lineCodes: inactiveLineCodes,
        },
      })
    }

    if (departmentMismatchLineCodes.length) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Line Code',
        value: row.rawLineCode,
        code: 'EMPLOYEE_IMPORT_LINE_DEPARTMENT_MISMATCH',
        messageKey: 'org.employee.import.error.lineDepartmentMismatch',
        reason: `Row ${row.rowNo}: These Line Code(s) do not support Department Code "${row.departmentCode}": ${departmentMismatchLineCodes.join(', ')}.`,
        params: {
          departmentCode: row.departmentCode,
          lineCodes: departmentMismatchLineCodes,
        },
      })
    }

    if (positionNotAllowedLineCodes.length) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Line Code',
        value: row.rawLineCode,
        code: 'EMPLOYEE_IMPORT_LINE_POSITION_NOT_ALLOWED',
        messageKey: 'org.employee.import.error.linePositionNotAllowed',
        reason: `Row ${row.rowNo}: These Line Code(s) do not allow Position Code "${row.positionCode}": ${positionNotAllowedLineCodes.join(', ')}.`,
        params: {
          lineCodes: positionNotAllowedLineCodes,
          positionCode: row.positionCode,
        },
      })
    }

    const shift = shiftByCode.get(row.shiftCode)

    if (!shift) {
      hasRowError = true
      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Shift Code',
        value: row.rawShiftCode,
        code: 'EMPLOYEE_IMPORT_SHIFT_NOT_FOUND',
        messageKey: 'org.employee.import.error.shiftNotFound',
        reason: `Row ${row.rowNo}: Shift Code "${row.shiftCode}" was not found or is inactive.`,
        params: {
          shiftCode: row.shiftCode,
        },
      })
    }

    if (row.reportsToEmployeeCode) {
      const managerExists =
        employeeByCode.has(row.reportsToEmployeeCode) ||
        candidateEmployeeCodeSet.has(row.reportsToEmployeeCode)

      if (!managerExists) {
        hasRowError = true
        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Reports To Employee Code',
          value: row.rawReportsToEmployeeCode,
          code: 'EMPLOYEE_IMPORT_MANAGER_NOT_FOUND',
          messageKey: 'org.employee.import.error.managerNotFound',
          reason: `Row ${row.rowNo}: Reports To Employee Code "${row.reportsToEmployeeCode}" was not found in Employee master or this import file.`,
          params: {
            reportsToEmployeeCode: row.reportsToEmployeeCode,
          },
        })
      }
    }

    if (row.email) {
      const owner = emailOwnerByEmail.get(row.email)

      if (owner && !sameId(owner._id, existing?._id)) {
        hasRowError = true
        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Email',
          value: row.rawEmail,
          code: 'EMPLOYEE_IMPORT_EMAIL_EXISTS',
          messageKey: 'org.employee.import.error.emailExists',
          reason: `Row ${row.rowNo}: Email "${row.email}" already belongs to Employee Code "${owner.employeeCode}".`,
          params: {
            email: row.email,
            ownerEmployeeCode: owner.employeeCode,
          },
        })
      }
    }

    const existingAccount = existing
      ? accountByEmployeeId.get(id(existing._id))
      : null

    const wantsCreateAccount = row.createAccount === true
    const shouldCreateAccount = wantsCreateAccount && !existingAccount
    const accountLoginId = buildImportAccountLoginId(row.employeeCode)
    const accountPassword = buildImportAccountPassword(row)
    const cleanPhone = normalizePhoneForPassword(row.phone)

    if (shouldCreateAccount) {
      if (!cleanPhone) {
        hasRowError = true
        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Phone',
          value: row.rawPhone,
          code: 'EMPLOYEE_IMPORT_PHONE_REQUIRED_FOR_ACCOUNT',
          messageKey: 'org.employee.import.error.phoneRequiredForAccount',
          reason: `Row ${row.rowNo}: Phone is required because Create Account = Yes. Default password = Employee Code + Phone.`,
          params: {
            employeeCode: row.employeeCode,
          },
        })
      }

      if (!isPasswordLengthValid(accountPassword)) {
        hasRowError = true
        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Phone',
          value: row.rawPhone,
          code: 'EMPLOYEE_IMPORT_DEFAULT_PASSWORD_INVALID',
          messageKey: 'org.employee.import.error.defaultPasswordInvalid',
          reason: `Row ${row.rowNo}: Default password must be 6 to 100 characters. It is generated from Employee Code + Phone.`,
          params: {
            employeeCode: row.employeeCode,
          },
        })
      }

      const loginOwner = accountByLoginId.get(accountLoginId)

      if (loginOwner) {
        hasRowError = true
        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Employee Code',
          value: row.rawEmployeeCode,
          code: 'EMPLOYEE_IMPORT_ACCOUNT_LOGIN_ID_EXISTS',
          messageKey: 'org.employee.import.error.accountLoginIdExists',
          reason: `Row ${row.rowNo}: Account Login ID "${accountLoginId}" already exists.`,
          params: {
            loginId: accountLoginId,
          },
        })
      }
    }

    if (!hasRowError) {
      validRows.push({
        ...row,
        existing,
        department,
        position,
        line: selectedLines[0] || null,
        lines: selectedLines,
        lineIds: uniqueIds(selectedLines.map((line) => line._id)),
        shift,
        shouldCreateAccount,
        accountLoginId,
        accountPassword,
      })
    }
  }

  throwImportValidationError(errors)

  return {
    validRows,
  }
}

function sortManagerCandidates(items = []) {
  return [...items].sort((a, b) =>
    `${a.employeeCode || ''} ${a.displayName || ''} ${a._id || ''}`.localeCompare(
      `${b.employeeCode || ''} ${b.displayName || ''} ${b._id || ''}`,
    ),
  )
}

function resolveImportManagerIds({
  row,
  employeeDoc,
  position,
  department,
  line,
  lines = [],
  allEmployees = [],
  employeeByCode = new Map(),
}) {
  if (!employeeDoc) {
    return {
      primaryManagerId: null,
      lineManagerIds: [],
    }
  }

  const employeeId = id(employeeDoc._id)
  const parentPositionId = id(position?.reportsToPositionId)
  const hierarchyScope = getPositionHierarchyScope(position)
  const targetLineIds = uniqueIds([
    ...(Array.isArray(lines) ? lines.map((item) => item?._id || item) : []),
    line?._id || line,
    ...(row?.lineIds || []),
  ])

  let autoManagers = []

  if (parentPositionId) {
    autoManagers = allEmployees.filter((item) => {
      if (!item?.isActive) return false
      if (sameId(item._id, employeeId)) return false
      if (!sameId(item.positionId, parentPositionId)) return false

      if (hierarchyScope === 'SAME_LINE') {
        if (!targetLineIds.length) return false

        return targetLineIds.some((lineId) => employeeLineIds(item).includes(lineId))
      }

      if (hierarchyScope === 'GLOBAL') {
        return sameId(item.departmentId, department?._id)
      }

      if (hierarchyScope === 'CROSS_DEPARTMENT') {
        return true
      }

      return false
    })
  }

  const sortedAutoManagers = sortManagerCandidates(autoManagers)

  if (sortedAutoManagers.length) {
    const lineManagerIds = uniqueIds(sortedAutoManagers.map((item) => item._id))

    return {
      primaryManagerId: lineManagerIds[0] || null,
      lineManagerIds,
    }
  }

  if (row.reportsToEmployeeCode) {
    const manualManager = employeeByCode.get(row.reportsToEmployeeCode)

    if (manualManager && !sameId(manualManager._id, employeeId)) {
      return {
        primaryManagerId: manualManager._id,
        lineManagerIds: [manualManager._id],
      }
    }
  }

  return {
    primaryManagerId: null,
    lineManagerIds: [],
  }
}

async function importExcel(file, currentUser = null, options = {}) {
  if (!file?.buffer) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_EXCEL_FILE_REQUIRED',
      messageKey: 'org.employee.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  if (options.progressJobId) {
    startImportProgress(options.progressJobId, {
      status: 'RUNNING',
      phase: 'READ_FILE',
      percent: 2,
      messageKey: 'org.employee.importProgress.readFile',
      message: 'Reading Excel file...',
    })
  }

  const workbook = XLSX.read(file.buffer, {
    type: 'buffer',
    cellDates: true,
  })

  emitImportProgress(options, {
    phase: 'PARSE_ROWS',
    percent: 8,
    messageKey: 'org.employee.importProgress.parseRows',
    message: 'Reading worksheet rows...',
    completedPhases: ['READ_FILE'],
  })

  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_EXCEL_WORKSHEET_REQUIRED',
      messageKey: 'org.employee.error.excelWorksheetRequired',
      message: 'Excel file has no worksheet',
    })
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
    dateNF: 'dd/mm/yyyy',
  })

  if (!rawRows.length) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_EXCEL_NO_ROWS',
      messageKey: 'org.employee.error.excelNoRows',
      message: 'Excel file has no data rows',
    })
  }

  const normalizedRows = rawRows
    .map((raw, index) => normalizeImportRow(raw, index))
    .filter(Boolean)

  if (!normalizedRows.length) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_EXCEL_NO_VALID_ROWS',
      messageKey: 'org.employee.error.excelNoValidRows',
      message: 'Excel file has no valid rows',
    })
  }

  emitImportProgress(options, {
    phase: 'VALIDATE_BASIC',
    percent: 12,
    totalRows: normalizedRows.length,
    processedRows: 0,
    messageKey: 'org.employee.importProgress.validateBasic',
    message: 'Preparing employee rows for validation...',
    completedPhases: ['PARSE_ROWS'],
  })

  const { validRows } = await validateEmployeeImportRows(normalizedRows, options)
  const session = await mongoose.startSession()

  let summary = {
    totalRows: validRows.length,
    created: 0,
    updated: 0,
    accountsCreated: 0,
  }

  let createdEmployeeIds = []

  emitImportProgress(options, {
    phase: 'IMPORT_EMPLOYEE',
    percent: 76,
    totalRows: validRows.length,
    processedRows: 0,
    messageKey: 'org.employee.importProgress.startImport',
    message: 'All master data matched. Starting employee import...',
    completedPhases: ['VALIDATE_RELATION'],
  })

  try {
    await session.withTransaction(async () => {
      const employeeCodes = validRows.map((row) => row.employeeCode)

      const existingEmployees = await Employee.find({
        employeeCode: {
          $in: employeeCodes,
        },
      })
        .select('_id employeeCode')
        .session(session)
        .lean()

      const existingCodeSet = new Set(
        existingEmployees.map((item) => upper(item.employeeCode)),
      )

      const created = validRows.filter(
        (row) => !existingCodeSet.has(row.employeeCode),
      ).length
      const updated = validRows.length - created

      const baseOperations = validRows.map((row) => ({
        updateOne: {
          filter: {
            employeeCode: row.employeeCode,
          },
          update: {
            $set: {
              employeeCode: row.employeeCode,
              displayName: row.displayName,
              departmentId: row.department._id,
              positionId: row.position._id,
              lineId: row.lineIds?.[0] || null,
              lineIds: row.lineIds || [],
              shiftId: row.shift._id,
              otWorkflowRole: normalizeOTWorkflowRole(row.otWorkflowRole),
              phone: row.phone || '',
              email: row.email || '',
              joinDate: row.joinDate || null,
              isActive: typeof row.isActive === 'boolean' ? row.isActive : true,
            },
          },
          upsert: true,
        },
      }))

      await bulkWriteInChunks(Employee, baseOperations, {
        ordered: true,
        session,
        chunkSize: 500,
        onProgress({ processed, total }) {
          const percent = 78 + Math.round((processed / Math.max(total, 1)) * 8)

          emitImportProgress(options, {
            phase: 'IMPORT_EMPLOYEE',
            percent,
            totalRows: validRows.length,
            processedRows: processed,
            messageKey: 'org.employee.importProgress.importEmployee',
            message: `Importing employees ${processed}/${total}...`,
          })
        },
      })

      const allEmployees = await Employee.find(
        {},
        '_id employeeCode displayName departmentId positionId lineId lineIds reportsToEmployeeId lineManagerIds isActive',
      )
        .session(session)
        .lean()

      const employeeByCode = new Map(
        allEmployees.map((item) => [upper(item.employeeCode), item]),
      )

      const managerOperations = validRows
        .map((row) => {
          const employeeDoc = employeeByCode.get(row.employeeCode)

          if (!employeeDoc) return null

          const managerResult = resolveImportManagerIds({
            row,
            employeeDoc,
            position: row.position,
            department: row.department,
            line: row.line,
            lines: row.lines || [],
            allEmployees,
            employeeByCode,
          })

          return {
            updateOne: {
              filter: {
                _id: employeeDoc._id,
              },
              update: {
                $set: {
                  reportsToEmployeeId: managerResult.primaryManagerId || null,
                  lineManagerIds: managerResult.lineManagerIds || [],
                },
              },
            },
          }
        })
        .filter(Boolean)

      if (managerOperations.length) {
        await bulkWriteInChunks(Employee, managerOperations, {
          ordered: true,
          session,
          chunkSize: 500,
          onProgress({ processed, total }) {
            const percent = 86 + Math.round((processed / Math.max(total, 1)) * 5)

            emitImportProgress(options, {
              phase: 'RESOLVE_MANAGER',
              percent,
              totalRows: validRows.length,
              processedRows: processed,
              messageKey: 'org.employee.importProgress.resolveManager',
              message: `Resolving managers ${processed}/${total}...`,
              completedPhases: ['IMPORT_EMPLOYEE'],
            })
          },
        })
      } else {
        emitImportProgress(options, {
          phase: 'RESOLVE_MANAGER',
          percent: 91,
          totalRows: validRows.length,
          processedRows: validRows.length,
          messageKey: 'org.employee.importProgress.resolveManager',
          message: 'No manager changes needed.',
          completedPhases: ['IMPORT_EMPLOYEE'],
        })
      }

      const importedEmployees = await Employee.find({
        employeeCode: {
          $in: employeeCodes,
        },
      })
        .select('_id employeeCode displayName')
        .session(session)
        .lean()

      const importedEmployeeByCode = new Map(
        importedEmployees.map((item) => [upper(item.employeeCode), item]),
      )

      const importedEmployeeIds = importedEmployees
        .map((item) => item._id)
        .filter(Boolean)

      const existingAccountsForImportedEmployees = importedEmployeeIds.length
        ? await Account.find(
            {
              employeeId: {
                $in: importedEmployeeIds,
              },
            },
            '_id loginId employeeId',
          )
            .session(session)
            .lean()
        : []

      const accountByEmployeeId = new Map(
        existingAccountsForImportedEmployees
          .filter((item) => item.employeeId)
          .map((item) => [id(item.employeeId), item]),
      )

      emitImportProgress(options, {
        phase: 'CREATE_ACCOUNT',
        percent: 92,
        totalRows: validRows.length,
        messageKey: 'org.employee.importProgress.createAccount',
        message: 'Creating employee login accounts...',
        completedPhases: ['RESOLVE_MANAGER'],
      })

      const accountDocs = await buildAccountDocsInBatches({
        validRows,
        importedEmployeeByCode,
        accountByEmployeeId,
        options,
        batchSize: 16,
      })

      if (accountDocs.length) {
        await insertManyInChunks(Account, accountDocs, {
          session,
          ordered: true,
          chunkSize: 500,
          onProgress({ processed, total }) {
            emitImportProgress(options, {
              phase: 'CREATE_ACCOUNT',
              percent: 98,
              totalRows: validRows.length,
              processedRows: validRows.length,
              messageKey: 'org.employee.importProgress.createAccount',
              message: `Saving requested accounts ${processed}/${total}...`,
              completedPhases: ['RESOLVE_MANAGER'],
            })
          },
        })
      }

      createdEmployeeIds = importedEmployees
        .filter((item) => !existingCodeSet.has(upper(item.employeeCode)))
        .map((item) => id(item._id))

      summary = {
        totalRows: validRows.length,
        created,
        updated,
        accountsCreated: accountDocs.length,
      }
    })
  } catch (error) {
    if (Number(error?.code) === 11000) {
      throw appError({
        statusCode: 409,
        code: 'EMPLOYEE_IMPORT_DUPLICATE_DATABASE_VALUE',
        messageKey: 'org.employee.import.error.duplicateDatabaseValue',
        message: 'Import failed because one or more values already conflict with existing employee data.',
        params: {
          keyPattern: error.keyPattern || {},
          keyValue: error.keyValue || {},
        },
      })
    }

    throw error
  } finally {
    await session.endSession()
  }

  emitImportProgress(options, {
    phase: 'SYNC_MANAGER',
    percent: 98,
    totalRows: validRows.length,
    processedRows: validRows.length,
    messageKey: 'org.employee.importProgress.syncManager',
    message: 'Finalizing line managers...',
    completedPhases: ['CREATE_ACCOUNT'],
  })

  await syncSameLineManagersForAllEmployees()

  completeImportProgress(options.progressJobId, {
    totalRows: summary.totalRows,
    processedRows: summary.totalRows,
    summary,
  })

  return {
    fileName: file.fileName || 'employee-import.xlsx',
    summary,
    createdEmployeeIds,
    errors: [],
    messageKey: 'org.employee.import.success.completed',
  }
}

async function getById(employeeId, currentUser = null) {
  await ensureObjectId(employeeId, 'employeeId')
  await assertReadableEmployee(currentUser, employeeId)

  const [doc, accountDoc] = await Promise.all([
    Employee.findById(employeeId)
      .populate('departmentId', 'name code')
      .populate('positionId', POSITION_POPULATE_FIELDS)
      .populate('lineId', 'code name')
      .populate('lineIds', 'code name')
      .populate('shiftId', SHIFT_POPULATE_FIELDS)
      .populate('reportsToEmployeeId', 'employeeCode displayName')
      .populate('lineManagerIds', 'employeeCode displayName')
      .lean(),

    Account.findOne({ employeeId }, 'loginId isActive employeeId').lean(),
  ])

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      messageKey: 'org.employee.error.notFound',
      message: 'Employee not found',
      field: 'employeeId',
    })
  }

  return sanitize(doc, accountDoc)
}

async function getOrgChart(employeeId, currentUser = null) {
  await ensureObjectId(employeeId, 'employeeId')
  await assertReadableEmployee(currentUser, employeeId)

  const focusDoc = await Employee.findById(employeeId)
    .populate('departmentId', 'name code')
    .populate('positionId', POSITION_POPULATE_FIELDS)
    .populate('lineId', 'code name')
    .populate('shiftId', SHIFT_POPULATE_FIELDS)
    .populate('reportsToEmployeeId', 'employeeCode displayName')
    .populate('lineManagerIds', 'employeeCode displayName')
    .lean()

  if (!focusDoc) {
    throw appError({
      statusCode: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      messageKey: 'org.employee.error.notFound',
      message: 'Employee not found',
      field: 'employeeId',
    })
  }

  const upwardDocs = []
  const visited = new Set([id(focusDoc._id)])

  let currentManagerId = id(focusDoc.reportsToEmployeeId)

  while (currentManagerId && !visited.has(currentManagerId)) {
    visited.add(currentManagerId)

    const managerDoc = await Employee.findById(currentManagerId)
      .populate('departmentId', 'name code')
      .populate('positionId', POSITION_POPULATE_FIELDS)
      .populate('lineId', 'code name')
      .populate('lineIds', 'code name')
      .populate('shiftId', SHIFT_POPULATE_FIELDS)
      .populate('reportsToEmployeeId', 'employeeCode displayName')
      .populate('lineManagerIds', 'employeeCode displayName')
      .lean()

    if (!managerDoc) break

    upwardDocs.push(managerDoc)
    currentManagerId = id(managerDoc.reportsToEmployeeId)
  }

  upwardDocs.reverse()

  const directReportDocs = await Employee.find({
    reportsToEmployeeId: focusDoc._id,
  })
    .populate('departmentId', 'name code')
    .populate('positionId', POSITION_POPULATE_FIELDS)
    .populate('lineId', 'code name')
    .populate('shiftId', SHIFT_POPULATE_FIELDS)
    .populate('reportsToEmployeeId', 'employeeCode displayName')
    .populate('lineManagerIds', 'employeeCode displayName')
    .sort({ displayName: 1, employeeCode: 1, _id: 1 })
    .lean()

  return {
    focusEmployee: sanitizeOrgNode(focusDoc),
    upwardChain: upwardDocs.map(sanitizeOrgNode),
    directReports: directReportDocs.map(sanitizeOrgNode),
  }
}

function makeOrgTreeNode(employee, children = [], expanded = false, highlighted = false) {
  if (!employee) return null

  return {
    key: employee.id,
    expanded,
    selectable: true,
    data: {
      ...employee,

      id: employee.id,
      _id: employee._id,
      employeeId: employee.employeeId,
      employeeCode: employee.employeeCode,
      displayName: employee.displayName,

      name: employee.displayName || employee.employeeCode || 'Unknown',
      title: employee.positionName || 'No position',
      department: employee.departmentName || 'No department',

      lineCode: employee.lineCode || '',
      lineName: employee.lineName || '',

      shiftCode: employee.shiftCode || '',
      shiftName: employee.shiftName || '',
      shiftType: employee.shiftType || '',
      shiftStartTime: employee.shiftStartTime || '',
      shiftEndTime: employee.shiftEndTime || '',

      reportsToEmployeeId: employee.reportsToEmployeeId || null,
      reportsToEmployeeCode: employee.reportsToEmployeeCode || '',
      reportsToEmployeeName: employee.reportsToEmployeeName || '',

      lineManagerIds: employee.lineManagerIds || [],
      lineManagers: employee.lineManagers || [],
      lineManagerNames: employee.lineManagerNames || '',

      highlighted,
    },
    children,
  }
}

function buildTreeRecursive(
  rootId,
  employeeMap,
  childrenMap,
  expandedIds,
  highlightedIds,
  pathIds = new Set(),
) {
  const employee = employeeMap.get(rootId)

  if (!employee) return null
  if (pathIds.has(rootId)) return null

  const nextPathIds = new Set(pathIds)
  nextPathIds.add(rootId)

  const childIds = childrenMap.get(rootId) || []

  const children = childIds
    .map((childId) =>
      buildTreeRecursive(
        childId,
        employeeMap,
        childrenMap,
        expandedIds,
        highlightedIds,
        nextPathIds,
      ),
    )
    .filter(Boolean)

  return makeOrgTreeNode(
    employee,
    children,
    expandedIds.has(rootId),
    highlightedIds.has(rootId),
  )
}

function collectAncestorIds(startId, employeeMap, parentIdsByEmployeeId = new Map()) {
  const result = new Set()
  const queue = [startId]
  const visited = new Set()

  while (queue.length) {
    const currentId = queue.shift()

    if (!currentId || visited.has(currentId)) continue

    visited.add(currentId)
    result.add(currentId)

    const parentIds = parentIdsByEmployeeId.get(currentId) || []

    for (const parentId of parentIds) {
      if (parentId && !visited.has(parentId) && employeeMap.has(parentId)) {
        queue.push(parentId)
      }
    }
  }

  return Array.from(result)
}

function searchEmployees(allEmployees, keyword) {
  const q = s(keyword).toLowerCase()

  if (!q) return []

  return allEmployees.filter((employee) => {
    return [
      employee.employeeCode,
      employee.displayName,
      employee.email,
      employee.departmentName,
      employee.positionName,
      employee.lineName,
      employee.lineCode,
      employee.shiftName,
      employee.shiftCode,
      employee.lineManagerNames,
      employee.otWorkflowRole,
    ]
      .map((value) => s(value).toLowerCase())
      .some((value) => value.includes(q))
  })
}

async function getOrgTree(
  {
    rootEmployeeId = '',
    search = '',
    includeInactive = false,
  } = {},
  currentUser = null,
) {
  const scopedIds = await employeeScopeService.getScopedEmployeeIds(currentUser)

  if (!scopedIds.size) {
    return {
      rootEmployeeId: null,
      rootOptions: [],
      matchedEmployeeIds: [],
      expandedEmployeeIds: [],
      totalVisibleEmployees: 0,
      tree: [],
      meta: {
        rootMode: 'NO_SCOPE',
        hasNaturalRoot: false,
        scopedIdsSize: 0,
        allDocs: 0,
      },
    }
  }

  const allDocs = await Employee.find(
    {
      _id: {
        $in: Array.from(scopedIds)
          .filter(isObjectId)
          .map(objectId),
      },
      ...(includeInactive ? {} : { isActive: true }),
    },
    {
      employeeCode: 1,
      displayName: 1,
      departmentId: 1,
      positionId: 1,
      lineId: 1,
      shiftId: 1,
      reportsToEmployeeId: 1,
      lineManagerIds: 1,
      otWorkflowRole: 1,
      isActive: 1,
      email: 1,
      phone: 1,
      joinDate: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  )
    .populate('departmentId', 'name code')
    .populate('positionId', POSITION_POPULATE_FIELDS)
    .populate('lineId', 'code name')
    .populate('shiftId', SHIFT_POPULATE_FIELDS)
    .populate('reportsToEmployeeId', 'employeeCode displayName')
    .populate('lineManagerIds', 'employeeCode displayName')
    .sort({ displayName: 1, employeeCode: 1, _id: 1 })
    .lean()

  const normalized = allDocs.map((doc) => sanitize(doc)).filter(Boolean)
  const employeeMap = new Map(normalized.map((employee) => [employee.id, employee]))

  if (!normalized.length) {
    return {
      rootEmployeeId: null,
      rootOptions: [],
      matchedEmployeeIds: [],
      expandedEmployeeIds: [],
      totalVisibleEmployees: 0,
      tree: [],
      meta: {
        rootMode: 'NO_EMPLOYEES',
        hasNaturalRoot: false,
        scopedIdsSize: scopedIds.size,
        allDocs: allDocs.length,
      },
    }
  }

  const childrenMap = new Map()
  const parentIdsByEmployeeId = new Map()

  for (const employee of normalized) {
    const lineManagerIds = uniqueIds(employee.lineManagerIds || [])
    const reportsToEmployeeId = id(employee.reportsToEmployeeId)

    const candidateParentIds = lineManagerIds.length
      ? lineManagerIds
      : reportsToEmployeeId
        ? [reportsToEmployeeId]
        : []

    const validParentIds = [
      ...new Set(
        candidateParentIds.filter((parentId) => {
          if (!parentId) return false
          if (parentId === employee.id) return false

          return employeeMap.has(parentId)
        }),
      ),
    ]

    parentIdsByEmployeeId.set(employee.id, validParentIds)

    for (const parentId of validParentIds) {
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, [])
      }

      childrenMap.get(parentId).push(employee.id)
    }
  }

  for (const childIds of childrenMap.values()) {
    childIds.sort((a, b) => {
      const aa = employeeMap.get(a)
      const bb = employeeMap.get(b)

      return `${aa?.displayName || ''} ${aa?.employeeCode || ''}`.localeCompare(
        `${bb?.displayName || ''} ${bb?.employeeCode || ''}`,
      )
    })
  }

  function sortRootEmployees(a, b) {
    const roleWeight = {
      APPROVER: 1,
      ACKNOWLEDGE: 2,
      NONE: 3,
    }

    const aa = roleWeight[normalizeOTWorkflowRole(a.otWorkflowRole)] || 9
    const bb = roleWeight[normalizeOTWorkflowRole(b.otWorkflowRole)] || 9

    if (aa !== bb) return aa - bb

    return `${a.displayName || ''} ${a.employeeCode || ''}`.localeCompare(
      `${b.displayName || ''} ${b.employeeCode || ''}`,
    )
  }

  const naturalRootCandidates = normalized
    .filter((employee) => {
      const parentIds = parentIdsByEmployeeId.get(employee.id) || []

      return !parentIds.length
    })
    .sort(sortRootEmployees)

  const fallbackRootCandidates = [...normalized].sort(sortRootEmployees)

  const hasNaturalRoot = naturalRootCandidates.length > 0
  const rootCandidates = hasNaturalRoot
    ? naturalRootCandidates
    : fallbackRootCandidates

  let selectedRootId = s(rootEmployeeId)

  if (!selectedRootId || !employeeMap.has(selectedRootId)) {
    selectedRootId = rootCandidates[0]?.id || ''
  }

  const matched = searchEmployees(normalized, search)
  const matchedIds = matched.map((employee) => employee.id)

  const expandedIds = new Set()
  const highlightedIds = new Set(matchedIds)

  if (matchedIds.length) {
    for (const matchId of matchedIds) {
      const path = collectAncestorIds(matchId, employeeMap, parentIdsByEmployeeId)

      for (const employeeId of path) {
        expandedIds.add(employeeId)
      }
    }
  } else if (selectedRootId) {
    expandedIds.add(selectedRootId)
  }

  let tree = []

  if (selectedRootId) {
    const rootNode = buildTreeRecursive(
      selectedRootId,
      employeeMap,
      childrenMap,
      expandedIds,
      highlightedIds,
      new Set(),
    )

    if (rootNode) {
      tree = [rootNode]
    }
  }

  if (!tree.length && rootCandidates.length) {
    tree = rootCandidates
      .map((root) =>
        buildTreeRecursive(
          root.id,
          employeeMap,
          childrenMap,
          expandedIds,
          highlightedIds,
          new Set(),
        ),
      )
      .filter(Boolean)
  }

  return {
    rootEmployeeId: selectedRootId || null,

    rootOptions: rootCandidates.map((employee) => ({
      id: employee.id,
      employeeId: employee.employeeId,
      employeeCode: employee.employeeCode,
      displayName: employee.displayName,

      departmentId: employee.departmentId,
      departmentName: employee.departmentName,

      positionId: employee.positionId,
      positionName: employee.positionName,

      lineId: employee.lineId,
      lineName: employee.lineName,
      lineCode: employee.lineCode,

      shiftId: employee.shiftId,
      shiftName: employee.shiftName,
      shiftCode: employee.shiftCode,
      shiftStartTime: employee.shiftStartTime,
      shiftEndTime: employee.shiftEndTime,

      reportsToEmployeeId: employee.reportsToEmployeeId,
      lineManagerIds: employee.lineManagerIds,
      lineManagers: employee.lineManagers,

      otWorkflowRole: employee.otWorkflowRole,
      isActive: employee.isActive,
    })),

    matchedEmployeeIds: matchedIds,
    expandedEmployeeIds: Array.from(expandedIds),
    totalVisibleEmployees: normalized.length,
    tree,

    meta: {
      rootMode: hasNaturalRoot ? 'NATURAL_ROOT' : 'FALLBACK_ROOT',
      hasNaturalRoot,
      naturalRootCount: naturalRootCandidates.length,
      fallbackRootCount: fallbackRootCandidates.length,
      scopedIdsSize: scopedIds.size,
      allDocs: allDocs.length,
      normalized: normalized.length,
      treeCount: tree.length,
    },
  }
}

async function syncSameLineManagersForAllEmployees() {
  const [employees, positions] = await Promise.all([
    Employee.find(
      { isActive: true },
      {
        _id: 1,
        employeeCode: 1,
        displayName: 1,
        departmentId: 1,
        positionId: 1,
        lineId: 1,
        lineIds: 1,
        reportsToEmployeeId: 1,
        lineManagerIds: 1,
        isActive: 1,
      },
    )
      .sort({ employeeCode: 1, displayName: 1, _id: 1 })
      .lean(),

    Position.find(
      { isActive: true },
      {
        _id: 1,
        departmentId: 1,
        reportsToPositionId: 1,
        hierarchyScope: 1,
        managerScope: 1,
      },
    ).lean(),
  ])

  const positionById = new Map(positions.map((position) => [id(position._id), position]))
  const employeesByPositionLine = new Map()
  const employeesByPositionDepartment = new Map()
  const employeesByPosition = new Map()

  function pushToMap(map, key, employee) {
    if (!key) return

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key).push(employee)
  }

  for (const employee of employees) {
    const positionId = id(employee.positionId)
    const departmentId = id(employee.departmentId)
    const lineIds = employeeLineIds(employee)

    if (positionId) {
      pushToMap(employeesByPosition, positionId, employee)
    }

    if (positionId && departmentId) {
      pushToMap(employeesByPositionDepartment, `${positionId}:${departmentId}`, employee)
    }

    if (positionId && lineIds.length) {
      lineIds.forEach((lineId) => {
        pushToMap(employeesByPositionLine, `${positionId}:${lineId}`, employee)
      })
    }
  }

  const sortEmployeeGroup = (group) => {
    group.sort((a, b) =>
      `${a.employeeCode || ''} ${a.displayName || ''} ${a._id || ''}`.localeCompare(
        `${b.employeeCode || ''} ${b.displayName || ''} ${b._id || ''}`,
      ),
    )
  }

  for (const group of employeesByPositionLine.values()) sortEmployeeGroup(group)
  for (const group of employeesByPositionDepartment.values()) sortEmployeeGroup(group)
  for (const group of employeesByPosition.values()) sortEmployeeGroup(group)

  const operations = []

  for (const employee of employees) {
    const employeeId = id(employee._id)
    const position = positionById.get(id(employee.positionId))

    if (!position?.reportsToPositionId) continue

    const parentPositionId = id(position.reportsToPositionId)
    const hierarchyScope = getPositionHierarchyScope(position)

    let managerCandidates = []

    if (hierarchyScope === 'SAME_LINE') {
      const lineIds = employeeLineIds(employee)
      const byId = new Map()

      for (const lineId of lineIds) {
        const key = `${parentPositionId}:${lineId}`
        const group = employeesByPositionLine.get(key) || []

        group.forEach((manager) => {
          if (!sameId(manager._id, employeeId)) {
            byId.set(id(manager._id), manager)
          }
        })
      }

      managerCandidates = Array.from(byId.values())
    } else if (hierarchyScope === 'GLOBAL') {
      const departmentId = id(employee.departmentId)

      if (parentPositionId && departmentId) {
        const key = `${parentPositionId}:${departmentId}`
        managerCandidates = employeesByPositionDepartment.get(key) || []
      }
    } else if (hierarchyScope === 'CROSS_DEPARTMENT') {
      managerCandidates = employeesByPosition.get(parentPositionId) || []
    }

    const nextLineManagerIds = uniqueIds(
      managerCandidates
        .filter((manager) => !sameId(manager._id, employeeId))
        .map((manager) => manager._id),
    )

    const nextPrimaryManagerId = nextLineManagerIds[0] || null

    const currentPrimaryManagerId = id(employee.reportsToEmployeeId)
    const currentLineManagerIds = uniqueIds(employee.lineManagerIds || [])

    const primaryChanged = currentPrimaryManagerId !== id(nextPrimaryManagerId)
    const lineManagersChanged =
      currentLineManagerIds.length !== nextLineManagerIds.length ||
      currentLineManagerIds.some(
        (managerId, index) => managerId !== nextLineManagerIds[index],
      )

    if (!primaryChanged && !lineManagersChanged) continue

    operations.push({
      updateOne: {
        filter: {
          _id: employee._id,
        },
        update: {
          $set: {
            reportsToEmployeeId: nextPrimaryManagerId,
            lineManagerIds: nextLineManagerIds,
          },
        },
      },
    })
  }

  if (!operations.length) {
    return {
      matched: 0,
      modified: 0,
    }
  }

  const result = await Employee.bulkWrite(operations, {
    ordered: false,
  })

  return {
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0,
  }
}

async function create(payload, currentUser = null) {
  await ensureEmployeeCodeUnique(payload.employeeCode || '')
  await ensureEmailUnique(payload.email || '')

  const accountPayload = await validateCreateAccountOption(
    payload.createAccount || {},
    payload,
  )

  const department = await ensureDepartmentExists(payload.departmentId)
  const position = await ensurePositionExists(payload.positionId, department._id)

  await ensureShiftExists(payload.shiftId)

  const lineIds = normalizeLineIdsFromPayload(payload)
  await ensureLinesAllowed(lineIds, department._id, position._id)

  const managerResult = await resolveFinalManagerIds({
    employeeId: null,
    departmentId: department._id,
    position,
    lineId: lineIds[0] || null,
    lineIds,
    manualReportsToEmployeeId: payload.reportsToEmployeeId || null,
  })

  let doc = null

  try {
    doc = await Employee.create({
      employeeCode: upper(payload.employeeCode || ''),
      displayName: s(payload.displayName),
      departmentId: payload.departmentId,
      positionId: payload.positionId,
      lineId: lineIds[0] || null,
      lineIds,
      shiftId: payload.shiftId,
      reportsToEmployeeId: managerResult.primaryManagerId || null,
      lineManagerIds: managerResult.lineManagerIds || [],
      otWorkflowRole: normalizeOTWorkflowRole(payload.otWorkflowRole),
      phone: s(payload.phone),
      email: s(payload.email).toLowerCase(),
      joinDate: payload.joinDate || null,
      isActive: payload.isActive ?? true,
    })

    await createAccountForEmployee(doc, accountPayload)
  } catch (error) {
    if (doc?._id && accountPayload.enabled) {
      await Employee.deleteOne({ _id: doc._id }).catch(() => {})
    }

    throw error
  }

  await syncSameLineManagersForAllEmployees()

  return getById(doc._id, currentUser)
}

async function update(employeeId, payload, currentUser = null) {
  await ensureObjectId(employeeId, 'employeeId')

  const doc = await Employee.findById(employeeId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      messageKey: 'org.employee.error.notFound',
      message: 'Employee not found',
      field: 'employeeId',
    })
  }

  const nextEmployeeCode =
    payload.employeeCode !== undefined ? upper(payload.employeeCode) : upper(doc.employeeCode)
  const nextDisplayName =
    payload.displayName !== undefined ? s(payload.displayName) : s(doc.displayName)
  const nextEmail =
    payload.email !== undefined ? s(payload.email).toLowerCase() : s(doc.email)
  const nextPhone = payload.phone !== undefined ? s(payload.phone) : s(doc.phone)
  const nextOTWorkflowRole =
    payload.otWorkflowRole !== undefined
      ? normalizeOTWorkflowRole(payload.otWorkflowRole)
      : normalizeOTWorkflowRole(doc.otWorkflowRole)

  const nextDepartmentId =
    payload.departmentId !== undefined ? payload.departmentId : doc.departmentId
  const nextPositionId =
    payload.positionId !== undefined ? payload.positionId : doc.positionId
  const nextLineIds =
    payload.lineId !== undefined || payload.lineIds !== undefined
      ? normalizeLineIdsFromPayload(payload)
      : employeeLineIds(doc)
  const nextLineId = nextLineIds[0] || null
  const nextShiftId = payload.shiftId !== undefined ? payload.shiftId : doc.shiftId

  const accountPayload = await validateCreateAccountOption(
    payload.createAccount || {},
    {
      employeeCode: nextEmployeeCode,
      displayName: nextDisplayName,
      phone: nextPhone,
    },
  )

  if (accountPayload.enabled) {
    await ensureEmployeeHasNoAccount(doc._id)
  }

  if (payload.employeeCode !== undefined && nextEmployeeCode !== upper(doc.employeeCode)) {
    await ensureEmployeeCodeUnique(nextEmployeeCode, doc._id)
  }

  if (payload.email !== undefined && nextEmail !== s(doc.email).toLowerCase()) {
    await ensureEmailUnique(nextEmail, doc._id)
  }

  const department = await ensureDepartmentExists(nextDepartmentId)
  const position = await ensurePositionExists(nextPositionId, department._id)

  await ensureShiftExists(nextShiftId)
  await ensureLinesAllowed(nextLineIds, department._id, position._id)

  const shouldRefreshManager =
    payload.departmentId !== undefined ||
    payload.positionId !== undefined ||
    payload.lineId !== undefined ||
    payload.lineIds !== undefined ||
    payload.reportsToEmployeeId !== undefined

  doc.employeeCode = nextEmployeeCode
  doc.displayName = nextDisplayName
  doc.departmentId = nextDepartmentId
  doc.positionId = nextPositionId
  doc.lineId = nextLineId || null
  doc.lineIds = nextLineIds
  doc.shiftId = nextShiftId
  doc.otWorkflowRole = nextOTWorkflowRole
  doc.phone = nextPhone
  doc.email = nextEmail

  if (payload.joinDate !== undefined) {
    doc.joinDate = payload.joinDate || null
  }

  if (payload.isActive !== undefined) {
    doc.isActive = !!payload.isActive
  }

  if (shouldRefreshManager) {
    const managerResult = await resolveFinalManagerIds({
      employeeId: doc._id,
      departmentId: department._id,
      position,
      lineId: nextLineId,
      lineIds: nextLineIds,
      manualReportsToEmployeeId:
        payload.reportsToEmployeeId !== undefined
          ? payload.reportsToEmployeeId
          : doc.reportsToEmployeeId,
    })

    doc.reportsToEmployeeId = managerResult.primaryManagerId || null
    doc.lineManagerIds = managerResult.lineManagerIds || []
  }

  await doc.save()

  if (accountPayload.enabled) {
    await createAccountForEmployee(doc, accountPayload)
  }

  await syncSameLineManagersForAllEmployees()

  return getById(doc._id, currentUser)
}

module.exports = {
  lookup,
  list,
  exportExcel,
  downloadImportSample,
  importExcel,
  getImportProgress,
  failImportProgress,
  getById,
  getOrgChart,
  getOrgTree,
  create,
  update,
  syncSameLineManagersForAllEmployees,
}