// backend/src/modules/shift/services/shift.service.js
const mongoose = require('mongoose')
const Shift = require('../models/Shift')

function createHttpError(message, status = 400) {
  const err = new Error(message)
  err.status = status
  return err
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toMinutes(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number)
  return h * 60 + m
}

function normalizeSort(sortBy, sortOrder) {
  const direction = sortOrder === 'asc' ? 1 : -1
  return { [sortBy]: direction, _id: -1 }
}

function isCrossMidnight(startTime, endTime) {
  return toMinutes(endTime) <= toMinutes(startTime)
}

function validateShiftBusinessRules(payload) {
  const start = payload.startTime
  const breakStart = payload.breakStartTime
  const breakEnd = payload.breakEndTime
  const end = payload.endTime
  const type = payload.type

  if (breakStart === breakEnd) {
    throw createHttpError('Break start time and break end time cannot be the same', 400)
  }

  const crossMidnight = isCrossMidnight(start, end)

  if (type === 'DAY' && crossMidnight) {
    throw createHttpError('DAY shift cannot cross midnight', 400)
  }

  if (type === 'NIGHT' && !crossMidnight) {
    throw createHttpError('NIGHT shift must cross midnight', 400)
  }

  const breakStartMin = toMinutes(breakStart)
  const breakEndMin = toMinutes(breakEnd)

  if (breakEndMin <= breakStartMin) {
    throw createHttpError('Break end time must be later than break start time', 400)
  }
}

async function list(query) {
  const page = query.page || 1
  const limit = query.limit || 10
  const skip = (page - 1) * limit

  const filter = {}

  if (query.search) {
    const keyword = escapeRegex(query.search)
    filter.$or = [
      { code: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
    ]
  }

  if (query.type) {
    filter.type = query.type
  }

  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive
  }

  const [items, total] = await Promise.all([
    Shift.find(filter)
      .sort(normalizeSort(query.sortBy, query.sortOrder))
      .skip(skip)
      .limit(limit)
      .lean(),
    Shift.countDocuments(filter),
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError('Invalid shift id', 400)
  }

  const shift = await Shift.findById(id).lean()

  if (!shift) {
    throw createHttpError('Shift not found', 404)
  }

  return shift
}

async function create(payload) {
  validateShiftBusinessRules(payload)

  try {
    const doc = await Shift.create(payload)
    return await Shift.findById(doc._id).lean()
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError('Shift code already exists', 409)
    }
    throw error
  }
}

async function update(id, payload) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError('Invalid shift id', 400)
  }

  const shift = await Shift.findById(id)

  if (!shift) {
    throw createHttpError('Shift not found', 404)
  }

  const merged = {
    code: payload.code ?? shift.code,
    name: payload.name ?? shift.name,
    type: payload.type ?? shift.type,
    startTime: payload.startTime ?? shift.startTime,
    breakStartTime: payload.breakStartTime ?? shift.breakStartTime,
    breakEndTime: payload.breakEndTime ?? shift.breakEndTime,
    endTime: payload.endTime ?? shift.endTime,
    isActive: payload.isActive ?? shift.isActive,
  }

  validateShiftBusinessRules(merged)

  Object.assign(shift, payload)

  try {
    await shift.save()
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError('Shift code already exists', 409)
    }
    throw error
  }

  return await Shift.findById(id).lean()
}

module.exports = {
  list,
  getById,
  create,
  update,
}