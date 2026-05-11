// backend/src/modules/calendar/controllers/holiday.controller.js

const holidayService = require('../services/holiday.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createHolidaySchema,
  updateHolidaySchema,
  normalizeListQuery,
  normalizeLookupQuery,
  resolveDayTypeQuerySchema,
  holidayIdParamSchema,
} = require('../validators/holiday.validation')

function parse(schema, data) {
  return schema.parse(data)
}

async function lookup(req, res, next) {
  try {
    const query = normalizeLookupQuery(req.query || {})
    const result = await holidayService.lookup(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await holidayService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const { id } = parse(holidayIdParamSchema, req.params || {})
    const item = await holidayService.getById(id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createHolidaySchema, req.body || {})
    const actorId = req.user?.accountId || req.user?.id || null
    const item = await holidayService.create(payload, actorId)

    return successResponse(
      res,
      {
        item,
      },
      201,
    )
  } catch (error) {
    return next(error)
  }
}

async function update(req, res, next) {
  try {
    const { id } = parse(holidayIdParamSchema, req.params || {})
    const payload = parse(updateHolidaySchema, req.body || {})
    const actorId = req.user?.accountId || req.user?.id || null
    const item = await holidayService.update(id, payload, actorId)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function resolveDayType(req, res, next) {
  try {
    const query = parse(resolveDayTypeQuerySchema, req.query || {})
    const item = await holidayService.resolveDayType(query.date)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  lookup,
  list,
  getById,
  create,
  update,
  resolveDayType,
}