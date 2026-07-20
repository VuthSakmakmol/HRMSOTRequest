// backend/src/modules/org/models/Employee.js

const mongoose = require('mongoose')

const { Schema } = mongoose

function s(value) {
  return String(value ?? '').trim()
}

function sameId(a, b) {
  const aa = s(a)
  const bb = s(b)

  return aa !== '' && aa === bb
}

function uniqueObjectIdStrings(values = []) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

const employeeSchema = new Schema(
  {
    employeeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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

    // Primary / legacy line.
    // Keep this for old code compatibility.
    lineId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionLine',
      default: null,
      index: true,
    },

    // New: employee can belong to / manage multiple lines.
    // Example: FM can manage LINE-01, LINE-02, LINE-03.
    lineIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductionLine',
        index: true,
      },
    ],

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

    lineManagerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Employee',
        index: true,
      },
    ],

    isOTEligible: {
      type: Boolean,
      default: true,
      index: true,
    },

    otWorkflowRole: {
      type: String,
      enum: ['NONE', 'APPROVER', 'ACKNOWLEDGE'],
      default: 'NONE',
      uppercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 30,
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

employeeSchema.pre('validate', function normalize(next) {
  this.employeeCode = s(this.employeeCode).toUpperCase()
  this.displayName = s(this.displayName)
  this.phone = s(this.phone)
  this.otWorkflowRole = s(this.otWorkflowRole || 'NONE').toUpperCase()

  this.lineIds = uniqueObjectIdStrings(this.lineIds)

  if (!this.lineId) {
    this.lineId = null
  }

  // Backward compatibility:
  // old employee has lineId only.
  if (this.lineId && !this.lineIds.includes(s(this.lineId))) {
    this.lineIds = [s(this.lineId), ...this.lineIds]
  }

  // New frontend can send lineIds only.
  // lineId remains first/primary line.
  if (!this.lineId && this.lineIds.length) {
    this.lineId = this.lineIds[0]
  }

  this.lineIds = uniqueObjectIdStrings(this.lineIds)

  if (!this.reportsToEmployeeId) {
    this.reportsToEmployeeId = null
  }

  if (this.reportsToEmployeeId && sameId(this._id, this.reportsToEmployeeId)) {
    const error = new Error('org.employee.error.reportToSelf')
    error.statusCode = 400
    error.code = 'EMPLOYEE_REPORT_TO_SELF'
    error.messageKey = 'org.employee.error.reportToSelf'
    return next(error)
  }

  this.lineManagerIds = uniqueObjectIdStrings(this.lineManagerIds).filter(
    (employeeId) => !sameId(this._id, employeeId),
  )

  next()
})

employeeSchema.index(
  { employeeCode: 1 },
  {
    unique: true,
  },
)

employeeSchema.index({ displayName: 'text', employeeCode: 'text' })
employeeSchema.index({ departmentId: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ departmentId: 1, lineId: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ departmentId: 1, lineIds: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ lineId: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ lineIds: 1, positionId: 1, isActive: 1 })
employeeSchema.index({ shiftId: 1, isActive: 1 })
employeeSchema.index({ reportsToEmployeeId: 1, isActive: 1 })
employeeSchema.index({ lineManagerIds: 1, isActive: 1 })
employeeSchema.index({ isOTEligible: 1, isActive: 1 })
employeeSchema.index({ otWorkflowRole: 1, isActive: 1 })
employeeSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Employee', employeeSchema)