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

function normalizeImportRow(row, index) {
  const rowNo = index + 2

  const code = upper(getCell(row, ['Code', 'Position Code', 'PositionCode']))
  const name = s(getCell(row, ['Name', 'Position Name', 'PositionName']))
  const departmentCode = upper(
    getCell(row, ['Department Code', 'DepartmentCode', 'Department', 'Dept Code']),
  )
  const reportsToPositionCode = upper(
    getCell(row, [
      'Reports To Position Code',
      'ReportsToPositionCode',
      'Parent Position Code',
      'ParentPositionCode',
      'Reports To',
    ]),
  )
  const hierarchyScope = normalizeImportScope(
    getCell(row, ['Hierarchy Scope', 'HierarchyScope', 'Scope']),
  )
  const level = normalizeImportLevel(getCell(row, ['Level', 'Position Level']))
  const description = s(getCell(row, ['Description', 'Remark', 'Remarks']))
  const isActive = normalizeImportStatus(
    getCell(row, ['Status', 'Active', 'Is Active', 'IsActive']),
  )

  if (
    !code &&
    !name &&
    !departmentCode &&
    !reportsToPositionCode &&
    !description
  ) {
    return null
  }

  return {
    rowNo,
    code,
    name,
    departmentCode,
    reportsToPositionCode,
    hierarchyScope,
    level,
    description,
    isActive,
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

  const departmentCodes = Array.from(
    new Set(normalizedRows.map((row) => row.departmentCode).filter(Boolean)),
  )

  const positionCodes = Array.from(
    new Set(normalizedRows.map((row) => row.code).filter(Boolean)),
  )

  const reportsToPositionCodes = Array.from(
    new Set(normalizedRows.map((row) => row.reportsToPositionCode).filter(Boolean)),
  )

  const [departments, existingPositions, existingReportsToPositions] =
    await Promise.all([
      departmentCodes.length
        ? Department.find({ code: { $in: departmentCodes } }).lean()
        : [],
      positionCodes.length
        ? Position.find({ code: { $in: positionCodes } }).lean()
        : [],
      reportsToPositionCodes.length
        ? Position.find({ code: { $in: reportsToPositionCodes } }).lean()
        : [],
    ])

  const departmentMap = new Map(
    departments.map((department) => [upper(department.code), department]),
  )

  const existingPositionMap = new Map(
    existingPositions.map((position) => [upper(position.code), position]),
  )

  const existingReportsToCodeSet = new Set(
    existingReportsToPositions.map((position) => upper(position.code)),
  )

  const seenCodes = new Set()
  const candidateRows = []
  const validRows = []
  const results = []

  let failed = 0

  for (const row of normalizedRows) {
    try {
      if (!row.code) {
        throw new Error(`Row ${row.rowNo}: Code is required`)
      }

      if (!row.name) {
        throw new Error(`Row ${row.rowNo}: Name is required`)
      }

      if (seenCodes.has(row.code)) {
        throw new Error(`Row ${row.rowNo}: Duplicate code in import file`)
      }

      if (row.isActive === 'INVALID_STATUS') {
        throw new Error(`Row ${row.rowNo}: Invalid status`)
      }

      if (row.hierarchyScope === 'INVALID_SCOPE') {
        throw new Error(`Row ${row.rowNo}: Invalid hierarchy scope`)
      }

      if (row.level === 'INVALID_LEVEL') {
        throw new Error(`Row ${row.rowNo}: Invalid level`)
      }

      if (row.departmentCode && !departmentMap.has(row.departmentCode)) {
        throw new Error(`Row ${row.rowNo}: Department not found: ${row.departmentCode}`)
      }

      if (row.reportsToPositionCode && row.reportsToPositionCode === row.code) {
        throw new Error(`Row ${row.rowNo}: Position cannot report to itself`)
      }

      seenCodes.add(row.code)
      candidateRows.push(row)
    } catch (error) {
      failed += 1

      results.push({
        rowNo: row.rowNo,
        code: row.code,
        name: row.name,
        status: 'FAILED',
        message: error.message,
      })
    }
  }

  const candidateCodeSet = new Set(candidateRows.map((row) => row.code))

  for (const row of candidateRows) {
    try {
      if (
        row.reportsToPositionCode &&
        !existingReportsToCodeSet.has(row.reportsToPositionCode) &&
        !candidateCodeSet.has(row.reportsToPositionCode)
      ) {
        throw new Error(
          `Row ${row.rowNo}: Reports-to position not found: ${row.reportsToPositionCode}`,
        )
      }

      validRows.push(row)
    } catch (error) {
      failed += 1

      results.push({
        rowNo: row.rowNo,
        code: row.code,
        name: row.name,
        status: 'FAILED',
        message: error.message,
      })
    }
  }

  let created = 0
  let updated = 0

  for (const row of validRows) {
    const department = row.departmentCode ? departmentMap.get(row.departmentCode) : null
    const existing = existingPositionMap.get(row.code)

    await Position.updateOne(
      { code: row.code },
      {
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
      {
        upsert: true,
        runValidators: true,
      },
    )

    if (existing) {
      updated += 1
      results.push({
        rowNo: row.rowNo,
        code: row.code,
        name: row.name,
        status: 'UPDATED',
      })
    } else {
      created += 1
      results.push({
        rowNo: row.rowNo,
        code: row.code,
        name: row.name,
        status: 'CREATED',
      })
    }
  }

  const neededPositionCodes = Array.from(
    new Set([
      ...validRows.map((row) => row.code),
      ...validRows.map((row) => row.reportsToPositionCode).filter(Boolean),
    ]),
  )

  const neededPositions = neededPositionCodes.length
    ? await Position.find({ code: { $in: neededPositionCodes } }).lean()
    : []

  const positionMap = new Map(
    neededPositions.map((position) => [upper(position.code), position]),
  )

  for (const row of validRows) {
    const parent = row.reportsToPositionCode
      ? positionMap.get(row.reportsToPositionCode)
      : null

    await Position.updateOne(
      { code: row.code },
      {
        $set: {
          reportsToPositionId: parent?._id || null,
          reportsToPositionCode: upper(parent?.code),
          reportsToPositionName: s(parent?.name),
        },
      },
      {
        runValidators: true,
      },
    )
  }

  return {
    summary: {
      totalRows: normalizedRows.length,
      created,
      updated,
      failed,
    },
    results: results.sort((a, b) => Number(a.rowNo || 0) - Number(b.rowNo || 0)),
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