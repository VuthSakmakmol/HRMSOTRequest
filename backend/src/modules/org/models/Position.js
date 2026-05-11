// backend/src/modules/org/models/Position.js

const mongoose = require('mongoose')

const { Schema } = mongoose

function s(value) {
  return String(value ?? '').trim()
}

const positionSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },

    // Real relationship key: Position _id.
    // Cross-department reporting is allowed.
    reportsToPositionId: {
      type: Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
      index: true,
    },

    // SAME_LINE:
    //   Employee manager is resolved by parent position + same department + same line.
    //
    // GLOBAL:
    //   Employee manager is resolved by parent position across departments/lines.
    managerScope: {
      type: String,
      enum: ['SAME_LINE', 'GLOBAL'],
      default: 'SAME_LINE',
      uppercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
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

positionSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.description = s(this.description)
  this.managerScope = s(this.managerScope || 'SAME_LINE').toUpperCase()

  if (!this.reportsToPositionId) {
    this.reportsToPositionId = null
  }

  next()
})

positionSchema.index(
  {
    departmentId: 1,
    code: 1,
  },
  {
    unique: true,
  },
)

positionSchema.index({ departmentId: 1, name: 1 })
positionSchema.index({ reportsToPositionId: 1, isActive: 1 })
positionSchema.index({ isActive: 1, code: 1 })
positionSchema.index({ name: 'text', code: 'text', description: 'text' })

module.exports = mongoose.model('Position', positionSchema)