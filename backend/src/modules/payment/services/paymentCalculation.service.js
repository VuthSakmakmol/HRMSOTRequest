// backend/src/modules/payment/services/paymentCalculation.service.js

const mongoose = require('mongoose')

const PaymentFormula = require('../models/PaymentFormula.model')

const OTRequest = require('../../ot/models/OTRequest')
const OTCalculationPolicy = require('../../ot/models/OTCalculationPolicy')
const ShiftOTOption = require('../../ot/models/ShiftOTOption')
const AttendanceRecord = require('../../attendance/models/AttendanceRecord')
const {
  getPaymentApprovalRule,
} = require('../../ot/services/otExecutionSettings.service')

const { classifyDayType } = require('../../calendar/services/dayType.service')
const { verifyAttendanceAgainstOT } = require('../../attendance/utils/attendanceVerification')

const {
  getActiveAllowancePoliciesForCalculation,
} = require('../../allowance/services/paymentAllowancePolicy.service')

const { parseSalaryExcel } = require('./salaryExcelParser.service')
const {
  formatYmdToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')

const PAYMENT_PROCESS_OT_STATUSES = ['PENDING', 'APPROVED']

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400, messageKey = '') {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.messageKey = messageKey
  return error
}

function nextTick() {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

async function reportPaymentProgress(onProgress, progress, phase, message, extra = {}) {
  if (typeof onProgress !== 'function') {
    return
  }

  try {
    await onProgress({
      progress: Math.min(99, Math.max(1, Math.round(Number(progress || 1)))),
      phase: s(phase),
      message: s(message),
      ...extra,
    })
  } catch (error) {
    // Progress must never break the payment calculation.
  }

  await nextTick()
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safeNonNegativeNumber(value, fallback = 0) {
  const num = safeNumber(value, fallback)
  return num < 0 ? fallback : num
}

function safePositiveNumber(value, fallback = 1) {
  const num = safeNumber(value, fallback)
  return num > 0 ? num : fallback
}

function safeNonNegativeInt(value, fallback = 0) {
  const num = Math.round(safeNumber(value, fallback))
  return num < 0 ? fallback : num
}

function roundAmount(value, decimals = 2) {
  const safeDecimals = Math.min(Math.max(Number(decimals || 0), 0), 6)
  const factor = 10 ** safeDecimals

  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor
}

function normalizeEmployeeNo(value) {
  return upper(value)
}

function normalizeDayType(value) {
  const dayType = upper(value)

  if (['WORKING_DAY', 'SUNDAY', 'HOLIDAY'].includes(dayType)) {
    return dayType
  }

  return 'WORKING_DAY'
}

function normalizeStatus(value) {
  return upper(value)
}

function normalizeRoundingMode(value) {
  const mode = upper(value)

  if (['CEIL', 'FLOOR', 'ROUND', 'NONE'].includes(mode)) {
    return mode
  }

  return 'ROUND'
}

function getObjectIdString(value) {
  return value ? String(value) : ''
}

function isValidObjectId(value) {
  return Boolean(s(value)) && mongoose.isValidObjectId(s(value))
}

function normalizeObjectIdArray(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((id) => s(id))
        .filter((id) => mongoose.isValidObjectId(id)),
    ),
  )
}

function normalizeCodeArray(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => upper(value))
        .filter(Boolean),
    ),
  )
}

function getMultiplier(formula, dayType) {
  const normalizedDayType = normalizeDayType(dayType)

  return safeNonNegativeNumber(formula?.multipliers?.[normalizedDayType], 0)
}

function getHourlyRate(monthlySalary, formula) {
  const salary = safeNonNegativeNumber(monthlySalary, 0)
  const monthlyWorkingDays = safePositiveNumber(formula?.monthlyWorkingDays, 26)
  const hoursPerDay = safePositiveNumber(formula?.hoursPerDay, 8)

  if (salary <= 0 || monthlyWorkingDays <= 0 || hoursPerDay <= 0) {
    return 0
  }

  return salary / monthlyWorkingDays / hoursPerDay
}

function validateSalaryFile(file) {
  if (!file) {
    throw createHttpError(
      'Salary Excel file is required',
      400,
      'payment.salary_file_required',
    )
  }

  if (!file.buffer || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw createHttpError(
      'Salary Excel file is empty or invalid',
      400,
      'payment.salary_file_invalid',
    )
  }
}

function normalizeDenominations(value) {
  const source =
    Array.isArray(value) && value.length
      ? value
      : [50000, 20000, 10000, 5000, 1000, 500, 100]

  return [
    ...new Set(
      source
        .map((item) => Math.round(safePositiveNumber(item, 0)))
        .filter((item) => item > 0),
    ),
  ].sort((a, b) => b - a)
}

function normalizeHourRules(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback

  const normalized = source
    .map((item, index) => {
      const minHours = safeNonNegativeNumber(item?.minHours, index === 0 ? 0 : index)
      const rawMaxHours = item?.maxHours
      const maxHours =
        rawMaxHours === null || rawMaxHours === undefined || rawMaxHours === ''
          ? null
          : safeNonNegativeNumber(rawMaxHours, 0)

      return {
        label: s(item?.label),
        minHours,
        maxHours: maxHours !== null && maxHours > minHours ? maxHours : null,
        multiplier: safeNonNegativeNumber(item?.multiplier, 1),
        allowanceEligible: item?.allowanceEligible === true,
      }
    })
    .filter((item) => Number.isFinite(item.minHours) && Number.isFinite(item.multiplier))
    .sort((a, b) => a.minHours - b.minHours)

  return normalized
}

function resolvePaymentHourRule(formula = {}, payableMinutes = 0) {
  const payableHours = safeNonNegativeNumber(payableMinutes, 0) / 60
  const rules = normalizeHourRules(formula.hourRules)

  return (
    rules.find((rule) => {
      if (payableHours < safeNonNegativeNumber(rule.minHours, 0)) return false

      const maxHours = rule.maxHours
      if (maxHours === null || maxHours === undefined || maxHours === '') return true

      return payableHours < safeNonNegativeNumber(maxHours, 0)
    }) || null
  )
}

function resolveFormulaMultiplier({ formula = {}, dayType = 'WORKING_DAY', payableMinutes = 0 }) {
  const hourRule = resolvePaymentHourRule(formula, payableMinutes)

  if (hourRule) {
    return {
      multiplier: safeNonNegativeNumber(hourRule.multiplier, 0),
      multiplierSource: 'HOUR_RULE',
      hourRule,
    }
  }

  return {
    multiplier: getMultiplier(formula, dayType),
    multiplierSource: 'DAY_TYPE',
    hourRule: null,
  }
}

function formatHourRuleLabel(rule = {}) {
  const label = s(rule.label)
  if (label) return label

  const minHours = safeNonNegativeNumber(rule.minHours, 0)
  const maxHours = rule.maxHours

  if (maxHours === null || maxHours === undefined || maxHours === '') {
    return `${minHours}h up`
  }

  return `${minHours}h - ${safeNonNegativeNumber(maxHours, 0)}h`
}

function buildPaymentAmountSegment({ label, hours, multiplier, hourlyRate }) {
  const safeHours = safeNonNegativeNumber(hours, 0)
  const safeMultiplier = safeNonNegativeNumber(multiplier, 0)
  const rawAmount = safeNonNegativeNumber(hourlyRate, 0) * safeHours * safeMultiplier

  return {
    label: s(label),
    hours: roundAmount(safeHours, 4),
    multiplier: safeMultiplier,
    amount: rawAmount,
    amountRounded: roundAmount(rawAmount, 6),
  }
}

function getRuleMaxHours(rule = {}) {
  const maxHours = rule.maxHours

  if (maxHours === null || maxHours === undefined || maxHours === '') {
    return Number.POSITIVE_INFINITY
  }

  const safeMaxHours = safeNonNegativeNumber(maxHours, 0)

  return safeMaxHours > safeNonNegativeNumber(rule.minHours, 0)
    ? safeMaxHours
    : Number.POSITIVE_INFINITY
}

function pushProgressiveAmountSegment(segments, { rule, hours, multiplier, hourlyRate }) {
  const safeHours = safeNonNegativeNumber(hours, 0)
  const safeMultiplier = safeNonNegativeNumber(multiplier, 0)

  if (safeHours <= 0 || safeMultiplier <= 0) return

  const previous = segments[segments.length - 1]

  // Keep the exported formula clean. Adjacent ranges with the same multiplier
  // should display as one calculation, e.g. 4h × 1.5x instead of
  // 3h × 1.5x + 1h × 1.5x.
  if (previous && safeNonNegativeNumber(previous.multiplier, 0) === safeMultiplier) {
    const combinedHours = safeNonNegativeNumber(previous.hours, 0) + safeHours
    const combinedAmount = safeNonNegativeNumber(previous.amount, 0) + safeNonNegativeNumber(hourlyRate, 0) * safeHours * safeMultiplier

    previous.hours = roundAmount(combinedHours, 4)
    previous.amount = combinedAmount
    previous.amountRounded = roundAmount(combinedAmount, 6)
    return
  }

  segments.push(
    buildPaymentAmountSegment({
      label: formatHourRuleLabel(rule),
      hours: safeHours,
      multiplier: safeMultiplier,
      hourlyRate,
    }),
  )
}

function calculateProgressiveHourRuleAmount({ hourlyRate = 0, formula = {}, dayType = 'WORKING_DAY', payableMinutes = 0 }) {
  const payableHours = safeNonNegativeNumber(payableMinutes, 0) / 60
  const rules = normalizeHourRules(formula.hourRules)
  const matchedRule = resolvePaymentHourRule(formula, payableMinutes)

  if (payableHours <= 0) {
    return {
      rawAmount: 0,
      effectiveMultiplier: 0,
      multiplierSource: matchedRule ? 'HOUR_RULE_PROGRESSIVE' : 'DAY_TYPE',
      hourRule: matchedRule,
      segments: [],
    }
  }

  if (!matchedRule || !rules.length) {
    const multiplier = getMultiplier(formula, dayType)
    const segment = buildPaymentAmountSegment({
      label: normalizeDayType(dayType).replace(/_/g, ' '),
      hours: payableHours,
      multiplier,
      hourlyRate,
    })

    return {
      rawAmount: segment.amount,
      effectiveMultiplier: multiplier,
      multiplierSource: 'DAY_TYPE',
      hourRule: null,
      segments: [segment],
    }
  }

  const sortedRules = [...rules].sort((a, b) => {
    const byMin = safeNonNegativeNumber(a.minHours, 0) - safeNonNegativeNumber(b.minHours, 0)
    if (byMin) return byMin

    return getRuleMaxHours(a) - getRuleMaxHours(b)
  })

  const segments = []
  let coveredUntil = 0

  sortedRules.forEach((rule) => {
    const minHours = safeNonNegativeNumber(rule.minHours, 0)
    const maxHours = getRuleMaxHours(rule)

    if (payableHours <= minHours) return

    // If the first configured rule starts after 0, pay the missing gap by
    // the normal day-type multiplier so no approved payable hour disappears.
    if (minHours > coveredUntil && coveredUntil < payableHours) {
      const gapEnd = Math.min(minHours, payableHours)
      pushProgressiveAmountSegment(segments, {
        rule: { label: normalizeDayType(dayType).replace(/_/g, ' ') },
        hours: gapEnd - coveredUntil,
        multiplier: getMultiplier(formula, dayType),
        hourlyRate,
      })
      coveredUntil = gapEnd
    }

    const segmentStart = Math.max(minHours, coveredUntil)
    const segmentEnd = Math.min(maxHours, payableHours)

    if (segmentEnd <= segmentStart) return

    pushProgressiveAmountSegment(segments, {
      rule,
      hours: segmentEnd - segmentStart,
      multiplier: rule.multiplier,
      hourlyRate,
    })

    coveredUntil = Math.max(coveredUntil, segmentEnd)
  })

  // If payable hours exceed the last configured max, use the last rule that
  // starts before the remaining hours. This protects payroll from losing hours
  // when the final rule was entered with a high fixed max like 16.
  if (coveredUntil < payableHours) {
    const fallbackRule = [...sortedRules]
      .reverse()
      .find((rule) => safeNonNegativeNumber(rule.minHours, 0) <= coveredUntil)

    const fallbackMultiplier = fallbackRule
      ? safeNonNegativeNumber(fallbackRule.multiplier, getMultiplier(formula, dayType))
      : getMultiplier(formula, dayType)

    pushProgressiveAmountSegment(segments, {
      rule: fallbackRule || { label: normalizeDayType(dayType).replace(/_/g, ' ') },
      hours: payableHours - coveredUntil,
      multiplier: fallbackMultiplier,
      hourlyRate,
    })
  }

  const rawAmount = segments.reduce(
    (total, segment) => total + safeNonNegativeNumber(segment.amount, 0),
    0,
  )

  const effectiveMultiplier =
    hourlyRate > 0 && payableHours > 0 ? rawAmount / hourlyRate / payableHours : 0

  return {
    rawAmount,
    effectiveMultiplier,
    multiplierSource: 'HOUR_RULE_PROGRESSIVE',
    hourRule: matchedRule,
    segments,
  }
}

function hasAllowanceEligibleHourRuleSegment({ formula = {}, payableMinutes = 0 }) {
  const payableHours = safeNonNegativeNumber(payableMinutes, 0) / 60
  const rules = normalizeHourRules(formula.hourRules)

  if (payableHours <= 0) return false
  if (!rules.length) return true

  const sortedRules = [...rules].sort((a, b) => {
    const byMin = safeNonNegativeNumber(a.minHours, 0) - safeNonNegativeNumber(b.minHours, 0)
    if (byMin) return byMin

    return getRuleMaxHours(a) - getRuleMaxHours(b)
  })

  let coveredUntil = 0

  for (const rule of sortedRules) {
    const minHours = safeNonNegativeNumber(rule.minHours, 0)
    const maxHours = getRuleMaxHours(rule)

    if (payableHours <= minHours) continue

    const segmentStart = Math.max(minHours, coveredUntil)
    const segmentEnd = Math.min(maxHours, payableHours)

    if (segmentEnd > segmentStart && rule.allowanceEligible === true) {
      return true
    }

    if (segmentEnd > segmentStart) {
      coveredUntil = Math.max(coveredUntil, segmentEnd)
    }
  }

  if (coveredUntil < payableHours) {
    const fallbackRule = [...sortedRules]
      .reverse()
      .find((rule) => safeNonNegativeNumber(rule.minHours, 0) <= coveredUntil)

    return fallbackRule ? fallbackRule.allowanceEligible === true : true
  }

  return false
}

function isAllowanceAllowedByFormula({ formula = {}, payableMinutes = 0, item = null }) {
  if (item && upper(item.multiplierSource).startsWith('HOUR_RULE')) {
    return item.allowanceEligibleByFormula === true
  }

  return hasAllowanceEligibleHourRuleSegment({ formula, payableMinutes })
}

function mapFormula(doc = {}) {
  return {
    id: doc._id ? String(doc._id) : null,
    code: upper(doc.code),
    name: s(doc.name),
    description: s(doc.description),
    salaryBasis: upper(doc.salaryBasis || 'MONTHLY_SALARY'),

    monthlyWorkingDays: safePositiveNumber(doc.monthlyWorkingDays, 26),
    hoursPerDay: safePositiveNumber(doc.hoursPerDay, 8),

    multipliers: {
      WORKING_DAY: safeNonNegativeNumber(doc.multipliers?.WORKING_DAY, 1.5),
      SUNDAY: safeNonNegativeNumber(doc.multipliers?.SUNDAY, 2),
      HOLIDAY: safeNonNegativeNumber(doc.multipliers?.HOLIDAY, 3),
    },

    hourRules: normalizeHourRules(doc.hourRules),

    roundingDecimals: Math.min(Math.max(Number(doc.roundingDecimals || 2), 0), 6),
    currency: upper(doc.currency || 'USD'),

    payoutCurrency: upper(doc.payoutCurrency || 'KHR'),
    cashRoundingUnit: Math.round(safePositiveNumber(doc.cashRoundingUnit, 100)),
    cashRoundingMode: normalizeRoundingMode(doc.cashRoundingMode || 'ROUND'),
    cashDenominations: normalizeDenominations(doc.cashDenominations),

    isActive: doc.isActive === true,
  }
}

function buildManualExchangeRate(rate, formula = {}) {
  const manualRate = safePositiveNumber(rate, 0)

  if (manualRate <= 0) {
    throw createHttpError(
      'Manual exchange rate is required',
      400,
      'payment.exchange_rate.manual_rate_required',
    )
  }

  return {
    id: null,
    code: 'MANUAL',
    name: 'Manual rate',
    description: 'Manual exchange rate entered during payment calculation',

    fromCurrency: upper(formula.currency || 'USD'),
    toCurrency: upper(formula.payoutCurrency || 'KHR'),
    rate: manualRate,

    roundingUnit: Math.round(safePositiveNumber(formula.cashRoundingUnit, 100)),
    roundingMode: normalizeRoundingMode(formula.cashRoundingMode || 'ROUND'),
    denominations: normalizeDenominations(formula.cashDenominations),

    source: 'MANUAL_INPUT',
    isManual: true,
    isActive: true,
  }
}

async function getFormulaOrThrow(formulaId) {
  if (!mongoose.isValidObjectId(formulaId)) {
    throw createHttpError(
      'Invalid payment formula id',
      400,
      'payment.formula.invalid_id',
    )
  }

  const doc = await PaymentFormula.findById(formulaId).lean()

  if (!doc) {
    throw createHttpError(
      'Payment formula not found',
      404,
      'payment.formula.not_found',
    )
  }

  if (doc.isActive !== true) {
    throw createHttpError(
      'Payment formula is inactive',
      400,
      'payment.formula.inactive',
    )
  }

  return mapFormula(doc)
}

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s(value))
}

function normalizeSelectedDates(selectedDates = []) {
  const source = Array.isArray(selectedDates) ? selectedDates : []

  return Array.from(
    new Set(
      source
        .map((value) => s(value))
        .filter((value) => isYmd(value)),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

function getDatesInRange(fromDate, toDate) {
  const from = s(fromDate)
  const to = s(toDate)

  if (!isYmd(from) || !isYmd(to) || from > to) return []

  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const cursor = new Date(Date.UTC(fromYear, fromMonth - 1, fromDay))
  const end = new Date(Date.UTC(toYear, toMonth - 1, toDay))
  const dates = []

  while (cursor <= end) {
    const year = cursor.getUTCFullYear()
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cursor.getUTCDate()).padStart(2, '0')
    dates.push(`${year}-${month}-${day}`)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function resolveSelectedPaymentDates(fromDate, toDate, selectedDates = []) {
  const normalized = normalizeSelectedDates(selectedDates).filter(
    (date) => date >= s(fromDate) && date <= s(toDate),
  )

  // Backward compatibility: existing callers that do not send selectedDates
  // keep calculating every date inside the period.
  return normalized.length ? normalized : getDatesInRange(fromDate, toDate)
}

function buildPaymentOTFilter(fromDate, toDate, selectedDates = []) {
  const dates = resolveSelectedPaymentDates(fromDate, toDate, selectedDates)

  return {
    // Payment first loads every active workflow status. The execution setting
    // later decides whether pending records are eligible or are recorded as
    // approval-required exclusions. This keeps the preview/audit transparent.
    status: {
      $in: PAYMENT_PROCESS_OT_STATUSES,
    },
    otDate: dates.length
      ? { $in: dates }
      : {
          $gte: s(fromDate),
          $lte: s(toDate),
        },
  }
}

async function fetchPaymentOTRequests(fromDate, toDate, selectedDates = []) {
  return OTRequest.find(buildPaymentOTFilter(fromDate, toDate, selectedDates))
    .sort({
      otDate: 1,
      requestNo: 1,
      createdAt: 1,
      _id: 1,
    })
    .lean()
}

function splitOTRequestsForPayment(otRequests = [], paymentRequiresFinalApproval = false) {
  const source = Array.isArray(otRequests) ? otRequests : []

  if (!paymentRequiresFinalApproval) {
    return {
      eligibleRequests: source,
      excludedUnapprovedRequests: [],
    }
  }

  return {
    eligibleRequests: source.filter((item) => normalizeStatus(item?.status) === 'APPROVED'),
    excludedUnapprovedRequests: source.filter(
      (item) => normalizeStatus(item?.status) !== 'APPROVED',
    ),
  }
}

function resolveRequestPaidMinutes(otRequest = {}) {
  const totalRequestPaidMinutes = safeNonNegativeInt(
    otRequest.totalRequestPaidMinutes ??
      otRequest.totalPaidMinutes ??
      otRequest.requestPaidMinutes,
    0,
  )

  if (totalRequestPaidMinutes > 0) return totalRequestPaidMinutes

  const totalMinutes = safeNonNegativeInt(otRequest.totalMinutes, 0)
  if (totalMinutes > 0) return totalMinutes

  const requestedMinutes = safeNonNegativeInt(
    otRequest.requestedMinutes ?? otRequest.requestedOtMinutes,
    0,
  )

  const breakMinutes = safeNonNegativeInt(otRequest.breakMinutes, 0)

  if (requestedMinutes > 0 && breakMinutes > 0 && breakMinutes < requestedMinutes) {
    return requestedMinutes - breakMinutes
  }

  return requestedMinutes
}

function mapPolicySnapshotForVerification(snapshot = {}, fallbackPolicy = null) {
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key)

  const pickString = (snapshotKey, fallbackKey = snapshotKey) => {
    const fromSnapshot = s(snapshot?.[snapshotKey])
    if (fromSnapshot) return fromSnapshot

    return s(fallbackPolicy?.[fallbackKey])
  }

  const pickNumber = (snapshotKey, fallbackKey = snapshotKey, defaultValue = 0) => {
    if (hasOwn(snapshot, snapshotKey)) {
      return Number(snapshot?.[snapshotKey] || defaultValue)
    }

    if (fallbackPolicy && hasOwn(fallbackPolicy, fallbackKey)) {
      return Number(fallbackPolicy?.[fallbackKey] || defaultValue)
    }

    return Number(defaultValue || 0)
  }

  const pickBoolean = (snapshotKey, fallbackKey = snapshotKey, defaultValue = false) => {
    if (hasOwn(snapshot, snapshotKey)) {
      return snapshot?.[snapshotKey] === true
    }

    if (fallbackPolicy && hasOwn(fallbackPolicy, fallbackKey)) {
      return fallbackPolicy?.[fallbackKey] === true
    }

    return defaultValue
  }

  return {
    calculationPolicyId: snapshot?.calculationPolicyId
      ? String(snapshot.calculationPolicyId)
      : fallbackPolicy?._id
        ? String(fallbackPolicy._id)
        : null,

    code: upper(pickString('code')),
    name: s(pickString('name')),

    minEligibleMinutes: pickNumber('minEligibleMinutes', 'minEligibleMinutes', 0),
    roundUnitMinutes: pickNumber('roundUnitMinutes', 'roundUnitMinutes', 30),
    roundMethod: upper(pickString('roundMethod') || 'CEIL'),
    graceAfterShiftEndMinutes: pickNumber(
      'graceAfterShiftEndMinutes',
      'graceAfterShiftEndMinutes',
      0,
    ),

    allowApprovedOtWithoutExactClockOut: pickBoolean(
      'allowApprovedOtWithoutExactClockOut',
      'allowApprovedOtWithoutExactClockOut',
      false,
    ),

    allowPreShiftOT: pickBoolean('allowPreShiftOT', 'allowPreShiftOT', false),
    allowPostShiftOT: pickBoolean('allowPostShiftOT', 'allowPostShiftOT', true),
    capByRequestedMinutes: pickBoolean('capByRequestedMinutes', 'capByRequestedMinutes', true),

    treatForgetScanInAsPending: pickBoolean(
      'treatForgetScanInAsPending',
      'treatForgetScanInAsPending',
      true,
    ),
    treatForgetScanOutAsPending: pickBoolean(
      'treatForgetScanOutAsPending',
      'treatForgetScanOutAsPending',
      true,
    ),
  }
}

async function resolveCurrentPolicyAndShiftOption(otRequest = {}) {
  let currentPolicy = null
  let currentShiftOtOption = null

  if (isValidObjectId(otRequest.shiftOtOptionId)) {
    currentShiftOtOption = await ShiftOTOption.findById(otRequest.shiftOtOptionId).lean()
  }

  if (isValidObjectId(otRequest.otCalculationPolicyId)) {
    currentPolicy = await OTCalculationPolicy.findById(otRequest.otCalculationPolicyId).lean()
  }

  if (
    !currentPolicy &&
    currentShiftOtOption?.calculationPolicyId &&
    mongoose.isValidObjectId(currentShiftOtOption.calculationPolicyId)
  ) {
    currentPolicy = await OTCalculationPolicy.findById(
      currentShiftOtOption.calculationPolicyId,
    ).lean()
  }

  return {
    currentPolicy,
    currentShiftOtOption,
  }
}

function employeeRequestMergeKey(item = {}) {
  const employeeId = s(item.employeeId)
  if (employeeId) return `ID:${employeeId}`

  const employeeCode = upper(item.employeeCode || item.employeeNo)
  if (employeeCode) return `CODE:${employeeCode}`

  return ''
}

function mergeApprovedEmployeeWithRequestedTiming(approved = {}, requested = {}) {
  return {
    ...requested,
    ...approved,

    // Keep approved employee identity/details, but preserve the employee-level
    // OT time from requestedEmployees when approvedEmployees was saved by older
    // code without custom time fields. Payment must use the approved row time
    // such as 7h, not the original request-level OT option such as 2h.
    otTimeMode: s(approved.otTimeMode) || s(requested.otTimeMode),
    startTime: s(approved.startTime) || s(requested.startTime),
    endTime: s(approved.endTime) || s(requested.endTime),
    requestStartTime:
      s(approved.requestStartTime) ||
      s(approved.startTime) ||
      s(requested.requestStartTime) ||
      s(requested.startTime),
    requestEndTime:
      s(approved.requestEndTime) ||
      s(approved.endTime) ||
      s(requested.requestEndTime) ||
      s(requested.endTime),
    expectedOtStartTime:
      s(approved.expectedOtStartTime) ||
      s(approved.startTime) ||
      s(requested.expectedOtStartTime) ||
      s(requested.startTime),
    expectedOtEndTime:
      s(approved.expectedOtEndTime) ||
      s(approved.endTime) ||
      s(requested.expectedOtEndTime) ||
      s(requested.endTime),

    breakMinutes: firstNonNegativeNumber(approved.breakMinutes, requested.breakMinutes),
    requestedMinutes: firstPositiveNumber(
      approved.requestedMinutes,
      approved.requestedOtMinutes,
      requested.requestedMinutes,
      requested.requestedOtMinutes,
    ),
    totalRequestPaidMinutes: firstPositiveNumber(
      approved.totalRequestPaidMinutes,
      approved.approvedPaidMinutes,
      approved.requestPaidMinutes,
      approved.totalMinutes,
      requested.totalRequestPaidMinutes,
      requested.approvedPaidMinutes,
      requested.requestPaidMinutes,
      requested.totalMinutes,
    ),
    totalMinutes: firstPositiveNumber(
      approved.totalMinutes,
      approved.totalRequestPaidMinutes,
      requested.totalMinutes,
      requested.totalRequestPaidMinutes,
    ),
    totalHours: firstPositiveNumber(approved.totalHours, requested.totalHours),
  }
}

function getEffectiveApprovedEmployeesForVerification(otRequest = {}) {
  const requestedEmployees = Array.isArray(otRequest.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const approvedEmployees = Array.isArray(otRequest.approvedEmployees)
    ? otRequest.approvedEmployees
    : []

  if (!approvedEmployees.length) return requestedEmployees

  const requestedMap = new Map()
  for (const requested of requestedEmployees) {
    const key = employeeRequestMergeKey(requested)
    if (key && !requestedMap.has(key)) requestedMap.set(key, requested)
  }

  return approvedEmployees.map((approved) => {
    const key = employeeRequestMergeKey(approved)
    const requested = key ? requestedMap.get(key) : null

    return requested
      ? mergeApprovedEmployeeWithRequestedTiming(approved, requested)
      : approved
  })
}

function buildVerificationOTRequestPayload(otRequest, approvedEmployees = [], options = {}) {
  const requestedEmployees = Array.isArray(otRequest?.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const effectiveApprovedEmployees = Array.isArray(approvedEmployees) ? approvedEmployees : []

  const currentPolicy = options.currentPolicy || null
  const currentShiftOtOption = options.currentShiftOtOption || null

  const storedDayType = upper(otRequest.dayType)
  const internalCalendarDayType = upper(
    options.internalCalendarDayType || storedDayType || 'WORKING_DAY',
  )

  const requestedMinutes = safeNonNegativeInt(
    otRequest?.requestedMinutes || otRequest?.totalMinutes,
    0,
  )

  const breakMinutes = safeNonNegativeInt(otRequest?.breakMinutes, 0)

  const totalRequestPaidMinutes = Number(
    otRequest?.totalRequestPaidMinutes ||
      otRequest?.totalPaidMinutes ||
      otRequest?.totalMinutes ||
      (requestedMinutes > 0 && breakMinutes > 0 && breakMinutes < requestedMinutes
        ? requestedMinutes - breakMinutes
        : requestedMinutes) ||
      0,
  )

  const timingMode = upper(
    otRequest?.shiftOtOptionTimingMode ||
      otRequest?.timingMode ||
      currentShiftOtOption?.timingMode ||
      '',
  )

  const shiftOtOptionStartAfterShiftEndMinutes = Number(
    otRequest?.shiftOtOptionStartAfterShiftEndMinutes ??
      currentShiftOtOption?.startAfterShiftEndMinutes ??
      0,
  )

  const requestStartTime = s(otRequest.requestStartTime || otRequest.startTime)
  const requestEndTime = s(otRequest.requestEndTime || otRequest.endTime)

  const fixedStartTime =
    timingMode === 'FIXED_TIME'
      ? s(
          otRequest?.shiftOtOptionFixedStartTime ||
            currentShiftOtOption?.fixedStartTime ||
            requestStartTime,
        )
      : s(otRequest?.shiftOtOptionFixedStartTime)

  const fixedEndTime =
    timingMode === 'FIXED_TIME'
      ? s(
          otRequest?.shiftOtOptionFixedEndTime ||
            currentShiftOtOption?.fixedEndTime ||
            requestEndTime,
        )
      : s(otRequest?.shiftOtOptionFixedEndTime)

  return {
    _id: otRequest._id,
    id: otRequest._id ? String(otRequest._id) : null,
    requestNo: s(otRequest.requestNo),

    requesterEmployeeId: otRequest.requesterEmployeeId
      ? String(otRequest.requesterEmployeeId)
      : null,
    requesterEmployeeNo: s(otRequest.requesterEmployeeNo),
    requesterName: s(otRequest.requesterName),

    otDate: s(otRequest.otDate),
    otDateDisplay: formatYmdToDmy(otRequest.otDate),

    dayType: internalCalendarDayType,
    storedDayType,
    internalCalendarDayType,
    dayTypeMismatch:
      Boolean(storedDayType) &&
      Boolean(internalCalendarDayType) &&
      storedDayType !== internalCalendarDayType,

    status: upper(otRequest.status),

    shiftId: otRequest.shiftId ? String(otRequest.shiftId) : null,
    shiftCode: upper(otRequest.shiftCode),
    shiftName: s(otRequest.shiftName),
    shiftType: upper(otRequest.shiftType),
    shiftStartTime: s(otRequest.shiftStartTime),
    shiftEndTime: s(otRequest.shiftEndTime),
    shiftCrossMidnight: otRequest.shiftCrossMidnight === true,

    shiftOtOptionId: otRequest.shiftOtOptionId ? String(otRequest.shiftOtOptionId) : null,
    shiftOtOptionLabel: s(otRequest.shiftOtOptionLabel || currentShiftOtOption?.label),

    shiftOtOptionTimingMode: timingMode,
    shiftOtOptionStartAfterShiftEndMinutes,
    shiftOtOptionFixedStartTime: fixedStartTime,
    shiftOtOptionFixedEndTime: fixedEndTime,

    requestedMinutes,
    breakMinutes,

    totalMinutes: totalRequestPaidMinutes,
    totalRequestPaidMinutes,
    requestPaidMinutes: totalRequestPaidMinutes,
    totalHours: Number(
      otRequest.totalHours || (totalRequestPaidMinutes > 0 ? totalRequestPaidMinutes / 60 : 0),
    ),

    requestStartTime,
    requestEndTime,
    expectedOtStartTime: requestStartTime,
    expectedOtEndTime: requestEndTime,

    otCalculationPolicyId: otRequest.otCalculationPolicyId
      ? String(otRequest.otCalculationPolicyId)
      : currentPolicy?._id
        ? String(currentPolicy._id)
        : null,

    otCalculationPolicySnapshot: mapPolicySnapshotForVerification(
      otRequest.otCalculationPolicySnapshot || {},
      currentPolicy,
    ),

    requestedEmployeeCount: Number(otRequest.requestedEmployeeCount || requestedEmployees.length),
    approvedEmployeeCount: Number(
      effectiveApprovedEmployees.length || otRequest.approvedEmployeeCount || 0,
    ),

    requestedEmployees,
    approvedEmployees: effectiveApprovedEmployees,
  }
}

function buildUniqueEmployeeLookupList(...employeeGroups) {
  const result = []
  const seen = new Set()

  for (const group of employeeGroups) {
    for (const item of Array.isArray(group) ? group : []) {
      const employeeId = s(item?.employeeId)
      const employeeCode = upper(item?.employeeCode || item?.employeeNo)
      const key = employeeId ? `ID:${employeeId}` : employeeCode ? `CODE:${employeeCode}` : ''

      if (!key || seen.has(key)) continue

      seen.add(key)
      result.push(item)
    }
  }

  return result
}

function buildAttendanceRecordFilterForOT(otRequest = {}) {
  const requestedEmployees = Array.isArray(otRequest.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const approvedEmployees = Array.isArray(otRequest.approvedEmployees)
    ? otRequest.approvedEmployees
    : []

  // Payment must check attendance for the employees that are actually approved
  // for payment. Some rows can be changed/increased during approval, and the
  // approved employee list can differ from the original request list.
  const lookupEmployees = buildUniqueEmployeeLookupList(approvedEmployees, requestedEmployees)

  const requestedEmployeeIds = normalizeObjectIdArray(
    lookupEmployees.map((item) => item?.employeeId),
  )

  const requestedEmployeeCodes = normalizeCodeArray(
    lookupEmployees.map((item) => item?.employeeCode || item?.employeeNo),
  )

  const orConditions = []

  if (requestedEmployeeIds.length) {
    orConditions.push({
      employeeId: {
        $in: requestedEmployeeIds,
      },
    })
  }

  if (requestedEmployeeCodes.length) {
    orConditions.push({
      employeeNo: {
        $in: requestedEmployeeCodes,
      },
    })
  }

  if (!orConditions.length) return null

  return {
    attendanceDate: s(otRequest.otDate),
    $or: orConditions,
  }
}

async function findAttendanceRecordsForOTRequest(otRequest = {}) {
  const filter = buildAttendanceRecordFilterForOT(otRequest)
  if (!filter) return []

  return AttendanceRecord.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .lean()
}

function employeePaymentKey(item = {}) {
  const employeeId = s(item.employeeId)

  if (employeeId) {
    return `ID:${employeeId}`
  }

  const employeeCode = upper(item.employeeCode || item.employeeNo)

  if (employeeCode) {
    return `CODE:${employeeCode}`
  }

  return ''
}

function buildEmployeeOriginalMap(employees = []) {
  const map = new Map()

  for (const employee of Array.isArray(employees) ? employees : []) {
    const key = employeePaymentKey(employee)
    if (key && !map.has(key)) {
      map.set(key, employee)
    }
  }

  return map
}

function buildVerificationPaymentMap(verification = {}) {
  const rows = [
    ...(Array.isArray(verification.otMatchEmployees)
      ? verification.otMatchEmployees
      : []),
    ...(Array.isArray(verification.otMismatchEmployees)
      ? verification.otMismatchEmployees
      : []),
    ...(Array.isArray(verification.otPendingReviewEmployees)
      ? verification.otPendingReviewEmployees
      : []),
  ]

  const map = new Map()

  for (const row of rows) {
    const key = employeePaymentKey(row)

    if (key && !map.has(key)) {
      map.set(key, row)
    }
  }

  return map
}

function getVerificationPayableMinutes(verificationRow = {}) {
  const result = upper(verificationRow.otResult)
  const attendanceStatus = upper(verificationRow.attendanceStatus)
  const hasAnyPunch =
    verificationRow.hasClockIn === true ||
    verificationRow.hasClockOut === true ||
    Boolean(s(verificationRow.clockIn)) ||
    Boolean(s(verificationRow.clockOut))

  if (result === 'PENDING_REVIEW') return 0

  // Never pay employees who are absent/leave/off or have no attendance punch.
  // This prevents requested/approved minutes from being used as a fallback when
  // the verification row is a generated ABSENT row.
  if (['ABSENT', 'LEAVE', 'OFF'].includes(attendanceStatus) || !hasAnyPunch) {
    return 0
  }

  const directVerifiedMinutes = firstNonNegativeNumber(
    verificationRow.roundedOtMinutes,
    verificationRow.payableMinutes,
    verificationRow.verifiedPayableMinutes,
    verificationRow.finalPayableMinutes,
    verificationRow.paymentPayableMinutes,
    verificationRow.policyPaidMinutes,
    verificationRow.policyPayableMinutes,
    verificationRow.calculatedPaidMinutes,
    verificationRow.calculatedPayableMinutes,
    verificationRow.attendancePaidMinutes,
    verificationRow.attendancePayableMinutes,
  )

  return safeNonNegativeInt(directVerifiedMinutes, 0)
}

function mergeEmployeeWithVerification(originalEmployee = {}, verificationRow = {}) {
  const payableMinutes = getVerificationPayableMinutes(verificationRow)

  return {
    ...originalEmployee,

    attendanceRecordId: verificationRow.attendanceRecordId || null,
    attendanceImportId: verificationRow.importId || null,

    attendanceDate: s(verificationRow.attendanceDate),
    attendanceStatus: upper(verificationRow.attendanceStatus),
    attendanceStatusKey: s(verificationRow.attendanceStatusKey),
    attendanceMessageKey: s(verificationRow.attendanceMessageKey),

    clockIn: s(verificationRow.clockIn),
    clockOut: s(verificationRow.clockOut),

    actualOtMinutes: safeNonNegativeInt(verificationRow.actualOtMinutes, 0),
    eligibleOtMinutes: safeNonNegativeInt(verificationRow.eligibleOtMinutes, 0),
    roundedOtMinutes: safeNonNegativeInt(verificationRow.roundedOtMinutes, 0),

    approvedPaidMinutes: payableMinutes,
    payableMinutes,
    paidMinutes: payableMinutes,
    verifiedPayableMinutes: payableMinutes,
    finalPayableMinutes: payableMinutes,
    paymentPayableMinutes: payableMinutes,
    policyPaidMinutes: payableMinutes,
    policyPayableMinutes: payableMinutes,
    calculatedPaidMinutes: payableMinutes,
    calculatedPayableMinutes: payableMinutes,
    attendancePaidMinutes: payableMinutes,
    attendancePayableMinutes: payableMinutes,

    rawOtDecision: upper(verificationRow.rawOtDecision),
    rawOtDecisionKey: s(verificationRow.rawOtDecisionKey),

    otResult: upper(verificationRow.otResult),
    otResultLabelKey: s(verificationRow.otResultLabelKey),
    otResultReason: s(verificationRow.otResultReason),
    otResultReasonKey: s(verificationRow.otResultReasonKey),
    paymentMessageKey: s(verificationRow.messageKey),

    paymentEligible: payableMinutes > 0,
    paymentBlockedReason:
      payableMinutes > 0
        ? ''
        : s(verificationRow.otResultReason || 'No attendance/policy payable minutes found'),

    policyCode: s(verificationRow.policyCode),
    policyName: s(verificationRow.policyName),
    policyRoundMethod: s(verificationRow.policyRoundMethod),
    policyRoundUnitMinutes: safeNonNegativeNumber(verificationRow.policyRoundUnitMinutes, 0),
    policyMinEligibleMinutes: safeNonNegativeNumber(verificationRow.policyMinEligibleMinutes, 0),
    policyGraceAfterShiftEndMinutes: safeNonNegativeNumber(
      verificationRow.policyGraceAfterShiftEndMinutes,
      0,
    ),
  }
}

async function buildLivePaymentVerification(otRequest = {}) {
  const { currentPolicy, currentShiftOtOption } =
    await resolveCurrentPolicyAndShiftOption(otRequest)

  const requestedEmployees = Array.isArray(otRequest.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const effectiveApprovedEmployees = getEffectiveApprovedEmployeesForVerification(otRequest)
  const sourceEmployees = effectiveApprovedEmployees.length
    ? effectiveApprovedEmployees
    : requestedEmployees

  const attendanceRecords = await findAttendanceRecordsForOTRequest({
    ...otRequest,
    requestedEmployees: sourceEmployees,
    approvedEmployees: sourceEmployees,
  })

  const internalDayInfo = await classifyDayType(s(otRequest.otDate))
  const internalCalendarDayType = upper(internalDayInfo?.dayType || 'WORKING_DAY')

  const verificationOtRequest = buildVerificationOTRequestPayload(
    otRequest,
    sourceEmployees,
    {
      currentPolicy,
      currentShiftOtOption,
      internalCalendarDayType,
    },
  )

  const verification = verifyAttendanceAgainstOT({
    otRequest: verificationOtRequest,
    requestedEmployees: sourceEmployees,
    approvedEmployees: sourceEmployees,
    attendanceRecords,
  })

  const originalMap = buildEmployeeOriginalMap(sourceEmployees)
  const verificationMap = buildVerificationPaymentMap(verification)

  const verifiedEmployees = sourceEmployees.map((employee) => {
    const key = employeePaymentKey(employee)
    const original = originalMap.get(key) || employee
    const verificationRow = verificationMap.get(key)

    if (!verificationRow) {
      return mergeEmployeeWithVerification(original, {
        otResult: 'MISMATCH',
        otResultReason: 'No attendance verification result found',
        messageKey: 'payment.attendance.no_verification_result',
        roundedOtMinutes: 0,
      })
    }

    return mergeEmployeeWithVerification(original, verificationRow)
  })

  return {
    otRequest: verificationOtRequest,
    verification,
    verifiedEmployees,
  }
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = safeNonNegativeNumber(value, 0)

    if (number > 0) return number
  }

  return 0
}

function firstNonNegativeNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue

    const number = Number(value)

    if (Number.isFinite(number) && number >= 0) return number
  }

  return 0
}

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s(value))
}

function timeToMinutes(value) {
  if (!isHHmm(value)) return 0

  const [hours, minutes] = s(value).split(':').map(Number)
  return hours * 60 + minutes
}

function calculateRawTimeWindowMinutes(startTime, endTime) {
  if (!isHHmm(startTime) || !isHHmm(endTime)) return 0

  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  let minutes = end - start

  if (minutes <= 0) {
    minutes += 1440
  }

  return minutes
}

function calculatePaidTimeWindowMinutes(startTime, endTime, breakMinutes = 0) {
  const rawMinutes = calculateRawTimeWindowMinutes(startTime, endTime)
  const safeBreakMinutes = safeNonNegativeNumber(breakMinutes, 0)

  if (rawMinutes <= 0) return 0

  return Math.max(0, rawMinutes - safeBreakMinutes)
}

function resolveEmployeeRequestStartTime(employee = {}, otRequest = {}) {
  return s(
    employee.requestStartTime ||
      employee.startTime ||
      employee.customStartTime ||
      employee.fixedStartTime ||
      employee.expectedOtStartTime ||
      otRequest.requestStartTime ||
      otRequest.startTime ||
      otRequest.expectedOtStartTime,
  )
}

function resolveEmployeeRequestEndTime(employee = {}, otRequest = {}) {
  return s(
    employee.requestEndTime ||
      employee.endTime ||
      employee.customEndTime ||
      employee.fixedEndTime ||
      employee.expectedOtEndTime ||
      otRequest.requestEndTime ||
      otRequest.endTime ||
      otRequest.expectedOtEndTime,
  )
}

function resolveEmployeeBreakMinutes(employee = {}, otRequest = {}) {
  return firstNonNegativeNumber(
    employee.breakMinutes,
    employee.customBreakMinutes,
    employee.requestBreakMinutes,
    employee.approvedBreakMinutes,
    otRequest.breakMinutes,
  )
}

function resolveEmployeeRequestedMinutes(employee = {}, otRequest = {}) {
  const directMinutes = firstPositiveNumber(
    employee.requestedMinutes,
    employee.requestedOtMinutes,
    employee.customRequestedMinutes,
    employee.approvedRequestedMinutes,
    employee.totalRequestPaidMinutes,
    employee.totalPaidMinutes,
    employee.requestPaidMinutes,
    employee.totalMinutes,
  )

  if (directMinutes > 0) return directMinutes

  const startTime = resolveEmployeeRequestStartTime(employee, otRequest)
  const endTime = resolveEmployeeRequestEndTime(employee, otRequest)
  const breakMinutes = resolveEmployeeBreakMinutes(employee, otRequest)

  const calculatedMinutes = calculatePaidTimeWindowMinutes(
    startTime,
    endTime,
    breakMinutes,
  )

  if (calculatedMinutes > 0) return calculatedMinutes

  return resolveRequestPaidMinutes(otRequest)
}

function capPayableMinutesByEmployeeRequest(minutes, employee = {}, otRequest = {}) {
  const payableMinutes = safeNonNegativeInt(minutes, 0)
  const employeeRequestedMinutes = safeNonNegativeInt(
    resolveEmployeeRequestedMinutes(employee, otRequest),
    0,
  )

  if (payableMinutes <= 0) return 0
  if (employeeRequestedMinutes <= 0) return payableMinutes

  return Math.min(payableMinutes, employeeRequestedMinutes)
}

function resolveEmployeePaidMinutes(employee = {}, otRequest = {}) {
  const payableMinutes = firstPositiveNumber(
    employee.approvedPaidMinutes,
    employee.payableMinutes,
    employee.paidMinutes,
    employee.verifiedPayableMinutes,
    employee.finalPayableMinutes,
    employee.paymentPayableMinutes,
    employee.policyPaidMinutes,
    employee.policyPayableMinutes,
    employee.calculatedPaidMinutes,
    employee.calculatedPayableMinutes,
    employee.attendancePaidMinutes,
    employee.attendancePayableMinutes,
  )

  return capPayableMinutesByEmployeeRequest(payableMinutes, employee, otRequest)
}

function buildSalaryInfo(salaryMap, employeeNo) {
  const key = normalizeEmployeeNo(employeeNo)
  const info = salaryMap.get(key)

  if (!info) {
    return {
      hasSalary: false,
      monthlySalary: 0,
      salaryEmployeeName: '',
      salaryRowNo: null,
    }
  }

  return {
    hasSalary: true,
    monthlySalary: safeNonNegativeNumber(info.salary, 0),
    salaryEmployeeName: s(info.name),
    salaryRowNo: Number(info.rowNo || 0) || null,
  }
}

function roundByMode(amount, roundingUnit, roundingMode) {
  const value = Math.round(safeNonNegativeNumber(amount, 0))
  const unit = Math.round(safePositiveNumber(roundingUnit, 1))
  const mode = normalizeRoundingMode(roundingMode)

  if (mode === 'NONE' || unit <= 1) return value

  const divided = value / unit

  if (mode === 'FLOOR') return Math.floor(divided) * unit
  if (mode === 'ROUND') return Math.round(divided) * unit

  return Math.ceil(divided) * unit
}

function buildDenominationBreakdown(amount, denominations = []) {
  const sortedDenominations = normalizeDenominations(denominations)
  let remaining = Math.round(safeNonNegativeNumber(amount, 0))

  const breakdown = {}

  for (const denomination of sortedDenominations) {
    const quantity = Math.floor(remaining / denomination)

    breakdown[String(denomination)] = quantity
    remaining -= quantity * denomination
  }

  return breakdown
}

function calculateExchangeAmount(amount, exchangeRate) {
  const amountUsd = roundAmount(amount, 2)
  const amountKhrRaw = Math.round(amountUsd * safePositiveNumber(exchangeRate.rate, 1))
  const amountKhrRounded = roundByMode(
    amountKhrRaw,
    exchangeRate.roundingUnit,
    exchangeRate.roundingMode,
  )

  return {
    amountUsd,
    exchangeRate: exchangeRate.rate,
    amountKhrRaw,
    amountKhrRounded,
    khrRoundDifference: amountKhrRounded - amountKhrRaw,
    khrBreakdown: buildDenominationBreakdown(
      amountKhrRounded,
      exchangeRate.denominations,
    ),
  }
}

function normalizeAllowancePolicy(policy = {}) {
  return {
    id: getObjectIdString(policy.id || policy._id),
    code: upper(policy.code),
    name: s(policy.name),
    allowanceType: upper(policy.allowanceType || 'FOOD'),
    triggerType: upper(policy.triggerType || 'OT_MINUTES'),
    minOtMinutes: safeNonNegativeInt(policy.minOtMinutes, 0),
    amount: safeNonNegativeNumber(policy.amount, 0),
    currency: upper(policy.currency || 'KHR'),
    applyPer: upper(policy.applyPer || 'EMPLOYEE_PER_DAY'),
  }
}

function buildPaymentDayKey(item = {}) {
  const employeeKey = item.employeeId || item.employeeNo
  const dateKey = s(item.otDate)

  if (!employeeKey || !dateKey) return ''

  return `${employeeKey}::${dateKey}`
}

function calculateAllowanceAmount(policy = {}, exchangeRate = {}) {
  const amount = safeNonNegativeNumber(policy.amount, 0)
  const currency = upper(policy.currency || 'KHR')

  if (amount <= 0) {
    return {
      allowanceAmountUsd: 0,
      allowanceAmountKhrRaw: 0,
      allowanceAmountKhrRounded: 0,
      allowanceKhrBreakdown: buildDenominationBreakdown(0, exchangeRate.denominations),
    }
  }

  if (currency === 'USD') {
    const exchange = calculateExchangeAmount(amount, exchangeRate)

    return {
      allowanceAmountUsd: exchange.amountUsd,
      allowanceAmountKhrRaw: exchange.amountKhrRaw,
      allowanceAmountKhrRounded: exchange.amountKhrRounded,
      allowanceKhrBreakdown: exchange.khrBreakdown,
    }
  }

  const amountKhr = Math.round(amount)

  return {
    allowanceAmountUsd: 0,
    allowanceAmountKhrRaw: amountKhr,
    allowanceAmountKhrRounded: amountKhr,
    allowanceKhrBreakdown: buildDenominationBreakdown(amountKhr, exchangeRate.denominations),
  }
}

function buildAllowanceMatch(policy = {}, exchangeRate = {}) {
  const calculated = calculateAllowanceAmount(policy, exchangeRate)

  return {
    policyId: policy.id,
    code: policy.code,
    name: policy.name,
    allowanceType: policy.allowanceType,
    triggerType: policy.triggerType,
    minOtMinutes: policy.minOtMinutes,
    amount: policy.amount,
    currency: policy.currency,
    applyPer: policy.applyPer,

    ...calculated,
  }
}

function emptyAllowanceFields(exchangeRate = {}) {
  return {
    allowancePolicies: [],
    allowanceCount: 0,

    allowanceAmountUsd: 0,
    allowanceAmountKhrRaw: 0,
    allowanceAmountKhrRounded: 0,
    allowanceKhrBreakdown: emptyBreakdown(exchangeRate.denominations),

    totalPayableKhrRaw: 0,
    totalPayableKhrRounded: 0,
    totalPayableKhrBreakdown: emptyBreakdown(exchangeRate.denominations),
  }
}

function applyAllowancePoliciesToItems(items = [], policies = [], exchangeRate = {}, formula = {}) {
  const normalizedPolicies = (Array.isArray(policies) ? policies : [])
    .map(normalizeAllowancePolicy)
    .filter((policy) => policy.id && policy.triggerType === 'OT_MINUTES')

  const nextItems = items.map((item) => ({
    ...item,
    ...emptyAllowanceFields(exchangeRate),
  }))

  if (!normalizedPolicies.length || !nextItems.length) {
    return nextItems.map((item) => ({
      ...item,
      totalPayableKhrRaw: safeNonNegativeNumber(item.amountKhrRaw, 0),
      totalPayableKhrRounded: safeNonNegativeNumber(item.amountKhrRounded, 0),
      totalPayableKhrBreakdown: buildDenominationBreakdown(
        safeNonNegativeNumber(item.amountKhrRounded, 0),
        exchangeRate.denominations,
      ),
    }))
  }

  const dayGroups = new Map()

  nextItems.forEach((item, index) => {
    const key = buildPaymentDayKey(item)
    if (!key) return

    const existing = dayGroups.get(key) || {
      key,
      indexes: [],
      totalPayableMinutes: 0,
    }

    existing.indexes.push(index)
    existing.totalPayableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)

    dayGroups.set(key, existing)
  })

  const allowanceAppliedDayKeys = new Set()

  normalizedPolicies.forEach((policy) => {
    dayGroups.forEach((group) => {
      if (allowanceAppliedDayKeys.has(group.key)) return
      if (!isAllowanceAllowedByFormula({ formula, payableMinutes: group.totalPayableMinutes })) return
      if (group.totalPayableMinutes < policy.minOtMinutes) return
      if (!group.indexes.length) return

      const firstIndex = group.indexes[0]
      const allowance = buildAllowanceMatch(policy, exchangeRate)
      const current = nextItems[firstIndex]

      nextItems[firstIndex] = mergeItemAllowance(current, allowance, exchangeRate)
      allowanceAppliedDayKeys.add(group.key)
    })
  })

  return nextItems.map((item) => finalizeItemPayableKhr(item, exchangeRate))
}

function mergeItemAllowance(item = {}, allowance = {}, exchangeRate = {}) {
  const allowancePolicies = Array.isArray(item.allowancePolicies)
    ? [...item.allowancePolicies]
    : []

  allowancePolicies.push(allowance)

  const allowanceAmountUsd =
    safeNonNegativeNumber(item.allowanceAmountUsd, 0) +
    safeNonNegativeNumber(allowance.allowanceAmountUsd, 0)

  const allowanceAmountKhrRaw =
    safeNonNegativeNumber(item.allowanceAmountKhrRaw, 0) +
    safeNonNegativeNumber(allowance.allowanceAmountKhrRaw, 0)

  const allowanceAmountKhrRounded =
    safeNonNegativeNumber(item.allowanceAmountKhrRounded, 0) +
    safeNonNegativeNumber(allowance.allowanceAmountKhrRounded, 0)

  const allowanceKhrBreakdown = addBreakdown(
    item.allowanceKhrBreakdown || emptyBreakdown(exchangeRate.denominations),
    allowance.allowanceKhrBreakdown,
  )

  return {
    ...item,
    allowancePolicies,
    allowanceCount: allowancePolicies.length,
    allowanceAmountUsd: roundAmount(allowanceAmountUsd, 2),
    allowanceAmountKhrRaw,
    allowanceAmountKhrRounded,
    allowanceKhrBreakdown,
  }
}

function finalizeItemPayableKhr(item = {}, exchangeRate = {}) {
  const totalPayableKhrRaw =
    safeNonNegativeNumber(item.amountKhrRaw, 0) +
    safeNonNegativeNumber(item.allowanceAmountKhrRaw, 0)

  const totalPayableKhrRounded =
    safeNonNegativeNumber(item.amountKhrRounded, 0) +
    safeNonNegativeNumber(item.allowanceAmountKhrRounded, 0)

  return {
    ...item,
    totalPayableKhrRaw,
    totalPayableKhrRounded,
    totalPayableKhrBreakdown: buildDenominationBreakdown(
      totalPayableKhrRounded,
      exchangeRate.denominations,
    ),
  }
}

function buildPaymentItem({ otRequest, employee, formula, salaryInfo, exchangeRate }) {
  const employeeNo = normalizeEmployeeNo(employee.employeeNo || employee.employeeCode)
  const employeeName = s(employee.employeeName || employee.name)

  const dayType = normalizeDayType(otRequest.dayType)

  const monthlySalary = safeNonNegativeNumber(salaryInfo.monthlySalary, 0)
  const hourlyRate = getHourlyRate(monthlySalary, formula)

  const requestStartTime = resolveEmployeeRequestStartTime(employee, otRequest)
  const requestEndTime = resolveEmployeeRequestEndTime(employee, otRequest)
  const requestedMinutes = resolveEmployeeRequestedMinutes(employee, otRequest)
  const breakMinutes = resolveEmployeeBreakMinutes(employee, otRequest)
  const requestPaidMinutes = requestedMinutes || resolveRequestPaidMinutes(otRequest)

  const payableMinutes = resolveEmployeePaidMinutes(employee, otRequest)
  const hasAttendancePolicyPayable = payableMinutes > 0
  const amountInfo = calculateProgressiveHourRuleAmount({
    hourlyRate,
    formula,
    dayType,
    payableMinutes,
  })
  const multiplier = amountInfo.effectiveMultiplier
  const hourRule = amountInfo.hourRule

  const payableHours = payableMinutes / 60
  const rawAmount = amountInfo.rawAmount

  const amount = salaryInfo.hasSalary
    ? roundAmount(rawAmount, formula.roundingDecimals)
    : 0

  const exchange = calculateExchangeAmount(amount, exchangeRate)

  return {
    paymentRowKey: buildPaymentRowKey(otRequest, employee),
    otRequestId: getObjectIdString(otRequest._id || otRequest.id),
    requestNo: s(otRequest.requestNo),

    otDate: s(otRequest.otDate),
    otDateDisplay: formatYmdToDmy(otRequest.otDate),

    dayType,
    status: normalizeStatus(otRequest.status),

    storedDayType: upper(otRequest.storedDayType),
    internalCalendarDayType: upper(otRequest.internalCalendarDayType),
    dayTypeMismatch: otRequest.dayTypeMismatch === true,

    requesterEmployeeId: getObjectIdString(otRequest.requesterEmployeeId),
    requesterEmployeeNo: normalizeEmployeeNo(otRequest.requesterEmployeeNo),
    requesterName: s(otRequest.requesterName),

    employeeId: getObjectIdString(employee.employeeId),
    employeeNo,
    employeeName,

    departmentId: getObjectIdString(employee.departmentId),
    departmentCode: upper(employee.departmentCode),
    departmentName: s(employee.departmentName),

    positionId: getObjectIdString(employee.positionId),
    positionCode: upper(employee.positionCode),
    positionName: s(employee.positionName),

    lineId: getObjectIdString(employee.lineId),
    lineCode: upper(employee.lineCode),
    lineName: s(employee.lineName),

    shiftId: getObjectIdString(otRequest.shiftId || employee.shiftId),
    shiftCode: upper(otRequest.shiftCode || employee.shiftCode),
    shiftName: s(otRequest.shiftName || employee.shiftName),
    shiftType: upper(otRequest.shiftType || employee.shiftType),

    shiftOtOptionId: getObjectIdString(otRequest.shiftOtOptionId),
    shiftOtOptionLabel: s(otRequest.shiftOtOptionLabel),
    shiftOtOptionTimingMode: upper(otRequest.shiftOtOptionTimingMode),

    requestStartTime,
    requestEndTime,

    requestedMinutes,
    breakMinutes,
    requestPaidMinutes,

    attendanceRecordId: getObjectIdString(employee.attendanceRecordId),
    attendanceImportId: getObjectIdString(employee.attendanceImportId),
    attendanceDate: s(employee.attendanceDate),
    attendanceStatus: upper(employee.attendanceStatus),
    clockIn: s(employee.clockIn),
    clockOut: s(employee.clockOut),

    actualOtMinutes: safeNonNegativeNumber(employee.actualOtMinutes, 0),
    eligibleOtMinutes: safeNonNegativeNumber(employee.eligibleOtMinutes, 0),
    roundedOtMinutes: safeNonNegativeNumber(employee.roundedOtMinutes, 0),

    payableMinutes,
    payableHours: roundAmount(payableHours, 4),

    otResult: upper(employee.otResult),
    otResultReason: s(employee.otResultReason),
    otResultReasonKey: s(employee.otResultReasonKey),
    paymentMessageKey: s(employee.paymentMessageKey),
    paymentBlockedReason: s(employee.paymentBlockedReason),

    policyCode: s(employee.policyCode),
    policyName: s(employee.policyName),
    policyRoundMethod: s(employee.policyRoundMethod),
    policyRoundUnitMinutes: safeNonNegativeNumber(employee.policyRoundUnitMinutes, 0),
    policyMinEligibleMinutes: safeNonNegativeNumber(employee.policyMinEligibleMinutes, 0),
    policyGraceAfterShiftEndMinutes: safeNonNegativeNumber(
      employee.policyGraceAfterShiftEndMinutes,
      0,
    ),

    monthlySalary,
    hourlyRate: roundAmount(hourlyRate, formula.roundingDecimals + 4),
    multiplier: roundAmount(multiplier, 6),
    multiplierSource: amountInfo.multiplierSource,
    amountCalculationMode: amountInfo.multiplierSource,
    progressiveHourSegments: amountInfo.segments.map((segment) => ({
      label: segment.label,
      hours: segment.hours,
      multiplier: segment.multiplier,
      amount: roundAmount(segment.amount, formula.roundingDecimals),
    })),
    progressiveHourFormulaText: amountInfo.segments
      .map((segment) => `${segment.hours}h × ${segment.multiplier}x`)
      .join(' + '),
    hourRuleLabel: s(hourRule?.label),
    hourRuleMinHours: hourRule ? safeNonNegativeNumber(hourRule.minHours, 0) : null,
    hourRuleMaxHours: hourRule?.maxHours ?? null,
    allowanceEligibleByFormula: isAllowanceAllowedByFormula({ formula, payableMinutes }),

    currency: formula.currency,
    amount,

    amountUsd: exchange.amountUsd,
    exchangeRateId: null,
    exchangeRateCode: exchangeRate.code,
    exchangeRateName: exchangeRate.name,
    exchangeRateSource: exchangeRate.source || 'MANUAL_INPUT',
    exchangeRate: exchange.exchangeRate,
    amountKhrRaw: exchange.amountKhrRaw,
    amountKhrRounded: exchange.amountKhrRounded,
    khrRoundDifference: exchange.khrRoundDifference,
    khrBreakdown: exchange.khrBreakdown,

    paymentCurrency: exchangeRate.toCurrency,
    roundingUnit: exchangeRate.roundingUnit,
    roundingMode: exchangeRate.roundingMode,

    hasSalary: salaryInfo.hasSalary,
    hasAttendancePolicyPayable,
    paymentEligible: salaryInfo.hasSalary && hasAttendancePolicyPayable,
    salaryEmployeeName: salaryInfo.salaryEmployeeName,
    salaryRowNo: salaryInfo.salaryRowNo,

    formulaId: formula.id,
    formulaCode: formula.code,
    formulaName: formula.name,
  }
}

function buildMissingPayableIssue(otRequest = {}, employee = {}) {
  return {
    requestNo: s(otRequest.requestNo),
    otDate: s(otRequest.otDate),
    employeeNo: normalizeEmployeeNo(employee.employeeNo || employee.employeeCode),
    employeeName: s(employee.employeeName || employee.name),
    departmentName: s(employee.departmentName),
    positionName: s(employee.positionName),
    lineName: s(employee.lineName),
    otResult: upper(employee.otResult),
    reason: s(
      employee.paymentBlockedReason ||
        employee.otResultReason ||
        'No attendance/policy payable minutes found',
    ),
  }
}

function buildPayableWarningIssue(otRequest = {}, employee = {}) {
  return {
    requestNo: s(otRequest.requestNo),
    otDate: s(otRequest.otDate),
    employeeNo: normalizeEmployeeNo(employee.employeeNo || employee.employeeCode),
    employeeName: s(employee.employeeName || employee.name),
    departmentName: s(employee.departmentName),
    positionName: s(employee.positionName),
    lineName: s(employee.lineName),
    requestStatus: normalizeStatus(otRequest.status),
    otResult: upper(employee.otResult),
    payableMinutes: resolveEmployeePaidMinutes(employee),
    reason: s(
      employee.otResultReason ||
        'Payable minutes were calculated, but verification result is not exact MATCH',
    ),
  }
}

function buildUnapprovedRequestPaymentIssue(otRequest = {}, employee = {}) {
  const requestStatus = normalizeStatus(otRequest.status) || 'UNKNOWN'

  return {
    requestNo: s(otRequest.requestNo),
    otDate: s(otRequest.otDate),
    employeeNo: normalizeEmployeeNo(employee.employeeNo || employee.employeeCode),
    employeeName: s(employee.employeeName || employee.name),
    departmentName: s(employee.departmentName),
    positionName: s(employee.positionName),
    lineName: s(employee.lineName),
    requestStatus,
    otResult: upper(employee.otResult),
    payableMinutes: resolveEmployeePaidMinutes(employee),
    reason: `OT request status is ${requestStatus}. Payment is allowed by current setup without final approval.`,
  }
}

function buildApprovalRequiredPaymentIssue(otRequest = {}, employee = {}) {
  const requestStatus = normalizeStatus(otRequest.status) || 'UNKNOWN'
  const requestedMinutes = resolveEmployeeRequestedMinutes(employee, otRequest)

  return {
    requestNo: s(otRequest.requestNo),
    otDate: s(otRequest.otDate),
    employeeNo: normalizeEmployeeNo(employee.employeeNo || employee.employeeCode),
    employeeName: s(employee.employeeName || employee.name),
    departmentName: s(employee.departmentName),
    positionName: s(employee.positionName),
    lineName: s(employee.lineName),
    requestStatus,
    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),
    reason: `Payment skipped because final OT approval is required. Current request status is ${requestStatus}.`,
  }
}

function buildApprovalRequiredAuditRow(otRequest = {}, employee = {}) {
  const requestedMinutes = resolveEmployeeRequestedMinutes(employee, otRequest)

  return {
    paymentRowKey: buildPaymentRowKey(otRequest, employee),
    requestNo: s(otRequest.requestNo),
    otRequestId: getObjectIdString(otRequest._id || otRequest.id),
    otDate: s(otRequest.otDate),
    otDateDisplay: formatYmdToDmy(otRequest.otDate),
    requestStatus: normalizeStatus(otRequest.status),

    employeeId: getObjectIdString(employee.employeeId),
    employeeNo: normalizeEmployeeNo(employee.employeeNo || employee.employeeCode),
    employeeName: s(employee.employeeName || employee.name),
    departmentName: s(employee.departmentName),
    positionName: s(employee.positionName),
    lineCode: s(employee.lineCode),
    lineName: s(employee.lineName),

    dayType: normalizeDayType(otRequest.dayType),
    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),
    attendanceStatus: 'NOT_CALCULATED',
    clockIn: '',
    clockOut: '',
    actualOtMinutes: 0,
    actualOtHours: 0,
    eligibleOtMinutes: 0,
    roundedOtMinutes: 0,
    payableMinutes: 0,
    payableHours: 0,
    otResult: 'NOT_CALCULATED',
    otResultReason: 'Skipped because final OT approval is required.',
    hasSalary: false,
    monthlySalary: 0,
    hourlyRate: 0,
    rateFormula: '',
    amountUsd: 0,
    allowanceAmountUsd: 0,
    totalUsd: 0,
    totalKhr: 0,
    paymentStatus: 'Not paid',
    issueReason: `Payment skipped because final OT approval is required. Current request status is ${normalizeStatus(otRequest.status) || 'UNKNOWN'}.`,
  }
}

function buildApprovalRequiredExclusions(otRequests = []) {
  const issues = []
  const auditRows = []

  for (const otRequest of Array.isArray(otRequests) ? otRequests : []) {
    const employees = getEffectiveApprovedEmployeesForVerification(otRequest)

    for (const employee of employees) {
      const employeeNo = normalizeEmployeeNo(employee.employeeNo || employee.employeeCode)
      if (!employeeNo) continue

      issues.push(buildApprovalRequiredPaymentIssue(otRequest, employee))
      auditRows.push(buildApprovalRequiredAuditRow(otRequest, employee))
    }
  }

  return { issues, auditRows }
}


function buildPaymentRowKey(otRequest = {}, employee = {}) {
  const requestKey = s(otRequest.requestNo || otRequest.id || otRequest._id)
  const dateKey = s(otRequest.otDate)
  const employeeNo = normalizeEmployeeNo(employee.employeeNo || employee.employeeCode)
  const employeeId = getObjectIdString(employee.employeeId)
  const employeeKey = employeeId || employeeNo

  return [requestKey, dateKey, employeeKey].filter(Boolean).join('::')
}

function minutesToHours(minutes = 0) {
  return roundAmount(safeNonNegativeNumber(minutes, 0) / 60, 4)
}

function resolveAuditPaymentStatus({ requestedMinutes = 0, payableMinutes = 0, hasSalary = true }) {
  const requested = safeNonNegativeInt(requestedMinutes, 0)
  const payable = safeNonNegativeInt(payableMinutes, 0)

  if (!hasSalary || payable <= 0) return 'Not paid'
  if (requested > 0 && payable < requested) return 'Partial paid'

  return 'Paid'
}

function buildAuditIssueText({ otRequest = {}, employee = {}, salaryInfo = {}, requestedMinutes = 0, payableMinutes = 0 }) {
  const issues = []
  const requestStatus = normalizeStatus(otRequest.status)
  const otResult = upper(employee.otResult)
  const requested = safeNonNegativeInt(requestedMinutes, 0)
  const payable = safeNonNegativeInt(payableMinutes, 0)

  if (salaryInfo?.hasSalary === false) {
    issues.push('Salary not found in uploaded salary Excel')
  }

  if (shouldWarnPaymentWithoutApproval(otRequest)) {
    issues.push(`OT request status is ${requestStatus || 'UNKNOWN'}. Payment is allowed by current setup without final approval.`)
  }

  if (payable <= 0) {
    issues.push(
      s(
        employee.paymentBlockedReason ||
          employee.otResultReason ||
          employee.attendanceStatus ||
          'No payable OT minutes found',
      ),
    )
  } else {
    if (requested > 0 && payable < requested) {
      issues.push('Worked less than requested. Paid hours were capped by attendance/policy result.')
    }

    if (otResult && otResult !== 'MATCH') {
      issues.push(
        s(
          employee.otResultReason ||
            'Payable minutes were calculated, but attendance verification result is not exact MATCH',
        ),
      )
    }
  }

  return Array.from(new Set(issues.filter(Boolean))).join(' | ')
}

function buildPaymentAuditRow({ otRequest = {}, employee = {}, salaryInfo = {}, item = null }) {
  const requestedMinutes = resolveEmployeeRequestedMinutes(employee, otRequest)
  const payableMinutes = item
    ? safeNonNegativeInt(item.payableMinutes, 0)
    : resolveEmployeePaidMinutes(employee, otRequest)

  const hasSalary = item ? item.hasSalary === true : salaryInfo?.hasSalary === true
  const paymentStatus = resolveAuditPaymentStatus({
    requestedMinutes,
    payableMinutes,
    hasSalary,
  })

  return {
    paymentRowKey: buildPaymentRowKey(otRequest, employee),

    requestNo: s(otRequest.requestNo),
    otRequestId: getObjectIdString(otRequest._id || otRequest.id),
    otDate: s(otRequest.otDate),
    otDateDisplay: formatYmdToDmy(otRequest.otDate),
    requestStatus: normalizeStatus(otRequest.status),

    employeeId: getObjectIdString(employee.employeeId),
    employeeNo: normalizeEmployeeNo(employee.employeeNo || employee.employeeCode),
    employeeName: s(employee.employeeName || employee.name),

    departmentName: s(employee.departmentName),
    positionName: s(employee.positionName),
    lineCode: upper(employee.lineCode),
    lineName: s(employee.lineName),

    requestedMinutes,
    requestedHours: minutesToHours(requestedMinutes),

    attendanceStatus: upper(employee.attendanceStatus),
    clockIn: s(employee.clockIn),
    clockOut: s(employee.clockOut),
    actualOtMinutes: safeNonNegativeInt(employee.actualOtMinutes, 0),
    actualOtHours: minutesToHours(employee.actualOtMinutes),
    eligibleOtMinutes: safeNonNegativeInt(employee.eligibleOtMinutes, 0),
    roundedOtMinutes: safeNonNegativeInt(employee.roundedOtMinutes, 0),

    payableMinutes,
    payableHours: minutesToHours(payableMinutes),

    otResult: upper(employee.otResult),
    otResultReason: s(employee.otResultReason),

    hasSalary,
    monthlySalary: item ? safeNonNegativeNumber(item.monthlySalary, 0) : safeNonNegativeNumber(salaryInfo.monthlySalary, 0),
    hourlyRate: item ? safeNonNegativeNumber(item.hourlyRate, 0) : 0,

    rateFormula: s(item?.progressiveHourFormulaText),
    amountUsd: item ? safeNonNegativeNumber(item.amountUsd, 0) : 0,
    allowanceAmountUsd: item ? safeNonNegativeNumber(item.allowanceAmountUsd, 0) : 0,
    totalUsd: item ? roundAmount(safeNonNegativeNumber(item.amountUsd, 0) + safeNonNegativeNumber(item.allowanceAmountUsd, 0), 2) : 0,
    totalKhr: item ? safeNonNegativeNumber(item.totalPayableKhrRounded, 0) : 0,

    paymentStatus,
    issueReason: buildAuditIssueText({
      otRequest,
      employee,
      salaryInfo: { ...salaryInfo, hasSalary },
      requestedMinutes,
      payableMinutes,
    }),
  }
}

function mergeAuditRowWithPaymentItem(row = {}, item = {}) {
  const requestedMinutes = safeNonNegativeInt(row.requestedMinutes, 0)
  const payableMinutes = safeNonNegativeInt(item.payableMinutes, row.payableMinutes)
  const hasSalary = item.hasSalary === true

  return {
    ...row,
    payableMinutes,
    payableHours: minutesToHours(payableMinutes),
    hasSalary,
    monthlySalary: safeNonNegativeNumber(item.monthlySalary, row.monthlySalary),
    hourlyRate: safeNonNegativeNumber(item.hourlyRate, row.hourlyRate),
    rateFormula: s(item.progressiveHourFormulaText || row.rateFormula),
    amountUsd: safeNonNegativeNumber(item.amountUsd, 0),
    allowanceAmountUsd: safeNonNegativeNumber(item.allowanceAmountUsd, 0),
    totalUsd: roundAmount(safeNonNegativeNumber(item.amountUsd, 0) + safeNonNegativeNumber(item.allowanceAmountUsd, 0), 2),
    totalKhr: safeNonNegativeNumber(item.totalPayableKhrRounded, 0),
    paymentStatus: resolveAuditPaymentStatus({
      requestedMinutes,
      payableMinutes,
      hasSalary,
    }),
  }
}

function shouldWarnPaymentWithoutApproval(otRequest = {}) {
  return normalizeStatus(otRequest.status) !== 'APPROVED'
}

async function buildPaymentItems({
  otRequests,
  salaryMap,
  formula,
  exchangeRate,
  allowancePolicies = [],
  onProgress,
}) {
  const items = []
  const auditRows = []
  const missingSalaryEmployeesMap = new Map()
  const missingPayableEmployeesMap = new Map()
  const payableWarningEmployeesMap = new Map()
  const verificationSummaries = []

  const totalRequests = Array.isArray(otRequests) ? otRequests.length : 0

  for (let requestIndex = 0; requestIndex < totalRequests; requestIndex += 1) {
    const rawOTRequest = otRequests[requestIndex]

    await reportPaymentProgress(
      onProgress,
      35 + Math.round((requestIndex / Math.max(totalRequests, 1)) * 45),
      'VERIFYING_ATTENDANCE',
      `Checking attendance ${requestIndex + 1}/${totalRequests}`,
      {
        processedRequests: requestIndex,
        totalRequests,
        currentRequestNo: s(rawOTRequest?.requestNo),
      },
    )

    const live = await buildLivePaymentVerification(rawOTRequest)
    const otRequest = live.otRequest
    const employees = live.verifiedEmployees

    verificationSummaries.push({
      requestNo: s(otRequest.requestNo),
      otDate: s(otRequest.otDate),
      dayType: upper(otRequest.dayType),
      storedDayType: upper(otRequest.storedDayType),
      internalCalendarDayType: upper(otRequest.internalCalendarDayType),
      dayTypeMismatch: otRequest.dayTypeMismatch === true,
      requestedEmployeeCount: Number(live.verification?.requestedEmployeeCount || 0),
      approvedEmployeeCount: Number(live.verification?.approvedEmployeeCount || 0),
      otMatchCount: Number(live.verification?.otMatchCount || 0),
      otMismatchCount: Number(live.verification?.otMismatchCount || 0),
      otPendingReviewCount: Number(live.verification?.otPendingReviewCount || 0),
    })

    for (const employee of employees) {
      const employeeNo = normalizeEmployeeNo(employee.employeeNo || employee.employeeCode)
      if (!employeeNo) continue

      const payableMinutes = resolveEmployeePaidMinutes(employee, otRequest)
      const salaryInfo = buildSalaryInfo(salaryMap, employeeNo)

      if (payableMinutes <= 0) {
        const key = `${s(otRequest.requestNo)}:${employeeNo}`

        if (!missingPayableEmployeesMap.has(key)) {
          missingPayableEmployeesMap.set(
            key,
            buildMissingPayableIssue(otRequest, employee),
          )
        }

        auditRows.push(
          buildPaymentAuditRow({
            otRequest,
            employee,
            salaryInfo,
          }),
        )

        continue
      }

      if (shouldWarnPaymentWithoutApproval(otRequest)) {
        const key = `${s(otRequest.requestNo)}:${employeeNo}:REQUEST_NOT_APPROVED`

        if (!payableWarningEmployeesMap.has(key)) {
          payableWarningEmployeesMap.set(
            key,
            buildUnapprovedRequestPaymentIssue(otRequest, employee),
          )
        }
      }

      if (upper(employee.otResult) !== 'MATCH') {
        const key = `${s(otRequest.requestNo)}:${employeeNo}:OT_RESULT`

        if (!payableWarningEmployeesMap.has(key)) {
          payableWarningEmployeesMap.set(
            key,
            buildPayableWarningIssue(otRequest, employee),
          )
        }
      }

      const item = buildPaymentItem({
        otRequest,
        employee,
        formula,
        salaryInfo,
        exchangeRate,
      })

      items.push(item)
      auditRows.push(
        buildPaymentAuditRow({
          otRequest,
          employee,
          salaryInfo,
          item,
        }),
      )

      if (!salaryInfo.hasSalary && !missingSalaryEmployeesMap.has(employeeNo)) {
        missingSalaryEmployeesMap.set(employeeNo, {
          employeeNo,
          employeeName: item.employeeName,
          departmentName: item.departmentName,
          positionName: item.positionName,
          lineName: item.lineName,
          reason: 'Salary not found in uploaded salary Excel',
        })
      }
    }
  }

  await reportPaymentProgress(
    onProgress,
    84,
    'APPLYING_ALLOWANCE',
    'Applying allowance and cash breakdown',
    {
      processedRequests: totalRequests,
      totalRequests,
      paymentRows: items.length,
    },
  )

  const itemsWithAllowance = applyAllowancePoliciesToItems(items, allowancePolicies, exchangeRate, formula)
  const itemByAuditKey = new Map(
    itemsWithAllowance
      .map((item) => [s(item.paymentRowKey), item])
      .filter(([key]) => Boolean(key)),
  )

  const finalizedAuditRows = auditRows.map((row) => {
    const item = itemByAuditKey.get(s(row.paymentRowKey))

    return item ? mergeAuditRowWithPaymentItem(row, item) : row
  })

  return {
    items: itemsWithAllowance,
    auditRows: finalizedAuditRows,
    missingSalaryEmployees: Array.from(missingSalaryEmployeesMap.values()),
    missingPayableEmployees: Array.from(missingPayableEmployeesMap.values()),
    payableWarningEmployees: Array.from(payableWarningEmployeesMap.values()),
    verificationSummaries,
  }
}

function emptyBreakdown(denominations = []) {
  return normalizeDenominations(denominations).reduce((acc, denomination) => {
    acc[String(denomination)] = 0
    return acc
  }, {})
}

function addBreakdown(target = {}, source = {}) {
  const result = { ...target }

  Object.entries(source || {}).forEach(([denomination, quantity]) => {
    result[String(denomination)] =
      safeNonNegativeNumber(result[String(denomination)], 0) +
      safeNonNegativeNumber(quantity, 0)
  })

  return result
}

function summarizePaymentItems(items = [], exchangeRate = {}) {
  const summaryByEmployeeMap = new Map()
  const summaryByDayTypeMap = new Map()

  let totalPayableMinutes = 0
  let totalAmount = 0
  let totalAmountUsd = 0
  let totalAmountKhrRaw = 0
  let totalAmountKhrRounded = 0
  let totalKhrRoundDifference = 0
  let totalKhrBreakdown = emptyBreakdown(exchangeRate.denominations)

  let totalAllowanceUsd = 0
  let totalAllowanceKhrRaw = 0
  let totalAllowanceKhrRounded = 0
  let totalAllowanceKhrBreakdown = emptyBreakdown(exchangeRate.denominations)

  let totalPayableKhrRaw = 0
  let totalPayableKhrRounded = 0
  let totalPayableKhrBreakdown = emptyBreakdown(exchangeRate.denominations)

  let payableItemCount = 0
  let missingSalaryItemCount = 0
  let allowanceItemCount = 0

  for (const item of items) {
    totalPayableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
    totalAmount += safeNonNegativeNumber(item.amount, 0)
    totalAmountUsd += safeNonNegativeNumber(item.amountUsd, 0)
    totalAmountKhrRaw += safeNonNegativeNumber(item.amountKhrRaw, 0)
    totalAmountKhrRounded += safeNonNegativeNumber(item.amountKhrRounded, 0)
    totalKhrRoundDifference += safeNonNegativeNumber(item.khrRoundDifference, 0)
    totalKhrBreakdown = addBreakdown(totalKhrBreakdown, item.khrBreakdown)

    totalAllowanceUsd += safeNonNegativeNumber(item.allowanceAmountUsd, 0)
    totalAllowanceKhrRaw += safeNonNegativeNumber(item.allowanceAmountKhrRaw, 0)
    totalAllowanceKhrRounded += safeNonNegativeNumber(item.allowanceAmountKhrRounded, 0)
    totalAllowanceKhrBreakdown = addBreakdown(
      totalAllowanceKhrBreakdown,
      item.allowanceKhrBreakdown,
    )

    totalPayableKhrRaw += safeNonNegativeNumber(item.totalPayableKhrRaw, 0)
    totalPayableKhrRounded += safeNonNegativeNumber(item.totalPayableKhrRounded, 0)
    totalPayableKhrBreakdown = addBreakdown(
      totalPayableKhrBreakdown,
      item.totalPayableKhrBreakdown,
    )

    if (safeNonNegativeNumber(item.allowanceAmountKhrRounded, 0) > 0) {
      allowanceItemCount += 1
    }

    if (item.hasSalary) payableItemCount += 1
    if (!item.hasSalary) missingSalaryItemCount += 1

    const employeeKey = item.employeeId || item.employeeNo

    if (employeeKey) {
      const existing = summaryByEmployeeMap.get(employeeKey) || {
        employeeId: item.employeeId,
        employeeNo: item.employeeNo,
        employeeName: item.employeeName,
        departmentName: item.departmentName,
        positionName: item.positionName,
        lineName: item.lineName,
        monthlySalary: item.monthlySalary,
        currency: item.currency,
        payableMinutes: 0,
        payableHours: 0,
        amount: 0,
        amountUsd: 0,
        amountKhrRaw: 0,
        amountKhrRounded: 0,
        khrRoundDifference: 0,
        khrBreakdown: emptyBreakdown(exchangeRate.denominations),

        allowanceAmountUsd: 0,
        allowanceAmountKhrRaw: 0,
        allowanceAmountKhrRounded: 0,
        allowanceKhrBreakdown: emptyBreakdown(exchangeRate.denominations),

        totalPayableKhrRaw: 0,
        totalPayableKhrRounded: 0,
        totalPayableKhrBreakdown: emptyBreakdown(exchangeRate.denominations),

        requestCount: 0,
        allowanceCount: 0,
      }

      existing.payableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
      existing.payableHours = roundAmount(existing.payableMinutes / 60, 4)
      existing.amount = roundAmount(existing.amount + safeNonNegativeNumber(item.amount, 0), 2)
      existing.amountUsd = roundAmount(
        existing.amountUsd + safeNonNegativeNumber(item.amountUsd, 0),
        2,
      )
      existing.amountKhrRaw += safeNonNegativeNumber(item.amountKhrRaw, 0)
      existing.amountKhrRounded += safeNonNegativeNumber(item.amountKhrRounded, 0)
      existing.khrRoundDifference += safeNonNegativeNumber(item.khrRoundDifference, 0)
      existing.khrBreakdown = addBreakdown(existing.khrBreakdown, item.khrBreakdown)

      existing.allowanceAmountUsd = roundAmount(
        existing.allowanceAmountUsd + safeNonNegativeNumber(item.allowanceAmountUsd, 0),
        2,
      )
      existing.allowanceAmountKhrRaw += safeNonNegativeNumber(item.allowanceAmountKhrRaw, 0)
      existing.allowanceAmountKhrRounded += safeNonNegativeNumber(
        item.allowanceAmountKhrRounded,
        0,
      )
      existing.allowanceKhrBreakdown = addBreakdown(
        existing.allowanceKhrBreakdown,
        item.allowanceKhrBreakdown,
      )

      existing.totalPayableKhrRaw += safeNonNegativeNumber(item.totalPayableKhrRaw, 0)
      existing.totalPayableKhrRounded += safeNonNegativeNumber(
        item.totalPayableKhrRounded,
        0,
      )
      existing.totalPayableKhrBreakdown = addBreakdown(
        existing.totalPayableKhrBreakdown,
        item.totalPayableKhrBreakdown,
      )

      existing.requestCount += 1
      existing.allowanceCount += safeNonNegativeNumber(item.allowanceCount, 0)

      summaryByEmployeeMap.set(employeeKey, existing)
    }

    const dayType = normalizeDayType(item.dayType)

    const existingDayType = summaryByDayTypeMap.get(dayType) || {
      dayType,
      payableMinutes: 0,
      payableHours: 0,
      amount: 0,
      amountUsd: 0,
      amountKhrRaw: 0,
      amountKhrRounded: 0,
      khrRoundDifference: 0,
      khrBreakdown: emptyBreakdown(exchangeRate.denominations),

      allowanceAmountUsd: 0,
      allowanceAmountKhrRaw: 0,
      allowanceAmountKhrRounded: 0,
      allowanceKhrBreakdown: emptyBreakdown(exchangeRate.denominations),

      totalPayableKhrRaw: 0,
      totalPayableKhrRounded: 0,
      totalPayableKhrBreakdown: emptyBreakdown(exchangeRate.denominations),

      requestCount: 0,
      allowanceCount: 0,
    }

    existingDayType.payableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
    existingDayType.payableHours = roundAmount(existingDayType.payableMinutes / 60, 4)
    existingDayType.amount = roundAmount(
      existingDayType.amount + safeNonNegativeNumber(item.amount, 0),
      2,
    )
    existingDayType.amountUsd = roundAmount(
      existingDayType.amountUsd + safeNonNegativeNumber(item.amountUsd, 0),
      2,
    )
    existingDayType.amountKhrRaw += safeNonNegativeNumber(item.amountKhrRaw, 0)
    existingDayType.amountKhrRounded += safeNonNegativeNumber(item.amountKhrRounded, 0)
    existingDayType.khrRoundDifference += safeNonNegativeNumber(item.khrRoundDifference, 0)
    existingDayType.khrBreakdown = addBreakdown(
      existingDayType.khrBreakdown,
      item.khrBreakdown,
    )

    existingDayType.allowanceAmountUsd = roundAmount(
      existingDayType.allowanceAmountUsd + safeNonNegativeNumber(item.allowanceAmountUsd, 0),
      2,
    )
    existingDayType.allowanceAmountKhrRaw += safeNonNegativeNumber(
      item.allowanceAmountKhrRaw,
      0,
    )
    existingDayType.allowanceAmountKhrRounded += safeNonNegativeNumber(
      item.allowanceAmountKhrRounded,
      0,
    )
    existingDayType.allowanceKhrBreakdown = addBreakdown(
      existingDayType.allowanceKhrBreakdown,
      item.allowanceKhrBreakdown,
    )

    existingDayType.totalPayableKhrRaw += safeNonNegativeNumber(item.totalPayableKhrRaw, 0)
    existingDayType.totalPayableKhrRounded += safeNonNegativeNumber(
      item.totalPayableKhrRounded,
      0,
    )
    existingDayType.totalPayableKhrBreakdown = addBreakdown(
      existingDayType.totalPayableKhrBreakdown,
      item.totalPayableKhrBreakdown,
    )

    existingDayType.requestCount += 1
    existingDayType.allowanceCount += safeNonNegativeNumber(item.allowanceCount, 0)

    summaryByDayTypeMap.set(dayType, existingDayType)
  }

  return {
    totalItemCount: items.length,
    payableItemCount,
    missingSalaryItemCount,
    allowanceItemCount,

    totalPayableMinutes,
    totalPayableHours: roundAmount(totalPayableMinutes / 60, 4),

    totalAmount: roundAmount(totalAmount, 2),
    totalAmountUsd: roundAmount(totalAmountUsd, 2),
    totalAmountKhrRaw,
    totalAmountKhrRounded,
    totalKhrRoundDifference,
    totalKhrBreakdown,

    totalAllowanceUsd: roundAmount(totalAllowanceUsd, 2),
    totalAllowanceKhrRaw,
    totalAllowanceKhrRounded,
    totalAllowanceKhrBreakdown,

    totalPayableKhrRaw,
    totalPayableKhrRounded,
    totalPayableKhrBreakdown,

    summaryByEmployee: Array.from(summaryByEmployeeMap.values()).sort((a, b) =>
      String(a.employeeNo).localeCompare(String(b.employeeNo)),
    ),

    summaryByDayType: Array.from(summaryByDayTypeMap.values()).sort((a, b) =>
      String(a.dayType).localeCompare(String(b.dayType)),
    ),
  }
}

async function buildPaymentPreview({
  salaryFile,
  fromDate,
  toDate,
  selectedDates,
  formulaId,
  exchangeRate,
  onProgress,
}) {
  validateSalaryFile(salaryFile)

  await reportPaymentProgress(
    onProgress,
    5,
    'VALIDATING',
    'Checking payment period and uploaded salary file',
  )

  const formula = await getFormulaOrThrow(formulaId)
  await reportPaymentProgress(onProgress, 12, 'FORMULA', 'Loaded payment formula')

  const manualExchangeRate = buildManualExchangeRate(exchangeRate, formula)
  await reportPaymentProgress(onProgress, 18, 'EXCHANGE_RATE', 'Prepared manual exchange rate')

  const allowancePolicies = await getActiveAllowancePoliciesForCalculation()
  await reportPaymentProgress(onProgress, 24, 'ALLOWANCE', 'Loaded allowance policies')

  const parsedSalary = parseSalaryExcel(salaryFile.buffer)
  await reportPaymentProgress(
    onProgress,
    30,
    'SALARY_FILE',
    `Read salary Excel: ${parsedSalary.validCount || 0} valid employees`,
    {
      salaryRows: parsedSalary.rowsCount || 0,
      salaryValidRows: parsedSalary.validCount || 0,
    },
  )

  const effectiveSelectedDates = resolveSelectedPaymentDates(fromDate, toDate, selectedDates)
  const paymentApprovalRule = await getPaymentApprovalRule()
  const candidateOtRequests = await fetchPaymentOTRequests(
    fromDate,
    toDate,
    effectiveSelectedDates,
  )
  const {
    eligibleRequests: otRequests,
    excludedUnapprovedRequests,
  } = splitOTRequestsForPayment(
    candidateOtRequests,
    paymentApprovalRule.paymentRequiresFinalApproval === true,
  )
  const approvalRequiredExclusions = buildApprovalRequiredExclusions(
    excludedUnapprovedRequests,
  )

  await reportPaymentProgress(
    onProgress,
    35,
    'OT_REQUESTS',
    paymentApprovalRule.paymentRequiresFinalApproval === true
      ? `Loaded ${candidateOtRequests.length} OT requests; ${excludedUnapprovedRequests.length} require final approval`
      : `Loaded ${candidateOtRequests.length} OT requests for payment`,
    {
      totalRequests: otRequests.length,
    },
  )

  const {
    items,
    missingSalaryEmployees,
    missingPayableEmployees,
    payableWarningEmployees,
    verificationSummaries,
    auditRows,
  } = await buildPaymentItems({
    otRequests,
    salaryMap: parsedSalary.salaryMap,
    formula,
    exchangeRate: manualExchangeRate,
    allowancePolicies,
    onProgress,
  })

  await reportPaymentProgress(
    onProgress,
    90,
    'SUMMARY',
    `Building payment summary for ${items.length} rows`,
    {
      paymentRows: items.length,
    },
  )

  const summary = summarizePaymentItems(items, manualExchangeRate)
  const generatedAt = new Date()

  await reportPaymentProgress(
    onProgress,
    95,
    'FINALIZING',
    'Finalizing payment preview',
    {
      paymentRows: items.length,
      totalRequests: otRequests.length,
    },
  )

  return {
    period: {
      fromDate: s(fromDate),
      fromDateDisplay: formatYmdToDmy(fromDate),
      toDate: s(toDate),
      toDateDisplay: formatYmdToDmy(toDate),
      selectedDates: effectiveSelectedDates,
      selectedDateCount: effectiveSelectedDates.length,
      excludedDateCount: Math.max(
        getDatesInRange(fromDate, toDate).length - effectiveSelectedDates.length,
        0,
      ),
    },

    generatedAt,
    generatedAtDisplayHm: formatDateTimeToDmyHm(generatedAt),

    formula,
    exchangeRate: manualExchangeRate,
    allowancePolicies,

    salaryFile: {
      originalName: s(salaryFile.originalname),
      mimeType: s(salaryFile.mimetype),
      size: Number(salaryFile.size || salaryFile.buffer?.length || 0),
      sheetName: s(parsedSalary.sheetName),
      rowsCount: parsedSalary.rowsCount,
      validCount: parsedSalary.validCount,
      invalidRows: parsedSalary.invalidRows,
      duplicateRows: parsedSalary.duplicateRows,
    },

    otRequestCount: otRequests.length,
    candidateOtRequestCount: candidateOtRequests.length,
    paymentApproval: {
      paymentRequiresFinalApproval: paymentApprovalRule.paymentRequiresFinalApproval === true,
      paymentApprovalMode: paymentApprovalRule.paymentApprovalMode,
      includedOtRequestCount: otRequests.length,
      excludedUnapprovedRequestCount: excludedUnapprovedRequests.length,
      excludedUnapprovedEmployeeCount: approvalRequiredExclusions.issues.length,
    },

    summary,
    items,
    auditRows: [...auditRows, ...approvalRequiredExclusions.auditRows],

    issues: {
      invalidSalaryRows: parsedSalary.invalidRows,
      duplicateSalaryRows: parsedSalary.duplicateRows,
      missingSalaryEmployees,
      missingPayableEmployees,
      payableWarningEmployees,
      approvalRequiredEmployees: approvalRequiredExclusions.issues,
      notPreparedRequests: [],
      verificationSummaries,
    },
  }
}

module.exports = {
  buildPaymentPreview,
}