// backend/src/modules/auth/controllers/account.controller.js
const accountService = require('../services/account.service')
const {
  createAccountSchema,
  updateAccountSchema,
  resetPasswordSchema,
  listAccountsQuerySchema,
} = require('../validators/account.validation')

function parse(schema, data) {
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
    const query = parse(listAccountsQuerySchema, req.query || {})
    const data = await accountService.list(query)

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
    const data = await accountService.getById(req.params.id)

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
    const payload = parse(createAccountSchema, req.body || {})
    const data = await accountService.create(payload)

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
    const payload = parse(updateAccountSchema, req.body || {})
    const data = await accountService.update(req.params.id, payload)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function resetPassword(req, res, next) {
  try {
    const payload = parse(resetPasswordSchema, req.body || {})
    const data = await accountService.resetPassword(req.params.id, payload)

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
  resetPassword,
}