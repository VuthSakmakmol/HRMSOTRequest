// backend/src/modules/org/validators/productionLine.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

function isObjectId(value) {
  return mongoose.isValidObjectId(String(value || '').trim())
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function optionalCleanString(max = 500) {
  return z
    .preprocess((value) => cleanString(value), z.string().max(max))
    .optional()
}

const objectIdSchema = z
  .string()
  .trim()
  .refine(isObjectId, 'Invalid id')

const createProductionLineSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Line code is required')
    .max(30, 'Line code is too long')
    .transform((value) => value.toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'Line name is required')
    .max(120, 'Line name is too long'),

  departmentId: objectIdSchema,

  positionIds: z.array(objectIdSchema).optional().default([]),

  description: optionalCleanString(500),

  isActive: z.boolean().optional().default(true),
})

const updateProductionLineSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Line code is required')
    .max(30, 'Line code is too long')
    .transform((value) => value.toUpperCase())
    .optional(),

  name: z
    .string()
    .trim()
    .min(1, 'Line name is required')
    .max(120, 'Line name is too long')
    .optional(),

  departmentId: objectIdSchema.optional(),

  positionIds: z.array(objectIdSchema).optional(),

  description: optionalCleanString(500),

  isActive: z.boolean().optional(),
})

const listProductionLineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),

  search: z
    .preprocess((value) => cleanString(value), z.string())
    .optional()
    .default(''),

  isActive: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all'),

  departmentId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isObjectId(value), 'Invalid department id'),

  sortField: z
    .enum(['code', 'name', 'createdAt', 'updatedAt'])
    .optional()
    .default('code'),

  sortOrder: z.coerce.number().optional().default(1),
})

const productionLineLookupQuerySchema = z.object({
  search: z
    .preprocess((value) => cleanString(value), z.string())
    .optional()
    .default(''),

  departmentId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isObjectId(value), 'Invalid department id'),

  isActive: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('true'),

  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

module.exports = {
  createProductionLineSchema,
  updateProductionLineSchema,
  listProductionLineQuerySchema,
  productionLineLookupQuerySchema,
}