// backend/src/modules/ot/models/OTCalculationPolicy.js
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const ROUND_METHODS = ['FLOOR', 'CEIL', 'NEAREST']

const OTCalculationPolicySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    minEligibleMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    roundUnitMinutes: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },

    roundMethod: {
      type: String,
      required: true,
      enum: ROUND_METHODS,
      default: 'CEIL',
      uppercase: true,
      trim: true,
    },

    graceAfterShiftEndMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    allowPreShiftOT: {
      type: Boolean,
      required: true,
      default: false,
    },

    allowPostShiftOT: {
      type: Boolean,
      required: true,
      default: true,
    },

    capByRequestedMinutes: {
      type: Boolean,
      required: true,
      default: true,
    },

    treatForgetScanInAsPending: {
      type: Boolean,
      required: true,
      default: true,
    },

    treatForgetScanOutAsPending: {
      type: Boolean,
      required: true,
      default: true,
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

OTCalculationPolicySchema.pre('validate', function preValidate(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.description = s(this.description)
  this.roundMethod = s(this.roundMethod).toUpperCase()

  this.minEligibleMinutes = Number(this.minEligibleMinutes || 0)
  this.roundUnitMinutes = Number(this.roundUnitMinutes || 0)
  this.graceAfterShiftEndMinutes = Number(this.graceAfterShiftEndMinutes || 0)

  if (!Number.isInteger(this.minEligibleMinutes) || this.minEligibleMinutes < 0) {
    return next(new Error('minEligibleMinutes must be a non-negative integer'))
  }

  if (!Number.isInteger(this.roundUnitMinutes) || this.roundUnitMinutes < 1) {
    return next(new Error('roundUnitMinutes must be a positive integer'))
  }

  if (!Number.isInteger(this.graceAfterShiftEndMinutes) || this.graceAfterShiftEndMinutes < 0) {
    return next(new Error('graceAfterShiftEndMinutes must be a non-negative integer'))
  }

  next()
})

OTCalculationPolicySchema.index({ isActive: 1, name: 1 })
OTCalculationPolicySchema.index({ createdAt: -1 })

module.exports = mongoose.model('OTCalculationPolicy', OTCalculationPolicySchema)