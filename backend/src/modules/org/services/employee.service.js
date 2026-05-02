// backend/src/modules/org/services/employee.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const Employee = require('../models/Employee')
const Department = require('../models/Department')
const Position = require('../models/Position')
const ProductionLine = require('../models/ProductionLine')
const Shift = require('../../shift/models/Shift')
const Account = require('../../auth/models/Account')
const accountService = require('../../auth/services/account.service')
const { importEmployeeRowSchema } = require('../validators/employee.validation')

function s(v) {
  return String(v ?? '').trim()
}

function escapeRegex(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toObjectId(value) {
  if (!value) return null
  if (!mongoose.Types.ObjectId.isValid(String(value))) return null
  return new mongoose.Types.ObjectId(String(value))
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

function toInternalDateString(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function formatDate(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatDateDDMMYYYY(value) {
  if (!value) return ''

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = value.getDate()
    const month = value.getMonth() + 1
    const year = value.getFullYear()

    if (!isValidDateParts(year, month, day)) return ''

    return `${pad2(day)}/${pad2(month)}/${year}`
  }

  const raw = s(value)

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    if (!isValidDateParts(year, month, day)) return ''

    return `${pad2(day)}/${pad2(month)}/${year}`
  }

  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    if (!isValidDateParts(year, month, day)) return ''

    return `${pad2(day)}/${pad2(month)}/${year}`
  }

  const date = new Date(raw)
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
    return ''
  }

  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()

  if (!isValidDateParts(year, month, day)) {
    return ''
  }

  return toInternalDateString(year, month, day)
}

function normalizeImportDateDDMMYYYY(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = value.getMonth() + 1
    const day = value.getDate()

    if (!isValidDateParts(year, month, day)) {
      return ''
    }

    return toInternalDateString(year, month, day)
  }

  if (typeof value === 'number') {
    return parseExcelSerialDate(value)
  }

  const raw = s(value)

  if (!raw) {
    return ''
  }

  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    if (!isValidDateParts(year, month, day)) {
      return ''
    }

    return toInternalDateString(year, month, day)
  }

  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    if (!isValidDateParts(year, month, day)) {
      return ''
    }

    return toInternalDateString(year, month, day)
  }

  match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])

    if (!isValidDateParts(year, month, day)) {
      return ''
    }

    return toInternalDateString(year, month, day)
  }

  return ''
}

function normalizeImportStatus(value) {
  const raw = s(value)

  if (!raw) {
    return true
  }

  const text = raw.toLowerCase()

  if (['active', 'true', 'yes', 'y', '1'].includes(text)) {
    return true
  }

  if (['inactive', 'false', 'no', 'n', '0'].includes(text)) {
    return false
  }

  return null
}

function getImportField(raw = {}, keys = []) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && s(raw[key]) !== '') {
      return raw[key]
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
    accountId: String(accountDoc._id),
    accountLoginId: accountDoc.loginId,
    accountIsActive: !!accountDoc.isActive,
  }
}

function buildShiftSummary(shiftValue) {
  const shiftId = shiftValue?._id
    ? String(shiftValue._id)
    : shiftValue
      ? String(shiftValue)
      : null

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
    shiftId,
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
          _id: shiftId,
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
  const lineId = lineValue?._id
    ? String(lineValue._id)
    : lineValue
      ? String(lineValue)
      : null

  return {
    lineId,
    lineCode: lineValue?.code || '',
    lineName: lineValue?.name || '',
    line: lineId
      ? {
          _id: lineId,
          code: lineValue?.code || '',
          name: lineValue?.name || '',
        }
      : null,
  }
}

function sanitize(doc, accountDoc = null) {
  if (!doc) return null

  return {
    _id: String(doc._id),
    id: String(doc._id),
    employeeNo: doc.employeeNo,
    displayName: doc.displayName,

    departmentId: doc.departmentId?._id
      ? String(doc.departmentId._id)
      : doc.departmentId
        ? String(doc.departmentId)
        : null,
    departmentCode: doc.departmentId?.code || '',
    departmentName: doc.departmentId?.name || '',

    positionId: doc.positionId?._id
      ? String(doc.positionId._id)
      : doc.positionId
        ? String(doc.positionId)
        : null,
    positionCode: doc.positionId?.code || '',
    positionName: doc.positionId?.name || '',
    reportsToPositionId: doc.positionId?.reportsToPositionId
      ? String(doc.positionId.reportsToPositionId)
      : null,

    ...buildLineSummary(doc.lineId),
    ...buildShiftSummary(doc.shiftId),

    reportsToEmployeeId: doc.reportsToEmployeeId?._id
      ? String(doc.reportsToEmployeeId._id)
      : doc.reportsToEmployeeId
        ? String(doc.reportsToEmployeeId)
        : null,
    reportsToEmployeeNo: doc.reportsToEmployeeId?.employeeNo || '',
    reportsToEmployeeName: doc.reportsToEmployeeId?.displayName || '',

    phone: doc.phone || '',
    email: doc.email || '',
    joinDate: doc.joinDate || null,
    isActive: !!doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,

    ...buildAccountSummary(accountDoc),
  }
}

function sanitizeOrgNode(doc) {
  if (!doc) return null

  return {
    _id: String(doc._id),
    id: String(doc._id),
    employeeNo: doc.employeeNo,
    displayName: doc.displayName,

    departmentId: doc.departmentId?._id
      ? String(doc.departmentId._id)
      : doc.departmentId
        ? String(doc.departmentId)
        : null,
    departmentName: doc.departmentId?.name || '',

    positionId: doc.positionId?._id
      ? String(doc.positionId._id)
      : doc.positionId
        ? String(doc.positionId)
        : null,
    positionName: doc.positionId?.name || '',

    ...buildLineSummary(doc.lineId),
    ...buildShiftSummary(doc.shiftId),

    reportsToEmployeeId: doc.reportsToEmployeeId?._id
      ? String(doc.reportsToEmployeeId._id)
      : doc.reportsToEmployeeId
        ? String(doc.reportsToEmployeeId)
        : null,
    reportsToEmployeeName: doc.reportsToEmployeeId?.displayName || '',
    isActive: !!doc.isActive,
  }
}

function getPermissionCodes(user) {
  return Array.isArray(user?.effectivePermissionCodes)
    ? user.effectivePermissionCodes.map((x) => s(x).toUpperCase()).filter(Boolean)
    : []
}

function hasAnyPermission(user, codes = []) {
  const set = new Set(getPermissionCodes(user))
  return codes.some((code) => set.has(s(code).toUpperCase()))
}

async function ensureDepartmentExists(departmentId) {
  const department = await Department.findById(departmentId).select('_id code name isActive').lean()

  if (!department) {
    const err = new Error('Department not found')
    err.status = 404
    throw err
  }

  return department
}

async function ensurePositionExists(positionId, departmentId = null) {
  const position = await Position.findById(positionId)
    .select('_id code name departmentId reportsToPositionId isActive')
    .lean()

  if (!position) {
    const err = new Error('Position not found')
    err.status = 404
    throw err
  }

  if (departmentId && String(position.departmentId) !== String(departmentId)) {
    const err = new Error('Position does not belong to selected department')
    err.status = 400
    throw err
  }

  return position
}

async function ensureLineAllowed(lineId, departmentId, positionId) {
  if (!lineId) return null

  const line = await ProductionLine.findById(lineId)
    .select('_id code name departmentId positionIds isActive')
    .lean()

  if (!line) {
    const err = new Error('Line not found')
    err.status = 404
    throw err
  }

  if (line.isActive === false) {
    const err = new Error('Line is inactive')
    err.status = 400
    throw err
  }

  if (departmentId && String(line.departmentId) !== String(departmentId)) {
    const err = new Error('Line does not belong to selected department')
    err.status = 400
    throw err
  }

  const allowedPositionIds = Array.isArray(line.positionIds)
    ? line.positionIds.map((item) => String(item))
    : []

  if (allowedPositionIds.length && positionId && !allowedPositionIds.includes(String(positionId))) {
    const err = new Error('Selected line does not allow this position')
    err.status = 400
    throw err
  }

  return line
}

async function ensureShiftExists(shiftId) {
  const shift = await Shift.findOne({ _id: shiftId, isActive: true })
    .select('_id code name isActive')
    .lean()

  if (!shift) {
    const err = new Error('Shift not found or inactive')
    err.status = 404
    throw err
  }

  return shift
}

async function ensureReportsToEmployeeExists(employeeId) {
  if (!employeeId) return null

  const employee = await Employee.findById(employeeId)
    .select('_id employeeNo displayName isActive')
    .lean()

  if (!employee) {
    const err = new Error('Reports-to employee not found')
    err.status = 404
    throw err
  }

  return employee
}

async function ensureEmployeeNoUnique(employeeNo, excludeId = null) {
  const filter = { employeeNo: s(employeeNo).toUpperCase() }
  if (excludeId) filter._id = { $ne: excludeId }

  const exists = await Employee.exists(filter)
  if (exists) {
    const err = new Error('Employee No already exists')
    err.status = 409
    throw err
  }
}

async function ensureEmailUnique(email, excludeId = null) {
  const normalized = s(email).toLowerCase()
  if (!normalized) return

  const filter = { email: normalized }
  if (excludeId) filter._id = { $ne: excludeId }

  const exists = await Employee.exists(filter)
  if (exists) {
    const err = new Error('Email already exists')
    err.status = 409
    throw err
  }
}

async function findAutoManagerIdByPositionAndLine({
  employeeId = null,
  departmentId,
  position,
  lineId,
}) {
  if (!position?.reportsToPositionId || !lineId) {
    return undefined
  }

  const filter = {
    departmentId,
    positionId: position.reportsToPositionId,
    lineId,
    isActive: true,
  }

  if (employeeId) {
    filter._id = { $ne: employeeId }
  }

  const manager = await Employee.findOne(filter)
    .select('_id employeeNo displayName')
    .sort({ employeeNo: 1, displayName: 1, _id: 1 })
    .lean()

  return manager?._id || null
}

async function resolveFinalReportsToEmployeeId({
  employeeId = null,
  departmentId,
  position,
  lineId,
  manualReportsToEmployeeId = null,
}) {
  const autoManagerId = await findAutoManagerIdByPositionAndLine({
    employeeId,
    departmentId,
    position,
    lineId,
  })

  if (autoManagerId !== undefined) {
    return autoManagerId
  }

  if (!manualReportsToEmployeeId) {
    return null
  }

  if (employeeId && String(manualReportsToEmployeeId) === String(employeeId)) {
    const err = new Error('Employee cannot report to self')
    err.status = 400
    throw err
  }

  await ensureReportsToEmployeeExists(manualReportsToEmployeeId)
  return manualReportsToEmployeeId
}

async function findAccountByEmployeeOrLogin({ employeeId, loginId }) {
  const or = []

  if (employeeId) or.push({ employeeId })
  if (loginId) or.push({ loginId: s(loginId).toLowerCase() })

  if (!or.length) return null
  return Account.findOne({ $or: or }).lean()
}

async function createProvisionedAccount(employeeDoc) {
  const employeeId = employeeDoc._id
  const employeeNo = s(employeeDoc.employeeNo)
  const phone = s(employeeDoc.phone)
  const displayName = s(employeeDoc.displayName)
  const loginId = employeeNo.toLowerCase()

  if (!employeeNo) {
    const err = new Error('Employee No is required to create account')
    err.status = 400
    throw err
  }

  if (!phone) {
    const err = new Error('Phone is required to create account')
    err.status = 400
    throw err
  }

  const existing = await findAccountByEmployeeOrLogin({
    employeeId,
    loginId,
  })

  if (existing) {
    const err = new Error('Account already exists for this employee or login ID')
    err.status = 409
    throw err
  }

  return accountService.create({
    loginId: employeeNo,
    password: `${employeeNo}${phone}`,
    displayName,
    employeeId: String(employeeId),
    roleIds: [],
    directPermissionCodes: [],
    mustChangePassword: true,
    isActive: true,
  })
}

async function resolveCurrentUserEmployeeId(currentUser) {
  const directEmployeeId =
    currentUser?.employeeId ||
    currentUser?.employee?._id ||
    currentUser?.employee?.id ||
    currentUser?.profile?.employeeId

  if (directEmployeeId && mongoose.Types.ObjectId.isValid(String(directEmployeeId))) {
    return String(directEmployeeId)
  }

  const accountId =
    currentUser?.accountId ||
    currentUser?.id ||
    currentUser?._id ||
    currentUser?.sub

  if (accountId && mongoose.Types.ObjectId.isValid(String(accountId))) {
    const account = await Account.findById(accountId, 'employeeId').lean()
    if (account?.employeeId && mongoose.Types.ObjectId.isValid(String(account.employeeId))) {
      return String(account.employeeId)
    }
  }

  return null
}

async function getScopedEmployeeIds(currentUser) {
  const isRootAdmin = !!currentUser?.isRootAdmin

  const canViewAll =
    isRootAdmin ||
    hasAnyPermission(currentUser, [
      'EMPLOYEE_VIEW_ALL',
      'ORG_EMPLOYEE_VIEW_ALL',
      'ORG.EMPLOYEE_VIEW_ALL',
      'ROOT_ADMIN',
    ])

  const baseEmployees = await Employee.find(
    { isActive: true },
    { _id: 1, reportsToEmployeeId: 1 },
  ).lean()

  if (canViewAll) {
    return new Set(baseEmployees.map((x) => String(x._id)))
  }

  const myEmployeeId = await resolveCurrentUserEmployeeId(currentUser)
  if (!myEmployeeId) return new Set()

  const childrenMap = new Map()

  for (const emp of baseEmployees) {
    const managerId = emp.reportsToEmployeeId ? String(emp.reportsToEmployeeId) : ''

    if (!childrenMap.has(managerId)) {
      childrenMap.set(managerId, [])
    }

    childrenMap.get(managerId).push(String(emp._id))
  }

  const result = new Set([String(myEmployeeId)])
  const queue = [...(childrenMap.get(String(myEmployeeId)) || [])]

  while (queue.length) {
    const currentId = queue.shift()

    if (!currentId || result.has(currentId)) continue

    result.add(currentId)

    const children = childrenMap.get(currentId) || []

    for (const childId of children) {
      if (!result.has(childId)) {
        queue.push(childId)
      }
    }
  }

  return result
}

async function buildEmployeeScopeFilter(currentUser) {
  const scopedIds = await getScopedEmployeeIds(currentUser)
  if (!scopedIds.size) {
    return { _id: { $in: [] } }
  }

  return {
    _id: {
      $in: Array.from(scopedIds).map((id) => new mongoose.Types.ObjectId(id)),
    },
  }
}

function makeOrgTreeNode(emp, children = [], expanded = false, highlighted = false) {
  const id = String(emp._id)

  return {
    key: id,
    expanded,
    selectable: true,
    data: {
      id,
      employeeNo: emp.employeeNo || '',
      name: emp.displayName || 'Unknown',
      title: emp.positionName || 'No position',
      department: emp.departmentName || 'No department',
      lineName: emp.lineName || '',
      lineCode: emp.lineCode || '',
      shiftName: emp.shiftName || '',
      shiftCode: emp.shiftCode || '',
      shiftStartTime: emp.shiftStartTime || '',
      shiftEndTime: emp.shiftEndTime || '',
      isActive: !!emp.isActive,
      reportsToEmployeeId: emp.reportsToEmployeeId ? String(emp.reportsToEmployeeId) : null,
      highlighted,
    },
    children,
  }
}

function buildTreeRecursive(rootId, employeeMap, childrenMap, expandedIds, highlightedIds) {
  const emp = employeeMap.get(rootId)
  if (!emp) return null

  const childIds = childrenMap.get(rootId) || []
  const children = childIds
    .map((childId) =>
      buildTreeRecursive(childId, employeeMap, childrenMap, expandedIds, highlightedIds),
    )
    .filter(Boolean)

  return makeOrgTreeNode(
    emp,
    children,
    expandedIds.has(rootId),
    highlightedIds.has(rootId),
  )
}

function collectAncestorIds(startId, employeeMap) {
  const result = []
  const visited = new Set()
  let currentId = startId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    result.push(currentId)
    const current = employeeMap.get(currentId)
    currentId = current?.reportsToEmployeeId ? String(current.reportsToEmployeeId) : null
  }

  return result.reverse()
}

function searchEmployees(allEmployees, keyword) {
  const q = s(keyword).toLowerCase()
  if (!q) return []

  return allEmployees.filter((emp) => {
    return [
      emp.employeeNo,
      emp.displayName,
      emp.email,
      emp.departmentName,
      emp.positionName,
      emp.lineName,
      emp.lineCode,
      emp.shiftName,
      emp.shiftCode,
    ]
      .map((v) => s(v).toLowerCase())
      .some((v) => v.includes(q))
  })
}

function buildEmployeeListFilter(
  {
    search,
    departmentId,
    positionId,
    lineId,
    shiftId,
    isActive,
  },
  scopeFilter = {},
) {
  const filter = { ...scopeFilter }

  const keyword = s(search)
  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')
    filter.$or = [
      { employeeNo: regex },
      { displayName: regex },
      { phone: regex },
      { email: regex },
    ]
  }

  if (departmentId) {
    const departmentObjectId = toObjectId(departmentId)
    if (departmentObjectId) filter.departmentId = departmentObjectId
  }

  if (positionId) {
    const positionObjectId = toObjectId(positionId)
    if (positionObjectId) filter.positionId = positionObjectId
  }

  if (lineId) {
    const lineObjectId = toObjectId(lineId)
    if (lineObjectId) filter.lineId = lineObjectId
  }

  if (shiftId) {
    const shiftObjectId = toObjectId(shiftId)
    if (shiftObjectId) filter.shiftId = shiftObjectId
  }

  if (typeof isActive === 'boolean') {
    filter.isActive = isActive
  }

  return filter
}

function buildEmployeeSort(sortBy, sortOrder) {
  return {
    [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1,
  }
}

function normalizeLookupQuery(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50)

  let isActive = true
  if (String(query.isActive ?? '').trim().toLowerCase() === 'false') {
    isActive = false
  }
  if (String(query.isActive ?? '').trim() === '') {
    isActive = true
  }

  return {
    search: s(query.search),
    departmentId: s(query.departmentId),
    positionId: s(query.positionId),
    lineId: s(query.lineId),
    shiftId: s(query.shiftId),
    reportsToEmployeeId: s(query.reportsToEmployeeId),
    isActive,
    limit,
  }
}

function buildEmployeeLookupItem(doc) {
  return {
    id: String(doc._id),
    employeeNo: doc.employeeNo || '',
    displayName: doc.displayName || '',
    label: [doc.employeeNo, doc.displayName].filter(Boolean).join(' - '),

    departmentId: doc.departmentId?._id
      ? String(doc.departmentId._id)
      : doc.departmentId
        ? String(doc.departmentId)
        : null,
    departmentCode: doc.departmentId?.code || '',
    departmentName: doc.departmentId?.name || '',

    positionId: doc.positionId?._id
      ? String(doc.positionId._id)
      : doc.positionId
        ? String(doc.positionId)
        : null,
    positionCode: doc.positionId?.code || '',
    positionName: doc.positionId?.name || '',

    ...buildLineSummary(doc.lineId),
    ...buildShiftSummary(doc.shiftId),

    reportsToEmployeeId: doc.reportsToEmployeeId?._id
      ? String(doc.reportsToEmployeeId._id)
      : doc.reportsToEmployeeId
        ? String(doc.reportsToEmployeeId)
        : null,
    reportsToEmployeeNo: doc.reportsToEmployeeId?.employeeNo || '',
    reportsToEmployeeName: doc.reportsToEmployeeId?.displayName || '',

    phone: doc.phone || '',
    email: doc.email || '',
    isActive: !!doc.isActive,
  }
}

async function lookup(rawQuery = {}, currentUser = null) {
  const query = normalizeLookupQuery(rawQuery)
  const scopeFilter = await buildEmployeeScopeFilter(currentUser)

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

  if (query.reportsToEmployeeId) {
    const managerObjectId = toObjectId(query.reportsToEmployeeId)
    if (managerObjectId) {
      filter.reportsToEmployeeId = managerObjectId
    }
  }

  const items = await Employee.find(filter)
    .populate('departmentId', 'name code')
    .populate('positionId', 'name code reportsToPositionId')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime crossMidnight')
    .populate('reportsToEmployeeId', 'employeeNo displayName')
    .sort({ displayName: 1, employeeNo: 1 })
    .limit(query.limit)
    .lean()

  return {
    items: items.map(buildEmployeeLookupItem),
    meta: {
      limit: query.limit,
      count: items.length,
    },
  }
}

async function loadAccountMapForEmployees() {
  const accounts = await Account.find({}, 'employeeId loginId isActive').lean()
  const accountByEmployeeId = new Map()

  for (const acc of accounts) {
    if (acc.employeeId) {
      accountByEmployeeId.set(String(acc.employeeId), acc)
    }
  }

  return accountByEmployeeId
}

function buildEmployeeExportRows(items = []) {
  return items.map((item, index) => ({
    No: index + 1,
    'Employee No': item.employeeNo || '',
    'Display Name': item.displayName || '',
    Department: item.departmentName || '',
    Position: item.positionName || '',
    'Line Code': item.lineCode || '',
    'Line Name': item.lineName || '',
    'Shift Code': item.shiftCode || '',
    'Shift Name': item.shiftName || '',
    'Shift Type': item.shiftType || '',
    'Manager Employee No': item.reportsToEmployeeNo || '',
    'Manager Name': item.reportsToEmployeeName || '',
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

function normalizeImportRow(raw = {}) {
  const rawJoinDate = getImportField(raw, [
    'joinDate',
    'Join Date',
    'join date',
    'JoinDate',
    'JOIN DATE',
  ])

  const rawStatus = getImportField(raw, [
    'isActive',
    'Status',
    'status',
    'STATUS',
  ])

  return {
    employeeNo: s(raw.employeeNo || raw['Employee No']).toUpperCase(),
    displayName: s(raw.displayName || raw['Display Name']),
    departmentCode: s(raw.departmentCode || raw['Department Code']).toUpperCase(),
    positionCode: s(raw.positionCode || raw['Position Code']).toUpperCase(),
    lineCode: s(raw.lineCode || raw['Line Code']).toUpperCase(),
    shiftCode: s(raw.shiftCode || raw['Shift Code']).toUpperCase(),
    reportsToEmployeeNo: s(raw.reportsToEmployeeNo || raw['Reports To Employee No']).toUpperCase(),
    phone: s(raw.phone || raw.Phone),
    email: s(raw.email || raw.Email).toLowerCase(),
    joinDate: normalizeImportDateDDMMYYYY(rawJoinDate),
    rawJoinDate,
    isActive: normalizeImportStatus(rawStatus),
    rawStatus,
  }
}

async function getOrgTree(
  {
    rootEmployeeId = '',
    search = '',
    includeInactive = false,
  } = {},
  currentUser = null,
) {
  const scopedIds = await getScopedEmployeeIds(currentUser)

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
      _id: { $in: Array.from(scopedIds).map((id) => new mongoose.Types.ObjectId(id)) },
      ...(includeInactive ? {} : { isActive: true }),
    },
    {
      employeeNo: 1,
      displayName: 1,
      departmentId: 1,
      positionId: 1,
      lineId: 1,
      shiftId: 1,
      reportsToEmployeeId: 1,
      isActive: 1,
      email: 1,
    },
  )
    .populate('departmentId', 'name')
    .populate('positionId', 'name')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime crossMidnight')
    .lean()

  const normalized = allDocs.map((doc) => ({
    _id: String(doc._id),
    employeeNo: doc.employeeNo || '',
    displayName: doc.displayName || '',
    departmentId: doc.departmentId?._id ? String(doc.departmentId._id) : null,
    departmentName: doc.departmentId?.name || '',
    positionId: doc.positionId?._id ? String(doc.positionId._id) : null,
    positionName: doc.positionId?.name || '',
    ...buildLineSummary(doc.lineId),
    ...buildShiftSummary(doc.shiftId),
    reportsToEmployeeId: doc.reportsToEmployeeId ? String(doc.reportsToEmployeeId) : null,
    isActive: !!doc.isActive,
    email: doc.email || '',
  }))

  const employeeMap = new Map()
  const childrenMap = new Map()

  for (const emp of normalized) {
    employeeMap.set(emp._id, emp)

    const managerId = emp.reportsToEmployeeId || ''
    if (!childrenMap.has(managerId)) childrenMap.set(managerId, [])
    childrenMap.get(managerId).push(emp._id)
  }

  for (const [managerId, childIds] of childrenMap.entries()) {
    childIds.sort((a, b) => {
      const aa = employeeMap.get(a)
      const bb = employeeMap.get(b)
      return `${aa?.displayName || ''} ${aa?.employeeNo || ''}`.localeCompare(
        `${bb?.displayName || ''} ${bb?.employeeNo || ''}`,
      )
    })
  }

  const rootCandidates = normalized
    .filter((emp) => !emp.reportsToEmployeeId || !employeeMap.has(emp.reportsToEmployeeId))
    .sort((a, b) => {
      return `${a.displayName} ${a.employeeNo}`.localeCompare(`${b.displayName} ${b.employeeNo}`)
    })

  let selectedRootId = s(rootEmployeeId)
  if (!selectedRootId || !employeeMap.has(selectedRootId)) {
    selectedRootId = rootCandidates[0]?._id || ''
  }

  const matched = searchEmployees(normalized, search)
  const matchedIds = matched.map((emp) => emp._id)

  const expandedIds = new Set()
  const highlightedIds = new Set(matchedIds)

  if (matchedIds.length) {
    for (const matchId of matchedIds) {
      const path = collectAncestorIds(matchId, employeeMap)
      for (const id of path) expandedIds.add(id)
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
    )
    if (rootNode) tree = [rootNode]
  } else {
    tree = rootCandidates
      .map((root) =>
        buildTreeRecursive(root._id, employeeMap, childrenMap, expandedIds, highlightedIds),
      )
      .filter(Boolean)
  }

  return {
    rootEmployeeId: selectedRootId || null,
    rootOptions: rootCandidates.map((emp) => ({
      id: emp._id,
      employeeNo: emp.employeeNo,
      displayName: emp.displayName,
      positionName: emp.positionName,
      departmentName: emp.departmentName,
      lineName: emp.lineName,
      lineCode: emp.lineCode,
      shiftName: emp.shiftName,
      shiftCode: emp.shiftCode,
      shiftStartTime: emp.shiftStartTime,
      shiftEndTime: emp.shiftEndTime,
    })),
    matchedEmployeeIds: matchedIds,
    expandedEmployeeIds: Array.from(expandedIds),
    totalVisibleEmployees: normalized.length,
    tree,
  }
}

async function list(
  {
    page,
    limit,
    search,
    departmentId,
    positionId,
    lineId,
    shiftId,
    isActive,
    sortBy,
    sortOrder,
  },
  currentUser = null,
) {
  const scopeFilter = await buildEmployeeScopeFilter(currentUser)
  const filter = buildEmployeeListFilter(
    { search, departmentId, positionId, lineId, shiftId, isActive },
    scopeFilter,
  )
  const sort = buildEmployeeSort(sortBy, sortOrder)
  const skip = (page - 1) * limit

  const [items, total, accountByEmployeeId] = await Promise.all([
    Employee.find(filter)
      .populate('departmentId', 'name code')
      .populate('positionId', 'name code reportsToPositionId')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime endTime crossMidnight')
      .populate('reportsToEmployeeId', 'employeeNo displayName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Employee.countDocuments(filter),
    loadAccountMapForEmployees(),
  ])

  return {
    items: items.map((item) =>
      sanitize(item, accountByEmployeeId.get(String(item._id)) || null),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

async function exportExcel(
  {
    search = '',
    departmentId = '',
    positionId = '',
    lineId = '',
    shiftId = '',
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {},
  currentUser = null,
) {
  const scopeFilter = await buildEmployeeScopeFilter(currentUser)
  const filter = buildEmployeeListFilter(
    { search, departmentId, positionId, lineId, shiftId, isActive },
    scopeFilter,
  )
  const sort = buildEmployeeSort(sortBy, sortOrder)

  const [items, accountByEmployeeId] = await Promise.all([
    Employee.find(filter)
      .populate('departmentId', 'name code')
      .populate('positionId', 'name code reportsToPositionId')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime endTime crossMidnight')
      .populate('reportsToEmployeeId', 'employeeNo displayName')
      .sort(sort)
      .lean(),
    loadAccountMapForEmployees(),
  ])

  const rows = items.map((item) =>
    sanitize(item, accountByEmployeeId.get(String(item._id)) || null),
  )

  const worksheet = XLSX.utils.json_to_sheet(buildEmployeeExportRows(rows))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees')

  return {
    filename: `employees-export-${formatDate(new Date()) || 'today'}.xlsx`,
    buffer: excelBufferFromWorkbook(workbook),
  }
}

async function downloadImportSample() {
  const sampleRows = [
    {
      'Employee No': 'EMP001',
      'Display Name': 'Mr A',
      'Department Code': 'SEWING',
      'Position Code': 'SEWER_SUPERVISOR',
      'Line Code': 'LINE-01',
      'Shift Code': 'DAY',
      'Reports To Employee No': '',
      Phone: '012345678',
      Email: 'mra@company.com',
      'Join Date': '30/04/2026',
      Status: 'Active',
    },
    {
      'Employee No': 'EMP002',
      'Display Name': 'Worker 001',
      'Department Code': 'SEWING',
      'Position Code': 'SEWER',
      'Line Code': 'LINE-01',
      'Shift Code': 'DAY',
      'Reports To Employee No': '',
      Phone: '098765432',
      Email: 'worker001@company.com',
      'Join Date': '30/04/2026',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Employee Import Guide', ''],
    ['', ''],
    ['Rule', 'Description'],
    ['Sheet order', 'Sheet 1 = Sample, Sheet 2 = Guide'],
    ['Employee No', 'Required. Must be unique. Import uses Employee No to create or update'],
    ['Display Name', 'Required'],
    ['Department Code', 'Required. Must already exist'],
    ['Position Code', 'Required. Must already exist and belong to Department Code'],
    ['Line Code', 'Optional. Required for production line employees like Sewer. Must already exist'],
    ['Shift Code', 'Required. Must already exist and be active'],
    [
      'Reports To Employee No',
      'Optional. If Position has ReportsToPositionId and Line Code is provided, system auto-finds manager by parent position + same line',
    ],
    ['Phone', 'Optional'],
    ['Email', 'Optional. Must be valid and unique if provided'],
    ['Join Date', 'Optional. Use DD/MM/YYYY format, example 30/04/2026'],
    ['Status', 'Optional. Use Active or Inactive. Blank = Active'],
    ['Account creation', 'Import does not create login accounts. Account provisioning stays in normal create/edit flow'],
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

async function importExcel(file, currentUser = null) {
  if (!file?.buffer) {
    const err = new Error('Excel file is required')
    err.status = 400
    throw err
  }

  const workbook = XLSX.read(file.buffer, {
    type: 'buffer',
    cellDates: true,
  })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    const err = new Error('Excel file has no worksheet')
    err.status = 400
    throw err
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
    dateNF: 'dd/mm/yyyy',
  })

  if (!rawRows.length) {
    const err = new Error('Excel file has no data rows')
    err.status = 400
    throw err
  }

  const scopeFilter = await buildEmployeeScopeFilter(currentUser)
  const canAccessAnyScope =
    !scopeFilter?._id?.$in || (Array.isArray(scopeFilter._id.$in) && scopeFilter._id.$in.length > 0)

  if (!canAccessAnyScope && !currentUser?.isRootAdmin) {
    const err = new Error('No employee scope available for import')
    err.status = 403
    throw err
  }

  const parsedRows = rawRows.map((raw, index) => {
    const normalized = normalizeImportRow(raw)

    if (normalized.rawJoinDate && !normalized.joinDate) {
      const err = new Error(
        `Row ${index + 2}: Invalid joinDate. Use DD/MM/YYYY format, example 30/11/2012`,
      )
      err.status = 400
      throw err
    }

    if (normalized.rawStatus && normalized.isActive === null) {
      const err = new Error(
        `Row ${index + 2}: Invalid Status. Use Active or Inactive`,
      )
      err.status = 400
      throw err
    }

    const { rawJoinDate, rawStatus, ...schemaPayload } = normalized
    const result = importEmployeeRowSchema.safeParse(schemaPayload)

    if (!result.success) {
      const err = new Error(
        `Row ${index + 2}: ${result.error.issues[0]?.message || 'Invalid data'}`,
      )
      err.status = 400
      throw err
    }

    const data = result.data

    return {
      ...data,
      employeeNo: s(data.employeeNo).toUpperCase(),
      departmentCode: s(data.departmentCode).toUpperCase(),
      positionCode: s(data.positionCode).toUpperCase(),
      lineCode: s(data.lineCode).toUpperCase(),
      shiftCode: s(data.shiftCode).toUpperCase(),
      reportsToEmployeeNo: s(data.reportsToEmployeeNo).toUpperCase(),
      email: s(data.email).toLowerCase(),
      joinDate: s(data.joinDate),
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    }
  })

  const seenEmployeeNos = new Set()
  for (let i = 0; i < parsedRows.length; i += 1) {
    const employeeNo = parsedRows[i].employeeNo
    if (seenEmployeeNos.has(employeeNo)) {
      const err = new Error(`Row ${i + 2}: Duplicate Employee No in import file`)
      err.status = 400
      throw err
    }
    seenEmployeeNos.add(employeeNo)
  }

  const departmentCodes = [...new Set(parsedRows.map((x) => x.departmentCode).filter(Boolean))]
  const positionCodes = [...new Set(parsedRows.map((x) => x.positionCode).filter(Boolean))]
  const lineCodes = [...new Set(parsedRows.map((x) => x.lineCode).filter(Boolean))]
  const shiftCodes = [...new Set(parsedRows.map((x) => x.shiftCode).filter(Boolean))]
  const managerEmployeeNos = [
    ...new Set(parsedRows.map((x) => x.reportsToEmployeeNo).filter(Boolean)),
  ]
  const employeeNos = [...new Set(parsedRows.map((x) => x.employeeNo).filter(Boolean))]
  const allEmployeeNosToLookup = [...new Set([...employeeNos, ...managerEmployeeNos])]
  const emails = [...new Set(parsedRows.map((x) => x.email).filter(Boolean))]

  const [
    departments,
    positions,
    lines,
    shifts,
    existingEmployees,
    existingEmails,
  ] = await Promise.all([
    Department.find({ code: { $in: departmentCodes } }, '_id code name').lean(),
    Position.find(
      { code: { $in: positionCodes } },
      '_id code name departmentId reportsToPositionId',
    ).lean(),
    lineCodes.length
      ? ProductionLine.find(
          { code: { $in: lineCodes } },
          '_id code name departmentId positionIds isActive',
        ).lean()
      : [],
    Shift.find(
      { code: { $in: shiftCodes }, isActive: true },
      '_id code name type startTime endTime crossMidnight isActive',
    ).lean(),
    Employee.find(
      { employeeNo: { $in: allEmployeeNosToLookup } },
      '_id employeeNo displayName email departmentId positionId lineId shiftId reportsToEmployeeId',
    ).lean(),
    emails.length
      ? Employee.find({ email: { $in: emails } }, '_id employeeNo email').lean()
      : [],
  ])

  const departmentByCode = new Map(
    departments.map((item) => [s(item.code).toUpperCase(), item]),
  )
  const positionByCode = new Map(
    positions.map((item) => [s(item.code).toUpperCase(), item]),
  )
  const lineByCode = new Map(lines.map((item) => [s(item.code).toUpperCase(), item]))
  const shiftByCode = new Map(shifts.map((item) => [s(item.code).toUpperCase(), item]))
  const existingEmployeeByNo = new Map(
    existingEmployees.map((item) => [s(item.employeeNo).toUpperCase(), item]),
  )
  const existingEmailByValue = new Map(
    existingEmails.map((item) => [s(item.email).toLowerCase(), item]),
  )

  const createdIds = []
  let createdCount = 0
  let updatedCount = 0

  for (let i = 0; i < parsedRows.length; i += 1) {
    const row = parsedRows[i]
    const rowNo = i + 2

    const department = departmentByCode.get(row.departmentCode)
    if (!department) {
      const err = new Error(`Row ${rowNo}: Department Code not found`)
      err.status = 400
      throw err
    }

    const position = positionByCode.get(row.positionCode)
    if (!position) {
      const err = new Error(`Row ${rowNo}: Position Code not found`)
      err.status = 400
      throw err
    }

    if (String(position.departmentId) !== String(department._id)) {
      const err = new Error(`Row ${rowNo}: Position does not belong to Department`)
      err.status = 400
      throw err
    }

    const line = row.lineCode ? lineByCode.get(row.lineCode) : null
    if (row.lineCode && !line) {
      const err = new Error(`Row ${rowNo}: Line Code not found`)
      err.status = 400
      throw err
    }

    if (line) {
      await ensureLineAllowed(line._id, department._id, position._id)
    }

    const shift = shiftByCode.get(row.shiftCode)
    if (!shift) {
      const err = new Error(`Row ${rowNo}: Shift Code not found or inactive`)
      err.status = 400
      throw err
    }

    const existing = existingEmployeeByNo.get(row.employeeNo) || null

    let manualManagerId = null
    if (row.reportsToEmployeeNo) {
      const manager = existingEmployeeByNo.get(row.reportsToEmployeeNo)
      if (!manager) {
        const err = new Error(
          `Row ${rowNo}: Reports To Employee No not found. Import managers first or place manager rows earlier`,
        )
        err.status = 400
        throw err
      }

      manualManagerId = manager._id
    }

    if (existing && manualManagerId && String(existing._id) === String(manualManagerId)) {
      const err = new Error(`Row ${rowNo}: Employee cannot report to self`)
      err.status = 400
      throw err
    }

    const finalManagerId = await resolveFinalReportsToEmployeeId({
      employeeId: existing?._id || null,
      departmentId: department._id,
      position,
      lineId: line?._id || null,
      manualReportsToEmployeeId: manualManagerId,
    })

    if (row.email) {
      const existingEmailOwner = existingEmailByValue.get(row.email)
      if (existingEmailOwner && String(existingEmailOwner._id) !== String(existing?._id || '')) {
        const err = new Error(`Row ${rowNo}: Email already exists`)
        err.status = 409
        throw err
      }
    }

    if (!existing) {
      const created = await Employee.create({
        employeeNo: row.employeeNo,
        displayName: row.displayName,
        departmentId: department._id,
        positionId: position._id,
        lineId: line?._id || null,
        shiftId: shift._id,
        reportsToEmployeeId: finalManagerId || null,
        phone: row.phone || '',
        email: row.email || '',
        joinDate: row.joinDate || null,
        isActive: typeof row.isActive === 'boolean' ? row.isActive : true,
      })

      createdIds.push(String(created._id))
      createdCount += 1

      existingEmployeeByNo.set(row.employeeNo, {
        _id: created._id,
        employeeNo: created.employeeNo,
        displayName: created.displayName,
        email: created.email,
        departmentId: created.departmentId,
        positionId: created.positionId,
        lineId: created.lineId,
        shiftId: created.shiftId,
        reportsToEmployeeId: created.reportsToEmployeeId,
      })

      if (row.email) {
        existingEmailByValue.set(row.email, {
          _id: created._id,
          email: row.email,
        })
      }

      continue
    }

    await ensureEmailUnique(row.email || '', existing._id)

    await Employee.updateOne(
      { _id: existing._id },
      {
        $set: {
          displayName: row.displayName,
          departmentId: department._id,
          positionId: position._id,
          lineId: line?._id || null,
          shiftId: shift._id,
          reportsToEmployeeId: finalManagerId || null,
          phone: row.phone || '',
          email: row.email || '',
          joinDate: row.joinDate || null,
          isActive: typeof row.isActive === 'boolean' ? row.isActive : true,
        },
      },
    )

    updatedCount += 1

    existingEmployeeByNo.set(row.employeeNo, {
      ...existing,
      displayName: row.displayName,
      email: row.email || '',
      departmentId: department._id,
      positionId: position._id,
      lineId: line?._id || null,
      shiftId: shift._id,
      reportsToEmployeeId: finalManagerId || null,
    })

    if (row.email) {
      existingEmailByValue.set(row.email, {
        _id: existing._id,
        email: row.email,
      })
    }
  }

  return {
    fileName: file.fileName || 'employee-import.xlsx',
    summary: {
      totalRows: parsedRows.length,
      created: createdCount,
      updated: updatedCount,
    },
    createdEmployeeIds: createdIds,
  }
}

async function getById(id) {
  const [doc, accountDoc] = await Promise.all([
    Employee.findById(id)
      .populate('departmentId', 'name code')
      .populate('positionId', 'name code reportsToPositionId')
      .populate('lineId', 'code name')
      .populate(
        'shiftId',
        'code name type startTime breakStartTime breakEndTime endTime crossMidnight',
      )
      .populate('reportsToEmployeeId', 'employeeNo displayName')
      .lean(),
    Account.findOne({ employeeId: id }, 'loginId isActive employeeId').lean(),
  ])

  if (!doc) {
    const err = new Error('Employee not found')
    err.status = 404
    throw err
  }

  return sanitize(doc, accountDoc)
}

async function getOrgChart(id) {
  const focusDoc = await Employee.findById(id)
    .populate('departmentId', 'name code')
    .populate('positionId', 'name code reportsToPositionId')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime crossMidnight')
    .populate('reportsToEmployeeId', 'employeeNo displayName')
    .lean()

  if (!focusDoc) {
    const err = new Error('Employee not found')
    err.status = 404
    throw err
  }

  const upwardDocs = []
  const visited = new Set([String(focusDoc._id)])

  let currentManagerId = focusDoc.reportsToEmployeeId?._id
    ? String(focusDoc.reportsToEmployeeId._id)
    : focusDoc.reportsToEmployeeId
      ? String(focusDoc.reportsToEmployeeId)
      : null

  while (currentManagerId && !visited.has(currentManagerId)) {
    visited.add(currentManagerId)

    const managerDoc = await Employee.findById(currentManagerId)
      .populate('departmentId', 'name code')
      .populate('positionId', 'name code reportsToPositionId')
      .populate('lineId', 'code name')
      .populate('shiftId', 'code name type startTime endTime crossMidnight')
      .populate('reportsToEmployeeId', 'employeeNo displayName')
      .lean()

    if (!managerDoc) break

    upwardDocs.push(managerDoc)

    currentManagerId = managerDoc.reportsToEmployeeId?._id
      ? String(managerDoc.reportsToEmployeeId._id)
      : managerDoc.reportsToEmployeeId
        ? String(managerDoc.reportsToEmployeeId)
        : null
  }

  upwardDocs.reverse()

  const directReportDocs = await Employee.find({
    reportsToEmployeeId: focusDoc._id,
  })
    .populate('departmentId', 'name code')
    .populate('positionId', 'name code reportsToPositionId')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime crossMidnight')
    .populate('reportsToEmployeeId', 'employeeNo displayName')
    .sort({ displayName: 1, employeeNo: 1 })
    .lean()

  return {
    focusEmployee: sanitizeOrgNode(focusDoc),
    upwardChain: upwardDocs.map(sanitizeOrgNode),
    directReports: directReportDocs.map(sanitizeOrgNode),
  }
}

async function create(payload) {
  await ensureEmployeeNoUnique(payload.employeeNo)
  await ensureEmailUnique(payload.email || '')

  const department = await ensureDepartmentExists(payload.departmentId)
  const position = await ensurePositionExists(payload.positionId, department._id)
  await ensureShiftExists(payload.shiftId)
  await ensureLineAllowed(payload.lineId, department._id, position._id)

  const reportsToEmployeeId = await resolveFinalReportsToEmployeeId({
    employeeId: null,
    departmentId: department._id,
    position,
    lineId: payload.lineId || null,
    manualReportsToEmployeeId: payload.reportsToEmployeeId || null,
  })

  const doc = await Employee.create({
    employeeNo: s(payload.employeeNo),
    displayName: s(payload.displayName),
    departmentId: payload.departmentId,
    positionId: payload.positionId,
    lineId: payload.lineId || null,
    shiftId: payload.shiftId,
    reportsToEmployeeId: reportsToEmployeeId || null,
    phone: s(payload.phone),
    email: s(payload.email),
    joinDate: payload.joinDate || null,
    isActive: payload.isActive ?? true,
  })

  let provisionedAccount = null

  try {
    if (payload.createAccount === true) {
      provisionedAccount = await createProvisionedAccount(doc)
    }
  } catch (error) {
    await Employee.findByIdAndDelete(doc._id)
    throw error
  }

  const fresh = await Employee.findById(doc._id)
    .populate('departmentId', 'name code')
    .populate('positionId', 'name code reportsToPositionId')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime crossMidnight')
    .populate('reportsToEmployeeId', 'employeeNo displayName')
    .lean()

  return sanitize(
    fresh,
    provisionedAccount
      ? {
          _id: provisionedAccount.id,
          loginId: provisionedAccount.loginId,
          isActive: provisionedAccount.isActive,
          employeeId: provisionedAccount.employeeId,
        }
      : null,
  )
}

async function update(id, payload) {
  const doc = await Employee.findById(id)

  if (!doc) {
    const err = new Error('Employee not found')
    err.status = 404
    throw err
  }

  const nextEmployeeNo =
    payload.employeeNo !== undefined ? s(payload.employeeNo) : s(doc.employeeNo)
  const nextPhone = payload.phone !== undefined ? s(payload.phone) : s(doc.phone)
  const nextDisplayName =
    payload.displayName !== undefined ? s(payload.displayName) : s(doc.displayName)
  const nextEmail = payload.email !== undefined ? s(payload.email).toLowerCase() : s(doc.email)

  const nextDepartmentId =
    payload.departmentId !== undefined ? payload.departmentId : doc.departmentId
  const nextPositionId =
    payload.positionId !== undefined ? payload.positionId : doc.positionId
  const nextLineId =
    payload.lineId !== undefined ? payload.lineId : doc.lineId
  const nextShiftId =
    payload.shiftId !== undefined ? payload.shiftId : doc.shiftId

  if (payload.employeeNo !== undefined && nextEmployeeNo !== s(doc.employeeNo)) {
    await ensureEmployeeNoUnique(nextEmployeeNo, doc._id)
    doc.employeeNo = nextEmployeeNo
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

  if (payload.displayName !== undefined) {
    doc.displayName = nextDisplayName
  }

  doc.departmentId = nextDepartmentId
  doc.positionId = nextPositionId
  doc.lineId = nextLineId || null
  doc.shiftId = nextShiftId

  if (shouldRefreshManager) {
    const reportsToEmployeeId = await resolveFinalReportsToEmployeeId({
      employeeId: doc._id,
      departmentId: department._id,
      position,
      lineId: nextLineId || null,
      manualReportsToEmployeeId:
        payload.reportsToEmployeeId !== undefined
          ? payload.reportsToEmployeeId
          : doc.reportsToEmployeeId,
    })

    doc.reportsToEmployeeId = reportsToEmployeeId || null
  }

  if (payload.phone !== undefined) {
    doc.phone = nextPhone
  }

  if (payload.email !== undefined) {
    await ensureEmailUnique(nextEmail, doc._id)
    doc.email = nextEmail
  }

  if (payload.joinDate !== undefined) {
    doc.joinDate = payload.joinDate || null
  }

  if (payload.isActive !== undefined) {
    doc.isActive = !!payload.isActive
  }

  await doc.save()

  let accountDoc = await Account.findOne(
    { employeeId: doc._id },
    'loginId isActive employeeId',
  ).lean()

  if (payload.provisionAccount === true) {
    if (accountDoc) {
      const err = new Error('Account already exists for this employee')
      err.status = 409
      throw err
    }

    if (!nextPhone) {
      const err = new Error('Phone is required to create account')
      err.status = 400
      throw err
    }

    const provisionedAccount = await createProvisionedAccount({
      _id: doc._id,
      employeeNo: nextEmployeeNo,
      phone: nextPhone,
      displayName: nextDisplayName,
    })

    accountDoc = {
      _id: provisionedAccount.id,
      loginId: provisionedAccount.loginId,
      isActive: provisionedAccount.isActive,
      employeeId: provisionedAccount.employeeId,
    }
  }

  const fresh = await Employee.findById(doc._id)
    .populate('departmentId', 'name code')
    .populate('positionId', 'name code reportsToPositionId')
    .populate('lineId', 'code name')
    .populate('shiftId', 'code name type startTime endTime crossMidnight')
    .populate('reportsToEmployeeId', 'employeeNo displayName')
    .lean()

  return sanitize(fresh, accountDoc)
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
}