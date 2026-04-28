// backend/src/modules/shift/routes/shift.routes.js
const express = require('express')
const multer = require('multer')

const shiftController = require('../controllers/shift.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

router.use(requireAuth)

router.get('/lookup', requirePermission('SHIFT_LOOKUP'), shiftController.lookup)

router.get('/', requirePermission('SHIFT_VIEW'), shiftController.list)
router.get('/export', requirePermission('SHIFT_VIEW'), shiftController.exportExcel)
router.get('/import-sample', requirePermission('SHIFT_VIEW'), shiftController.downloadImportSample)
router.post('/import', requirePermission('SHIFT_CREATE'), upload.single('file'), shiftController.importExcel)

router.get('/:id', requirePermission('SHIFT_VIEW'), shiftController.getById)
router.post('/', requirePermission('SHIFT_CREATE'), shiftController.create)
router.patch('/:id', requirePermission('SHIFT_UPDATE'), shiftController.update)

module.exports = router