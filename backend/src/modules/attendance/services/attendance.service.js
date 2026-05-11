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

  if (s(query.otDateFrom) || s(query.otDateTo)) {
    filter.otDate = {}

    if (s(query.otDateFrom)) {
      filter.otDate.$gte = s(query.otDateFrom)
    }

    if (s(query.otDateTo)) {
      filter.otDate.$lte = s(query.otDateTo)
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

  const [items, total] = await Promise.all([
    OTRequest.find(filter)
      .sort({
        otDate: -1,
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),
    OTRequest.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    items: items.map(mapVerificationRequestSearchItem),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
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

async function verifyOTRequest(otRequestId) {
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
    otRequest: verificationOtRequest,
    verification,
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
}