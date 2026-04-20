// backend/src/modules/org/models/Position.js
const mongoose = require('mongoose')

const { Schema } = mongoose

function cleanString(v) {
  return String(v || '').trim()
}

const positionSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
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
  }
)

positionSchema.pre('validate', function preValidate(next) {
  this.code = cleanString(this.code).toUpperCase()
  this.name = cleanString(this.name)
  this.description = cleanString(this.description)
  next()
})

positionSchema.index(
  { departmentId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: {
      code: { $type: 'string' },
    },
  }
)

positionSchema.index({ departmentId: 1, name: 1 })
positionSchema.index({ name: 'text', code: 'text', description: 'text' })

module.exports = mongoose.model('Position', positionSchema)