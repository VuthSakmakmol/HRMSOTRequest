// backend/src/modules/shift/services/shift.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')
const Shift = require('../models/Shift')

const {
  objectIdSchema,
  importShiftRowSchema,
} = require('../validators/shift.validation')

const DAY_MINUTES = 24 * 60

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
  const timeline = buildShiftTimeline(payload)

  if (payload.startTime === payload.endTime) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_START_END_SAME',
      messageKey: 'shift.error.startEndSame',
      message: 'Shift start time and end time cannot be the same',
      field: 'endTime',
    })
  }

  if (payload.breakStartTime === payload.breakEndTime) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_BREAK_START_END_SAME',
      messageKey: 'shift.error.breakStartEndSame',
      message: 'Break start time and break end time cannot be the same',
      field: 'breakEndTime',
    })
  }

  if (payload.type === 'DAY' && timeline.crossMidnight) {
    throw appError({
      statusCode: 400,
      code: 'DAY_SHIFT_CANNOT_CROSS_MIDNIGHT',
      messageKey: 'shift.error.dayCannotCrossMidnight',
      message: 'DAY shift cannot cross midnight',
      field: 'type',
    })
  }

  if (payload.type === 'NIGHT' && !timeline.crossMidnight) {
    throw appError({
      statusCode: 400,
      code: 'NIGHT_SHIFT_MUST_CROSS_MIDNIGHT',
      messageKey: 'shift.error.nightMustCrossMidnight',
      message: 'NIGHT shift must cross midnight',
      field: 'type',
    })
  }

  if (timeline.breakEndMin <= timeline.breakStartMin) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_BREAK_END_BEFORE_START',
      messageKey: 'shift.error.breakEndBeforeStart',
      message: 'Break end time must be later than break start time',
      field: 'breakEndTime',
    })
  }

  if (
    timeline.breakStartMin < timeline.startMin ||
    timeline.breakEndMin > timeline.endMin
  ) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_BREAK_OUTSIDE_SHIFT',
      messageKey: 'shift.error.breakOutsideShift',
      message: 'Break time must be inside shift working time',
      field: 'breakStartTime',
    })
  }
}

function calculateGrossMinutes(payload) {
  const timeline = buildShiftTimeline(payload)

  return Math.max(0, timeline.endMin - timeline.startMin)
}

function calculateBreakMinutes(payload) {
  const timeline = buildShiftTimeline(payload)

  return Math.max(0, timeline.breakEndMin - timeline.breakStartMin)
}

function calculateWorkingMinutes(payload) {
  return Math.max(0, calculateGrossMinutes(payload) - calculateBreakMinutes(payload))
}

function buildFilter(query = {}) {
  const filter = {}

  const keyword = s(query.search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    filter.$or = [{ code: regex }, { name: regex }]
  }

  if (query.type) {
    filter.type = upper(query.type)
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const allowedFields = new Set([
    'createdAt',
    'updatedAt',
    'code',
    'name',
    'type',
    'startTime',
    'endTime',
    'isActive',
  ])

  const field = allowedFields.has(sortField) ? sortField : 'createdAt'
  const direction = Number(sortOrder) === 1 ? 1 : -1

  return {
    [field]: direction,
    _id: -1,
  }
}

function mapShift(doc) {
  if (!doc) return null

  const startTime = doc.startTime || ''
  const breakStartTime = doc.breakStartTime || ''
  const breakEndTime = doc.breakEndTime || ''
  const endTime = doc.endTime || ''

  const source = {
    startTime,
    breakStartTime,
    breakEndTime,
    endTime,
  }

  const timeline = buildShiftTimeline(source)
  const grossMinutes = calculateGrossMinutes(source)
  const breakMinutes = calculateBreakMinutes(source)
  const workingMinutes = calculateWorkingMinutes(source)

  return {
    id: id(doc._id),
    _id: id(doc._id),

    code: doc.code || '',
    name: doc.name || '',
    label: [doc.code, doc.name].filter(Boolean).join(' - '),

    type: doc.type || 'DAY',
    typeKey: doc.type === 'NIGHT' ? 'shift.type.night' : 'shift.type.day',

    startTime,
    breakStartTime,
    breakEndTime,
    endTime,

    crossMidnight: timeline.crossMidnight,

    grossMinutes,
    breakMinutes,
    breakTimeMinutes: breakMinutes,
    workingMinutes,

    isActive: !!doc.isActive,
    statusCode: doc.isActive ? 'ACTIVE' : 'INACTIVE',
    statusKey: doc.isActive ? 'common.status.active' : 'common.status.inactive',
    statusSeverity: doc.isActive ? 'success' : 'danger',

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapShift(doc)

  return {
    id: item.id,
    _id: item._id,

    code: item.code,
    name: item.name,
    label: item.label,

    type: item.type,
    typeKey: item.typeKey,

    startTime: item.startTime,
    breakStartTime: item.breakStartTime,
    breakEndTime: item.breakEndTime,
    endTime: item.endTime,

    crossMidnight: item.crossMidnight,

    grossMinutes: item.grossMinutes,
    breakMinutes: item.breakMinutes,
    breakTimeMinutes: item.breakTimeMinutes,
    workingMinutes: item.workingMinutes,

    isActive: item.isActive,
  }
}

async function ensureObjectId(value, field = 'shiftId') {
  if (!isObjectId(value)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid id',
      field,
      params: {
        value,
      },
    })
  }
}

async function ensureUniqueCode(code, excludeId = null) {
  const normalizedCode = upper(code)

  const filter = {
    code: normalizedCode,
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await Shift.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'SHIFT_CODE_EXISTS',
      messageKey: 'shift.error.codeExists',
      message: 'Shift code already exists',
      field: 'code',
      params: {
        code: normalizedCode,
      },
    })
  }
}

async function lookupShifts(query = {}) {
  const limit = Number(query.limit || 50)
  const filter = buildFilter(query)

  const items = await Shift.find(filter)
    .sort({ code: 1, name: 1, _id: 1 })
    .limit(limit)
    .lean()

  return {
    items: items.map(mapLookupItem),
    meta: {
      limit,
      count: items.length,
    },
  }
}

async function listShifts(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    Shift.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Shift.countDocuments(filter),
  ])

  return {
    items: items.map(mapShift),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function getShiftById(shiftId) {
  const idValue = objectIdSchema.parse(shiftId)

  const doc = await Shift.findById(idValue).lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_NOT_FOUND',
      messageKey: 'shift.error.notFound',
      message: 'Shift not found',
      field: 'shiftId',
    })
  }

  return mapShift(doc)
}

async function createShift(payload) {
  const data = {
    ...payload,
    code: upper(payload.code),
    type: upper(payload.type),
  }

  validateShiftBusinessRules(data)
  await ensureUniqueCode(data.code)

  const doc = await Shift.create({
    code: data.code,
    name: s(data.name),
    type: data.type,
    startTime: data.startTime,
    breakStartTime: data.breakStartTime,
    breakEndTime: data.breakEndTime,
    endTime: data.endTime,
    isActive: data.isActive ?? true,
  })

  return getShiftById(doc._id)
}

async function updateShift(shiftId, payload) {
  await ensureObjectId(shiftId, 'shiftId')

  const existing = await Shift.findById(shiftId)

  if (!existing) {
    throw appError({
      statusCode: 404,
      code: 'SHIFT_NOT_FOUND',
      messageKey: 'shift.error.notFound',
      message: 'Shift not found',
      field: 'shiftId',
    })
  }

  const merged = {
    code: payload.code !== undefined ? upper(payload.code) : existing.code,
    name: payload.name !== undefined ? s(payload.name) : existing.name,
    type: payload.type !== undefined ? upper(payload.type) : existing.type,
    startTime: payload.startTime !== undefined ? payload.startTime : existing.startTime,
    breakStartTime:
      payload.breakStartTime !== undefined
        ? payload.breakStartTime
        : existing.breakStartTime,
    breakEndTime:
      payload.breakEndTime !== undefined ? payload.breakEndTime : existing.breakEndTime,
    endTime: payload.endTime !== undefined ? payload.endTime : existing.endTime,
    isActive: payload.isActive !== undefined ? payload.isActive : existing.isActive,
  }

  validateShiftBusinessRules(merged)

  if (payload.code !== undefined && upper(payload.code) !== existing.code) {
    await ensureUniqueCode(payload.code, existing._id)
  }

  existing.code = merged.code
  existing.name = merged.name
  existing.type = merged.type
  existing.startTime = merged.startTime
  existing.breakStartTime = merged.breakStartTime
  existing.breakEndTime = merged.breakEndTime
  existing.endTime = merged.endTime
  existing.isActive = !!merged.isActive

  await existing.save()

  return getShiftById(existing._id)
}

function autoFitColumns(rows = []) {
  const widths = []

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key, index) => {
      const raw = row[key]
      const value = raw === null || raw === undefined ? '' : String(raw)
      const current = widths[index] || { wch: String(key).length + 2 }

      current.wch = Math.min(Math.max(current.wch, value.length + 2), 45)
      widths[index] = current
    })
  })

  return widths
}

function workbookToBuffer(workbook) {
  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function formatExcelDate(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

async function exportShiftsExcel(query = {}) {
  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const items = await Shift.find(filter).sort(sort).lean()

  const rows = items.map((doc, index) => {
    const item = mapShift(doc)

    return {
      No: index + 1,
      'Shift ID': item.id,
      Code: item.code,
      Name: item.name,
      Type: item.type,
      StartTime: item.startTime,
      BreakStartTime: item.breakStartTime,
      BreakEndTime: item.breakEndTime,
      EndTime: item.endTime,
      CrossMidnight: item.crossMidnight ? 'Yes' : 'No',
      GrossMinutes: item.grossMinutes,
      BreakMinutes: item.breakMinutes,
      WorkingMinutes: item.workingMinutes,
      Status: item.isActive ? 'Active' : 'Inactive',
      CreatedAt: formatExcelDate(item.createdAt),
      UpdatedAt: formatExcelDate(item.updatedAt),
    }
  })

  const fallbackRows = rows.length
    ? rows
    : [
        {
          No: '',
          'Shift ID': '',
          Code: '',
          Name: '',
          Type: '',
          StartTime: '',
          BreakStartTime: '',
          BreakEndTime: '',
          EndTime: '',
          CrossMidnight: '',
          GrossMinutes: '',
          BreakMinutes: '',
          WorkingMinutes: '',
          Status: '',
          CreatedAt: '',
          UpdatedAt: '',
        },
      ]

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(fallbackRows)

  worksheet['!cols'] = autoFitColumns(fallbackRows)

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Shifts')

  return {
    filename: `shifts-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: workbookToBuffer(workbook),
  }
}

async function downloadShiftImportSample() {
  const sampleRows = [
    {
      'Shift ID': '',
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
      'Shift ID': '',
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
    ['Shift Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Shift ID', 'Leave blank to create. Fill Mongo Shift ID to update existing shift.'],
    ['Code', 'Required. Unique shift code. Display/search only.'],
    ['Name', 'Required.'],
    ['Type', 'DAY or NIGHT. DAY cannot cross midnight. NIGHT must cross midnight.'],
    ['StartTime', 'Required. HH:mm format.'],
    ['BreakStartTime', 'Required. HH:mm format. Must be inside shift time.'],
    ['BreakEndTime', 'Required. HH:mm format. Must be inside shift time.'],
    ['EndTime', 'Required. HH:mm format.'],
    ['Status', 'Active or Inactive. Blank = Active.'],
  ]

  const workbook = XLSX.utils.book_new()
  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)

  sampleSheet['!cols'] = autoFitColumns(sampleRows)
  guideSheet['!cols'] = [{ wch: 24 }, { wch: 90 }]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return {
    filename: 'shift-import-sample.xlsx',
    buffer: workbookToBuffer(workbook),
  }
}

function getCell(row, keys = []) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key]
    }
  }

  const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[upper(key)] = value
    return acc
  }, {})

  for (const key of keys) {
    const value = normalized[upper(key)]

    if (value !== undefined) return value
  }

  return ''
}

function normalizeImportStatus(value) {
  const text = s(value).toLowerCase()

  if (!text) return true
  if (['active', 'true', 'yes', 'y', '1'].includes(text)) return true
  if (['inactive', 'false', 'no', 'n', '0'].includes(text)) return false

  return 'INVALID_BOOLEAN'
}

function normalizeImportRow(row = {}, index = 0) {
  const rowNo = index + 2

  return {
    rowNo,
    shiftId: s(getCell(row, ['Shift ID', 'shiftId'])),
    code: upper(getCell(row, ['Code', 'Shift Code', 'code'])),
    name: s(getCell(row, ['Name', 'Shift Name', 'name'])),
    type: upper(getCell(row, ['Type', 'type'])),
    startTime: normalizeExcelTime(getCell(row, ['StartTime', 'Start Time', 'startTime'])),
    breakStartTime: normalizeExcelTime(
      getCell(row, ['BreakStartTime', 'Break Start Time', 'Break Start', 'breakStartTime']),
    ),
    breakEndTime: normalizeExcelTime(
      getCell(row, ['BreakEndTime', 'Break End Time', 'Break End', 'breakEndTime']),
    ),
    endTime: normalizeExcelTime(getCell(row, ['EndTime', 'End Time', 'endTime'])),
    isActive: normalizeImportStatus(getCell(row, ['Status', 'Active', 'IsActive', 'isActive'])),
  }
}

function readWorkbookRows(buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
  })

  const preferredSheetName = workbook.SheetNames.includes('Sample')
    ? 'Sample'
    : workbook.SheetNames[0]

  if (!preferredSheetName) return []

  const worksheet = workbook.Sheets[preferredSheetName]

  if (!worksheet) return []

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
  })
}

async function importShiftsExcel(fileBuffer) {
  if (!fileBuffer) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_EXCEL_FILE_REQUIRED',
      messageKey: 'shift.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  const rows = readWorkbookRows(fileBuffer)

  if (!rows.length) {
    throw appError({
      statusCode: 400,
      code: 'SHIFT_EXCEL_NO_ROWS',
      messageKey: 'shift.error.excelNoRows',
      message: 'Excel file has no rows',
    })
  }

  const parsedRows = rows
    .map(normalizeImportRow)
    .filter(
      (row) =>
        row.shiftId ||
        row.code ||
        row.name ||
        row.type ||
        row.startTime ||
        row.breakStartTime ||
        row.breakEndTime ||
        row.endTime,
    )

  const seenShiftIds = new Set()
  const seenCodes = new Set()

  for (const row of parsedRows) {
    if (row.isActive === 'INVALID_BOOLEAN') {
      throw appError({
        statusCode: 400,
        code: 'SHIFT_IMPORT_INVALID_STATUS',
        messageKey: 'shift.import.error.invalidStatus',
        message: `Row ${row.rowNo}: Invalid status`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    const result = importShiftRowSchema.safeParse(row)

    if (!result.success) {
      throw appError({
        statusCode: 400,
        code: 'SHIFT_IMPORT_ROW_INVALID',
        messageKey: result.error.issues[0]?.message || 'shift.import.error.rowInvalid',
        message: `Row ${row.rowNo}: ${result.error.issues[0]?.message || 'Invalid data'}`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    validateShiftBusinessRules(result.data)

    if (row.shiftId) {
      if (seenShiftIds.has(row.shiftId)) {
        throw appError({
          statusCode: 400,
          code: 'SHIFT_IMPORT_DUPLICATE_SHIFT_ID',
          messageKey: 'shift.import.error.duplicateShiftId',
          message: `Row ${row.rowNo}: Duplicate Shift ID in import file`,
          params: {
            rowNo: row.rowNo,
            shiftId: row.shiftId,
          },
        })
      }

      seenShiftIds.add(row.shiftId)
    }

    if (seenCodes.has(row.code)) {
      throw appError({
        statusCode: 400,
        code: 'SHIFT_IMPORT_DUPLICATE_CODE',
        messageKey: 'shift.import.error.duplicateCode',
        message: `Row ${row.rowNo}: Duplicate Code in import file`,
        params: {
          rowNo: row.rowNo,
          code: row.code,
        },
      })
    }

    seenCodes.add(row.code)
  }

  let created = 0
  let updated = 0

  for (const row of parsedRows) {
    const data = importShiftRowSchema.parse(row)
    const existing = data.shiftId ? await Shift.findById(data.shiftId) : null

    if (data.shiftId && !existing) {
      throw appError({
        statusCode: 404,
        code: 'SHIFT_IMPORT_SHIFT_ID_NOT_FOUND',
        messageKey: 'shift.import.error.shiftIdNotFound',
        message: `Row ${row.rowNo}: Shift ID not found`,
        params: {
          rowNo: row.rowNo,
          shiftId: data.shiftId,
        },
      })
    }

    await ensureUniqueCode(data.code, existing?._id || null)

    const payload = {
      code: upper(data.code),
      name: s(data.name),
      type: upper(data.type),
      startTime: data.startTime,
      breakStartTime: data.breakStartTime,
      breakEndTime: data.breakEndTime,
      endTime: data.endTime,
      isActive: data.isActive,
    }

    validateShiftBusinessRules(payload)

    if (existing) {
      Object.assign(existing, payload)
      await existing.save()
      updated += 1
      continue
    }

    await Shift.create(payload)
    created += 1
  }

  return {
    summary: {
      totalRows: parsedRows.length,
      created,
      updated,
    },
    messageKey: 'shift.import.success.completed',
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

  // Used by OT/Attendance/Payment modules later.
  buildShiftTimeline,
  calculateGrossMinutes,
  calculateBreakMinutes,
  calculateWorkingMinutes,
}