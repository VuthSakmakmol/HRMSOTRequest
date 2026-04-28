// backend/src/modules/shift/services/shift.service.js
const XLSX = require('xlsx')

const Shift = require('../models/Shift')
const {
  objectIdSchema,
  createShiftSchema,
  updateShiftSchema,
  listShiftQuerySchema,
} = require('../validators/shift.validation')

const DAY_MINUTES = 24 * 60

function createHttpError(message, status = 400) {
  const err = new Error(message)
  err.status = status
  return err
}

function s(value) {
  return String(value ?? '').trim()
}

function escapeRegex(value) {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toMinutes(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number)
  return hours * 60 + minutes
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeExcelTime(value) {
  if (value instanceof Date) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const totalMinutes = Math.round(value * DAY_MINUTES) % DAY_MINUTES
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${pad2(hours)}:${pad2(minutes)}`
  }

  const text = s(value).replace('.', ':')
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)

  if (!match) return text

  return `${pad2(Number(match[1]))}:${match[2]}`
}

function isCrossMidnight(startTime, endTime) {
  return toMinutes(endTime) <= toMinutes(startTime)
}

function buildShiftTimeline(payload) {
  const startMin = toMinutes(payload.startTime)
  const endRawMin = toMinutes(payload.endTime)
  const crossMidnight = endRawMin <= startMin
  const endMin = crossMidnight ? endRawMin + DAY_MINUTES : endRawMin

  const breakStartRawMin = toMinutes(payload.breakStartTime)
  const breakEndRawMin = toMinutes(payload.breakEndTime)

  let breakStartMin = breakStartRawMin
  let breakEndMin = breakEndRawMin

  if (crossMidnight && breakStartMin < startMin) {
    breakStartMin += DAY_MINUTES
  }

  if (crossMidnight && breakEndMin <= startMin) {
    breakEndMin += DAY_MINUTES
  }

  return {
    startMin,
    endMin,
    breakStartMin,
    breakEndMin,
    crossMidnight,
  }
}

function validateShiftBusinessRules(payload) {
  const start = payload.startTime
  const breakStart = payload.breakStartTime
  const breakEnd = payload.breakEndTime
  const end = payload.endTime
  const type = payload.type

  if (breakStart === breakEnd) {
    throw createHttpError('Break start time and break end time cannot be the same', 400)
  }

  const timeline = buildShiftTimeline(payload)

  if (type === 'DAY' && timeline.crossMidnight) {
    throw createHttpError('DAY shift cannot cross midnight', 400)
  }

  if (type === 'NIGHT' && !timeline.crossMidnight) {
    throw createHttpError('NIGHT shift must cross midnight', 400)
  }

  if (timeline.breakEndMin <= timeline.breakStartMin) {
    throw createHttpError('Break end time must be later than break start time', 400)
  }

  if (
    timeline.breakStartMin < timeline.startMin ||
    timeline.breakEndMin > timeline.endMin
  ) {
    throw createHttpError('Break time must be inside shift working time', 400)
  }

  if (start === end) {
    throw createHttpError('Shift start time and end time cannot be the same', 400)
  }
}

function calculateWorkingMinutes(doc) {
  try {
    const timeline = buildShiftTimeline(doc)
    const breakMinutes = timeline.breakEndMin - timeline.breakStartMin
    return Math.max(0, timeline.endMin - timeline.startMin - breakMinutes)
  } catch {
    return 0
  }
}

function buildListQuery(query = {}) {
  const filter = {}

  const search = s(query.search)
  if (search) {
    const keyword = escapeRegex(search)
    filter.$or = [
      { code: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
    ]
  }

  if (query.type) {
    filter.type = query.type
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = Boolean(query.isActive)
  }

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const direction = Number(sortOrder) === 1 ? 1 : -1

  if (sortField === 'code') return { code: direction, _id: -1 }
  if (sortField === 'name') return { name: direction, _id: -1 }
  if (sortField === 'type') return { type: direction, code: 1, _id: -1 }
  if (sortField === 'startTime') return { startTime: direction, code: 1, _id: -1 }
  if (sortField === 'endTime') return { endTime: direction, code: 1, _id: -1 }
  if (sortField === 'isActive') return { isActive: direction, code: 1, _id: -1 }
  if (sortField === 'updatedAt') return { updatedAt: direction, _id: -1 }

  return { createdAt: direction, _id: -1 }
}

function normalizeShift(doc) {
  if (!doc) return null

  const startTime = doc.startTime || ''
  const endTime = doc.endTime || ''

  return {
    id: String(doc._id),
    _id: String(doc._id),
    code: doc.code || '',
    name: doc.name || '',
    type: doc.type || 'DAY',
    startTime,
    breakStartTime: doc.breakStartTime || '',
    breakEndTime: doc.breakEndTime || '',
    endTime,
    crossMidnight: startTime && endTime ? isCrossMidnight(startTime, endTime) : false,
    workingMinutes: calculateWorkingMinutes(doc),
    isActive: !!doc.isActive,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function normalizeShiftLookupItem(doc) {
  if (!doc) return null

  const item = normalizeShift(doc)

  return {
    id: item.id,
    code: item.code,
    name: item.name,
    type: item.type,
    startTime: item.startTime,
    endTime: item.endTime,
    label: [item.code, item.name].filter(Boolean).join(' - '),
    isActive: item.isActive,
  }
}

async function ensureUniqueCode(code, excludeId = null) {
  const filter = { code: s(code).toUpperCase() }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await Shift.findOne(filter).lean()

  if (existing) {
    throw createHttpError('Shift code already exists', 409)
  }
}

async function lookupShifts(query = {}) {
  const search = s(query.search)
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50)

  let isActive = true
  if (String(query.isActive ?? '').trim().toLowerCase() === 'false') {
    isActive = false
  }

  const filter = buildListQuery({
    search,
    isActive,
  })

  const items = await Shift.find(filter)
    .sort({ code: 1, name: 1, _id: -1 })
    .limit(limit)
    .lean()

  return {
    items: items.map(normalizeShiftLookupItem),
    meta: {
      limit,
      count: items.length,
    },
  }
}

async function listShifts(query = {}) {
  const parsed = listShiftQuerySchema.parse(query)

  const page = parsed.page
  const limit = parsed.limit
  const skip = (page - 1) * limit

  const filter = buildListQuery(parsed)
  const sort = buildSort(parsed.sortField, parsed.sortOrder)

  const [items, total] = await Promise.all([
    Shift.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Shift.countDocuments(filter),
  ])

  return {
    ok: true,
    data: {
      items: items.map(normalizeShift),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
      },
    },
  }
}

async function getShiftById(id) {
  const shiftId = objectIdSchema.parse(id)

  const doc = await Shift.findById(shiftId).lean()

  if (!doc) {
    throw createHttpError('Shift not found', 404)
  }

  return normalizeShift(doc)
}

async function createShift(payload) {
  const data = createShiftSchema.parse(payload)

  validateShiftBusinessRules(data)
  await ensureUniqueCode(data.code)

  const doc = await Shift.create(data)

  return normalizeShift(doc.toObject())
}

async function updateShift(id, payload) {
  const shiftId = objectIdSchema.parse(id)
  const data = updateShiftSchema.parse(payload)

  const existing = await Shift.findById(shiftId)

  if (!existing) {
    throw createHttpError('Shift not found', 404)
  }

  const merged = {
    code: data.code ?? existing.code,
    name: data.name ?? existing.name,
    type: data.type ?? existing.type,
    startTime: data.startTime ?? existing.startTime,
    breakStartTime: data.breakStartTime ?? existing.breakStartTime,
    breakEndTime: data.breakEndTime ?? existing.breakEndTime,
    endTime: data.endTime ?? existing.endTime,
    isActive: data.isActive ?? existing.isActive,
  }

  validateShiftBusinessRules(merged)

  if (data.code && data.code !== existing.code) {
    await ensureUniqueCode(data.code, shiftId)
  }

  Object.assign(existing, data)
  await existing.save()

  return normalizeShift(existing.toObject())
}

async function exportShiftsExcel(query = {}) {
  const parsed = listShiftQuerySchema.parse({
    ...query,
    page: 1,
    limit: 100,
  })

  const filter = buildListQuery(parsed)
  const sort = buildSort(parsed.sortField, parsed.sortOrder)

  const items = await Shift.find(filter).sort(sort).lean()

  const rows = items.map((item, index) => {
    const normalized = normalizeShift(item)

    return {
      No: index + 1,
      Code: normalized.code,
      Name: normalized.name,
      Type: normalized.type,
      StartTime: normalized.startTime,
      BreakStartTime: normalized.breakStartTime,
      BreakEndTime: normalized.breakEndTime,
      EndTime: normalized.endTime,
      CrossMidnight: normalized.crossMidnight ? 'Yes' : 'No',
      WorkingMinutes: normalized.workingMinutes,
      Status: normalized.isActive ? 'Active' : 'Inactive',
      CreatedAt: normalized.createdAt ? new Date(normalized.createdAt).toLocaleString() : '',
      UpdatedAt: normalized.updatedAt ? new Date(normalized.updatedAt).toLocaleString() : '',
    }
  })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)

  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
  ]

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Shifts')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

async function downloadShiftImportSample() {
  const sampleRows = [
    {
      Code: 'DAY-0700',
      Name: 'Day Shift 07:00 - 16:00',
      Type: 'DAY',
      StartTime: '07:00',
      BreakStartTime: '12:00',
      BreakEndTime: '13:00',
      EndTime: '16:00',
      Status: 'Active',
    },
    {
      Code: 'NIGHT-1800',
      Name: 'Night Shift 18:00 - 03:00',
      Type: 'NIGHT',
      StartTime: '18:00',
      BreakStartTime: '22:00',
      BreakEndTime: '23:00',
      EndTime: '03:00',
      Status: 'Active',
    },
  ]

  const guideRows = [
    { Field: 'Code', Required: 'Yes', Note: 'Unique shift code. Example: DAY-0700' },
    { Field: 'Name', Required: 'Yes', Note: 'Shift display name' },
    { Field: 'Type', Required: 'Yes', Note: 'Use DAY or NIGHT' },
    { Field: 'StartTime', Required: 'Yes', Note: 'Use HH:mm format. Example: 07:00' },
    { Field: 'BreakStartTime', Required: 'Yes', Note: 'Use HH:mm format. Example: 12:00' },
    { Field: 'BreakEndTime', Required: 'Yes', Note: 'Use HH:mm format. Example: 13:00' },
    { Field: 'EndTime', Required: 'Yes', Note: 'Use HH:mm format. Example: 16:00' },
    { Field: 'Status', Required: 'No', Note: 'Use Active or Inactive. Default is Active' },
  ]

  const workbook = XLSX.utils.book_new()

  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.json_to_sheet(guideRows)

  sampleSheet['!cols'] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
  ]

  guideSheet['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 60 },
  ]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && s(row[key]) !== '') {
      return row[key]
    }
  }

  return ''
}

function parseImportStatus(value) {
  const text = s(value).toLowerCase()

  if (!text) return true
  if (['inactive', 'false', 'no', '0'].includes(text)) return false

  return true
}

async function importShiftsExcel(fileBuffer) {
  if (!fileBuffer) {
    throw createHttpError('Excel file is required', 400)
  }

  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
    cellDates: true,
  })

  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw createHttpError('Excel sheet is empty', 400)
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

  if (!rows.length) {
    throw createHttpError('Excel file has no rows', 400)
  }

  const preparedMap = new Map()

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    const rawCode = s(pick(row, ['Code', 'code', 'Shift Code', 'ShiftCode'])).toUpperCase()
    const rawName = s(pick(row, ['Name', 'name', 'Shift Name', 'ShiftName']))
    const rawType = s(pick(row, ['Type', 'type'])).toUpperCase()

    const rawStartTime = normalizeExcelTime(pick(row, ['StartTime', 'Start Time', 'startTime']))
    const rawBreakStartTime = normalizeExcelTime(
      pick(row, ['BreakStartTime', 'Break Start Time', 'Break Start', 'breakStartTime']),
    )
    const rawBreakEndTime = normalizeExcelTime(
      pick(row, ['BreakEndTime', 'Break End Time', 'Break End', 'breakEndTime']),
    )
    const rawEndTime = normalizeExcelTime(pick(row, ['EndTime', 'End Time', 'endTime']))

    const rawStatus = pick(row, ['Status', 'status', 'IsActive', 'isActive'])

    const isBlankRow =
      !rawCode &&
      !rawName &&
      !rawType &&
      !rawStartTime &&
      !rawBreakStartTime &&
      !rawBreakEndTime &&
      !rawEndTime

    if (isBlankRow) return

    try {
      const payload = createShiftSchema.parse({
        code: rawCode,
        name: rawName,
        type: rawType,
        startTime: rawStartTime,
        breakStartTime: rawBreakStartTime,
        breakEndTime: rawBreakEndTime,
        endTime: rawEndTime,
        isActive: parseImportStatus(rawStatus),
      })

      validateShiftBusinessRules(payload)

      preparedMap.set(payload.code, payload)
    } catch (error) {
      const message = error?.issues?.[0]?.message || error?.message || 'Invalid row'
      throw createHttpError(`Row ${rowNumber}: ${message}`, 400)
    }
  })

  const preparedRows = Array.from(preparedMap.values())

  if (!preparedRows.length) {
    throw createHttpError('Excel file has no valid shift rows', 400)
  }

  let createdCount = 0
  let updatedCount = 0

  for (const payload of preparedRows) {
    const existing = await Shift.findOne({ code: payload.code })

    if (existing) {
      Object.assign(existing, payload)
      await existing.save()
      updatedCount += 1
    } else {
      await Shift.create(payload)
      createdCount += 1
    }
  }

  return {
    createdCount,
    updatedCount,
  }
}

module.exports = {
  lookupShifts,
  listShifts,
  getShiftById,
  createShift,
  updateShift,
  exportShiftsExcel,
  downloadShiftImportSample,
  importShiftsExcel,
}