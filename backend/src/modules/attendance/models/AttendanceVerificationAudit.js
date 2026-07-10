// backend/src/modules/attendance/models/AttendanceVerificationAudit.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const ACTIONS = [
  'CREATE_ATTENDANCE',
  'RECOVER_ATTENDANCE',
  'CREATE_OT_REQUEST',
  'RECOVER_OT_REQUEST',
]

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

const attendanceVerificationAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: ACTIONS,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    attendanceDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },

    employeeNo: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    employeeName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    sourceOTRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'OTRequest',
      default: null,
      index: true,
    },

    sourceOTRequestNo: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },

    attendanceRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'AttendanceRecord',
      default: null,
      index: true,
    },

    generatedOTRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'OTRequest',
      default: null,
      index: true,
    },

    generatedOTRequestNo: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },

    requesterEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    requesterEmployeeCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    requesterName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    before: {
      type: Schema.Types.Mixed,
      default: null,
    },

    after: {
      type: Schema.Types.Mixed,
      default: null,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

attendanceVerificationAuditSchema.pre('validate', function normalize(next) {
  this.action = upper(this.action)
  this.attendanceDate = s(this.attendanceDate)
  this.employeeNo = upper(this.employeeNo)
  this.employeeName = s(this.employeeName)
  this.sourceOTRequestNo = upper(this.sourceOTRequestNo)
  this.generatedOTRequestNo = upper(this.generatedOTRequestNo)
  this.requesterEmployeeCode = upper(this.requesterEmployeeCode)
  this.requesterName = s(this.requesterName)
  next()
})

attendanceVerificationAuditSchema.index({ attendanceDate: -1, createdAt: -1 })
attendanceVerificationAuditSchema.index({ employeeId: 1, attendanceDate: -1, createdAt: -1 })
attendanceVerificationAuditSchema.index({ sourceOTRequestId: 1, createdAt: -1 })
attendanceVerificationAuditSchema.index({ attendanceRecordId: 1, createdAt: -1 })

module.exports = mongoose.model('AttendanceVerificationAudit', attendanceVerificationAuditSchema)
module.exports.ACTIONS = ACTIONS
