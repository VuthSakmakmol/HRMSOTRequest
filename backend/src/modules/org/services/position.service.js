// backend/src/modules/org/services/position.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const AppError = require('../../../shared/errors/AppError')
const Position = require('../models/Position')
const Department = require('../models/Department')

const POSITION_HIERARCHY_SCOPE = ['SAME_LINE', 'GLOBAL', 'CROSS_DEPARTMENT']

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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
}

function makeLabel(code, name) {
  const c = upper(code)
  const n = s(name)

  if (c && n) return `${c} - ${n}`
  if (c) return c
  return n
}

function mapPosition(doc) {
  if (!doc) return null

  const departmentId = doc.departmentId ? String(doc.departmentId) : ''
  const reportsToPositionId = doc.reportsToPositionId
    ? String(doc.reportsToPositionId)
    : ''

  return {
    id: String(doc._id),
    _id: String(doc._id),

    code: doc.code || '',
    name: doc.name || '',
    label: makeLabel(doc.code, doc.name),
    description: doc.description || '',

    departmentId,
    departmentCode: doc.departmentCode || '',
    departmentName: doc.departmentName || '',
    departmentLabel: doc.departmentCode
      ? makeLabel(doc.departmentCode, doc.departmentName)
      : '',

    reportsToPositionId,
    reportsToPositionCode: doc.reportsToPositionCode || '',
    reportsToPositionName: doc.reportsToPositionName || '',
    reportsToPositionLabel: doc.reportsToPositionCode
      ? makeLabel(doc.reportsToPositionCode, doc.reportsToPositionName)
      : '',

    hierarchyScope: doc.hierarchyScope || 'SAME_LINE',
    level: Number(doc.level || 0),
    isActive: !!doc.isActive,

    createdBy: doc.createdBy || '',
    updatedBy: doc.updatedBy || '',

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function mapLookupItem(doc) {
  const item = mapPosition(doc)

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

    reportsToPositionId: item.reportsToPositionId,
    reportsToPositionCode: item.reportsToPositionCode,
    reportsToPositionName: item.reportsToPositionName,
    reportsToPositionLabel: item.reportsToPositionLabel,

    hierarchyScope: item.hierarchyScope,
    level: item.level,
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
      { departmentCode: regex },
      { departmentName: regex },
      { reportsToPositionCode: regex },
      { reportsToPositionName: regex },
      { hierarchyScope: regex },
    ]
  }

  if (query.isActive === 'true') filter.isActive = true
  if (query.isActive === 'false') filter.isActive = false

  if (isObjectId(query.departmentId)) {
    filter.departmentId = query.departmentId
  } else if (s(query.departmentCode)) {
    filter.departmentCode = upper(query.departmentCode)
  }

  if (isObjectId(query.reportsToPositionId)) {
    filter.reportsToPositionId = query.reportsToPositionId
  } else if (s(query.reportsToPositionCode)) {
    filter.reportsToPositionCode = upper(query.reportsToPositionCode)
  }

  if (s(query.hierarchyScope)) {
    filter.hierarchyScope = upper(query.hierarchyScope)
  }

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const allowedFields = new Set([
    'code',
    'name',
    'departmentName',
    'reportsToPositionName',
    'hierarchyScope',
    'level',
    'isActive',
    'createdAt',
    'updatedAt',
  ])

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

  const exists = await Position.exists(filter)

  if (exists) {
    throw appError({
      statusCode: 409,
      code: 'POSITION_CODE_EXISTS',
      messageKey: 'org.position.error.codeExists',
      message: 'Position code already exists',
      field: 'code',
      params: {
        code: normalizedCode,
      },
    })
  }
}

async function getDepartmentSnapshot(payload = {}) {
  const departmentId = s(payload.departmentId)
  const departmentCode = upper(payload.departmentCode)

  if (!departmentId && !departmentCode) {
    return {
      departmentId: null,
      departmentCode: '',
      departmentName: '',
    }
  }

  let department = null

  if (departmentId) {
    await ensureObjectId(departmentId, 'departmentId')
    department = await Department.findById(departmentId).lean()
  } else if (departmentCode) {
    department = await Department.findOne({ code: departmentCode }).lean()
  }

  if (!department) {
    throw appError({
      statusCode: 404,
      code: 'POSITION_DEPARTMENT_NOT_FOUND',
      messageKey: 'org.position.error.departmentNotFound',
      message: 'Department not found',
      field: 'departmentId',
      params: {
        departmentId,
        departmentCode,
      },
    })
  }

  return {
    departmentId: department._id,
    departmentCode: upper(department.code),
    departmentName: s(department.name),
  }
}

async function getReportsToPositionSnapshot(payload = {}, currentPositionId = null) {
  const reportsToPositionId = s(payload.reportsToPositionId)
  const reportsToPositionCode = upper(payload.reportsToPositionCode)
  const currentIdText = currentPositionId ? String(currentPositionId) : ''

  if (!reportsToPositionId && !reportsToPositionCode) {
    return {
      reportsToPositionId: null,
      reportsToPositionCode: '',
      reportsToPositionName: '',
    }
  }

  let parent = null

  if (reportsToPositionId) {
    await ensureObjectId(reportsToPositionId, 'reportsToPositionId')

    if (currentIdText && String(reportsToPositionId) === currentIdText) {
      throw appError({
        statusCode: 400,
        code: 'POSITION_CANNOT_REPORT_TO_SELF',
        messageKey: 'org.position.error.cannotReportToSelf',
        message: 'Position cannot report to itself',
        field: 'reportsToPositionId',
      })
    }

    parent = await Position.findById(reportsToPositionId).lean()
  } else if (reportsToPositionCode) {
    parent = await Position.findOne({ code: reportsToPositionCode }).lean()

    if (parent && currentIdText && String(parent._id) === currentIdText) {
      throw appError({
        statusCode: 400,
        code: 'POSITION_CANNOT_REPORT_TO_SELF',
        messageKey: 'org.position.error.cannotReportToSelf',
        message: 'Position cannot report to itself',
        field: 'reportsToPositionId',
      })
    }
  }

  if (!parent) {
    throw appError({
      statusCode: 404,
      code: 'POSITION_REPORTS_TO_NOT_FOUND',
      messageKey: 'org.position.error.reportsToNotFound',
      message: 'Reports-to position not found',
      field: 'reportsToPositionId',
      params: {
        reportsToPositionId,
        reportsToPositionCode,
      },
    })
  }

  return {
    reportsToPositionId: parent._id,
    reportsToPositionCode: upper(parent.code),
    reportsToPositionName: s(parent.name),
  }
}

async function buildPositionPayload(payload = {}, actor = '', currentPositionId = null) {
  const data = {}

  if (hasOwn(payload, 'code')) {
    data.code = upper(payload.code)
  }

  if (hasOwn(payload, 'name')) {
    data.name = s(payload.name)
  }

  if (hasOwn(payload, 'description')) {
    data.description = s(payload.description)
  }

  if (hasOwn(payload, 'departmentId') || hasOwn(payload, 'departmentCode')) {
    Object.assign(data, await getDepartmentSnapshot(payload))
  }

  if (
    hasOwn(payload, 'reportsToPositionId') ||
    hasOwn(payload, 'reportsToPositionCode')
  ) {
    Object.assign(
      data,
      await getReportsToPositionSnapshot(payload, currentPositionId),
    )
  }

  if (hasOwn(payload, 'hierarchyScope')) {
    data.hierarchyScope = upper(payload.hierarchyScope || 'SAME_LINE')
  }

  if (hasOwn(payload, 'level')) {
    const level = Number(payload.level || 0)
    data.level = Number.isFinite(level) && level >= 0 ? Math.floor(level) : 0
  }

  if (hasOwn(payload, 'isActive')) {
    data.isActive = !!payload.isActive
  }

  data.updatedBy = s(actor)

  return data
}

async function syncChildPositionSnapshots(parentId, newItem) {
  if (!parentId || !newItem?.code) return

  await Position.updateMany(
    { reportsToPositionId: parentId },
    {
      $set: {
        reportsToPositionCode: newItem.code,
        reportsToPositionName: newItem.name,
      },
    },
  )
}

async function lookupPositions(query = {}) {
  const filter = buildFilter(query)
  const limit = Number(query.limit || 50)

  const items = await Position.find(filter)
    .sort({
      level: 1,
      name: 1,
      code: 1,
      _id: 1,
    })
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

async function listPositions(query = {}) {
  const page = Number(query.page || 1)
  const limit = Number(query.limit || 10)
  const skip = (page - 1) * limit

  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const [items, total] = await Promise.all([
    Position.find(filter).sort(sort).skip(skip).limit(limit).lean(),
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

async function getPositionById(id) {
  await ensureObjectId(id, 'positionId')

  const doc = await Position.findById(id).lean()

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

async function createPosition(payload = {}, actor = '') {
  const code = upper(payload.code)

  await ensureUniqueCode(code)

  const data = await buildPositionPayload(
    {
      ...payload,
      code,
    },
    actor,
    null,
  )

  const doc = await Position.create({
    ...data,
    createdBy: s(actor),
    updatedBy: s(actor),
  })

  return getPositionById(doc._id)
}

async function updatePosition(id, payload = {}, actor = '') {
  await ensureObjectId(id, 'positionId')

  const doc = await Position.findById(id)

  if (!doc) {
    throw appError({
      statusCode: 404,
      code: 'POSITION_NOT_FOUND',
      messageKey: 'org.position.error.notFound',
      message: 'Position not found',
      field: 'positionId',
    })
  }

  if (payload.code !== undefined) {
    const code = upper(payload.code)

    if (code !== doc.code) {
      await ensureUniqueCode(code, doc._id)
    }
  }

  const data = await buildPositionPayload(payload, actor, doc._id)

  Object.assign(doc, data)

  await doc.save()

  const item = await getPositionById(doc._id)

  await syncChildPositionSnapshots(doc._id, item)

  return item
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

      current.wch = Math.min(Math.max(current.wch, value.length + 2), 50)
      widths[index] = current
    })
  })

  return widths
}

async function exportPositionsExcel(query = {}) {
  const filter = buildFilter(query)
  const sort = buildSort(query.sortField, query.sortOrder)

  const items = await Position.find(filter).sort(sort).lean()

  const rows = items.map((doc, index) => {
    const item = mapPosition(doc)

    return {
      No: index + 1,
      Code: item.code,
      Name: item.name,
      Department: item.departmentLabel,
      'Reports To Position': item.reportsToPositionLabel,
      'Hierarchy Scope': item.hierarchyScope,
      Level: item.level,
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
          Department: '',
          'Reports To Position': '',
          'Hierarchy Scope': '',
          Level: '',
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
    filename: `positions-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: workbookToBuffer(workbook),
  }
}

async function downloadPositionImportSample() {
  const sampleRows = [
    {
      Code: 'SEWER',
      Name: 'Sewer',
      'Department Code': 'PROD',
      'Reports To Position Code': 'SEW-SUP',
      'Hierarchy Scope': 'SAME_LINE',
      Level: 1,
      Description: 'Production sewer position',
      Status: 'Active',
    },
    {
      Code: 'SEW-SUP',
      Name: 'Sewing Supervisor',
      'Department Code': 'PROD',
      'Reports To Position Code': 'PROD-MGR',
      'Hierarchy Scope': 'SAME_LINE',
      Level: 2,
      Description: '',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Position Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Code', 'Required. Unique position code. Example: SEWER'],
    ['Name', 'Required. Position display name.'],
    ['Department Code', 'Optional. Must exist in Department master if provided.'],
    ['Reports To Position Code', 'Optional. Must exist or be included in the same import file.'],
    ['Hierarchy Scope', 'Optional. SAME_LINE, GLOBAL, or CROSS_DEPARTMENT. Blank = SAME_LINE.'],
    ['Level', 'Optional. Number greater than or equal to 0. Blank = 0.'],
    ['Description', 'Optional. Maximum 1000 characters.'],
    ['Status', 'Optional. Use Active or Inactive. Blank = Active.'],
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

function normalizeImportScope(value) {
  const scope = upper(value || 'SAME_LINE')

  if (!scope) return 'SAME_LINE'
  if (POSITION_HIERARCHY_SCOPE.includes(scope)) return scope

  return 'INVALID_SCOPE'
}

function normalizeImportLevel(value) {
  if (value === '' || value === undefined || value === null) return 0

  const level = Number(value)

  if (!Number.isFinite(level) || level < 0) return 'INVALID_LEVEL'

  return Math.floor(level)
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
    code: 'POSITION_IMPORT_VALIDATION_FAILED',
    messageKey: 'org.position.import.error.validationFailed',
    message: `Import failed. ${errors.length} problem${errors.length > 1 ? 's' : ''} found. Please fix all errors and try again.`,
    params: {
      errorCount: errors.length,
      errors,
    },
  })
}

function normalizeImportRow(row, index) {
  const rowNo = index + 2

  const rawCode = getCell(row, ['Code', 'Position Code', 'PositionCode'])
  const rawName = getCell(row, ['Name', 'Position Name', 'PositionName'])
  const rawDepartmentCode = getCell(row, [
    'Department Code',
    'DepartmentCode',
    'Department',
    'Dept Code',
  ])
  const rawReportsToPositionCode = getCell(row, [
    'Reports To Position Code',
    'ReportsToPositionCode',
    'Parent Position Code',
    'ParentPositionCode',
    'Reports To',
  ])
  const rawHierarchyScope = getCell(row, [
    'Hierarchy Scope',
    'HierarchyScope',
    'Scope',
  ])
  const rawLevel = getCell(row, ['Level', 'Position Level'])
  const rawDescription = getCell(row, ['Description', 'Remark', 'Remarks'])
  const rawStatus = getCell(row, ['Status', 'Active', 'Is Active', 'IsActive'])

  const isBlankRow = [
    rawCode,
    rawName,
    rawDepartmentCode,
    rawReportsToPositionCode,
    rawHierarchyScope,
    rawLevel,
    rawDescription,
    rawStatus,
  ].every((value) => !s(value))

  if (isBlankRow) return null

  return {
    rowNo,

    rawCode,
    rawName,
    rawDepartmentCode,
    rawReportsToPositionCode,
    rawHierarchyScope,
    rawLevel,
    rawDescription,
    rawStatus,

    code: upper(rawCode),
    name: s(rawName),
    departmentCode: upper(rawDepartmentCode),
    reportsToPositionCode: upper(rawReportsToPositionCode),
    hierarchyScope: normalizeImportScope(rawHierarchyScope),
    level: normalizeImportLevel(rawLevel),
    description: s(rawDescription),
    isActive: normalizeImportStatus(rawStatus),
  }
}

async function validatePositionImportRows(normalizedRows = []) {
  const errors = []
  const seenCodes = new Map()

  const departmentCodes = Array.from(
    new Set(
      normalizedRows
        .map((row) => row.departmentCode)
        .filter((code) => code && code.length <= 50),
    ),
  )

  const reportsToPositionCodes = Array.from(
    new Set(
      normalizedRows
        .map((row) => row.reportsToPositionCode)
        .filter((code) => code && code.length <= 50),
    ),
  )

  const [departments, existingReportsToPositions] = await Promise.all([
    departmentCodes.length
      ? Department.find({ code: { $in: departmentCodes } }).lean()
      : [],
    reportsToPositionCodes.length
      ? Position.find({ code: { $in: reportsToPositionCodes } }).lean()
      : [],
  ])

  const departmentMap = new Map(
    departments.map((department) => [upper(department.code), department]),
  )

  const existingReportsToCodeSet = new Set(
    existingReportsToPositions.map((position) => upper(position.code)),
  )

  const candidateRows = []

  for (const row of normalizedRows) {
    let hasRowError = false

    if (!row.code) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Code',
        value: row.rawCode,
        code: 'POSITION_IMPORT_CODE_REQUIRED',
        messageKey: 'org.position.import.error.codeRequired',
        reason: `Row ${row.rowNo}: Code is required.`,
      })
    } else if (row.code.length < 2) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Code',
        value: row.rawCode,
        code: 'POSITION_IMPORT_CODE_MIN_LENGTH',
        messageKey: 'org.position.import.error.codeMinLength',
        reason: `Row ${row.rowNo}: Code must be at least 2 characters.`,
        params: {
          min: 2,
          code: row.code,
        },
      })
    } else if (row.code.length > 50) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Code',
        value: row.rawCode,
        code: 'POSITION_IMPORT_CODE_TOO_LONG',
        messageKey: 'org.position.import.error.codeTooLong',
        reason: `Row ${row.rowNo}: Code must not be longer than 50 characters.`,
        params: {
          max: 50,
          code: row.code,
        },
      })
    }

    if (!row.name) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Name',
        value: row.rawName,
        code: 'POSITION_IMPORT_NAME_REQUIRED',
        messageKey: 'org.position.import.error.nameRequired',
        reason: `Row ${row.rowNo}: Name is required.`,
      })
    } else if (row.name.length < 2) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Name',
        value: row.rawName,
        code: 'POSITION_IMPORT_NAME_MIN_LENGTH',
        messageKey: 'org.position.import.error.nameMinLength',
        reason: `Row ${row.rowNo}: Name must be at least 2 characters.`,
        params: {
          min: 2,
        },
      })
    } else if (row.name.length > 150) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Name',
        value: row.rawName,
        code: 'POSITION_IMPORT_NAME_TOO_LONG',
        messageKey: 'org.position.import.error.nameTooLong',
        reason: `Row ${row.rowNo}: Name must not be longer than 150 characters.`,
        params: {
          max: 150,
        },
      })
    }

    if (row.departmentCode.length > 50) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Code',
        value: row.rawDepartmentCode,
        code: 'POSITION_IMPORT_DEPARTMENT_CODE_TOO_LONG',
        messageKey: 'org.position.import.error.departmentCodeTooLong',
        reason: `Row ${row.rowNo}: Department Code must not be longer than 50 characters.`,
        params: {
          max: 50,
        },
      })
    } else if (row.departmentCode && !departmentMap.has(row.departmentCode)) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Code',
        value: row.rawDepartmentCode,
        code: 'POSITION_IMPORT_DEPARTMENT_NOT_FOUND',
        messageKey: 'org.position.import.error.departmentNotFound',
        reason: `Row ${row.rowNo}: Department Code "${row.departmentCode}" was not found.`,
        params: {
          departmentCode: row.departmentCode,
        },
      })
    }

    if (row.reportsToPositionCode.length > 50) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Reports To Position Code',
        value: row.rawReportsToPositionCode,
        code: 'POSITION_IMPORT_REPORTS_TO_CODE_TOO_LONG',
        messageKey: 'org.position.import.error.reportsToCodeTooLong',
        reason: `Row ${row.rowNo}: Reports To Position Code must not be longer than 50 characters.`,
        params: {
          max: 50,
        },
      })
    }

    if (row.reportsToPositionCode && row.reportsToPositionCode === row.code) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Reports To Position Code',
        value: row.rawReportsToPositionCode,
        code: 'POSITION_IMPORT_CANNOT_REPORT_TO_SELF',
        messageKey: 'org.position.import.error.cannotReportToSelf',
        reason: `Row ${row.rowNo}: Position cannot report to itself.`,
        params: {
          code: row.code,
        },
      })
    }

    if (row.hierarchyScope === 'INVALID_SCOPE') {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Hierarchy Scope',
        value: row.rawHierarchyScope,
        code: 'POSITION_IMPORT_INVALID_SCOPE',
        messageKey: 'org.position.import.error.invalidScope',
        reason: `Row ${row.rowNo}: Hierarchy Scope must be SAME_LINE, GLOBAL, or CROSS_DEPARTMENT.`,
        params: {
          allowedValues: POSITION_HIERARCHY_SCOPE,
        },
      })
    }

    if (row.level === 'INVALID_LEVEL') {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Level',
        value: row.rawLevel,
        code: 'POSITION_IMPORT_INVALID_LEVEL',
        messageKey: 'org.position.import.error.invalidLevel',
        reason: `Row ${row.rowNo}: Level must be a number greater than or equal to 0.`,
      })
    }

    if (row.description.length > 1000) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Description',
        value: row.rawDescription,
        code: 'POSITION_IMPORT_DESCRIPTION_TOO_LONG',
        messageKey: 'org.position.import.error.descriptionTooLong',
        reason: `Row ${row.rowNo}: Description must not be longer than 1000 characters.`,
        params: {
          max: 1000,
        },
      })
    }

    if (row.isActive === 'INVALID_STATUS') {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Status',
        value: row.rawStatus,
        code: 'POSITION_IMPORT_INVALID_STATUS',
        messageKey: 'org.position.import.error.invalidStatus',
        reason: `Row ${row.rowNo}: Status must be Active or Inactive.`,
        params: {
          allowedValues: ['Active', 'Inactive'],
        },
      })
    }

    if (row.code) {
      const firstRowNo = seenCodes.get(row.code)

      if (firstRowNo) {
        hasRowError = true

        addImportError(errors, {
          rowNo: row.rowNo,
          field: 'Code',
          value: row.rawCode,
          code: 'POSITION_IMPORT_DUPLICATE_CODE',
          messageKey: 'org.position.import.error.duplicateCode',
          reason: `Row ${row.rowNo}: Duplicate code "${row.code}" in Excel file. First found at row ${firstRowNo}.`,
          params: {
            code: row.code,
            firstRowNo,
          },
        })
      } else {
        seenCodes.set(row.code, row.rowNo)
      }
    }

    if (!hasRowError) {
      candidateRows.push(row)
    }
  }

  const candidateCodeSet = new Set(candidateRows.map((row) => row.code))
  const validRows = []

  for (const row of candidateRows) {
    let hasRowError = false

    if (
      row.reportsToPositionCode &&
      !existingReportsToCodeSet.has(row.reportsToPositionCode) &&
      !candidateCodeSet.has(row.reportsToPositionCode)
    ) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Reports To Position Code',
        value: row.rawReportsToPositionCode,
        code: 'POSITION_IMPORT_REPORTS_TO_NOT_FOUND',
        messageKey: 'org.position.import.error.reportsToNotFound',
        reason: `Row ${row.rowNo}: Reports To Position Code "${row.reportsToPositionCode}" was not found.`,
        params: {
          reportsToPositionCode: row.reportsToPositionCode,
        },
      })
    }

    if (!hasRowError) {
      validRows.push(row)
    }
  }

  throwImportValidationError(errors)

  return {
    validRows,
    departmentMap,
  }
}

async function importPositionsExcel(fileBuffer, actor = '') {
  if (!fileBuffer) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_EXCEL_FILE_REQUIRED',
      messageKey: 'org.position.error.excelFileRequired',
      message: 'Excel file is required',
    })
  }

  const rows = readWorkbookRows(fileBuffer)

  if (!rows.length) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_EXCEL_NO_ROWS',
      messageKey: 'org.position.error.excelNoRows',
      message: 'Excel file has no rows',
    })
  }

  const normalizedRows = rows
    .map((row, index) => normalizeImportRow(row, index))
    .filter(Boolean)

  if (!normalizedRows.length) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_EXCEL_NO_VALID_ROWS',
      messageKey: 'org.position.error.excelNoValidRows',
      message: 'Excel file has no valid rows',
    })
  }

  const { validRows, departmentMap } = await validatePositionImportRows(normalizedRows)

  if (!validRows.length) {
    throw appError({
      statusCode: 400,
      code: 'POSITION_EXCEL_NO_VALID_ROWS',
      messageKey: 'org.position.error.excelNoValidRows',
      message: 'Excel file has no valid rows',
    })
  }

  const session = await mongoose.startSession()

  let summary = {
    totalRows: validRows.length,
    created: 0,
    updated: 0,
    failed: 0,
  }

  let results = []

  try {
    await session.withTransaction(async () => {
      const positionCodes = validRows.map((row) => row.code)

      const existingPositions = await Position.find({
        code: {
          $in: positionCodes,
        },
      })
        .select('code')
        .session(session)
        .lean()

      const existingCodeSet = new Set(
        existingPositions.map((position) => upper(position.code)),
      )

      const created = validRows.filter(
        (row) => !existingCodeSet.has(row.code),
      ).length

      const updated = validRows.length - created

      const baseOperations = validRows.map((row) => {
        const department = row.departmentCode
          ? departmentMap.get(row.departmentCode)
          : null

        return {
          updateOne: {
            filter: {
              code: row.code,
            },
            update: {
              $set: {
                code: row.code,
                name: row.name,
                description: row.description,

                departmentId: department?._id || null,
                departmentCode: upper(department?.code),
                departmentName: s(department?.name),

                hierarchyScope: row.hierarchyScope || 'SAME_LINE',
                level: row.level,
                isActive: row.isActive,
                updatedBy: s(actor),
              },
              $setOnInsert: {
                createdBy: s(actor),
              },
            },
            upsert: true,
          },
        }
      })

      await Position.bulkWrite(baseOperations, {
        ordered: true,
        session,
      })

      const neededPositionCodes = Array.from(
        new Set([
          ...validRows.map((row) => row.code),
          ...validRows.map((row) => row.reportsToPositionCode).filter(Boolean),
        ]),
      )

      const neededPositions = neededPositionCodes.length
        ? await Position.find({
            code: {
              $in: neededPositionCodes,
            },
          })
            .session(session)
            .lean()
        : []

      const positionMap = new Map(
        neededPositions.map((position) => [upper(position.code), position]),
      )

      const parentOperations = validRows.map((row) => {
        const parent = row.reportsToPositionCode
          ? positionMap.get(row.reportsToPositionCode)
          : null

        return {
          updateOne: {
            filter: {
              code: row.code,
            },
            update: {
              $set: {
                reportsToPositionId: parent?._id || null,
                reportsToPositionCode: upper(parent?.code),
                reportsToPositionName: s(parent?.name),
              },
            },
          },
        }
      })

      await Position.bulkWrite(parentOperations, {
        ordered: true,
        session,
      })

      const importedPositions = await Position.find({
        code: {
          $in: positionCodes,
        },
      })
        .select('code name')
        .session(session)
        .lean()

      for (const position of importedPositions) {
        await Position.updateMany(
          {
            reportsToPositionId: position._id,
          },
          {
            $set: {
              reportsToPositionCode: upper(position.code),
              reportsToPositionName: s(position.name),
            },
          },
          {
            session,
          },
        )
      }

      summary = {
        totalRows: validRows.length,
        created,
        updated,
        failed: 0,
      }

      results = validRows
        .map((row) => ({
          rowNo: row.rowNo,
          code: row.code,
          name: row.name,
          status: existingCodeSet.has(row.code) ? 'UPDATED' : 'CREATED',
        }))
        .sort((a, b) => Number(a.rowNo || 0) - Number(b.rowNo || 0))
    })
  } catch (error) {
    if (Number(error?.code) === 11000) {
      throw appError({
        statusCode: 409,
        code: 'POSITION_IMPORT_DUPLICATE_DATABASE_CODE',
        messageKey: 'org.position.import.error.duplicateDatabaseCode',
        message: 'Import failed because one or more position codes already conflict with existing data.',
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
    results,
    errors: [],
    messageKey: 'org.position.import.success.completed',
  }
}

module.exports = {
  lookupPositions,
  createPosition,
  listPositions,
  getPositionById,
  updatePosition,
  exportPositionsExcel,
  downloadPositionImportSample,
  importPositionsExcel,
}