// backend/src/modules/auth/controllers/account.controller.js

const accountService = require('../services/account.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createAccountSchema,
  updateAccountSchema,
  resetPasswordSchema,
  listAccountsQuerySchema,
} = require('../validators/account.validation')

function parse(schema, data) {
  return schema.parse(data)
}

async function list(req, res, next) {
  try {
    const query = parse(listAccountsQuerySchema, req.query || {})
    const result = await accountService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getOne(req, res, next) {
  try {
    const item = await accountService.getById(req.params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createAccountSchema, req.body || {})
    const item = await accountService.create(payload)

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
    const payload = parse(updateAccountSchema, req.body || {})
    const item = await accountService.update(req.params.id, payload)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function resetPassword(req, res, next) {
  try {
    const payload = parse(resetPasswordSchema, req.body || {})
    const item = await accountService.resetPassword(req.params.id, payload)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  resetPassword,
}