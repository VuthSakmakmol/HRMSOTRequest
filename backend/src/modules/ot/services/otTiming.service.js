// backend/src/modules/ot/services/otTiming.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')
const Shift = require('../../shift/models/Shift')
const ShiftOTOption = require('../models/ShiftOTOption')
const OTCalculationPolicy = require('../models/OTCalculationPolicy')
const holidayService = require('../../calendar/services/holiday.service')

const OT_DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const OT_TIMING_SOURCES = ['SHIFT_OPTION', 'CUSTOM_FIXED']
const DAY_MINUTES = 24 * 60

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function id(value) {
  return value ? String(value?._id || value?.id || value) : ''
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
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

function toMinutes(hhmm) {
  const raw = s(hhmm)
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/)

  if (!match) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_TIME',
      messageKey: 'common.validation.timeInvalid',
      message: 'Invalid time',
      field: 'time',
      params: {
        value: raw,
      },
    })
  }

  return Number(match[1]) * 60 + Number(match[2])
}

function minutesToHHmm(totalMinutes) {
  const normalized =
    ((Number(totalMinutes || 0) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES

  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addMinutesToHHmm(hhmm, extraMinutes) {
  return minutesToHHmm(toMinutes(hhmm) + Number(extraMinutes || 0))
}

function normalizeApplicableDayTypes(value) {
  const source = Array.isArray(value) ? value : ['WORKING_DAY']

  const normalized = [
    ...new Set(source.map(upper).filter((item) => OT_DAY_TYPES.includes(item))),
  ]

  return normalized.length ? normalized : ['WORKING_DAY']
}

async function resolveOTDayType(otDate) {
  const date = s(otDate)

  if (!date) {
    throw appError({
      statusCode: 400,
      code: 'OT_DATE_REQUIRED',
      messageKey: 'ot.request.validation.otDateRequired',
      message: 'OT date is required',
      field: 'otDate',
    })
  }

  const result = await holidayService.resolveDayType(date)

  return {
    ...result,
    dayType: upper(result.dayType),
  }
}

function buildTimeWindow(startTime, endTime) {
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)

  if (end <= start) {
    end += DAY_MINUTES
  }

  return {
    start,
    end,
  }
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
      start: breakWindow.start + DAY_MINUTES,
      end: breakWindow.end + DAY_MINUTES,
    },
    {
      start: breakWindow.start - DAY_MINUTES,
      end: breakWindow.end - DAY_MINUTES,
    },
  ]

  return Math.max(...candidates.map((candidate) => overlapMinutes(otWindow, candidate)))
}

function calculateTimeWindowMinutes(startTime, endTime, breakMinutes = 0) {
  const window = buildTimeWindow(startTime, endTime)
  const requestedMinutes = Math.max(0, window.end - window.start)
  const safeBreakMinutes = Number(breakMinutes || 0)

  if (!Number.isInteger(safeBreakMinutes) || safeBreakMinutes < 0) {
    throw appError({
      statusCode: 400,
      code: 'BREAK_MINUTES_INVALID',
      messageKey: 'ot.request.validation.breakMinutesInvalid',
      message: 'Break minutes must be a non-negative integer',
      field: 'breakMinutes',
    })
  }

  if (safeBreakMinutes >= requestedMinutes) {
    throw appError({
      statusCode: 400,
      code: 'BREAK_MINUTES_TOO_LARGE',
      messageKey: 'ot.request.validation.breakMinutesTooLarge',
      message: 'Break minutes cannot be greater than or equal to OT duration',
      field: 'breakMinutes',
    })
  }

  const totalRequestPaidMinutes = requestedMinutes - safeBreakMinutes

  return {
    requestedMinutes,
    breakMinutes: safeBreakMinutes,
    totalRequestPaidMinutes,
    totalMinutes: totalRequestPaidMinutes,
    totalHours: Number((totalRequestPaidMinutes / 60).toFixed(2)),
  }
}

function normalizeIdArray(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

function buildEmployeeTimeOverrideMap(payload = {}, selectedEmployeeIds = []) {
  const selectedIdSet = new Set(normalizeIdArray(selectedEmployeeIds))
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
    const snapshot = item.snapshot || {}
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
    throw appError({
      statusCode: 400,
      code: 'OT_EMPLOYEE_REQUIRED',
      messageKey: 'ot.request.validation.employeeRequired',
      message: 'Please select at least 1 employee',
      field: 'employeeIds',
    })
  }

  const firstShift = employeeContexts[0]?.shift

  if (!firstShift?._id) {
    throw appError({
      statusCode: 400,
      code: 'OT_EMPLOYEE_SHIFT_REQUIRED',
      messageKey: 'ot.request.error.employeeShiftRequired',
      message: 'All selected employees must have an assigned shift',
      field: 'employeeIds',
    })
  }

  const firstShiftId = id(firstShift._id)

  for (const item of employeeContexts) {
    const shift = item?.shift

    if (!shift?._id) {
      throw appError({
        statusCode: 400,
        code: 'OT_EMPLOYEE_SHIFT_REQUIRED',
        messageKey: 'ot.request.error.employeeShiftRequired',
        message: 'All selected employees must have an assigned shift',
        field: 'employeeIds',
      })
    }

    if (id(shift._id) !== firstShiftId) {
      throw appError({
        statusCode: 400,
        code: 'OT_EMPLOYEE_SHIFT_MISMATCH',
        messageKey: 'ot.request.error.employeeShiftMismatch',
        message: 'All selected employees must belong to the same shift',
        field: 'employeeIds',
      })
    }

    if (shift.isActive === false) {
      throw appError({
        statusCode: 400,
        code: 'SHIFT_INACTIVE',
        messageKey: 'shift.error.inactive',
        message: 'Assigned shift is inactive',
        field: 'shiftId',
      })
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
    throw appError({
      statusCode: 400,
      code: 'OT_OPTION_DAY_TYPE_MISMATCH',
      messageKey: 'ot.shiftOption.error.dayTypeMismatch',
      message: 'Selected OT option is not allowed for this OT date',
      field: 'shiftOtOptionId',
      params: {
        selectedDayType: normalizedDayType,
        applicableDayTypes,
        shiftOtOptionId: id(shiftOtOption?._id) || null,
        shiftOtOptionLabel: s(shiftOtOption?.label),
      },
    })
  }
}

async function resolveShiftOtOptionSelection(shiftOtOptionId, sharedShift, dayType) {
  const optionId = s(shiftOtOptionId)

  if (!optionId || !isObjectId(optionId)) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_OT_OPTION_REQUIRED',
      messageKey: 'ot.shiftOption.validation.required',
      message: 'Please select OT option',
      field: 'shiftOtOptionId',
    })
  }

  const shiftOtOption = await ShiftOTOption.findById(optionId).lean()

  if (!shiftOtOption || shiftOtOption.isActive === false) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_OT_OPTION_NOT_FOUND',
      messageKey: 'ot.shiftOption.error.notFound',
      message: 'Selected OT option is not found or inactive',
      field: 'shiftOtOptionId',
    })
  }

  if (id(shiftOtOption.shiftId) !== id(sharedShift._id)) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_OT_OPTION_SHIFT_MISMATCH',
      messageKey: 'ot.shiftOption.error.shiftMismatch',
      message: 'Selected OT option does not belong to the employees assigned shift',
      field: 'shiftOtOptionId',
    })
  }

  assertShiftOtOptionAllowedForDayType(shiftOtOption, dayType)

  const calculationPolicy = await OTCalculationPolicy.findById(
    shiftOtOption.calculationPolicyId,
  ).lean()

  if (!calculationPolicy || calculationPolicy.isActive === false) {
    throw appError({
      statusCode: 404,
      code: 'OT_POLICY_NOT_FOUND',
      messageKey: 'ot.policy.error.notFoundOrInactive',
      message: 'OT calculation policy is not found or inactive',
      field: 'calculationPolicyId',
    })
  }

  return {
    shiftOtOption,
    calculationPolicy,
  }
}

function buildPolicySnapshot(calculationPolicy) {
  return {
    calculationPolicyId: calculationPolicy?._id || null,
    code: s(calculationPolicy?.code).toUpperCase(),
    name: s(calculationPolicy?.name),

    minEligibleMinutes: Number(calculationPolicy?.minEligibleMinutes || 0),
    roundUnitMinutes: Number(calculationPolicy?.roundUnitMinutes || 30),
    roundMethod: upper(calculationPolicy?.roundMethod || 'CEIL'),
    graceAfterShiftEndMinutes: Number(calculationPolicy?.graceAfterShiftEndMinutes || 0),

    allowApprovedOtWithoutExactClockOut:
      calculationPolicy?.allowApprovedOtWithoutExactClockOut === true,

    allowPreShiftOT: calculationPolicy?.allowPreShiftOT === true,
    allowPostShiftOT: calculationPolicy?.allowPostShiftOT !== false,
    capByRequestedMinutes: calculationPolicy?.capByRequestedMinutes !== false,
    treatForgetScanInAsPending: calculationPolicy?.treatForgetScanInAsPending !== false,
    treatForgetScanOutAsPending:
      calculationPolicy?.treatForgetScanOutAsPending !== false,
  }
}

function buildOptionBasedTiming({ sharedShift, shiftOtOption, calculationPolicy }) {
  const optionRequestedMinutes = Number(shiftOtOption?.requestedMinutes || 0)

  if (!Number.isInteger(optionRequestedMinutes) || optionRequestedMinutes <= 0) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_OT_OPTION_REQUESTED_MINUTES_INVALID',
      messageKey: 'ot.shiftOption.validation.requestedMinutesInvalid',
      message: 'Selected OT option requested minutes must be greater than zero',
      field: 'requestedMinutes',
    })
  }

  const timingMode = upper(shiftOtOption?.timingMode || 'AFTER_SHIFT_END')
  const startAfterShiftEndMinutes = Number(shiftOtOption?.startAfterShiftEndMinutes || 0)

  let requestStartTime = ''
  let requestEndTime = ''

  if (timingMode === 'FIXED_TIME') {
    requestStartTime = s(shiftOtOption?.fixedStartTime)
    requestEndTime = s(shiftOtOption?.fixedEndTime)

    if (!requestStartTime || !requestEndTime) {
      throw appError({
        statusCode: 400,
        code: 'SHIFT_OT_OPTION_FIXED_TIME_REQUIRED',
        messageKey: 'ot.shiftOption.validation.fixedTimeRequired',
        message: 'Selected fixed-time OT option must have fixed start and end time',
        field: 'shiftOtOptionId',
      })
    }
  } else {
    const shiftEndTime = s(sharedShift?.endTime)

    if (!shiftEndTime) {
      throw appError({
        statusCode: 400,
        code: 'SHIFT_END_TIME_REQUIRED',
        messageKey: 'shift.validation.endTimeRequired',
        message: 'Selected shift has no end time',
        field: 'shiftId',
      })
    }

    if (!Number.isInteger(startAfterShiftEndMinutes) || startAfterShiftEndMinutes < 0) {
      throw appError({
        statusCode: 400,
        code: 'SHIFT_OT_OPTION_START_AFTER_SHIFT_END_INVALID',
        messageKey: 'ot.shiftOption.validation.startAfterShiftEndMinutesInvalid',
        message: 'Selected OT option start-after-shift-end minutes is invalid',
        field: 'startAfterShiftEndMinutes',
      })
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
    shiftCode: s(sharedShift?.code).toUpperCase(),
    shiftName: s(sharedShift?.name),
    shiftType: upper(sharedShift?.type),
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
    throw appError({
      statusCode: 400,
      code: 'CUSTOM_FIXED_TIME_REQUIRED',
      messageKey: 'ot.request.validation.customFixedTimeRequired',
      message: 'Custom fixed OT start time and end time are required',
      field: 'customStartTime',
    })
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
    totalMinutes: calculated.totalRequestPaidMinutes,
    totalHours: calculated.totalHours,

    shiftId: sharedShift?._id || null,
    shiftCode: s(sharedShift?.code).toUpperCase(),
    shiftName: s(sharedShift?.name),
    shiftType: upper(sharedShift?.type),
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
  const timingSource = upper(payload.otTimingSource || 'SHIFT_OPTION')

  if (!OT_TIMING_SOURCES.includes(timingSource)) {
    throw appError({
      statusCode: 400,
      code: 'OT_TIMING_SOURCE_INVALID',
      messageKey: 'ot.request.validation.timingSourceInvalid',
      message: 'OT timing source is invalid',
      field: 'otTimingSource',
    })
  }

  const sharedShift = assertSharedShiftForOptionBasedOT(employeeContexts)

  const dayTypeInfo =
    options.dayTypeInfo ||
    (await resolveOTDayType(payload.otDate))

  const dayType = upper(dayTypeInfo.dayType)

  const { shiftOtOption, calculationPolicy } = await resolveShiftOtOptionSelection(
    payload.shiftOtOptionId,
    sharedShift,
    dayType,
  )

  if (timingSource === 'CUSTOM_FIXED') {
    return {
      ...buildCustomFixedTiming({
        payload,
        sharedShift,
        shiftOtOption,
        calculationPolicy,
      }),
      dayTypeInfo,
      dayType,
    }
  }

  return {
    ...buildOptionBasedTiming({
      sharedShift,
      shiftOtOption,
      calculationPolicy,
    }),
    dayTypeInfo,
    dayType,
  }
}

async function getShiftOTOptionsByShift(shiftId, query = {}) {
  const cleanShiftId = s(shiftId)

  if (!isObjectId(cleanShiftId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_SHIFT_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid shift id',
      field: 'shiftId',
    })
  }

  const shift = await Shift.findById(cleanShiftId).lean()

  if (!shift) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_NOT_FOUND',
      messageKey: 'shift.error.notFound',
      message: 'Shift not found',
      field: 'shiftId',
    })
  }

  const explicitDayType = upper(query.dayType)
  const dayTypeInfo = query.otDate
    ? await resolveOTDayType(query.otDate)
    : null

  const dayType = OT_DAY_TYPES.includes(explicitDayType)
    ? explicitDayType
    : upper(dayTypeInfo?.dayType)

  const filter = {
    shiftId: cleanShiftId,
    isActive: true,
  }

  if (dayType) {
    filter.applicableDayTypes = dayType
  }

  const options = await ShiftOTOption.find(filter)
    .populate({
      path: 'calculationPolicyId',
      select:
        'code name minEligibleMinutes roundUnitMinutes roundMethod graceAfterShiftEndMinutes allowApprovedOtWithoutExactClockOut allowPreShiftOT allowPostShiftOT capByRequestedMinutes treatForgetScanInAsPending treatForgetScanOutAsPending isActive',
    })
    .sort({ sequence: 1, requestedMinutes: 1, createdAt: 1 })
    .lean()

  return {
    shift: {
      id: id(shift._id),
      _id: id(shift._id),
      code: s(shift.code).toUpperCase(),
      name: s(shift.name),
      label: [s(shift.code).toUpperCase(), s(shift.name)].filter(Boolean).join(' - '),
      type: upper(shift.type),
      startTime: s(shift.startTime),
      breakStartTime: s(shift.breakStartTime),
      breakEndTime: s(shift.breakEndTime),
      endTime: s(shift.endTime),
      crossMidnight: shift.crossMidnight === true,
      isActive: shift.isActive !== false,
    },

    otDate: s(query.otDate),
    dayType,
    dayTypeInfo,

    items: options.map((item) => {
      const optionTiming = buildOptionBasedTiming({
        sharedShift: shift,
        shiftOtOption: item,
        calculationPolicy: item.calculationPolicyId || {},
      })

      const policy = item.calculationPolicyId || null
      const applicableDayTypes = normalizeApplicableDayTypes(item.applicableDayTypes)

      return {
        id: id(item._id),
        _id: id(item._id),

        shiftId: id(item.shiftId),

        label: s(item.label),
        optionLabel: `${s(item.label)} · ${applicableDayTypes.join(', ')} · ${
          optionTiming.requestedMinutes
        } min`,

        timingMode: upper(item.timingMode || 'AFTER_SHIFT_END'),
        applicableDayTypes,
        dayTypeLabel: applicableDayTypes.join(', '),

        startAfterShiftEndMinutes: Number(item.startAfterShiftEndMinutes || 0),
        fixedStartTime: s(item.fixedStartTime),
        fixedEndTime: s(item.fixedEndTime),

        requestStartTime: optionTiming.requestStartTime,
        requestEndTime: optionTiming.requestEndTime,

        requestedMinutes: optionTiming.requestedMinutes,
        requestedHours: Number((optionTiming.requestedMinutes / 60).toFixed(2)),

        breakMinutes: optionTiming.breakMinutes,

        totalRequestPaidMinutes: optionTiming.totalRequestPaidMinutes,
        totalRequestPaidHours: optionTiming.totalHours,

        sequence: Number(item.sequence || 0),
        isActive: item.isActive !== false,

        calculationPolicy: policy
          ? {
              id: id(policy._id),
              _id: id(policy._id),
              code: s(policy.code).toUpperCase(),
              name: s(policy.name),
              label: [s(policy.code).toUpperCase(), s(policy.name)]
                .filter(Boolean)
                .join(' - '),
              minEligibleMinutes: Number(policy.minEligibleMinutes || 0),
              roundUnitMinutes: Number(policy.roundUnitMinutes || 0),
              roundMethod: upper(policy.roundMethod),
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
  calculateShiftBreakOverlapMinutes,
  resolveOTDayType,
  buildTimedEmployeeSnapshots,
  buildOTTimingContext,
  getShiftOTOptionsByShift,
}