// backend/src/modules/calendar/routes/holiday.routes.js

const express = require('express')
const multer = require('multer')

const holidayController = require('../controllers/holiday.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

router.use(requireAuth)

/**
 * Fixed routes must stay before "/:id"
 *
 * Lookup routes are used by:
 * - HolidayDatePicker
 * - OT request date logic
 * - Approval / Acknowledge filters
 * - Payment internal calendar check
 *
 * These should use HOLIDAY_LOOKUP, not HOLIDAY_VIEW.
 */
router.get(
  '/lookup',
  requirePermission('HOLIDAY_LOOKUP'),
  holidayController.lookup,
)

router.get(
  '/resolve-day-type',
  requirePermission('HOLIDAY_LOOKUP'),
  holidayController.resolveDayType,
)

/**
 * Excel export/import permissions are separated from normal view/create.
 */
router.get(
  '/export',
  requirePermission('HOLIDAY_EXPORT'),
  holidayController.exportExcel,
)

router.get(
  '/import-sample',
  requirePermission('HOLIDAY_IMPORT'),
  holidayController.downloadImportSample,
)

router.post(
  '/import',
  requirePermission('HOLIDAY_IMPORT'),
  upload.single('file'),
  holidayController.importExcel,
)

/**
 * Full Calendar page routes.
 */
router.get(
  '/',
  requirePermission('HOLIDAY_VIEW'),
  holidayController.list,
)

router.get(
  '/:id',
  requirePermission('HOLIDAY_VIEW'),
  holidayController.getById,
)

router.post(
  '/',
  requirePermission('HOLIDAY_CREATE'),
  holidayController.create,
)

router.patch(
  '/:id',
  requirePermission('HOLIDAY_UPDATE'),
  holidayController.update,
)

module.exports = router