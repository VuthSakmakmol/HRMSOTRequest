// backend/src/modules/attendance/utils/attendanceVerification.js
function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

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
  if (!Number.isFinite(num)) return fallback
  return num
}

function safeNonNegativeInt(value, fallback = 0) {
  const num = Math.round(safeNumber(value, fallback))
  return num < 0 ? fallback : num
}

function roundMinutesByPolicy(minutes, unitMinutes, roundMethod) {
  const rawMinutes = safeNonNegativeInt(minutes, 0)
  const unit = safeNonNegativeInt(unitMinutes, 0)

  if (!unit || rawMinutes <= 0) return rawMinutes

  const factor = rawMinutes / unit
  const method = upper(roundMethod)

  if (method === 'FLOOR') {
    return Math.floor(factor) * unit
  }

  if (method === 'NEAREST') {
    return Math.round(factor) * unit
  }

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

  switch (status) {
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
    hasClockIn,
    hasClockOut,
    isCrossMidnightShift: shiftWindow.isCrossMidnightShift,
    workedMinutes,
    lateMinutes,
    earlyOutMinutes,
    derivedStatus: 'UNKNOWN',
    derivedStatusReason: '',
  }

  if (!employeeMatched) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Employee is not matched to Employee master',
    }
  }

  if (!hasClockIn && !hasClockOut) {
    if (normalizedImportedStatus === 'LEAVE') {
      return {
        ...base,
        derivedStatus: 'LEAVE',
        derivedStatusReason: resolveDerivedStatusReason('LEAVE'),
      }
    }

    if (normalizedImportedStatus === 'OFF') {
      return {
        ...base,
        derivedStatus: 'OFF',
        derivedStatusReason: resolveDerivedStatusReason('OFF'),
      }
    }

    return {
      ...base,
      derivedStatus: 'ABSENT',
      derivedStatusReason: resolveDerivedStatusReason('ABSENT'),
    }
  }

  if (hasClockIn && !hasClockOut) {
    return {
      ...base,
      derivedStatus: 'FORGET_SCAN_OUT',
      derivedStatusReason: resolveDerivedStatusReason('FORGET_SCAN_OUT'),
    }
  }

  if (!hasClockIn && hasClockOut) {
    return {
      ...base,
      derivedStatus: 'FORGET_SCAN_IN',
      derivedStatusReason: resolveDerivedStatusReason('FORGET_SCAN_IN'),
    }
  }

  if (clockInMinutes == null || rawClockOutMinutes == null) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Clock in/out format is invalid',
    }
  }

  if (!shiftWindow.isValid) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Assigned shift time is missing or invalid',
    }
  }

  if (shiftMatched === false || shiftTimeMatched === false) {
    return {
      ...base,
      derivedStatus: 'SHIFT_MISMATCH',
      derivedStatusReason: resolveDerivedStatusReason('SHIFT_MISMATCH'),
    }
  }

  if (lateMinutes > Number(lateGraceMinutes || 0)) {
    return {
      ...base,
      derivedStatus: 'LATE',
      derivedStatusReason: resolveDerivedStatusReason('LATE'),
    }
  }

  return {
    ...base,
    derivedStatus: 'PRESENT',
    derivedStatusReason: resolveDerivedStatusReason('PRESENT'),
  }
}

function mapEmployeeSnapshot(item) {
  return {
    employeeId: item?.employeeId ? String(item.employeeId) : null,
    employeeCode: upper(item?.employeeCode),
    employeeName: s(item?.employeeName),
    departmentId: item?.departmentId ? String(item.departmentId) : null,
    departmentCode: s(item?.departmentCode),
    departmentName: s(item?.departmentName),
    positionId: item?.positionId ? String(item.positionId) : null,
    positionCode: s(item?.positionCode),
    positionName: s(item?.positionName),
  }
}

function mapAttendanceRecord(item) {
  return {
    id: item?._id ? String(item._id) : null,
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

    departmentId: item?.departmentId ? String(item?.departmentId) : null,
    departmentCode: upper(item?.departmentCode),
    departmentName: s(item?.departmentName),

    positionId: item?.positionId ? String(item?.positionId) : null,
    positionCode: upper(item?.positionCode),
    positionName: s(item?.positionName),

    shiftId: item?.shiftId ? String(item?.shiftId) : null,
    shiftCode: upper(item?.shiftCode),
    shiftName: s(item?.shiftName),
    shiftType: upper(item?.shiftType),
    shiftStartTime: s(item?.shiftStartTime),
    shiftEndTime: s(item?.shiftEndTime),

    attendanceDate: s(item?.attendanceDate),
    clockIn: s(item?.clockIn),
    clockOut: s(item?.clockOut),
    status: upper(item?.status),
    derivedStatusReason: s(item?.derivedStatusReason),
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
    updatedAt: item?.updatedAt || null,
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
  const normalized = upper(status)
  return ['PRESENT', 'LATE'].includes(normalized)
}

function isAttendanceBlockedForApprovedOt(status) {
  const normalized = upper(status)

  return [
    'ABSENT',
    'LEAVE',
    'OFF',
    'SHIFT_MISMATCH',
    'UNKNOWN',
  ].includes(normalized)
}

function buildRequestedIndex(requestedEmployees = []) {
  const byEmployeeId = new Map()
  const byEmployeeCode = new Map()

  for (const item of requestedEmployees.map(mapEmployeeSnapshot)) {
    const keyById = s(item.employeeId)
    const keyByCode = upper(item.employeeCode)

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

  const employeeCode = upper(record?.employeeNo)
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
    requestStartTime:
      requestStartTime || (requestStartMinutes != null ? minutesToHHmm(requestStartMinutes) : ''),
    requestEndTime:
      requestEndTime || (requestEndMinutes != null ? minutesToHHmm(requestEndMinutes) : ''),
    requestStartMinutes,
    requestEndMinutes,

    totalMinutes: safeNonNegativeInt(otRequest?.totalMinutes, requestedMinutes),
    totalHours: safeNumber(otRequest?.totalHours, 0),

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
  return {
    ...base,
    actualOtMinutes: Number(overrides.actualOtMinutes || 0),
    eligibleOtMinutes: Number(overrides.eligibleOtMinutes || 0),
    roundedOtMinutes: Number(overrides.roundedOtMinutes || 0),
    rawOtDecision: upper(overrides.rawOtDecision || 'MISMATCH'),
    otResult: 'MISMATCH',
    otResultReason: s(reason),
  }
}

function buildApprovedOtWithoutExactOutResponse(base, normalizedOtRequest, attendanceStatus) {
  const requestedMinutes = Number(normalizedOtRequest.requestedMinutes || 0)
  const timingMode = upper(normalizedOtRequest.shiftOtOptionTimingMode)

  const isFixedTime = timingMode === 'FIXED_TIME'

  return {
    ...base,
    actualOtMinutes: requestedMinutes,
    eligibleOtMinutes: requestedMinutes,
    roundedOtMinutes: requestedMinutes,
    rawOtDecision: isFixedTime
      ? 'FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT'
      : 'APPROVED_WITHOUT_EXACT_CLOCK_OUT',
    otResult: 'MATCH',
    otResultReason: isFixedTime
      ? attendanceStatus === 'LATE'
        ? 'Fixed OT credited by policy. Employee was late but attended normal shift. Exact OT end scan is not required.'
        : 'Fixed OT credited by policy. Employee attended normal shift. Exact OT end scan is not required.'
      : attendanceStatus === 'LATE'
        ? 'Approved OT credited by policy. Employee was late but attended normal shift. Exact OT end scan is not required.'
        : 'Approved OT credited by policy. Employee attended normal shift. Exact OT end scan is not required.',
  }
}

function calculatePolicyDrivenOtMetrics({ otRequest, attendanceRecord }) {
  const normalizedOtRequest = normalizeOtRequestContext(otRequest)
  const attendanceStatus = upper(attendanceRecord?.status)
  const policy = normalizedOtRequest.otCalculationPolicySnapshot || {}

  const base = {
    requestedMinutes: normalizedOtRequest.requestedMinutes,
    requestedOtMinutes: normalizedOtRequest.requestedMinutes,
    approvedMinutes: normalizedOtRequest.requestedMinutes,

    expectedOtStartTime: s(normalizedOtRequest.requestStartTime),
    expectedOtEndTime: s(normalizedOtRequest.requestEndTime),

    actualOtMinutes: 0,
    eligibleOtMinutes: 0,
    roundedOtMinutes: 0,

    rawOtDecision: 'MISMATCH',
    otResult: 'MISMATCH',
    otResultReason: '',

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

  console.log('[OT_VERIFY_POLICY_DEBUG]', {
    requestNo: normalizedOtRequest.requestNo,
    dayType: normalizedOtRequest.dayType,
    timingMode: normalizedOtRequest.shiftOtOptionTimingMode,
    policyCode: policy.code,
    allowNoExactOut: policy.allowApprovedOtWithoutExactClockOut,
    attendanceStatus,
    requestedMinutes: normalizedOtRequest.requestedMinutes,
    expectedStart: normalizedOtRequest.requestStartTime,
    expectedEnd: normalizedOtRequest.requestEndTime,
  })

  if (normalizedOtRequest.requestedMinutes <= 0) {
    return buildMismatchResponse(base, 'No OT minutes found on approved OT request', {
      rawOtDecision: 'NO_OT_REQUEST',
    })
  }

  /*
    Company rule:
    Working-day OT can be credited without exact OT end clock-out
    only when the policy allows it.

    This supports both:
    - AFTER_SHIFT_END OT
    - FIXED_TIME OT, for example 18:00 - 20:00

    Sunday/Holiday remains strict scan verification below.
  */
  if (
    upper(normalizedOtRequest.dayType) === 'WORKING_DAY' &&
    policy.allowApprovedOtWithoutExactClockOut === true
  ) {
    if (
      attendanceStatus === 'FORGET_SCAN_IN' &&
      policy.treatForgetScanInAsPending
    ) {
      return buildMismatchResponse(base, 'Forget scan in is pending review by OT policy', {
        rawOtDecision: 'PENDING_REVIEW',
      })
    }

    if (
      attendanceStatus === 'FORGET_SCAN_OUT' &&
      policy.treatForgetScanOutAsPending
    ) {
      return buildMismatchResponse(base, 'Forget scan out is pending review by OT policy', {
        rawOtDecision: 'PENDING_REVIEW',
      })
    }

    if (isNormalAttendancePresentForApprovedOt(attendanceStatus)) {
      return buildApprovedOtWithoutExactOutResponse(
        base,
        normalizedOtRequest,
        attendanceStatus,
      )
    }

    if (isAttendanceBlockedForApprovedOt(attendanceStatus)) {
      return buildMismatchResponse(
        base,
        `Approved OT not credited because attendance status is ${attendanceStatus || 'UNKNOWN'}`,
        {
          rawOtDecision: 'ATTENDANCE_NOT_PRESENT',
        },
      )
    }

    return buildMismatchResponse(
      base,
      `Approved OT requires manual review because attendance status is ${attendanceStatus || 'UNKNOWN'}`,
      {
        rawOtDecision: 'PENDING_REVIEW',
      },
    )
  }

  /*
    Strict scan logic:
    - Sunday/Holiday OT
    - Working-day OT when policy does not allow no-exact-clock-out
  */
  if (
    attendanceStatus === 'FORGET_SCAN_IN' &&
    policy.treatForgetScanInAsPending
  ) {
    return buildMismatchResponse(base, 'Forget scan in is pending review by OT policy', {
      rawOtDecision: 'PENDING_REVIEW',
    })
  }

  if (
    attendanceStatus === 'FORGET_SCAN_OUT' &&
    policy.treatForgetScanOutAsPending
  ) {
    return buildMismatchResponse(base, 'Forget scan out is pending review by OT policy', {
      rawOtDecision: 'PENDING_REVIEW',
    })
  }

  if (
    normalizedOtRequest.requestStartMinutes == null ||
    normalizedOtRequest.requestEndMinutes == null
  ) {
    return buildMismatchResponse(base, 'OT request time window is missing or invalid', {
      rawOtDecision: 'NO_REQUEST_WINDOW',
    })
  }

  const attendanceWindow = buildAttendanceWindow(
    attendanceRecord,
    normalizedOtRequest.requestStartMinutes,
  )

  if (!attendanceWindow.isValid) {
    return buildMismatchResponse(base, 'Clock in/out window is missing or invalid', {
      rawOtDecision: 'NO_ATTENDANCE_WINDOW',
    })
  }

  const actualOtMinutesWithinRequest = overlapMinutes(
    normalizedOtRequest.requestStartMinutes,
    normalizedOtRequest.requestEndMinutes,
    attendanceWindow.clockInMinutes,
    attendanceWindow.clockOutMinutes,
  )

  if (['SUNDAY', 'HOLIDAY'].includes(upper(normalizedOtRequest.dayType))) {
    const eligibleOtMinutes = actualOtMinutesWithinRequest

    if (eligibleOtMinutes <= 0) {
      return buildMismatchResponse(base, 'No attendance time overlaps approved Sunday/Holiday OT window', {
        rawOtDecision: 'NOT_ELIGIBLE',
        actualOtMinutes: actualOtMinutesWithinRequest,
        eligibleOtMinutes: 0,
        roundedOtMinutes: 0,
      })
    }

    if (eligibleOtMinutes < safeNonNegativeInt(policy.minEligibleMinutes, 0)) {
      return buildMismatchResponse(base, 'Eligible Sunday/Holiday OT is below minimum OT policy threshold', {
        rawOtDecision: 'BELOW_MIN',
        actualOtMinutes: actualOtMinutesWithinRequest,
        eligibleOtMinutes,
        roundedOtMinutes: 0,
      })
    }

    let roundedOtMinutes = roundMinutesByPolicy(
      eligibleOtMinutes,
      policy.roundUnitMinutes,
      policy.roundMethod,
    )

    if (policy.capByRequestedMinutes && normalizedOtRequest.requestedMinutes > 0) {
      roundedOtMinutes = Math.min(roundedOtMinutes, normalizedOtRequest.requestedMinutes)
    }

    if (roundedOtMinutes === normalizedOtRequest.requestedMinutes) {
      return {
        ...base,
        actualOtMinutes: actualOtMinutesWithinRequest,
        eligibleOtMinutes,
        roundedOtMinutes,
        rawOtDecision: 'MATCH',
        otResult: 'MATCH',
        otResultReason: 'Sunday/Holiday actual attendance matches approved OT request by policy',
      }
    }

    if (roundedOtMinutes < normalizedOtRequest.requestedMinutes) {
      return buildMismatchResponse(base, 'Sunday/Holiday actual OT is shorter than approved OT request', {
        rawOtDecision: 'SHORT',
        actualOtMinutes: actualOtMinutesWithinRequest,
        eligibleOtMinutes,
        roundedOtMinutes,
      })
    }

    return buildMismatchResponse(base, 'Sunday/Holiday actual OT does not match approved OT request', {
      rawOtDecision: 'EXCEED',
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes,
    })
  }

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
    })
  }

  if (eligibleOtMinutes < safeNonNegativeInt(policy.minEligibleMinutes, 0)) {
    return buildMismatchResponse(base, 'Eligible OT is below minimum OT policy threshold', {
      rawOtDecision: 'BELOW_MIN',
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes: 0,
    })
  }

  let roundedOtMinutes = roundMinutesByPolicy(
    eligibleOtMinutes,
    policy.roundUnitMinutes,
    policy.roundMethod,
  )

  if (policy.capByRequestedMinutes && normalizedOtRequest.requestedMinutes > 0) {
    roundedOtMinutes = Math.min(roundedOtMinutes, normalizedOtRequest.requestedMinutes)
  }

  if (roundedOtMinutes === normalizedOtRequest.requestedMinutes) {
    return {
      ...base,
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes,
      rawOtDecision: 'MATCH',
      otResult: 'MATCH',
      otResultReason: 'Actual eligible OT matches approved OT request by policy',
    }
  }

  if (roundedOtMinutes < normalizedOtRequest.requestedMinutes) {
    return buildMismatchResponse(base, 'Actual eligible OT is shorter than approved OT request', {
      rawOtDecision: 'SHORT',
      actualOtMinutes: actualOtMinutesWithinRequest,
      eligibleOtMinutes,
      roundedOtMinutes,
    })
  }

  return buildMismatchResponse(base, 'Actual eligible OT does not match approved OT request', {
    rawOtDecision: 'EXCEED',
    actualOtMinutes: actualOtMinutesWithinRequest,
    eligibleOtMinutes,
    roundedOtMinutes,
  })
}

function buildVerificationItem(requested, attendanceRecord, otRequest) {
  const normalizedOtRequest = normalizeOtRequestContext(otRequest)
  const metrics = calculatePolicyDrivenOtMetrics({
    otRequest: normalizedOtRequest,
    attendanceRecord,
  })

  return {
    ...requested,
    attendanceRecordId: attendanceRecord.id,
    importId: attendanceRecord.importId,

    clockIn: attendanceRecord.clockIn,
    clockOut: attendanceRecord.clockOut,
    attendanceStatus: attendanceRecord.status,
    importedStatus: attendanceRecord.importedStatus,
    derivedStatusReason: attendanceRecord.derivedStatusReason,
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
    approvedMinutes: metrics.approvedMinutes,

    expectedOtStartTime: metrics.expectedOtStartTime,
    expectedOtEndTime: metrics.expectedOtEndTime,

    actualOtMinutes: metrics.actualOtMinutes,
    eligibleOtMinutes: metrics.eligibleOtMinutes,
    roundedOtMinutes: metrics.roundedOtMinutes,

    rawOtDecision: metrics.rawOtDecision,
    otResult: metrics.otResult,
    otResultReason: metrics.otResultReason,

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

  for (const requested of requestedList) {
    const requestedKey = s(requested.employeeId) || upper(requested.employeeCode)
    const attendanceRecord = requestedAttendanceMap.get(requestedKey)

    if (!attendanceRecord) {
      continue
    }

    const item = buildVerificationItem(requested, attendanceRecord, normalizedOtRequest)

    if (!isShiftValidRecord(attendanceRecord)) {
      shiftMismatchEmployees.push(item)
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
    pendingReviewEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const shiftMismatchKeySet = new Set(
    shiftMismatchEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const notEligibleKeySet = new Set(
    notEligibleEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
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

    absentFromApproved.push(approved)
  }

  return {
    requestedMinutes: normalizedOtRequest.requestedMinutes,
    expectedOtStartTime: normalizedOtRequest.requestStartTime,
    expectedOtEndTime: normalizedOtRequest.requestEndTime,
    shiftOtOptionTimingMode: normalizedOtRequest.shiftOtOptionTimingMode,
    isFixedTimeOt: normalizedOtRequest.shiftOtOptionTimingMode === 'FIXED_TIME',
    policyCode: normalizedOtRequest.otCalculationPolicySnapshot.code,
    policyName: normalizedOtRequest.otCalculationPolicySnapshot.name,

    requestedEmployeeCount: requestedList.length,
    approvedEmployeeCount: approvedList.length,
    actualAttendedCount: attendedEmployees.length,
    absentFromApprovedCount: absentFromApproved.length,
    attendedButNotApprovedCount: attendedButNotApproved.length,
    shiftMismatchCount: shiftMismatchEmployees.length,
    pendingReviewCount: pendingReviewEmployees.length,
    notEligibleCount: notEligibleEmployees.length,

    attendedEmployees,
    absentFromApproved,
    attendedButNotApproved,
    shiftMismatchEmployees,
    pendingReviewEmployees,
    notEligibleEmployees,
  }
}

module.exports = {
  deriveAttendanceResult,
  verifyAttendanceAgainstOT,
}