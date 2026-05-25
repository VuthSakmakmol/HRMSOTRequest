// backend/src/modules/ot/services/otRealtime.service.js

const Account = require('../../auth/models/Account')
const {
  emitOTRequestChanged,
} = require('../../realtime/realtime.service')

function s(value) {
  return String(value ?? '').trim()
}

function id(value) {
  return value ? String(value) : ''
}

function unique(values = []) {
  return [...new Set(values.map(s).filter(Boolean))]
}

function requestId(otRequest = {}) {
  return id(otRequest._id || otRequest.id)
}

function requestNo(otRequest = {}) {
  return s(otRequest.requestNo)
}

function status(otRequest = {}) {
  return s(otRequest.status).toUpperCase()
}

function actorAccountId(actor = {}) {
  return id(actor.accountId || actor._id || actor.id)
}

function actorEmployeeId(actor = {}) {
  return id(actor.employeeId)
}

function requesterEmployeeId(otRequest = {}) {
  return id(
    otRequest.requesterEmployeeId ||
      otRequest.requester?.employeeId ||
      otRequest.requester?._id ||
      otRequest.requester?.id,
  )
}

function currentApproverEmployeeId(otRequest = {}) {
  return id(
    otRequest.currentApproverEmployeeId ||
      otRequest.currentApproverId ||
      otRequest.currentApprover?.employeeId ||
      otRequest.currentApprover?._id ||
      otRequest.currentApprover?.id ||
      otRequest.approvalContext?.currentApproverEmployeeId,
  )
}

function approvalStepEmployeeIds(otRequest = {}) {
  const steps =
    otRequest.approvalSteps ||
    otRequest.approverSteps ||
    otRequest.approvalChain ||
    otRequest.approvers ||
    []

  if (!Array.isArray(steps)) return []

  return steps
    .flatMap((step) => [
      step?.approverEmployeeId,
      step?.employeeId,
      step?.approverId,
      step?.approver?.employeeId,
      step?.approver?._id,
      step?.approver?.id,
      step?.employee?._id,
      step?.employee?.id,
    ])
    .map(id)
    .filter(Boolean)
}

async function accountIdsByEmployeeIds(employeeIds = []) {
  const ids = unique(employeeIds)

  if (!ids.length) return []

  const accounts = await Account.find({
    isActive: true,
    employeeId: {
      $in: ids,
    },
  })
    .select('_id employeeId')
    .lean()

  return accounts.map((account) => String(account._id))
}

async function emitOTChanged(otRequest = {}, actor = {}, action = 'UPDATED') {
  const employeeIds = unique([
    actorEmployeeId(actor),
    requesterEmployeeId(otRequest),
    currentApproverEmployeeId(otRequest),
    ...approvalStepEmployeeIds(otRequest),
  ])

  const accountIds = unique([
    actorAccountId(actor),
    ...(await accountIdsByEmployeeIds(employeeIds)),
  ])

  return emitOTRequestChanged({
    requestId: requestId(otRequest),
    requestNo: requestNo(otRequest),
    status: status(otRequest),
    action,

    actorAccountId: actorAccountId(actor),
    actorEmployeeId: actorEmployeeId(actor),

    accountIds,
    employeeIds,

    payload: {
      requestId: requestId(otRequest),
      requestNo: requestNo(otRequest),
      status: status(otRequest),
    },
  })
}

module.exports = {
  emitOTChanged,
}