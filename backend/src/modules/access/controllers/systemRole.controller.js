// backend/src/modules/access/controllers/systemRole.controller.js

const systemRoleService = require('../services/systemRole.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  listSystemRoleQuerySchema,
  createSystemRoleSchema,
  updateSystemRoleSchema,
} = require('../validators/systemRole.validation')

function parse(schema, data) {
  return schema.parse(data)
}

async function list(req, res, next) {
  try {
    const query = parse(listSystemRoleQuerySchema, req.query || {})
    const result = await systemRoleService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getOne(req, res, next) {
  try {
    const item = await systemRoleService.getById(req.params.id)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = parse(createSystemRoleSchema, req.body || {})
    const item = await systemRoleService.create(payload)

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
    const payload = parse(updateSystemRoleSchema, req.body || {})
    const item = await systemRoleService.update(req.params.id, payload)

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
}