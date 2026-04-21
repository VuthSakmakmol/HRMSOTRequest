// backend/src/modules/attendance/models/AttendanceImport.js
const mongoose = require('mongoose')

const { Schema } = mongoose

const ATTENDANCE_IMPORT_SOURCE_TYPES = ['EXCEL']
const ATTENDANCE_IMPORT_STATUS = ['PROCESSING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED']

function s(value) {
  return String(value ?? '').trim()
}

function isYMD(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s(value))
}

const attendanceImportSchema = new Schema(
  {
    importNo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    sourceType: {
      type: String,
      required: true,
      enum: ATTENDANCE_IMPORT_SOURCE_TYPES,
      default: 'EXCEL',
      index: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    storedFileName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },

    periodFrom: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    periodTo: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    rowCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    successRowCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    failedRowCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    duplicateRowCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      required: true,
      enum: ATTENDANCE_IMPORT_STATUS,
      default: 'PROCESSING',
      index: true,
    },

    remark: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    importedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    importedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },

    importedByEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
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

attendanceImportSchema.pre('validate', function preValidate(next) {
  this.importNo = s(this.importNo).toUpperCase()
  this.sourceType = s(this.sourceType).toUpperCase()
  this.fileName = s(this.fileName)
  this.storedFileName = s(this.storedFileName)
  this.mimeType = s(this.mimeType)
  this.periodFrom = s(this.periodFrom)
  this.periodTo = s(this.periodTo)
  this.status = s(this.status).toUpperCase()
  this.remark = s(this.remark)

  this.rowCount = Number(this.rowCount || 0)
  this.successRowCount = Number(this.successRowCount || 0)
  this.failedRowCount = Number(this.failedRowCount || 0)
  this.duplicateRowCount = Number(this.duplicateRowCount || 0)

  if (this.periodFrom && !isYMD(this.periodFrom)) {
    const err = new Error('periodFrom must be in YYYY-MM-DD format')
    err.status = 400
    return next(err)
  }

  if (this.periodTo && !isYMD(this.periodTo)) {
    const err = new Error('periodTo must be in YYYY-MM-DD format')
    err.status = 400
    return next(err)
  }

  if (this.periodFrom && this.periodTo && this.periodFrom > this.periodTo) {
    const err = new Error('periodFrom cannot be later than periodTo')
    err.status = 400
    return next(err)
  }

  if (
    this.rowCount < 0 ||
    this.successRowCount < 0 ||
    this.failedRowCount < 0 ||
    this.duplicateRowCount < 0
  ) {
    const err = new Error('Attendance import counters cannot be negative')
    err.status = 400
    return next(err)
  }

  next()
})

attendanceImportSchema.index({ importNo: 1 }, { unique: true })
attendanceImportSchema.index({ status: 1, createdAt: -1 })
attendanceImportSchema.index({ sourceType: 1, createdAt: -1 })
attendanceImportSchema.index({ importedBy: 1, createdAt: -1 })
attendanceImportSchema.index({ importedByEmployeeId: 1, createdAt: -1 })
attendanceImportSchema.index({ periodFrom: 1, periodTo: 1 })
attendanceImportSchema.index({ createdAt: -1 })

module.exports = mongoose.model('AttendanceImport', attendanceImportSchema)