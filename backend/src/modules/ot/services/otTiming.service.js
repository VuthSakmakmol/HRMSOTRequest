// backend/src/modules/ot/services/otTiming.service.js
const mongoose = require('mongoose')

const Shift = require('../../shift/models/Shift')
const ShiftOTOption = require('../models/ShiftOTOption')
const OTCalculationPolicy = require('../models/OTCalculationPolicy')
const Holiday = require('../../calendar/models/Holiday')

const { getDayType } = require('../utils/dayClassifier')

const OT_DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400, extra = {}) {
  const error = new Error(message)
  error.status = status

  Object.assign(error, extra)

  return error
}

function toMinutes(hhmm) {
  const raw = s(hhmm)
  const match = raw.match(/^(\d{2}):(\d{2})$/)

  if (!match) {
    throw createHttpError(`Invalid time format: ${raw}`, 400)
  }

  const hh = Number(match[1])
  const mm = Number(match[2])

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw createHttpError(`Invalid time format: ${raw}`, 400)
  }

  return hh * 60 + mm
}

function minutesToHHmm(totalMinutes) {
  const normalized = ((Number(totalMinutes || 0) % 1440) + 1440) % 1440
  const hh = Math.floor(normalized / 60)
  const mm = normalized % 60

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function addMinutesToHHmm(hhmm, extraMinutes) {
  return minutesToHHmm(toMinutes(hhmm) + Number(extraMinutes || 0))
}

function parseYMDToUtcRange(ymd) {
  const raw = s(ymd)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    throw createHttpError(`Invalid date format: ${raw}`, 400)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))

  return { start, end }
}

async function resolveHolidayDateStrings(dateStrings = []) {
  const uniqueDates = Array.from(
    new Set(
      (Array.isArray(dateStrings) ? dateStrings : [])
        .map((date) => s(date))
        .filter(Boolean),
    ),
  )

  if (!uniqueDates.length) return []

  const orConditions = uniqueDates.map((ymd) => {
    const { start, end } = parseYMDToUtcRange(ymd)

    return {
      date: {
        $gte: start,
        $lt: end,
      },
    }
  })

  const docs = await Holiday.find({
    isActive: true,
    $or: orConditions,
  })
    .select({ date: 1 })
    .lean()

  return docs
    .map((doc) => {
      if (!(doc?.date instanceof Date) || Number.isNaN(doc.date.getTime())) {
        return ''
      }

      return doc.date.toISOString().slice(0, 10)
    })
    .filter(Boolean)
}

async function resolveOTDayType(otDate, options = {}) {
  const date = s(otDate)

  if (!date) {
    throw createHttpError('OT date is required', 400)
  }

  const holidayDates =
    Array.isArray(options.holidays) && options.holidays.length
      ? options.holidays
      : await resolveHolidayDateStrings([date])

  return getDayType(date, {
    holidays: holidayDates,
  })
}

function normalizeApplicableDayTypes(value) {
  const source = Array.isArray(value) ? value : ['WORKING_DAY']

  const normalized = Array.from(
    new Set(
      source
        .map((item) => upper(item))
        .filter((item) => OT_DAY_TYPES.includes(item)),
    ),
  )

  return normalized.length ? normalized : ['WORKING_DAY']
}

function calculateTimeWindowMinutes(startTime, endTime, breakMinutes = 0) {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)

  let rawMinutes = end - start

  if (rawMinutes <= 0) {
    rawMinutes += 1440
  }

  const safeBreakMinutes = Number(breakMinutes || 0)

  if (!Number.isInteger(safeBreakMinutes) || safeBreakMinutes < 0) {
    throw createHttpError('Break minutes must be a non-negative integer', 400)
  }

  if (safeBreakMinutes >= rawMinutes) {
    throw createHttpError(
      'Break minutes cannot be greater than or equal to OT duration',
      400,
    )
  }

  const totalMinutes = rawMinutes - safeBreakMinutes

  return {
    rawMinutes,
    breakMinutes: safeBreakMinutes,

    // Requested = OT option/request window duration
    requestedMinutes: rawMinutes,

    // Total paid = requested - break
    totalRequestPaidMinutes: totalMinutes,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
  }
}

function buildTimeWindow(startTime, endTime) {
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)

  if (end <= start) {
    end += 1440
  }

  return { start, end }
}

function overlapMinutes(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

function calculateShiftBreakOverlapMinutes(startTime, endTime, shift = {}) {
  const breakStartTime = s(shift.breakStartTime)
  const breakEndTime = s(shift.breakEndTime)

  if (!breakStartTime || !breakEndTime) return 0

  const otWindow = buildTimeWindow(startTime, endTime)
  const breakWindow = buildTimeWindow(breakStartTime, breakEndTime)

  const candidates = [
    breakWindow,
    {
      start: breakWindow.start + 1440,
      end: breakWindow.end + 1440,
    },
    {
      start: breakWindow.start - 1440,
      end: breakWindow.end - 1440,
    },
  ]

  return Math.max(...candidates.map((candidate) => overlapMinutes(otWindow, candidate)))
}

function normalizeIdArray(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((id) => s(id))
        .filter(Boolean),
    ),
  )
}

function buildEmployeeTimeOverrideMap(payload = {}, selectedEmployeeIds = []) {
  const selectedIdSet = new Set(
    normalizeIdArray(selectedEmployeeIds).map((id) => String(id)),
  )

  const map = new Map()

  for (const item of Array.isArray(payload.employeeTimeOverrides)
    ? payload.employeeTimeOverrides
    : []) {
    const employeeId = s(item?.employeeId)

    if (!employeeId || !selectedIdSet.has(employeeId)) continue

    const startTime = s(item.startTime)
    const endTime = s(item.endTime)
    const breakMinutes = Number(item.breakMinutes || 0)

    const calculated = calculateTimeWindowMinutes(startTime, endTime, breakMinutes)

    map.set(employeeId, {
      employeeId,
      otTimeMode: 'CUSTOM',
      startTime,
      endTime,
      breakMinutes: calculated.breakMinutes,
      requestedMinutes: calculated.requestedMinutes,
      totalMinutes: calculated.totalMinutes,
      totalHours: calculated.totalHours,
    })
  }

  return map
}

function buildTimedEmployeeSnapshots(employeeContexts = [], timingContext = {}, payload = {}) {
  const employeeIds = employeeContexts
    .map((item) => s(item?.snapshot?.employeeId))
    .filter(Boolean)

  const overrideMap = buildEmployeeTimeOverrideMap(payload, employeeIds)

  return employeeContexts.map((item) => {
    const snapshot = item.snapshot
    const employeeId = s(snapshot.employeeId)
    const override = overrideMap.get(employeeId)

    if (override) {
      return {
        ...snapshot,
        otTimeMode: 'CUSTOM',
        startTime: override.startTime,
        endTime: override.endTime,
        breakMinutes: override.breakMinutes,
        requestedMinutes: override.requestedMinutes,
        totalMinutes: override.totalMinutes,
        totalHours: override.totalHours,
      }
    }

    return {
      ...snapshot,
      otTimeMode: 'DEFAULT',
      startTime: timingContext.startTime,
      endTime: timingContext.endTime,
      breakMinutes: Number(timingContext.breakMinutes || 0),
      requestedMinutes: Number(timingContext.requestedMinutes || 0),
      totalMinutes: Number(timingContext.totalMinutes || 0),
      totalHours: Number(timingContext.totalHours || 0),
    }
  })
}

function assertSharedShiftForOptionBasedOT(employeeContexts = []) {
  if (!Array.isArray(employeeContexts) || !employeeContexts.length) {
    throw createHttpError('Please select at least 1 employee', 400)
  }

  const firstShift = employeeContexts[0]?.shift

  if (!firstShift?._id) {
    throw createHttpError(
      'All selected employees must have an assigned shift to use OT option',
      400,
    )
  }

  const firstShiftId = String(firstShift._id)

  for (const item of employeeContexts) {
    const shift = item?.shift

    if (!shift?._id) {
      throw createHttpError(
        'All selected employees must have an assigned shift to use OT option',
        400,
      )
    }

    if (String(shift._id) !== firstShiftId) {
      throw createHttpError(
        'All selected employees must belong to the same shift when using OT option',
        400,
      )
    }

    if (shift.isActive === false) {
      throw createHttpError('Assigned shift is inactive', 400)
    }
  }

  return firstShift
}

function assertShiftOtOptionAllowedForDayType(shiftOtOption, dayType) {
  const normalizedDayType = upper(dayType)
  const applicableDayTypes = normalizeApplicableDayTypes(
    shiftOtOption?.applicableDayTypes,
  )

  if (!applicableDayTypes.includes(normalizedDayType)) {
    const optionLabel = s(shiftOtOption?.label) || 'Selected OT option'

    throw createHttpError(
      `${optionLabel} is not allowed for ${normalizedDayType}. Please select an OT option that matches the selected OT date.`,
      400,
      {
        code: 'OT_OPTION_DAY_TYPE_MISMATCH',
        error: 'OT_OPTION_DAY_TYPE_MISMATCH',
        details: {
          selectedDayType: normalizedDayType,
          applicableDayTypes,
          shiftOtOptionId: shiftOtOption?._id ? String(shiftOtOption._id) : null,
          shiftOtOptionLabel: optionLabel,
        },
      },
    )
  }
}

async function resolveShiftOtOptionSelection(shiftOtOptionId, sharedShift, dayType) {
  if (!s(shiftOtOptionId) || !mongoose.isValidObjectId(shiftOtOptionId)) {
    throw createHttpError('Please select OT option', 400)
  }

  const shiftOtOption = await ShiftOTOption.findById(shiftOtOptionId).lean()

  if (!shiftOtOption || shiftOtOption.isActive === false) {
    throw createHttpError('Selected OT option is not found or inactive', 404)
  }

  if (String(shiftOtOption.shiftId) !== String(sharedShift._id)) {
    throw createHttpError(
      'Selected OT option does not belong to the employees assigned shift',
      400,
    )
  }

  assertShiftOtOptionAllowedForDayType(shiftOtOption, dayType)

  const calculationPolicy = await OTCalculationPolicy.findById(
    shiftOtOption.calculationPolicyId,
  ).lean()

  if (!calculationPolicy || calculationPolicy.isActive === false) {
    throw createHttpError('OT calculation policy is not found or inactive', 404)
  }

  return {
    shiftOtOption,
    calculationPolicy,
  }
}

function buildPolicySnapshot(calculationPolicy) {
  return {
    calculationPolicyId: calculationPolicy?._id || null,
    code: s(calculationPolicy?.code),
    name: s(calculationPolicy?.name),
    minEligibleMinutes: Number(calculationPolicy?.minEligibleMinutes || 0),
    roundUnitMinutes: Number(calculationPolicy?.roundUnitMinutes || 0),
    roundMethod: s(calculationPolicy?.roundMethod),
    graceAfterShiftEndMinutes: Number(calculationPolicy?.graceAfterShiftEndMinutes || 0),

    allowApprovedOtWithoutExactClockOut:
      calculationPolicy?.allowApprovedOtWithoutExactClockOut === true,

    allowPreShiftOT: calculationPolicy?.allowPreShiftOT === true,
    allowPostShiftOT: calculationPolicy?.allowPostShiftOT !== false,
    capByRequestedMinutes: calculationPolicy?.capByRequestedMinutes !== false,
    treatForgetScanInAsPending: calculationPolicy?.treatForgetScanInAsPending !== false,
    treatForgetScanOutAsPending: calculationPolicy?.treatForgetScanOutAsPending !== false,
  }
}

function buildOptionBasedTiming({ sharedShift, shiftOtOption, calculationPolicy }) {
  const optionRequestedMinutes = Number(shiftOtOption?.requestedMinutes || 0)

  if (!Number.isInteger(optionRequestedMinutes) || optionRequestedMinutes <= 0) {
    throw createHttpError(
      'Selected OT option requestedMinutes must be greater than zero',
      400,
    )
  }

  const timingMode = upper(shiftOtOption?.timingMode || 'AFTER_SHIFT_END')
  const startAfterShiftEndMinutes = Number(shiftOtOption?.startAfterShiftEndMinutes || 0)

  let requestStartTime = ''
  let requestEndTime = ''

  if (timingMode === 'FIXED_TIME') {
    requestStartTime = s(shiftOtOption?.fixedStartTime)
    requestEndTime = s(shiftOtOption?.fixedEndTime)

    if (!requestStartTime || !requestEndTime) {
      throw createHttpError(
        'Selected fixed-time OT option must have fixed start and end time',
        400,
      )
    }
  } else {
    const shiftEndTime = s(sharedShift?.endTime)

    if (!shiftEndTime) {
      throw createHttpError('Selected shift has no end time', 400)
    }

    if (!Number.isInteger(startAfterShiftEndMinutes) || startAfterShiftEndMinutes < 0) {
      throw createHttpError(
        'Selected OT option startAfterShiftEndMinutes is invalid',
        400,
      )
    }

    requestStartTime = addMinutesToHHmm(shiftEndTime, startAfterShiftEndMinutes)
    requestEndTime = addMinutesToHHmm(requestStartTime, optionRequestedMinutes)
  }

  const breakMinutes = calculateShiftBreakOverlapMinutes(
    requestStartTime,
    requestEndTime,
    sharedShift,
  )

  const calculated = calculateTimeWindowMinutes(
    requestStartTime,
    requestEndTime,
    breakMinutes,
  )

  return {
    otTimingSource: 'SHIFT_OPTION',

    startTime: requestStartTime,
    endTime: requestEndTime,
    breakMinutes: calculated.breakMinutes,
    totalMinutes: calculated.totalRequestPaidMinutes,
    totalHours: calculated.totalHours,

    shiftId: sharedShift?._id || null,
    shiftCode: s(sharedShift?.code),
    shiftName: s(sharedShift?.name),
    shiftType: s(sharedShift?.type),
    shiftStartTime: s(sharedShift?.startTime),
    shiftEndTime: s(sharedShift?.endTime),
    shiftCrossMidnight: sharedShift?.crossMidnight === true,

    shiftOtOptionId: shiftOtOption?._id || null,
    shiftOtOptionLabel: s(shiftOtOption?.label),
    shiftOtOptionTimingMode: timingMode,
    shiftOtOptionStartAfterShiftEndMinutes:
      timingMode === 'AFTER_SHIFT_END' ? startAfterShiftEndMinutes : 0,
    shiftOtOptionFixedStartTime:
      timingMode === 'FIXED_TIME' ? requestStartTime : '',
    shiftOtOptionFixedEndTime:
      timingMode === 'FIXED_TIME' ? requestEndTime : '',

    requestedMinutes: calculated.requestedMinutes,
    totalRequestPaidMinutes: calculated.totalRequestPaidMinutes,
    requestStartTime,
    requestEndTime,

    otCalculationPolicyId: calculationPolicy?._id || null,
    otCalculationPolicySnapshot: buildPolicySnapshot(calculationPolicy),
  }
}

function buildCustomFixedTiming({
  payload,
  sharedShift,
  shiftOtOption,
  calculationPolicy,
}) {
  const customStartTime = s(payload.customStartTime)
  const customEndTime = s(payload.customEndTime)
  const customBreakMinutes = Number(payload.customBreakMinutes || 0)

  if (!customStartTime || !customEndTime) {
    throw createHttpError(
      'Custom fixed OT start time and end time are required',
      400,
    )
  }

  const calculated = calculateTimeWindowMinutes(
    customStartTime,
    customEndTime,
    customBreakMinutes,
  )

  const timingMode = upper(shiftOtOption?.timingMode || 'FIXED_TIME')
  const startAfterShiftEndMinutes = Number(shiftOtOption?.startAfterShiftEndMinutes || 0)

  return {
    otTimingSource: 'CUSTOM_FIXED',

    startTime: customStartTime,
    endTime: customEndTime,
    breakMinutes: calculated.breakMinutes,
    totalMinutes: calculated.totalMinutes,
    totalHours: calculated.totalHours,

    shiftId: sharedShift?._id || null,
    shiftCode: s(sharedShift?.code),
    shiftName: s(sharedShift?.name),
    shiftType: s(sharedShift?.type),
    shiftStartTime: s(sharedShift?.startTime),
    shiftEndTime: s(sharedShift?.endTime),
    shiftCrossMidnight: sharedShift?.crossMidnight === true,

    shiftOtOptionId: shiftOtOption?._id || null,
    shiftOtOptionLabel: s(shiftOtOption?.label),
    shiftOtOptionTimingMode: timingMode,
    shiftOtOptionStartAfterShiftEndMinutes:
      timingMode === 'AFTER_SHIFT_END' ? startAfterShiftEndMinutes : 0,
    shiftOtOptionFixedStartTime: customStartTime,
    shiftOtOptionFixedEndTime: customEndTime,

    requestedMinutes: calculated.requestedMinutes,
    totalRequestPaidMinutes: calculated.totalRequestPaidMinutes,
    requestStartTime: customStartTime,
    requestEndTime: customEndTime,

    otCalculationPolicyId: calculationPolicy?._id || null,
    otCalculationPolicySnapshot: buildPolicySnapshot(calculationPolicy),
  }
}

async function buildOTTimingContext(payload, employeeContexts = [], options = {}) {
  const shiftOtOptionId = s(payload.shiftOtOptionId)

  if (!shiftOtOptionId) {
    throw createHttpError('Please select OT option', 400)
  }

  const sharedShift = assertSharedShiftForOptionBasedOT(employeeContexts)

  const dayType = upper(
    options.dayType || (await resolveOTDayType(payload.otDate, options)),
  )

  const { shiftOtOption, calculationPolicy } = await resolveShiftOtOptionSelection(
    shiftOtOptionId,
    sharedShift,
    dayType,
  )

  const otTimingSource = upper(payload.otTimingSource || 'SHIFT_OPTION')

  if (otTimingSource === 'CUSTOM_FIXED') {
    return buildCustomFixedTiming({
      payload,
      sharedShift,
      shiftOtOption,
      calculationPolicy,
    })
  }

  return buildOptionBasedTiming({
    sharedShift,
    shiftOtOption,
    calculationPolicy,
  })
}

async function getShiftOTOptionsByShift(shiftId, query = {}) {
  if (!mongoose.isValidObjectId(shiftId)) {
    throw createHttpError('Invalid shift id', 400)
  }

  const shift = await Shift.findById(shiftId).lean()

  if (!shift) {
    throw createHttpError('Shift not found', 404)
  }

  const otDate = s(query.otDate)
  const explicitDayType = upper(query.dayType)

  const dayType = OT_DAY_TYPES.includes(explicitDayType)
    ? explicitDayType
    : otDate
      ? await resolveOTDayType(otDate, query)
      : ''

  const filter = {
    shiftId,
    isActive: true,
  }

  if (dayType) {
    filter.applicableDayTypes = dayType
  }

  const options = await ShiftOTOption.find(filter)
    .populate({
      path: 'calculationPolicyId',
      select: {
        _id: 1,
        code: 1,
        name: 1,
        minEligibleMinutes: 1,
        roundUnitMinutes: 1,
        roundMethod: 1,
        graceAfterShiftEndMinutes: 1,
        allowApprovedOtWithoutExactClockOut: 1,
        allowPreShiftOT: 1,
        allowPostShiftOT: 1,
        capByRequestedMinutes: 1,
        treatForgetScanInAsPending: 1,
        treatForgetScanOutAsPending: 1,
        isActive: 1,
      },
    })
    .sort({ sequence: 1, requestedMinutes: 1, createdAt: 1 })
    .lean()

  return {
    shift: {
      id: String(shift._id),
      code: s(shift.code),
      name: s(shift.name),
      type: s(shift.type),
      startTime: s(shift.startTime),
      breakStartTime: s(shift.breakStartTime),
      breakEndTime: s(shift.breakEndTime),
      endTime: s(shift.endTime),
      crossMidnight: shift.crossMidnight === true,
      isActive: shift.isActive !== false,
    },

    otDate: otDate || '',
    dayType,

    items: options.map((item) => {
      const requestedMinutes = Number(item.requestedMinutes || 0)
      const timingMode = upper(item.timingMode || 'AFTER_SHIFT_END')
      const startAfterShiftEndMinutes = Number(item.startAfterShiftEndMinutes || 0)
      const applicableDayTypes = normalizeApplicableDayTypes(item.applicableDayTypes)
      const dayTypeLabel = applicableDayTypes.join(', ')

      let requestStartTime = ''
      let requestEndTime = ''

      if (timingMode === 'FIXED_TIME') {
        requestStartTime = s(item.fixedStartTime)
        requestEndTime = s(item.fixedEndTime)
      } else {
        requestStartTime = addMinutesToHHmm(s(shift.endTime), startAfterShiftEndMinutes)
        requestEndTime = addMinutesToHHmm(requestStartTime, requestedMinutes)
      }

      const breakMinutes = calculateShiftBreakOverlapMinutes(
        requestStartTime,
        requestEndTime,
        shift,
      )

      const calculated = calculateTimeWindowMinutes(
        requestStartTime,
        requestEndTime,
        breakMinutes,
      )

      const policy = item.calculationPolicyId || null

      return {
        id: String(item._id),
        _id: String(item._id),

        shiftId: item.shiftId ? String(item.shiftId) : null,

        label: s(item.label),
        optionLabel: `${s(item.label)} · ${dayTypeLabel} · ${requestedMinutes} min`,

        timingMode,
        applicableDayTypes,
        dayTypeLabel,

        startAfterShiftEndMinutes,
        fixedStartTime: s(item.fixedStartTime),
        fixedEndTime: s(item.fixedEndTime),

        requestStartTime,
        requestEndTime,

        requestedMinutes: calculated.requestedMinutes,
        requestedHours: Number((calculated.requestedMinutes / 60).toFixed(2)),

        breakMinutes: calculated.breakMinutes,

        totalRequestPaidMinutes: calculated.totalRequestPaidMinutes,
        totalRequestPaidHours: calculated.totalHours,

        sequence: Number(item.sequence || 0),
        isActive: item.isActive !== false,

        calculationPolicy: policy
          ? {
              id: String(policy._id),
              code: s(policy.code),
              name: s(policy.name),
              minEligibleMinutes: Number(policy.minEligibleMinutes || 0),
              roundUnitMinutes: Number(policy.roundUnitMinutes || 0),
              roundMethod: s(policy.roundMethod),
              graceAfterShiftEndMinutes: Number(policy.graceAfterShiftEndMinutes || 0),
              allowApprovedOtWithoutExactClockOut:
                policy.allowApprovedOtWithoutExactClockOut === true,
              allowPreShiftOT: policy.allowPreShiftOT === true,
              allowPostShiftOT: policy.allowPostShiftOT !== false,
              capByRequestedMinutes: policy.capByRequestedMinutes !== false,
              treatForgetScanInAsPending:
                policy.treatForgetScanInAsPending !== false,
              treatForgetScanOutAsPending:
                policy.treatForgetScanOutAsPending !== false,
              isActive: policy.isActive !== false,
            }
          : null,
      }
    }),
  }
}

module.exports = {
  OT_DAY_TYPES,
  addMinutesToHHmm,
  calculateTimeWindowMinutes,
  normalizeApplicableDayTypes,
  resolveHolidayDateStrings,
  resolveOTDayType,
  buildTimedEmployeeSnapshots,
  buildOTTimingContext,
  getShiftOTOptionsByShift,
}
