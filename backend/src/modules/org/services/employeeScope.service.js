// backend/src/modules/org/services/employeeScope.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')
const Employee = require('../models/Employee')
const Position = require('../models/Position')
const Account = require('../../auth/models/Account')

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

function getPositionHierarchyScope(position) {
  return upper(position?.hierarchyScope || position?.managerScope || 'SAME_LINE')
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

function getPermissionCodes(user) {
  return Array.isArray(user?.effectivePermissionCodes)
    ? user.effectivePermissionCodes.map((item) => upper(item)).filter(Boolean)
    : []
}

function hasAnyPermission(user, codes = []) {
  const set = new Set(getPermissionCodes(user))

  return codes.some((code) => set.has(upper(code)))
}

function canViewAllEmployees(user) {
  return (
    user?.isRootAdmin === true ||
    hasAnyPermission(user, [
      'EMPLOYEE_VIEW',
      'EMPLOYEE_VIEW_ALL',
      'ORG_EMPLOYEE_VIEW',
      'ORG_EMPLOYEE_VIEW_ALL',
      'ORG.EMPLOYEE_VIEW',
      'ORG.EMPLOYEE_VIEW_ALL',
    ])
  )
}

function canLookupAllEmployees(user) {
  return (
    user?.isRootAdmin === true ||
    hasAnyPermission(user, [
      'EMPLOYEE_LOOKUP_ALL',
      'EMPLOYEE_VIEW_ALL',
      'ORG_EMPLOYEE_VIEW_ALL',
      'ORG.EMPLOYEE_VIEW_ALL',
      'OT_ADD_OTHER_LINE_EMPLOYEE',
    ])
  )
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

function buildEmployeeMap(employees = []) {
  const map = new Map()

  for (const employee of employees) {
    map.set(id(employee._id), employee)
  }

  return map
}

function buildPositionMap(positions = []) {
  const map = new Map()

  for (const position of positions) {
    map.set(id(position._id), position)
  }

  return map
}

function buildFixedChildrenMap(employees = []) {
  const map = new Map()

  for (const employee of employees) {
    const managerId = id(employee.reportsToEmployeeId)

    if (!managerId) continue

    if (!map.has(managerId)) {
      map.set(managerId, [])
    }

    map.get(managerId).push(id(employee._id))
  }

  return map
}

function buildLineManagerChildrenMap(employees = []) {
  const map = new Map()

  for (const employee of employees) {
    const managerIds = uniqueIds(employee.lineManagerIds || [])

    for (const managerId of managerIds) {
      if (!managerId || sameId(managerId, employee._id)) continue

      if (!map.has(managerId)) {
        map.set(managerId, [])
      }

      map.get(managerId).push(id(employee._id))
    }
  }

  return map
}

function buildDynamicSameLineChildrenMap(employees = [], positionById = new Map()) {
  const map = new Map()

  for (const employee of employees) {
    const employeePosition = positionById.get(id(employee.positionId))
    const parentPositionId = id(employeePosition?.reportsToPositionId)
    const managerScope = getPositionHierarchyScope(employeePosition)
    const departmentId = id(employee.departmentId)
    const lineId = id(employee.lineId)

    if (!parentPositionId) continue
    if (managerScope !== 'SAME_LINE') continue
    if (!departmentId || !lineId) continue

    const key = `${parentPositionId}:${departmentId}:${lineId}`

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key).push(id(employee._id))
  }

  return map
}

function isSameLinePositionChild(manager, child, childPosition) {
  if (!manager || !child || !childPosition) return false

  const parentPositionId = id(childPosition.reportsToPositionId)
  const managerPositionId = id(manager.positionId)
  const managerScope = getPositionHierarchyScope(childPosition)

  return (
    managerScope === 'SAME_LINE' &&
    parentPositionId &&
    managerPositionId &&
    parentPositionId === managerPositionId
  )
}

function shouldAcceptFixedReport(manager, child, positionById) {
  if (!manager || !child) return false
  if (sameId(manager._id, child._id)) return false

  const childPosition = positionById.get(id(child.positionId))

  if (isSameLinePositionChild(manager, child, childPosition)) {
    return sameId(manager.lineId, child.lineId)
  }

  return true
}

async function loadActiveEmployeesAndPositions() {
  return Promise.all([
    Employee.find(
      { isActive: true },
      {
        _id: 1,
        employeeCode: 1,
        displayName: 1,
        departmentId: 1,
        positionId: 1,
        lineId: 1,
        shiftId: 1,
        reportsToEmployeeId: 1,
        lineManagerIds: 1,
        isActive: 1,
      },
    ).lean(),

    Position.find(
      { isActive: true },
      {
        _id: 1,
        code: 1,
        name: 1,
        departmentId: 1,
        reportsToPositionId: 1,
        hierarchyScope: 1,
        managerScope: 1,
        isActive: 1,
      },
    ).lean(),
  ])
}

async function getScopedEmployeeIds(currentUser, options = {}) {
  const allowAll = options.allowAll !== false

  const [employees, positions] = await loadActiveEmployeesAndPositions()
  console.log('[ORG_SCOPE_DEBUG]', {
  loginId: currentUser?.loginId,
  accountId: currentUser?.accountId || currentUser?.id || currentUser?._id || currentUser?.sub,
  isRootAdmin: currentUser?.isRootAdmin,
  roleCodes: currentUser?.roleCodes,
  effectivePermissionCodes: currentUser?.effectivePermissionCodes,
  activeEmployees: employees.length,
  activePositions: positions.length,
  canViewAll: canViewAllEmployees(currentUser),
})

  if (allowAll && canViewAllEmployees(currentUser)) {
    return new Set(employees.map((employee) => id(employee._id)).filter(Boolean))
  }

  const myEmployeeId = await resolveCurrentUserEmployeeId(currentUser)

  if (!myEmployeeId) {
    return new Set()
  }

  const employeeById = buildEmployeeMap(employees)
  const positionById = buildPositionMap(positions)
  const fixedChildrenByManagerId = buildFixedChildrenMap(employees)
  const lineManagerChildrenByManagerId = buildLineManagerChildrenMap(employees)
  const dynamicSameLineChildrenMap = buildDynamicSameLineChildrenMap(
    employees,
    positionById,
  )

  const rootEmployee = employeeById.get(myEmployeeId)

  if (!rootEmployee) {
    return new Set()
  }

  const result = new Set([myEmployeeId])
  const queue = [myEmployeeId]

  while (queue.length) {
    const managerId = queue.shift()
    const manager = employeeById.get(managerId)

    if (!manager) continue

    const fixedChildIds = fixedChildrenByManagerId.get(managerId) || []

    for (const childId of fixedChildIds) {
      if (result.has(childId)) continue

      const child = employeeById.get(childId)

      if (!shouldAcceptFixedReport(manager, child, positionById)) continue

      result.add(childId)
      queue.push(childId)
    }

    const lineManagerChildIds = lineManagerChildrenByManagerId.get(managerId) || []

    for (const childId of lineManagerChildIds) {
      if (result.has(childId)) continue

      result.add(childId)
      queue.push(childId)
    }

    const managerPositionId = id(manager.positionId)
    const managerDepartmentId = id(manager.departmentId)
    const managerLineId = id(manager.lineId)

    if (managerPositionId && managerDepartmentId && managerLineId) {
      const key = `${managerPositionId}:${managerDepartmentId}:${managerLineId}`
      const dynamicChildIds = dynamicSameLineChildrenMap.get(key) || []

      for (const childId of dynamicChildIds) {
        if (result.has(childId)) continue

        result.add(childId)
        queue.push(childId)
      }
    }
  }

  return result
}

async function buildEmployeeScopeFilter(currentUser, options = {}) {
  const scopedIds = await getScopedEmployeeIds(currentUser, options)

  if (!scopedIds.size) {
    return {
      _id: {
        $in: [],
      },
    }
  }

  return {
    _id: {
      $in: Array.from(scopedIds)
        .filter((employeeId) => mongoose.Types.ObjectId.isValid(employeeId))
        .map((employeeId) => new mongoose.Types.ObjectId(employeeId)),
    },
  }
}

async function assertEmployeesInsideManagedScope(currentUser, employeeIds = []) {
  const uniqueEmployeeIds = uniqueIds(employeeIds)

  if (!uniqueEmployeeIds.length) return

  if (canLookupAllEmployees(currentUser)) return

  const scopedIds = await getScopedEmployeeIds(currentUser, {
    allowAll: false,
  })

  const outsideEmployeeIds = uniqueEmployeeIds.filter(
    (employeeId) => !scopedIds.has(employeeId),
  )

  if (!outsideEmployeeIds.length) return

  const outsideObjectIds = outsideEmployeeIds
    .filter((employeeId) => mongoose.Types.ObjectId.isValid(employeeId))
    .map((employeeId) => new mongoose.Types.ObjectId(employeeId))

  const outsideEmployees = outsideObjectIds.length
    ? await Employee.find(
        {
          _id: {
            $in: outsideObjectIds,
          },
        },
        {
          employeeCode: 1,
          displayName: 1,
          lineId: 1,
          positionId: 1,
        },
      )
        .populate('lineId', 'code name')
        .populate('positionId', 'code name')
        .lean()
    : []

  const outsideEmployeeMap = new Map(
    outsideEmployees.map((employee) => [id(employee._id), employee]),
  )

  const details = outsideEmployeeIds.map((employeeId) => {
    const employee = outsideEmployeeMap.get(employeeId)

    return {
      employeeId,
      employeeCode: s(employee?.employeeCode),
      displayName: s(employee?.displayName),
      lineId: employee?.lineId?._id ? id(employee.lineId._id) : id(employee?.lineId),
      lineCode: s(employee?.lineId?.code),
      lineName: s(employee?.lineId?.name),
      positionId: employee?.positionId?._id
        ? id(employee.positionId._id)
        : id(employee?.positionId),
      positionCode: s(employee?.positionId?.code),
      positionName: s(employee?.positionId?.name),
    }
  })

  throw appError({
    statusCode: 403,
    code: 'EMPLOYEE_OUTSIDE_MANAGED_SCOPE',
    messageKey: 'org.employee.error.outsideManagedScope',
    message: 'Some selected employees are outside your managed scope.',
    params: {
      outsideEmployeeIds,
      outsideEmployees: details,
    },
  })
}

module.exports = {
  hasAnyPermission,
  canViewAllEmployees,
  canLookupAllEmployees,
  resolveCurrentUserEmployeeId,
  getScopedEmployeeIds,
  buildEmployeeScopeFilter,
  assertEmployeesInsideManagedScope,
}