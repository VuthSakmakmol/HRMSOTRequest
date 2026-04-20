// backend/src/app.js
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')

const env = require('./config/env')
const routes = require('./routes')

const app = express()

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
)
app.use(helmet())
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'OTRequest_v2 backend running',
  })
})

app.get('/api/realtime/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Socket foundation ready',
  })
})

app.use('/api/v1', routes)

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Route not found',
  })
})

app.use((error, req, res, next) => {
  console.error('[error]', error)

  const status = error.status || 500
  return res.status(status).json({
    ok: false,
    message: error.message || 'Internal server error',
    issues: error.issues || undefined,
  })
})

module.exports = app