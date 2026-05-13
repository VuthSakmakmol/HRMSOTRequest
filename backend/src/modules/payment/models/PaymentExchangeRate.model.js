// backend/src/modules/payment/models/PaymentExchangeRate.model.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const ROUNDING_MODES = ['CEIL', 'FLOOR', 'ROUND', 'NONE']

const DEFAULT_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safePositiveNumber(value, fallback = 1) {
  const num = safeNumber(value, fallback)
  return num > 0 ? num : fallback
}

function normalizeRoundingMode(value) {
  const mode = upper(value)

  if (ROUNDING_MODES.includes(mode)) {
    return mode
  }

  return 'ROUND'
}

function normalizeDenominations(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_DENOMINATIONS

  return [
    ...new Set(
      source
        .map((item) => Math.round(safeNumber(item, 0)))
        .filter((item) => item > 0),
    ),
  ].sort((a, b) => b - a)
}

const PaymentExchangeRateSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    fromCurrency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10,
      default: 'USD',
    },

    toCurrency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10,
      default: 'KHR',
    },

    rate: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    roundingUnit: {
      type: Number,
      required: true,
      min: 1,
      default: 100,
    },

    roundingMode: {
      type: String,
      enum: ROUNDING_MODES,
      required: true,
      trim: true,
      default: 'ROUND',
    },

    denominations: {
      type: [Number],
      default: () => DEFAULT_DENOMINATIONS,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((item) => Number(item) > 0)
          )
        },
        message: 'At least one active denomination is required',
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },

    updatedBy: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

PaymentExchangeRateSchema.pre('validate', function preValidate(next) {
  this.code = upper(this.code)
  this.name = s(this.name)
  this.description = s(this.description)
  this.fromCurrency = upper(this.fromCurrency || 'USD')
  this.toCurrency = upper(this.toCurrency || 'KHR')
  this.rate = safePositiveNumber(this.rate, 1)
  this.roundingUnit = Math.round(safePositiveNumber(this.roundingUnit, 100))
  this.roundingMode = normalizeRoundingMode(this.roundingMode || 'ROUND')
  this.denominations = normalizeDenominations(this.denominations)
  this.createdBy = s(this.createdBy)
  this.updatedBy = s(this.updatedBy)

  next()
})

// Keep indexes here only. Do not duplicate with inline index:true.
PaymentExchangeRateSchema.index({ code: 1 }, { unique: true })
PaymentExchangeRateSchema.index({ name: 1 })
PaymentExchangeRateSchema.index({ isActive: 1, name: 1 })
PaymentExchangeRateSchema.index({ fromCurrency: 1, toCurrency: 1 })
PaymentExchangeRateSchema.index({ createdAt: -1 })
PaymentExchangeRateSchema.index({ updatedAt: -1 })

module.exports = mongoose.model('PaymentExchangeRate', PaymentExchangeRateSchema)