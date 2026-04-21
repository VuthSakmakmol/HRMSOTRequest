// backend/src/modules/ot/models/OTRequest.js
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const OT_STATUS = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']
const OT_DAY_TYPE = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const OT_APPROVAL_STEP_STATUS = ['WAITING', 'PENDING', 'APPROVED', 'REJECTED']

const OTRequestEmployeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    employeeCode: {
      type: String,
      trim: true,
      default: '',
    },

    employeeName: {
      type: String,
      trim: true,
      default: '',
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },

    departmentCode: {
      type: String,
      trim: true,
      default: '',
    },

    departmentName: {
      type: String,
      trim: true,
      default: '',
    },

    positionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
    },

    positionCode: {
      type: String,
      trim: true,
      default: '',
    },

    positionName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    _id: false,
    versionKey: false,
  }
)

const OTApprovalStepSchema = new mongoose.Schema(
  {
    stepNo: {
      type: Number,
      required: true,
      min: 1,
    },

    approverEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    approverCode: {
      type: String,
      trim: true,
      default: '',
    },

    approverName: {
      type: String,
      trim: true,
      default: '',
    },

    status: {
      type: String,
      enum: OT_APPROVAL_STEP_STATUS,
      required: true,
      default: 'WAITING',
    },

    actedAt: {
      type: Date,
      default: null,
    },

    actedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },

    remark: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
  },
  {
    _id: false,
    versionKey: false,
  }
)

const OTRequestSchema = new mongoose.Schema(
  {
    requestNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    requesterEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },

    requesterEmployeeNo: {
      type: String,
      trim: true,
      default: '',
    },

    requesterName: {
      type: String,
      trim: true,
      default: '',
    },

    employees: {
      type: [OTRequestEmployeeSchema],
      required: true,
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 1 && value.length <= 200
        },
        message: 'employees must contain 1 to 200 employees',
      },
    },

    employeeCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      index: true,
    },

    otDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    startTime: {
      type: String,
      required: true,
      trim: true,
    },

    endTime: {
      type: String,
      required: true,
      trim: true,
    },

    breakMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalMinutes: {
      type: Number,
      required: true,
      min: 0,
    },

    totalHours: {
      type: Number,
      required: true,
      min: 0,
    },

    dayType: {
      type: String,
      enum: OT_DAY_TYPE,
      required: true,
      index: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    approvalSteps: {
      type: [OTApprovalStepSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 1 && value.length <= 4
        },
        message: 'approvalSteps must contain 1 to 4 approvers',
      },
    },

    currentApprovalStep: {
      type: Number,
      default: 1,
      min: 1,
    },

    currentApproverEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },

    finalApproverEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: OT_STATUS,
      required: true,
      default: 'PENDING',
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
  }
)

OTRequestSchema.pre('validate', function normalizeFields(next) {
  this.requestNo = s(this.requestNo).toUpperCase()
  this.requesterEmployeeNo = s(this.requesterEmployeeNo)
  this.requesterName = s(this.requesterName)
  this.otDate = s(this.otDate)
  this.startTime = s(this.startTime)
  this.endTime = s(this.endTime)
  this.reason = s(this.reason)
  this.status = s(this.status).toUpperCase()
  this.dayType = s(this.dayType).toUpperCase()

  if (Array.isArray(this.employees)) {
    const seen = new Set()
    const normalizedEmployees = []

    for (const item of this.employees) {
      const employeeId = String(item?.employeeId || '')
      if (!employeeId) continue
      if (seen.has(employeeId)) continue
      seen.add(employeeId)

      normalizedEmployees.push({
        employeeId: item.employeeId,
        employeeCode: s(item.employeeCode),
        employeeName: s(item.employeeName),
        departmentId: item.departmentId || null,
        departmentCode: s(item.departmentCode),
        departmentName: s(item.departmentName),
        positionId: item.positionId || null,
        positionCode: s(item.positionCode),
        positionName: s(item.positionName),
      })
    }

    this.employees = normalizedEmployees
    this.employeeCount = normalizedEmployees.length
  }

  if (Array.isArray(this.approvalSteps)) {
    for (const step of this.approvalSteps) {
      step.approverCode = s(step.approverCode)
      step.approverName = s(step.approverName)
      step.status = s(step.status).toUpperCase()
      step.remark = s(step.remark)
    }
  }

  next()
})

OTRequestSchema.index({ requesterEmployeeId: 1, otDate: -1 })
OTRequestSchema.index({ requesterName: 1 })
OTRequestSchema.index({ status: 1, otDate: -1 })
OTRequestSchema.index({ dayType: 1, otDate: -1 })
OTRequestSchema.index({ currentApproverEmployeeId: 1, status: 1, otDate: -1 })
OTRequestSchema.index({ finalApproverEmployeeId: 1, status: 1, otDate: -1 })
OTRequestSchema.index({ createdAt: -1 })
OTRequestSchema.index({ 'employees.employeeId': 1, otDate: -1 })
OTRequestSchema.index({ 'employees.departmentId': 1, otDate: -1 })
OTRequestSchema.index({ 'employees.positionId': 1, otDate: -1 })
OTRequestSchema.index({ 'employees.employeeName': 1 })
OTRequestSchema.index({ 'employees.departmentName': 1 })
OTRequestSchema.index({ 'employees.positionName': 1 })

module.exports = mongoose.model('OTRequest', OTRequestSchema)