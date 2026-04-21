// backend/src/modules/ot/routes/index.js
const express = require('express')
const otController = require('../controllers/ot.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.post(
  '/requests',
  requirePermission('OT_REQUEST_CREATE'),
  otController.createOTRequest
)

router.patch(
  '/requests/:id',
  requirePermission('OT_REQUEST_UPDATE'),
  otController.updateOTRequest
)

router.post(
  '/requests/:id/requester-confirmation',
  requirePermission('OT_REQUEST_UPDATE'),
  otController.requesterConfirmOTRequest
)

router.get(
  '/requests/export',
  requirePermission('OT_REQUEST_VIEW'),
  otController.exportOTRequestsExcel
)

router.get(
  '/requests',
  requirePermission('OT_REQUEST_VIEW'),
  otController.listOTRequests
)

router.get(
  '/approvals/export',
  requirePermission('OT_REQUEST_APPROVE'),
  otController.exportOTApprovalInboxExcel
)

router.get(
  '/approvals',
  requirePermission('OT_REQUEST_APPROVE'),
  otController.listMyApprovalInbox
)

router.post(
  '/approvals/:id/decision',
  requirePermission('OT_REQUEST_APPROVE'),
  otController.decideOTRequest
)

router.get(
  '/requests/allowed-approvers/:employeeId',
  requirePermission('OT_REQUEST_CREATE'),
  otController.getAllowedApproverChain
)

router.get(
  '/requests/:id',
  requirePermission('OT_REQUEST_VIEW'),
  otController.getOTRequestDetail
)

module.exports = router