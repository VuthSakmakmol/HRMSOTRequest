// backend/src/modules/ot/controllers/shiftOtOption.controller.js
const mongoose = require('mongoose')
const shiftOtOptionService = require('../services/shiftOtOption.service')
const {
  createShiftOTOptionSchema,
  updateShiftOTOptionSchema,
  listShiftOTOptionsQuerySchema,
  shiftOTOptionIdParamSchema,
} = require('../validators/shiftOtOption.validation')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    throw err
  }

  return result.data
}

function parseObjectIdParam(value, label = 'id') {
  const id = String(value || '').trim()

  if (!mongoose.isValidObjectId(id)) {
    const err = new Error(`Invalid ${label}`)
    err.status = 400
    throw err
  }

  return id
}

async function createShiftOTOption(req, res, next) {
  try {
    const payload = parse(createShiftOTOptionSchema, req.body || {})
    const data = await shiftOtOptionService.create(payload, req.user)

    res.status(201).json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function updateShiftOTOption(req, res, next) {
  try {
    const params = parse(shiftOTOptionIdParamSchema, req.params || {})
    const payload = parse(updateShiftOTOptionSchema, req.body || {})
    const data = await shiftOtOptionService.update(params.id, payload, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function listShiftOTOptions(req, res, next) {
  try {
    const query = parse(listShiftOTOptionsQuerySchema, req.query || {})
    const data = await shiftOtOptionService.list(query)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getShiftOTOptionDetail(req, res, next) {
  try {
    const id = parseObjectIdParam(req.params.id, 'id')
    const data = await shiftOtOptionService.getById(id)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createShiftOTOption,
  updateShiftOTOption,
  listShiftOTOptions,
  getShiftOTOptionDetail,
}