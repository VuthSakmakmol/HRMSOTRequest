// backend/src/modules/attendance/validators/attendance.validation.js

const { z } = require('zod')

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
const IMPORT_STATUS = ['PROCESSING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED']
const SOURCE_TYPE = ['EXCEL', 'CSV', 'MANUAL']
const ATTENDANCE_SOURCE = ['IMPORT', 'SCAN_STATION']
const SCAN_RESULT = [
  'SUCCESS',
  'INVALID_FORMAT',
  'EMPLOYEE_NOT_FOUND',
  'EMPLOYEE_INACTIVE',
  'SYSTEM_ERROR',
]

const IMPORT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'importedAt',
  'importNo',
  'periodFrom',
  'periodTo',
  'status',
  'rowCount',
  'successRowCount',
  'failedRowCount',
  'duplicateRowCount',
  'overriddenRowCount',
]

const RECORD_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'attendanceDate',
  'employeeNo',
  'employeeName',
  'departmentName',
  'positionName',
  'shiftName',
  'status',
  'importedStatus',
  'dayType',
  'shiftMatchStatus',
  'workedMinutes',
  'lateMinutes',
  'earlyOutMinutes',
  'rawRowNo',
  'attendanceSource',
]

function s(value) {
  return String(value ?? '').trim()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeDateOnly(value) {
  const raw = s(value)
  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`
  }

  return raw
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')

const ymdSchema = z.preprocess(
  (value) => normalizeDateOnly(value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
)

const pageSchema = z.coerce.number().int().min(1).default(1)
const limitSchema = z.coerce.number().int().min(1).max(200).default(10)
const sortOrderSchema = z.enum(['asc', 'desc']).default('desc')

function optionalTrimmedString(max = 500) {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw || undefined
    },
    z.string().max(max).optional(),
  )
}

function optionalUpperString(max = 100) {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw ? raw.toUpperCase() : undefined
    },
    z.string().max(max).optional(),
  )
}

function optionalUpperEnum(values) {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw ? raw.toUpperCase() : undefined
    },
    z.enum(values).optional(),
  )
}

function optionalBoolean() {
  return z.preprocess(
    (value) => {
      const raw = s(value).toLowerCase()

      if (!raw) return undefined
      if (raw === 'true' || raw === '1' || raw === 'yes') return true
      if (raw === 'false' || raw === '0' || raw === 'no') return false

      return value
    },
    z.boolean().optional(),
  )
}

const optionalYmdSchema = z.preprocess(
  (value) => {
    const raw = normalizeDateOnly(value)
    return raw || undefined
  },
  ymdSchema.optional(),
)

const optionalObjectIdSchema = z.preprocess(
  (value) => {
    const raw = s(value)
    return raw || undefined
  },
  objectIdSchema.optional(),
)

const createAttendanceImportSchema = z.object({
  sourceType: optionalUpperEnum(SOURCE_TYPE).default('EXCEL'),

  // Selected once from import dialog.
  // Excel rows only need Employee ID, Clock In, Clock Out.
  attendanceDate: ymdSchema,

  remark: optionalTrimmedString(1000),
})

const listAttendanceImportsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,

    search: optionalTrimmedString(200),
    status: optionalUpperEnum(IMPORT_STATUS),
    sourceType: optionalUpperEnum(SOURCE_TYPE),

    periodFrom: optionalYmdSchema,
    periodTo: optionalYmdSchema,

    sortBy: z.preprocess(
      (value) => {
        const raw = s(value)
        return raw || undefined
      },
      z.enum(IMPORT_SORT_FIELDS).optional(),
    ),

    sortOrder: sortOrderSchema,
  })
  .superRefine((data, ctx) => {
    if (data.periodFrom && data.periodTo && data.periodFrom > data.periodTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodTo'],
        message: 'periodTo must be greater than or equal to periodFrom',
      })
    }
  })

const listAttendanceRecordsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,

    search: optionalTrimmedString(200),

    importId: optionalObjectIdSchema,
    employeeId: optionalObjectIdSchema,
    departmentId: optionalObjectIdSchema,
    positionId: optionalObjectIdSchema,
    shiftId: optionalObjectIdSchema,
    lineId: optionalObjectIdSchema,

    // Display/search snapshot only. Real identity remains employeeId.
    employeeNo: optionalUpperString(50),

    status: optionalUpperEnum(ATTENDANCE_STATUS),
    importedStatus: optionalUpperEnum(ATTENDANCE_IMPORTED_STATUS),
    dayType: optionalUpperEnum(ATTENDANCE_DAY_TYPE),
    matchedBy: optionalUpperEnum(ATTENDANCE_MATCHED_BY),
    shiftMatchStatus: optionalUpperEnum(SHIFT_MATCH_STATUS),
    attendanceSource: optionalUpperEnum(ATTENDANCE_SOURCE),

    employeeMatched: optionalBoolean(),
    nameMatched: optionalBoolean(),
    departmentMatched: optionalBoolean(),
    positionMatched: optionalBoolean(),
    shiftMatched: optionalBoolean(),
    shiftTimeMatched: optionalBoolean(),

    attendanceDateFrom: optionalYmdSchema,
    attendanceDateTo: optionalYmdSchema,

    sortBy: z.preprocess(
      (value) => {
        const raw = s(value)
        return raw || undefined
      },
      z.enum(RECORD_SORT_FIELDS).optional(),
    ),

    sortOrder: sortOrderSchema,
  })
  .superRefine((data, ctx) => {
    if (
      data.attendanceDateFrom &&
      data.attendanceDateTo &&
      data.attendanceDateFrom > data.attendanceDateTo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attendanceDateTo'],
        message: 'attendanceDateTo must be greater than or equal to attendanceDateFrom',
      })
    }
  })

const searchOTVerificationQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,

    search: optionalTrimmedString(200),

    // Keep flexible because OT request status can grow later.
    status: optionalUpperString(50),

    otDateFrom: optionalYmdSchema,
    otDateTo: optionalYmdSchema,
  })
  .superRefine((data, ctx) => {
    if (data.otDateFrom && data.otDateTo && data.otDateFrom > data.otDateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otDateTo'],
        message: 'otDateTo must be greater than or equal to otDateFrom',
      })
    }
  })


const submitAttendanceScanSchema = z.object({
  scannedValue: z.preprocess(
    (value) => s(value),
    z.string().min(1, 'Scanned Employee ID is required').max(100),
  ),
  stationName: optionalTrimmedString(100),
})

const listAttendanceScanLogsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: optionalTrimmedString(200),
  attendanceDate: optionalYmdSchema,
  result: optionalUpperEnum(SCAN_RESULT),
})

const attendanceScanSummaryQuerySchema = z.object({
  attendanceDate: optionalYmdSchema,
})

const attendanceImportIdParamSchema = z.object({
  id: objectIdSchema,
})

const attendanceRecordIdParamSchema = z.object({
  id: objectIdSchema,
})

const verifyOTAttendanceParamSchema = z.object({
  otRequestId: objectIdSchema,
})

module.exports = {
  createAttendanceImportSchema,
  listAttendanceImportsQuerySchema,
  listAttendanceRecordsQuerySchema,
  searchOTVerificationQuerySchema,
  attendanceImportIdParamSchema,
  attendanceRecordIdParamSchema,
  verifyOTAttendanceParamSchema,
  submitAttendanceScanSchema,
  listAttendanceScanLogsQuerySchema,
  attendanceScanSummaryQuerySchema,

  ATTENDANCE_STATUS,
  ATTENDANCE_IMPORTED_STATUS,
  ATTENDANCE_DAY_TYPE,
  ATTENDANCE_MATCHED_BY,
  SHIFT_MATCH_STATUS,
  IMPORT_STATUS,
  SOURCE_TYPE,
  ATTENDANCE_SOURCE,
  SCAN_RESULT,
  IMPORT_SORT_FIELDS,
  RECORD_SORT_FIELDS,
}