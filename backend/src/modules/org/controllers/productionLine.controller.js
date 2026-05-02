// backend/src/modules/org/controllers/productionLine.controller.js
// backend/src/modules/org/controllers/productionLine.controller.js

const productionLineService = require('../services/productionLine.service')
const {
  createProductionLineSchema,
  updateProductionLineSchema,
  listProductionLineQuerySchema,
  productionLineLookupQuerySchema,
} = require('../validators/productionLine.validation')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    throw err
  }

  return result.data
}

function setExcelHeaders(res, filename) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  )
}

async function list(req, res, next) {
  try {
    const query = parse(listProductionLineQuerySchema, req.query || {})
    const data = await productionLineService.list(query)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function lookup(req, res, next) {
  try {
    const query = parse(productionLineLookupQuerySchema, req.query || {})
    const data = await productionLineService.lookup(query)

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
    const data = await productionLineService.getById(req.params.id)

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
    const payload = parse(createProductionLineSchema, req.body || {})
    const data = await productionLineService.create(payload, req.user)

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
    const payload = parse(updateProductionLineSchema, req.body || {})
    const data = await productionLineService.update(req.params.id, payload, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const query = parse(listProductionLineQuerySchema, {
      ...(req.query || {}),
      page: 1,
      limit: 200,
    })

    const result = await productionLineService.exportExcel(query)

    setExcelHeaders(res, result.filename)
    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const result = await productionLineService.downloadImportSample()

    setExcelHeaders(res, result.filename)
    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    if (!req.file?.buffer) {
      const err = new Error('Excel file is required')
      err.status = 400
      throw err
    }

    const data = await productionLineService.importExcel(req.file.buffer, req.user)

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
  lookup,
  getById,
  create,
  update,
  exportExcel,
  downloadImportSample,
  importExcel,
}