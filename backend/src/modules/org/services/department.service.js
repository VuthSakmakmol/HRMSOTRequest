// backend/src/modules/org/services/department.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')
const Department = require('../models/Department')

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

function mapDepartment(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    _id: String(doc._id),
    code: doc.code || '',
    name: doc.name || '',
    isActive: !!doc.isActive,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapDepartment(doc)

  return {
    id: item.id,
    _id: item._id,
    code: item.code,
    name: item.name,
    label: [item.code, item.name].filter(Boolean).join(' - '),
    isActive: item.isActive,
  }
}

function buildFilter(query = {}) {
  const filter = {}
  const keyword = s(query.search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    filter.$or = [{ code: regex }, { name: regex }]
  }

  if (query.isActive === 'true') filter.isActive = true
  if (query.isActive === 'false') filter.isActive = false

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const allowedFields = new Set(['code', 'name', 'isActive', 'createdAt', 'updatedAt'])
  const field = allowedFields.has(sortField) ? sortField : 'createdAt'
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

  const exists = await Department.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'DEPARTMENT_CODE_EXISTS',
      messageKey: 'org.department.error.codeExists',
      message: 'Department code already exists',
      field: 'code',
      params: {
        code: normalizedCode,
      },
    })
  }
}

async function lookupDepartments(query = {}) {
  const filter = buildFilter(query)
  const limit = Number(query.limit || 50)

  const items = await Department.find(filter)
    .sort({ name: 1, code: 1, _id: 1 })
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

async function listDepartments(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    Department.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ])

  return {
    items: items.map(mapDepartment),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function getDepartmentById(id) {
  await ensureObjectId(id, 'departmentId')

  const doc = await Department.findById(id).lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'DEPARTMENT_NOT_FOUND',
      messageKey: 'org.department.error.notFound',
      message: 'Department not found',
      field: 'departmentId',
    })
  }

  return mapDepartment(doc)
}

async function createDepartment(payload) {
  const code = upper(payload.code)

  await ensureUniqueCode(code)

  const doc = await Department.create({
    code,
    name: s(payload.name),
    isActive: payload.isActive ?? true,
  })

  return getDepartmentById(doc._id)
}

async function updateDepartment(id, payload) {
  await ensureObjectId(id, 'departmentId')

  const doc = await Department.findById(id)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'DEPARTMENT_NOT_FOUND',
      messageKey: 'org.department.error.notFound',
      message: 'Department not found',
      field: 'departmentId',
    })
  }

  if (payload.code !== undefined) {
    const code = upper(payload.code)

    if (code !== doc.code) {
      await ensureUniqueCode(code, doc._id)
    }

    doc.code = code
  }

  if (payload.name !== undefined) {
    doc.name = s(payload.name)
  }

  if (payload.isActive !== undefined) {
    doc.isActive = !!payload.isActive
  }

  await doc.save()

  return getDepartmentById(doc._id)
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

async function exportDepartmentsExcel(query = {}) {
  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const items = await Department.find(filter).sort(sort).lean()

  const rows = items.map((item, index) => ({
    No: index + 1,
    Code: item.code || '',
    Name: item.name || '',
    Status: item.isActive ? 'Active' : 'Inactive',
    CreatedAt: formatExcelDate(item.createdAt),
    UpdatedAt: formatExcelDate(item.updatedAt),
  }))

  const fallbackRows = rows.length
    ? rows
    : [
        {
          No: '',
          Code: '',
          Name: '',
          Status: '',
          CreatedAt: '',
          UpdatedAt: '',
        },
      ]

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(fallbackRows)

  worksheet['!cols'] = autoFitColumns(fallbackRows)

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Departments')

  return {
    filename: `departments-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: workbookToBuffer(workbook),
  }
}

async function downloadDepartmentImportSample() {
  const sampleRows = [
    {
      Code: 'HR',
      Name: 'Human Resources',
      Status: 'Active',
    },
    {
      Code: 'FIN',
      Name: 'Finance',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Department Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Code', 'Required. Unique department code. Example: HR'],
    ['Name', 'Required. Department display name.'],
    ['Status', 'Optional. Use Active or Inactive. Blank = Active.'],
  ]

  const workbook = XLSX.utils.book_new()
  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)

  sampleSheet['!cols'] = autoFitColumns(sampleRows)
  guideSheet['!cols'] = [{ wch: 24 }, { wch: 80 }]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return {
    filename: 'department-import-sample.xlsx',
    buffer: workbookToBuffer(workbook),
  }
}

function readWorkbookRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
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
    acc[upper(key)] = value
    return acc
  }, {})

  for (const name of names) {
    const value = normalized[upper(name)]

    if (value !== undefined) return value
  }

  return ''
}

async function importDepartmentsExcel(fileBuffer) {
  if (!fileBuffer) {
    throw appError({
      statusCode: 400,
      code: 'DEPARTMENT_EXCEL_FILE_REQUIRED',
      messageKey: 'org.department.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  const rows = readWorkbookRows(fileBuffer)

  if (!rows.length) {
    throw appError({
      statusCode: 400,
      code: 'DEPARTMENT_EXCEL_NO_ROWS',
      messageKey: 'org.department.error.excelNoRows',
      message: 'Excel file has no rows',
    })
  }

  const seenCodes = new Set()

  const normalizedRows = rows
    .map((row, index) => {
      const rowNo = index + 2
      const code = upper(getCell(row, ['Code', 'Department Code']))
      const name = s(getCell(row, ['Name', 'Department Name']))
      const status = getCell(row, ['Status', 'Active', 'Is Active'])
      const isActive = normalizeImportStatus(status)

      if (!code && !name && !s(status)) {
        return null
      }

      if (!code) {
        throw appError({
          statusCode: 400,
          code: 'DEPARTMENT_IMPORT_CODE_REQUIRED',
          messageKey: 'org.department.import.error.codeRequired',
          message: `Row ${rowNo}: Code is required`,
          params: { rowNo },
        })
      }

      if (!name) {
        throw appError({
          statusCode: 400,
          code: 'DEPARTMENT_IMPORT_NAME_REQUIRED',
          messageKey: 'org.department.import.error.nameRequired',
          message: `Row ${rowNo}: Name is required`,
          params: { rowNo },
        })
      }

      if (isActive === 'INVALID_STATUS') {
        throw appError({
          statusCode: 400,
          code: 'DEPARTMENT_IMPORT_INVALID_STATUS',
          messageKey: 'org.department.import.error.invalidStatus',
          message: `Row ${rowNo}: Invalid status`,
          params: { rowNo },
        })
      }

      if (seenCodes.has(code)) {
        throw appError({
          statusCode: 400,
          code: 'DEPARTMENT_IMPORT_DUPLICATE_CODE',
          messageKey: 'org.department.import.error.duplicateCode',
          message: `Row ${rowNo}: Duplicate code in import file`,
          params: { rowNo, code },
        })
      }

      seenCodes.add(code)

      return {
        rowNo,
        code,
        name,
        isActive,
      }
    })
    .filter(Boolean)

  let created = 0
  let updated = 0

  for (const row of normalizedRows) {
    const existing = await Department.findOne({ code: row.code })

    if (existing) {
      existing.name = row.name
      existing.isActive = row.isActive

      await existing.save()
      updated += 1
      continue
    }

    await Department.create({
      code: row.code,
      name: row.name,
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
    messageKey: 'org.department.import.success.completed',
  }
}

module.exports = {
  lookupDepartments,
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  exportDepartmentsExcel,
  downloadDepartmentImportSample,
  importDepartmentsExcel,
}