// backend/src/modules/attendance/services/attendance.service.js

const mongoose = require('mongoose')

const AttendanceRecord = require('../models/AttendanceRecord')
const OTRequest = require('../../ot/models/OTRequest')
const OTCalculationPolicy = require('../../ot/models/OTCalculationPolicy')
const ShiftOTOption = require('../../ot/models/ShiftOTOption')
const { classifyDayType } = require('../../calendar/services/dayType.service')
const {
  formatYmdToDmy,
  formatDateTimeToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')
const { verifyAttendanceAgainstOT } = require('../utils/attendanceVerification')

const attendanceImportService = require('./attendanceImport.service')
const attendanceRecordService = require('./attendanceRecord.service')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeDateOnly(value) {
  const raw = s(value)
  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`
  }

  return raw
}

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function createHttpError(message, status = 400, messageKey = '') {
  const err = new Error(message)
  err.status = status
  err.statusCode = status
  err.messageKey = messageKey
  return err
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function normalizeLimit(value) {
  const limit = Number(value || 10)
  if (!Number.isFinite(limit)) return 10
  return Math.min(Math.max(Math.floor(limit), 1), 100)
}

function buildVerificationRequestSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return {}

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { requestNo: regex },
      { requesterEmployeeNo: regex },
      { requesterName: regex },
      { shiftOtOptionLabel: regex },
      { shiftName: regex },
      { shiftCode: regex },
      { otDate: regex },
      { status: regex },
      { dayType: regex },
    ],
  }
}

function buildVerificationRequestFilter(query = {}) {
  const filter = {
    ...buildVerificationRequestSearchFilter(query.search),
  }

  if (s(query.status)) {
    filter.status = upper(query.status)
  }

  const otDateFrom = normalizeDateOnly(query.otDateFrom)
  const otDateTo = normalizeDateOnly(query.otDateTo)

  if (otDateFrom || otDateTo) {
    filter.otDate = {}

    if (otDateFrom) {
      filter.otDate.$gte = otDateFrom
    }

    if (otDateTo) {
      filter.otDate.$lte = otDateTo
    }
  }

  return filter
}

function mapVerificationRequestSearchItem(doc = {}) {
  const requestedEmployees = Array.isArray(doc.requestedEmployees) ? doc.requestedEmployees : []
  const approvedEmployees = Array.isArray(doc.approvedEmployees) ? doc.approvedEmployees : []

  const requestedEmployeeCount = Number(doc.requestedEmployeeCount || requestedEmployees.length)
  const approvedEmployeeCount = Number(doc.approvedEmployeeCount || approvedEmployees.length || 0)

  return {
    id: doc._id ? String(doc._id) : null,
    requestNo: s(doc.requestNo),

    otDate: s(doc.otDate),
    otDateDisplay: formatYmdToDmy(doc.otDate),

    dayType: upper(doc.dayType),
    status: upper(doc.status),

    requesterEmployeeId: doc.requesterEmployeeId ? String(doc.requesterEmployeeId) : null,
    requesterEmployeeNo: s(doc.requesterEmployeeNo),
    requesterName: s(doc.requesterName),

    shiftId: doc.shiftId ? String(doc.shiftId) : null,
    shiftCode: upper(doc.shiftCode),
    shiftName: s(doc.shiftName),
    shiftType: upper(doc.shiftType),
    shiftStartTime: s(doc.shiftStartTime),
    shiftEndTime: s(doc.shiftEndTime),
    shiftCrossMidnight: doc.shiftCrossMidnight === true,

    shiftOtOptionId: doc.shiftOtOptionId ? String(doc.shiftOtOptionId) : null,
    shiftOtOptionLabel: s(doc.shiftOtOptionLabel),

    shiftOtOptionTimingMode: upper(doc.shiftOtOptionTimingMode),
    shiftOtOptionStartAfterShiftEndMinutes: Number(
      doc.shiftOtOptionStartAfterShiftEndMinutes || 0,
    ),
    shiftOtOptionFixedStartTime: s(doc.shiftOtOptionFixedStartTime),
    shiftOtOptionFixedEndTime: s(doc.shiftOtOptionFixedEndTime),

    requestStartTime: s(doc.requestStartTime || doc.startTime),
    requestEndTime: s(doc.requestEndTime || doc.endTime),

    requestedMinutes: Number(doc.requestedMinutes || doc.totalMinutes || 0),
    breakMinutes: Number(doc.breakMinutes || 0),
    totalMinutes: Number(doc.totalMinutes || 0),
    totalRequestPaidMinutes: Number(
      doc.totalRequestPaidMinutes || doc.totalPaidMinutes || doc.totalMinutes || 0,
    ),
    totalHours: Number(doc.totalHours || 0),

    otCalculationPolicyId: doc.otCalculationPolicyId ? String(doc.otCalculationPolicyId) : null,
    otCalculationPolicySnapshot: doc.otCalculationPolicySnapshot || {},

    employeeCount: requestedEmployeeCount,
    requestedEmployeeCount,
    approvedEmployeeCount,

    attendanceVerificationStatus: upper(doc.attendanceVerificationStatus),
    attendanceVerifiedAt: doc.attendanceVerifiedAt || null,
    attendanceVerificationSummary: doc.attendanceVerificationSummary || null,

    createdAt: doc.createdAt || null,
    createdAtDisplay: formatDateTimeToDmy(doc.createdAt),
    createdAtDisplayHm: formatDateTimeToDmyHm(doc.createdAt),

    updatedAt: doc.updatedAt || null,
    updatedAtDisplay: formatDateTimeToDmy(doc.updatedAt),
    updatedAtDisplayHm: formatDateTimeToDmyHm(doc.updatedAt),
  }
}

async function searchOTRequestsForVerification(query = {}) {
  const page = normalizePage(query.page)
  const limit = normalizeLimit(query.limit)
  const skip = (page - 1) * limit

  const filter = buildVerificationRequestFilter(query)

  let docs = []

  try {
    docs = await OTRequest.find(filter)
      .sort({
        otDate: -1,
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit + 1)
      .maxTimeMS(120000)
      .lean()
  } catch (error) {
    console.warn('[attendance.verification] search fallback:', error?.message || error)

    docs = await OTRequest.find(filter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit + 1)
      .maxTimeMS(120000)
      .lean()
  }

  const hasMore = docs.length > limit
  const items = hasMore ? docs.slice(0, limit) : docs
  const fallbackTotal = (page - 1) * limit + items.length + (hasMore ? limit : 0)

  let total = fallbackTotal

  try {
    total = await OTRequest.countDocuments(filter).maxTimeMS(8000)
    total = Math.max(Number(total || 0), fallbackTotal)
  } catch (error) {
    console.warn('[attendance.verification] count fallback:', error?.message || error)
  }

  const totalPages = Math.ceil(total / limit) || 1

  return {
    items: items.map(mapVerificationRequestSearchItem),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: hasMore || page < totalPages,
    },
  }
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

  const requestedMinutes = Number(otRequest?.requestedMinutes || otRequest?.totalMinutes || 0)
  const breakMinutes = Number(otRequest?.breakMinutes || 0)

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
    id: otRequest._id ? String(otRequest._id) : null,
    requestNo: s(otRequest.requestNo),

    requesterEmployeeId: otRequest.requesterEmployeeId
      ? String(otRequest.requesterEmployeeId)
      : null,
    requesterEmployeeNo: s(otRequest.requesterEmployeeNo),
    requesterName: s(otRequest.requesterName),

    otDate: s(otRequest.otDate),
    otDateDisplay: formatYmdToDmy(otRequest.otDate),

    // Verification always uses current calendar service as source of truth.
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

function normalizePaymentMinutes(value) {
  return Math.max(0, Math.round(n(value, 0)))
}

function mapEmployeeWithPaymentVerification(employee = {}, verificationMap = new Map()) {
  const key = employeePaymentKey(employee)
  const verification = verificationMap.get(key) || null

  const otResult = upper(verification?.otResult)
  const roundedOtMinutes = normalizePaymentMinutes(verification?.roundedOtMinutes)
  const actualOtMinutes = normalizePaymentMinutes(verification?.actualOtMinutes)
  const eligibleOtMinutes = normalizePaymentMinutes(verification?.eligibleOtMinutes)

  const paymentEligible = otResult === 'MATCH' && roundedOtMinutes > 0
  const payableMinutes = paymentEligible ? roundedOtMinutes : 0

  return {
    ...employee,

    attendanceRecordId: verification?.attendanceRecordId || null,
    attendanceImportId: verification?.importId || null,

    attendanceStatus: upper(verification?.attendanceStatus),
    attendanceStatusKey: s(verification?.attendanceStatusKey),
    attendanceMessageKey: s(verification?.attendanceMessageKey),

    actualOtMinutes,
    eligibleOtMinutes,
    roundedOtMinutes,

    // Payment reads these fields.
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

    rawOtDecision: upper(verification?.rawOtDecision),
    rawOtDecisionKey: s(verification?.rawOtDecisionKey),

    otResult,
    otResultLabelKey: s(verification?.otResultLabelKey),
    otResultReason: s(verification?.otResultReason),
    otResultReasonKey: s(verification?.otResultReasonKey),
    paymentMessageKey: s(verification?.messageKey),

    paymentEligible,
    paymentBlockedReason: paymentEligible
      ? ''
      : s(verification?.otResultReason || 'No attendance/policy payable minutes found'),

    policyCode: s(verification?.policyCode),
    policyName: s(verification?.policyName),
    policyRoundMethod: s(verification?.policyRoundMethod),
    policyRoundUnitMinutes: n(verification?.policyRoundUnitMinutes, 0),
    policyMinEligibleMinutes: n(verification?.policyMinEligibleMinutes, 0),
    policyGraceAfterShiftEndMinutes: n(verification?.policyGraceAfterShiftEndMinutes, 0),
  }
}

function buildAttendanceVerificationStatus(verification = {}) {
  if (Number(verification.otPendingReviewCount || 0) > 0) {
    return 'PENDING_REVIEW'
  }

  if (Number(verification.otMismatchCount || 0) > 0) {
    return 'MISMATCH'
  }

  if (Number(verification.otMatchCount || 0) > 0) {
    return 'MATCH'
  }

  return 'NO_PAYABLE_ATTENDANCE'
}

function buildAttendanceVerificationSummary(verification = {}, verifiedAt = new Date()) {
  return {
    verifiedAt,

    requestedEmployeeCount: Number(verification.requestedEmployeeCount || 0),
    approvedEmployeeCount: Number(verification.approvedEmployeeCount || 0),

    actualAttendedCount: Number(verification.actualAttendedCount || 0),
    absentFromApprovedCount: Number(verification.absentFromApprovedCount || 0),
    attendedButNotApprovedCount: Number(verification.attendedButNotApprovedCount || 0),
    shiftMismatchCount: Number(verification.shiftMismatchCount || 0),
    pendingReviewCount: Number(verification.pendingReviewCount || 0),
    notEligibleCount: Number(verification.notEligibleCount || 0),

    otMatchCount: Number(verification.otMatchCount || 0),
    otMismatchCount: Number(verification.otMismatchCount || 0),
    otPendingReviewCount: Number(verification.otPendingReviewCount || 0),
  }
}

async function buildOTVerificationResult(otRequestId) {
  if (!mongoose.isValidObjectId(otRequestId)) {
    throw createHttpError(
      'Invalid OT request id',
      400,
      'attendance.verification.invalid_ot_request_id',
    )
  }

  const otRequest = await OTRequest.findById(otRequestId).lean()

  if (!otRequest) {
    throw createHttpError(
      'OT request not found',
      404,
      'attendance.verification.ot_request_not_found',
    )
  }

  const { currentPolicy, currentShiftOtOption } =
    await resolveCurrentPolicyAndShiftOption(otRequest)

  const requestedEmployees = Array.isArray(otRequest.requestedEmployees)
    ? otRequest.requestedEmployees
    : []

  const effectiveApprovedEmployees = getEffectiveApprovedEmployeesForVerification(otRequest)

  const attendanceRecords = await findAttendanceRecordsForOTRequest(otRequest)

  const internalDayInfo = await classifyDayType(s(otRequest.otDate))
  const internalCalendarDayType = upper(internalDayInfo?.dayType || 'WORKING_DAY')

  const verificationOtRequest = buildVerificationOTRequestPayload(
    otRequest,
    effectiveApprovedEmployees,
    {
      currentPolicy,
      currentShiftOtOption,
      internalCalendarDayType,
    },
  )

  const verification = verifyAttendanceAgainstOT({
    otRequest: verificationOtRequest,
    requestedEmployees,
    approvedEmployees: effectiveApprovedEmployees,
    attendanceRecords,
  })

  return {
    rawOTRequest: otRequest,
    requestedEmployees,
    effectiveApprovedEmployees,
    verificationOtRequest,
    verification,
  }
}

async function verifyOTRequest(otRequestId) {
  const result = await buildOTVerificationResult(otRequestId)

  return {
    otRequest: result.verificationOtRequest,
    verification: result.verification,
  }
}

async function verifyAndSaveOTRequest(otRequestId, actor = {}) {
  const result = await buildOTVerificationResult(otRequestId)

  const verificationMap = buildVerificationPaymentMap(result.verification)

  const sourceApprovedEmployees = result.effectiveApprovedEmployees.length
    ? result.effectiveApprovedEmployees
    : result.requestedEmployees

  const verifiedApprovedEmployees = sourceApprovedEmployees.map((employee) =>
    mapEmployeeWithPaymentVerification(employee, verificationMap),
  )

  const attendanceVerificationStatus = buildAttendanceVerificationStatus(result.verification)
  const attendanceVerifiedAt = new Date()
  const attendanceVerificationSummary = buildAttendanceVerificationSummary(
    result.verification,
    attendanceVerifiedAt,
  )

  const payableEmployeeCount = verifiedApprovedEmployees.filter(
    (item) => item.paymentEligible === true,
  ).length

  const updatedBy =
    actor?.accountId && mongoose.isValidObjectId(actor.accountId)
      ? new mongoose.Types.ObjectId(actor.accountId)
      : actor?._id && mongoose.isValidObjectId(actor._id)
        ? new mongoose.Types.ObjectId(actor._id)
        : null

  const updatePayload = {
    approvedEmployees: verifiedApprovedEmployees,
    approvedEmployeeCount: verifiedApprovedEmployees.length,

    attendanceVerifiedAt,
    attendanceVerificationStatus,
    attendanceVerificationSummary,

    paymentPreparedAt: attendanceVerifiedAt,
    paymentPreparedBy: updatedBy,
    updatedAt: new Date(),
  }

  if (updatedBy) {
    updatePayload.updatedBy = updatedBy
  }

  // Use raw collection update so payment-ready fields are preserved even if
  // OTRequest approvedEmployees sub-schema has not been expanded yet.
  await OTRequest.collection.updateOne(
    {
      _id: new mongoose.Types.ObjectId(otRequestId),
    },
    {
      $set: updatePayload,
    },
  )

  return {
    otRequest: result.verificationOtRequest,
    verification: result.verification,
    saved: {
      attendanceVerificationStatus,
      attendanceVerifiedAt,
      approvedEmployeeCount: verifiedApprovedEmployees.length,
      payableEmployeeCount,
      blockedEmployeeCount: Math.max(0, verifiedApprovedEmployees.length - payableEmployeeCount),
    },
  }
}

module.exports = {
  importExcel: attendanceImportService.importExcel,
  listImports: attendanceImportService.listImports,
  getImportById: attendanceImportService.getImportById,
  downloadImportSample: attendanceImportService.downloadImportSample,

  listRecords: attendanceRecordService.listRecords,
  getRecordById: attendanceRecordService.getRecordById,

  searchOTRequestsForVerification,
  verifyOTRequest,
  verifyAndSaveOTRequest,
}