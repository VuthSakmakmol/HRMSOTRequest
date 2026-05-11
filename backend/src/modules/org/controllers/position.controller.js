// backend/src/modules/org/controllers/position.controller.js

const positionService = require('../services/position.service')
const {
  createPositionSchema,
  updatePositionSchema,
  listPositionsQuerySchema,
  lookupPositionsQuerySchema,
  positionCodeParamSchema,
} = require('../validators/position.validation')

function parse(schema, data) {
  const result = schema.safeParse(data || {})

  if (!result.success) {
    const error = new Error(result.error.issues?.[0]?.message || 'Invalid request')
    error.status = 400
    error.statusCode = 400
    throw error
  }

  return result.data
}

function getActor(req) {
  return (
    req.user?.loginId ||
    req.user?.username ||
    req.user?.employeeNo ||
    req.user?.email ||
    req.user?.accountId ||
    ''
  )
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

async function listPositions(req, res, next) {
  try {
    const query = parse(listPositionsQuerySchema, req.query)
    const data = await positionService.listPositions(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function lookupPositions(req, res, next) {
  try {
    const query = parse(lookupPositionsQuerySchema, req.query)
    const data = await positionService.lookupPositions(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getPositionByCode(req, res, next) {
  try {
    const params = parse(positionCodeParamSchema, req.params)
    const item = await positionService.getPositionByCode(params.code)

    res.json({
      success: true,
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function createPosition(req, res, next) {
  try {
    const payload = parse(createPositionSchema, req.body)
    const item = await positionService.createPosition(payload, getActor(req))

    res.status(201).json({
      success: true,
      message: 'Position created successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function updatePosition(req, res, next) {
  try {
    const params = parse(positionCodeParamSchema, req.params)
    const payload = parse(updatePositionSchema, req.body)

    const item = await positionService.updatePosition(params.code, payload, getActor(req))

    res.json({
      success: true,
      message: 'Position updated successfully',
      item,
    })
  } catch (error) {
    next(error)
  }
}

async function importPositions(req, res, next) {
  try {
    const data = await positionService.importPositions(req.file, getActor(req))

    res.status(201).json({
      success: true,
      message: 'Positions imported successfully',
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function exportPositions(req, res, next) {
  try {
    const query = parse(listPositionsQuerySchema, req.query)
    const result = await positionService.exportPositions(query)

    setExcelHeaders(res, result.filename)
    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

async function downloadPositionImportSample(req, res, next) {
  try {
    const result = await positionService.downloadImportSample()

    setExcelHeaders(res, result.filename)
    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listPositions,
  lookupPositions,
  getPositionByCode,
  createPosition,
  updatePosition,
  importPositions,
  exportPositions,
  downloadPositionImportSample,
}