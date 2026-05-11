// backend/src/modules/calendar/validators/holiday.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

function s(value) {
  return String(value ?? '').trim()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function toBoolean(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  const text = String(value).trim().toLowerCase()

  if (['true', '1', 'yes', 'y', 'active'].includes(text)) return true
  if (['false', '0', 'no', 'n', 'inactive'].includes(text)) return false

  return defaultValue
}

function toBooleanString(value) {
  if (value === '' || value === undefined || value === null) return ''
  if (value === true || value === 'true' || value === 1 || value === '1') return 'true'
  if (value === false || value === 'false' || value === 0 || value === '0') return 'false'

  const text = String(value).trim().toLowerCase()

  if (['yes', 'y', 'active'].includes(text)) return 'true'
  if (['no', 'n', 'inactive'].includes(text)) return 'false'

  return ''
}

function parseDateOnly(value) {
  const raw = s(value)

  if (!raw) return null

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

  if (Number.isNaN(date.getTime())) return null

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const dateOnlySchema = z
  .string()
  .trim()
  .refine((value) => !!parseDateOnly(value), 'calendar.holiday.validation.dateInvalid')
  .transform((value) => parseDateOnly(value))

const optionalDateQuerySchema = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine(
    (value) => !value || !!parseDateOnly(value),
    'calendar.holiday.validation.dateInvalid',
  )

const createHolidaySchema = z.object({
  date: dateOnlySchema,

  code: z
    .string()
    .trim()
    .max(50, 'calendar.holiday.validation.codeTooLong')
    .optional()
    .default('')
    .transform((value) => s(value).toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'calendar.holiday.validation.nameRequired')
    .max(150, 'calendar.holiday.validation.nameTooLong'),

  description: z
    .string()
    .trim()
    .max(1000, 'calendar.holiday.validation.descriptionTooLong')
    .optional()
    .default(''),

  isPaidHoliday: booleanLike.transform((value) => toBoolean(value, true)),

  isActive: booleanLike.transform((value) => toBoolean(value, true)),
})

const updateHolidaySchema = z
  .object({
    date: dateOnlySchema.optional(),

    code: z
      .string()
      .trim()
      .max(50, 'calendar.holiday.validation.codeTooLong')
      .transform((value) => s(value).toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, 'calendar.holiday.validation.nameRequired')
      .max(150, 'calendar.holiday.validation.nameTooLong')
      .optional(),

    description: z
      .string()
      .trim()
      .max(1000, 'calendar.holiday.validation.descriptionTooLong')
      .optional(),

    isPaidHoliday: booleanLike.transform((value) => toBoolean(value)).optional(),

    isActive: booleanLike.transform((value) => toBoolean(value)).optional(),
  })
  .refine(
    (value) =>
      value.date !== undefined ||
      value.code !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.isPaidHoliday !== undefined ||
      value.isActive !== undefined,
    {
      message: 'calendar.holiday.validation.updatePayloadRequired',
    },
  )

const listHolidayQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .transform(toBooleanString),

  year: z.coerce.number().int().min(2000).max(2100).optional(),

  month: z.coerce.number().int().min(1).max(12).optional(),

  fromDate: optionalDateQuerySchema,

  toDate: optionalDateQuerySchema,

  sortField: z
    .enum(['date', 'name', 'code', 'isPaidHoliday', 'isActive', 'createdAt', 'updatedAt'])
    .optional()
    .default('date'),

  // Backward compatible with old frontend using sortBy
  sortBy: z
    .enum(['date', 'name', 'code', 'isPaidHoliday', 'isActive', 'createdAt', 'updatedAt'])
    .optional(),

  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === 1 || value === '1' || value === 'asc') return 1
      if (value === -1 || value === '-1' || value === 'desc') return -1
      return -1
    }),
})

const holidayLookupQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .transform((value) => {
      const result = toBooleanString(value)
      return result || 'true'
    }),

  year: z.coerce.number().int().min(2000).max(2100).optional(),

  month: z.coerce.number().int().min(1).max(12).optional(),

  fromDate: optionalDateQuerySchema,

  toDate: optionalDateQuerySchema,

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const resolveDayTypeQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .refine((value) => !!parseDateOnly(value), 'calendar.holiday.validation.dateInvalid'),
})

const holidayIdParamSchema = z.object({
  id: objectIdSchema,
})

function normalizeListQuery(raw = {}) {
  const parsed = listHolidayQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    isActive: parsed.isActive,
    year: parsed.year,
    month: parsed.month,
    fromDate: parsed.fromDate,
    toDate: parsed.toDate,
    sortField: parsed.sortBy || parsed.sortField || 'date',
    sortOrder: parsed.sortOrder,
  }
}

function normalizeLookupQuery(raw = {}) {
  const parsed = holidayLookupQuerySchema.parse(raw)

  return {
    search: parsed.search,
    isActive: parsed.isActive,
    year: parsed.year,
    month: parsed.month,
    fromDate: parsed.fromDate,
    toDate: parsed.toDate,
    limit: parsed.limit,
  }
}

module.exports = {
  parseDateOnly,
  objectIdSchema,
  createHolidaySchema,
  updateHolidaySchema,
  listHolidayQuerySchema,
  holidayLookupQuerySchema,
  normalizeListQuery,
  normalizeLookupQuery,
  resolveDayTypeQuerySchema,
  holidayIdParamSchema,
}