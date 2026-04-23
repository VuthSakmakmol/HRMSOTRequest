// backend/src/modules/ot/validators/shiftOtOption.validation.js
const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')

const createShiftOTOptionSchema = z.object({
  shiftId: objectIdSchema,

  label: z
    .string()
    .trim()
    .min(1, 'label is required')
    .max(100, 'label must not exceed 100 characters'),

  requestedMinutes: z.coerce
    .number()
    .int()
    .min(1, 'requestedMinutes must be at least 1'),

  calculationPolicyId: objectIdSchema,

  sequence: z.coerce
    .number()
    .int()
    .min(1, 'sequence must be at least 1')
    .default(1),

  isActive: z.coerce.boolean().default(true),
})

const updateShiftOTOptionSchema = createShiftOTOptionSchema.partial()

const listShiftOTOptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(''),
  shiftId: z.string().trim().default(''),
  calculationPolicyId: z.string().trim().default(''),
  isActive: z.string().trim().default(''),
  sortBy: z
    .enum(['createdAt', 'label', 'requestedMinutes', 'sequence', 'isActive'])
    .default('sequence'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

const shiftOTOptionIdParamSchema = z.object({
  id: objectIdSchema,
})

module.exports = {
  createShiftOTOptionSchema,
  updateShiftOTOptionSchema,
  listShiftOTOptionsQuerySchema,
  shiftOTOptionIdParamSchema,
}