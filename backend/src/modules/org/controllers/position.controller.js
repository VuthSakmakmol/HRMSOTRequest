// backend/src/modules/org/controllers/position.controller.js

const positionService = require('../services/position.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createPositionSchema,
  updatePositionSchema,
  listPositionsQuerySchema,
  lookupPositionsQuerySchema,
  positionIdParamSchema,
} = require('../validators/position.validation')

function parse(schema, data) {
  return schema.parse(data)
}

function getActor(req) {
  return (
    req.user?.loginId ||
    req.user?.username ||
    req.user?.employeeNo ||
    req.user?.email ||
    req.user?.accountId ||
    req.user?._id ||
    ''
  )
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
    const query = parse(lookupPositionsQuerySchema, req.query || {})
    const result = await positionService.lookupPositions(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const query = parse(listPositionsQuerySchema, req.query || {})
    const result = await positionService.listPositions(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const params = parse(positionIdParamSchema, req.params || {})
    const item = await positionService.getPositionById(params.id)

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
    const item = await positionService.createPosition(payload, getActor(req))

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
    const params = parse(positionIdParamSchema, req.params || {})
    const payload = parse(updatePositionSchema, req.body || {})
    const item = await positionService.updatePosition(params.id, payload, getActor(req))

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const query = parse(listPositionsQuerySchema, {
      ...(req.query || {}),
      page: 1,
      limit: 10,
    })

    const result = await positionService.exportPositionsExcel(query)

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const result = await positionService.downloadPositionImportSample()

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    const item = await positionService.importPositionsExcel(
      req.file?.buffer,
      getActor(req),
    )

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