// backend/src/modules/ot/validators/otPolicy.validation.js
const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')

const roundMethodSchema = z.enum(['FLOOR', 'CEIL', 'NEAREST'])

const createOTCalculationPolicySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'code is required')
    .max(50, 'code must not exceed 50 characters'),

  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(150, 'name must not exceed 150 characters'),

  description: z
    .string()
    .trim()
    .max(1000, 'description must not exceed 1000 characters')
    .default(''),

  minEligibleMinutes: z.coerce
    .number()
    .int()
    .min(0, 'minEligibleMinutes must be at least 0'),

  roundUnitMinutes: z.coerce
    .number()
    .int()
    .min(1, 'roundUnitMinutes must be at least 1'),

  roundMethod: roundMethodSchema,

  graceAfterShiftEndMinutes: z.coerce
    .number()
    .int()
    .min(0, 'graceAfterShiftEndMinutes must be at least 0')
    .default(0),

  allowPreShiftOT: z.coerce.boolean().default(false),
  allowPostShiftOT: z.coerce.boolean().default(true),
  capByRequestedMinutes: z.coerce.boolean().default(true),
  treatForgetScanInAsPending: z.coerce.boolean().default(true),
  treatForgetScanOutAsPending: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
})

const updateOTCalculationPolicySchema = createOTCalculationPolicySchema.partial()

const listOTCalculationPoliciesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(''),
  isActive: z.string().trim().default(''),
  roundMethod: z.string().trim().default(''),
  sortBy: z
    .enum(['createdAt', 'code', 'name', 'roundMethod', 'roundUnitMinutes', 'isActive'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const otCalculationPolicyIdParamSchema = z.object({
  id: objectIdSchema,
})

module.exports = {
  createOTCalculationPolicySchema,
  updateOTCalculationPolicySchema,
  listOTCalculationPoliciesQuerySchema,
  otCalculationPolicyIdParamSchema,
}