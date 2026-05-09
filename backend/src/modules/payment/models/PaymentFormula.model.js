// backend/src/modules/payment/models/PaymentFormula.model.js

const mongoose = require('mongoose')

const DayTypeMultiplierSchema = new mongoose.Schema(
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
  { _id: false }
)

const PaymentFormulaSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    salaryBasis: {
      type: String,
      enum: ['MONTHLY_SALARY'],
      default: 'MONTHLY_SALARY',
      required: true,
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
      trim: true,
      uppercase: true,
      default: 'USD',
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: String,
      trim: true,
      default: '',
    },

    updatedBy: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

PaymentFormulaSchema.index({ name: 1 })
PaymentFormulaSchema.index({ isActive: 1, name: 1 })

module.exports = mongoose.model('PaymentFormula', PaymentFormulaSchema)