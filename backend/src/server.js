// backend/src/server.js

const http = require('http')
const { Server } = require('socket.io')

const app = require('./app')
const env = require('./config/env')
const { connectMongo } = require('./database/mongoose')
const { setIo } = require('./shared/services/socket.service')

const {
  setRealtimeServer,
  attachSocketHandlers,
} = require('./modules/realtime/realtime.service')

const {
  startTelegramPolling,
  stopTelegramPolling,
} = require('./modules/telegram/services/telegramPolling.service')

let httpServer = null
let isShuttingDown = false

function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  })

  setIo(io)

  setRealtimeServer(io)
  attachSocketHandlers(io)

  app.set('io', io)

  return io
}

async function start() {
  try {
    await connectMongo()

    httpServer = http.createServer(app)

    // Payment, attendance, and import/export operations may process many rows.
    // Node uses 0 to disable these server-side request time limits.
    httpServer.requestTimeout = 0
    httpServer.headersTimeout = 0
    httpServer.timeout = 0

    createSocketServer(httpServer)

    httpServer.listen(env.port, async () => {
      console.log(`[server] http://localhost:${env.port}`)
      console.log(`[env] ${env.nodeEnv}`)

      try {
        await startTelegramPolling()
      } catch (error) {
        console.error('[TELEGRAM_POLLING_START_FAILED]', error)
      }
    })
  } catch (error) {
    console.error('[server] startup error:', error)
    process.exit(1)
  }
}

async function shutdown(signal) {
  if (isShuttingDown) return

  isShuttingDown = true

  console.log(`[server] ${signal} received. Shutting down...`)

  try {
    await stopTelegramPolling()
  } catch (error) {
    console.warn('[TELEGRAM_POLLING_STOP_FAILED]', error)
  }

  if (!httpServer) {
    process.exit(0)
  }

  httpServer.close((error) => {
    if (error) {
      console.error('[server] shutdown error:', error)
      process.exit(1)
    }

    console.log('[server] closed')
    process.exit(0)
  })
}

process.once('SIGTERM', () => {
  shutdown('SIGTERM')
})

process.once('SIGINT', () => {
  shutdown('SIGINT')
})

process.once('unhandledRejection', (error) => {
  console.error('[process] unhandledRejection:', error)
  shutdown('unhandledRejection')
})

process.once('uncaughtException', (error) => {
  console.error('[process] uncaughtException:', error)
  shutdown('uncaughtException')
})

start()
