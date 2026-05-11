// backend/src/modules/ot/controllers/shiftOtOption.controller.js

const shiftOtOptionService = require('../services/shiftOtOption.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createShiftOTOptionSchema,
  updateShiftOTOptionSchema,
  normalizeListQuery,
  normalizeLookupQuery,
  shiftOTOptionIdParamSchema,
} = require('../validators/shiftOtOption.validation')

function parse(schema, data) {
  return schema.parse(data)
}

async function lookupShiftOTOptions(req, res, next) {
  try {
    const query = normalizeLookupQuery(req.query || {})
    const result = await shiftOtOptionService.lookup(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function listShiftOTOptions(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await shiftOtOptionService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getShiftOTOptionDetail(req, res, next) {
  try {
    const params = parse(shiftOTOptionIdParamSchema, req.params || {})
    const item = await shiftOtOptionService.getById(params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function createShiftOTOption(req, res, next) {
  try {
    const payload = parse(createShiftOTOptionSchema, req.body || {})
    const item = await shiftOtOptionService.create(payload, req.user)

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

async function updateShiftOTOption(req, res, next) {
  try {
    const params = parse(shiftOTOptionIdParamSchema, req.params || {})
    const payload = parse(updateShiftOTOptionSchema, req.body || {})
    const item = await shiftOtOptionService.update(params.id, payload, req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  lookupShiftOTOptions,
  listShiftOTOptions,
  getShiftOTOptionDetail,
  createShiftOTOption,
  updateShiftOTOption,
}