// backend/src/server.js
const http = require('http')
const { Server } = require('socket.io')

const app = require('./app')
const env = require('./config/env')
const { connectMongo } = require('./database/mongoose')
const { setIo } = require('./shared/services/socket.service')

async function start() {
  try {
    await connectMongo()

    const server = http.createServer(app)

    const io = new Server(server, {
      cors: {
        origin: env.clientUrl,
        credentials: true,
      },
    })

    io.on('connection', (socket) => {
      console.log('[socket] connected:', socket.id)

      socket.on('disconnect', () => {
        console.log('[socket] disconnected:', socket.id)
      })
    })

    setIo(io)

    server.listen(env.port, () => {
      console.log(`[server] http://localhost:${env.port}`)
    })
  } catch (error) {
    console.error('[server] startup error:', error)
    process.exit(1)
  }
}

start()