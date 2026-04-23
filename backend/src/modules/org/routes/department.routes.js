// backend/src/modules/org/routes/department.routes.js
const express = require('express')
const multer = require('multer')

const controller = require('../controllers/department.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.use(requireAuth)

router.get('/lookup', requirePermission('DEPARTMENT_LOOKUP'), controller.lookup)

router.get('/', requirePermission('DEPARTMENT_VIEW'), controller.list)
router.get('/export', requirePermission('DEPARTMENT_VIEW'), controller.exportExcel)
router.get('/import-sample', requirePermission('DEPARTMENT_VIEW'), controller.downloadImportSample)
router.post('/import', requirePermission('DEPARTMENT_CREATE'), upload.single('file'), controller.importExcel)
router.get('/:id', requirePermission('DEPARTMENT_VIEW'), controller.getById)
router.post('/', requirePermission('DEPARTMENT_CREATE'), controller.create)
router.patch('/:id', requirePermission('DEPARTMENT_UPDATE'), controller.update)

module.exports = router