// backend/src/modules/ot/services/otNotification.service.js

const Account = require('../../auth/models/Account')
const Employee = require('../../org/models/Employee')

const {
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  createNotification,
  buildOTNotification,
} = require('../../notification/services/notification.service')

const {
  sendTelegramForNotification,
} = require('../../telegram/services/telegramNotification.service')

function s(value) {
  return String(value ?? '').trim()
}

function lower(value) {
  return s(value).toLowerCase()
}

function upper(value) {
  return s(value).toUpperCase()
}

function id(value) {
  return value ? String(value) : null
}

function sameId(a, b) {
  const left = s(a)
  const right = s(b)

  return !!left && !!right && left === right
}

function n(value, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function unique(values = []) {
  return [...new Set(values.map(s).filter(Boolean))]
}

function actorAccountId(actor = {}) {
  return id(actor.accountId || actor._id || actor.id)
}

function actorEmployeeId(actor = {}) {
  return id(actor.employeeId)
}

function requestId(otRequest = {}) {
  return id(otRequest._id || otRequest.id)
}

function requestNo(otRequest = {}) {
  return s(otRequest.requestNo)
}

function requestStatus(otRequest = {}) {
  return upper(otRequest.status)
}

function requesterEmployeeId(otRequest = {}) {
  return id(
    otRequest.requesterEmployeeId ||
      otRequest.requester?.employeeId ||
      otRequest.requester?._id ||
      otRequest.requester?.id,
  )
}

function requesterName(otRequest = {}) {
  return s(
    otRequest.requesterName ||
      otRequest.requesterLabel ||
      otRequest.requester?.employeeName ||
      otRequest.requester?.displayName ||
      otRequest.requester?.name ||
      'Requester',
  )
}

function otDate(otRequest = {}) {
  return s(otRequest.otDate)
}

function paidHoursLabel(otRequest = {}) {
  const minutes = Number(
    otRequest.totalRequestPaidMinutes ??
      otRequest.totalMinutes ??
      otRequest.paidMinutes ??
      0,
  )

  if (!Number.isFinite(minutes) || minutes <= 0) return ''

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`

  return `${mins}m`
}

function sortedApprovalSteps(otRequest = {}) {
  const steps =
    otRequest.approvalSteps ||
    otRequest.approverSteps ||
    otRequest.approvalChain ||
    otRequest.approvers ||
    []

  return [...(Array.isArray(steps) ? steps : [])].sort(
    (a, b) => n(a.stepNo || a.sequence || a.order) - n(b.stepNo || b.sequence || b.order),
  )
}

function currentApprovalStep(otRequest = {}) {
  const steps = sortedApprovalSteps(otRequest)
  const currentStepNo = n(
    otRequest.currentApprovalStep ||
      otRequest.currentStepNo ||
      otRequest.approvalContext?.currentApprovalStep,
  )

  if (currentStepNo > 0) {
    const exactStep = steps.find(
      (step) => n(step.stepNo || step.sequence || step.order) === currentStepNo,
    )

    if (exactStep) return exactStep
  }

  return (
    steps.find((step) => step.isCurrent === true) ||
    steps.find((step) => upper(step.status) === 'PENDING') ||
    steps.find((step) => upper(step.status) === 'WAITING') ||
    null
  )
}

function stepApproverEmployeeId(step = {}) {
  return id(
    step.approverEmployeeId ||
      step.employeeId ||
      step.approverId ||
      step.approver?.employeeId ||
      step.approver?._id ||
      step.approver?.id ||
      step.employee?._id ||
      step.employee?.id,
  )
}

function currentApproverEmployeeId(otRequest = {}) {
  const currentStep = currentApprovalStep(otRequest)

  return id(
    otRequest.currentApproverEmployeeId ||
      otRequest.currentApproverId ||
      otRequest.currentApprover?.employeeId ||
      otRequest.currentApprover?._id ||
      otRequest.currentApprover?.id ||
      otRequest.approvalContext?.currentApproverEmployeeId ||
      stepApproverEmployeeId(currentStep),
  )
}

function finalApprovedStep(otRequest = {}) {
  return [...sortedApprovalSteps(otRequest)]
    .reverse()
    .find((step) => upper(step.status) === 'APPROVED')
}

function rejectedStep(otRequest = {}) {
  return [...sortedApprovalSteps(otRequest)]
    .reverse()
    .find((step) => upper(step.status) === 'REJECTED')
}

function acknowledgementSteps(otRequest = {}) {
  return sortedApprovalSteps(otRequest).filter(
    (step) => upper(step.stepType || step.type) === 'ACKNOWLEDGE',
  )
}

function acknowledgementEmployeeIds(otRequest = {}) {
  return unique(acknowledgementSteps(otRequest).map(stepApproverEmployeeId))
}

function basePayload(otRequest = {}) {
  return {
    requestId: requestId(otRequest),
    requestNo: requestNo(otRequest),
    otDate: otDate(otRequest),
    status: requestStatus(otRequest),
    requesterEmployeeId: requesterEmployeeId(otRequest),
    requesterName: requesterName(otRequest),
    currentApproverEmployeeId: currentApproverEmployeeId(otRequest),
    paidHoursLabel: paidHoursLabel(otRequest),
  }
}

function shouldNotifyTarget(target = {}, actor = {}) {
  const recipientAccountId = id(target.recipientAccountId)
  const recipientEmployeeId = id(target.recipientEmployeeId)

  if (!recipientAccountId && !recipientEmployeeId) return false

  if (recipientAccountId && sameId(recipientAccountId, actorAccountId(actor))) {
    return false
  }

  if (recipientEmployeeId && sameId(recipientEmployeeId, actorEmployeeId(actor))) {
    return false
  }

  return true
}

async function safeSendTelegramNotification(notification) {
  try {
    await sendTelegramForNotification(notification)
  } catch (error) {
    console.warn('[TELEGRAM_NOTIFICATION_FAILED]', {
      notificationId: notification?._id || notification?.id,
      type: notification?.type,
      message: error?.message,
      code: error?.code,
      telegramResponse: error?.telegramResponse,
    })
  }
}

async function getEmployeeById(employeeId) {
  const cleanEmployeeId = id(employeeId)

  if (!cleanEmployeeId) return null

  return Employee.findById(cleanEmployeeId)
    .select('_id employeeCode displayName isActive')
    .lean()
}

async function resolveRecipientTargetsByEmployeeId(recipientEmployeeId) {
  const employeeId = id(recipientEmployeeId)

  if (!employeeId) return []

  const employee = await getEmployeeById(employeeId)

  const employeeCode = lower(employee?.employeeCode)
  const displayName = s(employee?.displayName)

  const or = [
    {
      employeeId,
    },
  ]

  if (employeeCode) {
    or.push({
      loginId: employeeCode,
    })
  }

  if (displayName) {
    or.push({
      displayName,
    })
  }

  const accounts = await Account.find({
    isActive: true,
    $or: or,
  })
    .select('_id loginId displayName employeeId isActive')
    .lean()

  const targets = []

  for (const account of accounts) {
    targets.push({
      recipientAccountId: id(account._id),
      recipientEmployeeId: employeeId,
      loginId: s(account.loginId),
      displayName: s(account.displayName),
      matchType: account.employeeId ? 'ACCOUNT_EMPLOYEE_LINK' : 'ACCOUNT_LOGIN_FALLBACK',
    })
  }

  if (!targets.length) {
    targets.push({
      recipientAccountId: null,
      recipientEmployeeId: employeeId,
      loginId: '',
      displayName: '',
      matchType: 'EMPLOYEE_ONLY',
    })
  }

  const uniqueTargets = new Map()

  for (const target of targets) {
    const key = `${target.recipientAccountId || ''}:${target.recipientEmployeeId || ''}`

    if (!uniqueTargets.has(key)) {
      uniqueTargets.set(key, target)
    }
  }

  return [...uniqueTargets.values()]
}

async function createOTEmployeeNotification({
  type,
  recipientEmployeeId,
  actor,
  otRequest,
  title,
  message,
  payload = {},
} = {}) {
  const targets = await resolveRecipientTargetsByEmployeeId(recipientEmployeeId)
  const created = []

  for (const target of targets) {
    if (!shouldNotifyTarget(target, actor)) {
      continue
    }

    const item = await createNotification(
      buildOTNotification({
        type,

        recipientAccountId: target.recipientAccountId,
        recipientEmployeeId: target.recipientEmployeeId,

        actorAccountId: actorAccountId(actor),
        actorEmployeeId: actorEmployeeId(actor),

        otRequest,

        title,
        message,

        payload: {
          ...basePayload(otRequest),
          recipientAccountId: target.recipientAccountId,
          recipientEmployeeId: target.recipientEmployeeId,
          recipientLoginId: target.loginId,
          recipientDisplayName: target.displayName,
          recipientMatchType: target.matchType,
          ...payload,
        },

        channels: [NOTIFICATION_CHANNELS.IN_APP],
      }),
    )

    created.push(item)

    await safeSendTelegramNotification(item)
  }

  if (created.length) {
    console.info('[OT_NOTIFICATION_CREATED]', {
      requestNo: requestNo(otRequest),
      type,
      recipients: created.map((item) => ({
        accountId: item.recipientAccountId,
        employeeId: item.recipientEmployeeId,
      })),
    })
  } else {
    console.warn('[OT_NOTIFICATION_SKIPPED] No notification target created', {
      requestNo: requestNo(otRequest),
      type,
      recipientEmployeeId: id(recipientEmployeeId),
      actorAccountId: actorAccountId(actor),
      actorEmployeeId: actorEmployeeId(actor),
      targets,
    })
  }

  return created
}

async function createOTEmployeeNotifications({
  type,
  recipientEmployeeIds = [],
  actor,
  otRequest,
  title,
  message,
  payload = {},
} = {}) {
  const created = []

  for (const employeeId of unique(recipientEmployeeIds)) {
    const result = await createOTEmployeeNotification({
      type,
      recipientEmployeeId: employeeId,
      actor,
      otRequest,
      title,
      message,
      payload,
    })

    created.push(...result)
  }

  return created
}

async function notifyOTCreated(otRequest = {}, actor = {}) {
  const approverEmployeeId = currentApproverEmployeeId(otRequest)

  if (!approverEmployeeId) {
    console.warn('[OT_NOTIFICATION_SKIPPED] No current approver found', {
      requestId: requestId(otRequest),
      requestNo: requestNo(otRequest),
      currentApproverEmployeeId: otRequest.currentApproverEmployeeId,
      currentApprovalStep: otRequest.currentApprovalStep,
      approvalSteps: sortedApprovalSteps(otRequest).map((step) => ({
        stepNo: step.stepNo,
        sequence: step.sequence,
        order: step.order,
        stepType: step.stepType,
        status: step.status,
        approverEmployeeId: step.approverEmployeeId,
        employeeId: step.employeeId,
        approverName: step.approverName,
      })),
    })

    return []
  }

  const no = requestNo(otRequest)

  return createOTEmployeeNotification({
    type: NOTIFICATION_TYPES.OT_APPROVAL_REQUIRED,
    recipientEmployeeId: approverEmployeeId,
    actor,
    otRequest,
    title: 'OT approval required',
    message: `${requesterName(otRequest)} submitted OT request ${no}.`,
    payload: {
      action: 'APPROVE_REQUIRED',
      recipientEmployeeId: approverEmployeeId,
    },
  })
}

async function notifyAcknowledgementRequired(otRequest = {}, actor = {}) {
  const employeeIds = acknowledgementEmployeeIds(otRequest)
  const no = requestNo(otRequest)

  if (!employeeIds.length) {
    console.warn('[OT_NOTIFICATION_SKIPPED] No acknowledgement recipients found', {
      requestId: requestId(otRequest),
      requestNo: no,
      approvalSteps: sortedApprovalSteps(otRequest).map((step) => ({
        stepNo: step.stepNo,
        stepType: step.stepType,
        status: step.status,
        approverEmployeeId: step.approverEmployeeId,
        approverName: step.approverName,
      })),
    })

    return []
  }

  return createOTEmployeeNotifications({
    type: NOTIFICATION_TYPES.OT_ACKNOWLEDGEMENT_REQUIRED,
    recipientEmployeeIds: employeeIds,
    actor,
    otRequest,
    title: 'OT acknowledgement required',
    message: `OT request ${no} has been approved and needs your acknowledgement.`,
    payload: {
      action: 'ACKNOWLEDGEMENT_REQUIRED',
      acknowledgementEmployeeIds: employeeIds,
    },
  })
}

async function notifyOTAfterDecision(otRequest = {}, actor = {}) {
  const status = requestStatus(otRequest)
  const no = requestNo(otRequest)

  if (status === 'PENDING') {
    const approverEmployeeId = currentApproverEmployeeId(otRequest)

    if (!approverEmployeeId) {
      console.warn('[OT_NOTIFICATION_SKIPPED] No next approver found', {
        requestId: requestId(otRequest),
        requestNo: no,
        approvalSteps: sortedApprovalSteps(otRequest).map((step) => ({
          stepNo: step.stepNo,
          sequence: step.sequence,
          order: step.order,
          stepType: step.stepType,
          status: step.status,
          approverEmployeeId: step.approverEmployeeId,
          employeeId: step.employeeId,
          approverName: step.approverName,
        })),
      })

      return []
    }

    return createOTEmployeeNotification({
      type: NOTIFICATION_TYPES.OT_APPROVAL_REQUIRED,
      recipientEmployeeId: approverEmployeeId,
      actor,
      otRequest,
      title: 'OT approval required',
      message: `OT request ${no} is waiting for your approval.`,
      payload: {
        action: 'NEXT_APPROVER_REQUIRED',
        recipientEmployeeId: approverEmployeeId,
      },
    })
  }

  if (status === 'APPROVED') {
    const step = finalApprovedStep(otRequest)

    const results = []

    results.push(
      ...(await createOTEmployeeNotification({
        type: NOTIFICATION_TYPES.OT_APPROVED,
        recipientEmployeeId: requesterEmployeeId(otRequest),
        actor,
        otRequest,
        title: 'OT request approved',
        message: `OT request ${no} has been approved.`,
        payload: {
          action: 'APPROVED',
          approvedBy: s(step?.approverName),
        },
      })),
    )

    results.push(...(await notifyAcknowledgementRequired(otRequest, actor)))

    return results
  }

  if (status === 'REJECTED') {
    const step = rejectedStep(otRequest)

    return createOTEmployeeNotification({
      type: NOTIFICATION_TYPES.OT_REJECTED,
      recipientEmployeeId: requesterEmployeeId(otRequest),
      actor,
      otRequest,
      title: 'OT request rejected',
      message: `OT request ${no} has been rejected.`,
      payload: {
        action: 'REJECTED',
        rejectedBy: s(step?.approverName),
      },
    })
  }

  return []
}

module.exports = {
  notifyOTCreated,
  notifyOTAfterDecision,
  notifyAcknowledgementRequired,
}