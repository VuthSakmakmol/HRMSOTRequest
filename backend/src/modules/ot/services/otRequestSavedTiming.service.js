// backend/src/modules/ot/services/otRequestSavedTiming.service.js

const mongoose = require('mongoose')

const OTRequest = require('../models/OTRequest')
const {
  calculateRawWindowMinutes,
} = require('./otRequestSourceOfTruth.service')

function s(value) {
  return String(value ?? '').trim()
}

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function round2(value) {
  return Math.round(n(value) * 100) / 100
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function getRequestId(input) {
  return s(input?._id || input?.id || input)
}

function getPaidMinutes(row = {}) {
  return Math.max(
    0,
    n(row.totalRequestPaidMinutes),
    n(row.totalMinutes),
    n(row.requestedMinutes),
  )
}

function normalizePaidTimingFields(row = {}) {
  const startTime = s(row.startTime || row.requestStartTime)
  const endTime = s(row.endTime || row.requestEndTime)
  const breakMinutes = n(row.breakMinutes)

  if (!startTime || !endTime) {
    return {
      changed: false,
      row,
    }
  }

  const rawMinutes = calculateRawWindowMinutes(startTime, endTime)
  const paidMinutes = Math.max(0, rawMinutes - breakMinutes)
  const totalHours = round2(paidMinutes / 60)

  const nextRow = {
    ...row,

    startTime,
    endTime,

    requestStartTime: startTime,
    requestEndTime: endTime,

    breakMinutes,
    requestedMinutes: rawMinutes,

    totalRequestPaidMinutes: paidMinutes,
    totalMinutes: paidMinutes,
    totalHours,
  }

  return {
    changed:
      getPaidMinutes(row) !== paidMinutes ||
      n(row.requestedMinutes) !== rawMinutes ||
      n(row.totalHours) !== totalHours ||
      s(row.startTime) !== startTime ||
      s(row.endTime) !== endTime,
    row: nextRow,
  }
}

function normalizeEmployeeCollection(rows = []) {
  let changed = false

  const items = (Array.isArray(rows) ? rows : []).map((row) => {
    const result = normalizePaidTimingFields(row)

    if (result.changed) {
      changed = true
    }

    return result.row
  })

  return {
    changed,
    items,
  }
}

async function normalizeSavedOTRequestTiming(input) {
  const requestId = getRequestId(input)

  if (!requestId || !isObjectId(requestId)) {
    return input
  }

  const doc = await OTRequest.findById(requestId).lean()

  if (!doc) {
    return input
  }

  const patch = {}

  const rootTiming = normalizePaidTimingFields(doc)

  if (rootTiming.changed) {
    patch.startTime = rootTiming.row.startTime
    patch.endTime = rootTiming.row.endTime
    patch.requestStartTime = rootTiming.row.requestStartTime
    patch.requestEndTime = rootTiming.row.requestEndTime
    patch.breakMinutes = rootTiming.row.breakMinutes
    patch.requestedMinutes = rootTiming.row.requestedMinutes
    patch.totalRequestPaidMinutes = rootTiming.row.totalRequestPaidMinutes
    patch.totalMinutes = rootTiming.row.totalMinutes
    patch.totalHours = rootTiming.row.totalHours
  }

  const requestedEmployees = normalizeEmployeeCollection(doc.requestedEmployees)

  if (requestedEmployees.changed) {
    patch.requestedEmployees = requestedEmployees.items
  }

  const approvedEmployees = normalizeEmployeeCollection(doc.approvedEmployees)

  if (approvedEmployees.changed) {
    patch.approvedEmployees = approvedEmployees.items
  }


  if (Object.keys(patch).length) {
    await OTRequest.updateOne(
      { _id: doc._id },
      {
        $set: patch,
      },
    )
  }

  return OTRequest.findById(requestId).lean()
}

module.exports = {
  normalizeSavedOTRequestTiming,
}