// backend/src/modules/attendance/utils/attendanceVerification.js

const { formatYmdToDmy, formatDateTimeToDmyHm } = require('../../../shared/utils/dateFormat')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

const MESSAGE_KEYS = Object.freeze({
  ATTENDANCE: {
    EMPLOYEE_NOT_MATCHED: 'attendance.result.employee_not_matched',
    LEAVE: 'attendance.result.leave',
    OFF: 'attendance.result.off',
    ABSENT: 'attendance.result.absent',
    FORGET_SCAN_IN: 'attendance.result.forget_scan_in',
    FORGET_SCAN_OUT: 'attendance.result.forget_scan_out',
    SHIFT_MISMATCH: 'attendance.result.shift_mismatch',
    LATE: 'attendance.result.late',
    PRESENT: 'attendance.result.present',
    UNKNOWN: 'attendance.result.unknown',
    INVALID_CLOCK_FORMAT: 'attendance.result.invalid_clock_format',
    INVALID_SHIFT_TIME: 'attendance.result.invalid_shift_time',
  },

  VERIFICATION: {
    MATCH: 'attendance.verification.result.match',
    MISMATCH: 'attendance.verification.result.mismatch',
    PENDING_REVIEW: 'attendance.verification.result.pending_review',

    NO_PAID_OT_MINUTES: 'attendance.verification.no_paid_ot_minutes',
    APPROVED_WITHOUT_EXACT_CLOCK_OUT:
      'attendance.verification.approved_without_exact_clock_out',
    APPROVED_WITHOUT_EXACT_CLOCK_OUT_LATE:
      'attendance.verification.approved_without_exact_clock_out_late',
    FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT:
      'attendance.verification.fixed_ot_approved_without_exact_clock_out',
    FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT_LATE:
      'attendance.verification.fixed_ot_approved_without_exact_clock_out_late',

    FORGET_SCAN_IN_PENDING: 'attendance.verification.forget_scan_in_pending',
    FORGET_SCAN_OUT_PENDING: 'attendance.verification.forget_scan_out_pending',
    ATTENDANCE_NOT_PRESENT: 'attendance.verification.attendance_not_present',
    STATUS_REQUIRES_MANUAL_REVIEW:
      'attendance.verification.status_requires_manual_review',

    NO_REQUEST_WINDOW: 'attendance.verification.no_request_window',
    NO_ATTENDANCE_WINDOW: 'attendance.verification.no_attendance_window',

    SUNDAY_HOLIDAY_NO_OVERLAP:
      'attendance.verification.sunday_holiday_no_overlap',
    SUNDAY_HOLIDAY_BELOW_MIN:
      'attendance.verification.sunday_holiday_below_min',
    SUNDAY_HOLIDAY_MATCH: 'attendance.verification.sunday_holiday_match',
    SUNDAY_HOLIDAY_SHORT: 'attendance.verification.sunday_holiday_short',
    SUNDAY_HOLIDAY_EXCEED: 'attendance.verification.sunday_holiday_exceed',

    POLICY_NOT_ELIGIBLE: 'attendance.verification.policy_not_eligible',
    POLICY_BELOW_MIN: 'attendance.verification.policy_below_min',
    POLICY_MATCH: 'attendance.verification.policy_match',
    POLICY_SHORT: 'attendance.verification.policy_short',
    POLICY_EXCEED: 'attendance.verification.policy_exceed',
  },
})

function toMinutes(hhmm) {
  const raw = s(hhmm)
  const match = raw.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const hh = Number(match[1])
  const mm = Number(match[2])

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null

  return hh * 60 + mm
}

function minutesToHHmm(totalMinutes) {
  const normalized = ((Number(totalMinutes || 0) % 1440) + 1440) % 1440
  const hh = Math.floor(normalized / 60)
  const mm = normalized % 60

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safeNonNegativeInt(value, fallback = 0) {
  const num = Math.round(safeNumber(value, fallback))
  return num < 0 ? fallback : num
}

function resolvePaidRequestMinutes(otRequest = {}, requestedMinutes = 0) {
  const directPaidMinutes = safeNonNegativeInt(
    otRequest?.totalRequestPaidMinutes ?? otRequest?.totalPaidMinutes,
    0,
  )

  if (directPaidMinutes > 0) return directPaidMinutes

  const totalMinutes = safeNonNegativeInt(otRequest?.totalMinutes, 0)
  if (totalMinutes > 0) return totalMinutes

  const breakMinutes = safeNonNegativeInt(otRequest?.breakMinutes, 0)
  const requestMinutes = safeNonNegativeInt(requestedMinutes, 0)

  if (requestMinutes > 0 && breakMinutes > 0 && breakMinutes < requestMinutes) {
    return requestMinutes - breakMinutes
  }

  return requestMinutes
}

function roundMinutesByPolicy(minutes, unitMinutes, roundMethod) {
  const rawMinutes = safeNonNegativeInt(minutes, 0)
  const unit = safeNonNegativeInt(unitMinutes, 0)

  if (!unit || rawMinutes <= 0) return rawMinutes

  const factor = rawMinutes / unit
  const method = upper(roundMethod)

  if (method === 'FLOOR') return Math.floor(factor) * unit
  if (method === 'NEAREST') return Math.round(factor) * unit

  return Math.ceil(factor) * unit
}

function overlapMinutes(startA, endA, startB, endB) {
  const start = Math.max(safeNumber(startA, 0), safeNumber(startB, 0))
  const end = Math.min(safeNumber(endA, 0), safeNumber(endB, 0))

  return Math.max(0, end - start)
}

function buildShiftWindow(shiftStartTime, shiftEndTime) {
  const startMinutes = toMinutes(shiftStartTime)
  const endMinutes = toMinutes(shiftEndTime)

  if (startMinutes == null || endMinutes == null) {
    return {
      startMinutes: null,
      endMinutes: null,
      expectedEndMinutes: null,
      isCrossMidnightShift: null,
      isValid: false,
    }
  }

  const isCrossMidnightShift = endMinutes <= startMinutes
  const expectedEndMinutes = isCrossMidnightShift ? endMinutes + 24 * 60 : endMinutes

  return {
    startMinutes,
    endMinutes,
    expectedEndMinutes,
    isCrossMidnightShift,
    isValid: true,
  }
}

function normalizeActualClockOutMinutes({
  clockInMinutes,
  clockOutMinutes,
  shiftStartMinutes,
  isCrossMidnightShift,
}) {
  if (clockOutMinutes == null) return null

  let normalized = clockOutMinutes

  if (isCrossMidnightShift) {
    if (normalized <= shiftStartMinutes) {
      normalized += 24 * 60
    }

    return normalized
  }

  if (clockInMinutes != null && normalized < clockInMinutes) {
    normalized += 24 * 60
  }

  return normalized
}

function safeWorkedMinutes(clockInMinutes, normalizedClockOutMinutes) {
  if (clockInMinutes == null || normalizedClockOutMinutes == null) return 0
  if (normalizedClockOutMinutes <= clockInMinutes) return 0

  return normalizedClockOutMinutes - clockInMinutes
}

function resolveDerivedStatusReason(status, fallbackReason = '') {
  const reason = s(fallbackReason)
  if (reason) return reason

  switch (upper(status)) {
    case 'LEAVE':
      return 'Imported status indicates leave and there are no punches'
    case 'OFF':
      return 'Imported status indicates off day and there are no punches'
    case 'ABSENT':
      return 'No clock in and no clock out'
    case 'FORGET_SCAN_IN':
      return 'Clock out exists but clock in is missing'
    case 'FORGET_SCAN_OUT':
      return 'Clock in exists but clock out is missing'
    case 'SHIFT_MISMATCH':
      return 'Punches do not align with the assigned shift'
    case 'LATE':
      return 'Clock in is later than the assigned shift start'
    case 'PRESENT':
      return 'Clock in/out align with the assigned shift'
    case 'UNKNOWN':
    default:
      return 'Unable to derive attendance result'
  }
}

function resolveDerivedStatusReasonKey(status, fallbackKey = '') {
  const key = s(fallbackKey)
  if (key) return key

  switch (upper(status)) {
    case 'LEAVE':
      return MESSAGE_KEYS.ATTENDANCE.LEAVE
    case 'OFF':
      return MESSAGE_KEYS.ATTENDANCE.OFF
    case 'ABSENT':
      return MESSAGE_KEYS.ATTENDANCE.ABSENT
    case 'FORGET_SCAN_IN':
      return MESSAGE_KEYS.ATTENDANCE.FORGET_SCAN_IN
    case 'FORGET_SCAN_OUT':
      return MESSAGE_KEYS.ATTENDANCE.FORGET_SCAN_OUT
    case 'SHIFT_MISMATCH':
      return MESSAGE_KEYS.ATTENDANCE.SHIFT_MISMATCH
    case 'LATE':
      return MESSAGE_KEYS.ATTENDANCE.LATE
    case 'PRESENT':
      return MESSAGE_KEYS.ATTENDANCE.PRESENT
    case 'UNKNOWN':
    default:
      return MESSAGE_KEYS.ATTENDANCE.UNKNOWN
  }
}

function deriveAttendanceResult({
  attendanceDate,
  clockIn,
  clockOut,
  importedStatus,
  employeeMatched,
  shiftMatched,
  shiftTimeMatched,
  shiftStartTime,
  shiftEndTime,
  lateGraceMinutes = 0,
}) {
  const normalizedImportedStatus = upper(importedStatus)
  const hasClockIn = Boolean(s(clockIn))
  const hasClockOut = Boolean(s(clockOut))

  const shiftWindow = buildShiftWindow(shiftStartTime, shiftEndTime)
  const clockInMinutes = toMinutes(clockIn)
  const rawClockOutMinutes = toMinutes(clockOut)

  const normalizedClockOutMinutes = normalizeActualClockOutMinutes({
    clockInMinutes,
    clockOutMinutes: rawClockOutMinutes,
    shiftStartMinutes: shiftWindow.startMinutes,
    isCrossMidnightShift: shiftWindow.isCrossMidnightShift,
  })

  const workedMinutes = safeWorkedMinutes(clockInMinutes, normalizedClockOutMinutes)

  const lateMinutes =
    shiftWindow.isValid && clockInMinutes != null
      ? Math.max(0, clockInMinutes - shiftWindow.startMinutes)
      : 0

  const earlyOutMinutes =
    shiftWindow.isValid && normalizedClockOutMinutes != null
      ? Math.max(0, shiftWindow.expectedEndMinutes - normalizedClockOutMinutes)
      : 0

  const base = {
    attendanceDate: s(attendanceDate),
    attendanceDateDisplay: formatYmdToDmy(attendanceDate),
    hasClockIn,
    hasClockOut,
    isCrossMidnightShift: shiftWindow.isCrossMidnightShift,
    workedMinutes,
    lateMinutes,
    earlyOutMinutes,
    derivedStatus: 'UNKNOWN',
    derivedStatusReason: '',
    derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.UNKNOWN,
    messageKey: MESSAGE_KEYS.ATTENDANCE.UNKNOWN,
  }

  if (!employeeMatched) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Employee is not matched to Employee master',
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.EMPLOYEE_NOT_MATCHED,
      messageKey: MESSAGE_KEYS.ATTENDANCE.EMPLOYEE_NOT_MATCHED,
    }
  }

  if (!hasClockIn && !hasClockOut) {
    if (normalizedImportedStatus === 'LEAVE') {
      return {
        ...base,
        derivedStatus: 'LEAVE',
        derivedStatusReason: resolveDerivedStatusReason('LEAVE'),
        derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.LEAVE,
        messageKey: MESSAGE_KEYS.ATTENDANCE.LEAVE,
      }
    }

    if (normalizedImportedStatus === 'OFF') {
      return {
        ...base,
        derivedStatus: 'OFF',
        derivedStatusReason: resolveDerivedStatusReason('OFF'),
        derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.OFF,
        messageKey: MESSAGE_KEYS.ATTENDANCE.OFF,
      }
    }

    return {
      ...base,
      derivedStatus: 'ABSENT',
      derivedStatusReason: resolveDerivedStatusReason('ABSENT'),
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.ABSENT,
      messageKey: MESSAGE_KEYS.ATTENDANCE.ABSENT,
    }
  }

  if (hasClockIn && !hasClockOut) {
    return {
      ...base,
      derivedStatus: 'FORGET_SCAN_OUT',
      derivedStatusReason: resolveDerivedStatusReason('FORGET_SCAN_OUT'),
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.FORGET_SCAN_OUT,
      messageKey: MESSAGE_KEYS.ATTENDANCE.FORGET_SCAN_OUT,
    }
  }

  if (!hasClockIn && hasClockOut) {
    return {
      ...base,
      derivedStatus: 'FORGET_SCAN_IN',
      derivedStatusReason: resolveDerivedStatusReason('FORGET_SCAN_IN'),
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.FORGET_SCAN_IN,
      messageKey: MESSAGE_KEYS.ATTENDANCE.FORGET_SCAN_IN,
    }
  }

  if (clockInMinutes == null || rawClockOutMinutes == null) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Clock in/out format is invalid',
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.INVALID_CLOCK_FORMAT,
      messageKey: MESSAGE_KEYS.ATTENDANCE.INVALID_CLOCK_FORMAT,
    }
  }

  if (!shiftWindow.isValid) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Assigned shift time is missing or invalid',
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.INVALID_SHIFT_TIME,
      messageKey: MESSAGE_KEYS.ATTENDANCE.INVALID_SHIFT_TIME,
    }
  }

  if (shiftMatched === false || shiftTimeMatched === false) {
    return {
      ...base,
      derivedStatus: 'SHIFT_MISMATCH',
      derivedStatusReason: resolveDerivedStatusReason('SHIFT_MISMATCH'),
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.SHIFT_MISMATCH,
      messageKey: MESSAGE_KEYS.ATTENDANCE.SHIFT_MISMATCH,
    }
  }

  if (lateMinutes > Number(lateGraceMinutes || 0)) {
    return {
      ...base,
      derivedStatus: 'LATE',
      derivedStatusReason: resolveDerivedStatusReason('LATE'),
      derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.LATE,
      messageKey: MESSAGE_KEYS.ATTENDANCE.LATE,
    }
  }

  return {
    ...base,
    derivedStatus: 'PRESENT',
    derivedStatusReason: resolveDerivedStatusReason('PRESENT'),
    derivedStatusReasonKey: MESSAGE_KEYS.ATTENDANCE.PRESENT,
    messageKey: MESSAGE_KEYS.ATTENDANCE.PRESENT,
  }
}

function mapEmployeeSnapshot(item) {
  return {
    employeeId: item?.employeeId ? String(item.employeeId) : null,
    employeeCode: upper(item?.employeeCode || item?.employeeNo),
    employeeNo: upper(item?.employeeNo || item?.employeeCode),
    employeeName: s(item?.employeeName || item?.name),

    departmentId: item?.departmentId ? String(item.departmentId) : null,
    departmentCode: upper(item?.departmentCode),
    departmentName: s(item?.departmentName),

    positionId: item?.positionId ? String(item.positionId) : null,
    positionCode: upper(item?.positionCode),
    positionName: s(item?.positionName),

    lineId: item?.lineId ? String(item.lineId) : null,
    lineCode: upper(item?.lineCode),
    lineName: s(item?.lineName),
    lineLabel: s(item?.lineLabel),

    // Keep employee-level OT time as source of truth.
    // Payment must calculate from the approved employee row, not only the
    // request-level OT option that was selected at the beginning.
    otTimeMode: upper(item?.otTimeMode || 'DEFAULT'),
    startTime: s(item?.startTime || item?.requestStartTime),
    endTime: s(item?.endTime || item?.requestEndTime),
    requestStartTime: s(item?.requestStartTime || item?.startTime),
    requestEndTime: s(item?.requestEndTime || item?.endTime),
    expectedOtStartTime: s(item?.expectedOtStartTime || item?.startTime),
    expectedOtEndTime: s(item?.expectedOtEndTime || item?.endTime),

    requestedMinutes: safeNonNegativeInt(item?.requestedMinutes, 0),
    requestedOtMinutes: safeNonNegativeInt(
      item?.requestedOtMinutes ?? item?.requestedMinutes,
      0,
    ),
    breakMinutes: safeNonNegativeInt(item?.breakMinutes, 0),
    totalRequestPaidMinutes: safeNonNegativeInt(
      item?.totalRequestPaidMinutes ?? item?.totalMinutes ?? item?.paidMinutes,
      0,
    ),
    requestPaidMinutes: safeNonNegativeInt(
      item?.requestPaidMinutes ?? item?.totalRequestPaidMinutes ?? item?.totalMinutes,
      0,
    ),
    approvedMinutes: safeNonNegativeInt(
      item?.approvedMinutes ?? item?.totalRequestPaidMinutes ?? item?.totalMinutes,
      0,
    ),
    approvedPaidMinutes: safeNonNegativeInt(
      item?.approvedPaidMinutes ?? item?.totalRequestPaidMinutes ?? item?.totalMinutes,
      0,
    ),
    payableCapMinutes: safeNonNegativeInt(
      item?.payableCapMinutes ?? item?.totalRequestPaidMinutes ?? item?.totalMinutes,
      0,
    ),
    totalMinutes: safeNonNegativeInt(item?.totalMinutes ?? item?.totalRequestPaidMinutes, 0),
    totalHours: safeNumber(item?.totalHours, 0),
  }
}

function mapAttendanceRecord(item) {
  const status = upper(item?.status)
  const messageKey =
    s(item?.messageKey) ||
    s(item?.derivedStatusReasonKey) ||
    resolveDerivedStatusReasonKey(status)

  return {
    id: item?._id ? String(item._id) : item?.id ? String(item.id) : null,
    importId: item?.importId ? String(item.importId) : null,

    employeeId: item?.employeeId ? String(item.employeeId) : null,
    employeeNo: upper(item?.employeeNo),
    employeeName: s(item?.employeeName),

    importedEmployeeId: upper(item?.importedEmployeeId),
    importedEmployeeName: s(item?.importedEmployeeName),
    importedDepartmentName: s(item?.importedDepartmentName),
    importedPositionName: s(item?.importedPositionName),
    importedShiftName: s(item?.importedShiftName),
    importedStatus: upper(item?.importedStatus),

    departmentId: item?.departmentId ? String(item.departmentId) : null,
    departmentCode: upper(item?.departmentCode),
    departmentName: s(item?.departmentName),

    positionId: item?.positionId ? String(item.positionId) : null,
    positionCode: upper(item?.positionCode),
    positionName: s(item?.positionName),

    shiftId: item?.shiftId ? String(item.shiftId) : null,
    shiftCode: upper(item?.shiftCode),
    shiftName: s(item?.shiftName),
    shiftType: upper(item?.shiftType),
    shiftStartTime: s(item?.shiftStartTime),
    shiftEndTime: s(item?.shiftEndTime),

    attendanceDate: s(item?.attendanceDate),
    attendanceDateDisplay: formatYmdToDmy(item?.attendanceDate),

    clockIn: s(item?.clockIn),
    clockOut: s(item?.clockOut),

    status,
    derivedStatusReason: s(item?.derivedStatusReason),
    derivedStatusReasonKey: s(item?.derivedStatusReasonKey) || messageKey,
    messageKey,

    dayType: upper(item?.dayType),
    matchedBy: upper(item?.matchedBy),
    matchRemark: s(item?.matchRemark),

    employeeMatched: item?.employeeMatched === true,
    nameMatched: typeof item?.nameMatched === 'boolean' ? item.nameMatched : null,
    departmentMatched: typeof item?.departmentMatched === 'boolean' ? item.departmentMatched : null,
    positionMatched: typeof item?.positionMatched === 'boolean' ? item.positionMatched : null,
    shiftMatched: typeof item?.shiftMatched === 'boolean' ? item.shiftMatched : null,
    shiftTimeMatched: typeof item?.shiftTimeMatched === 'boolean' ? item.shiftTimeMatched : null,
    shiftMatchStatus: upper(item?.shiftMatchStatus),

    hasClockIn: typeof item?.hasClockIn === 'boolean' ? item.hasClockIn : Boolean(s(item?.clockIn)),
    hasClockOut: typeof item?.hasClockOut === 'boolean' ? item.hasClockOut : Boolean(s(item?.clockOut)),
    isCrossMidnightShift:
      typeof item?.isCrossMidnightShift === 'boolean' ? item.isCrossMidnightShift : null,

    workedMinutes: Number(item?.workedMinutes || 0),
    lateMinutes: Number(item?.lateMinutes || 0),
    earlyOutMinutes: Number(item?.earlyOutMinutes || 0),

    validationIssues: Array.isArray(item?.validationIssues) ? item.validationIssues : [],

    rawRowNo: Number(item?.rawRowNo || 0),

    createdAt: item?.createdAt || null,
    createdAtDisplayHm: formatDateTimeToDmyHm(item?.createdAt),

    updatedAt: item?.updatedAt || null,
    updatedAtDisplayHm: formatDateTimeToDmyHm(item?.updatedAt),
  }
}

function isAttendedRecord(item) {
  const status = upper(item?.status)
  return ['PRESENT', 'LATE'].includes(status)
}

function isPendingReviewRecord(item) {
  const status = upper(item?.status)
  return ['FORGET_SCAN_IN', 'FORGET_SCAN_OUT'].includes(status)
}

function isShiftValidRecord(item) {
  const status = upper(item?.status)
  if (status === 'SHIFT_MISMATCH') return false

  return upper(item?.shiftMatchStatus) !== 'MISMATCH'
}

function isNormalAttendancePresentForApprovedOt(status) {
  return ['PRESENT', 'LATE'].includes(upper(status))
}

function isOnePunchAttendanceForApprovedOt(status) {
  return ['FORGET_SCAN_IN', 'FORGET_SCAN_OUT'].includes(upper(status))
}

function hasAnyAttendancePunch(attendanceRecord = {}) {
  return (
    attendanceRecord?.hasClockIn === true ||
    attendanceRecord?.hasClockOut === true ||
    Boolean(s(attendanceRecord?.clockIn)) ||
    Boolean(s(attendanceRecord?.clockOut))
  )
}

function isAttendanceCreditableForApprovedOt(status, attendanceRecord = {}) {
  const normalizedStatus = upper(status)

  if (
    isNormalAttendancePresentForApprovedOt(normalizedStatus) ||
    isOnePunchAttendanceForApprovedOt(normalizedStatus)
  ) {
    return true
  }

  // Payment policy can allow approved OT without exact OT clock-out. In that
  // case, shift mismatch from attendance import must not block payment when
  // the employee still has at least one valid punch. The approved employee OT
  // time remains the source of truth for payable minutes.
  return hasAnyAttendancePunch(attendanceRecord)
}

function isAttendanceBlockedForApprovedOt(status, attendanceRecord = {}) {
  if (hasAnyAttendancePunch(attendanceRecord)) {
    return false
  }

  return ['ABSENT', 'LEAVE', 'OFF', 'SHIFT_MISMATCH', 'UNKNOWN'].includes(upper(status))
}

function buildRequestedIndex(requestedEmployees = []) {
  const byEmployeeId = new Map()
  const byEmployeeCode = new Map()

  for (const item of requestedEmployees.map(mapEmployeeSnapshot)) {
    const keyById = s(item.employeeId)
    const keyByCode = upper(item.employeeCode || item.employeeNo)

    if (keyById) byEmployeeId.set(keyById, item)
    if (keyByCode) byEmployeeCode.set(keyByCode, item)
  }

  return { byEmployeeId, byEmployeeCode }
}

function getRequestedEmployeeKey(record, requestedIndex) {
  const employeeId = s(record?.employeeId)
  if (employeeId && requestedIndex.byEmployeeId.has(employeeId)) {
    return employeeId
  }

  const employeeCode = upper(record?.employeeNo || record?.employeeCode)
  if (employeeCode && requestedIndex.byEmployeeCode.has(employeeCode)) {
    const requested = requestedIndex.byEmployeeCode.get(employeeCode)
    return s(requested.employeeId) || employeeCode
  }

  return ''
}

function normalizePolicySnapshot(snapshot = {}) {
  return {
    calculationPolicyId: snapshot?.calculationPolicyId
      ? String(snapshot.calculationPolicyId)
      : null,

    code: upper(snapshot?.code),
    name: s(snapshot?.name),

    minEligibleMinutes: safeNonNegativeInt(snapshot?.minEligibleMinutes, 0),
    roundUnitMinutes: safeNonNegativeInt(snapshot?.roundUnitMinutes, 30) || 30,
    roundMethod: upper(snapshot?.roundMethod || 'CEIL'),
    graceAfterShiftEndMinutes: safeNonNegativeInt(snapshot?.graceAfterShiftEndMinutes, 0),

    allowApprovedOtWithoutExactClockOut:
      snapshot?.allowApprovedOtWithoutExactClockOut === true,

    allowPreShiftOT: snapshot?.allowPreShiftOT === true,
    allowPostShiftOT: snapshot?.allowPostShiftOT !== false,
    capByRequestedMinutes: snapshot?.capByRequestedMinutes !== false,
    treatForgetScanInAsPending: snapshot?.treatForgetScanInAsPending !== false,
    treatForgetScanOutAsPending: snapshot?.treatForgetScanOutAsPending !== false,
  }
}

function normalizeScheduleMinute(rawMinutes, anchorMinutes, isCrossMidnight) {
  if (rawMinutes == null) return null

  let normalized = rawMinutes

  if (isCrossMidnight && anchorMinutes != null && normalized < anchorMinutes) {
    normalized += 24 * 60
  }

  return normalized
}

function chooseNearestMinute(rawMinutes, anchorMinutes) {
  if (rawMinutes == null) return null

  const candidates = [rawMinutes - 24 * 60, rawMinutes, rawMinutes + 24 * 60]

  let best = candidates[0]
  let bestDiff = Math.abs(best - anchorMinutes)

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i]
    const diff = Math.abs(candidate - anchorMinutes)

    if (diff < bestDiff) {
      best = candidate
      bestDiff = diff
    }
  }

  return best
}

function normalizeOtRequestContext(otRequest = {}) {
  const policy = normalizePolicySnapshot(otRequest?.otCalculationPolicySnapshot || {})

  const otDate = s(otRequest?.otDate)
  const shiftStartTime = s(otRequest?.shiftStartTime)
  const shiftEndTime = s(otRequest?.shiftEndTime)

  const requestStartTime = s(
    otRequest?.requestStartTime ||
      otRequest?.expectedOtStartTime ||
      otRequest?.startTime,
  )

  let requestEndTime = s(
    otRequest?.requestEndTime ||
      otRequest?.expectedOtEndTime ||
      otRequest?.endTime,
  )

  const requestedMinutes = safeNonNegativeInt(
    otRequest?.requestedMinutes || otRequest?.totalMinutes,
    0,
  )

  const breakMinutes = safeNonNegativeInt(otRequest?.breakMinutes, 0)
  const totalRequestPaidMinutes = resolvePaidRequestMinutes(otRequest, requestedMinutes)

  const shiftStartMinutesRaw = toMinutes(shiftStartTime)
  const shiftEndMinutesRaw = toMinutes(shiftEndTime)

  const derivedShiftCrossMidnight =
    shiftStartMinutesRaw != null &&
    shiftEndMinutesRaw != null &&
    shiftEndMinutesRaw <= shiftStartMinutesRaw

  const shiftCrossMidnight =
    typeof otRequest?.shiftCrossMidnight === 'boolean'
      ? otRequest.shiftCrossMidnight
      : derivedShiftCrossMidnight

  const shiftStartMinutes = shiftStartMinutesRaw
  const shiftEndMinutes = normalizeScheduleMinute(
    shiftEndMinutesRaw,
    shiftStartMinutes,
    shiftCrossMidnight,
  )

  const requestStartMinutesRaw = toMinutes(requestStartTime)
  let requestStartMinutes = normalizeScheduleMinute(
    requestStartMinutesRaw,
    shiftStartMinutes,
    shiftCrossMidnight,
  )

  if (requestStartMinutes == null && shiftEndMinutes != null) {
    requestStartMinutes = shiftEndMinutes
  }

  let requestEndMinutesRaw = toMinutes(requestEndTime)

  if (requestEndMinutesRaw == null && requestStartMinutes != null && requestedMinutes > 0) {
    requestEndMinutesRaw = ((requestStartMinutes % 1440) + requestedMinutes) % 1440
    requestEndTime = minutesToHHmm(requestStartMinutes + requestedMinutes)
  }

  let requestEndMinutes = normalizeScheduleMinute(
    requestEndMinutesRaw,
    shiftStartMinutes,
    shiftCrossMidnight,
  )

  if (
    requestEndMinutes != null &&
    requestStartMinutes != null &&
    requestEndMinutes < requestStartMinutes
  ) {
    requestEndMinutes += 24 * 60
  }

  if (!requestEndTime && requestEndMinutes != null) {
    requestEndTime = minutesToHHmm(requestEndMinutes)
  }

  const shiftOtOptionTimingMode = upper(
    otRequest?.shiftOtOptionTimingMode ||
      otRequest?.timingMode ||
      otRequest?.shiftOtOptionSnapshot?.timingMode ||
      '',
  )

  return {
    id: otRequest?.id ? String(otRequest.id) : null,
    requestNo: s(otRequest?.requestNo),

    otDate,
    otDateDisplay: formatYmdToDmy(otDate),

    status: upper(otRequest?.status),
    dayType: upper(otRequest?.dayType),

    shiftId: otRequest?.shiftId ? String(otRequest.shiftId) : null,
    shiftCode: upper(otRequest?.shiftCode),
    shiftName: s(otRequest?.shiftName),
    shiftType: upper(otRequest?.shiftType),
    shiftStartTime,
    shiftEndTime,
    shiftCrossMidnight: shiftCrossMidnight === true,
    shiftStartMinutes,
    shiftEndMinutes,

    shiftOtOptionId: otRequest?.shiftOtOptionId ? String(otRequest.shiftOtOptionId) : null,
    shiftOtOptionLabel: s(otRequest?.shiftOtOptionLabel),
    shiftOtOptionTimingMode,
    shiftOtOptionStartAfterShiftEndMinutes: safeNonNegativeInt(
      otRequest?.shiftOtOptionStartAfterShiftEndMinutes,
      0,
    ),
    shiftOtOptionFixedStartTime: s(otRequest?.shiftOtOptionFixedStartTime),
    shiftOtOptionFixedEndTime: s(otRequest?.shiftOtOptionFixedEndTime),

    requestedMinutes,
    breakMinutes,
    totalRequestPaidMinutes,
    approvedPaidMinutes: totalRequestPaidMinutes,
    payableCapMinutes: totalRequestPaidMinutes,

    requestStartTime:
      requestStartTime || (requestStartMinutes != null ? minutesToHHmm(requestStartMinutes) : ''),
    requestEndTime:
      requestEndTime || (requestEndMinutes != null ? minutesToHHmm(requestEndMinutes) : ''),

    requestStartMinutes,
    requestEndMinutes,

    totalMinutes: totalRequestPaidMinutes,
    totalHours: safeNumber(
      otRequest?.totalHours,
      totalRequestPaidMinutes > 0 ? totalRequestPaidMinutes / 60 : 0,
    ),

    otCalculationPolicyId: otRequest?.otCalculationPolicyId
      ? String(otRequest.otCalculationPolicyId)
      : null,
    otCalculationPolicySnapshot: policy,
  }
}

function buildAttendanceWindow(attendanceRecord, anchorMinutes) {
  const clockInRaw = toMinutes(attendanceRecord?.clockIn)
  const clockOutRaw = toMinutes(attendanceRecord?.clockOut)

  if (clockInRaw == null || clockOutRaw == null) {
    return {
      clockInMinutes: null,
      clockOutMinutes: null,
      isValid: false,
    }
  }

  const clockInMinutes = chooseNearestMinute(clockInRaw, anchorMinutes)
  let clockOutMinutes = chooseNearestMinute(clockOutRaw, anchorMinutes)

  if (clockOutMinutes < clockInMinutes) {
    clockOutMinutes += 24 * 60
  }

  return {
    clockInMinutes,
    clockOutMinutes,
    isValid: clockOutMinutes >= clockInMinutes,
  }
}

function buildMismatchResponse(base, reason, overrides = {}) {
  const result = upper(overrides.otResult || 'MISMATCH')
  const reasonKey = s(overrides.otResultReasonKey || overrides.messageKey)

  return {
    ...base,
    actualOtMinutes: Number(overrides.actualOtMinutes || 0),
    eligibleOtMinutes: Number(overrides.eligibleOtMinutes || 0),
    roundedOtMinutes: Number(overrides.roundedOtMinutes || 0),

    rawOtDecision: upper(overrides.rawOtDecision || result),
    rawOtDecisionKey: s(overrides.rawOtDecisionKey || reasonKey),

    otResult: result,
    otResultLabelKey:
      result === 'PENDING_REVIEW'
        ? MESSAGE_KEYS.VERIFICATION.PENDING_REVIEW
        : MESSAGE_KEYS.VERIFICATION.MISMATCH,

    otResultReason: s(reason),
    otResultReasonKey: reasonKey || MESSAGE_KEYS.VERIFICATION.POLICY_EXCEED,
    messageKey: reasonKey || MESSAGE_KEYS.VERIFICATION.POLICY_EXCEED,
  }
}

function buildApprovedOtWithoutExactOutResponse(base, normalizedOtRequest, attendanceStatus) {
  const requestedMinutes = Number(normalizedOtRequest.requestedMinutes || 0)
  const paidRequestMinutes = Number(
    normalizedOtRequest.totalRequestPaidMinutes ||
      normalizedOtRequest.totalMinutes ||
      requestedMinutes ||
      0,
  )

  const timingMode = upper(normalizedOtRequest.shiftOtOptionTimingMode)
  const isFixedTime = timingMode === 'FIXED_TIME'
  const normalizedAttendanceStatus = upper(attendanceStatus)
  const isLate = normalizedAttendanceStatus === 'LATE'
  const isOnePunch = isOnePunchAttendanceForApprovedOt(normalizedAttendanceStatus)

  let reason = ''
  let reasonKey = ''

  if (isFixedTime && isOnePunch) {
    reason =
      'Fixed OT credited by policy. Employee has one attendance punch, and exact OT scan is not required.'
    reasonKey = MESSAGE_KEYS.VERIFICATION.FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT
  } else if (isFixedTime && isLate) {
    reason =
      'Fixed OT credited by policy. Employee was late but attended normal shift. Exact OT end scan is not required.'
    reasonKey = MESSAGE_KEYS.VERIFICATION.FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT_LATE
  } else if (isFixedTime) {
    reason =
      'Fixed OT credited by policy. Employee attended normal shift. Exact OT end scan is not required.'
    reasonKey = MESSAGE_KEYS.VERIFICATION.FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT
  } else if (isOnePunch) {
    reason =
      'Approved OT credited by policy. Employee has one attendance punch, and exact OT scan is not required.'
    reasonKey = MESSAGE_KEYS.VERIFICATION.APPROVED_WITHOUT_EXACT_CLOCK_OUT
  } else if (isLate) {
    reason =
      'Approved OT credited by policy. Employee was late but attended normal shift. Exact OT end scan is not required.'
    reasonKey = MESSAGE_KEYS.VERIFICATION.APPROVED_WITHOUT_EXACT_CLOCK_OUT_LATE
  } else {
    reason =
      'Approved OT credited by policy. Employee attended normal shift. Exact OT end scan is not required.'
    reasonKey = MESSAGE_KEYS.VERIFICATION.APPROVED_WITHOUT_EXACT_CLOCK_OUT
  }

  return {
    ...base,
    actualOtMinutes: paidRequestMinutes,
    eligibleOtMinutes: paidRequestMinutes,
    roundedOtMinutes: paidRequestMinutes,

    rawOtDecision: isFixedTime
      ? 'FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT'
      : 'APPROVED_WITHOUT_EXACT_CLOCK_OUT',
    rawOtDecisionKey: reasonKey,

    otResult: 'MATCH',
    otResultLabelKey: MESSAGE_KEYS.VERIFICATION.MATCH,
    otResultReason: reason,
    otResultReasonKey: reasonKey,
    messageKey: reasonKey,
  }
}

function calculatePolicyDrivenOtMetrics({ otRequest, attendanceRecord }) {
  const normalizedOtRequest = normalizeOtRequestContext(otRequest)
  const attendanceStatus = upper(attendanceRecord?.status)
  const policy = normalizedOtRequest.otCalculationPolicySnapshot || {}

  const paidRequestMinutes = Number(
    normalizedOtRequest.totalRequestPaidMinutes ||
      normalizedOtRequest.totalMinutes ||
      normalizedOtRequest.requestedMinutes ||
      0,
  )

  const base = {
    requestedMinutes: normalizedOtRequest.requestedMinutes,
    requestedOtMinutes: normalizedOtRequest.requestedMinutes,

    breakMinutes: normalizedOtRequest.breakMinutes,

    totalRequestPaidMinutes: paidRequestMinutes,
    requestPaidMinutes: paidRequestMinutes,
    approvedMinutes: paidRequestMinutes,
    approvedPaidMinutes: paidRequestMinutes,
    payableCapMinutes: paidRequestMinutes,

    expectedOtStartTime: s(normalizedOtRequest.requestStartTime),
    expectedOtEndTime: s(normalizedOtRequest.requestEndTime),

    actualOtMinutes: 0,
    eligibleOtMinutes: 0,
    roundedOtMinutes: 0,

    rawOtDecision: 'MISMATCH',
    rawOtDecisionKey: '',

    otResult: 'MISMATCH',
    otResultLabelKey: MESSAGE_KEYS.VERIFICATION.MISMATCH,
    otResultReason: '',
    otResultReasonKey: '',
    messageKey: '',

    shiftOtOptionTimingMode: normalizedOtRequest.shiftOtOptionTimingMode,
    isFixedTimeOt: normalizedOtRequest.shiftOtOptionTimingMode === 'FIXED_TIME',

    policyCode: s(policy.code),
    policyName: s(policy.name),
    policyAllowApprovedOtWithoutExactClockOut:
      policy.allowApprovedOtWithoutExactClockOut === true,
    policyRoundMethod: s(policy.roundMethod),
    policyRoundUnitMinutes: Number(policy.roundUnitMinutes || 0),
    policyMinEligibleMinutes: Number(policy.minEligibleMinutes || 0),
    policyGraceAfterShiftEndMinutes: Number(policy.graceAfterShiftEndMinutes || 0),
  }

  if (paidRequestMinutes <= 0) {
    return buildMismatchResponse(base, 'No paid OT minutes found on approved OT request', {
      rawOtDecision: 'NO_OT_REQUEST',
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.NO_PAID_OT_MINUTES,
    })
  }

  if (
    upper(normalizedOtRequest.dayType) === 'WORKING_DAY' &&
    policy.allowApprovedOtWithoutExactClockOut === true
  ) {
    // For approved OT options that explicitly allow payment without an exact
    // OT clock-out, one valid punch is enough to pay the approved employee OT
    // time. This prevents payment from falling back to warning just because the
    // employee forgot scan-in/out.
    if (isAttendanceCreditableForApprovedOt(attendanceStatus, attendanceRecord)) {
      return buildApprovedOtWithoutExactOutResponse(base, normalizedOtRequest, attendanceStatus)
    }

    if (isAttendanceBlockedForApprovedOt(attendanceStatus, attendanceRecord)) {
      return buildMismatchResponse(
        base,
        `Approved OT not credited because attendance status is ${attendanceStatus || 'UNKNOWN'}`,
        {
          rawOtDecision: 'ATTENDANCE_NOT_PRESENT',
          otResultReasonKey: MESSAGE_KEYS.VERIFICATION.ATTENDANCE_NOT_PRESENT,
        },
      )
    }

    return buildMismatchResponse(
      base,
      `Approved OT requires manual review because attendance status is ${attendanceStatus || 'UNKNOWN'}`,
      {
        rawOtDecision: 'PENDING_REVIEW',
        otResult: 'PENDING_REVIEW',
        otResultReasonKey: MESSAGE_KEYS.VERIFICATION.STATUS_REQUIRES_MANUAL_REVIEW,
      },
    )
  }

  if (attendanceStatus === 'FORGET_SCAN_IN' && policy.treatForgetScanInAsPending) {
    return buildMismatchResponse(base, 'Forget scan in is pending review by OT policy', {
      rawOtDecision: 'PENDING_REVIEW',
      otResult: 'PENDING_REVIEW',
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.FORGET_SCAN_IN_PENDING,
    })
  }

  if (attendanceStatus === 'FORGET_SCAN_OUT' && policy.treatForgetScanOutAsPending) {
    return buildMismatchResponse(base, 'Forget scan out is pending review by OT policy', {
      rawOtDecision: 'PENDING_REVIEW',
      otResult: 'PENDING_REVIEW',
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.FORGET_SCAN_OUT_PENDING,
    })
  }

  if (
    normalizedOtRequest.requestStartMinutes == null ||
    normalizedOtRequest.requestEndMinutes == null
  ) {
    return buildMismatchResponse(base, 'OT request time window is missing or invalid', {
      rawOtDecision: 'NO_REQUEST_WINDOW',
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.NO_REQUEST_WINDOW,
    })
  }

  const attendanceWindow = buildAttendanceWindow(
    attendanceRecord,
    normalizedOtRequest.requestStartMinutes,
  )

  if (!attendanceWindow.isValid) {
    return buildMismatchResponse(base, 'Clock in/out window is missing or invalid', {
      rawOtDecision: 'NO_ATTENDANCE_WINDOW',
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.NO_ATTENDANCE_WINDOW,
    })
  }

  const actualOtMinutesWithinRequest = overlapMinutes(
    normalizedOtRequest.requestStartMinutes,
    normalizedOtRequest.requestEndMinutes,
    attendanceWindow.clockInMinutes,
    attendanceWindow.clockOutMinutes,
  )

  if (['SUNDAY', 'HOLIDAY'].includes(upper(normalizedOtRequest.dayType))) {
    return calculateSundayHolidayOt({
      base,
      policy,
      paidRequestMinutes,
      actualOtMinutesWithinRequest,
    })
  }

  return calculateWorkingDayOt({
    base,
    policy,
    normalizedOtRequest,
    paidRequestMinutes,
    actualOtMinutesWithinRequest,
    attendanceWindow,
  })
}

function calculateSundayHolidayOt({
  base,
  policy,
  paidRequestMinutes,
  actualOtMinutesWithinRequest,
}) {
  const eligibleOtMinutes = actualOtMinutesWithinRequest

  if (eligibleOtMinutes <= 0) {
    return buildMismatchResponse(
      base,
      'No attendance time overlaps approved Sunday/Holiday OT window',
      {
        rawOtDecision: 'NOT_ELIGIBLE',
        actualOtMinutes: actualOtMinutesWithinRequest,
        eligibleOtMinutes: 0,
        roundedOtMinutes: 0,
        otResultReasonKey: MESSAGE_KEYS.VERIFICATION.SUNDAY_HOLIDAY_NO_OVERLAP,
      },
    )
  }

  if (eligibleOtMinutes < safeNonNegativeInt(policy.minEligibleMinutes, 0)) {
    return buildMismatchResponse(
      base,
      'Eligible Sunday/Holiday OT is below minimum OT policy threshold',
      {
        rawOtDecision: 'BELOW_MIN',
        actualOtMinutes: actualOtMinutesWithinRequest,
        eligibleOtMinutes,
        roundedOtMinutes: 0,
        otResultReasonKey: MESSAGE_KEYS.VERIFICATION.SUNDAY_HOLIDAY_BELOW_MIN,
      },
    )
  }

  let roundedOtMinutes = roundMinutesByPolicy(
    eligibleOtMinutes,
    policy.roundUnitMinutes,
    policy.roundMethod,
  )

  if (policy.capByRequestedMinutes && paidRequestMinutes > 0) {
    roundedOtMinutes = Math.min(roundedOtMinutes, paidRequestMinutes)
  }

  if (roundedOtMinutes === paidRequestMinutes) {
    return {
      ...base,
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes,

      rawOtDecision: 'MATCH',
      rawOtDecisionKey: MESSAGE_KEYS.VERIFICATION.SUNDAY_HOLIDAY_MATCH,

      otResult: 'MATCH',
      otResultLabelKey: MESSAGE_KEYS.VERIFICATION.MATCH,
      otResultReason: 'Sunday/Holiday actual attendance matches approved OT request by policy',
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.SUNDAY_HOLIDAY_MATCH,
      messageKey: MESSAGE_KEYS.VERIFICATION.SUNDAY_HOLIDAY_MATCH,
    }
  }

  if (roundedOtMinutes < paidRequestMinutes) {
    return buildMismatchResponse(
      base,
      'Sunday/Holiday actual OT is shorter than approved OT request',
      {
        rawOtDecision: 'SHORT',
        actualOtMinutes: actualOtMinutesWithinRequest,
        eligibleOtMinutes,
        roundedOtMinutes,
        otResultReasonKey: MESSAGE_KEYS.VERIFICATION.SUNDAY_HOLIDAY_SHORT,
      },
    )
  }

  return buildMismatchResponse(
    base,
    'Sunday/Holiday actual OT does not match approved OT request',
    {
      rawOtDecision: 'EXCEED',
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes,
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.SUNDAY_HOLIDAY_EXCEED,
    },
  )
}

function calculateWorkingDayOt({
  base,
  policy,
  normalizedOtRequest,
  paidRequestMinutes,
  actualOtMinutesWithinRequest,
  attendanceWindow,
}) {
  let eligibleOtMinutes = 0

  const shiftStartMinutes = normalizedOtRequest.shiftStartMinutes
  const shiftEndMinutes = normalizedOtRequest.shiftEndMinutes

  if (policy.allowPreShiftOT) {
    const preShiftEnd =
      shiftStartMinutes != null
        ? Math.min(normalizedOtRequest.requestEndMinutes, shiftStartMinutes)
        : normalizedOtRequest.requestEndMinutes

    if (preShiftEnd > normalizedOtRequest.requestStartMinutes) {
      eligibleOtMinutes += overlapMinutes(
        normalizedOtRequest.requestStartMinutes,
        preShiftEnd,
        attendanceWindow.clockInMinutes,
        attendanceWindow.clockOutMinutes,
      )
    }
  }

  if (policy.allowPostShiftOT) {
    const rawPostStart =
      shiftEndMinutes != null
        ? shiftEndMinutes + safeNonNegativeInt(policy.graceAfterShiftEndMinutes, 0)
        : normalizedOtRequest.requestStartMinutes

    const postShiftStart = Math.max(normalizedOtRequest.requestStartMinutes, rawPostStart)

    if (normalizedOtRequest.requestEndMinutes > postShiftStart) {
      eligibleOtMinutes += overlapMinutes(
        postShiftStart,
        normalizedOtRequest.requestEndMinutes,
        attendanceWindow.clockInMinutes,
        attendanceWindow.clockOutMinutes,
      )
    }
  }

  if (!policy.allowPreShiftOT && !policy.allowPostShiftOT) {
    eligibleOtMinutes = 0
  }

  eligibleOtMinutes = Math.max(0, Math.min(eligibleOtMinutes, actualOtMinutesWithinRequest))

  if (eligibleOtMinutes <= 0) {
    return buildMismatchResponse(base, 'No eligible OT minutes after applying OT policy window', {
      rawOtDecision: 'NOT_ELIGIBLE',
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes: 0,
      roundedOtMinutes: 0,
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.POLICY_NOT_ELIGIBLE,
    })
  }

  if (eligibleOtMinutes < safeNonNegativeInt(policy.minEligibleMinutes, 0)) {
    return buildMismatchResponse(base, 'Eligible OT is below minimum OT policy threshold', {
      rawOtDecision: 'BELOW_MIN',
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes: 0,
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.POLICY_BELOW_MIN,
    })
  }

  let roundedOtMinutes = roundMinutesByPolicy(
    eligibleOtMinutes,
    policy.roundUnitMinutes,
    policy.roundMethod,
  )

  // Important: cap by PAID request minutes, not full raw requested minutes.
  if (policy.capByRequestedMinutes && paidRequestMinutes > 0) {
    roundedOtMinutes = Math.min(roundedOtMinutes, paidRequestMinutes)
  }

  if (roundedOtMinutes === paidRequestMinutes) {
    return {
      ...base,
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes,

      rawOtDecision: 'MATCH',
      rawOtDecisionKey: MESSAGE_KEYS.VERIFICATION.POLICY_MATCH,

      otResult: 'MATCH',
      otResultLabelKey: MESSAGE_KEYS.VERIFICATION.MATCH,
      otResultReason: 'Actual eligible OT matches approved OT request by policy',
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.POLICY_MATCH,
      messageKey: MESSAGE_KEYS.VERIFICATION.POLICY_MATCH,
    }
  }

  if (roundedOtMinutes < paidRequestMinutes) {
    return buildMismatchResponse(base, 'Actual eligible OT is shorter than approved OT request', {
      rawOtDecision: 'SHORT',
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes,
      otResultReasonKey: MESSAGE_KEYS.VERIFICATION.POLICY_SHORT,
    })
  }

  return buildMismatchResponse(base, 'Actual eligible OT does not match approved OT request', {
    rawOtDecision: 'EXCEED',
    actualOtMinutes: actualOtMinutesWithinRequest,
    eligibleOtMinutes,
    roundedOtMinutes,
    otResultReasonKey: MESSAGE_KEYS.VERIFICATION.POLICY_EXCEED,
  })
}

function buildEmployeeSpecificOtRequest(otRequest = {}, requested = {}) {
  const requestedStartTime = s(
    requested.requestStartTime ||
      requested.startTime ||
      requested.expectedOtStartTime ||
      otRequest.requestStartTime ||
      otRequest.startTime ||
      otRequest.expectedOtStartTime,
  )

  const requestedEndTime = s(
    requested.requestEndTime ||
      requested.endTime ||
      requested.expectedOtEndTime ||
      otRequest.requestEndTime ||
      otRequest.endTime ||
      otRequest.expectedOtEndTime,
  )

  const requestedMinutes = safeNonNegativeInt(
    requested.requestedMinutes ||
      requested.requestedOtMinutes ||
      requested.totalRequestPaidMinutes ||
      requested.totalMinutes ||
      otRequest.requestedMinutes,
    0,
  )

  const breakMinutes = safeNonNegativeInt(
    requested.breakMinutes ?? otRequest.breakMinutes,
    0,
  )

  const totalRequestPaidMinutes = safeNonNegativeInt(
    requested.totalRequestPaidMinutes ||
      requested.approvedPaidMinutes ||
      requested.requestPaidMinutes ||
      requested.totalMinutes ||
      (requestedMinutes > 0 && breakMinutes > 0 && breakMinutes < requestedMinutes
        ? requestedMinutes - breakMinutes
        : requestedMinutes) ||
      otRequest.totalRequestPaidMinutes ||
      otRequest.totalMinutes,
    0,
  )

  return {
    ...otRequest,
    requestStartTime: requestedStartTime,
    startTime: requestedStartTime || otRequest.startTime,
    expectedOtStartTime: requestedStartTime || otRequest.expectedOtStartTime,

    requestEndTime: requestedEndTime,
    endTime: requestedEndTime || otRequest.endTime,
    expectedOtEndTime: requestedEndTime || otRequest.expectedOtEndTime,

    requestedMinutes,
    requestedOtMinutes: requestedMinutes,
    breakMinutes,
    totalRequestPaidMinutes,
    totalPaidMinutes: totalRequestPaidMinutes,
    requestPaidMinutes: totalRequestPaidMinutes,
    totalMinutes: totalRequestPaidMinutes,
    totalHours: totalRequestPaidMinutes > 0 ? totalRequestPaidMinutes / 60 : 0,
  }
}

function buildVerificationItem(requested, attendanceRecord, otRequest) {
  const employeeOtRequest = buildEmployeeSpecificOtRequest(otRequest, requested)
  const normalizedOtRequest = normalizeOtRequestContext(employeeOtRequest)

  const metrics = calculatePolicyDrivenOtMetrics({
    otRequest: normalizedOtRequest,
    attendanceRecord,
  })

  return {
    ...requested,

    otDate: normalizedOtRequest.otDate,
    otDateDisplay: normalizedOtRequest.otDateDisplay,

    attendanceRecordId: attendanceRecord.id,
    importId: attendanceRecord.importId,

    attendanceDate: attendanceRecord.attendanceDate,
    attendanceDateDisplay: attendanceRecord.attendanceDateDisplay,

    clockIn: attendanceRecord.clockIn,
    clockOut: attendanceRecord.clockOut,

    attendanceStatus: attendanceRecord.status,
    attendanceStatusKey: resolveDerivedStatusReasonKey(attendanceRecord.status),
    importedStatus: attendanceRecord.importedStatus,

    derivedStatusReason: attendanceRecord.derivedStatusReason,
    derivedStatusReasonKey: attendanceRecord.derivedStatusReasonKey,
    attendanceMessageKey: attendanceRecord.messageKey,
    attendanceDayType: attendanceRecord.dayType,

    shiftId: normalizedOtRequest.shiftId || attendanceRecord.shiftId,
    shiftCode: normalizedOtRequest.shiftCode || attendanceRecord.shiftCode,
    shiftName: normalizedOtRequest.shiftName || attendanceRecord.shiftName,
    shiftType: normalizedOtRequest.shiftType || attendanceRecord.shiftType,
    shiftStartTime: normalizedOtRequest.shiftStartTime || attendanceRecord.shiftStartTime,
    shiftEndTime: normalizedOtRequest.shiftEndTime || attendanceRecord.shiftEndTime,

    shiftMatched: attendanceRecord.shiftMatched,
    shiftTimeMatched: attendanceRecord.shiftTimeMatched,
    shiftMatchStatus: attendanceRecord.shiftMatchStatus,

    hasClockIn: attendanceRecord.hasClockIn,
    hasClockOut: attendanceRecord.hasClockOut,
    isCrossMidnightShift:
      typeof normalizedOtRequest.shiftCrossMidnight === 'boolean'
        ? normalizedOtRequest.shiftCrossMidnight
        : attendanceRecord.isCrossMidnightShift,

    workedMinutes: attendanceRecord.workedMinutes,
    lateMinutes: attendanceRecord.lateMinutes,
    earlyOutMinutes: attendanceRecord.earlyOutMinutes,
    validationIssues: attendanceRecord.validationIssues,

    shiftOtOptionId: normalizedOtRequest.shiftOtOptionId,
    shiftOtOptionLabel: normalizedOtRequest.shiftOtOptionLabel,
    shiftOtOptionTimingMode: metrics.shiftOtOptionTimingMode,
    isFixedTimeOt: metrics.isFixedTimeOt,

    requestedMinutes: metrics.requestedMinutes,
    requestedOtMinutes: metrics.requestedOtMinutes,
    breakMinutes: metrics.breakMinutes,

    totalRequestPaidMinutes: metrics.totalRequestPaidMinutes,
    requestPaidMinutes: metrics.requestPaidMinutes,
    approvedMinutes: metrics.approvedMinutes,
    approvedPaidMinutes: metrics.approvedPaidMinutes,
    payableCapMinutes: metrics.payableCapMinutes,

    expectedOtStartTime: metrics.expectedOtStartTime,
    expectedOtEndTime: metrics.expectedOtEndTime,

    actualOtMinutes: metrics.actualOtMinutes,
    eligibleOtMinutes: metrics.eligibleOtMinutes,
    roundedOtMinutes: metrics.roundedOtMinutes,

    rawOtDecision: metrics.rawOtDecision,
    rawOtDecisionKey: metrics.rawOtDecisionKey,

    otResult: metrics.otResult,
    otResultLabelKey: metrics.otResultLabelKey,
    otResultReason: metrics.otResultReason,
    otResultReasonKey: metrics.otResultReasonKey,
    messageKey: metrics.messageKey,

    policyCode: metrics.policyCode,
    policyName: metrics.policyName,
    policyAllowApprovedOtWithoutExactClockOut:
      metrics.policyAllowApprovedOtWithoutExactClockOut,
    policyRoundMethod: metrics.policyRoundMethod,
    policyRoundUnitMinutes: metrics.policyRoundUnitMinutes,
    policyMinEligibleMinutes: metrics.policyMinEligibleMinutes,
    policyGraceAfterShiftEndMinutes: metrics.policyGraceAfterShiftEndMinutes,
  }
}

function verifyAttendanceAgainstOT({
  otRequest = {},
  requestedEmployees = [],
  approvedEmployees = [],
  attendanceRecords = [],
}) {
  const normalizedOtRequest = normalizeOtRequestContext(otRequest)
  const requestedList = requestedEmployees.map(mapEmployeeSnapshot)
  const approvedList = approvedEmployees.map(mapEmployeeSnapshot)
  const requestedIndex = buildRequestedIndex(requestedList)

  const approvedKeySet = new Set(
    approvedList.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const requestedAttendanceMap = new Map()

  for (const rawRecord of attendanceRecords) {
    const record = mapAttendanceRecord(rawRecord)
    const requestedKey = getRequestedEmployeeKey(record, requestedIndex)

    if (!requestedKey) continue
    if (requestedAttendanceMap.has(requestedKey)) continue

    requestedAttendanceMap.set(requestedKey, record)
  }

  const attendedEmployees = []
  const absentFromApproved = []
  const attendedButNotApproved = []
  const shiftMismatchEmployees = []
  const pendingReviewEmployees = []
  const notEligibleEmployees = []

  const otMatchEmployees = []
  const otMismatchEmployees = []
  const otPendingReviewEmployees = []

  for (const requested of requestedList) {
    const requestedKey = s(requested.employeeId) || upper(requested.employeeCode)
    const attendanceRecord = requestedAttendanceMap.get(requestedKey)

    if (!attendanceRecord) continue

    const item = buildVerificationItem(requested, attendanceRecord, normalizedOtRequest)

    if (upper(item.otResult) === 'MATCH') {
      otMatchEmployees.push(item)
    } else if (upper(item.otResult) === 'PENDING_REVIEW') {
      otPendingReviewEmployees.push(item)
    } else {
      otMismatchEmployees.push(item)
    }

    if (!isShiftValidRecord(attendanceRecord) && upper(item.otResult) !== 'MATCH') {
      shiftMismatchEmployees.push(item)
      continue
    }

    if (upper(item.otResult) === 'MATCH') {
      attendedEmployees.push(item)

      if (!approvedKeySet.has(requestedKey)) {
        attendedButNotApproved.push(item)
      }

      continue
    }

    if (isPendingReviewRecord(attendanceRecord)) {
      pendingReviewEmployees.push(item)
      continue
    }

    if (isAttendedRecord(attendanceRecord)) {
      attendedEmployees.push(item)

      if (!approvedKeySet.has(requestedKey)) {
        attendedButNotApproved.push(item)
      }

      continue
    }

    notEligibleEmployees.push(item)
  }

  const attendedKeySet = new Set(
    attendedEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const pendingReviewKeySet = new Set(
    pendingReviewEmployees
      .map((item) => s(item.employeeId) || upper(item.employeeCode))
      .filter(Boolean),
  )

  const shiftMismatchKeySet = new Set(
    shiftMismatchEmployees
      .map((item) => s(item.employeeId) || upper(item.employeeCode))
      .filter(Boolean),
  )

  const notEligibleKeySet = new Set(
    notEligibleEmployees
      .map((item) => s(item.employeeId) || upper(item.employeeCode))
      .filter(Boolean),
  )

  for (const approved of approvedList) {
    const approvedKey = s(approved.employeeId) || upper(approved.employeeCode)

    if (
      attendedKeySet.has(approvedKey) ||
      pendingReviewKeySet.has(approvedKey) ||
      shiftMismatchKeySet.has(approvedKey) ||
      notEligibleKeySet.has(approvedKey)
    ) {
      continue
    }

    const missingItem = {
      ...approved,

      otDate: normalizedOtRequest.otDate,
      otDateDisplay: normalizedOtRequest.otDateDisplay,

      attendanceDate: normalizedOtRequest.otDate,
      attendanceDateDisplay: normalizedOtRequest.otDateDisplay,

      attendanceStatus: 'ABSENT',
      attendanceStatusKey: MESSAGE_KEYS.ATTENDANCE.ABSENT,
      attendanceMessageKey: MESSAGE_KEYS.ATTENDANCE.ABSENT,

      otResult: 'MISMATCH',
      otResultLabelKey: MESSAGE_KEYS.VERIFICATION.MISMATCH,
      otResultReason: 'No attendance record found for approved employee',
      otResultReasonKey: MESSAGE_KEYS.ATTENDANCE.ABSENT,
      messageKey: MESSAGE_KEYS.ATTENDANCE.ABSENT,
    }

    absentFromApproved.push(missingItem)
    otMismatchEmployees.push(missingItem)
  }

  return {
    otDate: normalizedOtRequest.otDate,
    otDateDisplay: normalizedOtRequest.otDateDisplay,

    requestedMinutes: normalizedOtRequest.requestedMinutes,
    breakMinutes: normalizedOtRequest.breakMinutes,
    totalRequestPaidMinutes: normalizedOtRequest.totalRequestPaidMinutes,
    requestPaidMinutes: normalizedOtRequest.totalRequestPaidMinutes,

    expectedOtStartTime: normalizedOtRequest.requestStartTime,
    expectedOtEndTime: normalizedOtRequest.requestEndTime,

    shiftOtOptionTimingMode: normalizedOtRequest.shiftOtOptionTimingMode,
    isFixedTimeOt: normalizedOtRequest.shiftOtOptionTimingMode === 'FIXED_TIME',

    policyCode: normalizedOtRequest.otCalculationPolicySnapshot.code,
    policyName: normalizedOtRequest.otCalculationPolicySnapshot.name,

    resultLabelKeys: {
      match: MESSAGE_KEYS.VERIFICATION.MATCH,
      mismatch: MESSAGE_KEYS.VERIFICATION.MISMATCH,
      pendingReview: MESSAGE_KEYS.VERIFICATION.PENDING_REVIEW,
    },

    requestedEmployeeCount: requestedList.length,
    approvedEmployeeCount: approvedList.length,

    actualAttendedCount: attendedEmployees.length,
    absentFromApprovedCount: absentFromApproved.length,
    attendedButNotApprovedCount: attendedButNotApproved.length,
    shiftMismatchCount: shiftMismatchEmployees.length,
    pendingReviewCount: pendingReviewEmployees.length,
    notEligibleCount: notEligibleEmployees.length,

    otMatchCount: otMatchEmployees.length,
    otMismatchCount: otMismatchEmployees.length,
    otPendingReviewCount: otPendingReviewEmployees.length,

    attendedEmployees,
    absentFromApproved,
    attendedButNotApproved,
    shiftMismatchEmployees,
    pendingReviewEmployees,
    notEligibleEmployees,

    otMatchEmployees,
    otMismatchEmployees,
    otPendingReviewEmployees,
  }
}

module.exports = {
  MESSAGE_KEYS,
  deriveAttendanceResult,
  verifyAttendanceAgainstOT,
}