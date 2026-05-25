// frontend/src/modules/ot/otCreatePreview.js

import { minutesToHours, minutesToLabel } from './otDisplay'

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

function positiveNumber(...values) {
  for (const value of values) {
    const number = Number(value)

    if (Number.isFinite(number) && number > 0) {
      return number
    }
  }

  return 0
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s(value))
}

export function timeToMinutes(value) {
  if (!isHHmm(value)) return 0

  const [hours, minutes] = s(value).split(':').map(Number)

  return hours * 60 + minutes
}

export function minutesToHHmm(value) {
  const safeValue = ((Math.round(n(value)) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(safeValue / 60)
  const minutes = safeValue % 60

  return `${pad2(hours)}:${pad2(minutes)}`
}

export function addMinutesToHHmm(startTime, minutesToAdd = 0) {
  if (!isHHmm(startTime)) return ''

  return minutesToHHmm(timeToMinutes(startTime) + Math.max(0, Math.round(n(minutesToAdd))))
}

export function calculateRawWindowMinutes(startTime, endTime) {
  if (!isHHmm(startTime) || !isHHmm(endTime)) return 0

  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  let minutes = end - start

  if (minutes <= 0) {
    minutes += DAY_MINUTES
  }

  return minutes
}

export function calculatePaidWindowMinutes(startTime, endTime, breakMinutes = 0) {
  const rawMinutes = calculateRawWindowMinutes(startTime, endTime)
  const safeBreak = Math.max(0, Math.round(n(breakMinutes)))

  return Math.max(0, rawMinutes - safeBreak)
}

export function normalizeTimingSource(value) {
  const source = upper(value)

  if (source === 'CUSTOM_FIXED') return 'CUSTOM_FIXED'
  if (source === 'CUSTOM') return 'CUSTOM_FIXED'
  if (source === 'MANUAL') return 'CUSTOM_FIXED'
  if (source === 'SHIFT_OPTION') return 'SHIFT_OPTION'

  return 'SHIFT_OPTION'
}

export function timingModeLabel(value) {
  const mode = upper(value)

  const map = {
    CUSTOM_FIXED: 'Custom fixed time',
    FIXED_TIME: 'Fixed time',
    AFTER_SHIFT_END: 'After shift end',
    BEFORE_SHIFT_START: 'Before shift start',
    DEFAULT: 'Default',
  }

  return map[mode] || map.AFTER_SHIFT_END
}

export function normalizeShiftOTOption(option = {}) {
  const id = s(option.id || option._id)

  const requestedMinutes = firstNumber(
    option.requestedMinutes,
    option.totalRequestedMinutes,
    option.durationMinutes,
  )

  const breakMinutes = firstNumber(
    option.breakMinutes,
    option.deductBreakMinutes,
    option.defaultBreakMinutes,
  )

  const paidMinutes = firstNumber(
    option.paidMinutes,
    option.totalRequestPaidMinutes,
    option.totalMinutes,
    requestedMinutes > 0 ? Math.max(0, requestedMinutes - breakMinutes) : 0,
  )

  const requestStartTime = firstText(
    option.requestStartTime,
    option.startTime,
    option.fixedStartTime,
  )

  const requestEndTime = firstText(
    option.requestEndTime,
    option.endTime,
    option.fixedEndTime,
  )

  return {
    ...option,

    id,
    _id: id,

    optionLabel: firstText(option.optionLabel, option.label, option.name, '-'),

    timingMode: firstText(option.timingMode, option.otTimeMode, 'AFTER_SHIFT_END'),
    timingModeLabel: firstText(option.timingModeLabel, timingModeLabel(option.timingMode)),

    requestStartTime,
    requestEndTime,

    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),
    requestedHoursLabel: minutesToLabel(requestedMinutes),

    breakMinutes,
    breakHours: minutesToHours(breakMinutes),
    breakLabel: minutesToLabel(breakMinutes),

    paidMinutes,
    totalRequestPaidMinutes: paidMinutes,
    paidHours: minutesToHours(paidMinutes),
    paidHoursLabel: minutesToLabel(paidMinutes),
  }
}

export function normalizeShiftOTOptions(options = []) {
  if (!Array.isArray(options)) return []

  return options.map((option) => normalizeShiftOTOption(option))
}

export function findShiftOTOptionById(options = [], optionId) {
  const targetId = s(optionId)

  if (!targetId) return null

  return normalizeShiftOTOptions(options).find((option) => s(option.id || option._id) === targetId) || null
}

export function findFirstShiftOTOption(options = []) {
  return normalizeShiftOTOptions(options).find((option) => s(option.id || option._id)) || null
}

export function formatOptionMeta(option = {}) {
  if (option?.isCustomOption) {
    return 'Enter paid OT hours only. The system calculates the end time automatically.'
  }

  const normalized = normalizeShiftOTOption(option)
  const parts = []

  if (normalized.paidMinutes > 0) {
    parts.push(normalized.paidHoursLabel)
  }

  if (normalized.requestStartTime || normalized.requestEndTime) {
    parts.push(`${normalized.requestStartTime || '-'} → ${normalized.requestEndTime || '-'}`)
  }

  return parts.join(' · ') || normalized.timingModeLabel
}

export function buildCustomPreviewFromForm(form = {}, fallbackOption = {}) {
  const customStartTime = firstText(
    form.customStartTime,
    form.requestStartTime,
    fallbackOption.requestStartTime,
    fallbackOption.startTime,
  )

  const customBreakMinutes = Math.max(0, Math.round(n(form.customBreakMinutes)))

  const customDurationHours = n(form.customDurationHours, 0)
  const customDurationMinutes = customDurationHours > 0 ? Math.round(customDurationHours * 60) : 0

  const customEndTime = firstText(form.customEndTime)

  if (isHHmm(customStartTime) && customDurationMinutes > 0) {
    const rawWindowMinutes = customDurationMinutes + customBreakMinutes
    const calculatedEndTime = addMinutesToHHmm(customStartTime, rawWindowMinutes)

    return {
      requestStartTime: customStartTime,
      requestEndTime: customEndTime || calculatedEndTime,
      calculatedEndTime,

      requestedMinutes: rawWindowMinutes,
      breakMinutes: customBreakMinutes,
      paidMinutes: customDurationMinutes,

      isReady: true,
      source: 'CUSTOM_DURATION',
    }
  }

  if (isHHmm(customStartTime) && isHHmm(customEndTime)) {
    const rawWindowMinutes = calculateRawWindowMinutes(customStartTime, customEndTime)
    const paidMinutes = calculatePaidWindowMinutes(
      customStartTime,
      customEndTime,
      customBreakMinutes,
    )

    return {
      requestStartTime: customStartTime,
      requestEndTime: customEndTime,
      calculatedEndTime: customEndTime,

      requestedMinutes: rawWindowMinutes,
      breakMinutes: customBreakMinutes,
      paidMinutes,

      isReady: true,
      source: 'CUSTOM_FIXED_TIME',
    }
  }

  return {
    requestStartTime: customStartTime,
    requestEndTime: customEndTime,
    calculatedEndTime: '',

    requestedMinutes: 0,
    breakMinutes: customBreakMinutes,
    paidMinutes: 0,

    isReady: false,
    source: 'CUSTOM_EMPTY',
  }
}

export function buildBackendPreview(requestPreview = {}, selectedOption = {}) {
  const requestStartTime = firstText(
    requestPreview.requestStartTime,
    requestPreview.startTime,
    selectedOption.requestStartTime,
    selectedOption.startTime,
  )

  const requestEndTime = firstText(
    requestPreview.requestEndTime,
    requestPreview.endTime,
    selectedOption.requestEndTime,
    selectedOption.endTime,
  )

  const breakMinutes = firstNumber(
    requestPreview.breakMinutes,
    requestPreview.time?.breakMinutes,
    requestPreview.otOption?.breakMinutes,
    selectedOption.breakMinutes,
  )

  const paidMinutes = firstNumber(
    requestPreview.paidMinutes,
    requestPreview.totalRequestPaidMinutes,
    requestPreview.totalMinutes,
    requestPreview.time?.paidMinutes,
    requestPreview.time?.totalRequestPaidMinutes,
    requestPreview.otOption?.paidMinutes,
    requestPreview.otOption?.totalRequestPaidMinutes,
    selectedOption.paidMinutes,
    selectedOption.totalRequestPaidMinutes,
  )

  const requestedMinutes = firstNumber(
    requestPreview.requestedMinutes,
    requestPreview.time?.requestedMinutes,
    requestPreview.otOption?.requestedMinutes,
    selectedOption.requestedMinutes,
    requestStartTime && requestEndTime ? calculateRawWindowMinutes(requestStartTime, requestEndTime) : 0,
  )

  return {
    requestStartTime,
    requestEndTime,
    calculatedEndTime: requestEndTime,

    requestedMinutes,
    breakMinutes,
    paidMinutes,

    isReady: paidMinutes > 0 || requestedMinutes > 0,
    source: 'BACKEND_PREVIEW',
  }
}

export function buildShiftOptionPreview(selectedOption = {}) {
  const option = normalizeShiftOTOption(selectedOption)

  return {
    requestStartTime: option.requestStartTime,
    requestEndTime: option.requestEndTime,
    calculatedEndTime: option.requestEndTime,

    requestedMinutes: option.requestedMinutes,
    breakMinutes: option.breakMinutes,
    paidMinutes: positiveNumber(
      option.paidMinutes,
      option.totalRequestPaidMinutes,
      option.requestedMinutes > 0 ? Math.max(0, option.requestedMinutes - option.breakMinutes) : 0,
    ),

    isReady: option.paidMinutes > 0 || option.requestedMinutes > 0,
    source: 'SHIFT_OPTION',
  }
}

export function decoratePreview(preview = {}) {
  const requestedMinutes = Math.max(0, Math.round(n(preview.requestedMinutes)))
  const breakMinutes = Math.max(0, Math.round(n(preview.breakMinutes)))
  const paidMinutes = Math.max(0, Math.round(n(preview.paidMinutes)))

  const rawTimeRangeLabel =
    preview.requestStartTime || preview.requestEndTime
      ? `${preview.requestStartTime || '-'} → ${preview.requestEndTime || '-'}`
      : ''

  return {
    ...preview,

    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),
    requestedHoursLabel: minutesToLabel(requestedMinutes),

    breakMinutes,
    breakHours: minutesToHours(breakMinutes),
    breakLabel: minutesToLabel(breakMinutes),

    paidMinutes,
    paidHours: minutesToHours(paidMinutes),
    paidHoursLabel: minutesToLabel(paidMinutes),

    rawTimeRangeLabel,
    timeRangeLabel: rawTimeRangeLabel,

    summaryLabel: paidMinutes > 0 ? minutesToLabel(paidMinutes) : '0h',
    paidSummaryLabel: paidMinutes > 0 ? minutesToLabel(paidMinutes) : '0h',
  }
}

export function buildOTCreatePreview({
  form = {},
  shiftOptions = [],
  selectedOption = null,
  requestPreview = null,
} = {}) {
  const timingSource = normalizeTimingSource(form.otTimingSource)
  const normalizedOptions = normalizeShiftOTOptions(shiftOptions)

  const option =
    normalizeShiftOTOption(selectedOption || {}) ||
    findShiftOTOptionById(normalizedOptions, form.shiftOtOptionId) ||
    findFirstShiftOTOption(normalizedOptions) ||
    {}

  let preview

  if (requestPreview && typeof requestPreview === 'object') {
    preview = buildBackendPreview(requestPreview, option)
  } else if (timingSource === 'CUSTOM_FIXED') {
    preview = buildCustomPreviewFromForm(form, option)
  } else {
    preview = buildShiftOptionPreview(option)
  }

  const decorated = decoratePreview(preview)

  return {
    ...decorated,

    timingSource,
    isCustomFixedTime: timingSource === 'CUSTOM_FIXED',

    selectedOption: option,
    selectedOptionId: s(option.id || option._id || form.shiftOtOptionId),

    display: {
      paidHoursLabel: decorated.paidHoursLabel,
      requestedHoursLabel: decorated.requestedHoursLabel,
      breakLabel: decorated.breakLabel,
      timeRangeLabel: decorated.timeRangeLabel,
      summaryLabel: decorated.summaryLabel,
    },
  }
}

export function applyCustomDurationToForm(form = {}, preview = {}) {
  if (!form || typeof form !== 'object') return form

  if (preview?.calculatedEndTime) {
    form.customEndTime = preview.calculatedEndTime
  }

  return form
}

export default {
  isHHmm,
  timeToMinutes,
  minutesToHHmm,
  addMinutesToHHmm,
  calculateRawWindowMinutes,
  calculatePaidWindowMinutes,

  normalizeTimingSource,
  timingModeLabel,

  normalizeShiftOTOption,
  normalizeShiftOTOptions,
  findShiftOTOptionById,
  findFirstShiftOTOption,

  formatOptionMeta,

  buildCustomPreviewFromForm,
  buildBackendPreview,
  buildShiftOptionPreview,
  decoratePreview,
  buildOTCreatePreview,
  applyCustomDurationToForm,
}