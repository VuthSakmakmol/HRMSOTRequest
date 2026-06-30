// backend/src/modules/attendance/models/AttendanceRecord.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const ATTENDANCE_STATUS = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'FORGET_SCAN_IN',
  'FORGET_SCAN_OUT',
  'SHIFT_MISMATCH',
  'LEAVE',
  'OFF',
  'UNKNOWN',
]

const ATTENDANCE_IMPORTED_STATUS = ['PRESENT', 'ABSENT', 'LEAVE', 'OFF', 'UNKNOWN']
const ATTENDANCE_DAY_TYPE = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const ATTENDANCE_MATCHED_BY = ['EMPLOYEE_NO', 'MANUAL', 'NONE']
const SHIFT_MATCH_STATUS = ['MATCHED', 'MISMATCH', 'UNKNOWN']

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safeNonNegativeNumber(value, fallback = 0) {
  const num = safeNumber(value, fallback)
  return num < 0 ? fallback : num
}

function isYMD(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s(value))
}

function isHHmm(value) {
  const raw = s(value)
  if (!raw) return true

  const match = raw.match(/^(\d{2}):(\d{2})$/)
  if (!match) return false

  const hh = Number(match[1])
  const mm = Number(match[2])

  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59
}

function toUtcMidnight(ymd) {
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
    // Excel import link is optional because Scan Station records are created directly.
    importId: {
      type: Schema.Types.ObjectId,
      ref: 'AttendanceImport',
      default: null,
    },

    // Source identity. This is the real employee identity when matched.
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    // Display/search snapshot only. Do not use this as real identity.
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

    // Raw/imported snapshots.
    importedEmployeeId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    importedEmployeeName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    importedDepartmentName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    importedPositionName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    importedShiftName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    importedStatus: {
      type: String,
      enum: ATTENDANCE_IMPORTED_STATUS,
      default: 'PRESENT',
      trim: true,
    },

    // Department snapshot.
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
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
      maxlength: 200,
    },

    // Position snapshot.
    positionId: {
      type: Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
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
      maxlength: 200,
    },

    // Shift snapshot.
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
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
      maxlength: 200,
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

    // Line snapshot. Safe even if some employees do not have line.
    lineId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionLine',
      default: null,
    },

    lineCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    lineName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    // Attendance date is stored as YYYY-MM-DD for stable filtering.
    attendanceDate: {
      type: String,
      required: true,
      trim: true,
    },

    attendanceDateValue: {
      type: Date,
      default: null,
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

    // Identifies how the final official record was most recently created/updated.
    // Existing historical records are treated as IMPORT by the presenter fallback.
    attendanceSource: {
      type: String,
      enum: ['IMPORT', 'SCAN_STATION'],
      default: 'IMPORT',
      trim: true,
    },

    // Only Scan Station writes these fields. They allow a clean audit without
    // creating duplicate official attendance records.
    lastScanAt: {
      type: Date,
      default: null,
    },

    lastScanValue: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },

    status: {
      type: String,
      enum: ATTENDANCE_STATUS,
      default: 'UNKNOWN',
      trim: true,
    },

    derivedStatusReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    derivedStatusReasonKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    messageKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },

    dayType: {
      type: String,
      enum: ATTENDANCE_DAY_TYPE,
      default: 'WORKING_DAY',
      trim: true,
    },

    matchedBy: {
      type: String,
      enum: ATTENDANCE_MATCHED_BY,
      default: 'NONE',
      trim: true,
    },

    matchRemark: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },

    employeeMatched: {
      type: Boolean,
      default: false,
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
      trim: true,
    },

    hasClockIn: {
      type: Boolean,
      default: false,
    },

    hasClockOut: {
      type: Boolean,
      default: false,
    },

    isCrossMidnightShift: {
      type: Boolean,
      default: null,
    },

    workedMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    lateMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    earlyOutMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    validationIssues: {
      type: [String],
      default: [],
    },

    rawRowNo: {
      type: Number,
      min: 0,
      default: 0,
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
  this.employeeNo = upper(this.employeeNo)
  this.employeeName = s(this.employeeName)

  this.importedEmployeeId = upper(this.importedEmployeeId)
  this.importedEmployeeName = s(this.importedEmployeeName)
  this.importedDepartmentName = s(this.importedDepartmentName)
  this.importedPositionName = s(this.importedPositionName)
  this.importedShiftName = s(this.importedShiftName)
  this.importedStatus = upper(this.importedStatus || 'PRESENT')

  this.departmentCode = upper(this.departmentCode)
  this.departmentName = s(this.departmentName)

  this.positionCode = upper(this.positionCode)
  this.positionName = s(this.positionName)

  this.shiftCode = upper(this.shiftCode)
  this.shiftName = s(this.shiftName)
  this.shiftType = upper(this.shiftType)
  this.shiftStartTime = s(this.shiftStartTime)
  this.shiftEndTime = s(this.shiftEndTime)

  this.lineCode = upper(this.lineCode)
  this.lineName = s(this.lineName)

  this.attendanceDate = s(this.attendanceDate)

  this.clockIn = s(this.clockIn)
  this.clockOut = s(this.clockOut)
  this.attendanceSource = upper(this.attendanceSource || 'IMPORT')
  this.lastScanValue = upper(this.lastScanValue)

  this.status = upper(this.status || 'UNKNOWN')
  this.derivedStatusReason = s(this.derivedStatusReason)
  this.derivedStatusReasonKey = s(this.derivedStatusReasonKey)
  this.messageKey = s(this.messageKey || this.derivedStatusReasonKey)

  this.dayType = upper(this.dayType || 'WORKING_DAY')
  this.matchedBy = upper(this.matchedBy || 'NONE')
  this.matchRemark = s(this.matchRemark)

  this.shiftMatchStatus = upper(this.shiftMatchStatus || 'UNKNOWN')

  this.hasClockIn = Boolean(this.clockIn)
  this.hasClockOut = Boolean(this.clockOut)

  this.workedMinutes = Math.round(safeNonNegativeNumber(this.workedMinutes, 0))
  this.lateMinutes = Math.round(safeNonNegativeNumber(this.lateMinutes, 0))
  this.earlyOutMinutes = Math.round(safeNonNegativeNumber(this.earlyOutMinutes, 0))

  this.rawRowNo = Math.round(safeNonNegativeNumber(this.rawRowNo, 0))

  this.validationIssues = Array.from(
    new Set(
      (Array.isArray(this.validationIssues) ? this.validationIssues : [])
        .map((item) => s(item))
        .filter(Boolean),
    ),
  )

  if (!isYMD(this.attendanceDate)) {
    const err = new Error('attendanceDate must be in YYYY-MM-DD format')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  if (!this.attendanceDateValue) {
    this.attendanceDateValue = toUtcMidnight(this.attendanceDate)
  }

  if (this.clockIn && !isHHmm(this.clockIn)) {
    const err = new Error('clockIn must be in HH:mm format')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  if (this.clockOut && !isHHmm(this.clockOut)) {
    const err = new Error('clockOut must be in HH:mm format')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  if (this.shiftStartTime && !isHHmm(this.shiftStartTime)) {
    const err = new Error('shiftStartTime must be in HH:mm format')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  if (this.shiftEndTime && !isHHmm(this.shiftEndTime)) {
    const err = new Error('shiftEndTime must be in HH:mm format')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  next()
})

// Keep indexes here only. Do not duplicate with `index: true` on fields.
attendanceRecordSchema.index({ importId: 1, rawRowNo: 1 })
attendanceRecordSchema.index({ attendanceDate: -1, employeeNo: 1 })
attendanceRecordSchema.index({ attendanceSource: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ lastScanAt: -1 })

// Optimized for Attendance Records first-page and virtual-scroll loading after large imports.
attendanceRecordSchema.index({ attendanceDate: -1, employeeNo: 1, rawRowNo: 1, createdAt: -1, _id: -1 })
attendanceRecordSchema.index({ attendanceDate: -1, rawRowNo: 1, employeeNo: 1, _id: -1 })
attendanceRecordSchema.index({ attendanceDate: -1, employeeId: 1 })
attendanceRecordSchema.index({ attendanceDateValue: -1 })
attendanceRecordSchema.index({ employeeId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ employeeNo: 1, attendanceDate: -1 })

attendanceRecordSchema.index({ status: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ dayType: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ importedStatus: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ shiftMatchStatus: 1, attendanceDate: -1 })

attendanceRecordSchema.index({ departmentId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ positionId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ shiftId: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ lineId: 1, attendanceDate: -1 })

attendanceRecordSchema.index({ employeeMatched: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ shiftMatched: 1, attendanceDate: -1 })
attendanceRecordSchema.index({ shiftTimeMatched: 1, attendanceDate: -1 })

attendanceRecordSchema.index({ createdAt: -1 })
attendanceRecordSchema.index({ updatedAt: -1 })

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema)