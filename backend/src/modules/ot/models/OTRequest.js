// backend/src/modules/ot/models/OTRequest.js

const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function nullableId(value) {
  return s(value) ? value : null
}

const OT_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

const OT_DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

const OT_APPROVAL_STEP_TYPES = ['APPROVER', 'ACKNOWLEDGE']

const OT_TIMING_SOURCES = ['SHIFT_OPTION', 'CUSTOM_FIXED']

const OT_EMPLOYEE_TIME_MODES = ['DEFAULT', 'CUSTOM']

const OT_APPROVAL_STEP_STATUSES = [
  'WAITING',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ACKNOWLEDGED',
]


function dayTypeMeta(dayType) {
  const value = upper(dayType)

  if (value === 'HOLIDAY') {
    return {
      dayType: 'HOLIDAY',
      dayTypeKey: 'ot.dayType.holiday',
      dayTypeSeverity: 'danger',
    }
  }

  if (value === 'SUNDAY') {
    return {
      dayType: 'SUNDAY',
      dayTypeKey: 'ot.dayType.sunday',
      dayTypeSeverity: 'warning',
    }
  }

  return {
    dayType: 'WORKING_DAY',
    dayTypeKey: 'ot.dayType.workingDay',
    dayTypeSeverity: 'success',
  }
}

function normalizeEmployeeCollection(items = []) {
  const seen = new Set()
  const result = []

  for (const item of Array.isArray(items) ? items : []) {
    const employeeId = s(item?.employeeId)

    if (!employeeId) continue
    if (seen.has(employeeId)) continue

    seen.add(employeeId)

    const otTimeMode = upper(item?.otTimeMode || 'DEFAULT')

    const breakMinutes = Number(item?.breakMinutes || 0)
    const requestedMinutes = Number(item?.requestedMinutes || 0)

    const totalRequestPaidMinutes = Number(
      item?.totalRequestPaidMinutes ?? item?.totalMinutes ?? requestedMinutes ?? 0,
    )

    result.push({
      employeeId: item.employeeId,

      employeeCode: s(item.employeeCode),
      employeeName: s(item.employeeName),

      departmentId: nullableId(item.departmentId),
      departmentCode: s(item.departmentCode),
      departmentName: s(item.departmentName),

      positionId: nullableId(item.positionId),
      positionCode: s(item.positionCode),
      positionName: s(item.positionName),

      lineId: nullableId(item.lineId),
      lineCode: s(item.lineCode),
      lineName: s(item.lineName),
      lineLabel: s(item.lineLabel),

      otTimeMode: OT_EMPLOYEE_TIME_MODES.includes(otTimeMode)
        ? otTimeMode
        : 'DEFAULT',

      startTime: s(item.startTime),
      endTime: s(item.endTime),

      breakMinutes:
        Number.isFinite(breakMinutes) && breakMinutes >= 0 ? breakMinutes : 0,

      requestedMinutes:
        Number.isFinite(requestedMinutes) && requestedMinutes >= 0
          ? requestedMinutes
          : 0,

      totalRequestPaidMinutes:
        Number.isFinite(totalRequestPaidMinutes) && totalRequestPaidMinutes >= 0
          ? totalRequestPaidMinutes
          : 0,

      // Backward-friendly alias. Payment/OT can still read totalMinutes,
      // but source-of-truth meaning is paid OT minutes.
      totalMinutes:
        Number.isFinite(totalRequestPaidMinutes) && totalRequestPaidMinutes >= 0
          ? totalRequestPaidMinutes
          : 0,

      totalHours: Number((Number(totalRequestPaidMinutes || 0) / 60).toFixed(2)),
    })
  }

  return result
}

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

    lineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionLine',
      default: null,
    },

    lineCode: {
      type: String,
      trim: true,
      default: '',
    },

    lineName: {
      type: String,
      trim: true,
      default: '',
    },

    lineLabel: {
      type: String,
      trim: true,
      default: '',
    },

    otTimeMode: {
      type: String,
      enum: OT_EMPLOYEE_TIME_MODES,
      default: 'DEFAULT',
      trim: true,
      uppercase: true,
    },

    startTime: {
      type: String,
      trim: true,
      default: '',
    },

    endTime: {
      type: String,
      trim: true,
      default: '',
    },

    breakMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Gross OT request window minutes.
    requestedMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Paid OT minutes after break deduction.
    totalRequestPaidMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Alias for paid minutes.
    totalMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalHours: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
)

const OTApprovalStepSchema = new mongoose.Schema(
  {
    stepNo: {
      type: Number,
      required: true,
      min: 1,
    },

    stepType: {
      type: String,
      enum: OT_APPROVAL_STEP_TYPES,
      required: true,
      default: 'APPROVER',
      trim: true,
      uppercase: true,
    },

    // Snapshot of the calendar-rule role used when this OT request was created.
    // `stepType` keeps the action behavior stable; this field explains whether
    // the approver is ordinary or the final approver for the selected day type.
    workflowRole: {
      type: String,
      enum: ['APPROVER', 'FINAL_APPROVER', 'ACKNOWLEDGE'],
      default: 'APPROVER',
      trim: true,
      uppercase: true,
    },

    isFinalApprover: {
      type: Boolean,
      default: false,
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
      enum: OT_APPROVAL_STEP_STATUSES,
      required: true,
      default: 'WAITING',
      trim: true,
      uppercase: true,
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
  },
)

const OTCalculationPolicySnapshotSchema = new mongoose.Schema(
  {
    calculationPolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OTCalculationPolicy',
      default: null,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },

    name: {
      type: String,
      trim: true,
      default: '',
    },

    minEligibleMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    roundUnitMinutes: {
      type: Number,
      min: 1,
      default: 30,
    },

    roundMethod: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'CEIL',
    },

    graceAfterShiftEndMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    allowApprovedOtWithoutExactClockOut: {
      type: Boolean,
      default: false,
    },

    allowPreShiftOT: {
      type: Boolean,
      default: false,
    },

    allowPostShiftOT: {
      type: Boolean,
      default: true,
    },

    capByRequestedMinutes: {
      type: Boolean,
      default: true,
    },

    treatForgetScanInAsPending: {
      type: Boolean,
      default: true,
    },

    treatForgetScanOutAsPending: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
)

const OTRequestSchema = new mongoose.Schema(
  {
    requestNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },

    requesterEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    // Display snapshot only. Identity is requesterEmployeeId.
    requesterEmployeeCode: {
      type: String,
      trim: true,
      default: '',
    },

    requesterName: {
      type: String,
      trim: true,
      default: '',
    },

    requestedEmployees: {
      type: [OTRequestEmployeeSchema],
      required: true,
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 1 && value.length <= 200
        },
        message: 'ot.request.validation.requestedEmployeesInvalid',
      },
    },

    requestedEmployeeCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      index: true,
    },

    approvedEmployees: {
      type: [OTRequestEmployeeSchema],
      required: true,
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 1 && value.length <= 200
        },
        message: 'ot.request.validation.approvedEmployeesInvalid',
      },
    },

    approvedEmployeeCount: {
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

    dayType: {
      type: String,
      enum: OT_DAY_TYPES,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },

    dayTypeKey: {
      type: String,
      trim: true,
      default: '',
    },

    dayTypeSeverity: {
      type: String,
      trim: true,
      default: '',
    },

    otTimingSource: {
      type: String,
      enum: OT_TIMING_SOURCES,
      required: true,
      default: 'SHIFT_OPTION',
      trim: true,
      uppercase: true,
      index: true,
    },

    // Request-level default OT time.
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

    requestStartTime: {
      type: String,
      trim: true,
      default: '',
    },

    requestEndTime: {
      type: String,
      trim: true,
      default: '',
    },

    // Gross OT request window minutes.
    requestedMinutes: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },

    breakMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Paid OT minutes after break deduction.
    totalRequestPaidMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      index: true,
    },

    // Alias for paid minutes.
    totalMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
      index: true,
    },

    shiftCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },

    shiftName: {
      type: String,
      trim: true,
      default: '',
    },

    shiftType: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },

    shiftStartTime: {
      type: String,
      trim: true,
      default: '',
    },

    shiftEndTime: {
      type: String,
      trim: true,
      default: '',
    },

    shiftCrossMidnight: {
      type: Boolean,
      default: false,
    },

    shiftOtOptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftOTOption',
      default: null,
      index: true,
    },

    shiftOtOptionLabel: {
      type: String,
      trim: true,
      default: '',
    },

    shiftOtOptionTimingMode: {
      type: String,
      trim: true,
      uppercase: true,
      enum: ['AFTER_SHIFT_END', 'FIXED_TIME', ''],
      default: '',
    },

    shiftOtOptionStartAfterShiftEndMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    shiftOtOptionFixedStartTime: {
      type: String,
      trim: true,
      default: '',
    },

    shiftOtOptionFixedEndTime: {
      type: String,
      trim: true,
      default: '',
    },

    otCalculationPolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OTCalculationPolicy',
      default: null,
      index: true,
    },

    otCalculationPolicySnapshot: {
      type: OTCalculationPolicySnapshotSchema,
      default: () => ({}),
    },

    reason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },

    approvalSteps: {
      type: [OTApprovalStepSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 1 && value.length <= 20
        },
        message: 'ot.request.validation.approvalStepsInvalid',
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


    lastAdjustmentByEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    lastAdjustmentByEmployeeCode: {
      type: String,
      trim: true,
      default: '',
    },

    lastAdjustmentByEmployeeName: {
      type: String,
      trim: true,
      default: '',
    },

    lastAdjustmentByAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },

    lastAdjustmentAt: {
      type: Date,
      default: null,
    },

    lastAdjustmentRemark: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },

    lastAdjustmentStepNo: {
      type: Number,
      default: null,
      min: 1,
    },

    status: {
      type: String,
      enum: OT_STATUS,
      required: true,
      default: 'PENDING',
      trim: true,
      uppercase: true,
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

OTRequestSchema.pre('validate', function normalize(next) {
  this.requestNo = upper(this.requestNo)

  this.requesterEmployeeCode = s(this.requesterEmployeeCode)
  this.requesterName = s(this.requesterName)

  this.otDate = s(this.otDate)

  const meta = dayTypeMeta(this.dayType)
  this.dayType = meta.dayType
  this.dayTypeKey = meta.dayTypeKey
  this.dayTypeSeverity = meta.dayTypeSeverity

  this.otTimingSource = upper(this.otTimingSource || 'SHIFT_OPTION')
  if (!OT_TIMING_SOURCES.includes(this.otTimingSource)) {
    this.otTimingSource = 'SHIFT_OPTION'
  }

  this.startTime = s(this.startTime)
  this.endTime = s(this.endTime)
  this.requestStartTime = s(this.requestStartTime || this.startTime)
  this.requestEndTime = s(this.requestEndTime || this.endTime)

  this.breakMinutes = Number(this.breakMinutes || 0)
  this.requestedMinutes = Number(this.requestedMinutes || 0)

  this.totalRequestPaidMinutes = Number(
    this.totalRequestPaidMinutes ?? this.totalMinutes ?? 0,
  )

  this.totalMinutes = this.totalRequestPaidMinutes
  this.totalHours = Number((Number(this.totalRequestPaidMinutes || 0) / 60).toFixed(2))

  this.shiftCode = upper(this.shiftCode)
  this.shiftName = s(this.shiftName)
  this.shiftType = upper(this.shiftType)
  this.shiftStartTime = s(this.shiftStartTime)
  this.shiftEndTime = s(this.shiftEndTime)
  this.shiftCrossMidnight = this.shiftCrossMidnight === true

  this.shiftOtOptionLabel = s(this.shiftOtOptionLabel)
  this.shiftOtOptionTimingMode = upper(this.shiftOtOptionTimingMode)
  this.shiftOtOptionStartAfterShiftEndMinutes = Number(
    this.shiftOtOptionStartAfterShiftEndMinutes || 0,
  )
  this.shiftOtOptionFixedStartTime = s(this.shiftOtOptionFixedStartTime)
  this.shiftOtOptionFixedEndTime = s(this.shiftOtOptionFixedEndTime)

  this.reason = s(this.reason)

  this.status = upper(this.status || 'PENDING')

  this.lastAdjustmentByEmployeeCode = s(this.lastAdjustmentByEmployeeCode)
  this.lastAdjustmentByEmployeeName = s(this.lastAdjustmentByEmployeeName)
  this.lastAdjustmentRemark = s(this.lastAdjustmentRemark)

  this.requestedEmployees = normalizeEmployeeCollection(this.requestedEmployees)
  this.requestedEmployeeCount = this.requestedEmployees.length

  this.approvedEmployees = normalizeEmployeeCollection(this.approvedEmployees)
  this.approvedEmployeeCount = this.approvedEmployees.length


  if (Array.isArray(this.approvalSteps)) {
    for (const step of this.approvalSteps) {
      step.stepNo = Number(step.stepNo || 0)
      step.stepType = upper(step.stepType || 'APPROVER')
      step.workflowRole = upper(
        step.workflowRole || (step.isFinalApprover ? 'FINAL_APPROVER' : step.stepType),
      )
      if (!['APPROVER', 'FINAL_APPROVER', 'ACKNOWLEDGE'].includes(step.workflowRole)) {
        step.workflowRole = step.stepType === 'ACKNOWLEDGE' ? 'ACKNOWLEDGE' : 'APPROVER'
      }
      step.isFinalApprover = step.workflowRole === 'FINAL_APPROVER' || step.isFinalApprover === true
      step.approverCode = s(step.approverCode)
      step.approverName = s(step.approverName)
      step.status = upper(step.status || 'WAITING')
      step.remark = s(step.remark)
    }
  }

  if (this.otCalculationPolicySnapshot) {
    this.otCalculationPolicySnapshot.code = upper(
      this.otCalculationPolicySnapshot.code,
    )

    this.otCalculationPolicySnapshot.name = s(
      this.otCalculationPolicySnapshot.name,
    )

    this.otCalculationPolicySnapshot.roundMethod = upper(
      this.otCalculationPolicySnapshot.roundMethod || 'CEIL',
    )

    this.otCalculationPolicySnapshot.minEligibleMinutes = Number(
      this.otCalculationPolicySnapshot.minEligibleMinutes || 0,
    )

    this.otCalculationPolicySnapshot.roundUnitMinutes = Number(
      this.otCalculationPolicySnapshot.roundUnitMinutes || 30,
    )

    this.otCalculationPolicySnapshot.graceAfterShiftEndMinutes = Number(
      this.otCalculationPolicySnapshot.graceAfterShiftEndMinutes || 0,
    )
  }

  next()
})

OTRequestSchema.index({ requesterEmployeeId: 1, otDate: -1 })
OTRequestSchema.index({ requesterName: 1 })
OTRequestSchema.index({ status: 1, otDate: -1 })
OTRequestSchema.index({ dayType: 1, otDate: -1 })
OTRequestSchema.index({ currentApproverEmployeeId: 1, status: 1, otDate: -1 })
OTRequestSchema.index({ finalApproverEmployeeId: 1, status: 1, otDate: -1 })
OTRequestSchema.index({ shiftId: 1, otDate: -1 })
OTRequestSchema.index({ shiftOtOptionId: 1, otDate: -1 })
OTRequestSchema.index({ otTimingSource: 1, otDate: -1 })

OTRequestSchema.index({ createdAt: -1, _id: -1 })
OTRequestSchema.index({ otDate: -1, createdAt: -1, _id: -1 })
OTRequestSchema.index({ status: 1, createdAt: -1, _id: -1 })
OTRequestSchema.index({ dayType: 1, createdAt: -1, _id: -1 })

OTRequestSchema.index({ otDate: 1, status: 1, 'requestedEmployees.employeeId': 1 })
OTRequestSchema.index({ otDate: 1, status: 1, 'approvedEmployees.employeeId': 1 })

OTRequestSchema.index({ 'requestedEmployees.employeeId': 1, otDate: -1 })
OTRequestSchema.index({ 'requestedEmployees.departmentId': 1, otDate: -1 })
OTRequestSchema.index({ 'requestedEmployees.positionId': 1, otDate: -1 })
OTRequestSchema.index({ 'requestedEmployees.lineId': 1, otDate: -1 })

OTRequestSchema.index({ 'approvedEmployees.employeeId': 1, otDate: -1 })
OTRequestSchema.index({ 'approvedEmployees.departmentId': 1, otDate: -1 })
OTRequestSchema.index({ 'approvedEmployees.positionId': 1, otDate: -1 })
OTRequestSchema.index({ 'approvedEmployees.lineId': 1, otDate: -1 })


const OTRequest =
  mongoose.models.OTRequest || mongoose.model('OTRequest', OTRequestSchema)

module.exports = OTRequest

module.exports.OT_STATUS = OT_STATUS
module.exports.OT_DAY_TYPES = OT_DAY_TYPES
module.exports.OT_APPROVAL_STEP_TYPES = OT_APPROVAL_STEP_TYPES
module.exports.OT_TIMING_SOURCES = OT_TIMING_SOURCES
module.exports.OT_EMPLOYEE_TIME_MODES = OT_EMPLOYEE_TIME_MODES
module.exports.OT_APPROVAL_STEP_STATUSES = OT_APPROVAL_STEP_STATUSES
