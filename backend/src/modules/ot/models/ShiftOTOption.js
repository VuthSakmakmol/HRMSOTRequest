// backend/src/modules/ot/models/ShiftOTOption.js
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
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
  this.requestedMinutes = Number(this.requestedMinutes || 0)
  this.sequence = Number(this.sequence || 0)

  if (!Number.isInteger(this.requestedMinutes) || this.requestedMinutes < 1) {
    return next(new Error('requestedMinutes must be a positive integer'))
  }

  if (!Number.isInteger(this.sequence) || this.sequence < 1) {
    return next(new Error('sequence must be a positive integer'))
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
ShiftOTOptionSchema.index({ createdAt: -1 })

module.exports = mongoose.model('ShiftOTOption', ShiftOTOptionSchema)