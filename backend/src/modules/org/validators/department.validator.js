// backend/src/modules/org/validators/department.validator.js

const { z } = require('zod')
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function toBooleanString(value) {
  if (value === '' || value === undefined || value === null) return ''
  if (value === true || value === 'true') return 'true'
  if (value === false || value === 'false') return 'false'
  return ''
}

const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const createDepartmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'org.department.validation.codeMinLength')
    .max(30, 'org.department.validation.codeTooLong')
    .transform((value) => s(value).toUpperCase()),

  name: z
    .string()
    .trim()
    .min(2, 'org.department.validation.nameMinLength')
    .max(120, 'org.department.validation.nameTooLong'),

  isActive: z.boolean().optional().default(true),
})

const updateDepartmentSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'org.department.validation.codeMinLength')
      .max(30, 'org.department.validation.codeTooLong')
      .transform((value) => s(value).toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(2, 'org.department.validation.nameMinLength')
      .max(120, 'org.department.validation.nameTooLong')
      .optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.isActive !== undefined,
    {
      message: 'org.department.validation.updatePayloadRequired',
    },
  )

const listDepartmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(toBooleanString),

  sortField: z
    .enum(['code', 'name', 'isActive', 'createdAt', 'updatedAt'])
    .optional()
    .default('createdAt'),

  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === -1 || value === '-1' || value === 'desc') return -1
      if (value === 1 || value === '1' || value === 'asc') return 1
      return -1
    }),
})

const departmentLookupQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => {
      const result = toBooleanString(value)
      return result || 'true'
    }),

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

module.exports = {
  objectIdSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentQuerySchema,
  departmentLookupQuerySchema,
}