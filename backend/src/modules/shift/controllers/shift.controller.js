// backend/src/modules/shift/controllers/shift.controller.js
const shiftService = require('../services/shift.service')

async function lookup(req, res, next) {
  try {
    const result = await shiftService.lookupShifts(req.query)

    return res.json({
      ok: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function list(req, res, next) {
  try {
    const result = await shiftService.listShifts(req.query)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const result = await shiftService.getShiftById(req.params.id)

    return res.json({
      ok: true,
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const result = await shiftService.createShift(req.body)

    return res.status(201).json({
      ok: true,
      message: 'Shift created successfully',
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function update(req, res, next) {
  try {
    const result = await shiftService.updateShift(req.params.id, req.body)

    return res.json({
      ok: true,
      message: 'Shift updated successfully',
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function exportExcel(req, res, next) {
  try {
    const buffer = await shiftService.exportShiftsExcel(req.query)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shifts-${Date.now()}.xlsx"`,
    )

    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
}

async function downloadImportSample(req, res, next) {
  try {
    const buffer = await shiftService.downloadShiftImportSample()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="shift-import-sample.xlsx"',
    )

    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
}

async function importExcel(req, res, next) {
  try {
    const result = await shiftService.importShiftsExcel(req.file?.buffer)

    return res.json({
      ok: true,
      message: 'Shift excel imported successfully',
      ...result,
    })
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