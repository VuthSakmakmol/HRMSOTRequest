// backend/src/modules/telegram/services/telegramBot.service.js

const telegramAccountService = require('../../auth/services/telegramAccount.service')

function s(value) {
  return String(value ?? '').trim()
}

function n(value, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function getBotToken() {
  return s(process.env.TELEGRAM_BOT_TOKEN)
}

function getHrmsUrl() {
  return (
    s(process.env.TELEGRAM_HRMS_URL) ||
    s(process.env.CLIENT_URL) ||
    s(process.env.FRONTEND_URL) ||
    'http://localhost:5173'
  )
}

function getHrmsReturnUrl() {
  return s(process.env.TELEGRAM_HRMS_RETURN_URL) || getHrmsUrl()
}

function hasTelegramConfig() {
  return !!getBotToken()
}

function getTelegramApiUrl(method) {
  return `https://api.telegram.org/bot${getBotToken()}/${method}`
}

async function callTelegram(method, payload = {}) {
  const token = getBotToken()

  if (!token) {
    const error = new Error('TELEGRAM_BOT_TOKEN is missing')
    error.code = 'TELEGRAM_BOT_TOKEN_MISSING'
    throw error
  }

  const res = await fetch(getTelegramApiUrl(method), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || data?.ok === false) {
    const error = new Error(data?.description || `Telegram API failed: ${method}`)
    error.code = 'TELEGRAM_API_FAILED'
    error.method = method
    error.telegramResponse = data
    throw error
  }

  return data?.result
}

async function deleteTelegramWebhook(dropPendingUpdates = false) {
  return callTelegram('deleteWebhook', {
    drop_pending_updates: dropPendingUpdates === true,
  })
}

async function getTelegramWebhookInfo() {
  return callTelegram('getWebhookInfo', {})
}

async function getTelegramUpdates({ offset = 0, timeout = 25, limit = 50 } = {}) {
  const payload = {
    timeout: n(timeout, 25),
    limit: n(limit, 50),
    allowed_updates: ['message', 'callback_query'],
  }

  if (n(offset, 0) > 0) {
    payload.offset = n(offset, 0)
  }

  const result = await callTelegram('getUpdates', payload)

  return Array.isArray(result) ? result : []
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const cleanChatId = s(chatId)
  const cleanText = s(text)

  if (!cleanChatId || !cleanText) {
    return null
  }

  const payload = {
    chat_id: cleanChatId,
    text: cleanText,
    disable_web_page_preview: options.disableWebPagePreview !== false,
  }

  if (options.replyMarkup) {
    payload.reply_markup = options.replyMarkup
  }

  return callTelegram('sendMessage', payload)
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  const cleanId = s(callbackQueryId)

  if (!cleanId) return null

  const payload = {
    callback_query_id: cleanId,
  }

  if (s(text)) {
    payload.text = s(text)
  }

  return callTelegram('answerCallbackQuery', payload)
}

function getMessage(update = {}) {
  return update.message || update.edited_message || null
}

function getCallbackQuery(update = {}) {
  return update.callback_query || null
}

function getChatIdFromMessage(message = {}) {
  return s(message?.chat?.id)
}

function getChatIdFromCallback(callbackQuery = {}) {
  return s(callbackQuery?.message?.chat?.id)
}

function getTelegramProfileFromMessage(message = {}) {
  const from = message?.from || {}
  const chat = message?.chat || {}

  return {
    chatId: getChatIdFromMessage(message),
    telegramUserId: s(from.id),
    username: s(from.username || chat.username),
    firstName: s(from.first_name || chat.first_name),
    lastName: s(from.last_name || chat.last_name),
  }
}

function getTelegramProfileFromCallback(callbackQuery = {}) {
  const from = callbackQuery?.from || {}
  const chat = callbackQuery?.message?.chat || {}

  return {
    chatId: getChatIdFromCallback(callbackQuery),
    telegramUserId: s(from.id),
    username: s(from.username || chat.username),
    firstName: s(from.first_name || chat.first_name),
    lastName: s(from.last_name || chat.last_name),
  }
}

function parseStartToken(text = '') {
  const clean = s(text)

  const match = clean.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i)

  if (!match) return ''

  return s(match[1]).split(/\s+/)[0] || ''
}

function isEmployeeCodeText(text = '') {
  const clean = s(text)

  if (!clean) return false
  if (clean.startsWith('/')) return false

  return /^[a-zA-Z0-9._-]{2,30}$/.test(clean)
}

function openHrmsReplyMarkup(options = {}) {
  const text = s(options.text) || 'Open HRMS'
  const url = s(options.url) || getHrmsUrl()

  return {
    inline_keyboard: [
      [
        {
          text,
          url,
        },
      ],
    ],
  }
}

function employeeConfirmReplyMarkup(employeeId) {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Yes, this is me',
          callback_data: `tg_emp_yes:${employeeId}`,
        },
      ],
      [
        {
          text: '❌ No',
          callback_data: 'tg_emp_no',
        },
      ],
    ],
  }
}

async function replyAskEmployeeId(chatId) {
  return sendTelegramMessage(
    chatId,
    [
      'Welcome to HRMS OT Request.',
      '',
      'Please enter your Employee ID to connect Telegram alerts.',
      '',
      'សូមបញ្ចូលលេខសម្គាល់បុគ្គលិករបស់អ្នក ដើម្បីភ្ជាប់ Telegram Alert។',
    ].join('\n'),
  )
}

async function replyConnectFromHRMS(chatId) {
  return sendTelegramMessage(
    chatId,
    [
      'Please connect Telegram from HRMS, or enter your Employee ID here.',
      '',
      'Open HRMS → Profile → Connect Telegram.',
      '',
      'Or just send your Employee ID to this bot.',
    ].join('\n'),
    {
      replyMarkup: openHrmsReplyMarkup(),
    },
  )
}

async function replyEmployeeNotFound(chatId) {
  return sendTelegramMessage(
    chatId,
    [
      'Employee ID not found.',
      '',
      'Please check your Employee ID and try again.',
      '',
      'រកមិនឃើញលេខសម្គាល់បុគ្គលិក។ សូមពិនិត្យ ហើយព្យាយាមម្តងទៀត។',
    ].join('\n'),
  )
}

async function replyAccountNotFound(chatId, employee = {}) {
  return sendTelegramMessage(
    chatId,
    [
      'Employee found, but no active HRMS account is linked to this employee.',
      '',
      `Employee: ${employee.displayName || '-'}`,
      `ID: ${employee.employeeCode || '-'}`,
      '',
      'Please contact HR/Admin to create or link your account first.',
    ].join('\n'),
  )
}

async function handleEmployeeCodeMessage(message = {}) {
  const chatId = getChatIdFromMessage(message)
  const employeeCode = s(message.text)

  if (!chatId) {
    return {
      ok: false,
      reason: 'CHAT_ID_MISSING',
    }
  }

  const result = await telegramAccountService.findEmployeeForTelegramByCode(employeeCode)

  if (!result.ok) {
    if (result.reason === 'EMPLOYEE_NOT_FOUND') {
      await replyEmployeeNotFound(chatId)
      return result
    }

    if (result.reason === 'ACCOUNT_NOT_FOUND_FOR_EMPLOYEE') {
      await replyAccountNotFound(chatId, result.employee)
      return result
    }

    await sendTelegramMessage(
      chatId,
      [
        'Could not verify this Employee ID.',
        '',
        'Please try again or contact HR/Admin.',
      ].join('\n'),
    )

    return result
  }

  const employee = result.employee || {}

  await sendTelegramMessage(
    chatId,
    [
      'Please confirm your identity:',
      '',
      `Employee ID: ${employee.employeeCode || '-'}`,
      `Name: ${employee.displayName || '-'}`,
      `Department: ${employee.departmentName || '-'}`,
      `Position: ${employee.positionName || '-'}`,
      '',
      'Is this you?',
    ].join('\n'),
    {
      replyMarkup: employeeConfirmReplyMarkup(employee.employeeId),
    },
  )

  return {
    ok: true,
    reason: '',
    employee,
  }
}

async function handleStartCommand(message = {}) {
  const chatId = getChatIdFromMessage(message)
  const token = parseStartToken(message.text)

  if (!chatId) {
    return {
      ok: false,
      reason: 'CHAT_ID_MISSING',
    }
  }

  // Old professional HRMS token flow still works.
  if (token) {
    const result = await telegramAccountService.linkTelegramByStartToken(
      token,
      getTelegramProfileFromMessage(message),
    )

    if (!result.ok) {
      await sendTelegramMessage(
        chatId,
        [
          'Telegram link expired or invalid.',
          '',
          'Please go back to HRMS and click Connect Telegram again.',
          '',
          'Or send your Employee ID to connect directly.',
        ].join('\n'),
        {
          replyMarkup: openHrmsReplyMarkup(),
        },
      )

      return result
    }

    await sendTelegramMessage(
      chatId,
      [
        '✅ Telegram connected successfully.',
        '',
        `Account: ${result.account.displayName || result.account.loginId}`,
        '',
        'You will now receive HRMS OT notifications here.',
        '',
        'Tap the button below to go back to OT Request.',
      ].join('\n'),
      {
        replyMarkup: openHrmsReplyMarkup({
          text: 'Back to OT Request',
          url: getHrmsReturnUrl(),
        }),
      },
    )

    console.info('[TELEGRAM_LINKED]', {
      mode: 'START_TOKEN',
      accountId: result.account.accountId,
      loginId: result.account.loginId,
      chatId,
    })

    return result
  }

  // New simple self-connect flow.
  await replyAskEmployeeId(chatId)

  return {
    ok: true,
    reason: 'ASK_EMPLOYEE_ID',
  }
}

async function handleEmployeeConfirmCallback(callbackQuery = {}) {
  const callbackId = s(callbackQuery.id)
  const data = s(callbackQuery.data)
  const chatId = getChatIdFromCallback(callbackQuery)

  if (!chatId) {
    return {
      ok: false,
      reason: 'CHAT_ID_MISSING',
    }
  }

  if (data === 'tg_emp_no') {
    await answerCallbackQuery(callbackId, 'Cancelled')
    await sendTelegramMessage(
      chatId,
      [
        'No problem.',
        '',
        'Please send your correct Employee ID again.',
      ].join('\n'),
    )

    return {
      ok: true,
      reason: 'CANCELLED',
    }
  }

  if (!data.startsWith('tg_emp_yes:')) {
    await answerCallbackQuery(callbackId)
    return {
      ok: true,
      ignored: true,
      reason: 'UNKNOWN_CALLBACK',
    }
  }

  const employeeId = s(data.replace('tg_emp_yes:', ''))

  const result = await telegramAccountService.linkTelegramByEmployeeId(
    employeeId,
    getTelegramProfileFromCallback(callbackQuery),
  )

  if (!result.ok) {
    await answerCallbackQuery(callbackId, 'Could not connect Telegram')

    if (result.reason === 'ACCOUNT_NOT_FOUND_FOR_EMPLOYEE') {
      await sendTelegramMessage(
        chatId,
        [
          'Could not connect Telegram.',
          '',
          'No active HRMS account is linked to this employee.',
          'Please contact HR/Admin.',
        ].join('\n'),
      )

      return result
    }

    await sendTelegramMessage(
      chatId,
      [
        'Could not connect Telegram.',
        '',
        'Please send your Employee ID again or contact HR/Admin.',
      ].join('\n'),
    )

    return result
  }

  await answerCallbackQuery(callbackId, 'Telegram connected')

  await sendTelegramMessage(
    chatId,
    [
      '✅ Telegram connected successfully.',
      '',
      `Account: ${result.account.displayName || result.account.loginId}`,
      '',
      'You will now receive HRMS OT notifications here.',
      '',
      'Tap the button below to go back to OT Request.',
    ].join('\n'),
    {
      replyMarkup: openHrmsReplyMarkup({
        text: 'Back to OT Request',
        url: getHrmsReturnUrl(),
      }),
    },
  )

  console.info('[TELEGRAM_LINKED]', {
    mode: 'EMPLOYEE_SELF_CONFIRM',
    accountId: result.account.accountId,
    loginId: result.account.loginId,
    employeeId: result.account.employeeId,
    chatId,
  })

  return result
}

async function handleTelegramUpdate(update = {}) {
  const callbackQuery = getCallbackQuery(update)

  if (callbackQuery) {
    return handleEmployeeConfirmCallback(callbackQuery)
  }

  const message = getMessage(update)

  if (!message) {
    return {
      ok: true,
      ignored: true,
      reason: 'NO_MESSAGE',
    }
  }

  const chatId = getChatIdFromMessage(message)
  const text = s(message.text)

  if (text.startsWith('/start')) {
    return handleStartCommand(message)
  }

  if (isEmployeeCodeText(text)) {
    return handleEmployeeCodeMessage(message)
  }

  if (chatId) {
    await replyConnectFromHRMS(chatId)
  }

  return {
    ok: true,
    ignored: true,
    reason: 'UNSUPPORTED_MESSAGE',
  }
}

module.exports = {
  hasTelegramConfig,

  callTelegram,
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  getTelegramUpdates,
  sendTelegramMessage,

  handleTelegramUpdate,
}