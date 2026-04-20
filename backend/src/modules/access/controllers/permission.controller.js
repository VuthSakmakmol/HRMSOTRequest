// backend/src/modules/access/controllers/permission.controller.js
const permissionService = require('../services/permission.service')
const { normalizeListQuery } = require('../validators/permission.validation')

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
    const data = await permissionService.list(query)

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
    const data = await permissionService.getById(req.params.id)

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
  getOne,
}