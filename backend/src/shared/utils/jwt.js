// backend/src/shared/utils/jwt.js
const jwt = require('jsonwebtoken')
const env = require('../../config/env')

function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: '1d',
  })
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret)
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
}