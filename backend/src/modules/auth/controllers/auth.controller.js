// backend/src/modules/auth/controllers/auth.controller.js
const { z } = require('zod')
const authService = require('../services/auth.service')

const loginSchema = z.object({
  loginId: z.string().trim().min(1, 'loginId is required'),
  password: z.string().min(1, 'password is required'),
})

async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body || {})
    const data = await authService.login(payload)

    return res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function me(req, res) {
  return res.json({
    ok: true,
    data: req.user,
  })
}

module.exports = {
  login,
  me,
}