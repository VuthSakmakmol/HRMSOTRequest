// backend/src/modules/org/services/employeeScope.service.js
// backend/src/modules/org/services/employeeScope.service.js

const mongoose = require('mongoose')

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
  return value ? String(value) : ''
}

function sameId(a, b) {
  return id(a) !== '' && id(a) === id(b)
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
      'EMPLOYEE_VIEW_ALL',
      'ORG_EMPLOYEE_VIEW_ALL',
      'ORG.EMPLOYEE_VIEW_ALL',
      'ROOT_ADMIN',
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
      'OT_SELECT_OTHER_EMPLOYEE',
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

function buildPositionMap(positions = []) {
  const map = new Map()

  for (const position of positions) {
    map.set(id(position._id), position)
  }

  return map
}

function buildEmployeeMap(employees = []) {
  const map = new Map()

  for (const employee of employees) {
    map.set(id(employee._id), employee)
  }

  return map
}

function buildSameLineChildrenMap(employees = [], positionById = new Map()) {
  const map = new Map()

  for (const employee of employees) {
    const employeePosition = positionById.get(id(employee.positionId))
    const parentPositionId = id(employeePosition?.reportsToPositionId)
    const managerScope = upper(employeePosition?.managerScope || 'SAME_LINE')
    const lineId = id(employee.lineId)

    if (!parentPositionId) continue
    if (managerScope !== 'SAME_LINE') continue
    if (!lineId) continue

    const key = `${parentPositionId}:${lineId}`

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
  const managerScope = upper(childPosition.managerScope || 'SAME_LINE')

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

  // If this child position is SAME_LINE under this manager position,
  // the fixed reportsToEmployeeId is only valid when both are still in the same current line.
  // This removes old Line 1 employees from Sup A after Sup A moves to Line 2.
  if (isSameLinePositionChild(manager, child, childPosition)) {
    return sameId(manager.lineId, child.lineId)
  }

  // GLOBAL/manual hierarchy can still use fixed reportsToEmployeeId.
  return true
}

async function loadActiveEmployeesAndPositions() {
  return Promise.all([
    Employee.find(
      { isActive: true },
      {
        _id: 1,
        employeeNo: 1,
        displayName: 1,
        departmentId: 1,
        positionId: 1,
        lineId: 1,
        shiftId: 1,
        reportsToEmployeeId: 1,
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
        managerScope: 1,
        isActive: 1,
      },
    ).lean(),
  ])
}

async function getScopedEmployeeIds(currentUser, options = {}) {
  const allowAll = options.allowAll !== false

  const [employees, positions] = await loadActiveEmployeesAndPositions()

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
  const sameLineChildrenByPositionAndLine = buildSameLineChildrenMap(employees, positionById)

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

    // 1. Keep GLOBAL/manual fixed reportsTo hierarchy,
    // but reject stale SAME_LINE fixed children when line no longer matches.
    const fixedChildIds = fixedChildrenByManagerId.get(managerId) || []

    for (const childId of fixedChildIds) {
      if (result.has(childId)) continue

      const child = employeeById.get(childId)

      if (!shouldAcceptFixedReport(manager, child, positionById)) continue

      result.add(childId)
      queue.push(childId)
    }

    // 2. Dynamic line ownership:
    // supervisor current line + supervisor position = children whose position reports to that supervisor position.
    const managerPositionId = id(manager.positionId)
    const managerLineId = id(manager.lineId)

    if (managerPositionId && managerLineId) {
      const key = `${managerPositionId}:${managerLineId}`
      const dynamicChildIds = sameLineChildrenByPositionAndLine.get(key) || []

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
    return { _id: { $in: [] } }
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
  const uniqueEmployeeIds = Array.from(
    new Set(
      (Array.isArray(employeeIds) ? employeeIds : [])
        .map((employeeId) => s(employeeId))
        .filter(Boolean),
    ),
  )

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
        { _id: { $in: outsideObjectIds } },
        {
          employeeNo: 1,
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
      employeeNo: s(employee?.employeeNo),
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

  const preview = details
    .slice(0, 5)
    .map((item) => {
      const employeeLabel =
        [item.employeeNo, item.displayName].filter(Boolean).join(' - ') ||
        item.employeeId

      const lineLabel =
        [item.lineCode, item.lineName].filter(Boolean).join(' · ') ||
        'No line'

      return `${employeeLabel} (${lineLabel})`
    })
    .join(', ')

  const moreText = details.length > 5 ? ` and ${details.length - 5} more` : ''

  const err = new Error(
    `Some selected employees are outside your current line/team scope: ${preview}${moreText}. Please refresh employee list and select again.`,
  )

  err.status = 403
  err.code = 'OT_EMPLOYEE_OUTSIDE_SCOPE'
  err.error = 'OT_EMPLOYEE_OUTSIDE_SCOPE'
  err.outsideEmployeeIds = outsideEmployeeIds
  err.details = {
    outsideEmployeeIds,
    outsideEmployees: details,
  }

  throw err
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