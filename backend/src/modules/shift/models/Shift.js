// backend/src/modules/shift/models/Shift.js

const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

function isValidHHmm(value) {
  return HHMM_REGEX.test(String(value || ''))
}

function toMinutes(value) {
  if (!isValidHHmm(value)) return null

  const [hours, minutes] = String(value).split(':').map(Number)

  return hours * 60 + minutes
}

const shiftSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
      unique: true,
      index: true,
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
    versionKey: false,
  },
)

shiftSchema.index({ type: 1, isActive: 1 })
shiftSchema.index({ name: 'text', code: 'text' })

shiftSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.type = s(this.type).toUpperCase()
  this.startTime = s(this.startTime)
  this.breakStartTime = s(this.breakStartTime)
  this.breakEndTime = s(this.breakEndTime)
  this.endTime = s(this.endTime)

  if (
    isValidHHmm(this.startTime) &&
    isValidHHmm(this.endTime)
  ) {
    const startMinutes = toMinutes(this.startTime)
    const endMinutes = toMinutes(this.endTime)

    this.crossMidnight = endMinutes <= startMinutes
  }

  next()
})

module.exports = mongoose.model('Shift', shiftSchema)