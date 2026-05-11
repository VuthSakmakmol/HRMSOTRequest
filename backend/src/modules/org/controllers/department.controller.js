// backend/src/modules/org/controllers/department.controller.js

const departmentService = require('../services/department.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentQuerySchema,
  departmentLookupQuerySchema,
} = require('../validators/department.validator')

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
    const query = parse(departmentLookupQuerySchema, req.query || {})
    const result = await departmentService.lookupDepartments(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const query = parse(listDepartmentQuerySchema, req.query || {})
    const result = await departmentService.listDepartments(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const item = await departmentService.getDepartmentById(req.params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createDepartmentSchema, req.body || {})
    const item = await departmentService.createDepartment(payload)

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
    const payload = parse(updateDepartmentSchema, req.body || {})
    const item = await departmentService.updateDepartment(req.params.id, payload)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const query = parse(listDepartmentQuerySchema, {
      ...(req.query || {}),
      page: 1,
      limit: 10,
    })

    const result = await departmentService.exportDepartmentsExcel(query)

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const result = await departmentService.downloadDepartmentImportSample()

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    const item = await departmentService.importDepartmentsExcel(req.file?.buffer)

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
  create,
  list,
  getById,
  update,
  exportExcel,
  downloadImportSample,
  importExcel,
}