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

const IMPORT_SORT_FIELDS = ['createdAt', 'importNo', 'periodFrom', 'periodTo', 'status', 'rowCount']
const RECORD_SORT_FIELDS = [
  'createdAt',
  'attendanceDate',
  'employeeNo',
  'employeeName',
  'status',
  'importedStatus',
  'dayType',
  'shiftMatchStatus',
  'workedMinutes',
  'lateMinutes',
  'earlyOutMinutes',
]

function s(value) {
  return String(value ?? '').trim()
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')

const ymdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

const pageSchema = z.coerce.number().int().min(1).default(1)
const limitSchema = z.coerce.number().int().min(1).max(200).default(10)

const sortOrderSchema = z.enum(['asc', 'desc']).default('desc')

const optionalUpperEnum = (values, label) =>
  z.preprocess(
    (value) => {
      const raw = s(value)
      return raw ? raw.toUpperCase() : undefined
    },
    z.enum(values, `${label} is invalid`).optional(),
  )

const optionalTrimmedString = (max = 500) =>
  z.preprocess(
    (value) => {
      const raw = s(value)
      return raw || undefined
    },
    z.string().max(max).optional(),
  )

const optionalYmdSchema = z.preprocess(
  (value) => {
    const raw = s(value)
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

const createAttendanceImportSchema = z
  .object({
    sourceType: optionalUpperEnum(SOURCE_TYPE, 'sourceType').default('EXCEL'),
    periodFrom: optionalYmdSchema,
    periodTo: optionalYmdSchema,
    remark: optionalTrimmedString(1000),
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

const listAttendanceImportsQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    search: optionalTrimmedString(200),
    status: optionalUpperEnum(IMPORT_STATUS, 'status'),
    sourceType: optionalUpperEnum(SOURCE_TYPE, 'sourceType'),
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
    employeeNo: z.preprocess(
      (value) => {
        const raw = s(value)
        return raw ? raw.toUpperCase() : undefined
      },
      z.string().max(50).optional(),
    ),

    status: optionalUpperEnum(ATTENDANCE_STATUS, 'status'),
    importedStatus: optionalUpperEnum(ATTENDANCE_IMPORTED_STATUS, 'importedStatus'),
    dayType: optionalUpperEnum(ATTENDANCE_DAY_TYPE, 'dayType'),
    matchedBy: optionalUpperEnum(ATTENDANCE_MATCHED_BY, 'matchedBy'),
    shiftMatchStatus: optionalUpperEnum(SHIFT_MATCH_STATUS, 'shiftMatchStatus'),

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
  attendanceImportIdParamSchema,
  attendanceRecordIdParamSchema,
  verifyOTAttendanceParamSchema,

  ATTENDANCE_STATUS,
  ATTENDANCE_IMPORTED_STATUS,
  ATTENDANCE_DAY_TYPE,
  ATTENDANCE_MATCHED_BY,
  SHIFT_MATCH_STATUS,
  IMPORT_STATUS,
  SOURCE_TYPE,
}