// backend/src/modules/ot/models/ShiftOTOption.js
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const SHIFT_OT_OPTION_TIMING_MODES = ['AFTER_SHIFT_END', 'FIXED_TIME']
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const ShiftOTOptionSchema = new mongoose.Schema(
  {
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
      index: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    timingMode: {
      type: String,
      required: true,
      enum: SHIFT_OT_OPTION_TIMING_MODES,
      default: 'AFTER_SHIFT_END',
      uppercase: true,
      trim: true,
      index: true,
    },

    // For AFTER_SHIFT_END mode:
    // Shift ends 16:00 + 120 minutes = OT starts 18:00.
    startAfterShiftEndMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // For FIXED_TIME mode:
    // Useful for Sunday/Holiday OT, for example 08:00 - 17:00.
    fixedStartTime: {
      type: String,
      default: '',
      trim: true,
    },

    fixedEndTime: {
      type: String,
      default: '',
      trim: true,
    },

    requestedMinutes: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },

    calculationPolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OTCalculationPolicy',
      required: true,
      index: true,
    },

    sequence: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

ShiftOTOptionSchema.pre('validate', function preValidate(next) {
  this.label = s(this.label)
  this.timingMode = s(this.timingMode || 'AFTER_SHIFT_END').toUpperCase()
  this.fixedStartTime = s(this.fixedStartTime)
  this.fixedEndTime = s(this.fixedEndTime)

  this.requestedMinutes = Number(this.requestedMinutes || 0)
  this.sequence = Number(this.sequence || 0)
  this.startAfterShiftEndMinutes = Number(this.startAfterShiftEndMinutes || 0)

  if (!SHIFT_OT_OPTION_TIMING_MODES.includes(this.timingMode)) {
    return next(new Error('timingMode must be AFTER_SHIFT_END or FIXED_TIME'))
  }

  if (!Number.isInteger(this.requestedMinutes) || this.requestedMinutes < 1) {
    return next(new Error('requestedMinutes must be a positive integer'))
  }

  if (!Number.isInteger(this.sequence) || this.sequence < 1) {
    return next(new Error('sequence must be a positive integer'))
  }

  if (
    !Number.isInteger(this.startAfterShiftEndMinutes) ||
    this.startAfterShiftEndMinutes < 0
  ) {
    return next(new Error('startAfterShiftEndMinutes must be a non-negative integer'))
  }

  if (this.timingMode === 'AFTER_SHIFT_END') {
    this.fixedStartTime = ''
    this.fixedEndTime = ''
  }

  if (this.timingMode === 'FIXED_TIME') {
    if (!HHMM_REGEX.test(this.fixedStartTime)) {
      return next(new Error('fixedStartTime must be in HH:mm format'))
    }

    if (!HHMM_REGEX.test(this.fixedEndTime)) {
      return next(new Error('fixedEndTime must be in HH:mm format'))
    }

    if (this.fixedStartTime === this.fixedEndTime) {
      return next(new Error('fixedStartTime and fixedEndTime cannot be the same'))
    }

    this.startAfterShiftEndMinutes = 0
  }

  next()
})

ShiftOTOptionSchema.index(
  { shiftId: 1, label: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
)

ShiftOTOptionSchema.index(
  { shiftId: 1, sequence: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
)

ShiftOTOptionSchema.index({ shiftId: 1, isActive: 1, sequence: 1 })
ShiftOTOptionSchema.index({ calculationPolicyId: 1, isActive: 1 })
ShiftOTOptionSchema.index({ timingMode: 1, isActive: 1 })
ShiftOTOptionSchema.index({ createdAt: -1 })

const ShiftOTOption = mongoose.model('ShiftOTOption', ShiftOTOptionSchema)

module.exports = ShiftOTOption
module.exports.SHIFT_OT_OPTION_TIMING_MODES = SHIFT_OT_OPTION_TIMING_MODES