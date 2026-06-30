// backend/src/modules/ot/services/otRequestPresenter.service.js

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toId(value) {
  if (!value) return null
  return String(value)
}

function firstText(...values) {
  for (const value of values) {
    const text = s(value)
    if (text) return text
  }

  return ''
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value
    }
  }

  return []
}

function countOrLength(value, rows = []) {
  const count = Number(value)

  if (Number.isFinite(count) && count > 0) {
    return count
  }

  return Array.isArray(rows) ? rows.length : 0
}

function round2(value) {
  return Math.round(n(value) * 100) / 100
}

function minutesToHours(minutes) {
  return round2(n(minutes) / 60)
}

function minutesToLabel(minutes) {
  const total = Math.max(0, Math.round(n(minutes)))
  const hours = Math.floor(total / 60)
  const mins = total % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`
  if (mins) return `${mins}m`

  return '0h'
}

function buildRangeLabel(startTime, endTime) {
  const start = s(startTime)
  const end = s(endTime)

  if (start && end) return `${start} - ${end}`
  if (start) return start
  if (end) return end

  return ''
}

function buildEmployeeLabel(employee = {}) {
  return firstText(
    employee.employeeLabel,
    [employee.employeeCode, employee.employeeName].filter(Boolean).join(' · '),
    employee.employeeName,
    employee.employeeCode,
  )
}

function statusKey(status) {
  const value = upper(status)

  if (!value) return 'ot.status.unknown'

  return `ot.status.${value.toLowerCase()}`
}

function statusLabel(status) {
  const value = upper(status)

  const map = {
    DRAFT: 'Draft',
    PENDING: 'Pending Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  }

  return map[value] || value || 'Unknown'
}

function statusSeverity(status) {
  const value = upper(status)

  const map = {
    DRAFT: 'info',
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'contrast',
  }

  return map[value] || 'secondary'
}

function dayTypeKey(dayType) {
  const value = upper(dayType)

  if (!value) return 'ot.dayType.unknown'

  return `ot.dayType.${value.toLowerCase()}`
}

function dayTypeLabel(dayType) {
  const value = upper(dayType)

  const map = {
    WORKING_DAY: 'Working Day',
    SUNDAY: 'Sunday',
    HOLIDAY: 'Holiday',
  }

  return map[value] || value || 'Unknown'
}

function dayTypeSeverity(dayType) {
  const value = upper(dayType)

  if (value === 'HOLIDAY') return 'danger'
  if (value === 'SUNDAY') return 'warning'
  if (value === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function timingSourceLabel(timingSource) {
  const value = upper(timingSource)

  const map = {
    SHIFT_OPTION: 'Shift OT Option',
    MANUAL: 'Manual Time',
    SHIFT: 'Shift Time',
    CUSTOM: 'Custom Time',
  }

  return map[value] || value || ''
}

function timingModeLabel(timingMode) {
  const value = upper(timingMode)

  const map = {
    DEFAULT: 'Default',
    FIXED_TIME: 'Fixed Time',
    AFTER_SHIFT_END: 'After Shift End',
    BEFORE_SHIFT_START: 'Before Shift Start',
    MANUAL: 'Manual',
  }

  return map[value] || value || ''
}


function approvalStepStatusLabel(status) {
  const value = upper(status)

  const map = {
    WAITING: 'Waiting',
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    ACKNOWLEDGED: 'Acknowledged',
    SKIPPED: 'Skipped',
  }

  return map[value] || value || ''
}

function approvalStepStatusSeverity(status) {
  const value = upper(status)

  const map = {
    WAITING: 'secondary',
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    ACKNOWLEDGED: 'info',
    SKIPPED: 'secondary',
  }

  return map[value] || 'secondary'
}

function mapEmployeeOutput(item = {}) {
  const lineCode = s(item.lineCode)
  const lineName = s(item.lineName)

  const requestedMinutes = n(item.requestedMinutes)
  const breakMinutes = n(item.breakMinutes)
  const paidMinutes = n(item.totalRequestPaidMinutes ?? item.totalMinutes)
  const totalHours = n(item.totalHours, minutesToHours(paidMinutes))

  return {
    employeeId: toId(item.employeeId),
    employeeCode: s(item.employeeCode),
    employeeName: s(item.employeeName),
    employeeLabel: buildEmployeeLabel(item),

    departmentId: toId(item.departmentId),
    departmentCode: s(item.departmentCode),
    departmentName: s(item.departmentName),

    positionId: toId(item.positionId),
    positionCode: s(item.positionCode),
    positionName: s(item.positionName),

    lineId: toId(item.lineId),
    lineCode,
    lineName,
    lineLabel: firstText(
      item.lineLabel,
      lineCode && lineName ? `${lineCode} · ${lineName}` : '',
      lineCode,
      lineName,
    ),

    otTimeMode: upper(item.otTimeMode || 'DEFAULT'),
    otTimeModeLabel: timingModeLabel(item.otTimeMode || 'DEFAULT'),

    startTime: s(item.startTime),
    endTime: s(item.endTime),
    timeRangeLabel: buildRangeLabel(item.startTime, item.endTime),

    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),
    requestedHoursLabel: minutesToLabel(requestedMinutes),

    breakMinutes,
    breakHours: minutesToHours(breakMinutes),
    breakLabel: minutesToLabel(breakMinutes),

    paidMinutes,
    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    paidHours: minutesToHours(paidMinutes),
    totalHours,
    paidHoursLabel: minutesToLabel(paidMinutes),
    totalHoursLabel: minutesToLabel(paidMinutes),
  }
}

function mapApprovalStepOutput(step = {}) {
  const stepStatus = upper(step.status)
  const stepType = upper(step.stepType || 'APPROVER')
  const isFinalApprover = step.isFinalApprover === true || upper(step.workflowRole) === 'FINAL_APPROVER'
  const workflowRole = upper(
    step.workflowRole || (isFinalApprover ? 'FINAL_APPROVER' : stepType),
  )

  return {
    stepNo: n(step.stepNo),
    stepType,
    workflowRole,
    workflowRoleLabel: isFinalApprover
      ? 'Final Approver'
      : stepType === 'ACKNOWLEDGE'
        ? 'Acknowledge'
        : 'Approver',
    isFinalApprover,
    stepTypeLabel: isFinalApprover
      ? 'Final Approver'
      : stepType === 'ACKNOWLEDGE'
        ? 'Acknowledge'
        : 'Approver',

    approverEmployeeId: toId(step.approverEmployeeId),
    approverCode: s(step.approverCode),
    approverName: s(step.approverName),
    approverLabel: firstText(
      step.approverLabel,
      [step.approverCode, step.approverName].filter(Boolean).join(' · '),
      step.approverName,
      step.approverCode,
    ),

    status: stepStatus,
    statusKey: stepStatus ? `ot.approvalStep.status.${stepStatus.toLowerCase()}` : '',
    statusLabel: approvalStepStatusLabel(stepStatus),
    statusSeverity: approvalStepStatusSeverity(stepStatus),

    actedAt: step.actedAt || null,
    actedBy: toId(step.actedBy),
    remark: s(step.remark),
  }
}

function sortApprovalSteps(steps = []) {
  return [...(Array.isArray(steps) ? steps : [])].sort(
    (a, b) => n(a.stepNo) - n(b.stepNo),
  )
}

function findCurrentApprovalStep(doc = {}) {
  const steps = Array.isArray(doc.approvalSteps) ? doc.approvalSteps : []
  const currentStepNo = n(doc.currentApprovalStep, 1)

  return (
    steps.find((step) => n(step.stepNo) === currentStepNo) ||
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

function findLastStepByStatus(steps = [], status) {
  const normalizedStatus = upper(status)
  const sorted = sortApprovalSteps(steps)

  return [...sorted]
    .reverse()
    .find((step) => upper(step.status) === normalizedStatus) || null
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

function canModifyOTRequestBeforeApproval(doc = {}, authUser = {}) {
  const status = upper(doc.status)

  if (status !== 'PENDING') return false
  if (hasApprovedStep(doc)) return false

  // Edit/cancel are normal workflow actions. They stay separate from permanent delete.
  // Normal users can only edit/cancel their own requests; Root Admin can bypass.
  if (!authUser?.isRootAdmin && !isRequesterOfOTRequest(doc, authUser)) {
    return false
  }

  return hasPermission(authUser, 'OT_REQUEST_UPDATE')
}

function effectiveEmployeesForDoc(doc = {}) {
  if (Array.isArray(doc.effectiveEmployees) && doc.effectiveEmployees.length) {
    return doc.effectiveEmployees
  }

  if (Array.isArray(doc.approvedEmployees) && doc.approvedEmployees.length) {
    return doc.approvedEmployees
  }

  if (Array.isArray(doc.requestedEmployees) && doc.requestedEmployees.length) {
    return doc.requestedEmployees
  }

  return firstArray(
    doc.employees,
    doc.employeeItems,
    doc.targetEmployees,
    doc.employeeList,
    doc.staffRows,
  )
}

function canEditOTRequest(doc = {}, authUser = {}) {
  return canModifyOTRequestBeforeApproval(doc, authUser)
}

function canCancelOTRequest(doc = {}, authUser = {}) {
  return canModifyOTRequestBeforeApproval(doc, authUser)
}

function canDeleteOTRequest(doc = {}, authUser = {}) {
  return hasPermission(authUser, 'OT_REQUEST_DELETE')
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
    currentApproverEmployeeId: toId(currentStep?.approverEmployeeId),
    currentApproverCode: s(currentStep?.approverCode),
    currentApproverName: s(currentStep?.approverName),
    currentApproverLabel: firstText(
      [currentStep?.approverCode, currentStep?.approverName].filter(Boolean).join(' · '),
      currentStep?.approverName,
      currentStep?.approverCode,
    ),

    myApprovalStep: myStep ? mapApprovalStepOutput(myStep) : null,
    myApprovalStepNo: myStep ? n(myStep.stepNo) : null,
    myApprovalStatus: myApprovalStatus || (canDecide ? 'PENDING' : ''),

    isMyTurn,
    canDecide,
  }
}

function buildApprovalDisplay(doc = {}) {
  const requestStatus = upper(doc.status)
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

  if (requestStatus === 'APPROVED') {
    return {
      type: 'approved',
      label: 'Approved',
      subLabel: lastApprovedStep
        ? `Final approved by ${s(lastApprovedStep.approverName) || 'approver'}`
        : 'OT request approved',
      severity: 'success',
    }
  }

  if (requestStatus === 'REJECTED') {
    return {
      type: 'rejected',
      label: 'Rejected',
      subLabel: rejectedStep
        ? `Rejected by ${s(rejectedStep.approverName) || 'approver'}`
        : 'OT request rejected',
      severity: 'danger',
    }
  }

  if (requestStatus === 'CANCELLED') {
    return {
      type: 'cancelled',
      label: 'Cancelled',
      subLabel: 'OT request cancelled',
      severity: 'contrast',
    }
  }


  if (requestStatus === 'PENDING') {
    const stepNo = n(currentStep?.stepNo)
    const approverName = s(currentStep?.approverName) || 'approver'

    return {
      type: 'pending',
      label: `Waiting for ${approverName}`,
      subLabel: totalApproverSteps
        ? `Approval step ${stepNo || 1} of ${totalApproverSteps}`
        : 'Waiting for approval',
      severity: 'warning',
    }
  }

  return {
    type: 'status',
    label: statusLabel(requestStatus),
    subLabel: '',
    severity: statusSeverity(requestStatus),
  }
}

function buildOtOptionOutput(doc = {}) {
  const requestedMinutes = n(doc.requestedMinutes)
  const breakMinutes = n(doc.breakMinutes)
  const paidMinutes = n(doc.totalRequestPaidMinutes ?? doc.totalMinutes)

  return {
    id: toId(doc.shiftOtOptionId),
    label: s(doc.shiftOtOptionLabel),

    timingMode: s(doc.shiftOtOptionTimingMode),
    timingModeLabel: timingModeLabel(doc.shiftOtOptionTimingMode),

    timingSource: upper(doc.otTimingSource || 'SHIFT_OPTION'),
    timingSourceLabel: timingSourceLabel(doc.otTimingSource || 'SHIFT_OPTION'),

    requestStartTime: s(doc.requestStartTime || doc.startTime),
    requestEndTime: s(doc.requestEndTime || doc.endTime),
    requestTimeRangeLabel: buildRangeLabel(
      doc.requestStartTime || doc.startTime,
      doc.requestEndTime || doc.endTime,
    ),

    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),
    requestedHoursLabel: minutesToLabel(requestedMinutes),

    breakMinutes,
    breakHours: minutesToHours(breakMinutes),
    breakLabel: minutesToLabel(breakMinutes),

    paidMinutes,
    totalRequestPaidMinutes: paidMinutes,
    totalRequestPaidHours: minutesToHours(paidMinutes),
    paidHoursLabel: minutesToLabel(paidMinutes),

    fixedStartTime: s(doc.shiftOtOptionFixedStartTime),
    fixedEndTime: s(doc.shiftOtOptionFixedEndTime),
    fixedTimeRangeLabel: buildRangeLabel(
      doc.shiftOtOptionFixedStartTime,
      doc.shiftOtOptionFixedEndTime,
    ),

    startAfterShiftEndMinutes: n(doc.shiftOtOptionStartAfterShiftEndMinutes),
  }
}

function buildTimeDisplay(doc = {}) {
  const requestedMinutes = n(doc.requestedMinutes)
  const breakMinutes = n(doc.breakMinutes)
  const paidMinutes = n(doc.totalRequestPaidMinutes ?? doc.totalMinutes)

  return {
    startTime: s(doc.startTime),
    endTime: s(doc.endTime),
    timeRangeLabel: buildRangeLabel(doc.startTime, doc.endTime),

    requestStartTime: s(doc.requestStartTime || doc.startTime),
    requestEndTime: s(doc.requestEndTime || doc.endTime),
    requestTimeRangeLabel: buildRangeLabel(
      doc.requestStartTime || doc.startTime,
      doc.requestEndTime || doc.endTime,
    ),

    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),
    requestedHoursLabel: minutesToLabel(requestedMinutes),

    breakMinutes,
    breakHours: minutesToHours(breakMinutes),
    breakLabel: minutesToLabel(breakMinutes),

    paidMinutes,
    totalMinutes: paidMinutes,
    totalRequestPaidMinutes: paidMinutes,
    paidHours: minutesToHours(paidMinutes),
    totalHours: minutesToHours(paidMinutes),
    paidHoursLabel: minutesToLabel(paidMinutes),
    totalHoursLabel: minutesToLabel(paidMinutes),
  }
}

function buildPermissionOutput(doc = {}, authUser = {}) {
  const approvalContext = buildApprovalActionContext(doc, authUser)

  return {
    canEdit: canEditOTRequest(doc, authUser),
    canApprove: approvalContext.canDecide,
    canReject: approvalContext.canDecide,
    canAdjustEmployees: approvalContext.canDecide,
    canAcknowledge: false,
    canCancel: canCancelOTRequest(doc, authUser),
    canDelete: canDeleteOTRequest(doc, authUser),
  }
}

function presentOTRequest(doc = {}, authUser = {}) {
  const time = buildTimeDisplay(doc)
  const approvalContext = buildApprovalActionContext(doc, authUser)
  const approvalDisplay = buildApprovalDisplay(doc)

  const requestedEmployees = firstArray(
  doc.requestedEmployees,
  doc.employees,
  doc.employeeItems,
  doc.targetEmployees,
  doc.employeeList,
  doc.staffRows,
).map(mapEmployeeOutput)

    const approvedEmployees = Array.isArray(doc.approvedEmployees)
    ? doc.approvedEmployees.map(mapEmployeeOutput)
    : []


    const effectiveEmployees = effectiveEmployeesForDoc({
    ...doc,
    requestedEmployees,
    approvedEmployees,
    }).map(mapEmployeeOutput)

  const approvalSteps = sortApprovalSteps(doc.approvalSteps).map(mapApprovalStepOutput)

  const status = upper(doc.status)
  const dayType = upper(doc.dayType)
  return {
    id: toId(doc._id || doc.id),
    _id: toId(doc._id || doc.id),

    requestNo: s(doc.requestNo),
    otDate: s(doc.otDate),

    status,
    statusKey: statusKey(status),
    statusLabel: statusLabel(status),
    statusSeverity: statusSeverity(status),

    dayType,
    dayTypeKey: dayTypeKey(dayType),
    dayTypeLabel: dayTypeLabel(dayType),
    dayTypeSeverity: dayTypeSeverity(dayType),

    requesterEmployeeId: toId(doc.requesterEmployeeId),
    requesterCode: s(doc.requesterCode),
    requesterName: s(doc.requesterName),
    requesterLabel: firstText(
      doc.requesterLabel,
      [doc.requesterCode, doc.requesterName].filter(Boolean).join(' · '),
      doc.requesterName,
      doc.requesterCode,
    ),

    departmentId: toId(doc.departmentId),
    departmentCode: s(doc.departmentCode),
    departmentName: s(doc.departmentName),

    positionId: toId(doc.positionId),
    positionCode: s(doc.positionCode),
    positionName: s(doc.positionName),

    lineId: toId(doc.lineId),
    lineCode: s(doc.lineCode),
    lineName: s(doc.lineName),
    lineLabel: firstText(
      doc.lineLabel,
      [doc.lineCode, doc.lineName].filter(Boolean).join(' · '),
      doc.lineCode,
      doc.lineName,
    ),

    shiftId: toId(doc.shiftId),
    shiftCode: s(doc.shiftCode),
    shiftName: s(doc.shiftName),
    shiftLabel: firstText(
      doc.shiftLabel,
      [doc.shiftCode, doc.shiftName].filter(Boolean).join(' · '),
      doc.shiftCode,
      doc.shiftName,
    ),

    startTime: time.startTime,
    endTime: time.endTime,
    requestStartTime: time.requestStartTime,
    requestEndTime: time.requestEndTime,

    requestedMinutes: time.requestedMinutes,
    breakMinutes: time.breakMinutes,
    totalMinutes: time.totalMinutes,
    totalRequestPaidMinutes: time.totalRequestPaidMinutes,
    totalHours: time.totalHours,

    paidMinutes: time.paidMinutes,
    paidHours: time.paidHours,

    time,
    otOption: buildOtOptionOutput(doc),

    requestedEmployees,
    approvedEmployees,
    effectiveEmployees,

    requestedEmployeeCount: countOrLength(doc.requestedEmployeeCount, requestedEmployees),
    approvedEmployeeCount: countOrLength(doc.approvedEmployeeCount, approvedEmployees),
    proposedApprovedEmployeeCount: countOrLength(
    doc.proposedApprovedEmployeeCount,
    ),
    effectiveEmployeeCount: countOrLength(doc.effectiveEmployeeCount, effectiveEmployees),

    approvalSteps,
    currentApprovalStep: n(doc.currentApprovalStep, 1),
    currentApproverEmployeeId: toId(doc.currentApproverEmployeeId),
    finalApproverEmployeeId: toId(doc.finalApproverEmployeeId),

    approvalDisplay,
    approvalContext,

    permissions: buildPermissionOutput(doc, authUser),

    reason: s(doc.reason),
    remark: s(doc.remark),

    createdBy: toId(doc.createdBy),
    updatedBy: toId(doc.updatedBy),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function presentOTRequestListResult(result = {}, authUser = {}) {
  const items = Array.isArray(result.items)
    ? result.items.map((item) => presentOTRequest(item, authUser))
    : []

  return {
    ...result,
    items,
  }
}

module.exports = {
  presentOTRequest,
  presentOTRequestListResult,

  mapEmployeeOutput,
  mapApprovalStepOutput,

  buildApprovalDisplay,
  buildApprovalActionContext,
  buildPermissionOutput,
  buildTimeDisplay,
  buildOtOptionOutput,

  statusKey,
  statusLabel,
  statusSeverity,

  dayTypeKey,
  dayTypeLabel,
  dayTypeSeverity,

  minutesToHours,
  minutesToLabel,
}