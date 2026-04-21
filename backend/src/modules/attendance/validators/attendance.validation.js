// backend/src/modules/attendance/validators/attendance.validation.js
const { z } = require('zod')

const ATTENDANCE_IMPORT_SOURCE_TYPES = ['EXCEL']
const ATTENDANCE_IMPORT_STATUS = ['PROCESSING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED']
const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'LEAVE', 'OFF', 'UNKNOWN']
const ATTENDANCE_DAY_TYPE = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const ATTENDANCE_MATCHED_BY = ['EMPLOYEE_NO', 'MANUAL', 'NONE']
const SHIFT_MATCH_STATUS = ['MATCHED', 'MISMATCH', 'UNKNOWN']

function s(value) {
  return String(value ?? '').trim()
}

function emptyToUndefined(value) {
  const raw = s(value)
  return raw ? raw : undefined
}

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/
const objectIdRegex = /^[a-fA-F0-9]{24}$/

function optionalYMD(label) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(ymdRegex, `${label} must be in YYYY-MM-DD format`)
      .optional(),
  )
}

function optionalObjectId(label) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(objectIdRegex, `${label} must be a valid ObjectId`)
      .optional(),
  )
}

function optionalUpperEnum(values) {
  return z.preprocess(
    (value) => {
      const raw = s(value).toUpperCase()
      return raw || undefined
    },
    z.enum(values).optional(),
  )
}

function queryPage(defaultValue = 1) {
  return z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(100000).default(defaultValue),
  )
}

function queryLimit(defaultValue = 10) {
  return z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(200).default(defaultValue),
  )
}

const createAttendanceImportSchema = z
  .object({
    sourceType: z.preprocess(
      (value) => {
        const raw = s(value).toUpperCase()
        return raw || undefined
      },
      z.enum(ATTENDANCE_IMPORT_SOURCE_TYPES).default('EXCEL'),
    ),

    periodFrom: optionalYMD('periodFrom'),
    periodTo: optionalYMD('periodTo'),

    remark: z.preprocess(
      (value) => s(value),
      z.string().max(1000, 'remark cannot exceed 1000 characters').default(''),
    ),
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
    page: queryPage(1),
    limit: queryLimit(10),

    status: optionalUpperEnum(ATTENDANCE_IMPORT_STATUS),
    sourceType: optionalUpperEnum(ATTENDANCE_IMPORT_SOURCE_TYPES),

    periodFrom: optionalYMD('periodFrom'),
    periodTo: optionalYMD('periodTo'),

    search: z.preprocess(
      (value) => s(value),
      z.string().max(100, 'search cannot exceed 100 characters').default(''),
    ),

    sortBy: z.preprocess(
      emptyToUndefined,
      z
        .enum(['createdAt', 'importNo', 'periodFrom', 'periodTo', 'status', 'rowCount'])
        .default('createdAt'),
    ),

    sortOrder: z.preprocess(
      (value) => {
        const raw = s(value).toLowerCase()
        return raw || undefined
      },
      z.enum(['asc', 'desc']).default('desc'),
    ),
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
    page: queryPage(1),
    limit: queryLimit(10),

    importId: optionalObjectId('importId'),
    employeeId: optionalObjectId('employeeId'),

    employeeNo: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .max(50, 'employeeNo cannot exceed 50 characters')
        .transform((value) => value.toUpperCase())
        .optional(),
    ),

    attendanceDateFrom: optionalYMD('attendanceDateFrom'),
    attendanceDateTo: optionalYMD('attendanceDateTo'),

    status: optionalUpperEnum(ATTENDANCE_STATUS),
    dayType: optionalUpperEnum(ATTENDANCE_DAY_TYPE),
    matchedBy: optionalUpperEnum(ATTENDANCE_MATCHED_BY),
    shiftMatchStatus: optionalUpperEnum(SHIFT_MATCH_STATUS),

    employeeMatched: z.preprocess(
      emptyToUndefined,
      z
        .union([
          z.boolean(),
          z.enum(['true', 'false', 'TRUE', 'FALSE']).transform((value) =>
            String(value).toLowerCase() === 'true',
          ),
        ])
        .optional(),
    ),

    search: z.preprocess(
      (value) => s(value),
      z.string().max(100, 'search cannot exceed 100 characters').default(''),
    ),

    sortBy: z.preprocess(
      emptyToUndefined,
      z
        .enum([
          'createdAt',
          'attendanceDate',
          'employeeNo',
          'employeeName',
          'status',
          'dayType',
          'shiftMatchStatus',
        ])
        .default('attendanceDate'),
    ),

    sortOrder: z.preprocess(
      (value) => {
        const raw = s(value).toLowerCase()
        return raw || undefined
      },
      z.enum(['asc', 'desc']).default('desc'),
    ),
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
  id: z.preprocess(
    (value) => s(value),
    z.string().min(1, 'Attendance import id is required'),
  ),
})

const attendanceVerifyOTParamSchema = z.object({
  id: z.preprocess(
    (value) => s(value),
    z.string().min(1, 'OT request id is required'),
  ),
})

function normalizeListAttendanceImportsQuery(data) {
  return listAttendanceImportsQuerySchema.parse(data)
}

function normalizeListAttendanceRecordsQuery(data) {
  return listAttendanceRecordsQuerySchema.parse(data)
}

module.exports = {
  createAttendanceImportSchema,
  listAttendanceImportsQuerySchema,
  listAttendanceRecordsQuerySchema,
  attendanceImportIdParamSchema,
  attendanceVerifyOTParamSchema,
  normalizeListAttendanceImportsQuery,
  normalizeListAttendanceRecordsQuery,
}