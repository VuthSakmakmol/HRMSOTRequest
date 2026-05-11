// backend/src/modules/ot/services/shiftOtOption.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')
const ShiftOTOption = require('../models/ShiftOTOption')
const Shift = require('../../shift/models/Shift')
const OTCalculationPolicy = require('../models/OTCalculationPolicy')
const holidayService = require('../../calendar/services/holiday.service')

const DAY_MINUTES = 24 * 60
const DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

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

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function actorAccountId(authUser) {
  const actorId = authUser?.accountId || authUser?.id || authUser?._id

  return isObjectId(actorId) ? actorId : null
}

function normalizeApplicableDayTypes(value) {
  const source = Array.isArray(value) ? value : ['WORKING_DAY']

  const normalized = [
    ...new Set(source.map(upper).filter((item) => DAY_TYPES.includes(item))),
  ]

  return normalized.length ? normalized : ['WORKING_DAY']
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
      params: {
        value: raw,
      },
    })
  }

  return Number(match[1]) * 60 + Number(match[2])
}

function minutesToHHmm(totalMinutes) {
  const normalized = ((Number(totalMinutes || 0) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addMinutesToHHmm(hhmm, extraMinutes) {
  return minutesToHHmm(toMinutes(hhmm) + Number(extraMinutes || 0))
}

function buildClockWindow(startTime, endTime) {
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

function calculateBreakOverlapMinutes({ startTime, endTime, shift }) {
  const breakStartTime = s(shift?.breakStartTime)
  const breakEndTime = s(shift?.breakEndTime)

  if (!breakStartTime || !breakEndTime) return 0

  const otWindow = buildClockWindow(startTime, endTime)
  const breakWindow = buildClockWindow(breakStartTime, breakEndTime)

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

function calculateWindowMinutes({ startTime, endTime, breakMinutes = 0 }) {
  const window = buildClockWindow(startTime, endTime)
  const grossMinutes = Math.max(0, window.end - window.start)
  const safeBreakMinutes = Number(breakMinutes || 0)

  if (!Number.isInteger(safeBreakMinutes) || safeBreakMinutes < 0) {
    throw appError({
      statusCode: 400,
      code: 'BREAK_MINUTES_INVALID',
      messageKey: 'ot.shiftOption.validation.breakMinutesInvalid',
      message: 'Break minutes must be a non-negative integer',
      field: 'breakMinutes',
    })
  }

  if (safeBreakMinutes >= grossMinutes) {
    throw appError({
      statusCode: 400,
      code: 'BREAK_MINUTES_TOO_LARGE',
      messageKey: 'ot.shiftOption.validation.breakMinutesTooLarge',
      message: 'Break minutes cannot be greater than or equal to OT duration',
      field: 'breakMinutes',
    })
  }

  const totalRequestPaidMinutes = grossMinutes - safeBreakMinutes

  return {
    grossMinutes,
    requestedMinutes: grossMinutes,
    breakMinutes: safeBreakMinutes,
    totalRequestPaidMinutes,
    totalRequestPaidHours: Number((totalRequestPaidMinutes / 60).toFixed(2)),
  }
}

function calculateOptionPreview(option, shift) {
  const timingMode = upper(option?.timingMode || 'AFTER_SHIFT_END')
  const startAfterShiftEndMinutes = Number(option?.startAfterShiftEndMinutes || 0)

  let requestStartTime = ''
  let requestEndTime = ''

  if (timingMode === 'FIXED_TIME') {
    requestStartTime = s(option?.fixedStartTime)
    requestEndTime = s(option?.fixedEndTime)
  } else {
    const requestedMinutes = Number(option?.requestedMinutes || 0)

    requestStartTime = addMinutesToHHmm(shift.endTime, startAfterShiftEndMinutes)
    requestEndTime = addMinutesToHHmm(requestStartTime, requestedMinutes)
  }

  const breakMinutes = calculateBreakOverlapMinutes({
    startTime: requestStartTime,
    endTime: requestEndTime,
    shift,
  })

  const calculated = calculateWindowMinutes({
    startTime: requestStartTime,
    endTime: requestEndTime,
    breakMinutes,
  })

  return {
    requestStartTime,
    requestEndTime,

    requestedMinutes: calculated.requestedMinutes,
    requestedHours: Number((calculated.requestedMinutes / 60).toFixed(2)),

    breakMinutes: calculated.breakMinutes,

    totalRequestPaidMinutes: calculated.totalRequestPaidMinutes,
    totalRequestPaidHours: calculated.totalRequestPaidHours,
  }
}

function mapShift(shift) {
  if (!shift || typeof shift !== 'object') {
    return {
      id: null,
      code: '',
      name: '',
      label: '',
      type: '',
      startTime: '',
      breakStartTime: '',
      breakEndTime: '',
      endTime: '',
      crossMidnight: false,
      isActive: false,
    }
  }

  const code = s(shift.code)
  const name = s(shift.name)

  return {
    id: id(shift._id),
    _id: id(shift._id),
    code,
    name,
    label: [code, name].filter(Boolean).join(' - '),
    type: upper(shift.type),
    typeKey: upper(shift.type) === 'NIGHT' ? 'shift.type.night' : 'shift.type.day',
    startTime: s(shift.startTime),
    breakStartTime: s(shift.breakStartTime),
    breakEndTime: s(shift.breakEndTime),
    endTime: s(shift.endTime),
    crossMidnight: shift.crossMidnight === true,
    isActive: shift.isActive !== false,
  }
}

function mapPolicy(policy) {
  if (!policy || typeof policy !== 'object') {
    return {
      id: null,
      code: '',
      name: '',
      label: '',
      roundMethod: '',
      roundUnitMinutes: 0,
      minEligibleMinutes: 0,
      graceAfterShiftEndMinutes: 0,
      allowApprovedOtWithoutExactClockOut: false,
      allowPreShiftOT: false,
      allowPostShiftOT: true,
      capByRequestedMinutes: true,
      treatForgetScanInAsPending: true,
      treatForgetScanOutAsPending: true,
      isActive: false,
    }
  }

  const code = s(policy.code)
  const name = s(policy.name)

  return {
    id: id(policy._id),
    _id: id(policy._id),
    code,
    name,
    label: [code, name].filter(Boolean).join(' - '),

    minEligibleMinutes: Number(policy.minEligibleMinutes || 0),
    roundUnitMinutes: Number(policy.roundUnitMinutes || 0),
    roundMethod: upper(policy.roundMethod),
    graceAfterShiftEndMinutes: Number(policy.graceAfterShiftEndMinutes || 0),

    allowApprovedOtWithoutExactClockOut:
      policy.allowApprovedOtWithoutExactClockOut === true,

    allowPreShiftOT: policy.allowPreShiftOT === true,
    allowPostShiftOT: policy.allowPostShiftOT !== false,
    capByRequestedMinutes: policy.capByRequestedMinutes !== false,
    treatForgetScanInAsPending: policy.treatForgetScanInAsPending !== false,
    treatForgetScanOutAsPending: policy.treatForgetScanOutAsPending !== false,

    isActive: policy.isActive !== false,
  }
}

function mapShiftOTOption(doc) {
  if (!doc) return null

  const shift = doc.shiftId && typeof doc.shiftId === 'object' ? doc.shiftId : null
  const policy =
    doc.calculationPolicyId && typeof doc.calculationPolicyId === 'object'
      ? doc.calculationPolicyId
      : null

  const mappedShift = mapShift(shift)
  const mappedPolicy = mapPolicy(policy)
  const applicableDayTypes = normalizeApplicableDayTypes(doc.applicableDayTypes)
  const preview = mappedShift.id
    ? calculateOptionPreview(doc, mappedShift)
    : {
        requestStartTime: '',
        requestEndTime: '',
        requestedMinutes: Number(doc.requestedMinutes || 0),
        requestedHours: Number((Number(doc.requestedMinutes || 0) / 60).toFixed(2)),
        breakMinutes: 0,
        totalRequestPaidMinutes: Number(doc.requestedMinutes || 0),
        totalRequestPaidHours: Number((Number(doc.requestedMinutes || 0) / 60).toFixed(2)),
      }

  return {
    id: id(doc._id),
    _id: id(doc._id),

    shiftId: mappedShift.id || id(doc.shiftId) || null,
    shift: mappedShift,
    shiftLabel: mappedShift.label,

    label: s(doc.label),
    optionLabel: `${s(doc.label)} · ${applicableDayTypes.join(', ')} · ${preview.requestedMinutes} min`,

    timingMode: upper(doc.timingMode || 'AFTER_SHIFT_END'),
    timingModeKey:
      upper(doc.timingMode || 'AFTER_SHIFT_END') === 'FIXED_TIME'
        ? 'ot.shiftOption.timingMode.fixedTime'
        : 'ot.shiftOption.timingMode.afterShiftEnd',

    applicableDayTypes,
    dayTypeLabel: applicableDayTypes.join(', '),

    startAfterShiftEndMinutes: Number(doc.startAfterShiftEndMinutes || 0),
    fixedStartTime: s(doc.fixedStartTime),
    fixedEndTime: s(doc.fixedEndTime),

    requestedMinutes: preview.requestedMinutes,
    requestedHours: preview.requestedHours,

    requestStartTime: preview.requestStartTime,
    requestEndTime: preview.requestEndTime,

    breakMinutes: preview.breakMinutes,
    totalRequestPaidMinutes: preview.totalRequestPaidMinutes,
    totalRequestPaidHours: preview.totalRequestPaidHours,

    calculationPolicyId: mappedPolicy.id || id(doc.calculationPolicyId) || null,
    calculationPolicy: mappedPolicy,
    policyLabel: mappedPolicy.label,

    sequence: Number(doc.sequence || 0),

    isActive: doc.isActive !== false,
    statusCode: doc.isActive !== false ? 'ACTIVE' : 'INACTIVE',
    statusKey:
      doc.isActive !== false ? 'common.status.active' : 'common.status.inactive',
    statusSeverity: doc.isActive !== false ? 'success' : 'danger',

    createdBy: id(doc.createdBy) || null,
    updatedBy: id(doc.updatedBy) || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapShiftOTOption(doc)

  return {
    id: item.id,
    _id: item._id,

    label: item.label,
    optionLabel: item.optionLabel,

    shiftId: item.shiftId,
    shift: item.shift,
    shiftLabel: item.shiftLabel,

    timingMode: item.timingMode,
    timingModeKey: item.timingModeKey,

    applicableDayTypes: item.applicableDayTypes,
    dayTypeLabel: item.dayTypeLabel,

    startAfterShiftEndMinutes: item.startAfterShiftEndMinutes,
    fixedStartTime: item.fixedStartTime,
    fixedEndTime: item.fixedEndTime,

    requestStartTime: item.requestStartTime,
    requestEndTime: item.requestEndTime,

    requestedMinutes: item.requestedMinutes,
    requestedHours: item.requestedHours,

    breakMinutes: item.breakMinutes,

    totalRequestPaidMinutes: item.totalRequestPaidMinutes,
    totalRequestPaidHours: item.totalRequestPaidHours,

    calculationPolicyId: item.calculationPolicyId,
    calculationPolicy: item.calculationPolicy,
    policyLabel: item.policyLabel,

    sequence: item.sequence,
    isActive: item.isActive,
  }
}

function buildFilter(query = {}) {
  const filter = {}

  const keyword = s(query.search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')
    filter.$or = [{ label: regex }]
  }

  if (query.shiftId && isObjectId(query.shiftId)) {
    filter.shiftId = query.shiftId
  }

  if (query.calculationPolicyId && isObjectId(query.calculationPolicyId)) {
    filter.calculationPolicyId = query.calculationPolicyId
  }

  if (query.timingMode) {
    filter.timingMode = upper(query.timingMode)
  }

  if (query.dayType) {
    filter.applicableDayTypes = upper(query.dayType)
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  return filter
}

function buildSort(sortField = 'sequence', sortOrder = 1) {
  const allowedFields = new Set([
    'createdAt',
    'updatedAt',
    'label',
    'timingMode',
    'requestedMinutes',
    'startAfterShiftEndMinutes',
    'sequence',
    'isActive',
  ])

  const field = allowedFields.has(sortField) ? sortField : 'sequence'
  const direction = Number(sortOrder) === -1 ? -1 : 1

  return {
    [field]: direction,
    sequence: 1,
    requestedMinutes: 1,
    _id: 1,
  }
}

function populateQuery(query) {
  return query
    .populate({
      path: 'shiftId',
      select: 'code name type startTime breakStartTime breakEndTime endTime crossMidnight isActive',
    })
    .populate({
      path: 'calculationPolicyId',
      select:
        'code name minEligibleMinutes roundUnitMinutes roundMethod graceAfterShiftEndMinutes allowApprovedOtWithoutExactClockOut allowPreShiftOT allowPostShiftOT capByRequestedMinutes treatForgetScanInAsPending treatForgetScanOutAsPending isActive',
    })
}

async function resolveEffectiveDayType(query = {}) {
  const explicitDayType = upper(query.dayType)

  if (DAY_TYPES.includes(explicitDayType)) {
    return {
      dayType: explicitDayType,
      dayTypeSource: 'QUERY_DAY_TYPE',
      dayTypeInfo: null,
    }
  }

  const otDate = s(query.otDate)

  if (!otDate) {
    return {
      dayType: '',
      dayTypeSource: '',
      dayTypeInfo: null,
    }
  }

  const info = await holidayService.resolveDayType(otDate)

  return {
    dayType: info.dayType,
    dayTypeSource: 'CALENDAR',
    dayTypeInfo: info,
  }
}

async function assertShiftExists(shiftId) {
  if (!isObjectId(shiftId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_SHIFT_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid shift id',
      field: 'shiftId',
    })
  }

  const shift = await Shift.findById(shiftId).lean()

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

async function assertPolicyExists(policyId) {
  if (!isObjectId(policyId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_POLICY_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid policy id',
      field: 'calculationPolicyId',
    })
  }

  const policy = await OTCalculationPolicy.findById(policyId).lean()

  if (!policy) {
    throw appError({
      statusCode: 404,
      code: 'OT_POLICY_NOT_FOUND',
      messageKey: 'ot.policy.error.notFound',
      message: 'OT calculation policy not found',
      field: 'calculationPolicyId',
    })
  }

  if (policy.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'OT_POLICY_INACTIVE',
      messageKey: 'ot.policy.error.inactive',
      message: 'OT calculation policy is inactive',
      field: 'calculationPolicyId',
    })
  }

  return policy
}

async function ensureUniqueActiveLabel({ shiftId, label, excludeId = null }) {
  const filter = {
    shiftId,
    label: s(label),
    isActive: true,
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await ShiftOTOption.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'SHIFT_OT_OPTION_LABEL_EXISTS',
      messageKey: 'ot.shiftOption.error.labelExists',
      message: 'Active OT option label already exists for this shift',
      field: 'label',
    })
  }
}

async function ensureUniqueActiveSequence({
  shiftId,
  sequence,
  applicableDayTypes = [],
  excludeId = null,
}) {
  const dayTypes = normalizeApplicableDayTypes(applicableDayTypes)

  const filter = {
    shiftId,
    sequence: Number(sequence || 0),
    applicableDayTypes: {
      $in: dayTypes,
    },
    isActive: true,
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await ShiftOTOption.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'SHIFT_OT_OPTION_SEQUENCE_EXISTS',
      messageKey: 'ot.shiftOption.error.sequenceExists',
      message: 'Active OT option sequence already exists for this shift and day type',
      field: 'sequence',
      params: {
        sequence: Number(sequence || 0),
        applicableDayTypes: dayTypes,
      },
    })
  }
}

function applyTimingRules(data, shift) {
  const timingMode = upper(data.timingMode || 'AFTER_SHIFT_END')

  data.timingMode = timingMode

  if (timingMode === 'AFTER_SHIFT_END') {
    data.fixedStartTime = ''
    data.fixedEndTime = ''
    data.startAfterShiftEndMinutes = Number(data.startAfterShiftEndMinutes || 0)
    data.requestedMinutes = Number(data.requestedMinutes || 0)

    if (!Number.isInteger(data.requestedMinutes) || data.requestedMinutes < 1) {
      throw appError({
        statusCode: 400,
        code: 'REQUESTED_MINUTES_INVALID',
        messageKey: 'ot.shiftOption.validation.requestedMinutesInvalid',
        message: 'Requested minutes must be a positive integer',
        field: 'requestedMinutes',
      })
    }

    return data
  }

  if (timingMode === 'FIXED_TIME') {
    data.startAfterShiftEndMinutes = 0

    const preview = calculateOptionPreview(
      {
        timingMode: 'FIXED_TIME',
        fixedStartTime: data.fixedStartTime,
        fixedEndTime: data.fixedEndTime,
      },
      shift,
    )

    // Fixed time source of truth: backend calculates full window minutes.
    data.requestedMinutes = preview.requestedMinutes

    return data
  }

  throw appError({
    statusCode: 400,
    code: 'TIMING_MODE_INVALID',
    messageKey: 'ot.shiftOption.validation.timingModeInvalid',
    message: 'Timing mode is invalid',
    field: 'timingMode',
  })
}

async function lookup(query = {}) {
  const resolvedDayType = await resolveEffectiveDayType(query)

  const filter = buildFilter({
    ...query,
    dayType: resolvedDayType.dayType || query.dayType,
  })

  const limit = Number(query.limit || 50)

  const items = await populateQuery(
    ShiftOTOption.find(filter)
      .sort({ sequence: 1, requestedMinutes: 1, _id: 1 })
      .limit(limit),
  ).lean()

  return {
    items: items.map(mapLookupItem),
    meta: {
      limit,
      count: items.length,
      dayType: resolvedDayType.dayType || '',
      dayTypeSource: resolvedDayType.dayTypeSource,
      otDate: s(query.otDate),
      dayTypeInfo: resolvedDayType.dayTypeInfo,
    },
  }
}

async function list(query = {}) {
  const resolvedDayType = await resolveEffectiveDayType(query)

  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter({
    ...query,
    dayType: resolvedDayType.dayType || query.dayType,
  })

  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    populateQuery(ShiftOTOption.find(filter).sort(sort).skip(skip).limit(limit)).lean(),
    ShiftOTOption.countDocuments(filter),
  ])

  return {
    items: items.map(mapShiftOTOption),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
    meta: {
      dayType: resolvedDayType.dayType || '',
      dayTypeSource: resolvedDayType.dayTypeSource,
      otDate: s(query.otDate),
      dayTypeInfo: resolvedDayType.dayTypeInfo,
    },
  }
}

async function getById(optionId) {
  if (!isObjectId(optionId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_SHIFT_OT_OPTION_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid shift OT option id',
      field: 'optionId',
    })
  }

  const doc = await populateQuery(ShiftOTOption.findById(optionId)).lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_OT_OPTION_NOT_FOUND',
      messageKey: 'ot.shiftOption.error.notFound',
      message: 'Shift OT option not found',
      field: 'optionId',
    })
  }

  return mapShiftOTOption(doc)
}

async function create(payload, authUser) {
  const shift = await assertShiftExists(payload.shiftId)
  await assertPolicyExists(payload.calculationPolicyId)

  const data = {
    ...payload,
    applicableDayTypes: normalizeApplicableDayTypes(payload.applicableDayTypes),
    label: s(payload.label),
    isActive: payload.isActive !== false,
  }

  applyTimingRules(data, shift)

  if (data.isActive) {
    await ensureUniqueActiveLabel({
      shiftId: data.shiftId,
      label: data.label,
    })

    await ensureUniqueActiveSequence({
      shiftId: data.shiftId,
      sequence: data.sequence,
      applicableDayTypes: data.applicableDayTypes,
    })
  }

  try {
    const doc = await ShiftOTOption.create({
      shiftId: data.shiftId,
      label: data.label,
      timingMode: data.timingMode,
      applicableDayTypes: data.applicableDayTypes,
      startAfterShiftEndMinutes: Number(data.startAfterShiftEndMinutes || 0),
      fixedStartTime: s(data.fixedStartTime),
      fixedEndTime: s(data.fixedEndTime),
      requestedMinutes: Number(data.requestedMinutes || 0),
      calculationPolicyId: data.calculationPolicyId,
      sequence: Number(data.sequence || 1),
      isActive: data.isActive,
      createdBy: actorAccountId(authUser),
      updatedBy: actorAccountId(authUser),
    })

    return getById(doc._id)
  } catch (error) {
    if (error?.code === 11000) {
      throw appError({
        statusCode: 409,
        code: 'SHIFT_OT_OPTION_DUPLICATE',
        messageKey: 'ot.shiftOption.error.duplicate',
        message: 'Duplicate active OT option for this shift',
      })
    }

    throw error
  }
}

async function update(optionId, payload, authUser) {
  if (!isObjectId(optionId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_SHIFT_OT_OPTION_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid shift OT option id',
      field: 'optionId',
    })
  }

  const doc = await ShiftOTOption.findById(optionId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_OT_OPTION_NOT_FOUND',
      messageKey: 'ot.shiftOption.error.notFound',
      message: 'Shift OT option not found',
      field: 'optionId',
    })
  }

  const nextData = {
    shiftId: payload.shiftId !== undefined ? payload.shiftId : doc.shiftId,
    calculationPolicyId:
      payload.calculationPolicyId !== undefined
        ? payload.calculationPolicyId
        : doc.calculationPolicyId,

    label: payload.label !== undefined ? payload.label : doc.label,
    timingMode: payload.timingMode !== undefined ? payload.timingMode : doc.timingMode,

    applicableDayTypes:
      payload.applicableDayTypes !== undefined
        ? payload.applicableDayTypes
        : doc.applicableDayTypes,

    startAfterShiftEndMinutes:
      payload.startAfterShiftEndMinutes !== undefined
        ? payload.startAfterShiftEndMinutes
        : doc.startAfterShiftEndMinutes,

    fixedStartTime:
      payload.fixedStartTime !== undefined ? payload.fixedStartTime : doc.fixedStartTime,

    fixedEndTime:
      payload.fixedEndTime !== undefined ? payload.fixedEndTime : doc.fixedEndTime,

    requestedMinutes:
      payload.requestedMinutes !== undefined
        ? payload.requestedMinutes
        : doc.requestedMinutes,

    sequence: payload.sequence !== undefined ? payload.sequence : doc.sequence,

    isActive: payload.isActive !== undefined ? payload.isActive !== false : doc.isActive !== false,
  }

  nextData.applicableDayTypes = normalizeApplicableDayTypes(nextData.applicableDayTypes)
  nextData.label = s(nextData.label)

  const shift = await assertShiftExists(nextData.shiftId)
  await assertPolicyExists(nextData.calculationPolicyId)

  applyTimingRules(nextData, shift)

  if (nextData.isActive) {
    await ensureUniqueActiveLabel({
      shiftId: nextData.shiftId,
      label: nextData.label,
      excludeId: doc._id,
    })

    await ensureUniqueActiveSequence({
      shiftId: nextData.shiftId,
      sequence: nextData.sequence,
      applicableDayTypes: nextData.applicableDayTypes,
      excludeId: doc._id,
    })
  }

  doc.shiftId = nextData.shiftId
  doc.calculationPolicyId = nextData.calculationPolicyId
  doc.label = nextData.label
  doc.timingMode = nextData.timingMode
  doc.applicableDayTypes = nextData.applicableDayTypes
  doc.startAfterShiftEndMinutes = Number(nextData.startAfterShiftEndMinutes || 0)
  doc.fixedStartTime = s(nextData.fixedStartTime)
  doc.fixedEndTime = s(nextData.fixedEndTime)
  doc.requestedMinutes = Number(nextData.requestedMinutes || 0)
  doc.sequence = Number(nextData.sequence || 1)
  doc.isActive = nextData.isActive
  doc.updatedBy = actorAccountId(authUser)

  try {
    await doc.save()
    return getById(doc._id)
  } catch (error) {
    if (error?.code === 11000) {
      throw appError({
        statusCode: 409,
        code: 'SHIFT_OT_OPTION_DUPLICATE',
        messageKey: 'ot.shiftOption.error.duplicate',
        message: 'Duplicate active OT option for this shift',
      })
    }

    throw error
  }
}

module.exports = {
  lookup,
  list,
  getById,
  create,
  update,

  // Used later by OT request / payment.
  calculateOptionPreview,
  calculateBreakOverlapMinutes,
  calculateWindowMinutes,
  normalizeApplicableDayTypes,
}