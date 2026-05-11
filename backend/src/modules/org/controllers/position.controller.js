// backend/src/modules/org/controllers/position.controller.js

const positionService = require('../services/position.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createPositionSchema,
  updatePositionSchema,
  normalizeListQuery,
  normalizeLookupQuery,
} = require('../validators/position.validation')

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
    const result = await positionService.lookup(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await positionService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getOne(req, res, next) {
  try {
    const item = await positionService.getById(req.params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createPositionSchema, req.body || {})
    const item = await positionService.create(payload)

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
    const payload = parse(updatePositionSchema, req.body || {})
    const item = await positionService.update(req.params.id, payload)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function downloadSample(req, res, next) {
  try {
    const result = await positionService.downloadSample()

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
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

    const result = await positionService.exportExcel(query)

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    const item = await positionService.importExcel(req.file)

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
  getOne,
  create,
  update,
  downloadSample,
  exportExcel,
  importExcel,
}