const mongoose = require('mongoose')

const PaymentReportSettings = require('../models/PaymentReportSettings.model')
const Position = require('../../org/models/Position')

const SETTINGS_KEY = 'GLOBAL'

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function actorLabel(actor = {}) {
  return s(
    actor?.loginId ||
      actor?.username ||
      actor?.employeeNo ||
      actor?.email ||
      actor?.accountId ||
      actor?._id,
  )
}

function toObjectId(value, fieldName = 'positionId') {
  const id = s(value)

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`Invalid ${fieldName}`)
    error.status = 400
    error.statusCode = 400
    error.messageKey = 'payment.reportSettings.invalidPosition'
    throw error
  }

  return new mongoose.Types.ObjectId(id)
}

function uniqueObjectIds(values = []) {
  const seen = new Set()
  const result = []

  for (const value of Array.isArray(values) ? values : []) {
    const id = s(value)
    if (!mongoose.Types.ObjectId.isValid(id) || seen.has(id)) continue
    seen.add(id)
    result.push(new mongoose.Types.ObjectId(id))
  }

  return result
}

function httpError(statusCode, message, messageKey = '') {
  const error = new Error(message)
  error.status = statusCode
  error.statusCode = statusCode
  if (messageKey) error.messageKey = messageKey
  return error
}

async function getOrCreateSettings() {
  try {
    return await PaymentReportSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $setOnInsert: {
          key: SETTINGS_KEY,
          separatePositionIds: [],
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).lean()
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await PaymentReportSettings.findOne({ key: SETTINGS_KEY }).lean()
      if (existing) return existing
    }

    throw error
  }
}

function mapPosition(position = {}) {
  const id = s(position._id || position.id)
  const code = upper(position.code)
  const name = s(position.name)

  return {
    id,
    value: id,
    code,
    name,
    label: [code, name].filter(Boolean).join(' - '),
    isActive: position.isActive !== false,
  }
}

async function getPositionOptions() {
  const positions = await Position.find({ isActive: true })
    .select('_id code name isActive')
    .sort({ name: 1, code: 1, _id: 1 })
    .lean()

  return positions.map(mapPosition)
}

async function getSelectedPositions(positionIds = []) {
  const ids = uniqueObjectIds(positionIds)
  if (!ids.length) return []

  const positions = await Position.find({ _id: { $in: ids } })
    .select('_id code name isActive')
    .lean()

  const byId = new Map(positions.map((position) => [s(position._id), mapPosition(position)]))

  // Preserve the administrator's saved order.
  return ids.map((id) => byId.get(s(id))).filter(Boolean)
}

async function mapSettings(settings = {}, includeOptions = false) {
  const selectedPositions = await getSelectedPositions(settings.separatePositionIds)

  return {
    id: s(settings._id),
    key: SETTINGS_KEY,
    separatePositionIds: selectedPositions.map((item) => item.id),
    separatePositions: selectedPositions,
    separatePositionCount: selectedPositions.length,
    positionOptions: includeOptions ? await getPositionOptions() : undefined,
    updatedBy: s(settings.updatedBy),
    createdAt: settings.createdAt || null,
    updatedAt: settings.updatedAt || null,
  }
}

async function getSettings() {
  const settings = await getOrCreateSettings()
  return mapSettings(settings, true)
}

async function getSettingsForExport() {
  const settings = await getOrCreateSettings()
  return mapSettings(settings, false)
}

async function requireActivePosition(positionId) {
  const id = toObjectId(positionId)
  const position = await Position.findOne({ _id: id, isActive: true })
    .select('_id code name isActive')
    .lean()

  if (!position) {
    throw httpError(
      400,
      'Selected position does not exist or is inactive',
      'payment.reportSettings.positionNotAvailable',
    )
  }

  return position
}

async function addPosition(positionId, actor = {}) {
  const position = await requireActivePosition(positionId)
  const id = new mongoose.Types.ObjectId(s(position._id))

  const current = await getOrCreateSettings()
  const existingIds = uniqueObjectIds(current.separatePositionIds).map(s)

  if (existingIds.includes(s(id))) {
    throw httpError(
      409,
      'This position is already configured for a separate payment report',
      'payment.reportSettings.positionAlreadyExists',
    )
  }

  const settings = await PaymentReportSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $push: { separatePositionIds: id },
      $set: { updatedBy: actorLabel(actor) },
      $setOnInsert: { key: SETTINGS_KEY },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean()

  return mapSettings(settings, true)
}

async function updatePosition(currentPositionId, newPositionId, actor = {}) {
  const currentId = toObjectId(currentPositionId, 'currentPositionId')
  const newPosition = await requireActivePosition(newPositionId)
  const newId = new mongoose.Types.ObjectId(s(newPosition._id))

  const settings = await getOrCreateSettings()
  const ids = uniqueObjectIds(settings.separatePositionIds)
  const currentIndex = ids.findIndex((id) => s(id) === s(currentId))

  if (currentIndex < 0) {
    throw httpError(
      404,
      'Payment report separation setting not found for this position',
      'payment.reportSettings.notFound',
    )
  }

  const duplicateIndex = ids.findIndex((id) => s(id) === s(newId))
  if (duplicateIndex >= 0 && duplicateIndex !== currentIndex) {
    throw httpError(
      409,
      'This position is already configured for a separate payment report',
      'payment.reportSettings.positionAlreadyExists',
    )
  }

  ids[currentIndex] = newId

  const updated = await PaymentReportSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: {
        separatePositionIds: ids,
        updatedBy: actorLabel(actor),
      },
    },
    { new: true },
  ).lean()

  return mapSettings(updated, true)
}

async function deletePosition(positionId, actor = {}) {
  const id = toObjectId(positionId)
  const settings = await getOrCreateSettings()
  const ids = uniqueObjectIds(settings.separatePositionIds)

  if (!ids.some((item) => s(item) === s(id))) {
    throw httpError(
      404,
      'Payment report separation setting not found for this position',
      'payment.reportSettings.notFound',
    )
  }

  const updated = await PaymentReportSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $pull: { separatePositionIds: id },
      $set: { updatedBy: actorLabel(actor) },
    },
    { new: true },
  ).lean()

  return mapSettings(updated, true)
}

module.exports = {
  getSettings,
  getSettingsForExport,
  addPosition,
  updatePosition,
  deletePosition,
}
