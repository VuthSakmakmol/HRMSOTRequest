// backend/src/modules/auth/models/Account.js

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

function s(value) {
  return String(value ?? '').trim()
}

function normalizePermissionCodes(values) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => s(value).toUpperCase())
        .filter(Boolean),
    ),
  ]
}

const AccountSchema = new mongoose.Schema(
  {
    loginId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },

    roleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SystemRole',
      },
    ],

    directPermissionCodes: {
      type: [String],
      default: [],
    },

    passwordVersion: {
      type: Number,
      default: 1,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Telegram notification channel.
    // Linked by secure one-time token from logged-in HRMS account.
    telegramChatId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    telegramUserId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    telegramUsername: {
      type: String,
      default: '',
      trim: true,
    },

    telegramFirstName: {
      type: String,
      default: '',
      trim: true,
    },

    telegramLastName: {
      type: String,
      default: '',
      trim: true,
    },

    telegramEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },

    telegramLinkedAt: {
      type: Date,
      default: null,
    },

    telegramLastMessageAt: {
      type: Date,
      default: null,
    },

    telegramLinkTokenHash: {
      type: String,
      default: '',
      trim: true,
      select: false,
      index: true,
    },

    telegramLinkTokenExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

AccountSchema.pre('validate', function normalize(next) {
  this.loginId = s(this.loginId).toLowerCase()
  this.displayName = s(this.displayName)

  if (!Array.isArray(this.roleIds)) {
    this.roleIds = []
  }

  this.directPermissionCodes = normalizePermissionCodes(this.directPermissionCodes)

  if (!this.passwordVersion || this.passwordVersion < 1) {
    this.passwordVersion = 1
  }

  this.telegramChatId = s(this.telegramChatId)
  this.telegramUserId = s(this.telegramUserId)
  this.telegramUsername = s(this.telegramUsername).replace(/^@+/, '')
  this.telegramFirstName = s(this.telegramFirstName)
  this.telegramLastName = s(this.telegramLastName)
  this.telegramLinkTokenHash = s(this.telegramLinkTokenHash)

  if (!this.telegramChatId) {
    this.telegramEnabled = false
  }

  next()
})

AccountSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

AccountSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash)
}

module.exports = mongoose.model('Account', AccountSchema)