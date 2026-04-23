// backend/src/modules/org/services/department.service.js
const XLSX = require('xlsx')
const Department = require('../models/Department')
const {
  objectIdSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentQuerySchema,
} = require('../validators/department.validator')

function s(value) {
  return String(value ?? '').trim()
}

function buildListQuery(query = {}) {
  const filter = {}

  const search = s(query.search)
  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ]
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = String(query.isActive) === 'true'
  }

  return filter
}

function buildSort(sortField = 'createdAt', sortOrder = -1) {
  const direction = Number(sortOrder) === 1 ? 1 : -1

  if (sortField === 'code') return { code: direction, _id: -1 }
  if (sortField === 'name') return { name: direction, _id: -1 }
  if (sortField === 'isActive') return { isActive: direction, name: 1, _id: -1 }

  return { createdAt: direction, _id: -1 }
}

function normalizeDepartment(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    code: doc.code || '',
    name: doc.name || '',
    description: doc.description || '',
    isActive: !!doc.isActive,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

function normalizeDepartmentLookupItem(doc) {
  if (!doc) return null

  return {
    id: String(doc._id),
    code: doc.code || '',
    name: doc.name || '',
    description: doc.description || '',
    label: [doc.code, doc.name].filter(Boolean).join(' - '),
    isActive: !!doc.isActive,
  }
}

async function ensureUniqueCode(code, excludeId = null) {
  const filter = { code: s(code).toUpperCase() }
  if (excludeId) filter._id = { $ne: excludeId }

  const existing = await Department.findOne(filter).lean()
  if (existing) {
    const error = new Error('Department code already exists')
    error.status = 409
    throw error
  }
}

async function lookupDepartments(query = {}) {
  const search = s(query.search)
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50)

  let isActive = true
  if (String(query.isActive ?? '').trim().toLowerCase() === 'false') {
    isActive = false
  }

  const filter = buildListQuery({
    search,
    isActive,
  })

  const items = await Department.find(filter)
    .sort({ name: 1, code: 1, _id: -1 })
    .limit(limit)
    .lean()

  return {
    items: items.map(normalizeDepartmentLookupItem),
    meta: {
      limit,
      count: items.length,
    },
  }
}

async function createDepartment(payload) {
  const data = createDepartmentSchema.parse(payload)

  await ensureUniqueCode(data.code)

  const doc = await Department.create(data)
  return normalizeDepartment(doc.toObject())
}

async function listDepartments(query = {}) {
  const parsed = listDepartmentQuerySchema.parse(query)

  const page = parsed.page
  const limit = parsed.limit
  const skip = (page - 1) * limit

  const filter = buildListQuery(parsed)
  const sort = buildSort(parsed.sortField, parsed.sortOrder)

  const [items, total] = await Promise.all([
    Department.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ])

  return {
    ok: true,
    data: {
      items: items.map(normalizeDepartment),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
      },
    },
  }
}

async function getDepartmentById(id) {
  const departmentId = objectIdSchema.parse(id)

  const doc = await Department.findById(departmentId).lean()
  if (!doc) {
    const error = new Error('Department not found')
    error.status = 404
    throw error
  }

  return normalizeDepartment(doc)
}

async function updateDepartment(id, payload) {
  const departmentId = objectIdSchema.parse(id)
  const data = updateDepartmentSchema.parse(payload)

  const existing = await Department.findById(departmentId)
  if (!existing) {
    const error = new Error('Department not found')
    error.status = 404
    throw error
  }

  if (data.code) {
    await ensureUniqueCode(data.code, departmentId)
  }

  Object.assign(existing, data)
  await existing.save()

  return normalizeDepartment(existing.toObject())
}

async function exportDepartmentsExcel(query = {}) {
  const parsed = listDepartmentQuerySchema.parse({
    ...query,
    page: 1,
    limit: 100,
  })

  const filter = buildListQuery(parsed)
  const sort = buildSort(parsed.sortField, parsed.sortOrder)

  const items = await Department.find(filter).sort(sort).lean()

  const rows = items.map((item, index) => ({
    No: index + 1,
    Code: item.code || '',
    Name: item.name || '',
    Description: item.description || '',
    Status: item.isActive ? 'Active' : 'Inactive',
    CreatedAt: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
    UpdatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '',
  }))

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Departments')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

async function downloadDepartmentImportSample() {
  const sampleRows = [
    {
      Code: 'HR',
      Name: 'Human Resources',
      Description: 'Manage people and HR operations',
      Status: 'Active',
    },
    {
      Code: 'FIN',
      Name: 'Finance',
      Description: 'Manage accounting and finance operations',
      Status: 'Active',
    },
    {
      Code: 'IT',
      Name: 'Information Technology',
      Description: 'Manage systems and technical support',
      Status: 'Inactive',
    },
  ]

  const guideRows = [
    { Field: 'Code', Required: 'Yes', Note: 'Unique department code. Example: HR' },
    { Field: 'Name', Required: 'Yes', Note: 'Department display name' },
    { Field: 'Description', Required: 'No', Note: 'Optional short description' },
    { Field: 'Status', Required: 'No', Note: 'Use Active or Inactive. Default is Active' },
  ]

  const workbook = XLSX.utils.book_new()

  const sampleSheet = XLSX.utils.json_to_sheet(sampleRows)
  const guideSheet = XLSX.utils.json_to_sheet(guideRows)

  sampleSheet['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 42 },
    { wch: 14 },
  ]

  guideSheet['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 55 },
  ]

  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Sample')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide')

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })
}

async function importDepartmentsExcel(fileBuffer) {
  if (!fileBuffer) {
    const error = new Error('Excel file is required')
    error.status = 400
    throw error
  }

  const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    const error = new Error('Excel sheet is empty')
    error.status = 400
    throw error
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

  if (!rows.length) {
    const error = new Error('Excel file has no rows')
    error.status = 400
    throw error
  }

  let createdCount = 0
  let updatedCount = 0

  for (const row of rows) {
    const rawCode = s(row.Code || row.code).toUpperCase()
    const rawName = s(row.Name || row.name)
    const rawDescription = s(row.Description || row.description)
    const rawStatus = s(row.Status || row.status).toLowerCase()

    if (!rawCode || !rawName) continue

    const payload = {
      code: rawCode,
      name: rawName,
      description: rawDescription,
      isActive: rawStatus === 'inactive' ? false : true,
    }

    const existing = await Department.findOne({ code: rawCode })
    if (existing) {
      Object.assign(existing, payload)
      await existing.save()
      updatedCount += 1
    } else {
      await Department.create(payload)
      createdCount += 1
    }
  }

  return {
    createdCount,
    updatedCount,
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