// backend/src/modules/calendar/validators/holiday.validation.js
const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')

function parseDateOnly(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const dt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  if (Number.isNaN(dt.getTime())) return null

  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null
  }

  return dt
}

const dateOnlySchema = z
  .string()
  .trim()
  .refine((value) => !!parseDateOnly(value), 'Invalid date')
  .transform((value) => parseDateOnly(value))

const booleanLikeOptionalSchema = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1

    const v = String(value).trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(v)) return true
    if (['false', '0', 'no', 'n'].includes(v)) return false

    return undefined
  })

const createHolidaySchema = z.object({
  date: dateOnlySchema,
  code: z.string().trim().max(50).optional().default(''),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(1000).optional().default(''),
  isPaidHoliday: booleanLikeOptionalSchema.default(true),
  isActive: booleanLikeOptionalSchema.default(true),
})

const updateHolidaySchema = z
  .object({
    date: dateOnlySchema.optional(),
    code: z.string().trim().max(50).optional(),
    name: z.string().trim().min(1, 'Name is required').max(150).optional(),
    description: z.string().trim().max(1000).optional(),
    isPaidHoliday: booleanLikeOptionalSchema,
    isActive: booleanLikeOptionalSchema,
  })
  .refine((data) => Object.keys(data).length > 0, 'No fields to update')

const listHolidayQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().optional().default(''),
  isActive: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === '') return undefined
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value === 1

      const v = String(value).trim().toLowerCase()
      if (['true', '1', 'yes', 'y'].includes(v)) return true
      if (['false', '0', 'no', 'n'].includes(v)) return false

      return undefined
    }),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  sortBy: z.enum(['date', 'name', 'createdAt']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

const holidayIdParamSchema = z.object({
  id: objectIdSchema,
})

module.exports = {
  createHolidaySchema,
  updateHolidaySchema,
  listHolidayQuerySchema,
  holidayIdParamSchema,
}