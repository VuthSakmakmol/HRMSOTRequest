// backend/src/modules/telegram/services/telegramNotification.service.js

const Account = require('../../auth/models/Account')
const telegramBotService = require('./telegramBot.service')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function id(value) {
  return value ? String(value) : ''
}

function isLocalUrl(url) {
  const clean = s(url).toLowerCase()

  return (
    clean.includes('localhost') ||
    clean.includes('127.0.0.1') ||
    clean.includes('0.0.0.0')
  )
}

function isValidTelegramButtonUrl(url) {
  const clean = s(url)

  if (!clean) return false
  if (isLocalUrl(clean)) return false

  return /^https?:\/\/[^\s]+$/i.test(clean)
}

function getHrmsReturnUrl() {
  return (
    s(process.env.TELEGRAM_HRMS_RETURN_URL) ||
    s(process.env.TELEGRAM_HRMS_URL) ||
    s(process.env.CLIENT_URL) ||
    s(process.env.FRONTEND_URL) ||
    ''
  )
}

function openOTRequestReplyMarkup() {
  const url = getHrmsReturnUrl()

  if (!isValidTelegramButtonUrl(url)) {
    return null
  }

  return {
    inline_keyboard: [
      [
        {
          text: 'Open OT Request',
          url,
        },
      ],
    ],
  }
}

function notificationTypeLabel(type) {
  const clean = upper(type)

  const labels = {
    OT_APPROVAL_REQUIRED: 'OT approval required',
    OT_APPROVED: 'OT request approved',
    OT_REJECTED: 'OT request rejected',
    OT_REQUESTER_CONFIRMATION_REQUIRED: 'OT confirmation required',
    OT_REQUESTER_CONFIRMED: 'Requester confirmed OT',
    OT_REQUESTER_DISAGREED: 'Requester disagreed OT',
    OT_ACKNOWLEDGEMENT_REQUIRED: 'OT acknowledgement required',
  }

  return labels[clean] || s(type) || 'HRMS notification'
}

function buildTelegramText(notification = {}) {
  const payload = notification.payload || {}

  const title = s(notification.title) || notificationTypeLabel(notification.type)
  const message = s(notification.message)

  const requestNo = s(payload.requestNo || notification.requestNo)
  const otDate = s(payload.otDate || notification.otDate)
  const requesterName = s(payload.requesterName)
  const paidHoursLabel = s(payload.paidHoursLabel)
  const status = s(payload.status)

  const lines = [
    `🔔 ${title}`,
  ]

  if (message) {
    lines.push('', message)
  }

  const details = []

  if (requestNo) details.push(`Request: ${requestNo}`)
  if (otDate) details.push(`Date: ${otDate}`)
  if (requesterName) details.push(`Requester: ${requesterName}`)
  if (paidHoursLabel) details.push(`OT time: ${paidHoursLabel}`)
  if (status) details.push(`Status: ${status}`)

  if (details.length) {
    lines.push('', ...details)
  }

  lines.push('', 'Please open HRMS to review.')

  return lines.join('\n')
}

async function resolveRecipientAccount(notification = {}) {
  const recipientAccountId = id(notification.recipientAccountId)
  const recipientEmployeeId = id(notification.recipientEmployeeId)

  if (recipientAccountId) {
    const account = await Account.findOne({
      _id: recipientAccountId,
      isActive: true,
    })
      .select(
        '_id loginId displayName employeeId telegramChatId telegramEnabled telegramUsername telegramUserId telegramLastMessageAt',
      )
      .lean()

    if (account) return account
  }

  if (recipientEmployeeId) {
    return Account.findOne({
      employeeId: recipientEmployeeId,
      isActive: true,
    })
      .select(
        '_id loginId displayName employeeId telegramChatId telegramEnabled telegramUsername telegramUserId telegramLastMessageAt',
      )
      .lean()
  }

  return null
}

async function markTelegramLastMessageAt(accountId) {
  if (!accountId) return

  await Account.updateOne(
    {
      _id: accountId,
    },
    {
      $set: {
        telegramLastMessageAt: new Date(),
      },
    },
  )
}

async function sendTelegramForNotification(notification = {}) {
  const account = await resolveRecipientAccount(notification)

  if (!account) {
    return {
      sent: false,
      reason: 'RECIPIENT_ACCOUNT_NOT_FOUND',
    }
  }

  if (account.telegramEnabled !== true || !s(account.telegramChatId)) {
    return {
      sent: false,
      reason: 'TELEGRAM_NOT_CONNECTED',
      accountId: String(account._id),
    }
  }

  const text = buildTelegramText(notification)

  await telegramBotService.sendTelegramMessage(account.telegramChatId, text, {
    replyMarkup: openOTRequestReplyMarkup(),
  })

  await markTelegramLastMessageAt(account._id)

  console.info('[TELEGRAM_NOTIFICATION_SENT]', {
    notificationId: id(notification._id || notification.id),
    type: notification.type,
    accountId: String(account._id),
    loginId: account.loginId,
    chatId: account.telegramChatId,
  })

  return {
    sent: true,
    accountId: String(account._id),
  }
}

module.exports = {
  sendTelegramForNotification,
}