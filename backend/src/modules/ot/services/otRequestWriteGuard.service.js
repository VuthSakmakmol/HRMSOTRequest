// backend/src/modules/ot/services/otRequestWriteGuard.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')

const OTRequest = require('../models/OTRequest')
const ShiftOTOption = require('../models/ShiftOTOption')
const Shift = require('../../shift/models/Shift')

const {
  buildTrustedOTTiming,
  buildTrustedEmployeeTiming,
} = require('./otRequestSourceOfTruth.service')

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

function normalizeIdArray(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

function normalizeOverrideMap(employeeTimeOverrides = []) {
  const map = new Map()

  for (const item of Array.isArray(employeeTimeOverrides) ? employeeTimeOverrides : []) {
    const employeeId = s(item.employeeId)

    if (!employeeId) continue

    map.set(employeeId, {
      employeeId,
      startTime: s(item.startTime || item.requestStartTime),
      endTime: s(item.endTime || item.requestEndTime),
      breakMinutes: n(item.breakMinutes),
    })
  }

  return map
}

async function resolveShiftOption(shiftOtOptionId) {
  const optionId = s(shiftOtOptionId)

  if (!isObjectId(optionId)) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_OT_OPTION_REQUIRED',
      messageKey: 'ot.request.validation.shiftOtOptionRequired',
      message: 'Shift OT option is required',
      field: 'shiftOtOptionId',
    })
  }

  const option = await ShiftOTOption.findById(optionId).lean()

  if (!option) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_OT_OPTION_NOT_FOUND',
      messageKey: 'ot.shiftOption.error.notFound',
      message: 'Shift OT option not found',
      field: 'shiftOtOptionId',
    })
  }

  if (option.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_OT_OPTION_INACTIVE',
      messageKey: 'ot.shiftOption.error.inactive',
      message: 'Shift OT option is inactive',
      field: 'shiftOtOptionId',
    })
  }

  return option
}

async function resolveShift(shiftId) {
  const cleanShiftId = s(shiftId)

  if (!isObjectId(cleanShiftId)) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_REQUIRED',
      messageKey: 'shift.error.required',
      message: 'Shift is required',
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

  if (shift.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_INACTIVE',
      messageKey: 'shift.error.inactive',
      message: 'Shift is inactive',
      field: 'shiftId',
    })
  }

  return shift
}

function assertTrustedTiming(trustedTiming = {}) {
  if (!trustedTiming.isValidTiming) {
    throw appError({
      statusCode: 400,
      code: 'OT_TIMING_INVALID',
      messageKey: 'ot.request.validation.invalidTiming',
      message: 'OT timing is invalid',
      field: 'shiftOtOptionId',
      params: {
        computedBy: trustedTiming.computedBy,
        startTime: trustedTiming.startTime,
        endTime: trustedTiming.endTime,
        requestedMinutes: trustedTiming.requestedMinutes,
        breakMinutes: trustedTiming.breakMinutes,
        totalRequestPaidMinutes: trustedTiming.totalRequestPaidMinutes,
      },
    })
  }

  if (n(trustedTiming.totalRequestPaidMinutes) <= 0) {
    throw appError({
      statusCode: 400,
      code: 'OT_PAID_TIME_INVALID',
      messageKey: 'ot.request.validation.paidTimeInvalid',
      message: 'OT paid time must be greater than zero',
      field: 'shiftOtOptionId',
      params: {
        computedBy: trustedTiming.computedBy,
        totalRequestPaidMinutes: trustedTiming.totalRequestPaidMinutes,
      },
    })
  }
}

function buildTrustedEmployeeTimeOverrides({
  employeeIds = [],
  employeeTimeOverrides = [],
  trustedTiming = {},
} = {}) {
  const overrideMap = normalizeOverrideMap(employeeTimeOverrides)

  return normalizeIdArray(employeeIds)
    .map((employeeId) => {
      const override = overrideMap.get(employeeId)

      if (!override) return null

      const employeeTiming = buildTrustedEmployeeTiming({
        employeePayload: {
          employeeId,
          otTimeMode: 'CUSTOM',
          requestStartTime: override.startTime,
          requestEndTime: override.endTime,
          breakMinutes: override.breakMinutes,
        },
        defaultTiming: trustedTiming,
      })

      if (n(employeeTiming.totalRequestPaidMinutes) <= 0) {
        throw appError({
          statusCode: 400,
          code: 'OT_EMPLOYEE_TIMING_INVALID',
          messageKey: 'ot.request.validation.employeeTimingInvalid',
          message: 'Employee custom OT timing is invalid',
          field: 'employeeTimeOverrides',
          params: {
            employeeId,
            startTime: employeeTiming.startTime,
            endTime: employeeTiming.endTime,
            breakMinutes: employeeTiming.breakMinutes,
          },
        })
      }

      return {
        employeeId,
        startTime: employeeTiming.startTime,
        endTime: employeeTiming.endTime,
        breakMinutes: employeeTiming.breakMinutes,

        // These fields are backend-calculated. They are kept for downstream service compatibility.
        requestedMinutes: employeeTiming.requestedMinutes,
        totalRequestPaidMinutes: employeeTiming.totalRequestPaidMinutes,
        totalMinutes: employeeTiming.totalMinutes,
        totalHours: employeeTiming.totalHours,
      }
    })
    .filter(Boolean)
}

function mergeTrustedTimingIntoPayload({
  payload = {},
  shiftOtOption = {},
  shift = {},
  trustedTiming = {},
} = {}) {
  const employeeIds = normalizeIdArray(payload.employeeIds)
  const trustedEmployeeTimeOverrides = buildTrustedEmployeeTimeOverrides({
    employeeIds,
    employeeTimeOverrides: payload.employeeTimeOverrides,
    trustedTiming,
  })

  return {
    ...payload,

    employeeIds,

    // Keep only trusted custom employee overrides.
    employeeTimeOverrides: trustedEmployeeTimeOverrides.map((item) => ({
      employeeId: item.employeeId,
      startTime: item.startTime,
      endTime: item.endTime,
      breakMinutes: item.breakMinutes,
    })),

    // Optional compatibility rows. If ot.service.js ignores this, no problem.
    // If it reads them, it now receives backend-calculated values.
    employees: employeeIds.map((employeeId) => {
      const custom = trustedEmployeeTimeOverrides.find((item) => item.employeeId === employeeId)

      const timing = custom || {
        employeeId,
        startTime: trustedTiming.startTime,
        endTime: trustedTiming.endTime,
        breakMinutes: trustedTiming.breakMinutes,
        requestedMinutes: trustedTiming.requestedMinutes,
        totalRequestPaidMinutes: trustedTiming.totalRequestPaidMinutes,
        totalMinutes: trustedTiming.totalMinutes,
        totalHours: trustedTiming.totalHours,
      }

      return {
        employeeId,
        otTimeMode: custom ? 'CUSTOM' : 'DEFAULT',
        requestStartTime: timing.startTime,
        requestEndTime: timing.endTime,
        startTime: timing.startTime,
        endTime: timing.endTime,
        breakMinutes: timing.breakMinutes,
        requestedMinutes: timing.requestedMinutes,
        totalRequestPaidMinutes: timing.totalRequestPaidMinutes,
        totalMinutes: timing.totalMinutes,
        totalHours: timing.totalHours,
      }
    }),

    shiftOtOptionId: s(shiftOtOption._id || shiftOtOption.id),
    otTimingSource: upper(trustedTiming.otTimingSource || payload.otTimingSource || 'SHIFT_OPTION'),

    requestStartTime: trustedTiming.requestStartTime,
    requestEndTime: trustedTiming.requestEndTime,
    startTime: trustedTiming.startTime,
    endTime: trustedTiming.endTime,

    breakMinutes: trustedTiming.breakMinutes,
    requestedMinutes: trustedTiming.requestedMinutes,
    totalRequestPaidMinutes: trustedTiming.totalRequestPaidMinutes,
    totalMinutes: trustedTiming.totalMinutes,
    totalHours: round2(trustedTiming.totalRequestPaidMinutes / 60),

    shiftId: shift._id || shift.id || shiftOtOption.shiftId,

    // Snapshot hints for ot.service.js. If the service already builds snapshots, it can ignore these.
    shiftOtOptionLabel: s(shiftOtOption.label),
    shiftOtOptionTimingMode: upper(shiftOtOption.timingMode),
    shiftOtOptionFixedStartTime: s(shiftOtOption.fixedStartTime),
    shiftOtOptionFixedEndTime: s(shiftOtOption.fixedEndTime),
    shiftOtOptionStartAfterShiftEndMinutes: n(shiftOtOption.startAfterShiftEndMinutes),
    calculationPolicyId: shiftOtOption.calculationPolicyId || null,

    __trustedTiming: trustedTiming,
  }
}

async function buildTrustedWritePayload(payload = {}) {
  const shiftOtOption = await resolveShiftOption(payload.shiftOtOptionId)
  const shift = await resolveShift(shiftOtOption.shiftId)

  const trustedTiming = buildTrustedOTTiming({
    payload,
    shift,
    shiftOtOption,
  })

  assertTrustedTiming(trustedTiming)

  return mergeTrustedTimingIntoPayload({
    payload,
    shiftOtOption,
    shift,
    trustedTiming,
  })
}

async function buildTrustedCreatePayload(payload = {}) {
  return buildTrustedWritePayload(payload)
}

async function buildTrustedUpdatePayload(requestId, payload = {}) {
  const cleanRequestId = s(requestId)

  if (!isObjectId(cleanRequestId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_OT_REQUEST_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid OT request id',
      field: 'id',
    })
  }

  // Load existing request only to preserve stable write behavior if the caller sends partial data later.
  // Your current validator requires full write payload for update, but this makes the guard future-safe.
  const existing = await OTRequest.findById(cleanRequestId).lean()

  if (!existing) {
    throw appError({
      statusCode: 404,
      code: 'OT_REQUEST_NOT_FOUND',
      messageKey: 'ot.request.error.notFound',
      message: 'OT request not found',
      field: 'id',
    })
  }

  return buildTrustedWritePayload({
    employeeIds: payload.employeeIds || existing.employeeIds || [],
    otDate: payload.otDate || existing.otDate,
    otTimingSource: payload.otTimingSource || existing.otTimingSource || 'SHIFT_OPTION',
    shiftOtOptionId: payload.shiftOtOptionId || existing.shiftOtOptionId,
    customStartTime: payload.customStartTime || existing.customStartTime || existing.startTime,
    customEndTime: payload.customEndTime || existing.customEndTime || existing.endTime,
    customBreakMinutes:
      payload.customBreakMinutes ??
      existing.customBreakMinutes ??
      existing.breakMinutes ??
      0,
    employeeTimeOverrides: payload.employeeTimeOverrides || [],
    reason: payload.reason ?? existing.reason ?? '',
  })
}

module.exports = {
  buildTrustedCreatePayload,
  buildTrustedUpdatePayload,
}