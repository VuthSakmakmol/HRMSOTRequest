// backend/src/modules/access/controllers/systemRole.controller.js
const systemRoleService = require('../services/systemRole.service')
const {
  createSystemRoleSchema,
  updateSystemRoleSchema,
  normalizeListQuery,
} = require('../validators/systemRole.validation')

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
    const data = await systemRoleService.list(query)

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
    const data = await systemRoleService.getById(req.params.id)

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
    const payload = parseBody(createSystemRoleSchema, req.body || {})
    const data = await systemRoleService.create(payload)

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
    const payload = parseBody(updateSystemRoleSchema, req.body || {})
    const data = await systemRoleService.update(req.params.id, payload)

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
  create,
  update,
}