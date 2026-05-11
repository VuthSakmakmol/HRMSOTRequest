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
const { importEmployeeRowSchema } = require('../validators/employee.validation')

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

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeOTWorkflowRole(value) {
  const role = upper(value || 'NONE')

  return ['NONE', 'APPROVER', 'ACKNOWLEDGE'].includes(role) ? role : 'NONE'
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

  if (!Number.isFinite(serial) || serial <= 0) {
    return null
  }

  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()

  if (!isValidDateParts(year, month, day)) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function parseImportDate(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

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

function buildLineSummary(lineValue) {
  const lineId = id(lineValue)

  return {
    lineId: lineId || null,
    lineCode: lineValue?.code || '',
    lineName: lineValue?.name || '',
    line: lineId
      ? {
          id: lineId,
          _id: lineId,
          code: lineValue?.code || '',
          name: lineValue?.name || '',
        }
      : null,
  }
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
  return [doc?.employeeCode, doc?.displayName].filter(Boolean).join(' - ') || s(doc?.displayName)
}

function sanitize(doc, accountDoc = null) {
  if (!doc) return null

  const lineManagers = buildLineManagersSummary(doc.lineManagerIds)
  const workflowRole = normalizeOTWorkflowRole(doc.otWorkflowRole)

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
    managerScope: doc.positionId?.managerScope || '',

    ...buildLineSummary(doc.lineId),
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
  const item = sanitize(doc)

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

    otWorkflowRole: item.otWorkflowRole,
    otWorkflowRoleKey: item.otWorkflowRoleKey,
    isActive: item.isActive,
  }
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

    filter.$or = [
      { employeeCode: regex },
      { displayName: regex },
      { phone: regex },
      { email: regex },
      { otWorkflowRole: regex },
    ]
  }

  if (departmentId && isObjectId(departmentId)) {
    filter.departmentId = objectId(departmentId)
  }

  if (positionId && isObjectId(positionId)) {
    filter.positionId = objectId(positionId)
  }

  if (lineId && isObjectId(lineId)) {
    filter.lineId = objectId(lineId)
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
    .select('_id code name departmentId reportsToPositionId managerScope isActive')
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

async function ensureLineAllowed(lineId, departmentId, positionId) {
  if (!lineId) return null

  await ensureObjectId(lineId, 'lineId')

  const line = await ProductionLine.findById(lineId)
    .select('_id code name departmentId positionIds isActive')
    .lean()

  if (!line) {
    throw appError({
      statusCode: 404,
      code: 'LINE_NOT_FOUND',
      messageKey: 'org.line.error.notFound',
      message: 'Line not found',
      field: 'lineId',
    })
  }

  if (line.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'LINE_INACTIVE',
      messageKey: 'org.line.error.inactive',
      message: 'Line is inactive',
      field: 'lineId',
    })
  }

  if (departmentId && !sameId(line.departmentId, departmentId)) {
    throw appError({
      statusCode: 400,
      code: 'LINE_DEPARTMENT_MISMATCH',
      messageKey: 'org.line.error.departmentMismatch',
      message: 'Line does not belong to selected department',
      field: 'lineId',
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
      message: 'Selected line does not allow this position',
      field: 'lineId',
    })
  }

  return line
}

async function ensureShiftExists(shiftId) {
  await ensureObjectId(shiftId, 'shiftId')

  const shift = await Shift.findOne({
    _id: shiftId,
    isActive: true,
  })
    .select('_id code name type startTime endTime breakStartTime breakEndTime crossMidnight isActive')
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
  lineId,
}) {
  if (!position?.reportsToPositionId) {
    return []
  }

  const managerScope = upper(position.managerScope || 'SAME_LINE')

  const filter = {
    positionId: position.reportsToPositionId,
    isActive: true,
  }

  if (managerScope === 'SAME_LINE') {
    if (!lineId || !departmentId) {
      return []
    }

    filter.departmentId = departmentId
    filter.lineId = lineId
  }

  if (employeeId) {
    filter._id = {
      $ne: employeeId,
    }
  }

  const managers = await Employee.find(filter)
    .select('_id employeeCode displayName departmentId positionId lineId')
    .sort({ employeeCode: 1, displayName: 1, _id: 1 })
    .lean()

  return managers.map((manager) => manager._id)
}

async function resolveFinalManagerIds({
  employeeId = null,
  departmentId,
  position,
  lineId,
  manualReportsToEmployeeId = null,
}) {
  const autoManagerIds = await findAutoManagerIdsByPositionAndLine({
    employeeId,
    departmentId,
    position,
    lineId,
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
      .populate('positionId', 'name code reportsToPositionId managerScope')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime breakStartTime breakEndTime endTime crossMidnight')
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

  const [items, total, accountByEmployeeId] = await Promise.all([
    Employee.find(filter)
      .populate('departmentId', 'name code')
      .populate('positionId', 'name code reportsToPositionId managerScope')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime breakStartTime breakEndTime endTime crossMidnight')
      .populate('reportsToEmployeeId', 'employeeCode displayName')
      .populate('lineManagerIds', 'employeeCode displayName')
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),

    Employee.countDocuments(filter),

    loadAccountMapForEmployees(),
  ])

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
    'Line Code': item.lineCode || '',
    'Line Name': item.lineName || '',
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
      .populate('positionId', 'name code reportsToPositionId managerScope')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime breakStartTime breakEndTime endTime crossMidnight')
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
      'Line Code': 'LINE-01',
      'Shift Code': 'DAY',
      'Reports To Employee Code': '',
      'OT Workflow Role': 'APPROVER',
      Phone: '012345678',
      Email: 'mra@company.com',
      'Join Date': '30/04/2026',
      Status: 'Active',
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
      Phone: '098765432',
      Email: 'worker001@company.com',
      'Join Date': '30/04/2026',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Employee Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Employee Code', 'Required. Human-readable employee code. If it already exists, the row updates that employee. If it does not exist, the row creates a new employee.'],
    ['Display Name', 'Required.'],
    ['Department Code', 'Required. Must already exist in Department master.'],
    ['Position Code', 'Required. Must already exist and belong to Department Code.'],
    ['Line Code', 'Optional. Must already exist if provided.'],
    ['Shift Code', 'Required. Must already exist and be active.'],
    ['Reports To Employee Code', 'Optional. Use employee code of the manager/supervisor. Do not use Mongo ID.'],
    ['OT Workflow Role', 'Use NONE, APPROVER, or ACKNOWLEDGE. Blank = NONE.'],
    ['Phone', 'Optional.'],
    ['Email', 'Optional. Must be unique if provided.'],
    ['Join Date', 'Optional. Use DD/MM/YYYY format.'],
    ['Status', 'Use Active or Inactive. Blank = Active.'],
    ['Account', 'Employee import does not create login accounts. Create accounts from Account module only.'],
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

function normalizeImportRow(raw = {}) {
  const rawJoinDate = getImportField(raw, [
    'joinDate',
    'Join Date',
    'JOIN DATE',
  ])

  const rawStatus = getImportField(raw, [
    'isActive',
    'Status',
    'STATUS',
  ])

  const joinDate = parseImportDate(rawJoinDate)

  return {
    employeeCode: upper(
      getImportField(raw, ['Employee Code', 'employeeCode', 'EmployeeCode']),
    ),
    displayName: s(getImportField(raw, ['Display Name', 'displayName', 'Name'])),
    departmentCode: upper(getImportField(raw, ['Department Code', 'departmentCode'])),
    positionCode: upper(getImportField(raw, ['Position Code', 'positionCode'])),
    lineCode: upper(getImportField(raw, ['Line Code', 'lineCode'])),
    shiftCode: upper(getImportField(raw, ['Shift Code', 'shiftCode'])),
    reportsToEmployeeCode: upper(
      getImportField(raw, [
        'Reports To Employee Code',
        'reportsToEmployeeCode',
        'ReportsToEmployeeCode',
      ]),
    ),
    otWorkflowRole: normalizeOTWorkflowRole(
      getImportField(raw, ['OT Workflow Role', 'otWorkflowRole']),
    ),
    phone: s(getImportField(raw, ['Phone', 'phone'])),
    email: s(getImportField(raw, ['Email', 'email'])).toLowerCase(),
    joinDate,
    rawJoinDate,
    isActive: normalizeImportStatus(rawStatus),
    rawStatus,
  }
}

async function importExcel(file, currentUser = null) {
  if (!file?.buffer) {
    throw appError({
      statusCode: 400,
      code: 'EMPLOYEE_EXCEL_FILE_REQUIRED',
      messageKey: 'org.employee.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  const workbook = XLSX.read(file.buffer, {
    type: 'buffer',
    cellDates: true,
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

  const parsedRows = rawRows.map((raw, index) => {
    const normalized = normalizeImportRow(raw)
    const rowNo = index + 2

    if (normalized.rawJoinDate && normalized.joinDate === 'INVALID_DATE') {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_INVALID_JOIN_DATE',
        messageKey: 'org.employee.import.error.invalidJoinDate',
        message: `Row ${rowNo}: Invalid Join Date`,
        params: {
          rowNo,
        },
      })
    }

    if (normalized.rawStatus && normalized.isActive === 'INVALID_BOOLEAN') {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_INVALID_STATUS',
        messageKey: 'org.employee.import.error.invalidStatus',
        message: `Row ${rowNo}: Invalid Status`,
        params: {
          rowNo,
        },
      })
    }

    const result = importEmployeeRowSchema.safeParse(normalized)

    if (!result.success) {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_ROW_INVALID',
        messageKey:
          result.error.issues[0]?.message || 'org.employee.import.error.rowInvalid',
        message: `Row ${rowNo}: ${result.error.issues[0]?.message || 'Invalid data'}`,
        params: {
          rowNo,
        },
      })
    }

    return {
      ...result.data,
      employeeCode: upper(result.data.employeeCode),
      departmentCode: upper(result.data.departmentCode),
      positionCode: upper(result.data.positionCode),
      lineCode: upper(result.data.lineCode),
      shiftCode: upper(result.data.shiftCode),
      reportsToEmployeeCode: upper(result.data.reportsToEmployeeCode),
      otWorkflowRole: normalizeOTWorkflowRole(result.data.otWorkflowRole),
      email: s(result.data.email).toLowerCase(),
      isActive:
        typeof result.data.isActive === 'boolean' ? result.data.isActive : true,
      rowNo,
    }
  })

  const seenEmployeeCodes = new Set()
  const seenEmails = new Set()

  for (const row of parsedRows) {
    if (seenEmployeeCodes.has(row.employeeCode)) {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_DUPLICATE_EMPLOYEE_CODE',
        messageKey: 'org.employee.import.error.duplicateEmployeeCode',
        message: `Row ${row.rowNo}: Duplicate Employee Code in import file`,
        params: {
          rowNo: row.rowNo,
          employeeCode: row.employeeCode,
        },
      })
    }

    seenEmployeeCodes.add(row.employeeCode)

    if (row.email) {
      if (seenEmails.has(row.email)) {
        throw appError({
          statusCode: 400,
          code: 'EMPLOYEE_IMPORT_DUPLICATE_EMAIL',
          messageKey: 'org.employee.import.error.duplicateEmail',
          message: `Row ${row.rowNo}: Duplicate Email in import file`,
          params: {
            rowNo: row.rowNo,
            email: row.email,
          },
        })
      }

      seenEmails.add(row.email)
    }
  }

  const employeeCodes = [
    ...new Set(
      parsedRows
        .flatMap((row) => [row.employeeCode, row.reportsToEmployeeCode])
        .map(upper)
        .filter(Boolean),
    ),
  ]

  const emails = [...seenEmails]

  const departmentCodes = [
    ...new Set(parsedRows.map((row) => row.departmentCode).filter(Boolean)),
  ]
  const positionCodes = [
    ...new Set(parsedRows.map((row) => row.positionCode).filter(Boolean)),
  ]
  const lineCodes = [
    ...new Set(parsedRows.map((row) => row.lineCode).filter(Boolean)),
  ]
  const shiftCodes = [
    ...new Set(parsedRows.map((row) => row.shiftCode).filter(Boolean)),
  ]

  const [
    departments,
    positions,
    lines,
    shifts,
    existingEmployees,
    existingEmailOwners,
  ] = await Promise.all([
    Department.find({ code: { $in: departmentCodes } }, '_id code name isActive').lean(),

    Position.find(
      { code: { $in: positionCodes } },
      '_id code name departmentId reportsToPositionId managerScope isActive',
    ).lean(),

    lineCodes.length
      ? ProductionLine.find(
          { code: { $in: lineCodes } },
          '_id code name departmentId positionIds isActive',
        ).lean()
      : [],

    Shift.find(
      { code: { $in: shiftCodes }, isActive: true },
      '_id code name type startTime endTime breakStartTime breakEndTime crossMidnight isActive',
    ).lean(),

    employeeCodes.length
      ? Employee.find(
          { employeeCode: { $in: employeeCodes } },
          '_id employeeCode displayName email departmentId positionId lineId shiftId reportsToEmployeeId lineManagerIds otWorkflowRole isActive',
        ).lean()
      : [],

    emails.length
      ? Employee.find({ email: { $in: emails } }, '_id employeeCode email').lean()
      : [],
  ])

  const departmentByCode = new Map(departments.map((item) => [upper(item.code), item]))
  const positionByCode = new Map(positions.map((item) => [upper(item.code), item]))
  const lineByCode = new Map(lines.map((item) => [upper(item.code), item]))
  const shiftByCode = new Map(shifts.map((item) => [upper(item.code), item]))

  const employeeByCode = new Map(
    existingEmployees.map((employee) => [upper(employee.employeeCode), employee]),
  )

  const emailOwnerByEmail = new Map(
    existingEmailOwners.map((item) => [s(item.email).toLowerCase(), item]),
  )

  const createdEmployeeIds = []
  let createdCount = 0
  let updatedCount = 0

  for (const row of parsedRows) {
    const existing = employeeByCode.get(row.employeeCode) || null

    const department = departmentByCode.get(row.departmentCode)

    if (!department) {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_DEPARTMENT_NOT_FOUND',
        messageKey: 'org.employee.import.error.departmentNotFound',
        message: `Row ${row.rowNo}: Department Code not found`,
        params: {
          rowNo: row.rowNo,
          departmentCode: row.departmentCode,
        },
      })
    }

    const position = positionByCode.get(row.positionCode)

    if (!position) {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_POSITION_NOT_FOUND',
        messageKey: 'org.employee.import.error.positionNotFound',
        message: `Row ${row.rowNo}: Position Code not found`,
        params: {
          rowNo: row.rowNo,
          positionCode: row.positionCode,
        },
      })
    }

    if (!sameId(position.departmentId, department._id)) {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_POSITION_DEPARTMENT_MISMATCH',
        messageKey: 'org.employee.import.error.positionDepartmentMismatch',
        message: `Row ${row.rowNo}: Position does not belong to Department`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    const line = row.lineCode ? lineByCode.get(row.lineCode) : null

    if (row.lineCode && !line) {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_LINE_NOT_FOUND',
        messageKey: 'org.employee.import.error.lineNotFound',
        message: `Row ${row.rowNo}: Line Code not found`,
        params: {
          rowNo: row.rowNo,
          lineCode: row.lineCode,
        },
      })
    }

    if (line) {
      await ensureLineAllowed(line._id, department._id, position._id)
    }

    const shift = shiftByCode.get(row.shiftCode)

    if (!shift) {
      throw appError({
        statusCode: 400,
        code: 'EMPLOYEE_IMPORT_SHIFT_NOT_FOUND',
        messageKey: 'org.employee.import.error.shiftNotFound',
        message: `Row ${row.rowNo}: Shift Code not found or inactive`,
        params: {
          rowNo: row.rowNo,
          shiftCode: row.shiftCode,
        },
      })
    }

    if (row.email) {
      const owner = emailOwnerByEmail.get(row.email)

      if (owner && !sameId(owner._id, existing?._id)) {
        throw appError({
          statusCode: 409,
          code: 'EMPLOYEE_EMAIL_EXISTS',
          messageKey: 'org.employee.error.emailExists',
          message: `Row ${row.rowNo}: Email already exists`,
          field: 'email',
          params: {
            rowNo: row.rowNo,
            email: row.email,
          },
        })
      }
    }

    let manualReportsToEmployeeId = null

    if (row.reportsToEmployeeCode) {
      const manager = employeeByCode.get(row.reportsToEmployeeCode)

      if (!manager) {
        throw appError({
          statusCode: 400,
          code: 'EMPLOYEE_IMPORT_MANAGER_NOT_FOUND',
          messageKey: 'org.employee.import.error.managerNotFound',
          message: `Row ${row.rowNo}: Reports To Employee Code not found`,
          params: {
            rowNo: row.rowNo,
            reportsToEmployeeCode: row.reportsToEmployeeCode,
          },
        })
      }

      if (existing && sameId(existing._id, manager._id)) {
        throw appError({
          statusCode: 400,
          code: 'EMPLOYEE_REPORT_TO_SELF',
          messageKey: 'org.employee.error.reportToSelf',
          message: `Row ${row.rowNo}: Employee cannot report to self`,
          params: {
            rowNo: row.rowNo,
          },
        })
      }

      manualReportsToEmployeeId = manager._id
    }

    const managerResult = await resolveFinalManagerIds({
      employeeId: existing?._id || null,
      departmentId: department._id,
      position,
      lineId: line?._id || null,
      manualReportsToEmployeeId,
    })

    const payload = {
      employeeCode: row.employeeCode,
      displayName: row.displayName,
      departmentId: department._id,
      positionId: position._id,
      lineId: line?._id || null,
      shiftId: shift._id,
      reportsToEmployeeId: managerResult.primaryManagerId || null,
      lineManagerIds: managerResult.lineManagerIds || [],
      otWorkflowRole: normalizeOTWorkflowRole(row.otWorkflowRole),
      phone: row.phone || '',
      email: row.email || '',
      joinDate: row.joinDate || null,
      isActive: typeof row.isActive === 'boolean' ? row.isActive : true,
    }

    if (!existing) {
      const created = await Employee.create(payload)

      createdEmployeeIds.push(id(created._id))
      createdCount += 1

      employeeByCode.set(row.employeeCode, {
        _id: created._id,
        employeeCode: row.employeeCode,
        displayName: row.displayName,
        email: row.email || '',
        isActive: true,
      })

      if (row.email) {
        emailOwnerByEmail.set(row.email, {
          _id: created._id,
          employeeCode: row.employeeCode,
          email: row.email,
        })
      }

      continue
    }

    await Employee.updateOne(
      {
        _id: existing._id,
      },
      {
        $set: payload,
      },
    )

    employeeByCode.set(row.employeeCode, {
      ...existing,
      ...payload,
      _id: existing._id,
    })

    if (row.email) {
      emailOwnerByEmail.set(row.email, {
        _id: existing._id,
        employeeCode: row.employeeCode,
        email: row.email,
      })
    }

    updatedCount += 1
  }

  await syncSameLineManagersForAllEmployees()

  return {
    fileName: file.fileName || 'employee-import.xlsx',
    summary: {
      totalRows: parsedRows.length,
      created: createdCount,
      updated: updatedCount,
    },
    createdEmployeeIds,
    messageKey: 'org.employee.import.success.completed',
  }
}

async function getById(employeeId, currentUser = null) {
  await ensureObjectId(employeeId, 'employeeId')
  await assertReadableEmployee(currentUser, employeeId)

  const [doc, accountDoc] = await Promise.all([
    Employee.findById(employeeId)
      .populate('departmentId', 'name code')
      .populate('positionId', 'name code reportsToPositionId managerScope')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime breakStartTime breakEndTime endTime crossMidnight')
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
    .populate('positionId', 'name code reportsToPositionId managerScope')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime breakStartTime breakEndTime crossMidnight')
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
      .populate('positionId', 'name code reportsToPositionId managerScope')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime endTime breakStartTime breakEndTime crossMidnight')
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
    .populate('positionId', 'name code reportsToPositionId managerScope')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime breakStartTime breakEndTime crossMidnight')
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
  const item = sanitizeOrgNode(employee)

  return {
    key: item.id,
    expanded,
    selectable: true,
    data: {
      ...item,
      name: item.displayName,
      title: item.positionName || 'No position',
      department: item.departmentName || 'No department',
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
    const current = employeeMap.get(currentId)

    if (!parentIds.length && current?.reportsToEmployeeId) {
      parentIds.push(id(current.reportsToEmployeeId))
    }

    for (const parentId of parentIds) {
      if (parentId && !visited.has(parentId)) {
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
    },
  )
    .populate('departmentId', 'name code')
    .populate('positionId', 'name code')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime breakStartTime breakEndTime crossMidnight')
    .populate('lineManagerIds', 'employeeCode displayName')
    .lean()

  const normalized = allDocs.map((doc) => sanitize(doc))
  const employeeMap = new Map(normalized.map((employee) => [employee.id, employee]))

  const childrenMap = new Map()
  const parentIdsByEmployeeId = new Map()

  for (const employee of normalized) {
    const lineManagerIds = uniqueIds(employee.lineManagerIds || [])

    const candidateParentIds = lineManagerIds.length
      ? lineManagerIds
      : employee.reportsToEmployeeId
        ? [employee.reportsToEmployeeId]
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

  const rootCandidates = normalized
    .filter((employee) => {
      const parentIds = parentIdsByEmployeeId.get(employee.id) || []

      return !parentIds.length
    })
    .sort((a, b) =>
      `${a.displayName} ${a.employeeCode}`.localeCompare(
        `${b.displayName} ${b.employeeCode}`,
      ),
    )

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
  } else {
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
      positionName: employee.positionName,
      departmentName: employee.departmentName,
      lineName: employee.lineName,
      lineCode: employee.lineCode,
      shiftName: employee.shiftName,
      shiftCode: employee.shiftCode,
      shiftStartTime: employee.shiftStartTime,
      shiftEndTime: employee.shiftEndTime,
      otWorkflowRole: employee.otWorkflowRole,
      lineManagerIds: employee.lineManagerIds,
      lineManagers: employee.lineManagers,
    })),
    matchedEmployeeIds: matchedIds,
    expandedEmployeeIds: Array.from(expandedIds),
    totalVisibleEmployees: normalized.length,
    tree,
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
        managerScope: 1,
      },
    ).lean(),
  ])

  const positionById = new Map(positions.map((position) => [id(position._id), position]))
  const employeesByPositionDepartmentLine = new Map()
  const employeesByPosition = new Map()

  for (const employee of employees) {
    const positionId = id(employee.positionId)
    const departmentId = id(employee.departmentId)
    const lineId = id(employee.lineId)

    if (positionId) {
      if (!employeesByPosition.has(positionId)) {
        employeesByPosition.set(positionId, [])
      }

      employeesByPosition.get(positionId).push(employee)
    }

    if (positionId && departmentId && lineId) {
      const key = `${positionId}:${departmentId}:${lineId}`

      if (!employeesByPositionDepartmentLine.has(key)) {
        employeesByPositionDepartmentLine.set(key, [])
      }

      employeesByPositionDepartmentLine.get(key).push(employee)
    }
  }

  for (const group of employeesByPositionDepartmentLine.values()) {
    group.sort((a, b) =>
      `${a.employeeCode || ''} ${a.displayName || ''} ${a._id || ''}`.localeCompare(
        `${b.employeeCode || ''} ${b.displayName || ''} ${b._id || ''}`,
      ),
    )
  }

  for (const group of employeesByPosition.values()) {
    group.sort((a, b) =>
      `${a.employeeCode || ''} ${a.displayName || ''} ${a._id || ''}`.localeCompare(
        `${b.employeeCode || ''} ${b.displayName || ''} ${b._id || ''}`,
      ),
    )
  }

  const operations = []

  for (const employee of employees) {
    const employeeId = id(employee._id)
    const position = positionById.get(id(employee.positionId))

    if (!position?.reportsToPositionId) continue

    const parentPositionId = id(position.reportsToPositionId)
    const managerScope = upper(position.managerScope || 'SAME_LINE')

    let managerCandidates = []

    if (managerScope === 'SAME_LINE') {
      const departmentId = id(employee.departmentId)
      const lineId = id(employee.lineId)

      if (parentPositionId && departmentId && lineId) {
        const key = `${parentPositionId}:${departmentId}:${lineId}`
        managerCandidates = employeesByPositionDepartmentLine.get(key) || []
      }
    } else {
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

  const department = await ensureDepartmentExists(payload.departmentId)
  const position = await ensurePositionExists(payload.positionId, department._id)

  await ensureShiftExists(payload.shiftId)
  await ensureLineAllowed(payload.lineId, department._id, position._id)

  const managerResult = await resolveFinalManagerIds({
    employeeId: null,
    departmentId: department._id,
    position,
    lineId: payload.lineId || null,
    manualReportsToEmployeeId: payload.reportsToEmployeeId || null,
  })

  const doc = await Employee.create({
    employeeCode: upper(payload.employeeCode || ''),
    displayName: s(payload.displayName),
    departmentId: payload.departmentId,
    positionId: payload.positionId,
    lineId: payload.lineId || null,
    shiftId: payload.shiftId,
    reportsToEmployeeId: managerResult.primaryManagerId || null,
    lineManagerIds: managerResult.lineManagerIds || [],
    otWorkflowRole: normalizeOTWorkflowRole(payload.otWorkflowRole),
    phone: s(payload.phone),
    email: s(payload.email).toLowerCase(),
    joinDate: payload.joinDate || null,
    isActive: payload.isActive ?? true,
  })

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
  const nextLineId = payload.lineId !== undefined ? payload.lineId : doc.lineId
  const nextShiftId = payload.shiftId !== undefined ? payload.shiftId : doc.shiftId

  if (payload.employeeCode !== undefined && nextEmployeeCode !== upper(doc.employeeCode)) {
    await ensureEmployeeCodeUnique(nextEmployeeCode, doc._id)
  }

  if (payload.email !== undefined && nextEmail !== s(doc.email).toLowerCase()) {
    await ensureEmailUnique(nextEmail, doc._id)
  }

  const department = await ensureDepartmentExists(nextDepartmentId)
  const position = await ensurePositionExists(nextPositionId, department._id)

  await ensureShiftExists(nextShiftId)
  await ensureLineAllowed(nextLineId, department._id, position._id)

  const shouldRefreshManager =
    payload.departmentId !== undefined ||
    payload.positionId !== undefined ||
    payload.lineId !== undefined ||
    payload.reportsToEmployeeId !== undefined

  doc.employeeCode = nextEmployeeCode
  doc.displayName = nextDisplayName
  doc.departmentId = nextDepartmentId
  doc.positionId = nextPositionId
  doc.lineId = nextLineId || null
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
      lineId: nextLineId || null,
      manualReportsToEmployeeId:
        payload.reportsToEmployeeId !== undefined
          ? payload.reportsToEmployeeId
          : doc.reportsToEmployeeId,
    })

    doc.reportsToEmployeeId = managerResult.primaryManagerId || null
    doc.lineManagerIds = managerResult.lineManagerIds || []
  }

  await doc.save()

  await syncSameLineManagersForAllEmployees()

  return getById(doc._id, currentUser)
}

module.exports = {
  lookup,
  list,
  exportExcel,
  downloadImportSample,
  importExcel,
  getById,
  getOrgChart,
  getOrgTree,
  create,
  update,
  syncSameLineManagersForAllEmployees,
}