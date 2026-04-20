// backend/src/modules/auth/validators/account.validation.js
const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId')

const permissionCodeSchema = z.string().trim().min(1).transform(v => v.toUpperCase())

const createAccountSchema = z.object({
  loginId: z.string().trim().min(3, 'Login ID must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().trim().min(1, 'Display name is required'),
  employeeId: objectIdSchema.nullable().optional(),
  roleIds: z.array(objectIdSchema).optional().default([]),
  directPermissionCodes: z.array(permissionCodeSchema).optional().default([]),
  mustChangePassword: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const updateAccountSchema = z.object({
  loginId: z.string().trim().min(3, 'Login ID must be at least 3 characters').optional(),
  displayName: z.string().trim().min(1, 'Display name is required').optional(),
  employeeId: objectIdSchema.nullable().optional(),
  roleIds: z.array(objectIdSchema).optional(),
  directPermissionCodes: z.array(permissionCodeSchema).optional(),
  mustChangePassword: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  mustChangePassword: z.boolean().optional(),
})

const listAccountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(''),
  isActive: z.enum(['true', 'false', '']).optional().default(''),
})

module.exports = {
  createAccountSchema,
  updateAccountSchema,
  resetPasswordSchema,
  listAccountsQuerySchema,
}