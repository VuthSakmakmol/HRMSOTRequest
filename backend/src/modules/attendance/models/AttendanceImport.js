// backend/src/modules/attendance/models/AttendanceImport.js

const mongoose = require('mongoose')

const { Schema } = mongoose

const ATTENDANCE_IMPORT_SOURCE_TYPES = ['EXCEL', 'CSV', 'MANUAL']
const ATTENDANCE_IMPORT_STATUS = ['PROCESSING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED']

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function safeNonNegativeNumber(value, fallback = 0) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return num
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
      trim: true,
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

    // YYYY-MM-DD
    periodFrom: {
      type: String,
      default: '',
      trim: true,
    },

    // YYYY-MM-DD
    periodTo: {
      type: String,
      default: '',
      trim: true,
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

    overriddenRowCount: {
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
      trim: true,
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
    },

    importedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },

    importedByEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
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

attendanceImportSchema.pre('validate', function preValidate(next) {
  this.importNo = upper(this.importNo)
  this.sourceType = upper(this.sourceType || 'EXCEL')

  this.fileName = s(this.fileName)
  this.storedFileName = s(this.storedFileName)
  this.mimeType = s(this.mimeType)

  this.periodFrom = s(this.periodFrom)
  this.periodTo = s(this.periodTo)

  this.status = upper(this.status || 'PROCESSING')
  this.remark = s(this.remark)

  this.rowCount = Math.round(safeNonNegativeNumber(this.rowCount, 0))
  this.successRowCount = Math.round(safeNonNegativeNumber(this.successRowCount, 0))
  this.failedRowCount = Math.round(safeNonNegativeNumber(this.failedRowCount, 0))
  this.duplicateRowCount = Math.round(safeNonNegativeNumber(this.duplicateRowCount, 0))
  this.overriddenRowCount = Math.round(safeNonNegativeNumber(this.overriddenRowCount, 0))

  if (this.periodFrom && !isYMD(this.periodFrom)) {
    const err = new Error('periodFrom must be in YYYY-MM-DD format')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  if (this.periodTo && !isYMD(this.periodTo)) {
    const err = new Error('periodTo must be in YYYY-MM-DD format')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  if (this.periodFrom && this.periodTo && this.periodFrom > this.periodTo) {
    const err = new Error('periodFrom cannot be later than periodTo')
    err.status = 400
    err.statusCode = 400
    return next(err)
  }

  next()
})

// Keep indexes here only. Do not duplicate with `index: true` on fields.
attendanceImportSchema.index({ importNo: 1 }, { unique: true })

attendanceImportSchema.index({ createdAt: -1 })
attendanceImportSchema.index({ updatedAt: -1 })
attendanceImportSchema.index({ importedAt: -1 })

attendanceImportSchema.index({ status: 1, createdAt: -1 })
attendanceImportSchema.index({ sourceType: 1, createdAt: -1 })

attendanceImportSchema.index({ periodFrom: 1, periodTo: 1 })
attendanceImportSchema.index({ periodFrom: -1 })
attendanceImportSchema.index({ periodTo: -1 })

attendanceImportSchema.index({ importedBy: 1, createdAt: -1 })
attendanceImportSchema.index({ importedByEmployeeId: 1, createdAt: -1 })

attendanceImportSchema.index({ rowCount: -1, createdAt: -1 })
attendanceImportSchema.index({ successRowCount: -1, createdAt: -1 })
attendanceImportSchema.index({ failedRowCount: -1, createdAt: -1 })
attendanceImportSchema.index({ duplicateRowCount: -1, createdAt: -1 })
attendanceImportSchema.index({ overriddenRowCount: -1, createdAt: -1 })

module.exports = mongoose.model('AttendanceImport', attendanceImportSchema)