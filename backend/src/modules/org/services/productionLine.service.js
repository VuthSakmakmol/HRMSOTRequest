// backend/src/modules/org/services/productionLine.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')
const ProductionLine = require('../models/ProductionLine')
const Department = require('../models/Department')
const Position = require('../models/Position')

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

function getActorId(currentUser = null) {
  const candidates = [
    currentUser?.accountId,
    currentUser?.id,
    currentUser?._id,
    currentUser?.sub,
  ]

  const actorId = candidates.find((value) => isObjectId(value))

  return actorId ? new mongoose.Types.ObjectId(String(actorId)) : null
}

function makeLabel(code, name) {
  const c = upper(code)
  const n = s(name)

  if (c && n) return `${c} - ${n}`
  if (c) return c
  return n
}

function mapPosition(position) {
  if (!position) return null

  return {
    id: id(position),
    _id: id(position),
    code: position.code || '',
    name: position.name || '',
    label: makeLabel(position.code, position.name),
  }
}

function mapLine(doc) {
  if (!doc) return null

  const department = doc.departmentId
  const departmentId = id(department)
  const positions = Array.isArray(doc.positionIds)
    ? doc.positionIds.map(mapPosition).filter(Boolean)
    : []

  return {
    id: id(doc),
    _id: id(doc),

    code: doc.code || '',
    name: doc.name || '',
    label: makeLabel(doc.code, doc.name),
    description: doc.description || '',

    departmentId,
    departmentCode: department?.code || '',
    departmentName: department?.name || '',
    departmentLabel: departmentId
      ? makeLabel(department?.code, department?.name)
      : '',

    positionIds: positions.map((position) => position.id),
    positions,
    positionCodes: positions.map((position) => position.code).filter(Boolean),
    positionNames: positions.map((position) => position.name).filter(Boolean),
    allowedPositionsLabel: positions.length
      ? positions.map((position) => position.label).filter(Boolean).join(', ')
      : '',

    isActive: !!doc.isActive,

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapLine(doc)

  return {
    id: item.id,
    _id: item._id,
    value: item.id,

    code: item.code,
    name: item.name,
    label: item.label,
    description: item.description,

    departmentId: item.departmentId,
    departmentCode: item.departmentCode,
    departmentName: item.departmentName,
    departmentLabel: item.departmentLabel,

    positionIds: item.positionIds,
    positions: item.positions,

    isActive: item.isActive,
  }
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

  if (isObjectId(query.departmentId)) {
    filter.departmentId = query.departmentId
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

  const exists = await ProductionLine.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'LINE_CODE_EXISTS',
      messageKey: 'org.line.error.codeExists',
      message: 'Line code already exists',
      field: 'code',
      params: {
        code: normalizedCode,
      },
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

  return department
}

async function ensurePositionsAllowed(positionIds = [], departmentId) {
  const ids = [
    ...new Set(
      (Array.isArray(positionIds) ? positionIds : [])
        .map((positionId) => s(positionId))
        .filter(Boolean),
    ),
  ]

  ids.forEach((positionId) => {
    if (!isObjectId(positionId)) {
      throw appError({
        statusCode: 400,
        code: 'INVALID_POSITION_ID',
        messageKey: 'org.position.error.invalidId',
        message: 'Invalid position id',
        field: 'positionIds',
        params: {
          positionId,
        },
      })
    }
  })

  if (!ids.length) return []

  const positions = await Position.find({
    _id: {
      $in: ids,
    },
  })
    .select('_id code name departmentId isActive')
    .lean()

  if (positions.length !== ids.length) {
    throw appError({
      statusCode: 404,
      code: 'POSITION_NOT_FOUND',
      messageKey: 'org.position.error.notFound',
      message: 'Some selected positions were not found',
      field: 'positionIds',
    })
  }

  const invalidDepartment = positions.find(
    (position) => id(position.departmentId) !== id(departmentId),
  )

  if (invalidDepartment) {
    throw appError({
      statusCode: 400,
      code: 'LINE_POSITION_DEPARTMENT_MISMATCH',
      messageKey: 'org.line.error.positionDepartmentMismatch',
      message: 'Selected position does not belong to selected department',
      field: 'positionIds',
      params: {
        positionId: id(invalidDepartment._id),
      },
    })
  }

  return positions
}

async function findDepartmentByCode(code) {
  const departmentCode = upper(code)

  if (!departmentCode) return null

  return Department.findOne({ code: departmentCode })
    .select('_id code name isActive')
    .lean()
}

async function findPositionsByCodes(codes = []) {
  const cleanCodes = [...new Set(codes.map(upper).filter(Boolean))]

  if (!cleanCodes.length) return []

  return Position.find({ code: { $in: cleanCodes } })
    .select('_id code name departmentId isActive')
    .lean()
}

async function list(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    ProductionLine.find(filter)
      .populate('departmentId', 'code name')
      .populate('positionIds', 'code name')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    ProductionLine.countDocuments(filter),
  ])

  return {
    items: items.map(mapLine),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  }
}

async function lookup(query = {}) {
  const filter = buildFilter(query)
  const limit = Number(query.limit || 50)

  const items = await ProductionLine.find(filter)
    .populate('departmentId', 'code name')
    .populate('positionIds', 'code name')
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

async function getById(lineId) {
  await ensureObjectId(lineId, 'lineId')

  const doc = await ProductionLine.findById(lineId)
    .populate('departmentId', 'code name')
    .populate('positionIds', 'code name')
    .lean()

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'LINE_NOT_FOUND',
      messageKey: 'org.line.error.notFound',
      message: 'Production line not found',
      field: 'lineId',
    })
  }

  return mapLine(doc)
}

async function create(payload = {}, currentUser = null) {
  const code = upper(payload.code)

  await ensureUniqueCode(code)

  const department = await ensureDepartmentExists(payload.departmentId)
  const positions = await ensurePositionsAllowed(payload.positionIds || [], department._id)
  const actorId = getActorId(currentUser)

  const doc = await ProductionLine.create({
    code,
    name: s(payload.name),
    departmentId: department._id,
    positionIds: positions.map((position) => position._id),
    description: s(payload.description),
    isActive: payload.isActive ?? true,
    createdBy: actorId,
    updatedBy: actorId,
  })

  return getById(doc._id)
}

async function update(lineId, payload = {}, currentUser = null) {
  await ensureObjectId(lineId, 'lineId')

  const doc = await ProductionLine.findById(lineId)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'LINE_NOT_FOUND',
      messageKey: 'org.line.error.notFound',
      message: 'Production line not found',
      field: 'lineId',
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

  if (payload.departmentId !== undefined || payload.positionIds !== undefined) {
    const nextDepartmentId =
      payload.departmentId !== undefined ? payload.departmentId : doc.departmentId

    const department = await ensureDepartmentExists(nextDepartmentId)
    const positions = await ensurePositionsAllowed(
      payload.positionIds !== undefined ? payload.positionIds : doc.positionIds,
      department._id,
    )

    doc.departmentId = department._id
    doc.positionIds = positions.map((position) => position._id)
  }

  if (payload.description !== undefined) {
    doc.description = s(payload.description)
  }

  if (payload.isActive !== undefined) {
    doc.isActive = !!payload.isActive
  }

  doc.updatedBy = getActorId(currentUser)

  await doc.save()

  return getById(doc._id)
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatExcelDate(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
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

      current.wch = Math.min(Math.max(current.wch, value.length + 2), 55)
      widths[index] = current
    })
  })

  return widths
}

async function exportExcel(query = {}) {
  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const items = await ProductionLine.find(filter)
    .populate('departmentId', 'code name')
    .populate('positionIds', 'code name')
    .sort(sort)
    .lean()

  const rows = items.map((doc, index) => {
    const item = mapLine(doc)

    return {
      No: index + 1,
      Code: item.code,
      Name: item.name,
      'Department Code': item.departmentCode,
      Department: item.departmentName,
      'Allowed Positions': item.allowedPositionsLabel || 'All positions in department',
      Description: item.description,
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
          Code: '',
          Name: '',
          'Department Code': '',
          Department: '',
          'Allowed Positions': '',
          Description: '',
          Status: '',
          CreatedAt: '',
          UpdatedAt: '',
        },
      ]

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(fallbackRows)

  worksheet['!cols'] = autoFitColumns(fallbackRows)

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lines')

  return {
    filename: `production-lines-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: workbookToBuffer(workbook),
  }
}

async function downloadImportSample() {
  const sampleRows = [
    {
      Code: 'LINE-01',
      Name: 'Sewing Line 01',
      'Department Code': 'SEWING',
      'Position Codes': 'SEWER,SEWER_SUPERVISOR',
      Description: 'Production sewing line 01',
      Status: 'Active',
    },
    {
      Code: 'LINE-02',
      Name: 'Sewing Line 02',
      'Department Code': 'SEWING',
      'Position Codes': '',
      Description: 'Empty Position Codes means all positions in department',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Production Line Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Code', 'Required. Unique line code. Example: LINE-01'],
    ['Name', 'Required. Line display name.'],
    ['Department Code', 'Required. Must exist in Department master.'],
    ['Position Codes', 'Optional. Comma-separated position codes. Blank = all positions in department.'],
    ['Description', 'Optional. Maximum 500 characters.'],
    ['Status', 'Optional. Use Active or Inactive. Blank = Active.'],
  ]

  const workbook = XLSX.utils.book_new()
  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)

  sampleSheet['!cols'] = autoFitColumns(sampleRows)
  guideSheet['!cols'] = [{ wch: 30 }, { wch: 90 }]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return {
    filename: 'line-import-sample.xlsx',
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

function normalizeHeader(value) {
  return upper(value).replace(/\s+/g, '').replace(/[_-]/g, '')
}

function getCell(row, names = []) {
  const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[normalizeHeader(key)] = value
    return acc
  }, {})

  for (const name of names) {
    const value = normalized[normalizeHeader(name)]

    if (value !== undefined) return value
  }

  return ''
}

function splitPositionCodes(value) {
  return String(value || '')
    .split(/[,\n;]/)
    .map(upper)
    .filter(Boolean)
}

function normalizeImportStatus(value) {
  const text = s(value).toLowerCase()

  if (!text) return true
  if (['active', 'true', 'yes', 'y', '1'].includes(text)) return true
  if (['inactive', 'false', 'no', 'n', '0'].includes(text)) return false

  return 'INVALID_STATUS'
}

async function importExcel(fileBuffer, currentUser = null) {
  if (!fileBuffer) {
    throw appError({
      statusCode: 400,
      code: 'LINE_EXCEL_FILE_REQUIRED',
      messageKey: 'org.line.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  const rows = readWorkbookRows(fileBuffer)

  if (!rows.length) {
    throw appError({
      statusCode: 400,
      code: 'LINE_EXCEL_NO_ROWS',
      messageKey: 'org.line.error.excelNoRows',
      message: 'Excel file has no rows',
    })
  }

  const normalizedRows = rows
    .map((row, index) => {
      const rowNo = index + 2
      const code = upper(getCell(row, ['Code', 'Line Code', 'LineCode']))
      const name = s(getCell(row, ['Name', 'Line Name', 'LineName']))
      const departmentCode = upper(
        getCell(row, ['Department Code', 'DepartmentCode', 'Department']),
      )
      const positionCodes = splitPositionCodes(
        getCell(row, ['Position Codes', 'PositionCodes', 'Allowed Positions']),
      )
      const description = s(getCell(row, ['Description', 'Remark', 'Remarks']))
      const isActive = normalizeImportStatus(
        getCell(row, ['Status', 'Active', 'Is Active', 'IsActive']),
      )

      if (!code && !name && !departmentCode && !positionCodes.length && !description) {
        return null
      }

      return {
        rowNo,
        code,
        name,
        departmentCode,
        positionCodes,
        description,
        isActive,
      }
    })
    .filter(Boolean)

  if (!normalizedRows.length) {
    throw appError({
      statusCode: 400,
      code: 'LINE_EXCEL_NO_VALID_ROWS',
      messageKey: 'org.line.error.excelNoValidRows',
      message: 'Excel file has no valid rows',
    })
  }

  const seenCodes = new Set()
  const actorId = getActorId(currentUser)

  let created = 0
  let updated = 0

  for (const row of normalizedRows) {
    if (!row.code) {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_CODE_REQUIRED',
        messageKey: 'org.line.import.error.codeRequired',
        message: `Row ${row.rowNo}: Code is required`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    if (!row.name) {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_NAME_REQUIRED',
        messageKey: 'org.line.import.error.nameRequired',
        message: `Row ${row.rowNo}: Name is required`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    if (!row.departmentCode) {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_DEPARTMENT_REQUIRED',
        messageKey: 'org.line.import.error.departmentRequired',
        message: `Row ${row.rowNo}: Department Code is required`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    if (row.isActive === 'INVALID_STATUS') {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_INVALID_STATUS',
        messageKey: 'org.line.import.error.invalidStatus',
        message: `Row ${row.rowNo}: Invalid status`,
        params: {
          rowNo: row.rowNo,
        },
      })
    }

    if (seenCodes.has(row.code)) {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_DUPLICATE_CODE',
        messageKey: 'org.line.import.error.duplicateCode',
        message: `Row ${row.rowNo}: Duplicate line code in import file`,
        params: {
          rowNo: row.rowNo,
          code: row.code,
        },
      })
    }

    seenCodes.add(row.code)

    const department = await findDepartmentByCode(row.departmentCode)

    if (!department) {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_DEPARTMENT_NOT_FOUND',
        messageKey: 'org.line.import.error.departmentNotFound',
        message: `Row ${row.rowNo}: Department Code not found`,
        params: {
          rowNo: row.rowNo,
          departmentCode: row.departmentCode,
        },
      })
    }

    const positions = await findPositionsByCodes(row.positionCodes)
    const foundPositionCodeSet = new Set(positions.map((position) => upper(position.code)))
    const missingPositionCodes = row.positionCodes.filter(
      (positionCode) => !foundPositionCodeSet.has(positionCode),
    )

    if (missingPositionCodes.length) {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_POSITION_NOT_FOUND',
        messageKey: 'org.line.import.error.positionNotFound',
        message: `Row ${row.rowNo}: Position Code not found`,
        params: {
          rowNo: row.rowNo,
          positionCodes: missingPositionCodes,
        },
      })
    }

    const invalidDepartmentPosition = positions.find(
      (position) => id(position.departmentId) !== id(department._id),
    )

    if (invalidDepartmentPosition) {
      throw appError({
        statusCode: 400,
        code: 'LINE_IMPORT_POSITION_DEPARTMENT_MISMATCH',
        messageKey: 'org.line.import.error.positionDepartmentMismatch',
        message: `Row ${row.rowNo}: Position does not belong to Department`,
        params: {
          rowNo: row.rowNo,
          positionCode: invalidDepartmentPosition.code,
        },
      })
    }

    const existing = await ProductionLine.findOne({ code: row.code })

    if (existing) {
      existing.name = row.name
      existing.departmentId = department._id
      existing.positionIds = positions.map((position) => position._id)
      existing.description = row.description
      existing.isActive = row.isActive
      existing.updatedBy = actorId

      await existing.save()

      updated += 1
      continue
    }

    await ProductionLine.create({
      code: row.code,
      name: row.name,
      departmentId: department._id,
      positionIds: positions.map((position) => position._id),
      description: row.description,
      isActive: row.isActive,
      createdBy: actorId,
      updatedBy: actorId,
    })

    created += 1
  }

  return {
    summary: {
      totalRows: normalizedRows.length,
      created,
      updated,
    },
    messageKey: 'org.line.import.success.completed',
  }
}

module.exports = {
  list,
  lookup,
  getById,
  create,
  update,
  exportExcel,
  downloadImportSample,
  importExcel,
}