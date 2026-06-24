// backend/src/modules/ot/routes/index.js

const express = require('express')

const otController = require('../controllers/ot.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const shiftOtOptionRoutes = require('./shiftOtOption.routes')
const otPolicyRoutes = require('./otPolicy.routes')
const dashboardRoutes = require('./dashboard.routes')
const otExecutionSettingsRoutes = require('./otExecutionSettings.routes')

const router = express.Router()

router.use(requireAuth)

router.use('/dashboard', dashboardRoutes)
router.use('/policies', otPolicyRoutes)
router.use('/shift-options', shiftOtOptionRoutes)
router.use('/execution-settings', otExecutionSettingsRoutes)

// Fixed request routes must stay before '/requests/:id'
router.get(
  '/requests/export',
  requirePermission('OT_REQUEST_VIEW'),
  otController.exportOTRequestsExcel,
)

router.get(
  '/requests/allowed-approvers/:employeeId',
  requirePermission('OT_REQUEST_CREATE'),
  otController.getAllowedApproverChain,
)

router.get(
  '/requests/unavailable-employees',
  requirePermission('OT_REQUEST_CREATE'),
  otController.listUnavailableOTEmployees,
)

router.post(
  '/requests',
  requirePermission('OT_REQUEST_CREATE'),
  otController.createOTRequest,
)

router.get(
  '/requests',
  requirePermission('OT_REQUEST_VIEW'),
  otController.listOTRequests,
)

router.get(
  '/requests/:id',
  requirePermission('OT_REQUEST_VIEW'),
  otController.getOTRequestDetail,
)

router.patch(
  '/requests/:id',
  requirePermission('OT_REQUEST_UPDATE'),
  otController.updateOTRequest,
)

router.delete(
  '/requests/:id',
  requirePermission('OT_REQUEST_DELETE'),
  otController.deleteOTRequest,
)

router.post(
  '/requests/:id/cancel',
  requirePermission('OT_REQUEST_UPDATE'),
  otController.cancelOTRequest,
)


// Approval routes
router.get(
  '/approvals/export',
  requirePermission('OT_REQUEST_APPROVE'),
  otController.exportOTApprovalInboxExcel,
)

router.get(
  '/approvals',
  requirePermission('OT_REQUEST_APPROVE'),
  otController.listMyApprovalInbox,
)

router.post(
  '/approvals/:id/decision',
  requirePermission('OT_REQUEST_APPROVE'),
  otController.decideOTRequest,
)

// Acknowledgement routes
router.get(
  '/acknowledgements',
  requirePermission('OT_REQUEST_ACKNOWLEDGE'),
  otController.listMyAcknowledgementInbox,
)

// Backward-compatible route for current frontend.
// Later frontend should call: /ot/shift-options/lookup?shiftId=&otDate=
router.get(
  '/shift-options/by-shift/:shiftId',
  requirePermission('OT_REQUEST_CREATE'),
  otController.getShiftOTOptionsByShift,
)

module.exports = router