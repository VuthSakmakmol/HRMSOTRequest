// backend/src/config/env.js
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') })

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4112),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5174',

  mongoUri: requireEnv('MONGO_URI'),
  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
}