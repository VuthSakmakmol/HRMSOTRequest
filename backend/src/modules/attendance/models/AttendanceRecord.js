// backend/src/modules/attendance/models/AttendanceRecord.js
const mongoose = require('mongoose')

const { Schema } = mongoose

const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'LEAVE', 'OFF', 'UNKNOWN']
const ATTENDANCE_DAY_TYPE = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const ATTENDANCE_MATCHED_BY = ['EMPLOYEE_NO', 'MANUAL', 'NONE']

function s(value) {
  return String(value ?? '').trim()
}

function isYMD(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s(value))
}

function isHHMM(value) {
  return /^\d{2}:\d{2}$/.test(s(value))
}

function toUtcMidnightFromYMD(ymd) {
  const raw = s(ymd)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

const attendanceRecordSchema = new Schema(
  {
    importId: {
      type: Schema.Types.ObjectId,
      ref: 'AttendanceImport',
      required: true,
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
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },

    employeeName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    attendanceDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    attendanceDateValue: {
      type: Date,
      required: true,
      index: true,
    },

    clockIn: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5,
    },

    clockOut: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5,
    },

    workMinutes: {
      type: Number,
      default: null,
      min: 0,
    },

    otMinutes: {
      type: Number,
      default: null,
      min: 0,
    },

    status: {
      type: String,
      required: true,
      enum: ATTENDANCE_STATUS,
      default: 'PRESENT',
      index: true,
    },

    dayType: {
      type: String,
      required: true,
      enum: ATTENDANCE_DAY_TYPE,
      default: 'WORKING_DAY',
      index: true,
    },

    matchedBy: {
      type: String,
      required: true,
      enum: ATTENDANCE_MATCHED_BY,
      default: 'EMPLOYEE_NO',
      index: true,
    },

    matchRemark: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    rawRowNo: {
      type: Number,
      required: true,
      min: 1,
    },

    rawData: {
      type: Schema.Types.Mixed,
      default: {},
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

attendanceRecordSchema.pre('validate', function preValidate(next) {
  this.employeeNo = s(this.employeeNo).toUpperCase()
  this.employeeName = s(this.employeeName)
  this.attendanceDate = s(this.attendanceDate)
  this.clockIn = s(this.clockIn)
  this.clockOut = s(this.clockOut)
  this.status = s(this.status).toUpperCase()
  this.dayType = s(this.dayType).toUpperCase()
  this.matchedBy = s(this.matchedBy).toUpperCase()
  this.matchRemark = s(this.matchRemark)

  if (!isYMD(this.attendanceDate)) {
    const err = new Error('attendanceDate must be in YYYY-MM-DD format')
    err.status = 400
    return next(err)
  }

  if (this.clockIn && !isHHMM(this.clockIn)) {
    const err = new Error('clockIn must be in HH:mm format')
    err.status = 400
    return next(err)
  }

  if (this.clockOut && !isHHMM(this.clockOut)) {
    const err = new Error('clockOut must be in HH:mm format')
    err.status = 400
    return next(err)
  }

  if (!(this.attendanceDateValue instanceof Date) || Number.isNaN(this.attendanceDateValue?.getTime())) {
    this.attendanceDateValue = toUtcMidnightFromYMD(this.attendanceDate)
  }

  if (!(this.attendanceDateValue instanceof Date) || Number.isNaN(this.attendanceDateValue?.getTime())) {
    const err = new Error('attendanceDateValue is invalid')
    err.status = 400
    return next(err)
  }

  this.attendanceDateValue = new Date(
    Date.UTC(
      this.attendanceDateValue.getUTCFullYear(),
      this.attendanceDateValue.getUTCMonth(),
      this.attendanceDateValue.getUTCDate(),
      0,
      0,
      0,
      0
    )
  )

  if (this.workMinutes !== null && this.workMinutes !== undefined) {
    this.workMinutes = Number(this.workMinutes)
    if (!Number.isFinite(this.workMinutes) || this.workMinutes < 0) {
      const err = new Error('workMinutes must be a non-negative number')
      err.status = 400
      return next(err)
    }
  }

  if (this.otMinutes !== null && this.otMinutes !== undefined) {
    this.otMinutes = Number(this.otMinutes)
    if (!Number.isFinite(this.otMinutes) || this.otMinutes < 0) {
      const err = new Error('otMinutes must be a non-negative number')
      err.status = 400
      return next(err)
    }
  }

  this.rawRowNo = Number(this.rawRowNo || 0)
  if (!Number.isInteger(this.rawRowNo) || this.rawRowNo < 1) {
    const err = new Error('rawRowNo must be a positive integer')
    err.status = 400
    return next(err)
  }

  if (this.rawData == null || typeof this.rawData !== 'object') {
    this.rawData = {}
  }

  next()
})

attendanceRecordSchema.index(
  { importId: 1, rawRowNo: 1 },
  { unique: true }
)

attendanceRecordSchema.index({ importId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ employeeId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ employeeNo: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ attendanceDate: -1, status: 1 })
attendanceRecordSchema.index({ dayType: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ matchedBy: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ createdAt: -1 })

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema)