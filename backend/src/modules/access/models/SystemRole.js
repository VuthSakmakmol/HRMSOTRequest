// backend/src/modules/org/models/SystemRole.js
const mongoose = require('mongoose')

function s(v) {
  return String(v ?? '').trim()
}

const SystemRoleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    permissionIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Permission',
        },
      ],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
)

SystemRoleSchema.pre('validate', function (next) {
  this.code = s(this.code).toUpperCase()
  this.displayName = s(this.displayName)

  this.permissionIds = Array.isArray(this.permissionIds)
    ? [...new Set(this.permissionIds.map((v) => s(v)).filter(Boolean))]
    : []

  next()
})

module.exports = mongoose.model('SystemRole', SystemRoleSchema)