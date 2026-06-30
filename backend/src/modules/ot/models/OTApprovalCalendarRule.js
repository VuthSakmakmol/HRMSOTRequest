// backend/src/modules/ot/models/OTApprovalCalendarRule.js

const mongoose = require('mongoose')

const OT_APPROVAL_CALENDAR_ROLES = [
  'USE_DEFAULT',
  'SKIP',
  'APPROVER',
  'FINAL_APPROVER',
  'ACKNOWLEDGE',
]

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

const OTApprovalCalendarRuleSchema = new mongoose.Schema(
  {
    // One record per employee. The same employee can have a different workflow
    // role for a normal working day, Sunday, and an official holiday.
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      unique: true,
      index: true,
    },

    // Display snapshots keep the configuration readable even if employee names
    // later change. The service refreshes these snapshots on every save.
    employeeCode: {
      type: String,
      trim: true,
      default: '',
    },

    employeeName: {
      type: String,
      trim: true,
      default: '',
    },

    workingDayRole: {
      type: String,
      enum: OT_APPROVAL_CALENDAR_ROLES,
      default: 'USE_DEFAULT',
      trim: true,
      uppercase: true,
    },

    sundayRole: {
      type: String,
      enum: OT_APPROVAL_CALENDAR_ROLES,
      default: 'USE_DEFAULT',
      trim: true,
      uppercase: true,
    },

    holidayRole: {
      type: String,
      enum: OT_APPROVAL_CALENDAR_ROLES,
      default: 'USE_DEFAULT',
      trim: true,
      uppercase: true,
    },

    isActive: {
      type: Boolean,
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

OTApprovalCalendarRuleSchema.pre('validate', function normalize(next) {
  this.employeeCode = s(this.employeeCode)
  this.employeeName = s(this.employeeName)

  for (const field of ['workingDayRole', 'sundayRole', 'holidayRole']) {
    const value = upper(this[field] || 'USE_DEFAULT')
    this[field] = OT_APPROVAL_CALENDAR_ROLES.includes(value)
      ? value
      : 'USE_DEFAULT'
  }

  next()
})

const OTApprovalCalendarRule =
  mongoose.models.OTApprovalCalendarRule ||
  mongoose.model('OTApprovalCalendarRule', OTApprovalCalendarRuleSchema)

module.exports = OTApprovalCalendarRule
module.exports.OT_APPROVAL_CALENDAR_ROLES = OT_APPROVAL_CALENDAR_ROLES
