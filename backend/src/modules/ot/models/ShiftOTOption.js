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

  const normalized = [
    ...new Set(
      source
        .map((item) => s(item).toUpperCase())
        .filter((item) => SHIFT_OT_OPTION_DAY_TYPES.includes(item)),
    ),
  ]

  return normalized.length ? normalized : ['WORKING_DAY']
}

const shiftOTOptionSchema = new mongoose.Schema(
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

shiftOTOptionSchema.pre('validate', function normalize(next) {
  this.label = s(this.label)
  this.timingMode = s(this.timingMode || 'AFTER_SHIFT_END').toUpperCase()
  this.applicableDayTypes = normalizeApplicableDayTypes(this.applicableDayTypes)

  this.fixedStartTime = s(this.fixedStartTime)
  this.fixedEndTime = s(this.fixedEndTime)

  this.startAfterShiftEndMinutes = Number(this.startAfterShiftEndMinutes || 0)
  this.requestedMinutes = Number(this.requestedMinutes || 0)
  this.sequence = Number(this.sequence || 0)

  if (!SHIFT_OT_OPTION_TIMING_MODES.includes(this.timingMode)) {
    return next(new Error('ot.shiftOption.validation.timingModeInvalid'))
  }

  if (!this.applicableDayTypes.length) {
    return next(new Error('ot.shiftOption.validation.applicableDayTypesRequired'))
  }

  if (!Number.isInteger(this.startAfterShiftEndMinutes) || this.startAfterShiftEndMinutes < 0) {
    return next(new Error('ot.shiftOption.validation.startAfterShiftEndMinutesInvalid'))
  }

  if (!Number.isInteger(this.requestedMinutes) || this.requestedMinutes < 1) {
    return next(new Error('ot.shiftOption.validation.requestedMinutesInvalid'))
  }

  if (!Number.isInteger(this.sequence) || this.sequence < 1) {
    return next(new Error('ot.shiftOption.validation.sequenceInvalid'))
  }

  if (this.timingMode === 'AFTER_SHIFT_END') {
    this.fixedStartTime = ''
    this.fixedEndTime = ''
  }

  if (this.timingMode === 'FIXED_TIME') {
    this.startAfterShiftEndMinutes = 0

    if (!HHMM_REGEX.test(this.fixedStartTime)) {
      return next(new Error('ot.shiftOption.validation.fixedStartTimeInvalid'))
    }

    if (!HHMM_REGEX.test(this.fixedEndTime)) {
      return next(new Error('ot.shiftOption.validation.fixedEndTimeInvalid'))
    }

    if (this.fixedStartTime === this.fixedEndTime) {
      return next(new Error('ot.shiftOption.validation.fixedTimeSame'))
    }
  }

  next()
})

shiftOTOptionSchema.index(
  {
    shiftId: 1,
    label: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
    },
  },
)

shiftOTOptionSchema.index(
  {
    shiftId: 1,
    applicableDayTypes: 1,
    sequence: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
    },
  },
)

shiftOTOptionSchema.index({ shiftId: 1, isActive: 1, sequence: 1 })
shiftOTOptionSchema.index({ shiftId: 1, applicableDayTypes: 1, isActive: 1, sequence: 1 })
shiftOTOptionSchema.index({ calculationPolicyId: 1, isActive: 1 })
shiftOTOptionSchema.index({ timingMode: 1, isActive: 1 })
shiftOTOptionSchema.index({ createdAt: -1 })

const ShiftOTOption =
  mongoose.models.ShiftOTOption ||
  mongoose.model('ShiftOTOption', shiftOTOptionSchema)

module.exports = ShiftOTOption
module.exports.SHIFT_OT_OPTION_TIMING_MODES = SHIFT_OT_OPTION_TIMING_MODES
module.exports.SHIFT_OT_OPTION_DAY_TYPES = SHIFT_OT_OPTION_DAY_TYPES