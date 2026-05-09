// backend/src/modules/payment/validations/paymentExport.validation.js

const { z } = require('zod')

const paymentExportBodySchema = z.object({
  fromDate: z.string().trim().min(1, 'From date is required'),
  toDate: z.string().trim().min(1, 'To date is required'),
  formulaId: z.string().trim().min(1, 'Formula is required'),
})

module.exports = {
  paymentExportBodySchema,
}