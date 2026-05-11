// backend/src/modules/org/services/position.service.js

const XLSX = require('xlsx')

const Position = require('../models/Position')
const Department = require('../models/Department')
const {
  formatDateTimeToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400, messageKey = '') {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.messageKey = messageKey
  return error
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function normalizeLimit(value) {
  const limit = Number(value || 10)
  if (!Number.isFinite(limit)) return 10
  return Math.min(Math.max(Math.floor(limit), 1), 200)
}

function normalizeCode(value) {
  return upper(value)
}

function normalizeText(value) {
  return s(value)
}

function buildSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return null

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { code: regex },
      { name: regex },
      { description: regex },
      { departmentCode: regex },
      { departmentName: regex },
      { reportsToPositionCode: regex },
      { reportsToPositionName: regex },
      { hierarchyScope: regex },
    ],
  }
}

function buildPositionFilter(query = {}) {
  const filter = {}

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  if (s(query.departmentCode)) {
    filter.departmentCode = upper(query.departmentCode)
  }

  if (s(query.reportsToPositionCode)) {
    filter.reportsToPositionCode = upper(query.reportsToPositionCode)
  }

  if (s(query.hierarchyScope)) {
    filter.hierarchyScope = upper(query.hierarchyScope)
  }

  const searchFilter = buildSearchFilter(query.search)

  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildPositionSort(query = {}) {
  const direction = query.sortOrder === 'asc' ? 1 : -1

  const sortField =
    {
      code: 'code',
      name: 'name',
      departmentName: 'departmentName',
      reportsToPositionName: 'reportsToPositionName',
      hierarchyScope: 'hierarchyScope',
      level: 'level',
      isActive: 'isActive',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }[query.sortBy] || 'createdAt'

  return {
    [sortField]: direction,
    code: 1,
    _id: -1,
  }
}

function makeLabel(code, name) {
  const c = upper(code)
  const n = s(name)

  if (c && n) return `${c} - ${n}`
  if (c) return c
  return n
}

function mapPositionItem(doc = {}) {
  return {
    code: upper(doc.code),
    name: s(doc.name),
    label: makeLabel(doc.code, doc.name),

    description: s(doc.description),

    departmentCode: upper(doc.departmentCode),
    departmentName: s(doc.departmentName),
    departmentLabel: doc.departmentCode
      ? makeLabel(doc.departmentCode, doc.departmentName)
      : '',

    reportsToPositionCode: upper(doc.reportsToPositionCode),
    reportsToPositionName: s(doc.reportsToPositionName),
    reportsToPositionLabel: doc.reportsToPositionCode
      ? makeLabel(doc.reportsToPositionCode, doc.reportsToPositionName)
      : '',

    hierarchyScope: upper(doc.hierarchyScope || 'SAME_LINE'),
    level: Number(doc.level || 0),

    isActive: doc.isActive === true,

    createdBy: s(doc.createdBy),
    updatedBy: s(doc.updatedBy),

    createdAt: doc.createdAt || null,
    createdAtDisplay: formatDateTimeToDmy(doc.createdAt),
    createdAtDisplayHm: formatDateTimeToDmyHm(doc.createdAt),

    updatedAt: doc.updatedAt || null,
    updatedAtDisplay: formatDateTimeToDmy(doc.updatedAt),
    updatedAtDisplayHm: formatDateTimeToDmyHm(doc.updatedAt),
  }
}

function mapPositionLookupItem(doc = {}) {
  const item = mapPositionItem(doc)

  return {
    value: item.code,
    code: item.code,
    name: item.name,
    label: item.label,

    departmentCode: item.departmentCode,
    departmentName: item.departmentName,
    departmentLabel: item.departmentLabel,

    reportsToPositionCode: item.reportsToPositionCode,
    reportsToPositionName: item.reportsToPositionName,
    reportsToPositionLabel: item.reportsToPositionLabel,

    hierarchyScope: item.hierarchyScope,
    level: item.level,
    isActive: item.isActive,
  }
}

async function ensureCodeAvailable(code, currentCode = '') {
  const normalizedCode = normalizeCode(code)
  const normalizedCurrentCode = normalizeCode(currentCode)

  if (!normalizedCode) {
    throw createHttpError('Position code is required', 400, 'position.code_required')
  }

  const existing = await Position.findOne({ code: normalizedCode })
    .select({ code: 1 })
    .lean()

  if (existing && upper(existing.code) !== normalizedCurrentCode) {
    throw createHttpError(
      'Position code already exists',
      409,
      'position.code_already_exists',
    )
  }
}

async function getDepartmentSnapshotByCode(departmentCode) {
  const code = normalizeCode(departmentCode)

  if (!code) {
    return {
      departmentId: null,
      departmentCode: '',
      departmentName: '',
    }
  }

  const department = await Department.findOne({ code }).lean()

  if (!department) {
    throw createHttpError(
      `Department not found: ${code}`,
      404,
      'position.department_not_found',
    )
  }

  return {
    departmentId: department._id,
    departmentCode: upper(department.code),
    departmentName: s(department.name),
  }
}

async function getReportsToPositionSnapshotByCode(reportsToPositionCode, currentPositionCode = '') {
  const code = normalizeCode(reportsToPositionCode)
  const currentCode = normalizeCode(currentPositionCode)

  if (!code) {
    return {
      reportsToPositionId: null,
      reportsToPositionCode: '',
      reportsToPositionName: '',
    }
  }

  if (currentCode && code === currentCode) {
    throw createHttpError(
      'Position cannot report to itself',
      400,
      'position.cannot_report_to_self',
    )
  }

  const parent = await Position.findOne({ code }).lean()

  if (!parent) {
    throw createHttpError(
      `Reports-to position not found: ${code}`,
      404,
      'position.reports_to_position_not_found',
    )
  }

  return {
    reportsToPositionId: parent._id,
    reportsToPositionCode: upper(parent.code),
    reportsToPositionName: s(parent.name),
  }
}

async function buildPositionPayload(payload = {}, actor = '', currentPositionCode = '') {
  const data = {}

  if (Object.prototype.hasOwnProperty.call(payload, 'code')) {
    data.code = normalizeCode(payload.code)
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    data.name = normalizeText(payload.name)
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    data.description = normalizeText(payload.description)
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'departmentCode')) {
    Object.assign(data, await getDepartmentSnapshotByCode(payload.departmentCode))
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'reportsToPositionCode')) {
    Object.assign(
      data,
      await getReportsToPositionSnapshotByCode(
        payload.reportsToPositionCode,
        currentPositionCode,
      ),
    )
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'hierarchyScope')) {
    data.hierarchyScope = upper(payload.hierarchyScope || 'SAME_LINE')
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'level')) {
    const level = Number(payload.level || 0)
    data.level = Number.isFinite(level) && level >= 0 ? Math.floor(level) : 0
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    data.isActive = payload.isActive === true
  }

  data.updatedBy = s(actor)

  return data
}

async function syncChildPositionSnapshots(oldCode, newItem) {
  const normalizedOldCode = normalizeCode(oldCode)

  if (!normalizedOldCode || !newItem?.code) return

  await Position.updateMany(
    { reportsToPositionCode: normalizedOldCode },
    {
      $set: {
        reportsToPositionCode: newItem.code,
        reportsToPositionName: newItem.name,
      },
    },
  )
}

async function listPositions(query = {}) {
  const page = normalizePage(query.page)
  const limit = normalizeLimit(query.limit)
  const skip = (page - 1) * limit

  const filter = buildPositionFilter(query)
  const sort = buildPositionSort(query)

  const [items, total] = await Promise.all([
    Position.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Position.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    items: items.map(mapPositionItem),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

async function lookupPositions(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100)

  const filter = buildPositionFilter({
    ...query,
    isActive: typeof query.isActive === 'boolean' ? query.isActive : true,
  })

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
    items: items.map(mapPositionLookupItem),
  }
}

async function getPositionByCode(code) {
  const normalizedCode = normalizeCode(code)

  if (!normalizedCode) {
    throw createHttpError('Position code is required', 400, 'position.code_required')
  }

  const doc = await Position.findOne({ code: normalizedCode }).lean()

  if (!doc) {
    throw createHttpError('Position not found', 404, 'position.not_found')
  }

  return mapPositionItem(doc)
}

async function createPosition(payload = {}, actor = '') {
  const code = normalizeCode(payload.code)

  await ensureCodeAvailable(code)

  const data = await buildPositionPayload(
    {
      ...payload,
      code,
    },
    actor,
    '',
  )

  const doc = await Position.create({
    ...data,
    createdBy: s(actor),
    updatedBy: s(actor),
  })

  return mapPositionItem(doc.toObject())
}

async function updatePosition(code, payload = {}, actor = '') {
  const currentCode = normalizeCode(code)

  if (!currentCode) {
    throw createHttpError('Position code is required', 400, 'position.code_required')
  }

  const current = await Position.findOne({ code: currentCode }).lean()

  if (!current) {
    throw createHttpError('Position not found', 404, 'position.not_found')
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'code')) {
    await ensureCodeAvailable(payload.code, currentCode)
  }

  const data = await buildPositionPayload(payload, actor, currentCode)

  const doc = await Position.findOneAndUpdate(
    { code: currentCode },
    data,
    {
      new: true,
      runValidators: true,
    },
  ).lean()

  if (!doc) {
    throw createHttpError('Position not found', 404, 'position.not_found')
  }

  const item = mapPositionItem(doc)

  await syncChildPositionSnapshots(currentCode, item)

  return item
}

function buildImportSampleWorkbook() {
  const workbook = XLSX.utils.book_new()

  const rows = [
    [
      'Code',
      'Name',
      'Department Code',
      'Reports To Position Code',
      'Hierarchy Scope',
      'Level',
      'Description',
      'Active',
    ],
    ['SEWER', 'Sewer', 'PROD', 'SEW-SUP', 'SAME_LINE', 1, 'Production sewer position', 'TRUE'],
    ['SEW-SUP', 'Sewing Supervisor', 'PROD', 'PROD-MGR', 'SAME_LINE', 2, '', 'TRUE'],
  ]

  const sheet = XLSX.utils.aoa_to_sheet(rows)

  sheet['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 20 },
    { wch: 28 },
    { wch: 22 },
    { wch: 10 },
    { wch: 40 },
    { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(workbook, sheet, 'Position Import Sample')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

function normalizeHeader(value) {
  return upper(value).replace(/\s+/g, '').replace(/[_-]/g, '')
}

function findValue(row, possibleHeaders = []) {
  const normalizedRow = {}

  Object.entries(row || {}).forEach(([key, value]) => {
    normalizedRow[normalizeHeader(key)] = value
  })

  for (const header of possibleHeaders) {
    const key = normalizeHeader(header)
    if (Object.prototype.hasOwnProperty.call(normalizedRow, key)) {
      return normalizedRow[key]
    }
  }

  return undefined
}

function parseBoolean(value, fallback = true) {
  const raw = s(value).toLowerCase()

  if (!raw) return fallback
  if (['true', '1', 'yes', 'active', 'y'].includes(raw)) return true
  if (['false', '0', 'no', 'inactive', 'n'].includes(raw)) return false

  return fallback
}

function normalizeImportRow(row, rowNo) {
  return {
    rowNo,
    code: upper(findValue(row, ['Code', 'Position Code', 'PositionCode'])),
    name: s(findValue(row, ['Name', 'Position Name', 'PositionName'])),
    description: s(findValue(row, ['Description', 'Remark', 'Remarks'])),

    departmentCode: upper(
      findValue(row, [
        'Department Code',
        'DepartmentCode',
        'Department',
        'Dept Code',
        'DeptCode',
      ]),
    ),

    reportsToPositionCode: upper(
      findValue(row, [
        'Reports To Position Code',
        'ReportsToPositionCode',
        'Parent Position Code',
        'ParentPositionCode',
        'Reports To',
      ]),
    ),

    hierarchyScope: upper(
      findValue(row, ['Hierarchy Scope', 'HierarchyScope', 'Scope']) || 'SAME_LINE',
    ),

    level: Math.max(Number(findValue(row, ['Level', 'Position Level']) || 0), 0),
    isActive: parseBoolean(findValue(row, ['Active', 'Is Active', 'IsActive']), true),
  }
}

async function importPositions(file, actor = '') {
  if (!file || !file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw createHttpError('Import file is required', 400, 'position.import_file_required')
  }

  const workbook = XLSX.read(file.buffer, {
    type: 'buffer',
    cellDates: true,
  })

  const sheetName = workbook.SheetNames?.[0]

  if (!sheetName) {
    throw createHttpError('Import file has no sheet', 400, 'position.import_sheet_missing')
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  })

  const normalizedRows = rows.map((row, index) => normalizeImportRow(row, index + 2))

  const departmentCodes = Array.from(
    new Set(normalizedRows.map((row) => row.departmentCode).filter(Boolean)),
  )

  const rowCodes = Array.from(
    new Set(normalizedRows.map((row) => row.code).filter(Boolean)),
  )

  const parentCodes = Array.from(
    new Set(normalizedRows.map((row) => row.reportsToPositionCode).filter(Boolean)),
  )

  const [departments, existingPositions, existingParents] = await Promise.all([
    departmentCodes.length
      ? Department.find({ code: { $in: departmentCodes } }).lean()
      : [],
    rowCodes.length
      ? Position.find({ code: { $in: rowCodes } }).lean()
      : [],
    parentCodes.length
      ? Position.find({ code: { $in: parentCodes } }).lean()
      : [],
  ])

  const departmentMap = new Map(departments.map((item) => [upper(item.code), item]))
  const existingPositionMap = new Map(existingPositions.map((item) => [upper(item.code), item]))
  const existingParentCodeSet = new Set(existingParents.map((item) => upper(item.code)))
  const importCodeSet = new Set(rowCodes)

  const results = []
  const validRows = []
  const seenCodes = new Set()

  let successCount = 0
  let failedCount = 0

  for (const row of normalizedRows) {
    try {
      if (!row.code) {
        throw createHttpError('Code is required', 400)
      }

      if (!row.name) {
        throw createHttpError('Name is required', 400)
      }

      if (seenCodes.has(row.code)) {
        throw createHttpError(`Duplicate code in import file: ${row.code}`, 400)
      }

      seenCodes.add(row.code)

      if (row.departmentCode && !departmentMap.has(row.departmentCode)) {
        throw createHttpError(`Department not found: ${row.departmentCode}`, 400)
      }

      if (row.reportsToPositionCode === row.code) {
        throw createHttpError('Position cannot report to itself', 400)
      }

      if (
        row.reportsToPositionCode &&
        !existingParentCodeSet.has(row.reportsToPositionCode) &&
        !importCodeSet.has(row.reportsToPositionCode)
      ) {
        throw createHttpError(
          `Reports-to position not found: ${row.reportsToPositionCode}`,
          400,
        )
      }

      validRows.push(row)
    } catch (error) {
      failedCount += 1
      results.push({
        rowNo: row.rowNo,
        code: row.code,
        name: row.name,
        status: 'FAILED',
        message: error.message,
      })
    }
  }

  for (const row of validRows) {
    try {
      const department = row.departmentCode ? departmentMap.get(row.departmentCode) : null
      const existed = existingPositionMap.has(row.code)

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

      results.push({
        rowNo: row.rowNo,
        code: row.code,
        name: row.name,
        status: existed ? 'UPDATED' : 'CREATED',
      })

      successCount += 1
    } catch (error) {
      failedCount += 1
      results.push({
        rowNo: row.rowNo,
        code: row.code,
        name: row.name,
        status: 'FAILED',
        message: error.message,
      })
    }
  }

  const allNeededPositionCodes = Array.from(
    new Set([
      ...validRows.map((row) => row.code),
      ...validRows.map((row) => row.reportsToPositionCode).filter(Boolean),
    ]),
  )

  const allNeededPositions = allNeededPositionCodes.length
    ? await Position.find({ code: { $in: allNeededPositionCodes } }).lean()
    : []

  const positionMap = new Map(allNeededPositions.map((item) => [upper(item.code), item]))

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
    sheetName,
    rowCount: rows.length,
    successCount,
    failedCount,
    results: results.sort((a, b) => Number(a.rowNo || 0) - Number(b.rowNo || 0)),
  }
}

async function exportPositions(query = {}) {
  const filter = buildPositionFilter(query)
  const sort = buildPositionSort({
    ...query,
    sortBy: query.sortBy || 'code',
    sortOrder: query.sortOrder || 'asc',
  })

  const items = await Position.find(filter).sort(sort).lean()

  const rows = items.map((doc, index) => {
    const item = mapPositionItem(doc)

    return {
      No: index + 1,
      Code: item.code,
      Name: item.name,
      Department: item.departmentLabel,
      'Reports To Position': item.reportsToPositionLabel,
      'Hierarchy Scope': item.hierarchyScope,
      Level: item.level,
      Description: item.description,
      Active: item.isActive ? 'Yes' : 'No',
      'Created At': item.createdAtDisplayHm,
      'Updated At': item.updatedAtDisplayHm,
    }
  })

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)

  sheet['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 28 },
    { wch: 30 },
    { wch: 32 },
    { wch: 18 },
    { wch: 10 },
    { wch: 40 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
  ]

  XLSX.utils.book_append_sheet(workbook, sheet, 'Positions')

  return {
    filename: 'positions.xlsx',
    buffer: XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }),
  }
}

async function downloadImportSample() {
  return {
    filename: 'position-import-sample.xlsx',
    buffer: buildImportSampleWorkbook(),
  }
}

module.exports = {
  listPositions,
  lookupPositions,
  getPositionByCode,
  createPosition,
  updatePosition,
  importPositions,
  exportPositions,
  downloadImportSample,

  mapPositionItem,
  mapPositionLookupItem,
}