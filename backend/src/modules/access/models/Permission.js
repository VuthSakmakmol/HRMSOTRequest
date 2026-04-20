// backend/src/modules/org/models/Permission.js
const mongoose = require('mongoose')

const permissionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
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

permissionSchema.index({ code: 1 }, { unique: true })
permissionSchema.index({ module: 1, name: 1 })
permissionSchema.index({ module: 1, isActive: 1 })

permissionSchema.pre('validate', function normalize(next) {
  if (this.code) this.code = String(this.code).trim().toUpperCase()
  if (this.module) this.module = String(this.module).trim().toUpperCase()
  if (this.name) this.name = String(this.name).trim()
  if (this.description != null) this.description = String(this.description).trim()
  next()
})

module.exports = mongoose.model('Permission', permissionSchema)