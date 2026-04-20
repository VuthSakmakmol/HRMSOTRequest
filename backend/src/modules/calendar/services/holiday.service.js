// backend/src/modules/calendar/services/holiday.service.js
const Holiday = require('../models/Holiday')

function buildSearchFilter(search) {
  const q = String(search || '').trim()
  if (!q) return null

  return {
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ],
  }
}

function buildDateRange(year, month) {
  if (!year && !month) return null

  const y = Number(year)
  const m = Number(month)

  if (year && month) {
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
    return { $gte: start, $lt: end }
  }

  if (year) {
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0))
    return { $gte: start, $lt: end }
  }

  return null
}

function normalizeSort(sortBy, sortOrder) {
  const dir = sortOrder === 'asc' ? 1 : -1

  switch (sortBy) {
    case 'name':
      return { name: dir, date: -1, _id: -1 }
    case 'createdAt':
      return { createdAt: dir, _id: -1 }
    case 'date':
    default:
      return { date: dir, _id: -1 }
  }
}

function mapDoc(doc) {
  return {
    id: String(doc._id),
    date: doc.date ? doc.date.toISOString().slice(0, 10) : null,
    code: doc.code || '',
    name: doc.name,
    description: doc.description || '',
    isPaidHoliday: !!doc.isPaidHoliday,
    isActive: !!doc.isActive,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function list(query) {
  const {
    page,
    limit,
    search,
    isActive,
    year,
    month,
    sortBy,
    sortOrder,
  } = query

  const filter = {}

  const searchFilter = buildSearchFilter(search)
  if (searchFilter) Object.assign(filter, searchFilter)

  if (typeof isActive === 'boolean') {
    filter.isActive = isActive
  }

  const dateRange = buildDateRange(year, month)
  if (dateRange) {
    filter.date = dateRange
  }

  const skip = (page - 1) * limit
  const sort = normalizeSort(sortBy, sortOrder)

  const [items, total] = await Promise.all([
    Holiday.find(filter).sort(sort).skip(skip).limit(limit),
    Holiday.countDocuments(filter),
  ])

  return {
    items: items.map(mapDoc),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

async function getById(id) {
  const doc = await Holiday.findById(id)
  if (!doc) {
    const err = new Error('Holiday not found')
    err.status = 404
    throw err
  }

  return mapDoc(doc)
}

async function create(payload, actorId) {
  try {
    const doc = await Holiday.create({
      ...payload,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    })

    return mapDoc(doc)
  } catch (error) {
    if (error?.code === 11000) {
      const err = new Error('A holiday already exists for this date')
      err.status = 409
      throw err
    }
    throw error
  }
}

async function update(id, payload, actorId) {
  const existing = await Holiday.findById(id)
  if (!existing) {
    const err = new Error('Holiday not found')
    err.status = 404
    throw err
  }

  Object.assign(existing, payload, {
    updatedBy: actorId || null,
  })

  try {
    await existing.save()
    return mapDoc(existing)
  } catch (error) {
    if (error?.code === 11000) {
      const err = new Error('A holiday already exists for this date')
      err.status = 409
      throw err
    }
    throw error
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
}