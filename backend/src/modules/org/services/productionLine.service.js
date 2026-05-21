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

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

function normalizeIdList(values = []) {
  return uniqueStrings(values)
}

function mapDepartment(department) {
  if (!department) return null

  return {
    id: id(department),
    _id: id(department),
    code: department.code || '',
    name: department.name || '',
    label: makeLabel(department.code, department.name),
  }
}

function mapPosition(position) {
  if (!position) return null

  return {
    id: id(position),
    _id: id(position),
    code: position.code || '',
    name: position.name || '',
    label: makeLabel(position.code, position.name),
    departmentId: id(position.departmentId),
  }
}

function getDepartmentsFromLineDoc(doc) {
  const rawDepartments = []

  if (doc?.departmentId) {
    rawDepartments.push(doc.departmentId)
  }

  if (Array.isArray(doc?.departmentIds)) {
    rawDepartments.push(...doc.departmentIds)
  }

  const seen = new Set()
  const departments = []

  rawDepartments.forEach((department) => {
    const departmentId = id(department)

    if (!departmentId || seen.has(departmentId)) return

    seen.add(departmentId)
    departments.push(department)
  })

  return departments
}

function mapLine(doc) {
  if (!doc) return null

  const primaryDepartment = doc.departmentId
  const primaryDepartmentId = id(primaryDepartment)

  const departments = getDepartmentsFromLineDoc(doc)
    .map(mapDepartment)
    .filter(Boolean)

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

    // Legacy / primary department fields.
    departmentId: primaryDepartmentId,
    departmentCode: primaryDepartment?.code || '',
    departmentName: primaryDepartment?.name || '',
    departmentLabel: primaryDepartmentId
      ? makeLabel(primaryDepartment?.code, primaryDepartment?.name)
      : '',

    // New multi-department fields.
    departmentIds: departments.map((department) => department.id),
    departments,
    departmentCodes: departments.map((department) => department.code).filter(Boolean),
    departmentNames: departments.map((department) => department.name).filter(Boolean),
    departmentsLabel: departments.length
      ? departments.map((department) => department.label).filter(Boolean).join(', ')
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

    departmentIds: item.departmentIds,
    departments: item.departments,
    departmentCodes: item.departmentCodes,
    departmentNames: item.departmentNames,
    departmentsLabel: item.departmentsLabel,

    positionIds: item.positionIds,
    positions: item.positions,

    isActive: item.isActive,
  }
}

function buildFilter(query = {}) {
  const filter = {}
  const andFilters = []

  const keyword = s(query.search)

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i')

    andFilters.push({
      $or: [{ code: regex }, { name: regex }, { description: regex }],
    })
  }

  if (query.isActive === 'true' || query.isActive === true) filter.isActive = true
  if (query.isActive === 'false' || query.isActive === false) filter.isActive = false

  if (isObjectId(query.departmentId)) {
    andFilters.push({
      $or: [
        { departmentId: query.departmentId },
        { departmentIds: query.departmentId },
      ],
    })
  }

  if (andFilters.length) {
    filter.$and = andFilters
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

function normalizeDepartmentIdsFromPayload(payload = {}) {
  const ids = []

  if (Array.isArray(payload.departmentIds)) {
    ids.push(...payload.departmentIds)
  }

  if (payload.departmentId) {
    ids.push(payload.departmentId)
  }

  return normalizeIdList(ids)
}

async function ensureDepartmentsExist(departmentIds = []) {
  const ids = normalizeIdList(departmentIds)

  if (!ids.length) {
    throw appError({
      statusCode: 400,
      code: 'LINE_DEPARTMENT_REQUIRED',
      messageKey: 'org.line.validation.departmentRequired',
      message: 'At least one department is required',
      field: 'departmentIds',
    })
  }

  ids.forEach((departmentId) => {
    if (!isObjectId(departmentId)) {
      throw appError({
        statusCode: 400,
        code: 'INVALID_DEPARTMENT_ID',
        messageKey: 'org.department.error.invalidId',
        message: 'Invalid department id',
        field: 'departmentIds',
        params: {
          departmentId,
        },
      })
    }
  })

  const departments = await Department.find({
    _id: {
      $in: ids,
    },
  })
    .select('_id code name isActive')
    .lean()

  if (departments.length !== ids.length) {
    throw appError({
      statusCode: 404,
      code: 'DEPARTMENT_NOT_FOUND',
      messageKey: 'org.department.error.notFound',
      message: 'Some selected departments were not found',
      field: 'departmentIds',
    })
  }

  const byId = new Map(departments.map((department) => [id(department._id), department]))

  return ids.map((departmentId) => byId.get(departmentId)).filter(Boolean)
}

async function ensurePositionsAllowed(positionIds = [], departmentIds = []) {
  const ids = normalizeIdList(positionIds)
  const allowedDepartmentIdSet = new Set(normalizeIdList(departmentIds))

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
    (position) => !allowedDepartmentIdSet.has(id(position.departmentId)),
  )

  if (invalidDepartment) {
    throw appError({
      statusCode: 400,
      code: 'LINE_POSITION_DEPARTMENT_MISMATCH',
      messageKey: 'org.line.error.positionDepartmentMismatch',
      message: 'Selected position does not belong to selected line departments',
      field: 'positionIds',
      params: {
        positionId: id(invalidDepartment._id),
        positionDepartmentId: id(invalidDepartment.departmentId),
        departmentIds: Array.from(allowedDepartmentIdSet),
      },
    })
  }

  return positions
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
      .populate('departmentIds', 'code name')
      .populate('positionIds', 'code name departmentId')
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
  const page = Math.max(1, Number(query.page || 1))
  const limit = Math.max(1, Math.min(Number(query.limit || 10), 100))
  const skip = (page - 1) * limit

  const filter = buildFilter({
    ...query,
    search: s(query.search || query.q),
  })

  const [items, total] = await Promise.all([
    ProductionLine.find(filter)
      .populate('departmentId', 'code name')
      .populate('departmentIds', 'code name')
      .populate('positionIds', 'code name departmentId')
      .sort({ name: 1, code: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    ProductionLine.countDocuments(filter),
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

async function getById(lineId) {
  await ensureObjectId(lineId, 'lineId')

  const doc = await ProductionLine.findById(lineId)
    .populate('departmentId', 'code name')
    .populate('departmentIds', 'code name')
    .populate('positionIds', 'code name departmentId')
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

  const departmentIds = normalizeDepartmentIdsFromPayload(payload)
  const departments = await ensureDepartmentsExist(departmentIds)
  const departmentObjectIds = departments.map((department) => department._id)

  const positions = await ensurePositionsAllowed(
    payload.positionIds || [],
    departmentObjectIds,
  )

  const actorId = getActorId(currentUser)

  const doc = await ProductionLine.create({
    code,
    name: s(payload.name),
    departmentId: departmentObjectIds[0],
    departmentIds: departmentObjectIds,
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

  if (
    payload.departmentId !== undefined ||
    payload.departmentIds !== undefined ||
    payload.positionIds !== undefined
  ) {
    const existingDepartmentIds = normalizeIdList(
      Array.isArray(doc.departmentIds) && doc.departmentIds.length
        ? doc.departmentIds
        : [doc.departmentId],
    )

    const nextDepartmentIds =
      payload.departmentId !== undefined || payload.departmentIds !== undefined
        ? normalizeDepartmentIdsFromPayload(payload)
        : existingDepartmentIds

    const departments = await ensureDepartmentsExist(nextDepartmentIds)
    const departmentObjectIds = departments.map((department) => department._id)

    const positions = await ensurePositionsAllowed(
      payload.positionIds !== undefined ? payload.positionIds : doc.positionIds,
      departmentObjectIds,
    )

    doc.departmentId = departmentObjectIds[0]
    doc.departmentIds = departmentObjectIds
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
    .populate('departmentIds', 'code name')
    .populate('positionIds', 'code name departmentId')
    .sort(sort)
    .lean()

  const rows = items.map((doc, index) => {
    const item = mapLine(doc)

    return {
      No: index + 1,
      Code: item.code,
      Name: item.name,
      'Department Codes': item.departmentCodes.join(','),
      Departments: item.departmentNames.join(', '),
      'Primary Department Code': item.departmentCode,
      'Primary Department': item.departmentName,
      'Position Codes': item.positionCodes.join(','),
      'Allowed Positions': item.allowedPositionsLabel || 'All positions in selected departments',
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
          'Department Codes': '',
          Departments: '',
          'Primary Department Code': '',
          'Primary Department': '',
          'Position Codes': '',
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
      Code: 'LINE-02',
      Name: 'Sewing Line 02',
      'Department Codes': 'SEWING,PROD-MGT',
      'Position Codes': 'SEWER,FM',
      Description: 'Sewing line managed with Production Management support',
      Status: 'Active',
    },
    {
      Code: 'LINE-03',
      Name: 'Sewing Line 03',
      'Department Codes': 'SEWING',
      'Position Codes': '',
      Description: 'Empty Position Codes means all positions in selected departments',
      Status: 'Active',
    },
  ]

  const guideRows = [
    ['Production Line Import Guide', ''],
    ['', ''],
    ['Field', 'Rule'],
    ['Code', 'Required. Unique line code. Example: LINE-02'],
    ['Name', 'Required. Line display name.'],
    ['Department Codes', 'Required. Comma-separated department codes. Example: SEWING,PROD-MGT'],
    ['Position Codes', 'Optional. Comma-separated position codes. Blank = all positions in selected departments.'],
    ['Description', 'Optional. Maximum 500 characters.'],
    ['Status', 'Optional. Use Active or Inactive. Blank = Active.'],
    ['', ''],
    ['Important', 'Each Position Code must belong to at least one selected Department Code.'],
  ]

  const workbook = XLSX.utils.book_new()
  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)

  sampleSheet['!cols'] = autoFitColumns(sampleRows)
  guideSheet['!cols'] = [{ wch: 30 }, { wch: 100 }]

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

function getMatchingCells(row, headerPrefixes = []) {
  const normalizedPrefixes = headerPrefixes.map(normalizeHeader)

  return Object.entries(row || {})
    .filter(([key]) => {
      const normalizedKey = normalizeHeader(key)

      return normalizedPrefixes.some((prefix) =>
        normalizedKey === prefix || normalizedKey.startsWith(prefix),
      )
    })
    .map(([, value]) => value)
}

function normalizeCodeToken(value) {
  const text = upper(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''

  // Accept exported labels like: SEWING - Sewing Department
  // Keep only the real code before " - ".
  const labelParts = text.split(/\s+-\s+/)

  return upper(labelParts[0])
}

function splitCodes(...values) {
  return uniqueStrings(
    values
      .flatMap((value) =>
        String(value || '')
          .split(/[,，;\n\r\t|]+/)
          .map(normalizeCodeToken),
      )
      .filter(Boolean),
  )
}

function getRawDepartmentCodeCells(row) {
  return getMatchingCells(row, [
    'Department Codes',
    'Department Code',
    'DepartmentCodes',
    'DepartmentCode',
    'Departments',
    'Department',
  ])
}

function getRawPositionCodeCells(row) {
  return getMatchingCells(row, [
    'Position Codes',
    'Position Code',
    'PositionCodes',
    'PositionCode',
    'Allowed Positions',
    'Allowed Position',
    'AllowedPositions',
    'AllowedPosition',
  ])
}

function normalizeImportStatus(value) {
  const text = s(value).toLowerCase()

  if (!text) return true
  if (['active', 'true', 'yes', 'y', '1'].includes(text)) return true
  if (['inactive', 'false', 'no', 'n', '0'].includes(text)) return false

  return 'INVALID_STATUS'
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
    code: 'LINE_IMPORT_VALIDATION_FAILED',
    messageKey: 'org.line.import.error.validationFailed',
    message: `Import failed. ${errors.length} problem${errors.length > 1 ? 's' : ''} found. Please fix all errors and try again.`,
    params: {
      errorCount: errors.length,
      errors,
    },
  })
}

function findDuplicateValues(values = []) {
  const seen = new Map()
  const duplicates = []

  values.forEach((value) => {
    const cleanValue = upper(value)
    if (!cleanValue) return

    const count = Number(seen.get(cleanValue) || 0) + 1
    seen.set(cleanValue, count)

    if (count === 2) {
      duplicates.push(cleanValue)
    }
  })

  return duplicates
}

function normalizeImportRow(row, index) {
  const rowNo = index + 2

  const rawCode = getCell(row, ['Code', 'Line Code', 'LineCode'])
  const rawName = getCell(row, ['Name', 'Line Name', 'LineName'])

  const rawDepartmentCodeCells = getRawDepartmentCodeCells(row)
  const rawDepartmentCodes = rawDepartmentCodeCells
    .map((value) => s(value))
    .filter(Boolean)
    .join(', ')

  const rawPositionCodeCells = getRawPositionCodeCells(row)
  const rawPositionCodes = rawPositionCodeCells
    .map((value) => s(value))
    .filter(Boolean)
    .join(', ')

  const rawDescription = getCell(row, ['Description', 'Remark', 'Remarks'])
  const rawStatus = getCell(row, ['Status', 'Active', 'Is Active', 'IsActive'])

  const departmentCodes = splitCodes(...rawDepartmentCodeCells)
  const positionCodes = splitCodes(...rawPositionCodeCells)

  const isBlankRow = [
    rawCode,
    rawName,
    rawDepartmentCodes,
    rawPositionCodes,
    rawDescription,
    rawStatus,
  ].every((value) => !s(value))

  if (isBlankRow) return null

  return {
    rowNo,

    rawCode,
    rawName,
    rawDepartmentCodes,
    rawPositionCodes,
    rawDescription,
    rawStatus,

    code: upper(rawCode),
    name: s(rawName),
    departmentCodes,
    positionCodes,
    description: s(rawDescription),
    isActive: normalizeImportStatus(rawStatus),
  }
}

async function validateLineImportRows(normalizedRows = []) {
  const errors = []
  const seenCodes = new Map()

  const departmentCodes = Array.from(
    new Set(
      normalizedRows
        .flatMap((row) => row.departmentCodes || [])
        .filter((code) => code && code.length <= 50),
    ),
  )

  const allPositionCodes = Array.from(
    new Set(
      normalizedRows
        .flatMap((row) => row.positionCodes || [])
        .filter((code) => code && code.length <= 50),
    ),
  )

  const [departments, positions] = await Promise.all([
    departmentCodes.length
      ? Department.find({ code: { $in: departmentCodes } })
          .select('_id code name isActive')
          .lean()
      : [],

    allPositionCodes.length
      ? Position.find({ code: { $in: allPositionCodes } })
          .select('_id code name departmentId isActive')
          .lean()
      : [],
  ])

  const departmentMap = new Map(
    departments.map((department) => [upper(department.code), department]),
  )

  const positionsByCode = new Map()

  positions.forEach((position) => {
    const code = upper(position.code)

    if (!positionsByCode.has(code)) {
      positionsByCode.set(code, [])
    }

    positionsByCode.get(code).push(position)
  })

  const validRows = []

  for (const row of normalizedRows) {
    let hasRowError = false

    if (!row.code) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Code',
        value: row.rawCode,
        code: 'LINE_IMPORT_CODE_REQUIRED',
        messageKey: 'org.line.import.error.codeRequired',
        reason: `Row ${row.rowNo}: Code is required.`,
      })
    } else if (row.code.length > 50) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Code',
        value: row.rawCode,
        code: 'LINE_IMPORT_CODE_TOO_LONG',
        messageKey: 'org.line.import.error.codeTooLong',
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
        code: 'LINE_IMPORT_NAME_REQUIRED',
        messageKey: 'org.line.import.error.nameRequired',
        reason: `Row ${row.rowNo}: Name is required.`,
      })
    } else if (row.name.length > 120) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Name',
        value: row.rawName,
        code: 'LINE_IMPORT_NAME_TOO_LONG',
        messageKey: 'org.line.import.error.nameTooLong',
        reason: `Row ${row.rowNo}: Name must not be longer than 120 characters.`,
        params: {
          max: 120,
        },
      })
    }

    const duplicateDepartmentCodes = findDuplicateValues(row.departmentCodes)

    if (duplicateDepartmentCodes.length) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Codes',
        value: row.rawDepartmentCodes,
        code: 'LINE_IMPORT_DUPLICATE_DEPARTMENT_CODE_IN_ROW',
        messageKey: 'org.line.import.error.duplicateDepartmentCodeInRow',
        reason: `Row ${row.rowNo}: Duplicate Department Code in the same row: ${duplicateDepartmentCodes.join(', ')}.`,
        params: {
          departmentCodes: duplicateDepartmentCodes,
        },
      })
    }

    const tooLongDepartmentCodes = row.departmentCodes.filter(
      (departmentCode) => departmentCode.length > 50,
    )

    if (tooLongDepartmentCodes.length) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Codes',
        value: row.rawDepartmentCodes,
        code: 'LINE_IMPORT_DEPARTMENT_CODE_TOO_LONG',
        messageKey: 'org.line.import.error.departmentCodeTooLong',
        reason: `Row ${row.rowNo}: Department Code must not be longer than 50 characters: ${tooLongDepartmentCodes.join(', ')}.`,
        params: {
          departmentCodes: tooLongDepartmentCodes,
          max: 50,
        },
      })
    }

    if (!row.departmentCodes.length) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Codes',
        value: row.rawDepartmentCodes,
        code: 'LINE_IMPORT_DEPARTMENT_REQUIRED',
        messageKey: 'org.line.import.error.departmentRequired',
        reason: `Row ${row.rowNo}: Department Codes is required.`,
      })
    }

    const missingDepartmentCodes = row.departmentCodes.filter(
      (departmentCode) =>
        departmentCode.length <= 50 && !departmentMap.has(departmentCode),
    )

    if (missingDepartmentCodes.length) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Department Codes',
        value: row.rawDepartmentCodes,
        code: 'LINE_IMPORT_DEPARTMENT_NOT_FOUND',
        messageKey: 'org.line.import.error.departmentNotFound',
        reason: `Row ${row.rowNo}: Department Code not found: ${missingDepartmentCodes.join(', ')}.`,
        params: {
          departmentCodes: missingDepartmentCodes,
        },
      })
    }

    const duplicatePositionCodes = findDuplicateValues(row.positionCodes)

    if (duplicatePositionCodes.length) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Codes',
        value: row.rawPositionCodes,
        code: 'LINE_IMPORT_DUPLICATE_POSITION_CODE_IN_ROW',
        messageKey: 'org.line.import.error.duplicatePositionCodeInRow',
        reason: `Row ${row.rowNo}: Duplicate Position Code in the same row: ${duplicatePositionCodes.join(', ')}.`,
        params: {
          positionCodes: duplicatePositionCodes,
        },
      })
    }

    const tooLongPositionCodes = row.positionCodes.filter(
      (positionCode) => positionCode.length > 50,
    )

    if (tooLongPositionCodes.length) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Codes',
        value: row.rawPositionCodes,
        code: 'LINE_IMPORT_POSITION_CODE_TOO_LONG',
        messageKey: 'org.line.import.error.positionCodeTooLong',
        reason: `Row ${row.rowNo}: Position Code must not be longer than 50 characters: ${tooLongPositionCodes.join(', ')}.`,
        params: {
          positionCodes: tooLongPositionCodes,
        },
      })
    }

    const selectedDepartments = row.departmentCodes
      .map((departmentCode) => departmentMap.get(departmentCode))
      .filter(Boolean)

    const selectedDepartmentIdSet = new Set(
      selectedDepartments.map((department) => id(department._id)),
    )

    const missingPositionCodes = []
    const mismatchedPositionCodes = []
    const resolvedPositionIds = []

    row.positionCodes.forEach((positionCode) => {
      const candidates = positionsByCode.get(positionCode) || []
      const matchedPositions = candidates.filter((position) =>
        selectedDepartmentIdSet.has(id(position.departmentId)),
      )

      if (!candidates.length) {
        missingPositionCodes.push(positionCode)
        return
      }

      if (!matchedPositions.length) {
        mismatchedPositionCodes.push(positionCode)
        return
      }

      matchedPositions.forEach((position) => {
        resolvedPositionIds.push(position._id)
      })
    })

    if (missingPositionCodes.length) {
      hasRowError = true

      const departmentLikeCodes = missingPositionCodes.filter((positionCode) =>
        departmentMap.has(positionCode),
      )

      const reason = departmentLikeCodes.length
        ? `Row ${row.rowNo}: Position Codes contains Department Code(s): ${departmentLikeCodes.join(
            ', ',
          )}. Put these values in Department Codes column, or leave Position Codes blank to allow all positions in selected departments.`
        : `Row ${row.rowNo}: Position Code not found: ${missingPositionCodes.join(
            ', ',
          )}. Position Codes must use codes from Position master, not Department codes.`

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Codes',
        value: row.rawPositionCodes,
        code: 'LINE_IMPORT_POSITION_NOT_FOUND',
        messageKey: 'org.line.import.error.positionNotFound',
        reason,
        params: {
          positionCodes: missingPositionCodes,
          departmentLikeCodes,
        },
      })
    }

    if (mismatchedPositionCodes.length) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Position Codes',
        value: row.rawPositionCodes,
        code: 'LINE_IMPORT_POSITION_DEPARTMENT_MISMATCH',
        messageKey: 'org.line.import.error.positionDepartmentMismatch',
        reason: `Row ${row.rowNo}: These Position Code(s) do not belong to selected Department Codes "${row.departmentCodes.join(', ')}": ${mismatchedPositionCodes.join(', ')}.`,
        params: {
          departmentCodes: row.departmentCodes,
          positionCodes: mismatchedPositionCodes,
        },
      })
    }

    if (row.description.length > 500) {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Description',
        value: row.rawDescription,
        code: 'LINE_IMPORT_DESCRIPTION_TOO_LONG',
        messageKey: 'org.line.import.error.descriptionTooLong',
        reason: `Row ${row.rowNo}: Description must not be longer than 500 characters.`,
        params: {
          max: 500,
        },
      })
    }

    if (row.isActive === 'INVALID_STATUS') {
      hasRowError = true

      addImportError(errors, {
        rowNo: row.rowNo,
        field: 'Status',
        value: row.rawStatus,
        code: 'LINE_IMPORT_INVALID_STATUS',
        messageKey: 'org.line.import.error.invalidStatus',
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
          code: 'LINE_IMPORT_DUPLICATE_CODE',
          messageKey: 'org.line.import.error.duplicateCode',
          reason: `Row ${row.rowNo}: Duplicate Line Code "${row.code}" in Excel file. First found at row ${firstRowNo}.`,
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
      validRows.push({
        ...row,
        resolvedDepartmentIds: uniqueStrings(
          selectedDepartments.map((department) => id(department._id)),
        ),
        resolvedPositionIds: uniqueStrings(resolvedPositionIds.map(id)),
      })
    }
  }

  throwImportValidationError(errors)

  return {
    validRows,
  }
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
    .map((row, index) => normalizeImportRow(row, index))
    .filter(Boolean)

  if (!normalizedRows.length) {
    throw appError({
      statusCode: 400,
      code: 'LINE_EXCEL_NO_VALID_ROWS',
      messageKey: 'org.line.error.excelNoValidRows',
      message: 'Excel file has no valid rows',
    })
  }

  const { validRows } = await validateLineImportRows(normalizedRows)

  if (!validRows.length) {
    throw appError({
      statusCode: 400,
      code: 'LINE_EXCEL_NO_VALID_ROWS',
      messageKey: 'org.line.error.excelNoValidRows',
      message: 'Excel file has no valid rows',
    })
  }

  const session = await mongoose.startSession()
  const actorId = getActorId(currentUser)

  let summary = {
    totalRows: validRows.length,
    created: 0,
    updated: 0,
  }

  try {
    await session.withTransaction(async () => {
      const lineCodes = validRows.map((row) => row.code)

      const existingLines = await ProductionLine.find({
        code: {
          $in: lineCodes,
        },
      })
        .select('code')
        .session(session)
        .lean()

      const existingCodeSet = new Set(
        existingLines.map((line) => upper(line.code)),
      )

      const created = validRows.filter(
        (row) => !existingCodeSet.has(row.code),
      ).length

      const updated = validRows.length - created

      const operations = validRows.map((row) => ({
        updateOne: {
          filter: {
            code: row.code,
          },
          update: {
            $set: {
              code: row.code,
              name: row.name,
              departmentId: row.resolvedDepartmentIds[0],
              departmentIds: row.resolvedDepartmentIds,
              positionIds: row.resolvedPositionIds,
              description: row.description,
              isActive: row.isActive,
              updatedBy: actorId,
            },
            $setOnInsert: {
              createdBy: actorId,
            },
          },
          upsert: true,
        },
      }))

      await ProductionLine.bulkWrite(operations, {
        ordered: true,
        session,
      })

      summary = {
        totalRows: validRows.length,
        created,
        updated,
      }
    })
  } catch (error) {
    if (Number(error?.code) === 11000) {
      throw appError({
        statusCode: 409,
        code: 'LINE_IMPORT_DUPLICATE_DATABASE_CODE',
        messageKey: 'org.line.import.error.duplicateDatabaseCode',
        message: 'Import failed because one or more line codes already conflict with existing data.',
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