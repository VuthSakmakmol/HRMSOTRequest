// backend/src/modules/org/controllers/department.controller.js
const departmentService = require('../services/department.service')

async function lookup(req, res, next) {
  try {
    const result = await departmentService.lookupDepartments(req.query)

    return res.json({
      ok: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const result = await departmentService.createDepartment(req.body)
    return res.status(201).json({
      ok: true,
      message: 'Department created successfully',
      item: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const result = await departmentService.listDepartments(req.query)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const result = await departmentService.getDepartmentById(req.params.id)
    return res.json({
      ok: true,
      item: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function update(req, res, next) {
  try {
    const result = await departmentService.updateDepartment(req.params.id, req.body)
    return res.json({
      ok: true,
      message: 'Department updated successfully',
      item: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const buffer = await departmentService.exportDepartmentsExcel(req.query)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="departments-${Date.now()}.xlsx"`,
    )

    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const buffer = await departmentService.downloadDepartmentImportSample()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="department-import-sample.xlsx"',
    )

    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    const result = await departmentService.importDepartmentsExcel(req.file?.buffer)

    return res.json({
      ok: true,
      message: 'Department excel imported successfully',
      ...result,
    })
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