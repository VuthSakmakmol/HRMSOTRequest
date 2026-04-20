// backend/src/modules/org/controllers/employee.controller.js
const employeeService = require('../services/employee.service')
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  normalizeListQuery,
  normalizeExportQuery,
} = require('../validators/employee.validation')

function parseBody(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    throw err
  }

  return result.data
}

function parseQuery(normalizer, data) {
  try {
    return normalizer(data)
  } catch (error) {
    if (error?.name === 'ZodError') {
      const err = new Error(error.issues?.[0]?.message || 'Validation error')
      err.status = 400
      throw err
    }
    throw error
  }
}

async function list(req, res, next) {
  try {
    const query = parseQuery(normalizeListQuery, req.query || {})
    const data = await employeeService.list(query, req.user)

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
    const query = parseQuery(normalizeExportQuery, req.query || {})
    const result = await employeeService.exportExcel(query, req.user)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    )

    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const result = await employeeService.downloadImportSample()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
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

    const data = await employeeService.importExcel(
      {
        fileName: req.file.originalname || 'employee-import.xlsx',
        buffer: req.file.buffer,
      },
      req.user,
    )

    res.status(201).json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getById(req, res, next) {
  try {
    const data = await employeeService.getById(req.params.id)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getOrgChart(req, res, next) {
  try {
    const data = await employeeService.getOrgChart(req.params.id)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getOrgTree(req, res, next) {
  try {
    const data = await employeeService.getOrgTree(
      {
        rootEmployeeId: req.query.rootEmployeeId || '',
        search: req.query.search || '',
        includeInactive: String(req.query.includeInactive || '').trim() === 'true',
      },
      req.user,
    )

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
    const payload = parseBody(createEmployeeSchema, req.body || {})
    const data = await employeeService.create(payload)

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
    const payload = parseBody(updateEmployeeSchema, req.body || {})
    const data = await employeeService.update(req.params.id, payload)

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
  exportExcel,
  downloadImportSample,
  importExcel,
  getById,
  getOrgChart,
  getOrgTree,
  create,
  update,
}