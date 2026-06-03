// backend/src/modules/payment/services/paymentCalculation.service.js

const mongoose = require('mongoose')

const PaymentFormula = require('../models/PaymentFormula.model')

const OTRequest = require('../../ot/models/OTRequest')
const OTCalculationPolicy = require('../../ot/models/OTCalculationPolicy')
const ShiftOTOption = require('../../ot/models/ShiftOTOption')
const AttendanceRecord = require('../../attendance/models/AttendanceRecord')

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

function buildApprovedOTFilter(fromDate, toDate) {
  return {
    status: 'APPROVED',
    otDate: {
      $gte: s(fromDate),
      $lte: s(toDate),
    },
  }
}

async function fetchApprovedOTRequests(fromDate, toDate) {
  return OTRequest.find(buildApprovedOTFilter(fromDate, toDate))
    .sort({
      otDate: 1,
      requestNo: 1,
      createdAt: 1,
      _id: 1,
    })
    .lean()
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

function getEffectiveApprovedEmployeesForVerification(otRequest = {}) {
  if (Array.isArray(otRequest.approvedEmployees) && otRequest.approvedEmployees.length) {
    return otRequest.approvedEmployees
  }

  return Array.isArray(otRequest.requestedEmployees) ? otRequest.requestedEmployees : []
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

function buildAttendanceRecordFilterForOT(otRequest = {}) {
  const requestedEmployees = Array.isArray(otRequest.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const requestedEmployeeIds = normalizeObjectIdArray(
    requestedEmployees.map((item) => item?.employeeId),
  )

  const requestedEmployeeCodes = normalizeCodeArray(
    requestedEmployees.map((item) => item?.employeeCode || item?.employeeNo),
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

  if (result === 'PENDING_REVIEW') return 0

  return safeNonNegativeInt(
    verificationRow.roundedOtMinutes ??
      verificationRow.payableMinutes ??
      verificationRow.approvedPaidMinutes,
    0,
  )
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

  const attendanceRecords = await findAttendanceRecordsForOTRequest(otRequest)

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
    requestedEmployees,
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

function applyAllowancePoliciesToItems(items = [], policies = [], exchangeRate = {}) {
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

  normalizedPolicies.forEach((policy) => {
    if (policy.applyPer === 'EMPLOYEE_PER_REQUEST') {
      nextItems.forEach((item, index) => {
        const payableMinutes = safeNonNegativeNumber(item.payableMinutes, 0)

        if (payableMinutes < policy.minOtMinutes) return

        const allowance = buildAllowanceMatch(policy, exchangeRate)
        const current = nextItems[index]

        nextItems[index] = mergeItemAllowance(current, allowance, exchangeRate)
      })

      return
    }

    dayGroups.forEach((group) => {
      if (group.totalPayableMinutes < policy.minOtMinutes) return
      if (!group.indexes.length) return

      const firstIndex = group.indexes[0]
      const allowance = buildAllowanceMatch(policy, exchangeRate)
      const current = nextItems[firstIndex]

      nextItems[firstIndex] = mergeItemAllowance(current, allowance, exchangeRate)
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
  const multiplier = getMultiplier(formula, dayType)

  const monthlySalary = safeNonNegativeNumber(salaryInfo.monthlySalary, 0)
  const hourlyRate = getHourlyRate(monthlySalary, formula)

  const requestStartTime = resolveEmployeeRequestStartTime(employee, otRequest)
  const requestEndTime = resolveEmployeeRequestEndTime(employee, otRequest)
  const requestedMinutes = resolveEmployeeRequestedMinutes(employee, otRequest)
  const breakMinutes = resolveEmployeeBreakMinutes(employee, otRequest)
  const requestPaidMinutes = requestedMinutes || resolveRequestPaidMinutes(otRequest)

  const payableMinutes = resolveEmployeePaidMinutes(employee, otRequest)
  const hasAttendancePolicyPayable = payableMinutes > 0

  const payableHours = payableMinutes / 60
  const rawAmount = hourlyRate * multiplier * payableHours

  const amount = salaryInfo.hasSalary
    ? roundAmount(rawAmount, formula.roundingDecimals)
    : 0

  const exchange = calculateExchangeAmount(amount, exchangeRate)

  return {
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
    multiplier,

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
    otResult: upper(employee.otResult),
    payableMinutes: resolveEmployeePaidMinutes(employee),
    reason: s(
      employee.otResultReason ||
        'Payable minutes were calculated, but verification result is not exact MATCH',
    ),
  }
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

      if (payableMinutes <= 0) {
        const key = `${s(otRequest.requestNo)}:${employeeNo}`

        if (!missingPayableEmployeesMap.has(key)) {
          missingPayableEmployeesMap.set(
            key,
            buildMissingPayableIssue(otRequest, employee),
          )
        }

        continue
      }

      if (upper(employee.otResult) !== 'MATCH') {
        const key = `${s(otRequest.requestNo)}:${employeeNo}`

        if (!payableWarningEmployeesMap.has(key)) {
          payableWarningEmployeesMap.set(
            key,
            buildPayableWarningIssue(otRequest, employee),
          )
        }
      }

      const salaryInfo = buildSalaryInfo(salaryMap, employeeNo)

      const item = buildPaymentItem({
        otRequest,
        employee,
        formula,
        salaryInfo,
        exchangeRate,
      })

      items.push(item)

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

  return {
    items: applyAllowancePoliciesToItems(items, allowancePolicies, exchangeRate),
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

  const otRequests = await fetchApprovedOTRequests(fromDate, toDate)
  await reportPaymentProgress(
    onProgress,
    35,
    'OT_REQUESTS',
    `Loaded ${otRequests.length} approved OT requests`,
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

    summary,
    items,

    issues: {
      invalidSalaryRows: parsedSalary.invalidRows,
      duplicateSalaryRows: parsedSalary.duplicateRows,
      missingSalaryEmployees,
      missingPayableEmployees,
      payableWarningEmployees,
      notPreparedRequests: [],
      verificationSummaries,
    },
  }
}

module.exports = {
  buildPaymentPreview,
}