// backend/src/modules/payment/models/PaymentAllowancePolicy.model.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const ALLOWANCE_TYPES = ['FOOD', 'TRANSPORT', 'NIGHT', 'HOLIDAY', 'OTHER']
const TRIGGER_TYPES = ['OT_MINUTES']
const CURRENCIES = ['KHR', 'USD']
const APPLY_PER_OPTIONS = ['EMPLOYEE_PER_DAY', 'EMPLOYEE_PER_REQUEST']

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

const paymentAllowancePolicySchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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

    allowanceType: {
      type: String,
      enum: ALLOWANCE_TYPES,
      default: 'FOOD',
      uppercase: true,
      trim: true,
    },

    triggerType: {
      type: String,
      enum: TRIGGER_TYPES,
      default: 'OT_MINUTES',
      uppercase: true,
      trim: true,
    },

    minOtMinutes: {
      type: Number,
      default: 180,
      min: 1,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      enum: CURRENCIES,
      default: 'KHR',
      uppercase: true,
      trim: true,
    },

    applyPer: {
      type: String,
      enum: APPLY_PER_OPTIONS,
      default: 'EMPLOYEE_PER_DAY',
      uppercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },

    updatedBy: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

paymentAllowancePolicySchema.index({ code: 1 }, { unique: true })
paymentAllowancePolicySchema.index({
  isActive: 1,
  allowanceType: 1,
  triggerType: 1,
})
paymentAllowancePolicySchema.index({
  effectiveFrom: 1,
  effectiveTo: 1,
})

paymentAllowancePolicySchema.pre('validate', function normalize(next) {
  this.code = upper(this.code)
  this.name = s(this.name)
  this.description = s(this.description)

  this.allowanceType = upper(this.allowanceType || 'FOOD')
  this.triggerType = upper(this.triggerType || 'OT_MINUTES')
  this.currency = upper(this.currency || 'KHR')
  this.applyPer = upper(this.applyPer || 'EMPLOYEE_PER_DAY')

  next()
})

module.exports =
  mongoose.models.PaymentAllowancePolicy ||
  mongoose.model('PaymentAllowancePolicy', paymentAllowancePolicySchema)