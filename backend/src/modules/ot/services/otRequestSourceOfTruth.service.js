// backend/src/modules/ot/services/otRequestSourceOfTruth.service.js

const DAY_MINUTES = 24 * 60

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

function round2(value) {
  return Math.round(n(value) * 100) / 100
}

function positiveNumber(...values) {
  for (const value of values) {
    const number = Number(value)

    if (Number.isFinite(number) && number > 0) {
      return number
    }
  }

  return 0
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

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s(value))
}

function timeToMinutes(value) {
  if (!isHHmm(value)) return 0

  const [hours, minutes] = s(value).split(':').map(Number)

  return hours * 60 + minutes
}

function minutesToHHmm(value) {
  const safeValue = ((Math.round(n(value)) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(safeValue / 60)
  const minutes = safeValue % 60

  return `${pad2(hours)}:${pad2(minutes)}`
}

function addMinutesToHHmm(startTime, minutesToAdd = 0) {
  if (!isHHmm(startTime)) return ''

  return minutesToHHmm(timeToMinutes(startTime) + Math.round(n(minutesToAdd)))
}

function calculateRawWindowMinutes(startTime, endTime) {
  if (!isHHmm(startTime) || !isHHmm(endTime)) return 0

  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  let minutes = end - start

  if (minutes <= 0) {
    minutes += DAY_MINUTES
  }

  return minutes
}

function normalizeWindow(startTime, endTime) {
  const start = timeToMinutes(startTime)
  let end = timeToMinutes(endTime)

  if (end <= start) {
    end += DAY_MINUTES
  }

  return {
    start,
    end,
  }
}

function calculateOverlapMinutes(startA, endA, startB, endB) {
  if (!isHHmm(startA) || !isHHmm(endA) || !isHHmm(startB) || !isHHmm(endB)) {
    return 0
  }

  const a = normalizeWindow(startA, endA)
  const b = normalizeWindow(startB, endB)

  const candidates = [
    b,
    {
      start: b.start + DAY_MINUTES,
      end: b.end + DAY_MINUTES,
    },
    {
      start: b.start - DAY_MINUTES,
      end: b.end - DAY_MINUTES,
    },
  ]

  let maxOverlap = 0

  for (const candidate of candidates) {
    const overlapStart = Math.max(a.start, candidate.start)
    const overlapEnd = Math.min(a.end, candidate.end)
    const overlap = Math.max(0, overlapEnd - overlapStart)

    if (overlap > maxOverlap) {
      maxOverlap = overlap
    }
  }

  return maxOverlap
}

function normalizeTimingSource(value) {
  const source = upper(value)

  if (source === 'CUSTOM_FIXED') return 'CUSTOM_FIXED'
  if (source === 'CUSTOM') return 'CUSTOM_FIXED'
  if (source === 'MANUAL') return 'CUSTOM_FIXED'

  return 'SHIFT_OPTION'
}

function normalizeTimingMode(value) {
  const mode = upper(value)

  if (mode === 'FIXED_TIME') return 'FIXED_TIME'
  if (mode === 'BEFORE_SHIFT_START') return 'BEFORE_SHIFT_START'
  if (mode === 'CUSTOM_FIXED') return 'CUSTOM_FIXED'

  return 'AFTER_SHIFT_END'
}

function normalizeShiftSnapshot(shift = {}) {
  return {
    shiftId: shift?._id || shift?.id || null,
    shiftCode: s(shift.code),
    shiftName: s(shift.name),
    shiftType: upper(shift.type),
    shiftStartTime: s(shift.startTime),
    shiftEndTime: s(shift.endTime),
    shiftBreakStartTime: s(shift.breakStartTime),
    shiftBreakEndTime: s(shift.breakEndTime),
    shiftCrossMidnight: shift.crossMidnight === true,
  }
}

function normalizeShiftOptionSnapshot(option = {}) {
  const id = option?._id || option?.id || null

  return {
    shiftOtOptionId: id,
    shiftOtOptionLabel: firstText(option.label, option.name, option.optionLabel),
    shiftOtOptionTimingMode: normalizeTimingMode(option.timingMode || option.otTimeMode),
    shiftOtOptionFixedStartTime: s(option.fixedStartTime || option.startTime),
    shiftOtOptionFixedEndTime: s(option.fixedEndTime || option.endTime),
    shiftOtOptionStartAfterShiftEndMinutes: n(option.startAfterShiftEndMinutes),
    shiftOtOptionRequestedMinutes: n(option.requestedMinutes),
    shiftOtOptionBreakMinutes: n(option.breakMinutes),
    shiftOtOptionPaidMinutes: positiveNumber(
      option.paidMinutes,
      option.totalRequestPaidMinutes,
      option.totalMinutes,
    ),
    calculationPolicyId: option.calculationPolicyId || null,
  }
}

function getShiftBreakDeduction({ startTime, endTime, shift = {}, fallbackBreakMinutes = 0 }) {
  const breakStart = firstText(shift.breakStartTime, shift.shiftBreakStartTime)
  const breakEnd = firstText(shift.breakEndTime, shift.shiftBreakEndTime)

  if (isHHmm(startTime) && isHHmm(endTime) && isHHmm(breakStart) && isHHmm(breakEnd)) {
    return calculateOverlapMinutes(startTime, endTime, breakStart, breakEnd)
  }

  return Math.max(0, Math.round(n(fallbackBreakMinutes)))
}

function buildCustomFixedTiming({ payload = {}, shift = {} } = {}) {
  const startTime = firstText(payload.customStartTime, payload.requestStartTime, payload.startTime)
  const endTime = firstText(payload.customEndTime, payload.requestEndTime, payload.endTime)
  const breakMinutes = Math.max(0, Math.round(n(payload.customBreakMinutes ?? payload.breakMinutes)))

  const rawMinutes = calculateRawWindowMinutes(startTime, endTime)
  const paidMinutes = Math.max(0, rawMinutes - breakMinutes)

  return {
    otTimingSource: 'CUSTOM_FIXED',

    requestStartTime: startTime,
    requestEndTime: endTime,
    startTime,
    endTime,

    requestedMinutes: rawMinutes,
    breakMinutes,
    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    totalHours: round2(paidMinutes / 60),

    computedBy: 'BACKEND_CUSTOM_FIXED',
    isValidTiming: isHHmm(startTime) && isHHmm(endTime) && rawMinutes > 0,

    shiftSnapshot: normalizeShiftSnapshot(shift),
  }
}

function buildShiftFixedTiming({ option = {}, shift = {} } = {}) {
  const optionSnapshot = normalizeShiftOptionSnapshot(option)

  const startTime = firstText(
    option.fixedStartTime,
    option.startTime,
    option.requestStartTime,
  )

  const endTime = firstText(
    option.fixedEndTime,
    option.endTime,
    option.requestEndTime,
  )

  const rawMinutes = calculateRawWindowMinutes(startTime, endTime)

  const breakMinutes = getShiftBreakDeduction({
    startTime,
    endTime,
    shift,
    fallbackBreakMinutes: optionSnapshot.shiftOtOptionBreakMinutes,
  })

  const paidMinutes = positiveNumber(
    optionSnapshot.shiftOtOptionPaidMinutes,
    rawMinutes > 0 ? Math.max(0, rawMinutes - breakMinutes) : 0,
    optionSnapshot.shiftOtOptionRequestedMinutes > 0
      ? Math.max(0, optionSnapshot.shiftOtOptionRequestedMinutes - breakMinutes)
      : 0,
  )

  return {
    otTimingSource: 'SHIFT_OPTION',

    requestStartTime: startTime,
    requestEndTime: endTime,
    startTime,
    endTime,

    requestedMinutes: rawMinutes || optionSnapshot.shiftOtOptionRequestedMinutes,
    breakMinutes,
    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    totalHours: round2(paidMinutes / 60),

    computedBy: 'BACKEND_SHIFT_FIXED_TIME',
    isValidTiming: isHHmm(startTime) && isHHmm(endTime) && paidMinutes > 0,

    shiftSnapshot: normalizeShiftSnapshot(shift),
    optionSnapshot,
  }
}

function buildAfterShiftEndTiming({ option = {}, shift = {} } = {}) {
  const optionSnapshot = normalizeShiftOptionSnapshot(option)

  const shiftEndTime = firstText(shift.endTime, shift.shiftEndTime)
  const startAfterShiftEndMinutes = Math.max(
    0,
    Math.round(n(optionSnapshot.shiftOtOptionStartAfterShiftEndMinutes)),
  )

  const startTime = addMinutesToHHmm(shiftEndTime, startAfterShiftEndMinutes)

  const optionPaidMinutes = positiveNumber(
    optionSnapshot.shiftOtOptionPaidMinutes,
    optionSnapshot.shiftOtOptionRequestedMinutes,
  )

  const fallbackBreakMinutes = Math.max(
    0,
    Math.round(n(optionSnapshot.shiftOtOptionBreakMinutes)),
  )

  const rawWindowMinutes = optionPaidMinutes + fallbackBreakMinutes
  const endTime = addMinutesToHHmm(startTime, rawWindowMinutes)

  const breakMinutes = getShiftBreakDeduction({
    startTime,
    endTime,
    shift,
    fallbackBreakMinutes,
  })

  const paidMinutes = Math.max(0, rawWindowMinutes - breakMinutes)

  return {
    otTimingSource: 'SHIFT_OPTION',

    requestStartTime: startTime,
    requestEndTime: endTime,
    startTime,
    endTime,

    requestedMinutes: rawWindowMinutes,
    breakMinutes,
    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    totalHours: round2(paidMinutes / 60),

    computedBy: 'BACKEND_SHIFT_AFTER_END',
    isValidTiming: isHHmm(startTime) && isHHmm(endTime) && paidMinutes > 0,

    shiftSnapshot: normalizeShiftSnapshot(shift),
    optionSnapshot,
  }
}

function buildBeforeShiftStartTiming({ option = {}, shift = {} } = {}) {
  const optionSnapshot = normalizeShiftOptionSnapshot(option)

  const shiftStartTime = firstText(shift.startTime, shift.shiftStartTime)

  const optionPaidMinutes = positiveNumber(
    optionSnapshot.shiftOtOptionPaidMinutes,
    optionSnapshot.shiftOtOptionRequestedMinutes,
  )

  const fallbackBreakMinutes = Math.max(
    0,
    Math.round(n(optionSnapshot.shiftOtOptionBreakMinutes)),
  )

  const rawWindowMinutes = optionPaidMinutes + fallbackBreakMinutes
  const startTime = addMinutesToHHmm(shiftStartTime, -rawWindowMinutes)
  const endTime = shiftStartTime

  const breakMinutes = getShiftBreakDeduction({
    startTime,
    endTime,
    shift,
    fallbackBreakMinutes,
  })

  const paidMinutes = Math.max(0, rawWindowMinutes - breakMinutes)

  return {
    otTimingSource: 'SHIFT_OPTION',

    requestStartTime: startTime,
    requestEndTime: endTime,
    startTime,
    endTime,

    requestedMinutes: rawWindowMinutes,
    breakMinutes,
    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    totalHours: round2(paidMinutes / 60),

    computedBy: 'BACKEND_SHIFT_BEFORE_START',
    isValidTiming: isHHmm(startTime) && isHHmm(endTime) && paidMinutes > 0,

    shiftSnapshot: normalizeShiftSnapshot(shift),
    optionSnapshot,
  }
}

function buildShiftOptionTiming({ option = {}, shift = {} } = {}) {
  const mode = normalizeTimingMode(option.timingMode || option.otTimeMode)

  if (mode === 'FIXED_TIME') {
    return buildShiftFixedTiming({ option, shift })
  }

  if (mode === 'BEFORE_SHIFT_START') {
    return buildBeforeShiftStartTiming({ option, shift })
  }

  return buildAfterShiftEndTiming({ option, shift })
}

function buildTrustedOTTiming({ payload = {}, shift = {}, shiftOtOption = {} } = {}) {
  const timingSource = normalizeTimingSource(payload.otTimingSource)

  if (timingSource === 'CUSTOM_FIXED') {
    return buildCustomFixedTiming({
      payload,
      shift,
    })
  }

  return buildShiftOptionTiming({
    option: shiftOtOption,
    shift,
  })
}

function buildTrustedEmployeeTiming({
  employeePayload = {},
  defaultTiming = {},
} = {}) {
  const mode = upper(employeePayload.otTimeMode || 'DEFAULT')

  if (mode === 'CUSTOM') {
    const startTime = firstText(
      employeePayload.requestStartTime,
      employeePayload.startTime,
      defaultTiming.startTime,
    )

    const endTime = firstText(
      employeePayload.requestEndTime,
      employeePayload.endTime,
      defaultTiming.endTime,
    )

    const breakMinutes = Math.max(
      0,
      Math.round(firstNumber(employeePayload.breakMinutes, defaultTiming.breakMinutes)),
    )

    const rawMinutes = calculateRawWindowMinutes(startTime, endTime)
    const paidMinutes = Math.max(0, rawMinutes - breakMinutes)

    return {
      otTimeMode: 'CUSTOM',
      startTime,
      endTime,
      breakMinutes,
      requestedMinutes: rawMinutes,
      totalRequestPaidMinutes: paidMinutes,
      totalMinutes: paidMinutes,
      totalHours: round2(paidMinutes / 60),
    }
  }

  return {
    otTimeMode: 'DEFAULT',
    startTime: s(defaultTiming.startTime),
    endTime: s(defaultTiming.endTime),
    breakMinutes: n(defaultTiming.breakMinutes),
    requestedMinutes: n(defaultTiming.requestedMinutes),
    totalRequestPaidMinutes: n(defaultTiming.totalRequestPaidMinutes),
    totalMinutes: n(defaultTiming.totalMinutes),
    totalHours: round2(n(defaultTiming.totalRequestPaidMinutes) / 60),
  }
}

function applyTimingToEmployeeSnapshot(snapshot = {}, employeeTiming = {}) {
  const paidMinutes = Math.max(
    0,
    n(employeeTiming.totalRequestPaidMinutes),
    n(employeeTiming.totalMinutes),
    n(employeeTiming.requestedMinutes),
  )

  return {
    ...snapshot,

    otTimeMode: upper(employeeTiming.otTimeMode || 'DEFAULT'),

    startTime: s(employeeTiming.startTime),
    endTime: s(employeeTiming.endTime),

    breakMinutes: n(employeeTiming.breakMinutes),
    requestedMinutes: n(employeeTiming.requestedMinutes),

    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    totalHours: round2(paidMinutes / 60),
  }
}

module.exports = {
  isHHmm,
  timeToMinutes,
  minutesToHHmm,
  addMinutesToHHmm,
  calculateRawWindowMinutes,
  calculateOverlapMinutes,

  normalizeTimingSource,
  normalizeTimingMode,
  normalizeShiftSnapshot,
  normalizeShiftOptionSnapshot,

  buildTrustedOTTiming,
  buildTrustedEmployeeTiming,
  applyTimingToEmployeeSnapshot,
}