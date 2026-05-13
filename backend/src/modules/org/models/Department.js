// backend/src/modules/org/models/Department.js

const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const departmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 30,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

departmentSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)

  next()
})

departmentSchema.index({ name: 1 })
departmentSchema.index({ isActive: 1, code: 1 })

departmentSchema.virtual('positions', {
  ref: 'Position',
  localField: '_id',
  foreignField: 'departmentId',
  justOne: false,
})

module.exports = mongoose.model('Department', departmentSchema)