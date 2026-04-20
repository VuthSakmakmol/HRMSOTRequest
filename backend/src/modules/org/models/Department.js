// backend/src/modules/org/models/Department.js
const mongoose = require('mongoose')

const DepartmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 30,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

DepartmentSchema.pre('validate', function (next) {
  if (this.code) this.code = String(this.code).trim().toUpperCase()
  if (this.name) this.name = String(this.name).trim()
  if (typeof this.description === 'string') {
    this.description = this.description.trim()
  }
  next()
})

DepartmentSchema.index({ code: 1 }, { unique: true })
DepartmentSchema.index({ name: 1 })

DepartmentSchema.virtual('positions', {
  ref: 'Position',
  localField: '_id',
  foreignField: 'departmentId',
  justOne: false,
})

module.exports = mongoose.model('Department', DepartmentSchema)