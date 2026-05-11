// backend/src/modules/org/services/position.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')
const Position = require('../models/Position')
const Department = require('../models/Department')
const { importPositionRowSchema } = require('../validators/position.validation')

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

function objectId(value) {
  return new mongoose.Types.ObjectId(String(value))
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

function mapPosition(doc) {
  if (!doc) return null

  const department = doc.departmentId && typeof doc.departmentId === 'object'
    ? doc.departmentId
    : null

  const reportsTo = doc.reportsToPositionId && typeof doc.reportsToPositionId === 'object'
    ? doc.reportsToPositionId
    : null

  return {
    id: id(doc._id),
    _id: id(doc._id),

    code: doc.code || '',
    name: doc.name || '',
    label: [doc.code, doc.name].filter(Boolean).join(' - '),

    departmentId: department?._id ? id(department._id) : id(doc.departmentId) || null,
    departmentCode: department?.code || '',
    departmentName: department?.name || '',

    reportsToPositionId: reportsTo?._id
      ? id(reportsTo._id)
      : id(doc.reportsToPositionId) || null,
    reportsToPositionCode: reportsTo?.code || '',
    reportsToPositionName: reportsTo?.name || '',
    reportsToPositionDepartmentId: reportsTo?.departmentId
      ? id(reportsTo.departmentId)
      : null,

    managerScope: upper(doc.managerScope || 'SAME_LINE'),

    description: doc.description || '',
    isActive: !!doc.isActive,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapPosition(doc)

  return {
    id: item.id,
    _id: item._id,
    code: item.code,
    name: item.name,
    label: item.label,

    departmentId: item.departmentId,
    departmentCode: item.departmentCode,
    departmentName: item.departmentName,

    reportsToPositionId: item.reportsToPositionId,
    reportsToPositionCode: item.reportsToPositionCode,
    reportsToPositionName: item.reportsToPositionName,

    managerScope: item.managerScope,
    isActive: item.isActive,
  }
}

function buildFilter(query = {}) {
  const filter = {}

  const keyword = s(query.search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    filter.$or = [
      { code: regex },
      { name: regex },
      { description: regex },
    ]
  }

  if (query.departmentId && isObjectId(query.departmentId)) {
    filter.departmentId = objectId(query.departmentId)
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

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

async function ensureObjectId(value, field = 'id') {
  if (!isObjectId(value)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_ID',
      messageKey: 'common.error.invalidId',
      message: 'Invalid id',
      field,
      params: { value },
    })
  }
}

async function ensureDepartmentExists(departmentId) {
  await ensureObjectId(departmentId, 'departmentId')

  const department = await Department.findById(departmentId)
    .select('_id code name isActive')
    .lean()

  if (!department) {
    throw appError({
      statusCode: 404,
      code: 'DEPARTMENT_NOT_FOUND',
      messageKey: 'org.department.error.notFound',
      message: 'Department not found',
      field: 'departmentId',
    })
  }

  if (department.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'DEPARTMENT_INACTIVE',
      messageKey: 'org.department.error.inactive',
      message: 'Department is inactive',
      field: 'departmentId',
    })
  }

  return department
}

async function ensurePositionCodeAvailable({ departmentId, code, excludeId = null }) {
  const normalizedCode = upper(code)

  const filter = {
    departmentId,
    code: normalizedCode,
  }

  if (excludeId) {
    filter._id = {
      $ne: excludeId,
    }
  }

  const exists = await Position.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'POSITION_CODE_EXISTS',
      messageKey: 'org.position.error.codeExists',
      message: 'Position code already exists in this department',
      field: 'code',
      params: {
        code: normalizedCode,
        departmentId: id(departmentId),
      },
    })
  }
}

async function ensureReportsToPositionValid({
  reportsToPositionId,
  currentPositionId = null,
}) {
  if (!reportsToPositionId) return null

  await ensureObjectId(reportsToPositionId, 'reportsToPositionId')

  if (currentPositionId && id(reportsToPositionId) === id(currentPositionId)) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_REPORT_TO_SELF',
      messageKey: 'org.position.error.reportToSelf',
      message: 'Position cannot report to itself',
      field: 'reportsToPositionId',
    })
  }

  const parentPosition = await Position.findById(reportsToPositionId)
    .select('_id code name departmentId reportsToPositionId managerScope isActive')
    .lean()

  if (!parentPosition) {
    throw appError({
      statusCode: 404,
      code: 'REPORTS_TO_POSITION_NOT_FOUND',
      messageKey: 'org.position.error.reportsToPositionNotFound',
      message: 'Reports-to position not found',
      field: 'reportsToPositionId',
    })
  }

  if (parentPosition.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'REPORTS_TO_POSITION_INACTIVE',
      messageKey: 'org.position.error.reportsToPositionInactive',
      message: 'Reports-to position is inactive',
      field: 'reportsToPositionId',
    })
  }

  if (currentPositionId) {
    let cursor = parentPosition
    const visited = new Set()

    while (cursor?.reportsToPositionId) {
      const nextId = id(cursor.reportsToPositionId)

      if (!nextId) break

      if (nextId === id(currentPositionId)) {
        throw appError({
          statusCode: 400,
          code: 'POSITION_HIERARCHY_CIRCULAR',
          messageKey: 'org.position.error.circularHierarchy',
          message: 'Circular position hierarchy is not allowed',
          field: 'reportsToPositionId',
        })
      }

      if (visited.has(nextId)) {
        throw appError({
          statusCode: 400,
          code: 'POSITION_HIERARCHY_CIRCULAR',
          messageKey: 'org.position.error.circularHierarchy',
          message: 'Circular position hierarchy is not allowed',
          field: 'reportsToPositionId',
        })
      }

      visited.add(nextId)

      cursor = await Position.findById(nextId)
        .select('_id reportsToPositionId')
        .lean()

      if (!cursor) break
    }
  }

  return parentPosition._id
}

async function lookup(query = {}) {
  const limit = Number(query.limit || 50)
  const filter = buildFilter(query)

  const items = await Position.find(filter)
    .populate('departmentId', 'code name isActive')
    .populate('reportsToPositionId', 'code name departmentId managerScope isActive')
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

async function list(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    Position.find(filter)
      .populate('departmentId', 'code name isActive')
      .populate('reportsToPositionId', 'code name departmentId managerScope isActive')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    Position.countDocuments(filter),
  ])

  return {
    items: items.map(mapPosition),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function getById(positionId) {
  await ensureObjectId(positionId, 'positionId')

  const doc = await Position.findById(positionId)
    .populate('departmentId', 'code name isActive')
    .populate('reportsToPositionId', 'code name departmentId managerScope isActive')
    .lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'POSITION_NOT_FOUND',
      messageKey: 'org.position.error.notFound',
      message: 'Position not found',
      field: 'positionId',
    })
  }

  return mapPosition(doc)
}

async function create(payload) {
  const department = await ensureDepartmentExists(payload.departmentId)
  const code = upper(payload.code)

  await ensurePositionCodeAvailable({
    departmentId: department._id,
    code,
  })

  const reportsToPositionId = await ensureReportsToPositionValid({
    reportsToPositionId: payload.reportsToPositionId,
  })

  try {
    const created = await Position.create({
      code,
      name: s(payload.name),
      departmentId: department._id,
      reportsToPositionId,
      managerScope: upper(payload.managerScope || 'SAME_LINE'),
      description: s(payload.description),
      isActive: payload.isActive ?? true,
    })

    return getById(created._id)
  } catch (error) {
    if (error?.code === 11000) {
      throw appError({
        statusCode: 409,
        code: 'POSITION_CODE_EXISTS',
        messageKey: 'org.position.error.codeExists',
        message: 'Position code already exists in this department',
        field: 'code',
      })
    }

    throw error
  }
}

async function update(positionId, payload) {
  await ensureObjectId(positionId, 'positionId')

  const existing = await Position.findById(positionId)

  if (!existing) {
    throw appError({
      statusCode: 404,
      code: 'POSITION_NOT_FOUND',
      messageKey: 'org.position.error.notFound',
      message: 'Position not found',
      field: 'positionId',
    })
  }

  const nextDepartmentId =
    payload.departmentId !== undefined ? payload.departmentId : existing.departmentId

  const nextCode =
    payload.code !== undefined ? upper(payload.code) : upper(existing.code)

  const department = await ensureDepartmentExists(nextDepartmentId)

  if (
    payload.code !== undefined ||
    payload.departmentId !== undefined
  ) {
    await ensurePositionCodeAvailable({
      departmentId: department._id,
      code: nextCode,
      excludeId: existing._id,
    })
  }

  const hasReportsToPositionField = Object.prototype.hasOwnProperty.call(
    payload,
    'reportsToPositionId',
  )

  const nextReportsToPositionId = hasReportsToPositionField
    ? payload.reportsToPositionId
    : existing.reportsToPositionId

  const reportsToPositionId = await ensureReportsToPositionValid({
    reportsToPositionId: nextReportsToPositionId,
    currentPositionId: existing._id,
  })

  existing.departmentId = department._id
  existing.code = nextCode

  if (payload.name !== undefined) {
    existing.name = s(payload.name)
  }

  if (hasReportsToPositionField || payload.departmentId !== undefined) {
    existing.reportsToPositionId = reportsToPositionId
  }

  if (payload.managerScope !== undefined) {
    existing.managerScope = upper(payload.managerScope || 'SAME_LINE')
  }

  if (payload.description !== undefined) {
    existing.description = s(payload.description)
  }

  if (payload.isActive !== undefined) {
    existing.isActive = !!payload.isActive
  }

  try {
    await existing.save()
    return getById(existing._id)
  } catch (error) {
    if (error?.code === 11000) {
      throw appError({
        statusCode: 409,
        code: 'POSITION_CODE_EXISTS',
        messageKey: 'org.position.error.codeExists',
        message: 'Position code already exists in this department',
        field: 'code',
      })
    }

    throw error
  }
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

async function downloadSample() {
  const sampleRows = [
    {
      'Position ID': '',
      'Department ID': 'PASTE_DEPARTMENT_MONGO_ID_HERE',
      'Position Code': 'SEWER_SUPERVISOR',
      'Position Name': 'Sewer Supervisor',
      'Reports To Position ID': '',
      'Manager Scope': 'SAME_LINE',
      Description: 'Supervise sewer employees by line',
      Status: 'Active',
    },
    {
      'Position ID': '',
      'Department ID': 'PASTE_DEPARTMENT_MONGO_ID_HERE',
      'Position Code': 'SEWER',
      'Position Name': 'Sewer',
      'Reports To Position ID': 'PASTE_PARENT_POSITION_MONGO_ID_HERE',
      'Manager Scope': 'SAME_LINE',
      Description: 'Sewing operator',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Position Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Position ID', 'Leave blank to create. Fill Mongo Position ID to update existing position.'],
    ['Department ID', 'Required. Use Mongo Department ID only.'],
    ['Position Code', 'Required. Unique inside selected Department ID.'],
    ['Position Name', 'Required.'],
    ['Reports To Position ID', 'Optional. Use Mongo Position ID only. Cross-department is allowed.'],
    ['Manager Scope', 'SAME_LINE or GLOBAL. Blank = SAME_LINE.'],
    ['Description', 'Optional.'],
    ['Status', 'Active or Inactive. Blank = Active.'],
  ]

  const workbook = XLSX.utils.book_new()
  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)

  sampleSheet['!cols'] = autoFitColumns(sampleRows)
  guideSheet['!cols'] = [{ wch: 28 }, { wch: 90 }]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return {
    filename: 'position-import-sample.xlsx',
    buffer: workbookToBuffer(workbook),
  }
}

async function exportExcel(query = {}) {
  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const items = await Position.find(filter)
    .populate('departmentId', 'code name isActive')
    .populate('reportsToPositionId', 'code name departmentId managerScope isActive')
    .sort(sort)
    .lean()

  const rows = items.map((doc, index) => {
    const item = mapPosition(doc)

    return {
      No: index + 1,
      'Position ID': item.id,
      'Department ID': item.departmentId || '',
      'Department Code': item.departmentCode || '',
      'Department Name': item.departmentName || '',
      'Position Code': item.code || '',
      'Position Name': item.name || '',
      'Reports To Position ID': item.reportsToPositionId || '',
      'Reports To Position Code': item.reportsToPositionCode || '',
      'Reports To Position Name': item.reportsToPositionName || '',
      'Manager Scope': item.managerScope || '',
      Description: item.description || '',
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
          'Position ID': '',
          'Department ID': '',
          'Department Code': '',
          'Department Name': '',
          'Position Code': '',
          'Position Name': '',
          'Reports To Position ID': '',
          'Reports To Position Code': '',
          'Reports To Position Name': '',
          'Manager Scope': '',
          Description: '',
          Status: '',
          CreatedAt: '',
          UpdatedAt: '',
        },
      ]

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(fallbackRows)

  worksheet['!cols'] = autoFitColumns(fallbackRows)

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Positions')

  return {
    filename: `positions-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: workbookToBuffer(workbook),
  }
}

function readWorkbookRows(buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
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

function normalizeImportStatus(value) {
  const text = s(value).toLowerCase()

  if (!text) return true
  if (['active', 'true', 'yes', 'y', '1'].includes(text)) return true
  if (['inactive', 'false', 'no', 'n', '0'].includes(text)) return false

  return 'INVALID_BOOLEAN'
}

function normalizeImportManagerScope(value) {
  const scope = upper(value || 'SAME_LINE')

  return ['SAME_LINE', 'GLOBAL'].includes(scope) ? scope : 'INVALID_MANAGER_SCOPE'
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

function normalizeImportRow(raw = {}, index = 0) {
  const rowNo = index + 2

  return {
    rowNo,
    positionId: s(getCell(raw, ['Position ID', 'positionId'])),
    departmentId: s(getCell(raw, ['Department ID', 'departmentId'])),
    code: upper(getCell(raw, ['Position Code', 'code'])),
    name: s(getCell(raw, ['Position Name', 'name'])),
    reportsToPositionId: s(getCell(raw, ['Reports To Position ID', 'reportsToPositionId'])),
    managerScope: normalizeImportManagerScope(getCell(raw, ['Manager Scope', 'managerScope'])),
    description: s(getCell(raw, ['Description', 'description'])),
    isActive: normalizeImportStatus(getCell(raw, ['Status', 'Active', 'Is Active', 'isActive'])),
  }
}

async function importExcel(file) {
  if (!file?.buffer) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_EXCEL_FILE_REQUIRED',
      messageKey: 'org.position.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  const rows = readWorkbookRows(file.buffer)

  if (!rows.length) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_EXCEL_NO_ROWS',
      messageKey: 'org.position.error.excelNoRows',
      message: 'Excel file has no rows',
    })
  }

  const parsedRows = rows
    .map(normalizeImportRow)
    .filter((row) => row.positionId || row.departmentId || row.code || row.name)

  const seenPositionIds = new Set()
  const seenDepartmentCodePairs = new Set()

  for (const row of parsedRows) {
    if (row.managerScope === 'INVALID_MANAGER_SCOPE') {
      throw appError({
        statusCode: 400,
        code: 'POSITION_IMPORT_INVALID_MANAGER_SCOPE',
        messageKey: 'org.position.import.error.invalidManagerScope',
        message: `Row ${row.rowNo}: Invalid manager scope`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    if (row.isActive === 'INVALID_BOOLEAN') {
      throw appError({
        statusCode: 400,
        code: 'POSITION_IMPORT_INVALID_STATUS',
        messageKey: 'org.position.import.error.invalidStatus',
        message: `Row ${row.rowNo}: Invalid status`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    const result = importPositionRowSchema.safeParse(row)

    if (!result.success) {
      throw appError({
        statusCode: 400,
        code: 'POSITION_IMPORT_ROW_INVALID',
        messageKey: result.error.issues[0]?.message || 'org.position.import.error.rowInvalid',
        message: `Row ${row.rowNo}: ${result.error.issues[0]?.message || 'Invalid data'}`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    if (row.positionId) {
      if (seenPositionIds.has(row.positionId)) {
        throw appError({
          statusCode: 400,
          code: 'POSITION_IMPORT_DUPLICATE_POSITION_ID',
          messageKey: 'org.position.import.error.duplicatePositionId',
          message: `Row ${row.rowNo}: Duplicate Position ID in import file`,
          params: {
            rowNo: row.rowNo,
            positionId: row.positionId,
          },
        })
      }

      seenPositionIds.add(row.positionId)
    }

    const pairKey = `${row.departmentId}:${row.code}`

    if (seenDepartmentCodePairs.has(pairKey)) {
      throw appError({
        statusCode: 400,
        code: 'POSITION_IMPORT_DUPLICATE_CODE_IN_DEPARTMENT',
        messageKey: 'org.position.import.error.duplicateCodeInDepartment',
        message: `Row ${row.rowNo}: Duplicate Position Code in same Department ID`,
        params: {
          rowNo: row.rowNo,
          departmentId: row.departmentId,
          code: row.code,
        },
      })
    }

    seenDepartmentCodePairs.add(pairKey)
  }

  let created = 0
  let updated = 0

  for (const row of parsedRows) {
    const data = importPositionRowSchema.parse(row)

    const existing = data.positionId
      ? await Position.findById(data.positionId)
      : null

    if (data.positionId && !existing) {
      throw appError({
        statusCode: 404,
        code: 'POSITION_IMPORT_POSITION_ID_NOT_FOUND',
        messageKey: 'org.position.import.error.positionIdNotFound',
        message: `Row ${row.rowNo}: Position ID not found`,
        params: {
          rowNo: row.rowNo,
          positionId: data.positionId,
        },
      })
    }

    await ensureDepartmentExists(data.departmentId)

    if (data.reportsToPositionId && data.positionId && data.reportsToPositionId === data.positionId) {
      throw appError({
        statusCode: 400,
        code: 'POSITION_REPORT_TO_SELF',
        messageKey: 'org.position.error.reportToSelf',
        message: `Row ${row.rowNo}: Position cannot report to itself`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    const reportsToPositionId = await ensureReportsToPositionValid({
      reportsToPositionId: data.reportsToPositionId,
      currentPositionId: existing?._id || null,
    })

    await ensurePositionCodeAvailable({
      departmentId: data.departmentId,
      code: data.code,
      excludeId: existing?._id || null,
    })

    const payload = {
      departmentId: data.departmentId,
      code: upper(data.code),
      name: s(data.name),
      reportsToPositionId,
      managerScope: upper(data.managerScope || 'SAME_LINE'),
      description: s(data.description),
      isActive: data.isActive,
    }

    if (existing) {
      Object.assign(existing, payload)
      await existing.save()
      updated += 1
      continue
    }

    await Position.create(payload)
    created += 1
  }

  return {
    summary: {
      totalRows: parsedRows.length,
      created,
      updated,
    },
    messageKey: 'org.position.import.success.completed',
  }
}

module.exports = {
  lookup,
  list,
  getById,
  create,
  update,
  downloadSample,
  exportExcel,
  importExcel,
}