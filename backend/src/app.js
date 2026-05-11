// backend/src/app.js

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')

const env = require('./config/env')
const routes = require('./routes')
const notFound = require('./middlewares/notFound.middleware')
const errorHandler = require('./middlewares/errorHandler.middleware')

const app = express()

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
)

app.use(helmet())
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    item: {
      service: 'OTRequest_v2 backend',
      status: 'running',
    },
  })
})

app.get('/api/realtime/health', (req, res) => {
  res.json({
    success: true,
    item: {
      service: 'Socket foundation',
      status: 'ready',
    },
  })
})

app.use('/api/v1', routes)

app.use(notFound)
app.use(errorHandler)

module.exports = app