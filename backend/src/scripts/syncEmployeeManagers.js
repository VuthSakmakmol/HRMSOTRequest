// backend/src/scripts/syncEmployeeManagers.js
// backend/src/scripts/syncEmployeeManagers.js

const path = require('path')
const dotenv = require('dotenv')
const mongoose = require('mongoose')

const backendEnvPath = path.resolve(__dirname, '../../.env')
const srcEnvPath = path.resolve(__dirname, '../.env')

dotenv.config({ path: backendEnvPath })
dotenv.config({ path: srcEnvPath })

const employeeService = require('../modules/org/services/employee.service')

function maskUri(uri) {
  if (!uri) return ''
  if (uri.length <= 20) return '***'
  return `${uri.slice(0, 18)}...${uri.slice(-8)}`
}

async function main() {
  const mongoUri = String(process.env.MONGO_URI || '').trim()

  console.log('Checked env paths:')
  console.log('- backend/.env:', backendEnvPath)
  console.log('- backend/src/.env:', srcEnvPath)
  console.log('MONGO_URI loaded:', mongoUri ? 'YES' : 'NO')

  if (mongoUri) {
    console.log('MONGO_URI preview:', maskUri(mongoUri))
  }

  if (!mongoUri) {
    throw new Error(
      'MONGO_URI is required. Please make sure it exists in backend/.env or backend/src/.env',
    )
  }

  console.log('Connecting to MongoDB...')
  await mongoose.connect(mongoUri)

  console.log('Syncing employee line managers...')
  const result = await employeeService.syncSameLineManagersForAllEmployees()

  console.log('Employee manager sync completed:')
  console.log(result)

  await mongoose.disconnect()
  console.log('Disconnected from MongoDB.')
}

main().catch(async (error) => {
  console.error('Employee manager sync failed:')
  console.error(error)

  try {
    await mongoose.disconnect()
  } catch {}

  process.exit(1)
})