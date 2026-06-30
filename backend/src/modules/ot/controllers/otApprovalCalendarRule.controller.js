// backend/src/modules/ot/controllers/otApprovalCalendarRule.controller.js

const AppError = require('../../../shared/errors/AppError')
const { successResponse } = require('../../../shared/utils/apiResponse')
const service = require('../services/otApprovalCalendarRule.service')

const {
  calendarRuleEmployeeParamSchema,
  upsertCalendarRuleSchema,
  employeeOptionsQuerySchema,
} = require('../validators/otApprovalCalendarRule.validation')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (result.success) return result.data

  const firstIssue = result.error.issues?.[0]
  throw new AppError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    messageKey: firstIssue?.message || 'common.validation.invalidRequest',
    message: firstIssue?.message || 'Invalid request',
    field: firstIssue?.path?.length ? firstIssue.path.join('.') : null,
  })
}

async function list(req, res, next) {
  try {
    const result = await service.listRules()
    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function listEmployeeOptions(req, res, next) {
  try {
    const query = parse(employeeOptionsQuerySchema, req.query || {})
    const result = await service.listEmployeeOptions(query)
    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function upsert(req, res, next) {
  try {
    const params = parse(calendarRuleEmployeeParamSchema, req.params || {})
    const payload = parse(upsertCalendarRuleSchema, req.body || {})
    const item = await service.upsertRule(params.employeeId, payload, req.user)

    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

async function reset(req, res, next) {
  try {
    const params = parse(calendarRuleEmployeeParamSchema, req.params || {})
    const result = await service.resetRule(params.employeeId)

    return successResponse(res, { item: result })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list,
  listEmployeeOptions,
  upsert,
  reset,
}
