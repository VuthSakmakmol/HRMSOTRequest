// backend/src/modules/calendar/controllers/holiday.controller.js
const holidayService = require('../services/holiday.service')
const {
  createHolidaySchema,
  updateHolidaySchema,
  listHolidayQuerySchema,
  holidayIdParamSchema,
} = require('../validators/holiday.validation')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    throw err
  }

  return result.data
}

async function lookup(req, res, next) {
  try {
    const data = await holidayService.lookup(req.query || {})

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function list(req, res, next) {
  try {
    const query = parse(listHolidayQuerySchema, req.query || {})
    const data = await holidayService.list(query)

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
    const { id } = parse(holidayIdParamSchema, req.params || {})
    const data = await holidayService.getById(id)

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
    const payload = parse(createHolidaySchema, req.body || {})
    const actorId = req.user?.id || req.user?.accountId || null
    const data = await holidayService.create(payload, actorId)

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
    const { id } = parse(holidayIdParamSchema, req.params || {})
    const payload = parse(updateHolidaySchema, req.body || {})
    const actorId = req.user?.id || req.user?.accountId || null
    const data = await holidayService.update(id, payload, actorId)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  lookup,
  list,
  getById,
  create,
  update,
}