// backend/src/modules/org/services/position.service.js

const mongoose = require('mongoose')
const XLSX = require('xlsx')

const Position = require('../models/Position')
const Department = require('../models/Department')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function buildSort(sortBy, sortOrder) {
  return {
    [sortBy]: sortOrder === 'asc' ? 1 : -1,
    _id: -1,
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseBooleanLike(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value === 'boolean') return value

  const v = String(value).trim().toLowerCase()

  if (['true', '1', 'yes', 'y', 'active'].includes(v)) return true
  if (['false', '0', 'no', 'n', 'inactive'].includes(v)) return false

  return defaultValue
}

function buildFilters(query = {}) {
  const filters = {}

  if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) {
    filters.departmentId = new mongoose.Types.ObjectId(query.departmentId)
  }

  if (typeof query.isActive === 'boolean') {
    filters.isActive = query.isActive
  }

  if (query.search) {
    const keyword = escapeRegex(String(query.search || '').trim())
    filters.$or = [
      { code: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
    ]
  }

  return filters
}

async function ensureDepartmentExists(departmentId) {
  const department = await Department.findById(departmentId).select('_id code name isActive')

  if (!department) {
    const err = new Error('Department not found')
    err.status = 404
    throw err
  }

  return department
}

async function ensureReportsToPositionValid({
  reportsToPositionId,
  currentPositionId = null,
}) {
  if (!reportsToPositionId) return null

  if (!mongoose.isValidObjectId(reportsToPositionId)) {
    const err = new Error('Invalid reportsToPositionId')
    err.status = 400
    throw err
  }

  if (currentPositionId && String(reportsToPositionId) === String(currentPositionId)) {
    const err = new Error('Position cannot report to itself')
    err.status = 400
    throw err
  }

  const parentPosition = await Position.findById(reportsToPositionId)
    .select('_id code name departmentId reportsToPositionId managerScope isActive')
    .lean()

  if (!parentPosition) {
    const err = new Error('Reports-to position not found')
    err.status = 404
    throw err
  }

  // Cross-department reporting is allowed.
  // Example: Sewer-Supervisor in Sewing can report to HR position.
  if (currentPositionId) {
    let cursor = parentPosition
    const visited = new Set()

    while (cursor?.reportsToPositionId) {
      const nextId = String(cursor.reportsToPositionId)

      if (nextId === String(currentPositionId)) {
        const err = new Error('Circular position hierarchy is not allowed')
        err.status = 400
        throw err
      }

      if (visited.has(nextId)) {
        const err = new Error('Circular position hierarchy is not allowed')
        err.status = 400
        throw err
      }

      visited.add(nextId)

      cursor = await Position.findById(nextId)
        .select('_id departmentId reportsToPositionId managerScope')
        .lean()

      if (!cursor) break
    }
  }

  return parentPosition._id
}

function normalizeDuplicateError(error) {
  if (error?.code === 11000) {
    const err = new Error('Position code already exists in this department')
    err.status = 409
    throw err
  }

  throw error
}

function autoFitColumns(rows = []) {
  const widths = []

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key, index) => {
      const raw = row[key]
      const value = raw === null || raw === undefined ? '' : String(raw)
      const current = widths[index] || { wch: String(key).length + 2 }
      current.wch = Math.min(Math.max(current.wch, value.length + 2), 40)
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

function buildSampleWorkbook() {
  const workbook = XLSX.utils.book_new()

  const guideRows = [
    {
      Guide: 'Fill DepartmentCode using an existing department code from the system.',
    },
    {
      Guide: 'PositionCode is required and must be unique inside the same department.',
    },
    {
      Guide: 'PositionName is required.',
    },
    {
      Guide:
        'ReportsToPositionCode is optional. Use another existing position code in the same department.',
    },
    {
      Guide:
        'Example: Sewer position can report to Sewer Supervisor position inside the same Sewing department.',
    },
    {
      Guide: 'IsActive accepts TRUE/FALSE, YES/NO, 1/0. Blank means TRUE.',
    },
    {
      Guide: 'Do not rename the headers in the Sample sheet.',
    },
  ]

  const sampleRows = [
    {
      DepartmentCode: 'SEWING',
      PositionCode: 'SEWER_SUPERVISOR',
      PositionName: 'Sewer Supervisor',
      ReportsToPositionCode: '',
      Description: 'Supervise sewer employees by line',
      IsActive: 'TRUE',
    },
    {
      DepartmentCode: 'SEWING',
      PositionCode: 'SEWER',
      PositionName: 'Sewer',
      ReportsToPositionCode: 'SEWER_SUPERVISOR',
      Description: 'Sewing operator',
      IsActive: 'TRUE',
    },
  ]

  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  sampleSheet['!cols'] = autoFitColumns(sampleRows)

  const guideSheet = XLSX.utils.json_to_sheet(guideRows)
  guideSheet['!cols'] = [{ wch: 100 }]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return workbook
}

function buildExportWorkbook(items = []) {
  const workbook = XLSX.utils.book_new()

  const rows = items.map((item, index) => ({
    No: index + 1,
    DepartmentCode: item?.departmentId?.code || '',
    DepartmentName: item?.departmentId?.name || '',
    PositionCode: item?.code || '',
    PositionName: item?.name || '',
    ReportsToPositionCode: item?.reportsToPositionId?.code || '',
    ReportsToPositionName: item?.reportsToPositionId?.name || '',
    Description: item?.description || '',
    Status: item?.isActive ? 'Active' : 'Inactive',
    CreatedAt: item?.createdAt ? new Date(item.createdAt).toISOString() : '',
    UpdatedAt: item?.updatedAt ? new Date(item.updatedAt).toISOString() : '',
  }))

  const fallbackRows = rows.length
    ? rows
    : [
        {
          No: '',
          DepartmentCode: '',
          DepartmentName: '',
          PositionCode: '',
          PositionName: '',
          ReportsToPositionCode: '',
          ReportsToPositionName: '',
          Description: '',
          Status: '',
          CreatedAt: '',
          UpdatedAt: '',
        },
      ]

  const sheet = XLSX.utils.json_to_sheet(fallbackRows)
  sheet['!cols'] = autoFitColumns(fallbackRows)

  XLSX.utils.book_append_sheet(workbook, sheet, 'Positions')

  return workbook
}

function parseImportRows(buffer) {
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

function normalizeImportRow(row = {}) {
  return {
    departmentCode: upper(row.DepartmentCode),
    code: upper(row.PositionCode),
    name: s(row.PositionName),
    reportsToPositionCode: upper(row.ReportsToPositionCode),
    description: s(row.Description),
    isActive: parseBooleanLike(row.IsActive, true),
  }
}

function buildLookupItem(item) {
  return {
    id: String(item._id),
    code: item.code || '',
    name: item.name || '',
    description: item.description || '',
    label: [item.code, item.name].filter(Boolean).join(' - '),

    departmentId: item?.departmentId?._id
      ? String(item.departmentId._id)
      : item?.departmentId
        ? String(item.departmentId)
        : null,
    departmentCode: item?.departmentId?.code || '',
    departmentName: item?.departmentId?.name || '',

    reportsToPositionId: item?.reportsToPositionId?._id
      ? String(item.reportsToPositionId._id)
      : item?.reportsToPositionId
        ? String(item.reportsToPositionId)
        : null,
    reportsToPositionCode: item?.reportsToPositionId?.code || '',
    reportsToPositionName: item?.reportsToPositionId?.name || '',
    reportsToPositionDepartmentId: item?.reportsToPositionId?.departmentId
      ? String(item.reportsToPositionId.departmentId)
      : null,

    managerScope: item.managerScope || 'SAME_LINE',

    isActive: !!item.isActive,
  }
}

async function lookup(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50)

  let isActive = true
  if (String(query.isActive ?? '').trim().toLowerCase() === 'false') {
    isActive = false
  }

  const filters = buildFilters({
    search: s(query.search),
    departmentId: s(query.departmentId),
    isActive,
  })

  const items = await Position.find(filters)
    .populate('departmentId', 'code name isActive')
    .populate('reportsToPositionId', 'code name departmentId managerScope isActive')
    .sort({ name: 1, code: 1, _id: -1 })
    .limit(limit)
    .lean()

  return {
    items: items.map(buildLookupItem),
    meta: {
      limit,
      count: items.length,
    },
  }
}

async function list(query) {
  const { page, limit, sortBy, sortOrder } = query
  const filters = buildFilters(query)
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    Position.find(filters)
      .populate('departmentId', 'code name isActive')
      .populate('reportsToPositionId', 'code name departmentId isActive')
      .sort(buildSort(sortBy, sortOrder))
      .skip(skip)
      .limit(limit)
      .lean(),
    Position.countDocuments(filters),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

async function getById(id) {
  const item = await Position.findById(id)
    .populate('departmentId', 'code name isActive')
    .populate('reportsToPositionId', 'code name departmentId isActive')
    .lean()

  if (!item) {
    const err = new Error('Position not found')
    err.status = 404
    throw err
  }

  return item
}

async function create(payload) {
  await ensureDepartmentExists(payload.departmentId)

  const reportsToPositionId = await ensureReportsToPositionValid({
    reportsToPositionId: payload.reportsToPositionId,
  })

  try {
    const created = await Position.create({
      ...payload,
      code: upper(payload.code),
      name: s(payload.name),
      description: s(payload.description),
      reportsToPositionId,
    })

    return getById(created._id)
  } catch (error) {
    normalizeDuplicateError(error)
  }
}

async function update(id, payload) {
  const existing = await Position.findById(id)

  if (!existing) {
    const err = new Error('Position not found')
    err.status = 404
    throw err
  }

  const nextDepartmentId = payload.departmentId || existing.departmentId

  if (payload.departmentId) {
    await ensureDepartmentExists(payload.departmentId)
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

  if (payload.code !== undefined) {
    existing.code = upper(payload.code)
  }

  if (payload.name !== undefined) {
    existing.name = s(payload.name)
  }

  if (payload.departmentId !== undefined) {
    existing.departmentId = payload.departmentId
  }

  if (hasReportsToPositionField || payload.departmentId !== undefined) {
    existing.reportsToPositionId = reportsToPositionId
  }

  if (payload.description !== undefined) {
    existing.description = s(payload.description)
  }

  if (payload.isActive !== undefined) {
    existing.isActive = Boolean(payload.isActive)
  }

  if (payload.managerScope !== undefined) {
    existing.managerScope = payload.managerScope || 'SAME_LINE'
  }
  try {
    await existing.save()
    return getById(existing._id)
  } catch (error) {
    normalizeDuplicateError(error)
  }
}

async function downloadSample() {
  const workbook = buildSampleWorkbook()

  return {
    filename: 'position-import-sample.xlsx',
    buffer: workbookToBuffer(workbook),
  }
}

async function exportExcel(query) {
  const filters = buildFilters(query)

  const items = await Position.find(filters)
    .populate('departmentId', 'code name isActive')
    .populate('reportsToPositionId', 'code name departmentId isActive')
    .sort(buildSort(query.sortBy, query.sortOrder))
    .lean()

  const workbook = buildExportWorkbook(items)

  return {
    filename: `positions-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: workbookToBuffer(workbook),
  }
}

async function resolveReportsToPositionForImport({
  department,
  reportsToPositionCode,
  currentPositionId = null,
}) {
  if (!reportsToPositionCode) return null

  const parent = await Position.findOne({
    departmentId: department._id,
    code: reportsToPositionCode,
  })
    .select('_id code name departmentId reportsToPositionId')
    .lean()

  if (!parent) {
    const err = new Error(
      `ReportsToPositionCode "${reportsToPositionCode}" was not found in department "${department.code}"`,
    )
    err.status = 400
    throw err
  }

  return ensureReportsToPositionValid({
    reportsToPositionId: parent._id,
    departmentId: department._id,
    currentPositionId,
  })
}

async function importExcel(file) {
  const rows = parseImportRows(file.buffer)

  if (!rows.length) {
    const err = new Error('Excel file is empty')
    err.status = 400
    throw err
  }

  const departments = await Department.find({})
    .select('_id code name isActive')
    .lean()

  const departmentMap = new Map(
    departments.map((item) => [String(item.code || '').trim().toUpperCase(), item]),
  )

  const result = {
    totalRows: rows.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errors: [],
  }

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2
    const row = normalizeImportRow(rows[index])

    try {
      if (!row.departmentCode) {
        result.skippedCount += 1
        result.errors.push(`Row ${rowNumber}: DepartmentCode is required`)
        continue
      }

      if (!row.code) {
        result.skippedCount += 1
        result.errors.push(`Row ${rowNumber}: PositionCode is required`)
        continue
      }

      if (!row.name) {
        result.skippedCount += 1
        result.errors.push(`Row ${rowNumber}: PositionName is required`)
        continue
      }

      if (row.reportsToPositionCode && row.reportsToPositionCode === row.code) {
        result.skippedCount += 1
        result.errors.push(`Row ${rowNumber}: Position cannot report to itself`)
        continue
      }

      const department = departmentMap.get(row.departmentCode)

      if (!department) {
        result.skippedCount += 1
        result.errors.push(
          `Row ${rowNumber}: DepartmentCode "${row.departmentCode}" was not found`,
        )
        continue
      }

      const existing = await Position.findOne({
        departmentId: department._id,
        code: row.code,
      })

      const reportsToPositionId = await resolveReportsToPositionForImport({
        department,
        reportsToPositionCode: row.reportsToPositionCode,
        currentPositionId: existing?._id || null,
      })

      if (existing) {
        existing.name = row.name
        existing.description = row.description
        existing.reportsToPositionId = reportsToPositionId
        existing.isActive = row.isActive
        await existing.save()
        result.updatedCount += 1
      } else {
        await Position.create({
          departmentId: department._id,
          code: row.code,
          name: row.name,
          reportsToPositionId,
          description: row.description,
          isActive: row.isActive,
        })

        result.createdCount += 1
      }
    } catch (error) {
      result.skippedCount += 1
      result.errors.push(`Row ${rowNumber}: ${error?.message || 'Import failed'}`)
    }
  }

  return result
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