// backend/src/modules/access/models/SystemRole.js

const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

function uniqueObjectIds(values = []) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

const systemRoleSchema = new mongoose.Schema(
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
  {
    timestamps: true,
    versionKey: false,
  },
)

systemRoleSchema.index({ isActive: 1, code: 1 })

systemRoleSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.displayName = s(this.displayName)
  this.permissionIds = uniqueObjectIds(this.permissionIds)

  next()
})

module.exports = mongoose.model('SystemRole', systemRoleSchema)