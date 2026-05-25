// backend/src/modules/notification/models/Notification.js

const mongoose = require('mongoose')

const {
  NOTIFICATION_MODULES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
} = require('../notification.constants')

const NotificationSchema = new mongoose.Schema(
  {
    recipientAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },

    recipientEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },

    actorAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },

    actorEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    module: {
      type: String,
      enum: Object.values(NOTIFICATION_MODULES),
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 160,
    },

    message: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },

    entityType: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    requestNo: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    routeName: {
      type: String,
      trim: true,
      default: '',
    },

    routePath: {
      type: String,
      trim: true,
      default: '',
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    channels: {
      type: [String],
      enum: Object.values(NOTIFICATION_CHANNELS),
      default: [NOTIFICATION_CHANNELS.IN_APP],
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    deliveredSocketAt: {
      type: Date,
      default: null,
    },

    deliveredTelegramAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

NotificationSchema.index({
  recipientAccountId: 1,
  isRead: 1,
  createdAt: -1,
})

NotificationSchema.index({
  recipientEmployeeId: 1,
  isRead: 1,
  createdAt: -1,
})

NotificationSchema.index({
  module: 1,
  type: 1,
  createdAt: -1,
})

NotificationSchema.index({
  entityType: 1,
  entityId: 1,
  createdAt: -1,
})

module.exports = mongoose.model('Notification', NotificationSchema)