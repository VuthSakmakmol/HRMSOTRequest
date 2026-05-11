// backend/src/modules/calendar/services/holiday.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')
const Holiday = require('../models/Holiday')
const { classifyDayType } = require('./dayType.service')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
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

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toYmd(value) {
  if (!value) return ''

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(
      value.getUTCDate(),
    )}`
  }

  const raw = s(value)

  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
  }

  const parsed = new Date(raw)

  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(
      parsed.getUTCDate(),
    )}`
  }

  return ''
}

function ymdToUtcDate(ymd) {
  const raw = toYmd(ymd)

  if (!raw) return null

  const [year, month, day] = raw.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

function ymdToUtcRange(ymd) {
  const start = ymdToUtcDate(ymd)

  if (!start) {
    return {
      start: null,
      end: null,
    }
  }

  return {
    start,
    end: new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    ),
  }
}

function normalizeActorId(actorId) {
  return isObjectId(actorId) ? actorId : null
}

function mapHoliday(doc) {
  if (!doc) return null

  const date = toYmd(doc.date)

  return {
    id: String(doc._id),
    _id: String(doc._id),
    date,
    code: doc.code || '',
    name: doc.name || '',
    description: doc.description || '',
    isPaidHoliday: !!doc.isPaidHoliday,
    isActive: !!doc.isActive,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapHoliday(doc)

  return {
    id: item.id,
    _id: item._id,
    date: item.date,
    code: item.code,
    name: item.name,
    description: item.description,
    label: [item.date, item.code, item.name].filter(Boolean).join(' - '),
    isPaidHoliday: item.isPaidHoliday,
    isActive: item.isActive,
  }
}

function buildDateRange(year, month) {
  if (!year && !month) return null

  const y = Number(year)
  const m = Number(month)

  if (year && month) {
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))

    return {
      $gte: start,
      $lt: end,
    }
  }

  if (year) {
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0))

    return {
      $gte: start,
      $lt: end,
    }
  }

  return null
}

function buildFromToDateRange(fromDate, toDate) {
  const fromYmd = toYmd(fromDate)
  const toYmdValue = toYmd(toDate)

  if (!fromYmd && !toYmdValue) return null

  const range = {}

  if (fromYmd) {
    const start = ymdToUtcDate(fromYmd)
    if (start) range.$gte = start
  }

  if (toYmdValue) {
    const { end } = ymdToUtcRange(toYmdValue)
    if (end) range.$lt = end
  }

  return Object.keys(range).length ? range : null
}

function buildFilter(query = {}) {
  const filter = {}

  const keyword = s(query.search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    filter.$or = [{ code: regex }, { name: regex }, { description: regex }]
  }

  if (query.isActive === 'true' || query.isActive === true) filter.isActive = true
  if (query.isActive === 'false' || query.isActive === false) filter.isActive = false

  const fromToRange = buildFromToDateRange(query.fromDate, query.toDate)

  if (fromToRange) {
    filter.date = fromToRange
    return filter
  }

  const monthRange = buildDateRange(query.year, query.month)

  if (monthRange) {
    filter.date = monthRange
  }

  return filter
}

function buildSort(sortField = 'date', sortOrder = -1) {
  const allowedFields = new Set([
    'date',
    'name',
    'code',
    'isPaidHoliday',
    'isActive',
    'createdAt',
    'updatedAt',
  ])

  const field = allowedFields.has(sortField) ? sortField : 'date'
  const direction = Number(sortOrder) === 1 ? 1 : -1

  return {
    [field]: direction,
    _id: -1,
  }
}

async function ensureObjectId(id, field = 'id') {
  if (!isObjectId(id)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid id',
      field,
      params: { value: id },
    })
  }
}

async function ensureUniqueDate(date, excludeId = null) {
  const raw = toYmd(date)
  const { start, end } = ymdToUtcRange(raw)

  if (!start || !end) {
    throw appError({
      statusCode: 400,
      code: 'HOLIDAY_INVALID_DATE',
      messageKey: 'calendar.holiday.error.invalidDate',
      message: 'Invalid holiday date',
      field: 'date',
    })
  }

  const filter = {
    date: {
      $gte: start,
      $lt: end,
    },
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await Holiday.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'HOLIDAY_DATE_EXISTS',
      messageKey: 'calendar.holiday.error.dateExists',
      message: 'A holiday already exists for this date',
      field: 'date',
      params: {
        date: raw,
      },
    })
  }
}

async function lookup(query = {}) {
  const filter = buildFilter(query)
  const limit = Number(query.limit || 50)

  const items = await Holiday.find(filter)
    .sort({ date: 1, name: 1, _id: 1 })
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

async function list(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    Holiday.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Holiday.countDocuments(filter),
  ])

  return {
    items: items.map(mapHoliday),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function getById(id) {
  await ensureObjectId(id, 'holidayId')

  const doc = await Holiday.findById(id).lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'HOLIDAY_NOT_FOUND',
      messageKey: 'calendar.holiday.error.notFound',
      message: 'Holiday not found',
      field: 'holidayId',
    })
  }

  return mapHoliday(doc)
}

async function create(payload, actorId = null) {
  await ensureUniqueDate(payload.date)

  const doc = await Holiday.create({
    date: payload.date,
    code: upper(payload.code),
    name: s(payload.name),
    description: s(payload.description),
    isPaidHoliday: payload.isPaidHoliday !== false,
    isActive: payload.isActive !== false,
    createdBy: normalizeActorId(actorId),
    updatedBy: normalizeActorId(actorId),
  })

  return getById(doc._id)
}

async function update(id, payload, actorId = null) {
  await ensureObjectId(id, 'holidayId')

  const doc = await Holiday.findById(id)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'HOLIDAY_NOT_FOUND',
      messageKey: 'calendar.holiday.error.notFound',
      message: 'Holiday not found',
      field: 'holidayId',
    })
  }

  if (payload.date !== undefined) {
    await ensureUniqueDate(payload.date, doc._id)
    doc.date = payload.date
  }

  if (payload.code !== undefined) {
    doc.code = upper(payload.code)
  }

  if (payload.name !== undefined) {
    doc.name = s(payload.name)
  }

  if (payload.description !== undefined) {
    doc.description = s(payload.description)
  }

  if (payload.isPaidHoliday !== undefined) {
    doc.isPaidHoliday = !!payload.isPaidHoliday
  }

  if (payload.isActive !== undefined) {
    doc.isActive = !!payload.isActive
  }

  doc.updatedBy = normalizeActorId(actorId)

  await doc.save()

  return getById(doc._id)
}

async function resolveDayType(date) {
  return classifyDayType(date)
}

function formatExcelDate(value) {
  const ymd = toYmd(value)

  if (!ymd) return ''

  const [year, month, day] = ymd.split('-')

  return `${day}/${month}/${year}`
}

function workbookToBuffer(workbook) {
  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
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

async function exportHolidaysExcel(query = {}) {
  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const items = await Holiday.find(filter).sort(sort).lean()

  const rows = items.map((item, index) => ({
    No: index + 1,
    Date: formatExcelDate(item.date),
    Code: item.code || '',
    Name: item.name || '',
    Description: item.description || '',
    PaidHoliday: item.isPaidHoliday ? 'Yes' : 'No',
    Status: item.isActive ? 'Active' : 'Inactive',
    CreatedAt: formatExcelDate(item.createdAt),
    UpdatedAt: formatExcelDate(item.updatedAt),
  }))

  const fallbackRows = rows.length
    ? rows
    : [
        {
          No: '',
          Date: '',
          Code: '',
          Name: '',
          Description: '',
          PaidHoliday: '',
          Status: '',
          CreatedAt: '',
          UpdatedAt: '',
        },
      ]

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(fallbackRows)

  worksheet['!cols'] = autoFitColumns(fallbackRows)

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Holidays')

  return {
    filename: `holidays-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: workbookToBuffer(workbook),
  }
}

async function downloadHolidayImportSample() {
  const sampleRows = [
    {
      Date: '01/01/2026',
      Code: 'NYD',
      Name: 'International New Year Day',
      Description: 'Public holiday',
      PaidHoliday: 'Yes',
      Status: 'Active',
    },
    {
      Date: '14/04/2026',
      Code: 'KHNY',
      Name: 'Khmer New Year',
      Description: 'Cambodian public holiday',
      PaidHoliday: 'Yes',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Holiday Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Date', 'Required. Use DD/MM/YYYY format. Example: 14/04/2026'],
    ['Code', 'Optional holiday code. Example: KHNY'],
    ['Name', 'Required. Holiday display name.'],
    ['Description', 'Optional. Maximum 1000 characters.'],
    ['PaidHoliday', 'Optional. Use Yes or No. Blank = Yes.'],
    ['Status', 'Optional. Use Active or Inactive. Blank = Active.'],
    ['', ''],
    ['Important', 'Users never need Mongo IDs. Import updates by Date.'],
  ]

  const workbook = XLSX.utils.book_new()
  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)

  sampleSheet['!cols'] = autoFitColumns(sampleRows)
  guideSheet['!cols'] = [{ wch: 24 }, { wch: 90 }]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return {
    filename: 'holiday-import-sample.xlsx',
    buffer: workbookToBuffer(workbook),
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

  const sheet = workbook.Sheets[preferredSheetName]

  if (!sheet) return []

  return XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  })
}

function normalizeImportBoolean(value, defaultValue = true) {
  const text = s(value).toLowerCase()

  if (!text) return defaultValue
  if (['yes', 'y', 'true', '1', 'paid', 'active'].includes(text)) return true
  if (['no', 'n', 'false', '0', 'unpaid', 'inactive'].includes(text)) return false

  return 'INVALID_BOOLEAN'
}

function normalizeImportStatus(value) {
  const text = s(value).toLowerCase()

  if (!text) return true
  if (['active', 'true', 'yes', 'y', '1'].includes(text)) return true
  if (['inactive', 'false', 'no', 'n', '0'].includes(text)) return false

  return 'INVALID_STATUS'
}

function getCell(row, names = []) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return row[name]
    }
  }

  const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[upper(key).replace(/\s+/g, '')] = value
    return acc
  }, {})

  for (const name of names) {
    const key = upper(name).replace(/\s+/g, '')
    const value = normalized[key]

    if (value !== undefined) return value
  }

  return ''
}

function parseImportDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return ymdToUtcDate(toYmd(value))
  }

  const raw = s(value)

  if (!raw) return null

  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (ddmmyyyy) {
    return ymdToUtcDate(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`)
  }

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (ymd) {
    return ymdToUtcDate(raw)
  }

  return null
}

async function importHolidaysExcel(fileBuffer) {
  if (!fileBuffer) {
    throw appError({
      statusCode: 400,
      code: 'HOLIDAY_EXCEL_FILE_REQUIRED',
      messageKey: 'calendar.holiday.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  const rows = readWorkbookRows(fileBuffer)

  if (!rows.length) {
    throw appError({
      statusCode: 400,
      code: 'HOLIDAY_EXCEL_NO_ROWS',
      messageKey: 'calendar.holiday.error.excelNoRows',
      message: 'Excel file has no rows',
    })
  }

  const seenDates = new Set()

  const normalizedRows = rows
    .map((row, index) => {
      const rowNo = index + 2
      const date = parseImportDate(getCell(row, ['Date', 'Holiday Date']))
      const code = upper(getCell(row, ['Code', 'Holiday Code']))
      const name = s(getCell(row, ['Name', 'Holiday Name']))
      const description = s(getCell(row, ['Description']))
      const isPaidHoliday = normalizeImportBoolean(
        getCell(row, ['PaidHoliday', 'Paid Holiday', 'Is Paid Holiday']),
        true,
      )
      const isActive = normalizeImportStatus(getCell(row, ['Status', 'Active', 'Is Active']))

      if (!date && !code && !name && !description) {
        return null
      }

      if (!date) {
        throw appError({
          statusCode: 400,
          code: 'HOLIDAY_IMPORT_DATE_REQUIRED',
          messageKey: 'calendar.holiday.import.error.dateRequired',
          message: `Row ${rowNo}: Date is required. Use DD/MM/YYYY.`,
          params: { rowNo },
        })
      }

      if (!name) {
        throw appError({
          statusCode: 400,
          code: 'HOLIDAY_IMPORT_NAME_REQUIRED',
          messageKey: 'calendar.holiday.import.error.nameRequired',
          message: `Row ${rowNo}: Name is required`,
          params: { rowNo },
        })
      }

      if (isPaidHoliday === 'INVALID_BOOLEAN') {
        throw appError({
          statusCode: 400,
          code: 'HOLIDAY_IMPORT_INVALID_PAID_HOLIDAY',
          messageKey: 'calendar.holiday.import.error.invalidPaidHoliday',
          message: `Row ${rowNo}: Invalid PaidHoliday value`,
          params: { rowNo },
        })
      }

      if (isActive === 'INVALID_STATUS') {
        throw appError({
          statusCode: 400,
          code: 'HOLIDAY_IMPORT_INVALID_STATUS',
          messageKey: 'calendar.holiday.import.error.invalidStatus',
          message: `Row ${rowNo}: Invalid status`,
          params: { rowNo },
        })
      }

      const dateKey = toYmd(date)

      if (seenDates.has(dateKey)) {
        throw appError({
          statusCode: 400,
          code: 'HOLIDAY_IMPORT_DUPLICATE_DATE',
          messageKey: 'calendar.holiday.import.error.duplicateDate',
          message: `Row ${rowNo}: Duplicate date in import file`,
          params: { rowNo, date: dateKey },
        })
      }

      seenDates.add(dateKey)

      return {
        rowNo,
        date,
        dateKey,
        code,
        name,
        description,
        isPaidHoliday,
        isActive,
      }
    })
    .filter(Boolean)

  let created = 0
  let updated = 0

  for (const row of normalizedRows) {
    const { start, end } = ymdToUtcRange(row.dateKey)

    const existing = await Holiday.findOne({
      date: {
        $gte: start,
        $lt: end,
      },
    })

    if (existing) {
      existing.code = row.code
      existing.name = row.name
      existing.description = row.description
      existing.isPaidHoliday = row.isPaidHoliday
      existing.isActive = row.isActive

      await existing.save()
      updated += 1
      continue
    }

    await Holiday.create({
      date: row.date,
      code: row.code,
      name: row.name,
      description: row.description,
      isPaidHoliday: row.isPaidHoliday,
      isActive: row.isActive,
    })

    created += 1
  }

  return {
    summary: {
      totalRows: normalizedRows.length,
      created,
      updated,
    },
    messageKey: 'calendar.holiday.import.success.completed',
  }
}

module.exports = {
  lookup,
  list,
  getById,
  create,
  update,
  resolveDayType,
  exportHolidaysExcel,
  downloadHolidayImportSample,
  importHolidaysExcel,
}