// backend/src/modules/attendance/services/otAttendancePolicy.service.js
// One backend source of truth for evaluating attendance against saved/configured OT policy windows.

const {
  calculatePolicyDrivenOtMetrics,
} = require('../utils/attendanceVerification')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function asId(value) {
  return value ? String(value?._id || value?.id || value) : ''
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function positiveNumber(...values) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  }

  return 0
}

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s(value))
}

function timeToMinutes(value) {
  if (!isHHmm(value)) return null

  const [hours, minutes] = s(value).split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToHHmm(value) {
  const normalized = ((Math.round(number(value)) % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addMinutesToHHmm(value, minutesToAdd) {
  const startMinutes = timeToMinutes(value)
  if (startMinutes == null) return ''

  return minutesToHHmm(startMinutes + Math.round(number(minutesToAdd)))
}

function roundMinutesByPolicy(minutes, unitMinutes, roundMethod) {
  const rawMinutes = Math.max(0, Math.round(number(minutes)))
  const unit = Math.max(1, Math.round(number(unitMinutes, 30)))
  const factor = rawMinutes / unit
  const method = upper(roundMethod || 'CEIL')

  if (method === 'FLOOR') return Math.floor(factor) * unit
  if (method === 'NEAREST') return Math.round(factor) * unit

  return Math.ceil(factor) * unit
}

function formatHoursLabel(minutes) {
  const normalized = Math.max(0, Math.round(number(minutes)))
  const hours = Math.floor(normalized / 60)
  const rest = normalized % 60

  if (!rest) return `${hours}h`
  if (!hours) return `${rest}m`

  return `${hours}h ${rest}m`
}

function normalizeMinuteNear(rawMinute, anchorMinute) {
  if (rawMinute == null || anchorMinute == null) return rawMinute

  const candidates = [rawMinute - 1440, rawMinute, rawMinute + 1440]
  return candidates.reduce((best, candidate) => {
    return Math.abs(candidate - anchorMinute) < Math.abs(best - anchorMinute)
      ? candidate
      : best
  }, candidates[0])
}

function rawPotentialOtMinutes(attendance = {}, shift = {}, dayType = '') {
  const resolvedDayType = upper(dayType || attendance.dayType || 'WORKING_DAY')
  const clockIn = timeToMinutes(attendance.clockIn)
  const clockOutRaw = timeToMinutes(attendance.clockOut)

  if (clockOutRaw == null) return 0

  if (['SUNDAY', 'HOLIDAY'].includes(resolvedDayType)) {
    if (clockIn == null) return 0

    let clockOut = normalizeMinuteNear(clockOutRaw, clockIn)
    if (clockOut < clockIn) clockOut += 1440

    return Math.max(0, clockOut - clockIn)
  }

  // The configured shift is the policy source of truth. Attendance snapshots
  // may be old or imported from another system, so use them only as fallback.
  const shiftStart = timeToMinutes(
    shift.startTime || attendance.shiftStartTime,
  )
  const shiftEndRaw = timeToMinutes(
    shift.endTime || attendance.shiftEndTime,
  )

  if (shiftEndRaw == null) return 0

  const crossMidnight =
    attendance.isCrossMidnightShift === true ||
    shift.crossMidnight === true ||
    (shiftStart != null && shiftEndRaw <= shiftStart)

  const shiftEnd = crossMidnight ? shiftEndRaw + 1440 : shiftEndRaw
  let clockOut = normalizeMinuteNear(clockOutRaw, shiftEnd)

  if (crossMidnight && clockOut < shiftEnd - 720) {
    clockOut += 1440
  }

  return Math.max(0, clockOut - shiftEnd)
}

function optionPaidMinutes(option = {}) {
  return positiveNumber(
    option.totalRequestPaidMinutes,
    option.totalMinutes,
    option.paidMinutes,
    option.requestedMinutes,
  )
}

function buildConfiguredRequest(option = {}, lookup = {}, dayType = '') {
  const shift = lookup.shift || {}
  const policy = option.calculationPolicy || {}
  const paidMinutes = optionPaidMinutes(option)

  return {
    otDate: s(lookup.otDate),
    dayType: upper(dayType || lookup.dayType || 'WORKING_DAY'),

    shiftId: asId(shift.id || shift._id),
    shiftCode: upper(shift.code),
    shiftName: s(shift.name),
    shiftType: upper(shift.type),
    shiftStartTime: s(shift.startTime),
    shiftEndTime: s(shift.endTime),
    shiftCrossMidnight: shift.crossMidnight === true,

    otTimingSource: 'SHIFT_OPTION',
    shiftOtOptionId: asId(option.id || option._id),
    shiftOtOptionLabel: s(option.label || option.optionLabel),
    shiftOtOptionTimingMode: upper(option.timingMode || 'AFTER_SHIFT_END'),
    shiftOtOptionStartAfterShiftEndMinutes: Math.max(
      0,
      Math.round(number(option.startAfterShiftEndMinutes)),
    ),
    shiftOtOptionFixedStartTime: s(option.fixedStartTime),
    shiftOtOptionFixedEndTime: s(option.fixedEndTime),

    requestStartTime: s(option.requestStartTime || option.startTime),
    requestEndTime: s(option.requestEndTime || option.endTime),
    startTime: s(option.requestStartTime || option.startTime),
    endTime: s(option.requestEndTime || option.endTime),

    requestedMinutes: positiveNumber(option.requestedMinutes, paidMinutes),
    breakMinutes: Math.max(0, Math.round(number(option.breakMinutes))),
    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    totalHours: Number((paidMinutes / 60).toFixed(2)),

    otCalculationPolicyId: asId(policy.id || policy._id),
    otCalculationPolicySnapshot: {
      calculationPolicyId: asId(policy.id || policy._id),
      code: upper(policy.code),
      name: s(policy.name),
      minEligibleMinutes: Math.max(0, Math.round(number(policy.minEligibleMinutes))),
      roundUnitMinutes: Math.max(1, Math.round(number(policy.roundUnitMinutes, 30))),
      roundMethod: upper(policy.roundMethod || 'CEIL'),
      graceAfterShiftEndMinutes: Math.max(
        0,
        Math.round(number(policy.graceAfterShiftEndMinutes)),
      ),
      // Request generation must use the real scan window. This approved-OT
      // payment exception is intentionally disabled while choosing a new option.
      allowApprovedOtWithoutExactClockOut: false,
      allowPreShiftOT: policy.allowPreShiftOT === true,
      allowPostShiftOT: policy.allowPostShiftOT !== false,
      capByRequestedMinutes: policy.capByRequestedMinutes !== false,
      treatForgetScanInAsPending: policy.treatForgetScanInAsPending !== false,
      treatForgetScanOutAsPending: policy.treatForgetScanOutAsPending !== false,
    },
  }
}


function policyGroupKey(item = {}) {
  const request = item.configuredRequest || {}
  const policy = request.otCalculationPolicySnapshot || {}

  return [
    asId(policy.calculationPolicyId || request.otCalculationPolicyId),
    upper(request.shiftOtOptionTimingMode),
    s(request.requestStartTime),
    upper(request.dayType),
  ].join('|')
}

function buildWorkingDayRoundedCandidate(items = [], attendance = {}) {
  const validItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (!validItems.length) return null

  const first = validItems[0]
  const configuredRequest = first.configuredRequest || {}
  const policy = configuredRequest.otCalculationPolicySnapshot || {}
  const requestStart = timeToMinutes(configuredRequest.requestStartTime)
  const clockOutRaw = timeToMinutes(attendance.clockOut)

  if (requestStart == null || clockOutRaw == null || policy.allowPostShiftOT === false) {
    return null
  }

  const shiftEndRaw = timeToMinutes(configuredRequest.shiftEndTime)
  const normalizedShiftEnd = shiftEndRaw == null
    ? requestStart
    : normalizeMinuteNear(shiftEndRaw, requestStart)

  const policyStart = Math.max(
    requestStart,
    normalizedShiftEnd + Math.max(0, Math.round(number(policy.graceAfterShiftEndMinutes))),
  )

  const clockOut = normalizeMinuteNear(clockOutRaw, policyStart)
  const eligibleOtMinutes = Math.max(0, clockOut - policyStart)
  const minimumMinutes = Math.max(0, Math.round(number(policy.minEligibleMinutes)))

  if (eligibleOtMinutes <= 0 || eligibleOtMinutes < minimumMinutes) {
    return null
  }

  const maximumConfiguredMinutes = validItems.reduce(
    (maximum, item) => Math.max(maximum, optionPaidMinutes(item.option)),
    0,
  )

  let roundedOtMinutes = roundMinutesByPolicy(
    eligibleOtMinutes,
    policy.roundUnitMinutes,
    policy.roundMethod,
  )

  if (maximumConfiguredMinutes > 0) {
    roundedOtMinutes = Math.min(roundedOtMinutes, maximumConfiguredMinutes)
  }

  if (roundedOtMinutes <= 0) return null

  const orderedByPaidMinutes = validItems
    .slice()
    .sort((left, right) => {
      const paidDifference = optionPaidMinutes(left.option) - optionPaidMinutes(right.option)
      if (paidDifference !== 0) return paidDifference

      return number(left.option.sequence) - number(right.option.sequence)
    })

  const exactOption = orderedByPaidMinutes.find(
    (item) => optionPaidMinutes(item.option) === roundedOtMinutes,
  )

  const carrierOption = exactOption || orderedByPaidMinutes.find(
    (item) => optionPaidMinutes(item.option) >= roundedOtMinutes,
  ) || orderedByPaidMinutes[orderedByPaidMinutes.length - 1]

  if (!carrierOption) return null

  const breakMinutes = Math.max(
    0,
    Math.round(number(carrierOption.configuredRequest?.breakMinutes)),
  )

  const requestStartTime = minutesToHHmm(policyStart)
  const requestEndTime = addMinutesToHHmm(
    requestStartTime,
    roundedOtMinutes + breakMinutes,
  )

  return {
    carrierOption,
    exactOption: Boolean(exactOption),
    eligibleOtMinutes,
    roundedOtMinutes,
    generatedOtMinutes: roundedOtMinutes,
    requestStartTime,
    requestEndTime,
    breakMinutes,
    policy,
  }
}

function normalizeAttendanceForPolicy(attendance = {}, configuredRequest = {}) {
  const dayType = upper(configuredRequest.dayType || attendance.dayType || 'WORKING_DAY')

  // Working-day post-shift verification only needs a valid clock-out to measure
  // the configured OT window. Use the shift start as a calculation anchor when
  // scan-in is missing; the original attendance record remains unchanged.
  const fallbackClockIn = dayType === 'WORKING_DAY'
    ? s(attendance.shiftStartTime || configuredRequest.shiftStartTime)
    : ''

  return {
    ...attendance,
    clockIn: s(attendance.clockIn) || fallbackClockIn,
    clockOut: s(attendance.clockOut),
    status: upper(attendance.status || 'PRESENT'),
    shiftStartTime: s(
      attendance.shiftStartTime || configuredRequest.shiftStartTime,
    ),
    shiftEndTime: s(
      attendance.shiftEndTime || configuredRequest.shiftEndTime,
    ),
    isCrossMidnightShift:
      attendance.isCrossMidnightShift === true ||
      configuredRequest.shiftCrossMidnight === true,
  }
}

function evaluateAttendanceAgainstConfiguredOptions({
  attendance = {},
  lookup = {},
  dayType = '',
} = {}) {
  const rows = Array.isArray(lookup.items) ? lookup.items : []
  const resolvedDayType = upper(dayType || lookup.dayType || attendance.dayType || 'WORKING_DAY')
  const rawMinutes = rawPotentialOtMinutes(attendance, lookup.shift || {}, resolvedDayType)

  const evaluatedOptions = rows
    .map((option) => {
      const configuredRequest = buildConfiguredRequest(option, lookup, resolvedDayType)
      const paidMinutes = optionPaidMinutes(option)

      if (
        !paidMinutes ||
        !isHHmm(configuredRequest.requestStartTime) ||
        !isHHmm(configuredRequest.requestEndTime)
      ) {
        return null
      }

      const metrics = calculatePolicyDrivenOtMetrics({
        otRequest: configuredRequest,
        attendanceRecord: normalizeAttendanceForPolicy(attendance, configuredRequest),
      })

      return {
        option,
        configuredRequest,
        metrics,
        paidMinutes,
        isMatch: upper(metrics.otResult) === 'MATCH',
      }
    })
    .filter(Boolean)

  const matchingOptions = evaluatedOptions
    .filter((item) => item.isMatch)
    .sort((left, right) => {
      const paidDifference = right.paidMinutes - left.paidMinutes
      if (paidDifference !== 0) return paidDifference

      return number(left.option.sequence) - number(right.option.sequence)
    })

  let roundedSelection = null

  if (resolvedDayType === 'WORKING_DAY') {
    const groups = new Map()

    for (const item of evaluatedOptions) {
      const key = policyGroupKey(item)
      const group = groups.get(key) || []
      group.push(item)
      groups.set(key, group)
    }

    roundedSelection = [...groups.values()]
      .map((items) => buildWorkingDayRoundedCandidate(items, attendance))
      .filter(Boolean)
      .sort((left, right) => {
        const roundedDifference = right.roundedOtMinutes - left.roundedOtMinutes
        if (roundedDifference !== 0) return roundedDifference

        return number(left.carrierOption?.option?.sequence) - number(right.carrierOption?.option?.sequence)
      })[0] || null
  }

  const legacySelected = matchingOptions[0] || null
  const selectedItem = roundedSelection?.carrierOption || legacySelected
  const bestEvaluation = selectedItem || evaluatedOptions
    .slice()
    .sort((left, right) => {
      const roundedDifference = number(right.metrics.roundedOtMinutes) - number(left.metrics.roundedOtMinutes)
      if (roundedDifference !== 0) return roundedDifference

      return left.paidMinutes - right.paidMinutes
    })[0] || null

  const generatedOtMinutes = roundedSelection
    ? roundedSelection.generatedOtMinutes
    : legacySelected?.paidMinutes || 0

  const selectedPolicy = selectedItem?.configuredRequest?.otCalculationPolicySnapshot || {}
  const selectedOptionLabel = roundedSelection && !roundedSelection.exactOption
    ? `${formatHoursLabel(generatedOtMinutes)} · ${upper(selectedPolicy.roundMethod || 'CEIL')}`
    : s(selectedItem?.option?.label || selectedItem?.option?.optionLabel)

  return {
    dayType: resolvedDayType,
    rawPotentialOtMinutes: rawMinutes,

    isEligible: generatedOtMinutes > 0,
    result: generatedOtMinutes > 0
      ? 'MATCH'
      : upper(bestEvaluation?.metrics?.otResult || 'MISMATCH'),
    reason: generatedOtMinutes > 0
      ? 'Attendance satisfies the configured OT policy and rounding method'
      : s(bestEvaluation?.metrics?.otResultReason),
    reasonKey: generatedOtMinutes > 0
      ? 'attendance.verification.policy_match'
      : s(bestEvaluation?.metrics?.otResultReasonKey),

    actualOtMinutes: roundedSelection
      ? roundedSelection.eligibleOtMinutes
      : number(bestEvaluation?.metrics?.actualOtMinutes),
    eligibleOtMinutes: roundedSelection
      ? roundedSelection.eligibleOtMinutes
      : number(bestEvaluation?.metrics?.eligibleOtMinutes),
    roundedOtMinutes: roundedSelection
      ? roundedSelection.roundedOtMinutes
      : number(bestEvaluation?.metrics?.roundedOtMinutes),

    generatedOtMinutes,
    generatedBreakMinutes: roundedSelection?.breakMinutes || 0,
    generatedFromPolicyRounding: Boolean(roundedSelection),
    requestStartTime: roundedSelection
      ? roundedSelection.requestStartTime
      : s(legacySelected?.configuredRequest?.requestStartTime),
    requestEndTime: roundedSelection
      ? roundedSelection.requestEndTime
      : s(legacySelected?.configuredRequest?.requestEndTime),

    shiftOtOptionId: asId(selectedItem?.option?.id || selectedItem?.option?._id),
    shiftOtOptionLabel: selectedOptionLabel,
    selectedOptionPaidMinutes: optionPaidMinutes(selectedItem?.option || {}),
    calculationPolicyId: asId(
      selectedItem?.option?.calculationPolicy?.id ||
      selectedItem?.option?.calculationPolicy?._id,
    ),
    calculationPolicyCode: upper(selectedItem?.option?.calculationPolicy?.code),
    calculationPolicyName: s(selectedItem?.option?.calculationPolicy?.name),
    calculationPolicyRoundMethod: upper(selectedPolicy.roundMethod),
    calculationPolicyRoundUnitMinutes: number(selectedPolicy.roundUnitMinutes),

    evaluatedOptions: evaluatedOptions.map((item) => ({
      shiftOtOptionId: asId(item.option.id || item.option._id),
      shiftOtOptionLabel: s(item.option.label || item.option.optionLabel),
      paidMinutes: item.paidMinutes,
      requestStartTime: item.configuredRequest.requestStartTime,
      requestEndTime: item.configuredRequest.requestEndTime,
      result: upper(item.metrics.otResult),
      actualOtMinutes: number(item.metrics.actualOtMinutes),
      eligibleOtMinutes: number(item.metrics.eligibleOtMinutes),
      roundedOtMinutes: number(item.metrics.roundedOtMinutes),
      reason: s(item.metrics.otResultReason),
      reasonKey: s(item.metrics.otResultReasonKey),
    })),
  }
}

function evaluateSavedRequestAttendance({
  request = {},
  employee = {},
  attendance = {},
} = {}) {
  const employeePaidMinutes = positiveNumber(
    employee.totalRequestPaidMinutes,
    employee.totalMinutes,
    employee.requestedMinutes,
    request.totalRequestPaidMinutes,
    request.totalMinutes,
    request.requestedMinutes,
  )

  const employeeRequest = {
    ...request,
    requestStartTime: s(
      employee.requestStartTime ||
      employee.startTime ||
      request.requestStartTime ||
      request.startTime,
    ),
    requestEndTime: s(
      employee.requestEndTime ||
      employee.endTime ||
      request.requestEndTime ||
      request.endTime,
    ),
    startTime: s(
      employee.requestStartTime ||
      employee.startTime ||
      request.requestStartTime ||
      request.startTime,
    ),
    endTime: s(
      employee.requestEndTime ||
      employee.endTime ||
      request.requestEndTime ||
      request.endTime,
    ),
    requestedMinutes: positiveNumber(
      employee.requestedMinutes,
      employeePaidMinutes,
    ),
    breakMinutes: Math.max(
      0,
      Math.round(number(employee.breakMinutes ?? request.breakMinutes)),
    ),
    totalRequestPaidMinutes: employeePaidMinutes,
    totalMinutes: employeePaidMinutes,
    totalHours: Number((employeePaidMinutes / 60).toFixed(2)),
  }

  const metrics = calculatePolicyDrivenOtMetrics({
    otRequest: employeeRequest,
    attendanceRecord: normalizeAttendanceForPolicy(attendance, employeeRequest),
  })

  return {
    result: upper(metrics.otResult),
    reason: s(metrics.otResultReason),
    reasonKey: s(metrics.otResultReasonKey),
    actualOtMinutes: number(metrics.actualOtMinutes),
    eligibleOtMinutes: number(metrics.eligibleOtMinutes),
    roundedOtMinutes: number(metrics.roundedOtMinutes),
    payableOtMinutes: upper(metrics.otResult) === 'MATCH'
      ? employeePaidMinutes
      : number(metrics.roundedOtMinutes),
    requestStartTime: s(metrics.expectedOtStartTime),
    requestEndTime: s(metrics.expectedOtEndTime),
    policyCode: s(metrics.policyCode),
    policyName: s(metrics.policyName),
  }
}

module.exports = {
  evaluateAttendanceAgainstConfiguredOptions,
  evaluateSavedRequestAttendance,
  rawPotentialOtMinutes,
}
