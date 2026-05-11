// backend/src/modules/org/models/Position.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const POSITION_HIERARCHY_SCOPE = ['SAME_LINE', 'GLOBAL', 'CROSS_DEPARTMENT']

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safeNonNegativeInt(value, fallback = 0) {
  const num = Math.round(safeNumber(value, fallback))
  return num < 0 ? fallback : num
}

const positionSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 50,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },

    departmentCode: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },

    departmentName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    reportsToPositionId: {
      type: Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
      index: true,
    },

    reportsToPositionCode: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },

    reportsToPositionName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    hierarchyScope: {
      type: String,
      enum: POSITION_HIERARCHY_SCOPE,
      default: 'SAME_LINE',
      trim: true,
      uppercase: true,
      index: true,
    },

    level: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
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
      maxlength: 100,
    },

    updatedBy: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

positionSchema.pre('validate', function normalize(next) {
  this.code = upper(this.code)
  this.name = s(this.name)
  this.description = s(this.description)

  this.departmentCode = upper(this.departmentCode)
  this.departmentName = s(this.departmentName)

  this.reportsToPositionCode = upper(this.reportsToPositionCode)
  this.reportsToPositionName = s(this.reportsToPositionName)

  this.hierarchyScope = upper(this.hierarchyScope || 'SAME_LINE')
  this.level = safeNonNegativeInt(this.level, 0)

  this.createdBy = s(this.createdBy)
  this.updatedBy = s(this.updatedBy)

  next()
})

positionSchema.index({ isActive: 1, code: 1 })
positionSchema.index({ departmentId: 1, isActive: 1, name: 1 })
positionSchema.index({ departmentCode: 1, isActive: 1 })
positionSchema.index({ reportsToPositionId: 1, isActive: 1 })
positionSchema.index({ reportsToPositionCode: 1, isActive: 1 })
positionSchema.index({ hierarchyScope: 1, isActive: 1 })
positionSchema.index({ level: 1, name: 1 })
positionSchema.index({ createdAt: -1 })
positionSchema.index({ updatedAt: -1 })

module.exports = mongoose.model('Position', positionSchema)