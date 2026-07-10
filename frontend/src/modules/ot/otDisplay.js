// frontend/src/modules/ot/otDisplay.js

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

function firstText(...values) {
  for (const value of values) {
    const text = s(value)
    if (text) return text
  }

  return ''
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value)

    if (Number.isFinite(number)) {
      return number
    }
  }

  return 0
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value)

    if (Number.isFinite(number) && number > 0) {
      return number
    }
  }

  return 0
}

function round2(value) {
  return Math.round(n(value) * 100) / 100
}

export function minutesToHours(minutes) {
  return round2(n(minutes) / 60)
}

export function minutesToLabel(minutes) {
  const total = Math.max(0, Math.round(n(minutes)))
  const hours = Math.floor(total / 60)
  const mins = total % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`
  if (mins) return `${mins}m`

  return '0h'
}

export function buildTimeRangeLabel(startTime, endTime) {
  const start = s(startTime)
  const end = s(endTime)

  if (start && end) return `${start} - ${end}`
  if (start) return start
  if (end) return end

  return ''
}

export function getStatusLabel(row = {}) {
  return firstText(row.statusLabel, row.approvalStatusLabel, statusLabel(row.status))
}

export function getStatusSeverity(row = {}) {
  return firstText(row.statusSeverity, statusSeverity(row.status))
}

export function statusLabel(status) {
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

export function statusSeverity(status) {
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

export function getDayTypeLabel(row = {}) {
  return firstText(row.dayTypeLabel, dayTypeLabel(row.dayType))
}

export function getDayTypeSeverity(row = {}) {
  return firstText(row.dayTypeSeverity, dayTypeSeverity(row.dayType))
}

export function dayTypeLabel(dayType) {
  const value = upper(dayType)

  const map = {
    WORKING_DAY: 'Working Day',
    SUNDAY: 'Sunday',
    HOLIDAY: 'Holiday',
  }

  return map[value] || value || 'Unknown'
}

export function dayTypeSeverity(dayType) {
  const value = upper(dayType)

  if (value === 'HOLIDAY') return 'danger'
  if (value === 'SUNDAY') return 'warning'
  if (value === 'WORKING_DAY') return 'success'

  return 'secondary'
}

export function getPaidMinutes(row = {}) {
  const values = [
    row?.paidMinutes,
    row?.time?.paidMinutes,
    row?.time?.totalRequestPaidMinutes,
    row?.otOption?.paidMinutes,
    row?.otOption?.totalRequestPaidMinutes,
    row?.totalRequestPaidMinutes,
    row?.totalMinutes,
    row?.approvedMinutes,
  ]

  const positive = firstPositiveNumber(...values)
  return positive > 0 ? positive : firstNumber(...values)
}

export function getRequestedMinutes(row = {}) {
  const values = [
    row?.requestedMinutes,
    row?.time?.requestedMinutes,
    row?.otOption?.requestedMinutes,
    row?.totalRequestedMinutes,
    row?.otRequestedMinutes,
  ]

  const positive = firstPositiveNumber(...values)
  return positive > 0 ? positive : firstNumber(...values)
}

export function getBreakMinutes(row = {}) {
  return firstNumber(row?.breakMinutes, row?.time?.breakMinutes, row?.otOption?.breakMinutes)
}

export function getPaidHoursLabel(row = {}) {
  return firstText(
    row?.paidHoursLabel,
    row?.time?.paidHoursLabel,
    row?.time?.totalHoursLabel,
    row?.otOption?.paidHoursLabel,
    minutesToLabel(getPaidMinutes(row)),
  )
}

export function getRequestedHoursLabel(row = {}) {
  return firstText(
    row?.requestedHoursLabel,
    row?.time?.requestedHoursLabel,
    row?.otOption?.requestedHoursLabel,
    minutesToLabel(getRequestedMinutes(row)),
  )
}

export function getBreakLabel(row = {}) {
  return firstText(
    row?.breakLabel,
    row?.time?.breakLabel,
    row?.otOption?.breakLabel,
    minutesToLabel(getBreakMinutes(row)),
  )
}

export function getEmployeePaidMinutes(employee = {}, row = {}) {
  return firstPositiveNumber(
    employee?.paidMinutes,
    employee?.totalRequestPaidMinutes,
    employee?.totalMinutes,
    employee?.approvedMinutes,
    getPaidMinutes(row),
  )
}

export function getEmployeePaidHoursLabel(employee = {}, row = {}) {
  return firstText(
    employee?.paidHoursLabel,
    employee?.totalHoursLabel,
    minutesToLabel(getEmployeePaidMinutes(employee, row)),
  )
}

export function getRequesterDisplay(row = {}) {
  const name = firstText(
    row?.requesterName,
    row?.requester?.name,
    row?.createdByName,
    row?.ownerName,
    row?.employeeName,
  )

  const employeeNo = firstText(
    row?.requesterEmployeeNo,
    row?.requesterEmployeeCode,
    row?.requesterCode,
    row?.requester?.employeeNo,
    row?.requester?.employeeCode,
    row?.createdByEmployeeNo,
    row?.employeeNo,
  )

  return {
    name: name || '-',
    employeeNo: employeeNo || '-',
    label: firstText(
      row?.requesterLabel,
      employeeNo && name ? `${employeeNo} · ${name}` : '',
      name,
      employeeNo,
      '-',
    ),
  }
}

export function getEmployeeDisplay(employee = {}) {
  const code = firstText(employee?.employeeNo, employee?.employeeCode, employee?.code)
  const name = firstText(employee?.employeeName, employee?.name, employee?.fullName)

  return {
    code: code || '-',
    name: name || '-',
    label: firstText(employee?.employeeLabel, code && name ? `${code} · ${name}` : '', name, code, '-'),
  }
}

export function getTargetEmployees(row = {}) {
  if (Array.isArray(row?.effectiveEmployees)) return row.effectiveEmployees
  if (Array.isArray(row?.approvedEmployees) && row.approvedEmployees.length) return row.approvedEmployees
  if (Array.isArray(row?.requestedEmployees)) return row.requestedEmployees
  if (Array.isArray(row?.employees)) return row.employees
  if (Array.isArray(row?.employeeItems)) return row.employeeItems
  if (Array.isArray(row?.targetEmployees)) return row.targetEmployees
  if (Array.isArray(row?.employeeList)) return row.employeeList
  if (Array.isArray(row?.staffRows)) return row.staffRows

  return []
}

export function getEmployeeCount(row = {}) {
  return firstNumber(
    row?.effectiveEmployeeCount,
    row?.approvedEmployeeCount,
    row?.requestedEmployeeCount,
    row?.employeeCount,
    getTargetEmployees(row).length,
  )
}

export function getApprovedByDisplay(row = {}) {
  const name = firstText(row?.approvedByName)
  const employeeNo = firstText(row?.approvedByCode)

  return {
    name: name || '—',
    employeeNo,
    label: firstText(
      row?.approvedByLabel,
      employeeNo && name ? `${employeeNo} · ${name}` : '',
      name,
      employeeNo,
      '—',
    ),
  }
}

export function getApprovalDisplay(row = {}) {
  const display = row?.approvalDisplay || {}

  return {
    type: firstText(display.type, row?.approvalDisplayType, row?.status, 'UNKNOWN'),
    label: firstText(
      display.label,
      row?.approvalDisplayLabel,
      row?.approvalStatusLabel,
      row?.statusLabel,
      getStatusLabel(row),
    ),
    subLabel: firstText(display.subLabel, row?.approvalDisplaySubLabel, ''),
    severity: firstText(display.severity, row?.approvalDisplaySeverity, getStatusSeverity(row)),
  }
}

export function getPrimeSeverity(severity) {
  const value = upper(severity)

  if (value === 'SUCCESS') return 'success'
  if (value === 'DANGER' || value === 'ERROR') return 'danger'
  if (value === 'WARNING' || value === 'WARN') return 'warning'
  if (value === 'INFO') return 'info'
  if (value === 'CONTRAST') return 'contrast'

  return 'secondary'
}

export function getApprovalTagClass(row = {}, prefix = 'ot-request') {
  const display = getApprovalDisplay(row)
  const type = upper(display.type)
  const severity = upper(display.severity)

  const base = [`${prefix}-rgb-tag`, 'approval-display-tag']

  if (severity === 'SUCCESS' || type.includes('APPROVED')) {
    return [...base, `${prefix}-tag-approved`]
  }

  if (
    severity === 'DANGER' ||
    severity === 'ERROR' ||
    type.includes('REJECTED') ||
    type.includes('DISAGREED')
  ) {
    return [...base, `${prefix}-tag-rejected`]
  }

  if (severity === 'INFO' || type.includes('CONFIRMATION')) {
    return [...base, `${prefix}-tag-info`]
  }

  if (severity === 'WARNING' || severity === 'WARN' || type.includes('PENDING')) {
    return [...base, `${prefix}-tag-pending`]
  }

  return [...base, `${prefix}-tag-muted`]
}

export function getStatusTagClass(row = {}, prefix = 'ot-request') {
  const severity = getPrimeSeverity(getStatusSeverity(row))

  const map = {
    success: `${prefix}-tag-approved`,
    danger: `${prefix}-tag-rejected`,
    warning: `${prefix}-tag-pending`,
    info: `${prefix}-tag-info`,
    contrast: `${prefix}-tag-muted`,
    secondary: `${prefix}-tag-muted`,
  }

  return [`${prefix}-rgb-tag`, map[severity] || map.secondary]
}

export function getDayTypeTagClass(row = {}, prefix = 'ot-request') {
  const dayType = upper(row?.dayType)
  const severity = upper(getDayTypeSeverity(row))

  if (dayType === 'HOLIDAY' || severity === 'DANGER') {
    return [`${prefix}-rgb-tag`, `${prefix}-tag-holiday`]
  }

  if (dayType === 'SUNDAY' || severity === 'WARNING') {
    return [`${prefix}-rgb-tag`, `${prefix}-tag-sunday`]
  }

  if (dayType === 'WORKING_DAY' || severity === 'SUCCESS') {
    return [`${prefix}-rgb-tag`, `${prefix}-tag-working`]
  }

  return [`${prefix}-rgb-tag`, `${prefix}-tag-muted`]
}

export function getOTTimeDisplay(row = {}) {
  const time = row?.time || {}

  const startTime = firstText(row?.startTime, time?.startTime)
  const endTime = firstText(row?.endTime, time?.endTime)
  const requestStartTime = firstText(row?.requestStartTime, time?.requestStartTime, startTime)
  const requestEndTime = firstText(row?.requestEndTime, time?.requestEndTime, endTime)

  return {
    startTime,
    endTime,
    timeRangeLabel: firstText(row?.timeRangeLabel, time?.timeRangeLabel, buildTimeRangeLabel(startTime, endTime)),

    requestStartTime,
    requestEndTime,
    requestTimeRangeLabel: firstText(
      row?.requestTimeRangeLabel,
      time?.requestTimeRangeLabel,
      buildTimeRangeLabel(requestStartTime, requestEndTime),
    ),

    requestedMinutes: getRequestedMinutes(row),
    requestedHours: minutesToHours(getRequestedMinutes(row)),
    requestedHoursLabel: getRequestedHoursLabel(row),

    breakMinutes: getBreakMinutes(row),
    breakHours: minutesToHours(getBreakMinutes(row)),
    breakLabel: getBreakLabel(row),

    paidMinutes: getPaidMinutes(row),
    paidHours: minutesToHours(getPaidMinutes(row)),
    paidHoursLabel: getPaidHoursLabel(row),
  }
}

export function getOTPermissions(row = {}) {
  const permissions = row?.permissions || {}

  return {
    canEdit: permissions.canEdit === true || row?.canEdit === true,
    canApprove: permissions.canApprove === true || row?.canApprove === true,
    canReject: permissions.canReject === true || row?.canReject === true,
    canAdjustEmployees: permissions.canAdjustEmployees === true || row?.canAdjustEmployees === true,
    canAcknowledge: permissions.canAcknowledge === true || row?.canAcknowledge === true,
    canCancel: permissions.canCancel === true || row?.canCancel === true,
  }
}

export function normalizeOTEmployee(employee = {}, row = {}) {
  const display = getEmployeeDisplay(employee)
  const paidMinutes = getEmployeePaidMinutes(employee, row)

  return {
    ...employee,

    employeeCode: firstText(employee?.employeeCode, employee?.employeeNo, employee?.code),
    employeeName: firstText(employee?.employeeName, employee?.name, employee?.fullName),
    employeeLabel: display.label,

    lineLabel: firstText(
      employee?.lineLabel,
      employee?.lineCode && employee?.lineName ? `${employee.lineCode} · ${employee.lineName}` : '',
      employee?.lineCode,
      employee?.lineName,
    ),

    paidMinutes,
    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    paidHours: minutesToHours(paidMinutes),
    totalHours: minutesToHours(paidMinutes),
    paidHoursLabel: getEmployeePaidHoursLabel(employee, row),
    totalHoursLabel: getEmployeePaidHoursLabel(employee, row),
  }
}

export function normalizeOTRow(row = {}) {
  if (!row || typeof row !== 'object') return row

  const time = getOTTimeDisplay(row)
  const requester = getRequesterDisplay(row)
  const approvalDisplay = getApprovalDisplay(row)
  const permissions = getOTPermissions(row)

  const requestedEmployees = Array.isArray(row.requestedEmployees)
    ? row.requestedEmployees.map((employee) => normalizeOTEmployee(employee, row))
    : []

  const approvedEmployees = Array.isArray(row.approvedEmployees)
    ? row.approvedEmployees.map((employee) => normalizeOTEmployee(employee, row))
    : []


  const effectiveEmployees = Array.isArray(row.effectiveEmployees)
    ? row.effectiveEmployees.map((employee) => normalizeOTEmployee(employee, row))
    : getTargetEmployees({
        ...row,
        requestedEmployees,
        approvedEmployees,
      }).map((employee) => normalizeOTEmployee(employee, row))

  return {
    ...row,

    statusLabel: getStatusLabel(row),
    statusSeverity: getStatusSeverity(row),

    dayTypeLabel: getDayTypeLabel(row),
    dayTypeSeverity: getDayTypeSeverity(row),

    requesterLabel: requester.label,

    requestedEmployees,
    approvedEmployees,
    effectiveEmployees,

    requestedEmployeeCount: firstNumber(row.requestedEmployeeCount, requestedEmployees.length),
    approvedEmployeeCount: firstNumber(row.approvedEmployeeCount, approvedEmployees.length),
    effectiveEmployeeCount: firstNumber(row.effectiveEmployeeCount, effectiveEmployees.length),

    requestedMinutes: time.requestedMinutes,
    breakMinutes: time.breakMinutes,
    paidMinutes: time.paidMinutes,
    totalRequestPaidMinutes: time.paidMinutes,
    totalMinutes: time.paidMinutes,
    totalHours: time.paidHours,
    paidHours: time.paidHours,
    paidHoursLabel: time.paidHoursLabel,
    totalHoursLabel: time.paidHoursLabel,

    time,
    approvalDisplay,
    permissions,
  }
}

export function normalizeOTListResult(result = {}) {
  if (!result || typeof result !== 'object') return result

  if (!Array.isArray(result.items)) {
    return result
  }

  return {
    ...result,
    items: result.items.map((item) => normalizeOTRow(item)),
  }
}

export function normalizeOTPayloadData(data = {}) {
  if (!data || typeof data !== 'object') return data

  const nextData = { ...data }

  if (nextData.item && typeof nextData.item === 'object') {
    nextData.item = normalizeOTRow(nextData.item)
  }

  if (Array.isArray(nextData.items)) {
    nextData.items = nextData.items.map((item) => normalizeOTRow(item))
  }

  if (nextData.data && typeof nextData.data === 'object') {
    nextData.data = normalizeOTPayloadData(nextData.data)
  }

  return nextData
}

export function normalizeOTAxiosResponse(response) {
  if (!response || typeof response !== 'object') return response

  if (response.data && typeof response.data === 'object') {
    response.data = normalizeOTPayloadData(response.data)
  }

  return response
}