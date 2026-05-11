// backend/src/modules/org/controllers/employee.controller.js

const employeeService = require('../services/employee.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createEmployeeSchema,
  updateEmployeeSchema,
  normalizeListQuery,
  normalizeExportQuery,
  normalizeLookupQuery,
} = require('../validators/employee.validation')

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
    const result = await employeeService.lookup(query, req.user)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const query = normalizeListQuery(req.query || {})
    const result = await employeeService.list(query, req.user)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const query = normalizeExportQuery(req.query || {})
    const result = await employeeService.exportExcel(query, req.user)

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const result = await employeeService.downloadImportSample()

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    if (!req.file?.buffer) {
      const error = new Error('org.employee.error.excelFileRequired')
      error.statusCode = 400
      error.code = 'EMPLOYEE_EXCEL_FILE_REQUIRED'
      error.messageKey = 'org.employee.error.excelFileRequired'
      throw error
    }

    const item = await employeeService.importExcel(
      {
        fileName: req.file.originalname || 'employee-import.xlsx',
        buffer: req.file.buffer,
      },
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

async function getById(req, res, next) {
  try {
    const item = await employeeService.getById(req.params.id, req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function getOrgChart(req, res, next) {
  try {
    const item = await employeeService.getOrgChart(req.params.id, req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function getOrgTree(req, res, next) {
  try {
    const item = await employeeService.getOrgTree(
      {
        rootEmployeeId: req.query.rootEmployeeId || '',
        search: req.query.search || '',
        includeInactive: String(req.query.includeInactive || '').trim() === 'true',
      },
      req.user,
    )

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createEmployeeSchema, req.body || {})
    const item = await employeeService.create(payload, req.user)

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
    const payload = parse(updateEmployeeSchema, req.body || {})
    const item = await employeeService.update(req.params.id, payload, req.user)

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
  exportExcel,
  downloadImportSample,
  importExcel,
  getById,
  getOrgChart,
  getOrgTree,
  create,
  update,
}