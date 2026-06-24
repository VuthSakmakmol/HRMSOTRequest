// backend/src/modules/ot/tests/otSavedDataAudit.test.js

const mongoose = require('mongoose')

const appEnv = require('../../../config/env')
const OTRequest = require('../models/OTRequest')
const {
  calculateRawWindowMinutes,
} = require('../services/otRequestSourceOfTruth.service')

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function s(value) {
  return String(value ?? '').trim()
}

function minutesLabel(minutes) {
  const total = Math.max(0, Math.round(n(minutes)))
  const hours = Math.floor(total / 60)
  const mins = total % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`
  if (mins) return `${mins}m`

  return '0h'
}

function getPaidMinutes(value = {}) {
  return n(value.totalRequestPaidMinutes ?? value.totalMinutes)
}

function auditEmployeeCollection({
  requestNo,
  collectionName,
  employees = [],
  errors,
}) {
  for (const employee of Array.isArray(employees) ? employees : []) {
    const startTime = s(employee.startTime)
    const endTime = s(employee.endTime)
    const breakMinutes = n(employee.breakMinutes)
    const paidMinutes = getPaidMinutes(employee)

    if (!startTime || !endTime) continue

    const rawMinutes = calculateRawWindowMinutes(startTime, endTime)
    const expectedPaidMinutes = Math.max(0, rawMinutes - breakMinutes)

    if (paidMinutes !== expectedPaidMinutes) {
      errors.push({
        requestNo,
        collectionName,
        employeeId: s(employee.employeeId),
        employeeCode: s(employee.employeeCode),
        employeeName: s(employee.employeeName),
        startTime,
        endTime,
        rawMinutes,
        breakMinutes,
        expectedPaidMinutes,
        actualPaidMinutes: paidMinutes,
      })
    }
  }
}

async function main() {
  const mongoUri = appEnv.mongoUri

  if (!mongoUri) {
    throw new Error('mongoUri is required from backend/src/config/env.js')
  }

  await mongoose.connect(mongoUri)

  const requests = await OTRequest.find({})
    .select({
      requestNo: 1,
      otDate: 1,
      startTime: 1,
      endTime: 1,
      breakMinutes: 1,
      totalRequestPaidMinutes: 1,
      totalMinutes: 1,
      requestedEmployees: 1,
      approvedEmployees: 1,
      createdAt: 1,
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  const errors = []

  for (const request of requests) {
    const requestNo = s(request.requestNo)
    const startTime = s(request.startTime)
    const endTime = s(request.endTime)
    const breakMinutes = n(request.breakMinutes)
    const paidMinutes = getPaidMinutes(request)

    if (startTime && endTime) {
      const rawMinutes = calculateRawWindowMinutes(startTime, endTime)
      const expectedPaidMinutes = Math.max(0, rawMinutes - breakMinutes)

      if (paidMinutes !== expectedPaidMinutes) {
        errors.push({
          requestNo,
          collectionName: 'requestRoot',
          employeeId: '',
          employeeCode: '',
          employeeName: '',
          startTime,
          endTime,
          rawMinutes,
          breakMinutes,
          expectedPaidMinutes,
          actualPaidMinutes: paidMinutes,
        })
      }
    }

    auditEmployeeCollection({
      requestNo,
      collectionName: 'requestedEmployees',
      employees: request.requestedEmployees,
      errors,
    })

    auditEmployeeCollection({
      requestNo,
      collectionName: 'approvedEmployees',
      employees: request.approvedEmployees,
      errors,
    })

  }

  if (errors.length) {
    console.error('\n❌ OT saved-data audit failed.\n')

    for (const error of errors.slice(0, 30)) {
      console.error(
        [
          `Request: ${error.requestNo}`,
          `Area: ${error.collectionName}`,
          error.employeeCode || error.employeeName
            ? `Employee: ${error.employeeCode} ${error.employeeName}`
            : '',
          `Time: ${error.startTime} → ${error.endTime}`,
          `Raw: ${minutesLabel(error.rawMinutes)}`,
          `Break: ${minutesLabel(error.breakMinutes)}`,
          `Expected paid: ${minutesLabel(error.expectedPaidMinutes)}`,
          `Actual paid: ${minutesLabel(error.actualPaidMinutes)}`,
        ]
          .filter(Boolean)
          .join(' | '),
      )
    }

    console.error(`\nTotal errors: ${errors.length}`)
    process.exit(1)
  }

  console.log('\n✅ OT saved-data audit passed.')
  console.log(`Checked latest ${requests.length} OT requests.`)
}

main()
  .catch((error) => {
    console.error('\n❌ OT saved-data audit crashed.')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await mongoose.disconnect()
  })