// backend/src/modules/org/routes/employee.routes.js
const express = require('express')
const multer = require('multer')

const employeeController = require('../controllers/employee.controller')
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

router.get(
  '/lookup',
  requirePermission('EMPLOYEE_LOOKUP'),
  employeeController.lookup,
)

router.get(
  '/',
  requirePermission('EMPLOYEE_VIEW'),
  employeeController.list,
)

router.get(
  '/export',
  requirePermission('EMPLOYEE_VIEW'),
  employeeController.exportExcel,
)

router.get(
  '/import-sample',
  requirePermission('EMPLOYEE_VIEW'),
  employeeController.downloadImportSample,
)

router.post(
  '/import',
  requirePermission('EMPLOYEE_CREATE'),
  upload.single('file'),
  employeeController.importExcel,
)

router.get(
  '/org-chart/tree',
  requirePermission('EMPLOYEE_VIEW'),
  employeeController.getOrgTree,
)

router.get(
  '/:id/org-chart',
  requirePermission('EMPLOYEE_VIEW'),
  employeeController.getOrgChart,
)

router.get(
  '/:id',
  requirePermission('EMPLOYEE_VIEW'),
  employeeController.getById,
)

router.post(
  '/',
  requirePermission('EMPLOYEE_CREATE'),
  employeeController.create,
)

router.patch(
  '/:id',
  requirePermission('EMPLOYEE_UPDATE'),
  employeeController.update,
)

module.exports = router