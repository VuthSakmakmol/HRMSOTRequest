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
  const page = Math.max(1, Number(query.page || 1))
  const limit = Math.max(1, Math.min(Number(query.limit || 10), 100))
  const skip = (page - 1) * limit

  const filter = buildFilter({
    ...query,
    search: s(query.search || query.q),
  })

  const [items, total] = await Promise.all([
    Department.find(filter)
      .sort({ name: 1, code: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Department.countDocuments(filter),
  ])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return {
    items: items.map(mapLookupItem),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
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

function makeImportError({
  rowNo,
  field,
  value = '',
  code,
  messageKey,
  reason,
  params = {},
}) {
  return {
    rowNo,
    row: rowNo,
    field,
    value: s(value),
    code,
    messageKey,
    reason,
    message: reason,
    params: {
      rowNo,
      field,
      value: s(value),
      ...params,
    },
  }
}

function addImportError(errors, error) {
  errors.push(makeImportError(error))
}

function throwImportValidationError(errors) {
  if (!errors.length) return

  throw appError({
    statusCode: 400,
    code: 'DEPARTMENT_IMPORT_VALIDATION_FAILED',
    messageKey: 'org.department.import.error.validationFailed',
    message: `Import failed. ${errors.length} problem${errors.length > 1 ? 's' : ''} found. Please fix all errors and try again.`,
    params: {
      errorCount: errors.length,
      errors,
    },
  })
}

function validateDepartmentImportRows(rows = []) {
  const errors = []
  const seenCodes = new Map()
  const normalizedRows = []

  rows.forEach((row, index) => {
    const rowNo = index + 2

    const rawCode = getCell(row, ['Code', 'Department Code'])
    const rawName = getCell(row, ['Name', 'Department Name'])
    const rawStatus = getCell(row, ['Status', 'Active', 'Is Active'])

    const code = upper(rawCode)
    const name = s(rawName)
    const isActive = normalizeImportStatus(rawStatus)

    const isBlankRow = !code && !name && !s(rawStatus)

    if (isBlankRow) return

    let hasRowError = false

    if (!code) {
      hasRowError = true

      addImportError(errors, {
        rowNo,
        field: 'Code',
        value: rawCode,
        code: 'DEPARTMENT_IMPORT_CODE_REQUIRED',
        messageKey: 'org.department.import.error.codeRequired',
        reason: `Row ${rowNo}: Code is required.`,
      })
    } else if (code.length < 2) {
      hasRowError = true

      addImportError(errors, {
        rowNo,
        field: 'Code',
        value: rawCode,
        code: 'DEPARTMENT_IMPORT_CODE_MIN_LENGTH',
        messageKey: 'org.department.import.error.codeMinLength',
        reason: `Row ${rowNo}: Code must be at least 2 characters.`,
        params: {
          min: 2,
          code,
        },
      })
    } else if (code.length > 30) {
      hasRowError = true

      addImportError(errors, {
        rowNo,
        field: 'Code',
        value: rawCode,
        code: 'DEPARTMENT_IMPORT_CODE_TOO_LONG',
        messageKey: 'org.department.import.error.codeTooLong',
        reason: `Row ${rowNo}: Code must not be longer than 30 characters.`,
        params: {
          max: 30,
          code,
        },
      })
    }

    if (!name) {
      hasRowError = true

      addImportError(errors, {
        rowNo,
        field: 'Name',
        value: rawName,
        code: 'DEPARTMENT_IMPORT_NAME_REQUIRED',
        messageKey: 'org.department.import.error.nameRequired',
        reason: `Row ${rowNo}: Name is required.`,
      })
    } else if (name.length < 2) {
      hasRowError = true

      addImportError(errors, {
        rowNo,
        field: 'Name',
        value: rawName,
        code: 'DEPARTMENT_IMPORT_NAME_MIN_LENGTH',
        messageKey: 'org.department.import.error.nameMinLength',
        reason: `Row ${rowNo}: Name must be at least 2 characters.`,
        params: {
          min: 2,
        },
      })
    } else if (name.length > 120) {
      hasRowError = true

      addImportError(errors, {
        rowNo,
        field: 'Name',
        value: rawName,
        code: 'DEPARTMENT_IMPORT_NAME_TOO_LONG',
        messageKey: 'org.department.import.error.nameTooLong',
        reason: `Row ${rowNo}: Name must not be longer than 120 characters.`,
        params: {
          max: 120,
        },
      })
    }

    if (isActive === 'INVALID_STATUS') {
      hasRowError = true

      addImportError(errors, {
        rowNo,
        field: 'Status',
        value: rawStatus,
        code: 'DEPARTMENT_IMPORT_INVALID_STATUS',
        messageKey: 'org.department.import.error.invalidStatus',
        reason: `Row ${rowNo}: Status must be Active or Inactive.`,
        params: {
          allowedValues: ['Active', 'Inactive'],
        },
      })
    }

    if (code) {
      const firstRowNo = seenCodes.get(code)

      if (firstRowNo) {
        hasRowError = true

        addImportError(errors, {
          rowNo,
          field: 'Code',
          value: rawCode,
          code: 'DEPARTMENT_IMPORT_DUPLICATE_CODE',
          messageKey: 'org.department.import.error.duplicateCode',
          reason: `Row ${rowNo}: Duplicate code "${code}" in Excel file. First found at row ${firstRowNo}.`,
          params: {
            code,
            firstRowNo,
          },
        })
      } else {
        seenCodes.set(code, rowNo)
      }
    }

    if (hasRowError) return

    normalizedRows.push({
      rowNo,
      code,
      name,
      isActive,
    })
  })

  throwImportValidationError(errors)

  return normalizedRows
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

  const normalizedRows = validateDepartmentImportRows(rows)

  if (!normalizedRows.length) {
    throw appError({
      statusCode: 400,
      code: 'DEPARTMENT_IMPORT_NO_VALID_ROWS',
      messageKey: 'org.department.import.error.noValidRows',
      message: 'Excel file has no valid department rows',
    })
  }

  const session = await mongoose.startSession()

  let summary = {
    totalRows: normalizedRows.length,
    created: 0,
    updated: 0,
  }

  try {
    await session.withTransaction(async () => {
      const codes = normalizedRows.map((row) => row.code)

      const existingDepartments = await Department.find({
        code: {
          $in: codes,
        },
      })
        .select('code')
        .session(session)
        .lean()

      const existingCodeSet = new Set(
        existingDepartments.map((item) => upper(item.code)),
      )

      const created = normalizedRows.filter(
        (row) => !existingCodeSet.has(row.code),
      ).length

      const updated = normalizedRows.length - created

      const operations = normalizedRows.map((row) => ({
        updateOne: {
          filter: {
            code: row.code,
          },
          update: {
            $set: {
              code: row.code,
              name: row.name,
              isActive: row.isActive,
            },
          },
          upsert: true,
        },
      }))

      await Department.bulkWrite(operations, {
        ordered: true,
        session,
      })

      summary = {
        totalRows: normalizedRows.length,
        created,
        updated,
      }
    })
  } catch (error) {
    if (Number(error?.code) === 11000) {
      throw appError({
        statusCode: 409,
        code: 'DEPARTMENT_IMPORT_DUPLICATE_DATABASE_CODE',
        messageKey: 'org.department.import.error.duplicateDatabaseCode',
        message: 'Import failed because one or more department codes already conflict with existing data.',
        params: {
          keyValue: error.keyValue || {},
        },
      })
    }

    throw error
  } finally {
    await session.endSession()
  }

  return {
    summary,
    errors: [],
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