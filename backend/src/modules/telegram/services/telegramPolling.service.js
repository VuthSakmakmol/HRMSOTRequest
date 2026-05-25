// backend/src/modules/telegram/services/telegramPolling.service.js

const telegramBotService = require('./telegramBot.service')

let running = false
let stopping = false
let loopPromise = null
let updateOffset = 0

function s(value) {
  return String(value ?? '').trim()
}

function lower(value) {
  return s(value).toLowerCase()
}

function isPollingEnabled() {
  return (
    lower(process.env.TELEGRAM_MODE) === 'polling' ||
    lower(process.env.TELEGRAM_POLLING_ENABLED) === 'true'
  )
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function logTelegramError(prefix, error) {
  console.warn(prefix, {
    message: error?.message,
    code: error?.code,
    method: error?.method,
    telegramResponse: error?.telegramResponse,
  })
}

async function preparePolling() {
  try {
    await telegramBotService.deleteTelegramWebhook(false)

    const webhookInfo = await telegramBotService.getTelegramWebhookInfo()

    console.info('[TELEGRAM_WEBHOOK_DELETED_FOR_POLLING]', {
      url: webhookInfo?.url || '',
      pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
    })
  } catch (error) {
    logTelegramError('[TELEGRAM_DELETE_WEBHOOK_FAILED]', error)
  }
}

async function pollingLoop() {
  let consecutiveErrors = 0

  console.info('[TELEGRAM_POLLING_STARTED]')

  await preparePolling()

  while (!stopping) {
    try {
      const updates = await telegramBotService.getTelegramUpdates({
        offset: updateOffset,
        timeout: 25,
        limit: 50,
      })

      for (const update of updates) {
        const updateId = Number(update?.update_id)

        if (Number.isFinite(updateId)) {
          updateOffset = Math.max(updateOffset, updateId + 1)
        }

        try {
          await telegramBotService.handleTelegramUpdate(update)
        } catch (error) {
          logTelegramError('[TELEGRAM_UPDATE_HANDLE_FAILED]', error)
        }
      }

      consecutiveErrors = 0
    } catch (error) {
      consecutiveErrors += 1

      logTelegramError('[TELEGRAM_POLLING_FAILED]', error)

      await sleep(Math.min(30000, 2000 * consecutiveErrors))
    }
  }

  running = false
  loopPromise = null

  console.info('[TELEGRAM_POLLING_STOPPED]')
}

async function startTelegramPolling() {
  if (!isPollingEnabled()) {
    console.info('[TELEGRAM_POLLING_DISABLED]', {
      TELEGRAM_MODE: process.env.TELEGRAM_MODE || '',
      TELEGRAM_POLLING_ENABLED: process.env.TELEGRAM_POLLING_ENABLED || '',
    })

    return {
      started: false,
      reason: 'DISABLED',
    }
  }

  if (!telegramBotService.hasTelegramConfig()) {
    console.warn('[TELEGRAM_POLLING_DISABLED] TELEGRAM_BOT_TOKEN is missing')

    return {
      started: false,
      reason: 'BOT_TOKEN_MISSING',
    }
  }

  if (running) {
    return {
      started: false,
      reason: 'ALREADY_RUNNING',
    }
  }

  running = true
  stopping = false

  loopPromise = pollingLoop()

  return {
    started: true,
  }
}

async function stopTelegramPolling() {
  if (!running) {
    return {
      stopped: true,
      reason: 'NOT_RUNNING',
    }
  }

  stopping = true

  await loopPromise

  return {
    stopped: true,
  }
}

module.exports = {
  startTelegramPolling,
  stopTelegramPolling,
}