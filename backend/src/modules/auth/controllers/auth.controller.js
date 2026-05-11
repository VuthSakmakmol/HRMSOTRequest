// backend/src/modules/auth/controllers/auth.controller.js

const { z } = require('zod')
const authService = require('../services/auth.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const loginSchema = z.object({
  loginId: z.string().trim().min(1, 'auth.validation.loginIdRequired'),
  password: z.string().min(1, 'auth.validation.passwordRequired'),
})

async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body || {})
    const item = await authService.login(payload)

    return successResponse(res, { item })
  } catch (error) {
    return next(error)
  }
}

async function me(req, res, next) {
  try {
    return successResponse(res, {
      item: req.user,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  login,
  me,
}