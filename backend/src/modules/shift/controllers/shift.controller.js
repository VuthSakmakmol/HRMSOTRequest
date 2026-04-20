// backend/src/modules/shift/controllers/shift.controller.js
const shiftService = require('../services/shift.service')
const {
  createShiftSchema,
  updateShiftSchema,
  listShiftQuerySchema,
} = require('../validators/shift.validation')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    throw err
  }

  return result.data
}

async function list(req, res, next) {
  try {
    const query = parse(listShiftQuerySchema, req.query || {})
    const data = await shiftService.list(query)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getById(req, res, next) {
  try {
    const data = await shiftService.getById(req.params.id)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createShiftSchema, req.body || {})
    const data = await shiftService.create(payload)

    res.status(201).json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function update(req, res, next) {
  try {
    const payload = parse(updateShiftSchema, req.body || {})
    const data = await shiftService.update(req.params.id, payload)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
}