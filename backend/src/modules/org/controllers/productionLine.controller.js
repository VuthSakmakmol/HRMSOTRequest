// backend/src/modules/org/controllers/productionLine.controller.js

const productionLineService = require('../services/productionLine.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createProductionLineSchema,
  updateProductionLineSchema,
  normalizeListQuery,
  normalizeLookupQuery,
} = require('../validators/productionLine.validation')

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

async function list(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await productionLineService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function lookup(req, res, next) {
  try {
    const query = normalizeLookupQuery(req.query || {})
    const result = await productionLineService.lookup(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const item = await productionLineService.getById(req.params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createProductionLineSchema, req.body || {})
    const item = await productionLineService.create(payload, req.user)

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
    const payload = parse(updateProductionLineSchema, req.body || {})
    const item = await productionLineService.update(req.params.id, payload, req.user)

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

    const result = await productionLineService.exportExcel(query)

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const result = await productionLineService.downloadImportSample()

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    const item = await productionLineService.importExcel(
      req.file?.buffer,
      req.user,
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
  list,
  lookup,
  getById,
  create,
  update,
  exportExcel,
  downloadImportSample,
  importExcel,
}