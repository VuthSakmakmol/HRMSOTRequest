// backend/src/modules/access/controllers/permission.controller.js

const permissionService = require('../services/permission.service')
const { listPermissionQuerySchema } = require('../validators/permission.validation')
const { successResponse } = require('../../../shared/utils/apiResponse')

function parse(schema, data) {
  return schema.parse(data)
}

async function list(req, res, next) {
  try {
    const query = parse(listPermissionQuerySchema, req.query || {})
    const result = await permissionService.list(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getOne(req, res, next) {
  try {
    const item = await permissionService.getById(req.params.id)

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
}