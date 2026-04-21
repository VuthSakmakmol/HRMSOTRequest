// backend/src/modules/attendance/models/AttendanceRecord.js
const mongoose = require('mongoose')

const { Schema } = mongoose

const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'LEAVE', 'OFF', 'UNKNOWN']
const ATTENDANCE_DAY_TYPE = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const ATTENDANCE_MATCHED_BY = ['EMPLOYEE_NO', 'MANUAL', 'NONE']
const SHIFT_MATCH_STATUS = ['MATCHED', 'MISMATCH', 'UNKNOWN']

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

    // Resolved / normalized employee business id
    employeeNo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },

    // Resolved master snapshot
    employeeName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },

    departmentCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    departmentName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    positionId: {
      type: Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
      index: true,
    },

    positionCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    positionName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
      index: true,
    },

    shiftCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    shiftName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    shiftType: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    shiftStartTime: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5,
    },

    shiftEndTime: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5,
    },

    // Imported Excel snapshot
    importedEmployeeId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },

    importedEmployeeName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    importedDepartmentName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    importedPositionName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    importedShiftName: {
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

    employeeMatched: {
      type: Boolean,
      default: false,
      index: true,
    },

    nameMatched: {
      type: Boolean,
      default: null,
    },

    departmentMatched: {
      type: Boolean,
      default: null,
    },

    positionMatched: {
      type: Boolean,
      default: null,
    },

    shiftMatched: {
      type: Boolean,
      default: null,
    },

    shiftTimeMatched: {
      type: Boolean,
      default: null,
    },

    shiftMatchStatus: {
      type: String,
      enum: SHIFT_MATCH_STATUS,
      default: 'UNKNOWN',
      index: true,
    },

    validationIssues: {
      type: [String],
      default: [],
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
  },
)

attendanceRecordSchema.pre('validate', function preValidate(next) {
  this.employeeNo = s(this.employeeNo).toUpperCase()
  this.employeeName = s(this.employeeName)

  this.departmentCode = s(this.departmentCode).toUpperCase()
  this.departmentName = s(this.departmentName)

  this.positionCode = s(this.positionCode).toUpperCase()
  this.positionName = s(this.positionName)

  this.shiftCode = s(this.shiftCode).toUpperCase()
  this.shiftName = s(this.shiftName)
  this.shiftType = s(this.shiftType).toUpperCase()
  this.shiftStartTime = s(this.shiftStartTime)
  this.shiftEndTime = s(this.shiftEndTime)

  this.importedEmployeeId = s(this.importedEmployeeId).toUpperCase()
  this.importedEmployeeName = s(this.importedEmployeeName)
  this.importedDepartmentName = s(this.importedDepartmentName)
  this.importedPositionName = s(this.importedPositionName)
  this.importedShiftName = s(this.importedShiftName)

  this.attendanceDate = s(this.attendanceDate)
  this.clockIn = s(this.clockIn)
  this.clockOut = s(this.clockOut)
  this.status = s(this.status).toUpperCase()
  this.dayType = s(this.dayType).toUpperCase()
  this.matchedBy = s(this.matchedBy).toUpperCase()
  this.matchRemark = s(this.matchRemark)
  this.shiftMatchStatus = s(this.shiftMatchStatus).toUpperCase()

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

  if (this.shiftStartTime && !isHHMM(this.shiftStartTime)) {
    const err = new Error('shiftStartTime must be in HH:mm format')
    err.status = 400
    return next(err)
  }

  if (this.shiftEndTime && !isHHMM(this.shiftEndTime)) {
    const err = new Error('shiftEndTime must be in HH:mm format')
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
      0,
    ),
  )

  this.rawRowNo = Number(this.rawRowNo || 0)
  if (!Number.isInteger(this.rawRowNo) || this.rawRowNo < 1) {
    const err = new Error('rawRowNo must be a positive integer')
    err.status = 400
    return next(err)
  }

  if (!Array.isArray(this.validationIssues)) {
    this.validationIssues = []
  }

  this.validationIssues = this.validationIssues
    .map((item) => s(item))
    .filter(Boolean)

  if (this.rawData == null || typeof this.rawData !== 'object') {
    this.rawData = {}
  }

  next()
})

attendanceRecordSchema.index({ importId: 1, rawRowNo: 1 }, { unique: true })
attendanceRecordSchema.index({ importId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ employeeId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ employeeNo: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ importedEmployeeId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ attendanceDate: -1, status: 1 })
attendanceRecordSchema.index({ dayType: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ matchedBy: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ employeeMatched: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ shiftMatchStatus: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ createdAt: -1 })

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema)