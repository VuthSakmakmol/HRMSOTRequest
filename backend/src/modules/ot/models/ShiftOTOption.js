// backend/src/modules/ot/models/ShiftOTOption.js
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const SHIFT_OT_OPTION_TIMING_MODES = ['AFTER_SHIFT_END', 'FIXED_TIME']
const SHIFT_OT_OPTION_DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

function normalizeApplicableDayTypes(value) {
  const source = Array.isArray(value) ? value : ['WORKING_DAY']

  const normalized = Array.from(
    new Set(
      source
        .map((item) => s(item).toUpperCase())
        .filter((item) => SHIFT_OT_OPTION_DAY_TYPES.includes(item)),
    ),
  )

  return normalized.length ? normalized : ['WORKING_DAY']
}

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

    applicableDayTypes: {
      type: [String],
      enum: SHIFT_OT_OPTION_DAY_TYPES,
      required: true,
      default: ['WORKING_DAY'],
      index: true,
    },

    startAfterShiftEndMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

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
  this.applicableDayTypes = normalizeApplicableDayTypes(this.applicableDayTypes)

  this.fixedStartTime = s(this.fixedStartTime)
  this.fixedEndTime = s(this.fixedEndTime)

  this.requestedMinutes = Number(this.requestedMinutes || 0)
  this.sequence = Number(this.sequence || 0)
  this.startAfterShiftEndMinutes = Number(this.startAfterShiftEndMinutes || 0)

  if (!SHIFT_OT_OPTION_TIMING_MODES.includes(this.timingMode)) {
    return next(new Error('timingMode must be AFTER_SHIFT_END or FIXED_TIME'))
  }

  if (!this.applicableDayTypes.length) {
    return next(new Error('applicableDayTypes must contain at least one day type'))
  }

  for (const dayType of this.applicableDayTypes) {
    if (!SHIFT_OT_OPTION_DAY_TYPES.includes(dayType)) {
      return next(
        new Error('applicableDayTypes must contain only WORKING_DAY, SUNDAY, or HOLIDAY'),
      )
    }
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
  { shiftId: 1, applicableDayTypes: 1, sequence: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
)

ShiftOTOptionSchema.index({
  shiftId: 1,
  applicableDayTypes: 1,
  isActive: 1,
  sequence: 1,
})

ShiftOTOptionSchema.index({ shiftId: 1, isActive: 1, sequence: 1 })
ShiftOTOptionSchema.index({ calculationPolicyId: 1, isActive: 1 })
ShiftOTOptionSchema.index({ timingMode: 1, isActive: 1 })
ShiftOTOptionSchema.index({ applicableDayTypes: 1, isActive: 1 })
ShiftOTOptionSchema.index({ createdAt: -1 })

const ShiftOTOption = mongoose.model('ShiftOTOption', ShiftOTOptionSchema)

module.exports = ShiftOTOption
module.exports.SHIFT_OT_OPTION_TIMING_MODES = SHIFT_OT_OPTION_TIMING_MODES
module.exports.SHIFT_OT_OPTION_DAY_TYPES = SHIFT_OT_OPTION_DAY_TYPES
