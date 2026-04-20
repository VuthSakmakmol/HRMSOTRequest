// backend/src/modules/shift/models/Shift.js
const mongoose = require('mongoose')

function s(v) {
  return String(v ?? '').trim()
}

function isValidHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ''))
}

function toMinutes(value) {
  if (!isValidHHmm(value)) return null
  const [h, m] = String(value).split(':').map(Number)
  return h * 60 + m
}

const ShiftSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['DAY', 'NIGHT'],
      uppercase: true,
      trim: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    breakStartTime: {
      type: String,
      required: true,
      trim: true,
    },
    breakEndTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    crossMidnight: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

ShiftSchema.pre('validate', function shiftPreValidate(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.type = s(this.type).toUpperCase()
  this.startTime = s(this.startTime)
  this.breakStartTime = s(this.breakStartTime)
  this.breakEndTime = s(this.breakEndTime)
  this.endTime = s(this.endTime)

  if (!isValidHHmm(this.startTime)) {
    return next(new Error('Invalid startTime. Expected HH:mm'))
  }

  if (!isValidHHmm(this.breakStartTime)) {
    return next(new Error('Invalid breakStartTime. Expected HH:mm'))
  }

  if (!isValidHHmm(this.breakEndTime)) {
    return next(new Error('Invalid breakEndTime. Expected HH:mm'))
  }

  if (!isValidHHmm(this.endTime)) {
    return next(new Error('Invalid endTime. Expected HH:mm'))
  }

  const start = toMinutes(this.startTime)
  const end = toMinutes(this.endTime)

  this.crossMidnight = end <= start

  return next()
})

module.exports = mongoose.model('Shift', ShiftSchema)