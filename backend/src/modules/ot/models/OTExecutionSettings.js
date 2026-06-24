// backend/src/modules/ot/models/OTExecutionSettings.js

const mongoose = require('mongoose')

const TIME_24_HOUR_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const OTExecutionSettingsSchema = new mongoose.Schema(
  {
    // This module intentionally has exactly one global document.
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'GLOBAL',
      trim: true,
      uppercase: true,
    },

    // A manual emergency switch. When false, no new OT request or OT edit can be saved.
    requestSubmissionOpen: {
      type: Boolean,
      default: true,
    },

    // Optional recurring daily hours. It only applies while requestSubmissionOpen is true.
    // Example: 08:00 -> 17:30 means requests are allowed every day within those hours.
    requestDailyTimeLimitEnabled: {
      type: Boolean,
      default: false,
    },

    requestDailyStartTime: {
      type: String,
      default: null,
      trim: true,
      match: TIME_24_HOUR_PATTERN,
    },

    requestDailyEndTime: {
      type: String,
      default: null,
      trim: true,
      match: TIME_24_HOUR_PATTERN,
    },

    // Controls only NEW OT requests whose selected OT date is before today in the
    // configured execution time zone. Editing an existing request is not blocked by
    // this setting, because it does not create a new historical request.
    // Default true preserves the current system behaviour after deployment.
    allowBackdatedRequests: {
      type: Boolean,
      default: true,
    },

    // Legacy fields from the earlier date-window version. They are retained only so an
    // update can safely remove them from existing MongoDB documents. They are never read
    // or used as access rules.
    requestWindowEnabled: {
      type: Boolean,
      default: undefined,
      select: false,
    },

    requestWindowStartAt: {
      type: Date,
      default: undefined,
      select: false,
    },

    requestWindowEndAt: {
      type: Date,
      default: undefined,
      select: false,
    },

    // false preserves the existing behaviour: payment can include pending OT.
    // true means only requests with status APPROVED are eligible for payment.
    paymentRequiresFinalApproval: {
      type: Boolean,
      default: false,
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

module.exports = mongoose.model('OTExecutionSettings', OTExecutionSettingsSchema)
