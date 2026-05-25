// frontend/src/modules/ot/otCreatePayload.js

import {
  buildOTCreatePreview,
  calculatePaidWindowMinutes,
  calculateRawWindowMinutes,
  findShiftOTOptionById,
  isHHmm,
  normalizeShiftOTOptions,
} from './otCreatePreview'

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

export function getEmployeeId(employee = {}) {
  return s(employee?._id || employee?.id || employee?.employeeId)
}

export function normalizeCreateShiftOptionsResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

  return {
    dayType: upper(payload?.dayType),
    items: normalizeShiftOTOptions(rows)
      .map((item) => ({
        ...item,
        id: s(item.id || item._id),
        _id: s(item.id || item._id),
        label: s(item.label || item.optionLabel || item.name),
        optionLabel: s(item.optionLabel || item.label || item.name),
      }))
      .filter((item) => item.id && item.label),
  }
}

export function getSelectedOTOption(shiftOptions = [], shiftOtOptionId = '') {
  return findShiftOTOptionById(shiftOptions, shiftOtOptionId)
}

export function buildCreateRequestPreview({
  form = {},
  shiftOptions = [],
  selectedOption = null,
} = {}) {
  return buildOTCreatePreview({
    form,
    shiftOptions,
    selectedOption,
    requestPreview: null,
  })
}

export function buildDefaultTimingFromPreview(preview = {}) {
  const requestedMinutes = positiveNumber(
    preview.paidMinutes,
    preview.totalRequestPaidMinutes,
    preview.totalMinutes,
    preview.requestedMinutes,
  )

  return {
    source: upper(preview.timingSource || preview.source || 'SHIFT_OPTION'),
    startTime: s(preview.requestStartTime || preview.startTime),
    endTime: s(preview.requestEndTime || preview.endTime),
    breakMinutes: n(preview.breakMinutes),
    requestedMinutes,
    totalMinutes: requestedMinutes,
    totalHours: round2(requestedMinutes / 60),
  }
}

export function buildPickerRequestPreview(defaultTiming = {}) {
  return {
    timingMode: upper(defaultTiming.source || 'SHIFT_OPTION'),
    requestStartTime: s(defaultTiming.startTime),
    requestEndTime: s(defaultTiming.endTime),
    breakMinutes: n(defaultTiming.breakMinutes),
    requestedMinutes: n(defaultTiming.requestedMinutes),
    requestedHours: round2(n(defaultTiming.requestedMinutes) / 60),
    totalRequestPaidMinutes: n(defaultTiming.requestedMinutes),
    totalMinutes: n(defaultTiming.requestedMinutes),
    totalHours: round2(n(defaultTiming.requestedMinutes) / 60),
  }
}

export function getEmployeeTiming(employee = {}, defaultTiming = {}) {
  const employeeMode = upper(employee?.otTimeMode || 'DEFAULT')
  const useEmployeeCustomTime = employeeMode === 'CUSTOM'

  const startTime = s(
    useEmployeeCustomTime
      ? employee?.requestStartTime || employee?.startTime || defaultTiming.startTime
      : defaultTiming.startTime || employee?.requestStartTime || employee?.startTime,
  )

  const endTime = s(
    useEmployeeCustomTime
      ? employee?.requestEndTime || employee?.endTime || defaultTiming.endTime
      : defaultTiming.endTime || employee?.requestEndTime || employee?.endTime,
  )

  const breakMinutes = n(
    useEmployeeCustomTime
      ? employee?.breakMinutes ?? defaultTiming.breakMinutes ?? 0
      : defaultTiming.breakMinutes ?? employee?.breakMinutes ?? 0,
  )

  const requestedMinutes =
    (useEmployeeCustomTime ? n(employee?.requestedMinutes) : 0) ||
    n(defaultTiming.requestedMinutes) ||
    calculatePaidWindowMinutes(startTime, endTime, breakMinutes)

  return {
    startTime,
    endTime,
    breakMinutes,
    requestedMinutes,
    otTimeMode: employeeMode,
  }
}

export function buildEmployeePayloadRows({
  selectedEmployees = [],
  defaultTiming = {},
} = {}) {
  return selectedEmployees
    .map((employee) => {
      const employeeId = getEmployeeId(employee)

      if (!employeeId) return null

      const timing = getEmployeeTiming(employee, defaultTiming)

      return {
        employeeId,
        requestStartTime: timing.startTime,
        requestEndTime: timing.endTime,
        breakMinutes: timing.breakMinutes,
        requestedMinutes: timing.requestedMinutes,
        otTimeMode: timing.otTimeMode,
      }
    })
    .filter(Boolean)
}

export function buildEmployeeTimeOverridesPayload(employeeRows = []) {
  return employeeRows
    .filter((item) => upper(item.otTimeMode) === 'CUSTOM')
    .map((item) => ({
      employeeId: item.employeeId,
      startTime: item.requestStartTime,
      endTime: item.requestEndTime,
      breakMinutes: item.breakMinutes,
    }))
}

export function buildOTCreatePayload({
  form = {},
  selectedEmployees = [],
  selectedEmployeeIds = [],
  requestPreview = {},
  defaultTiming = {},
  selectedDateYMD = '',
} = {}) {
  const employeeRows = buildEmployeePayloadRows({
    selectedEmployees,
    defaultTiming,
  })

  const rootStartTime = s(
    form.customStartTime ||
      defaultTiming.startTime ||
      requestPreview.requestStartTime ||
      requestPreview.startTime,
  )

  const rootEndTime = s(
    form.customEndTime ||
      defaultTiming.endTime ||
      requestPreview.requestEndTime ||
      requestPreview.endTime,
  )

  const rootBreakMinutes = n(
    form.customBreakMinutes ??
      defaultTiming.breakMinutes ??
      requestPreview.breakMinutes ??
      0,
  )

  const rootRequestedMinutes =
    n(defaultTiming.requestedMinutes) ||
    n(requestPreview.paidMinutes) ||
    n(requestPreview.totalRequestPaidMinutes) ||
    n(requestPreview.totalMinutes) ||
    calculatePaidWindowMinutes(rootStartTime, rootEndTime, rootBreakMinutes)

  return {
    employeeIds: selectedEmployeeIds,
    employeeTimeOverrides: buildEmployeeTimeOverridesPayload(employeeRows),
    employees: employeeRows,

    otDate: selectedDateYMD,

    otTimingSource: upper(form.otTimingSource || 'SHIFT_OPTION'),
    shiftOtOptionId: s(form.shiftOtOptionId),

    customStartTime: rootStartTime,
    customEndTime: rootEndTime,
    customBreakMinutes: rootBreakMinutes,

    startTime: rootStartTime,
    endTime: rootEndTime,
    requestStartTime: rootStartTime,
    requestEndTime: rootEndTime,

    breakMinutes: rootBreakMinutes,

    // Compatibility field only. Backend remains source of truth and must recalculate/validate.
    requestedMinutes: rootRequestedMinutes,
    totalRequestPaidMinutes: rootRequestedMinutes,
    totalMinutes: rootRequestedMinutes,
    totalHours: round2(rootRequestedMinutes / 60),

    reason: s(form.reason),
  }
}

export function validateEmployeeTimingRows({
  employeeRows = [],
  findEmployeeLabel = () => '',
  t = (key) => key,
} = {}) {
  for (const row of employeeRows) {
    const employeeLabel = findEmployeeLabel(row.employeeId)

    if (!row.requestStartTime) {
      return t('ot.requests.create.missingEmployeeStart', { employee: employeeLabel })
    }

    if (!row.requestEndTime) {
      return t('ot.requests.create.missingEmployeeEnd', { employee: employeeLabel })
    }

    if (!isHHmm(row.requestStartTime)) {
      return t('ot.requests.create.employeeStartInvalid', { employee: employeeLabel })
    }

    if (!isHHmm(row.requestEndTime)) {
      return t('ot.requests.create.employeeEndInvalid', { employee: employeeLabel })
    }

    if (row.requestStartTime === row.requestEndTime) {
      return t('ot.requests.create.employeeTimeSame', { employee: employeeLabel })
    }

    const rawMinutes = calculateRawWindowMinutes(row.requestStartTime, row.requestEndTime)

    if (n(row.breakMinutes) >= rawMinutes) {
      return t('ot.requests.create.employeeBreakTooLong', { employee: employeeLabel })
    }
  }

  return ''
}

export function validateOTCreatePayload({
  payload = {},
  form = {},
  selectedShiftState = {},
  selectedOptionDayType = '',
  loadingUnavailableEmployees = false,
  defaultTiming = {},
  findEmployeeLabel = () => '',
  t = (key) => key,
} = {}) {
  if (loadingUnavailableEmployees) {
    return t('ot.requests.create.waitAvailability')
  }

  if (!payload.otDate) {
    return t('ot.requests.create.selectDateFirst')
  }

  if (!Array.isArray(payload.employeeIds) || !payload.employeeIds.length) {
    return t('ot.requests.create.selectAtLeastOneEmployee')
  }

  if (selectedShiftState.mode === 'missing') {
    return t('ot.requests.create.missingShift')
  }

  if (selectedShiftState.mode === 'mixed') {
    return t('ot.requests.create.mixedShift')
  }

  if (!payload.shiftOtOptionId) {
    return selectedOptionDayType
      ? t('ot.requests.create.selectOtOptionForDayType', {
          dayType: selectedOptionDayType,
        })
      : t('ot.requests.create.selectOtOptionRequired')
  }

  if (payload.otTimingSource === 'CUSTOM_FIXED') {
    if (!n(form.customDurationHours)) {
      return t('ot.requests.create.enterCustomDurationHours')
    }

    if (n(form.customDurationHours) <= 0) {
      return t('ot.requests.create.enterCustomDurationHours')
    }

    if (!payload.customStartTime || !payload.customEndTime) {
      return t('ot.requests.create.selectValidTiming')
    }

    if (!isHHmm(payload.customStartTime) || !isHHmm(payload.customEndTime)) {
      return t('ot.requests.create.selectValidTiming')
    }
  }

  if (!defaultTiming.startTime || !defaultTiming.endTime) {
    return t('ot.requests.create.selectValidTiming')
  }

  return validateEmployeeTimingRows({
    employeeRows: payload.employees || [],
    findEmployeeLabel,
    t,
  })
}

export default {
  getEmployeeId,
  normalizeCreateShiftOptionsResponse,
  getSelectedOTOption,
  buildCreateRequestPreview,
  buildDefaultTimingFromPreview,
  buildPickerRequestPreview,
  getEmployeeTiming,
  buildEmployeePayloadRows,
  buildEmployeeTimeOverridesPayload,
  buildOTCreatePayload,
  validateEmployeeTimingRows,
  validateOTCreatePayload,
}