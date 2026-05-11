// backend/src/modules/auth/validators/account.validation.js

const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'common.validation.invalidId')

const pageQuerySchema = z.coerce.number().int().min(1).default(1)
const limitQuerySchema = z.coerce.number().int().min(1).max(100).default(10)

const optionalBooleanQuerySchema = z
  .enum(['true', 'false', ''])
  .optional()
  .default('')

const listAccountsQuerySchema = z.object({
  page: pageQuerySchema,
  limit: limitQuerySchema,
  search: z.string().trim().optional().default(''),
  isActive: optionalBooleanQuerySchema,
})

const createAccountSchema = z.object({
  loginId: z.string().trim().min(1, 'auth.account.validation.loginIdRequired'),
  displayName: z.string().trim().min(1, 'auth.account.validation.displayNameRequired'),

  password: z
    .string()
    .min(6, 'auth.account.validation.passwordMinLength')
    .max(100, 'auth.account.validation.passwordMaxLength'),

  employeeId: objectIdSchema.nullish(),

  roleIds: z.array(objectIdSchema).optional().default([]),

  directPermissionCodes: z
    .array(z.string().trim().min(1))
    .optional()
    .default([]),

  mustChangePassword: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
})

const updateAccountSchema = z.object({
  loginId: z.string().trim().min(1, 'auth.account.validation.loginIdRequired').optional(),
  displayName: z.string().trim().min(1, 'auth.account.validation.displayNameRequired').optional(),

  employeeId: objectIdSchema.nullable().optional(),

  roleIds: z.array(objectIdSchema).optional(),

  directPermissionCodes: z
    .array(z.string().trim().min(1))
    .optional(),

  mustChangePassword: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(6, 'auth.account.validation.passwordMinLength')
    .max(100, 'auth.account.validation.passwordMaxLength'),

  mustChangePassword: z.boolean().optional().default(true),
})

module.exports = {
  listAccountsQuerySchema,
  createAccountSchema,
  updateAccountSchema,
  resetPasswordSchema,
}