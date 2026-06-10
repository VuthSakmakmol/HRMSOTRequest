// backend/src/modules/payment/models/PaymentFormula.model.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const SALARY_BASIS = ['MONTHLY_SALARY']
const DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const CASH_ROUNDING_MODES = ['CEIL', 'FLOOR', 'ROUND', 'NONE']
const DEFAULT_CASH_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]

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

function safeNonNegativeNumber(value, fallback = 0) {
  const num = safeNumber(value, fallback)
  return num >= 0 ? num : fallback
}

function normalizeCashRoundingMode(value) {
  const mode = upper(value)
  return CASH_ROUNDING_MODES.includes(mode) ? mode : 'ROUND'
}

function normalizeCashDenominations(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_CASH_DENOMINATIONS

  const normalized = [
    ...new Set(
      source
        .map((item) => Math.round(safeNumber(item, 0)))
        .filter((item) => item > 0),
    ),
  ].sort((a, b) => b - a)

  return normalized.length ? normalized : DEFAULT_CASH_DENOMINATIONS
}

function normalizeHourRules(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback

  const normalized = source
    .map((item, index) => {
      const minHours = safeNonNegativeNumber(item?.minHours, index === 0 ? 0 : index)
      const rawMaxHours = item?.maxHours
      const maxHours =
        rawMaxHours === null || rawMaxHours === undefined || rawMaxHours === ''
          ? null
          : safeNonNegativeNumber(rawMaxHours, 0)

      return {
        label: s(item?.label).slice(0, 120),
        minHours,
        maxHours: maxHours !== null && maxHours > minHours ? maxHours : null,
        multiplier: safeNonNegativeNumber(item?.multiplier, 1),
        allowanceEligible: item?.allowanceEligible === true,
      }
    })
    .filter((item) => item.multiplier >= 0)
    .sort((a, b) => a.minHours - b.minHours)

  return normalized
}

const DayTypeMultiplierSchema = new Schema(
  {
    WORKING_DAY: {
      type: Number,
      required: true,
      min: 0,
      default: 1.5,
    },

    SUNDAY: {
      type: Number,
      required: true,
      min: 0,
      default: 2,
    },

    HOLIDAY: {
      type: Number,
      required: true,
      min: 0,
      default: 3,
    },
  },
  {
    _id: false,
  },
)


const HourRuleSchema = new Schema(
  {
    label: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },

    // Inclusive lower bound. Example: minHours 3 means OT >= 3h.
    minHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Exclusive upper bound. Empty means no maximum.
    // Example: maxHours 5 means OT < 5h.
    maxHours: {
      type: Number,
      min: 0,
      default: null,
    },

    multiplier: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    allowanceEligible: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
)

const PaymentFormulaSchema = new Schema(
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

    salaryBasis: {
      type: String,
      enum: SALARY_BASIS,
      default: 'MONTHLY_SALARY',
      required: true,
      trim: true,
    },

    monthlyWorkingDays: {
      type: Number,
      required: true,
      min: 1,
      default: 26,
    },

    hoursPerDay: {
      type: Number,
      required: true,
      min: 1,
      default: 8,
    },

    multipliers: {
      type: DayTypeMultiplierSchema,
      required: true,
      default: () => ({
        WORKING_DAY: 1.5,
        SUNDAY: 2,
        HOLIDAY: 3,
      }),
    },

    hourRules: {
      type: [HourRuleSchema],
      default: () => [],
    },

    // USD/base-currency rounding before exchange.
    roundingDecimals: {
      type: Number,
      min: 0,
      max: 6,
      default: 2,
    },

    // Base salary currency, normally USD.
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      maxlength: 10,
    },

    // Final payout currency after manual exchange rate is applied.
    payoutCurrency: {
      type: String,
      default: 'KHR',
      trim: true,
      maxlength: 10,
    },

    // Cash rounding policy belongs to formula, not daily exchange rate.
    cashRoundingUnit: {
      type: Number,
      required: true,
      min: 1,
      default: 100,
    },

    cashRoundingMode: {
      type: String,
      enum: CASH_ROUNDING_MODES,
      required: true,
      trim: true,
      default: 'ROUND',
    },

    // Cash payout denomination policy belongs to formula.
    cashDenominations: {
      type: [Number],
      default: () => DEFAULT_CASH_DENOMINATIONS,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((item) => Number(item) > 0)
          )
        },
        message: 'At least one active cash denomination is required',
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

PaymentFormulaSchema.pre('validate', function preValidate(next) {
  this.code = upper(this.code)
  this.name = s(this.name)
  this.description = s(this.description)
  this.salaryBasis = upper(this.salaryBasis || 'MONTHLY_SALARY')

  this.monthlyWorkingDays = safePositiveNumber(this.monthlyWorkingDays, 26)
  this.hoursPerDay = safePositiveNumber(this.hoursPerDay, 8)

  this.roundingDecimals = Math.min(
    Math.max(Math.round(safeNonNegativeNumber(this.roundingDecimals, 2)), 0),
    6,
  )

  this.currency = upper(this.currency || 'USD')
  this.payoutCurrency = upper(this.payoutCurrency || 'KHR')

  this.cashRoundingUnit = Math.round(safePositiveNumber(this.cashRoundingUnit, 100))
  this.cashRoundingMode = normalizeCashRoundingMode(this.cashRoundingMode || 'ROUND')
  this.cashDenominations = normalizeCashDenominations(this.cashDenominations)

  this.createdBy = s(this.createdBy)
  this.updatedBy = s(this.updatedBy)

  const multipliers = this.multipliers || {}

  for (const dayType of DAY_TYPES) {
    multipliers[dayType] = safeNonNegativeNumber(
      multipliers[dayType],
      dayType === 'WORKING_DAY' ? 1.5 : dayType === 'SUNDAY' ? 2 : 3,
    )
  }

  this.multipliers = multipliers
  this.hourRules = normalizeHourRules(this.hourRules)

  next()
})

// Keep indexes here only. Do not duplicate with inline index:true.
PaymentFormulaSchema.index({ code: 1 }, { unique: true })
PaymentFormulaSchema.index({ name: 1 })
PaymentFormulaSchema.index({ isActive: 1, name: 1 })
PaymentFormulaSchema.index({ currency: 1, payoutCurrency: 1 })
PaymentFormulaSchema.index({ createdAt: -1 })
PaymentFormulaSchema.index({ updatedAt: -1 })

module.exports = mongoose.model('PaymentFormula', PaymentFormulaSchema)
module.exports.SALARY_BASIS = SALARY_BASIS
module.exports.DAY_TYPES = DAY_TYPES
module.exports.CASH_ROUNDING_MODES = CASH_ROUNDING_MODES
module.exports.DEFAULT_CASH_DENOMINATIONS = DEFAULT_CASH_DENOMINATIONS