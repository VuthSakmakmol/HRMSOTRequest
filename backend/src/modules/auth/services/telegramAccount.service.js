// backend/src/modules/auth/services/telegramAccount.service.js

const crypto = require('crypto')

const Account = require('../models/Account')
const AppError = require('../../../shared/errors/AppError')

const LINK_TOKEN_TTL_MINUTES = 10

function s(value) {
  return String(value ?? '').trim()
}

function cleanTelegramUsername(value) {
  return s(value).replace(/^@+/, '')
}

function accountIdFromAuth(authUser = {}) {
  return s(authUser.accountId || authUser.id || authUser._id)
}

function hashToken(token) {
  return crypto.createHash('sha256').update(s(token)).digest('hex')
}

function createRawToken() {
  return crypto.randomBytes(32).toString('hex')
}

function getBotUsername() {
  return cleanTelegramUsername(process.env.TELEGRAM_BOT_USERNAME)
}

function getConnectUrl(token) {
  const botUsername = getBotUsername()

  if (!botUsername) {
    throw new AppError({
      statusCode: 500,
      code: 'TELEGRAM_BOT_USERNAME_MISSING',
      messageKey: 'telegram.error.botUsernameMissing',
      message: 'TELEGRAM_BOT_USERNAME is missing in backend .env',
    })
  }

  return `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`
}

function getConnectDeepLink(token) {
  const botUsername = getBotUsername()

  if (!botUsername) {
    throw new AppError({
      statusCode: 500,
      code: 'TELEGRAM_BOT_USERNAME_MISSING',
      messageKey: 'telegram.error.botUsernameMissing',
      message: 'TELEGRAM_BOT_USERNAME is missing in backend .env',
    })
  }

  return `tg://resolve?domain=${encodeURIComponent(botUsername)}&start=${encodeURIComponent(token)}`
}

function notFoundError() {
  return new AppError({
    statusCode: 404,
    code: 'ACCOUNT_NOT_FOUND',
    messageKey: 'auth.account.error.notFound',
    message: 'Account not found',
  })
}

function unauthorizedError() {
  return new AppError({
    statusCode: 401,
    code: 'AUTH_UNAUTHORIZED',
    messageKey: 'auth.error.unauthorized',
    message: 'Unauthorized',
  })
}

function presentTelegramStatus(account = {}) {
  const connected = !!account.telegramChatId && account.telegramEnabled === true

  return {
    connected,
    enabled: account.telegramEnabled === true,
    telegramChatId: account.telegramChatId ? String(account.telegramChatId) : '',
    telegramUserId: account.telegramUserId ? String(account.telegramUserId) : '',
    telegramUsername: account.telegramUsername || '',
    telegramFirstName: account.telegramFirstName || '',
    telegramLastName: account.telegramLastName || '',
    telegramLinkedAt: account.telegramLinkedAt || null,
    telegramLastMessageAt: account.telegramLastMessageAt || null,
  }
}

function telegramProfileValues(telegramProfile = {}) {
  return {
    chatId: s(telegramProfile.chatId),
    telegramUserId: s(telegramProfile.telegramUserId),
    telegramUsername: cleanTelegramUsername(telegramProfile.username),
    telegramFirstName: s(telegramProfile.firstName),
    telegramLastName: s(telegramProfile.lastName),
  }
}

async function clearSameTelegramChatFromOtherAccounts(accountId, chatId) {
  const cleanChatId = s(chatId)

  if (!cleanChatId) return

  await Account.updateMany(
    {
      _id: {
        $ne: accountId,
      },
      telegramChatId: cleanChatId,
    },
    {
      $set: {
        telegramChatId: '',
        telegramUserId: '',
        telegramUsername: '',
        telegramFirstName: '',
        telegramLastName: '',
        telegramEnabled: false,
        telegramLinkedAt: null,
        telegramLastMessageAt: null,
        telegramLinkTokenHash: '',
        telegramLinkTokenExpiresAt: null,
      },
    },
  )
}

async function saveTelegramToAccount(account, telegramProfile = {}) {
  const profile = telegramProfileValues(telegramProfile)
  const now = new Date()

  if (!profile.chatId) {
    return {
      ok: false,
      reason: 'TELEGRAM_CHAT_ID_MISSING',
      account: null,
    }
  }

  await clearSameTelegramChatFromOtherAccounts(account._id, profile.chatId)

  account.telegramChatId = profile.chatId
  account.telegramUserId = profile.telegramUserId
  account.telegramUsername = profile.telegramUsername
  account.telegramFirstName = profile.telegramFirstName
  account.telegramLastName = profile.telegramLastName
  account.telegramEnabled = true
  account.telegramLinkedAt = now
  account.telegramLastMessageAt = now
  account.telegramLinkTokenHash = ''
  account.telegramLinkTokenExpiresAt = null

  await account.save()

  return {
    ok: true,
    reason: '',
    account: {
      id: String(account._id),
      accountId: String(account._id),
      loginId: account.loginId,
      displayName: account.displayName,
      employeeId: account.employeeId ? String(account.employeeId) : null,
      telegram: presentTelegramStatus(account),
    },
  }
}

async function getAccountForAuth(authUser = {}) {
  const accountId = accountIdFromAuth(authUser)

  if (!accountId) {
    throw unauthorizedError()
  }

  const account = await Account.findById(accountId)
    .select({
      loginId: 1,
      displayName: 1,
      employeeId: 1,
      isActive: 1,

      telegramChatId: 1,
      telegramUserId: 1,
      telegramUsername: 1,
      telegramFirstName: 1,
      telegramLastName: 1,
      telegramEnabled: 1,
      telegramLinkedAt: 1,
      telegramLastMessageAt: 1,
      telegramLinkTokenExpiresAt: 1,
    })
    .lean()

  if (!account || account.isActive === false) {
    throw notFoundError()
  }

  return account
}

async function getTelegramStatus(authUser = {}) {
  const account = await getAccountForAuth(authUser)

  return presentTelegramStatus(account)
}

async function createTelegramConnectLink(authUser = {}) {
  const accountId = accountIdFromAuth(authUser)

  if (!accountId) {
    throw unauthorizedError()
  }

  const account = await Account.findById(accountId)

  if (!account || account.isActive === false) {
    throw notFoundError()
  }

  const rawToken = createRawToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MINUTES * 60 * 1000)

  account.telegramLinkTokenHash = tokenHash
  account.telegramLinkTokenExpiresAt = expiresAt

  await account.save()

  return {
    connectUrl: getConnectUrl(rawToken),
    connectDeepLink: getConnectDeepLink(rawToken),
    expiresAt,
    expiresInMinutes: LINK_TOKEN_TTL_MINUTES,
    status: presentTelegramStatus(account),
  }
}

async function disconnectTelegram(authUser = {}) {
  const accountId = accountIdFromAuth(authUser)

  if (!accountId) {
    throw unauthorizedError()
  }

  const account = await Account.findById(accountId)

  if (!account || account.isActive === false) {
    throw notFoundError()
  }

  account.telegramChatId = ''
  account.telegramUserId = ''
  account.telegramUsername = ''
  account.telegramFirstName = ''
  account.telegramLastName = ''
  account.telegramEnabled = false
  account.telegramLinkedAt = null
  account.telegramLastMessageAt = null
  account.telegramLinkTokenHash = ''
  account.telegramLinkTokenExpiresAt = null

  await account.save()

  return presentTelegramStatus(account)
}

async function linkTelegramByStartToken(rawToken, telegramProfile = {}) {
  const tokenHash = hashToken(rawToken)
  const now = new Date()

  const account = await Account.findOne({
    telegramLinkTokenHash: tokenHash,
    telegramLinkTokenExpiresAt: {
      $gt: now,
    },
    isActive: true,
  }).select('+telegramLinkTokenHash')

  if (!account) {
    return {
      ok: false,
      reason: 'INVALID_OR_EXPIRED_TOKEN',
      account: null,
    }
  }

  return saveTelegramToAccount(account, telegramProfile)
}

module.exports = {
  getTelegramStatus,
  createTelegramConnectLink,
  disconnectTelegram,
  linkTelegramByStartToken,
}