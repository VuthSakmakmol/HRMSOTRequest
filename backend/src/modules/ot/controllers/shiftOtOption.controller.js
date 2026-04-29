// backend/src/modules/ot/controllers/shiftOtOption.controller.js
const shiftOtOptionService = require('../services/shiftOtOption.service')

async function lookupShiftOTOptions(req, res, next) {
  try {
    const result = await shiftOtOptionService.lookup(req.query || {})

    return res.json({
      ok: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function createShiftOTOption(req, res, next) {
  try {
    const result = await shiftOtOptionService.create(req.body || {}, req.user)

    return res.status(201).json({
      ok: true,
      message: 'Shift OT option created successfully',
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function updateShiftOTOption(req, res, next) {
  try {
    const result = await shiftOtOptionService.update(req.params.id, req.body || {}, req.user)

    return res.json({
      ok: true,
      message: 'Shift OT option updated successfully',
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function listShiftOTOptions(req, res, next) {
  try {
    const result = await shiftOtOptionService.list(req.query || {})
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

async function getShiftOTOptionDetail(req, res, next) {
  try {
    const result = await shiftOtOptionService.getById(req.params.id)

    return res.json({
      ok: true,
      item: result,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  lookupShiftOTOptions,
  createShiftOTOption,
  updateShiftOTOption,
  listShiftOTOptions,
  getShiftOTOptionDetail,
}