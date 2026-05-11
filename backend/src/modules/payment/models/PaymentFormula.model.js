// backend/src/modules/payment/models/PaymentFormula.model.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const SALARY_BASIS = ['MONTHLY_SALARY']
const DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

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

    roundingDecimals: {
      type: Number,
      min: 0,
      max: 6,
      default: 2,
    },

    currency: {
      type: String,
      default: 'USD',
      trim: true,
      maxlength: 10,
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

  next()
})

// Keep indexes here only. Do not duplicate with inline index:true.
PaymentFormulaSchema.index({ code: 1 }, { unique: true })
PaymentFormulaSchema.index({ name: 1 })
PaymentFormulaSchema.index({ isActive: 1, name: 1 })
PaymentFormulaSchema.index({ createdAt: -1 })
PaymentFormulaSchema.index({ updatedAt: -1 })

module.exports = mongoose.model('PaymentFormula', PaymentFormulaSchema)