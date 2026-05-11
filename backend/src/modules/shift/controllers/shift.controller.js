// backend/src/modules/shift/controllers/shift.controller.js

const shiftService = require('../services/shift.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createShiftSchema,
  updateShiftSchema,
  normalizeListQuery,
  normalizeLookupQuery,
} = require('../validators/shift.validation')

function parse(schema, data) {
  return schema.parse(data)
}

function setExcelHeaders(res, filename) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
}

async function lookup(req, res, next) {
  try {
    const query = normalizeLookupQuery(req.query || {})
    const result = await shiftService.lookupShifts(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await shiftService.listShifts(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const item = await shiftService.getShiftById(req.params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createShiftSchema, req.body || {})
    const item = await shiftService.createShift(payload)

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
    const payload = parse(updateShiftSchema, req.body || {})
    const item = await shiftService.updateShift(req.params.id, payload)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const query = normalizeListQuery({
      ...(req.query || {}),
      page: 1,
      limit: 10,
    })

    const result = await shiftService.exportShiftsExcel(query)

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const result = await shiftService.downloadShiftImportSample()

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    const item = await shiftService.importShiftsExcel(req.file?.buffer)

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

module.exports = {
  lookup,
  list,
  getById,
  create,
  update,
  exportExcel,
  downloadImportSample,
  importExcel,
}