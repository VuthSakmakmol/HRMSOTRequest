// backend/src/modules/ot/services/shiftOtOption.service.js
const ShiftOTOption = require('../models/ShiftOTOption')
const Shift = require('../../shift/models/Shift')
const OTCalculationPolicy = require('../models/OTCalculationPolicy')
const {
  objectIdSchema,
  createShiftOTOptionSchema,
  updateShiftOTOptionSchema,
  listShiftOTOptionsQuerySchema,
  lookupShiftOTOptionsQuerySchema,
} = require('../validators/shiftOtOption.validation')

const DAY_MINUTES = 24 * 60

function s(value) {
  return String(value ?? '').trim()
}

function normalizeObjectIdInput(value) {
  if (!value) return ''
  return String(value).trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

function parseSchema(schema, data) {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error?.name === 'ZodError') {
      throw createHttpError(error.issues?.[0]?.message || 'Validation error', 400)
    }

    throw error
  }
}

function escapeRegex(value) {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isValidHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s(value))
}

function toMinutes(value) {
  const raw = s(value)

  if (!isValidHHmm(raw)) return null

  const [hours, minutes] = raw.split(':').map(Number)
  return hours * 60 + minutes
}

function buildClockInterval(startTime, endTime) {
  const start = toMinutes(startTime)
  const endRaw = toMinutes(endTime)

  if (start === null || endRaw === null) {
    return null
  }

  return {
    start,
    end: endRaw <= start ? endRaw + DAY_MINUTES : endRaw,
  }
}

function durationBetweenTimes(startTime, endTime) {
  const interval = buildClockInterval(startTime, endTime)

  if (!interval) return 0

  return Math.max(0, interval.end - interval.start)
}

function overlapMinutes(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

function getBreakOverlapMinutes({
  windowStartTime,
  windowEndTime,
  breakStartTime,
  breakEndTime,
}) {
  const windowInterval = buildClockInterval(windowStartTime, windowEndTime)
  const breakInterval = buildClockInterval(breakStartTime, breakEndTime)

  if (!windowInterval || !breakInterval) {
    return 0
  }

  const overlaps = [-DAY_MINUTES, 0, DAY_MINUTES].map((offset) =>
    overlapMinutes(
      windowInterval.start,
      windowInterval.end,
      breakInterval.start + offset,
      breakInterval.end + offset,
    ),
  )

  return Math.max(...overlaps)
}

function getShiftBreakMinutes(shift = {}) {
  return durationBetweenTimes(shift?.breakStartTime, shift?.breakEndTime)
}

function getFixedPaidMinutes({ fixedStartTime, fixedEndTime, shift }) {
  const grossMinutes = durationBetweenTimes(fixedStartTime, fixedEndTime)

  const breakOverlapMinutes = getBreakOverlapMinutes({
    windowStartTime: fixedStartTime,
    windowEndTime: fixedEndTime,
    breakStartTime: shift?.breakStartTime,
    breakEndTime: shift?.breakEndTime,
  })

  return Math.max(1, grossMinutes - breakOverlapMinutes)
}

function buildListQuery(query = {}) {
  const filter = {}

  const search = s(query.search)
  if (search) {
    const keyword = escapeRegex(search)

    filter.$or = [{ label: { $regex: keyword, $options: 'i' } }]
  }

  if (query.shiftId) {
    filter.shiftId = query.shiftId
  }

  if (query.calculationPolicyId) {
    filter.calculationPolicyId = query.calculationPolicyId
  }

  if (query.timingMode) {
    filter.timingMode = upper(query.timingMode)
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = Boolean(query.isActive)
  }

  return filter
}

function buildSort(sortField = 'sequence', sortOrder = 1) {
  const direction = Number(sortOrder) === -1 ? -1 : 1

  if (sortField === 'label') return { label: direction, sequence: 1, _id: -1 }
  if (sortField === 'timingMode') return { timingMode: direction, sequence: 1, _id: -1 }

  if (sortField === 'requestedMinutes') {
    return { requestedMinutes: direction, sequence: 1, _id: -1 }
  }

  if (sortField === 'startAfterShiftEndMinutes') {
    return { startAfterShiftEndMinutes: direction, sequence: 1, _id: -1 }
  }

  if (sortField === 'isActive') return { isActive: direction, sequence: 1, _id: -1 }
  if (sortField === 'createdAt') return { createdAt: direction, _id: -1 }
  if (sortField === 'updatedAt') return { updatedAt: direction, _id: -1 }

  return { sequence: direction, requestedMinutes: 1, _id: -1 }
}

function normalizeShiftSnapshot(shift) {
  if (!shift || typeof shift !== 'object') {
    return {
      id: null,
      code: '',
      name: '',
      type: '',
      startTime: '',
      breakStartTime: '',
      breakEndTime: '',
      endTime: '',
      crossMidnight: false,
      breakMinutes: 0,
      isActive: false,
    }
  }

  const breakStartTime = s(shift.breakStartTime)
  const breakEndTime = s(shift.breakEndTime)

  return {
    id: shift?._id ? String(shift._id) : null,
    code: s(shift.code),
    name: s(shift.name),
    type: s(shift.type),
    startTime: s(shift.startTime),
    breakStartTime,
    breakEndTime,
    endTime: s(shift.endTime),
    crossMidnight: shift.crossMidnight === true,
    breakMinutes: getShiftBreakMinutes(shift),
    isActive: shift.isActive !== false,
  }
}

function normalizePolicySnapshot(policy) {
  if (!policy || typeof policy !== 'object') {
    return {
      id: null,
      code: '',
      name: '',
      roundMethod: '',
      roundUnitMinutes: 0,
      minEligibleMinutes: 0,
      graceAfterShiftEndMinutes: 0,
      allowApprovedOtWithoutExactClockOut: false,
      isActive: false,
    }
  }

  return {
    id: policy?._id ? String(policy._id) : null,
    code: s(policy.code),
    name: s(policy.name),
    roundMethod: s(policy.roundMethod),
    roundUnitMinutes: Number(policy.roundUnitMinutes || 0),
    minEligibleMinutes: Number(policy.minEligibleMinutes || 0),
    graceAfterShiftEndMinutes: Number(policy.graceAfterShiftEndMinutes || 0),
    allowApprovedOtWithoutExactClockOut:
      policy.allowApprovedOtWithoutExactClockOut === true,
    isActive: policy.isActive !== false,
  }
}

function normalizeShiftOTOption(doc) {
  if (!doc) return null

  const shift = doc.shiftId && typeof doc.shiftId === 'object' ? doc.shiftId : null
  const policy =
    doc.calculationPolicyId && typeof doc.calculationPolicyId === 'object'
      ? doc.calculationPolicyId
      : null

  const requestedMinutes = Number(doc.requestedMinutes || 0)
  const timingMode = upper(doc.timingMode || 'AFTER_SHIFT_END')
  const normalizedShift = normalizeShiftSnapshot(shift)

  return {
    id: String(doc._id),
    _id: String(doc._id),

    shiftId: shift?._id
      ? String(shift._id)
      : doc.shiftId
        ? String(doc.shiftId)
        : '',

    shift: normalizedShift,

    label: s(doc.label),

    timingMode,
    startAfterShiftEndMinutes: Number(doc.startAfterShiftEndMinutes || 0),
    fixedStartTime: s(doc.fixedStartTime),
    fixedEndTime: s(doc.fixedEndTime),

    requestedMinutes,
    requestedHours: Number((requestedMinutes / 60).toFixed(2)),

    calculationPolicyId: policy?._id
      ? String(policy._id)
      : doc.calculationPolicyId
        ? String(doc.calculationPolicyId)
        : '',

    calculationPolicy: normalizePolicySnapshot(policy),

    sequence: Number(doc.sequence || 0),
    isActive: doc.isActive !== false,

    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function normalizeLookupItem(doc) {
  const item = normalizeShiftOTOption(doc)

  if (!item) return null

  const shiftLabel = [item.shift.code, item.shift.name].filter(Boolean).join(' - ')
  const policyLabel = [item.calculationPolicy.code, item.calculationPolicy.name]
    .filter(Boolean)
    .join(' - ')

  return {
    id: item.id,
    _id: item._id,

    label: item.label,
    optionLabel: `${item.label} (${item.requestedMinutes} min)`,

    timingMode: item.timingMode,
    startAfterShiftEndMinutes: item.startAfterShiftEndMinutes,
    fixedStartTime: item.fixedStartTime,
    fixedEndTime: item.fixedEndTime,

    requestedMinutes: item.requestedMinutes,
    requestedHours: item.requestedHours,
    sequence: item.sequence,

    shiftId: item.shiftId,
    shift: item.shift,
    shiftLabel,

    calculationPolicyId: item.calculationPolicyId,
    calculationPolicy: item.calculationPolicy,
    policyLabel,

    isActive: item.isActive,
  }
}

function populateQuery(query) {
  return query
    .populate({
      path: 'shiftId',
      select: {
        _id: 1,
        code: 1,
        name: 1,
        type: 1,
        startTime: 1,
        breakStartTime: 1,
        breakEndTime: 1,
        endTime: 1,
        crossMidnight: 1,
        isActive: 1,
      },
    })
    .populate({
      path: 'calculationPolicyId',
      select: {
        _id: 1,
        code: 1,
        name: 1,
        roundMethod: 1,
        roundUnitMinutes: 1,
        minEligibleMinutes: 1,
        graceAfterShiftEndMinutes: 1,
        allowApprovedOtWithoutExactClockOut: 1,
        isActive: 1,
      },
    })
}

async function assertShiftExists(shiftId) {
  const id = parseSchema(objectIdSchema, normalizeObjectIdInput(shiftId))

  const shift = await Shift.findById(id).lean()

  if (!shift) {
    throw createHttpError('Shift not found', 404)
  }

  return shift
}

async function assertPolicyExists(policyId) {
  const id = parseSchema(objectIdSchema, normalizeObjectIdInput(policyId))

  const policy = await OTCalculationPolicy.findById(id).lean()

  if (!policy) {
    throw createHttpError('OT calculation policy not found', 404)
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
    filter._id = { $ne: excludeId }
  }

  const existing = await ShiftOTOption.findOne(filter).lean()

  if (existing) {
    throw createHttpError('Active OT option label already exists for this shift', 409)
  }
}

async function ensureUniqueActiveSequence({ shiftId, sequence, excludeId = null }) {
  const filter = {
    shiftId,
    sequence: Number(sequence || 0),
    isActive: true,
  }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await ShiftOTOption.findOne(filter).lean()

  if (existing) {
    throw createHttpError('Active OT option sequence already exists for this shift', 409)
  }
}

function actorAccountId(authUser) {
  return authUser?.accountId || authUser?._id || null
}

function applyTimingModeRules(data, shift) {
  const timingMode = upper(data.timingMode || 'AFTER_SHIFT_END')

  data.timingMode = timingMode

  if (timingMode === 'AFTER_SHIFT_END') {
    data.fixedStartTime = ''
    data.fixedEndTime = ''
    data.startAfterShiftEndMinutes = Number(data.startAfterShiftEndMinutes || 0)
    data.requestedMinutes = Number(data.requestedMinutes || 0)

    return data
  }

  if (timingMode === 'FIXED_TIME') {
    if (!isValidHHmm(data.fixedStartTime)) {
      throw createHttpError('fixedStartTime must be in HH:mm format', 400)
    }

    if (!isValidHHmm(data.fixedEndTime)) {
      throw createHttpError('fixedEndTime must be in HH:mm format', 400)
    }

    if (data.fixedStartTime === data.fixedEndTime) {
      throw createHttpError('fixedStartTime and fixedEndTime cannot be the same', 400)
    }

    data.startAfterShiftEndMinutes = 0
    data.requestedMinutes = getFixedPaidMinutes({
      fixedStartTime: data.fixedStartTime,
      fixedEndTime: data.fixedEndTime,
      shift,
    })

    return data
  }

  throw createHttpError('timingMode must be AFTER_SHIFT_END or FIXED_TIME', 400)
}

async function lookup(query = {}) {
  const parsed = parseSchema(lookupShiftOTOptionsQuerySchema, query)

  const filter = buildListQuery(parsed)

  const items = await populateQuery(
    ShiftOTOption.find(filter)
      .sort({ sequence: 1, requestedMinutes: 1, _id: -1 })
      .limit(parsed.limit),
  ).lean()

  return {
    items: items.map(normalizeLookupItem),
    meta: {
      limit: parsed.limit,
      count: items.length,
    },
  }
}

async function create(payload, authUser) {
  const data = parseSchema(createShiftOTOptionSchema, payload)

  const shift = await assertShiftExists(data.shiftId)
  await assertPolicyExists(data.calculationPolicyId)

  applyTimingModeRules(data, shift)

  if (data.isActive !== false) {
    await ensureUniqueActiveLabel({
      shiftId: data.shiftId,
      label: data.label,
    })

    await ensureUniqueActiveSequence({
      shiftId: data.shiftId,
      sequence: data.sequence,
    })
  }

  const doc = await ShiftOTOption.create({
    ...data,
    createdBy: actorAccountId(authUser),
    updatedBy: actorAccountId(authUser),
  })

  return getById(String(doc._id))
}

async function update(id, payload, authUser) {
  const optionId = parseSchema(objectIdSchema, id)
  const data = parseSchema(updateShiftOTOptionSchema, payload)

  const doc = await ShiftOTOption.findById(optionId)

  if (!doc) {
    throw createHttpError('Shift OT option not found', 404)
  }

  const nextShiftId = data.shiftId || doc.shiftId
  const nextPolicyId = data.calculationPolicyId || doc.calculationPolicyId

  const nextData = {
    shiftId: nextShiftId,
    calculationPolicyId: nextPolicyId,

    label: Object.prototype.hasOwnProperty.call(data, 'label') ? data.label : doc.label,

    timingMode: Object.prototype.hasOwnProperty.call(data, 'timingMode')
      ? data.timingMode
      : doc.timingMode,

    startAfterShiftEndMinutes: Object.prototype.hasOwnProperty.call(
      data,
      'startAfterShiftEndMinutes',
    )
      ? data.startAfterShiftEndMinutes
      : doc.startAfterShiftEndMinutes,

    fixedStartTime: Object.prototype.hasOwnProperty.call(data, 'fixedStartTime')
      ? data.fixedStartTime
      : doc.fixedStartTime,

    fixedEndTime: Object.prototype.hasOwnProperty.call(data, 'fixedEndTime')
      ? data.fixedEndTime
      : doc.fixedEndTime,

    requestedMinutes: Object.prototype.hasOwnProperty.call(data, 'requestedMinutes')
      ? data.requestedMinutes
      : doc.requestedMinutes,

    sequence: Object.prototype.hasOwnProperty.call(data, 'sequence')
      ? data.sequence
      : doc.sequence,

    isActive: Object.prototype.hasOwnProperty.call(data, 'isActive')
      ? data.isActive
      : doc.isActive,
  }

  const shift = await assertShiftExists(nextShiftId)
  await assertPolicyExists(nextPolicyId)

  applyTimingModeRules(nextData, shift)

  if (nextData.isActive !== false) {
    await ensureUniqueActiveLabel({
      shiftId: nextData.shiftId,
      label: nextData.label,
      excludeId: optionId,
    })

    await ensureUniqueActiveSequence({
      shiftId: nextData.shiftId,
      sequence: nextData.sequence,
      excludeId: optionId,
    })
  }

  Object.assign(doc, {
    shiftId: nextData.shiftId,
    calculationPolicyId: nextData.calculationPolicyId,
    label: nextData.label,
    timingMode: nextData.timingMode,
    startAfterShiftEndMinutes: nextData.startAfterShiftEndMinutes,
    fixedStartTime: nextData.fixedStartTime,
    fixedEndTime: nextData.fixedEndTime,
    requestedMinutes: nextData.requestedMinutes,
    sequence: nextData.sequence,
    isActive: nextData.isActive,
    updatedBy: actorAccountId(authUser),
  })

  await doc.save()

  return getById(String(doc._id))
}

async function list(query = {}) {
  const parsed = parseSchema(listShiftOTOptionsQuerySchema, query)

  const page = parsed.page
  const limit = parsed.limit
  const skip = (page - 1) * limit

  const filter = buildListQuery(parsed)
  const sort = buildSort(parsed.sortField, parsed.sortOrder)

  const [items, total] = await Promise.all([
    populateQuery(
      ShiftOTOption.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit),
    ).lean(),
    ShiftOTOption.countDocuments(filter),
  ])

  return {
    ok: true,
    data: {
      items: items.map(normalizeShiftOTOption),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
      },
    },
  }
}

async function getById(id) {
  const optionId = parseSchema(objectIdSchema, normalizeObjectIdInput(id))

  const doc = await populateQuery(ShiftOTOption.findById(optionId)).lean()

  if (!doc) {
    throw createHttpError('Shift OT option not found', 404)
  }

  return normalizeShiftOTOption(doc)
}

module.exports = {
  lookup,
  create,
  update,
  list,
  getById,
}