// backend/src/modules/org/models/Employee.js

const mongoose = require('mongoose')

const { Schema } = mongoose

function cleanString(v) {
  return String(v || '').trim()
}

function sameId(a, b) {
  return String(a || '') !== '' && String(a) === String(b || '')
}

const employeeSchema = new Schema(
  {
    employeeNo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },

    positionId: {
      type: Schema.Types.ObjectId,
      ref: 'Position',
      required: true,
      index: true,
    },

    lineId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionLine',
      default: null,
      index: true,
    },

    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
      index: true,
    },

    reportsToEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },

    phone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 30,
    },

    email: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
      lowercase: true,
    },

    joinDate: {
      type: Date,
      default: null,
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

employeeSchema.pre('validate', function preValidate(next) {
  this.employeeNo = cleanString(this.employeeNo).toUpperCase()
  this.displayName = cleanString(this.displayName)
  this.phone = cleanString(this.phone)
  this.email = cleanString(this.email).toLowerCase()

  if (!this.lineId) {
    this.lineId = null
  }

  if (!this.reportsToEmployeeId) {
    this.reportsToEmployeeId = null
  }

  if (this.reportsToEmployeeId && sameId(this._id, this.reportsToEmployeeId)) {
    const err = new Error('Employee cannot report to self')
    err.status = 400
    return next(err)
  }

  next()
})

employeeSchema.index(
  { employeeNo: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeNo: { $type: 'string' },
    },
  },
)

employeeSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: 'string', $ne: '' },
    },
  },
)

employeeSchema.index({ displayName: 'text', employeeNo: 'text', email: 'text' })

employeeSchema.index({ departmentId: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ departmentId: 1, lineId: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ lineId: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ shiftId: 1, isActive: 1 })
employeeSchema.index({ reportsToEmployeeId: 1, isActive: 1 })
employeeSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Employee', employeeSchema)