// backend/src/server.js
// backend/src/server.js

const http = require('http')
const { Server } = require('socket.io')

const app = require('./app')
const env = require('./config/env')
const { connectMongo } = require('./database/mongoose')
const { setIo } = require('./shared/services/socket.service')

let httpServer = null

function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log('[socket] connected:', socket.id)

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', socket.id, reason)
    })
  })

  setIo(io)

  return io
}

async function start() {
  try {
    await connectMongo()

    httpServer = http.createServer(app)

    createSocketServer(httpServer)

    httpServer.listen(env.port, () => {
      console.log(`[server] http://localhost:${env.port}`)
      console.log(`[env] ${env.nodeEnv}`)
    })
  } catch (error) {
    console.error('[server] startup error:', error)
    process.exit(1)
  }
}

function shutdown(signal) {
  console.log(`[server] ${signal} received. Shutting down...`)

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

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (error) => {
  console.error('[process] unhandledRejection:', error)
  shutdown('unhandledRejection')
})

process.on('uncaughtException', (error) => {
  console.error('[process] uncaughtException:', error)
  shutdown('uncaughtException')
})

start()