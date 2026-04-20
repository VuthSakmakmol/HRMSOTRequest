// backend/src/modules/org/controllers/position.controller.js
const positionService = require('../services/position.service')
const {
  createPositionSchema,
  updatePositionSchema,
  normalizeListQuery,
} = require('../validators/position.validation')

function parseBody(schema, data) {
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
    const query = normalizeListQuery(req.query || {})
    const data = await positionService.list(query)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getOne(req, res, next) {
  try {
    const data = await positionService.getById(req.params.id)

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
    const payload = parseBody(createPositionSchema, req.body || {})
    const data = await positionService.create(payload)

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
    const payload = parseBody(updatePositionSchema, req.body || {})
    const data = await positionService.update(req.params.id, payload)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function downloadSample(req, res, next) {
  try {
    const result = await positionService.downloadSample()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    )

    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await positionService.exportExcel(query)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    )

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

    const data = await positionService.importExcel(req.file)

    res.json({
      ok: true,
      data,
      message: 'Position import completed',
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  downloadSample,
  exportExcel,
  importExcel,
}