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

  next()
})

AccountSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

AccountSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash)
}

module.exports = mongoose.model('Account', AccountSchema)