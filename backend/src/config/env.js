// backend/src/config/env.js
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4112),
  mongoUri: process.env.MONGO_URI || 'mongodb+srv://vuthsakmakmol123:zzA1nIbImE7Da0CD@cluster0.nhk2s.mongodb.net/OTRequest?retryWrites=true&w=majority',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'change_this_secret',
}