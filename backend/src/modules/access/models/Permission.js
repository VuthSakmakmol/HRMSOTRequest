// backend/src/modules/access/models/Permission.js

const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const permissionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    module: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
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

permissionSchema.index({ module: 1, code: 1 })
permissionSchema.index({ module: 1, isActive: 1 })

permissionSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.module = s(this.module).toUpperCase()
  this.description = s(this.description)

  next()
})

module.exports = mongoose.model('Permission', permissionSchema)