// backend/src/config/env.js
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const candidateEnvPaths = [
  path.resolve(__dirname, '../.env'),          // backend/.env
  path.resolve(process.cwd(), '.env'),            // when running inside backend
  path.resolve(process.cwd(), 'backend/.env'),    // when running from project root
]

const envPath = candidateEnvPaths.find((item) => fs.existsSync(item))

if (envPath) {
  dotenv.config({
    path: envPath,
    override: true,
    quiet: true,
  })
}

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()

  if (!value) {
    const searched = candidateEnvPaths.join(' | ')
    throw new Error(
      `Missing required environment variable: ${name}. Checked env file paths: ${searched}`
    )
  }

  return value
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4112),
  mongoUri: requireEnv('MONGO_URI'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
  superAdminLoginId: process.env.SUPER_ADMIN_LOGIN_ID || 'root_admin',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
}