// backend/src/modules/ot/services/otExecutionSettings.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')
const OTExecutionSettings = require('../models/OTExecutionSettings')

const SETTINGS_KEY = 'GLOBAL'
const DEFAULT_TIME_ZONE = process.env.OT_EXECUTION_TIME_ZONE || 'Asia/Phnom_Penh'
const TIME_24_HOUR_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function s(value) {
  return String(value ?? '').trim()
}

function actorAccountId(authUser = {}) {
  const value = authUser?.accountId || authUser?.id || authUser?._id
  return mongoose.Types.ObjectId.isValid(String(value || '')) ? value : null
}

function toIso(value) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeTime(value) {
  const time = s(value)
  return TIME_24_HOUR_PATTERN.test(time) ? time : null
}

function normalizeYmd(value) {
  const ymd = s(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
}

function timeToMinutes(value) {
  const time = normalizeTime(value)
  if (!time) return null

  const [hours, minutes] = time.split(':').map(Number)
  return (hours * 60) + minutes
}

function getTimeZoneClock(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now)

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    )

    const hours = Number(values.hour)
    const minutes = Number(values.minute)

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null

    return {
      time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      minutes: (hours * 60) + minutes,
    }
  } catch (_error) {
    // This fallback is only for an invalid server time-zone configuration. The default
    // time zone is valid in Node's standard ICU data.
    const hours = now.getHours()
    const minutes = now.getMinutes()

    return {
      time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      minutes: (hours * 60) + minutes,
    }
  }
}

function getTimeZoneYmd(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    )

    const year = String(values.year || '')
    const month = String(values.month || '').padStart(2, '0')
    const day = String(values.day || '').padStart(2, '0')
    const ymd = `${year}-${month}-${day}`

    return normalizeYmd(ymd)
  } catch (_error) {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

function isWithinDailyTimeRange(nowMinutes, startMinutes, endMinutes) {
  if (
    !Number.isInteger(nowMinutes) ||
    !Number.isInteger(startMinutes) ||
    !Number.isInteger(endMinutes) ||
    startMinutes === endMinutes
  ) {
    return false
  }

  // Same-day range, e.g. 08:00 -> 17:30.
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes
  }

  // Overnight range, e.g. 20:00 -> 02:00.
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes
}

function getDefaultValues() {
  return {
    key: SETTINGS_KEY,
    requestSubmissionOpen: true,
    requestDailyTimeLimitEnabled: false,
    requestDailyStartTime: null,
    requestDailyEndTime: null,
    // Keep legacy behaviour after deployment until an administrator deliberately blocks it.
    allowBackdatedRequests: true,
    paymentRequiresFinalApproval: false,
  }
}

async function getOrCreateSettings() {
  try {
    return await OTExecutionSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $setOnInsert: getDefaultValues() },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).lean()
  } catch (error) {
    // Two first requests can try to insert the singleton at the same time.
    if (error?.code === 11000) {
      const existing = await OTExecutionSettings.findOne({ key: SETTINGS_KEY }).lean()
      if (existing) return existing
    }

    throw error
  }
}

function getRequestSubmissionState(settings = {}, now = new Date()) {
  const manualOpen = settings?.requestSubmissionOpen !== false
  const dailyTimeLimitEnabled = settings?.requestDailyTimeLimitEnabled === true
  const dailyStartTime = normalizeTime(settings?.requestDailyStartTime)
  const dailyEndTime = normalizeTime(settings?.requestDailyEndTime)

  const base = {
    dailyTimeLimitEnabled,
    dailyStartTime,
    dailyEndTime,
    // Existing documents created before this setting have no value. Treat them as allowed
    // so rollout does not unexpectedly block requesters.
    allowBackdatedRequests: settings?.allowBackdatedRequests !== false,
    currentDate: getTimeZoneYmd(now),
    requestTimeZone: DEFAULT_TIME_ZONE,
  }

  if (!manualOpen) {
    return {
      isAllowed: false,
      code: 'REQUEST_SUBMISSIONS_CLOSED',
      messageKey: 'ot.execution.requestSubmissionsClosed',
      message: 'OT request submissions are currently closed by system control.',
      ...base,
    }
  }

  if (!dailyTimeLimitEnabled) {
    return {
      isAllowed: true,
      code: 'REQUEST_SUBMISSIONS_OPEN',
      messageKey: 'ot.execution.requestSubmissionsOpen',
      message: 'OT request submissions are open.',
      ...base,
    }
  }

  const startMinutes = timeToMinutes(dailyStartTime)
  const endMinutes = timeToMinutes(dailyEndTime)

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return {
      isAllowed: false,
      code: 'REQUEST_DAILY_TIME_LIMIT_INVALID',
      messageKey: 'ot.execution.requestDailyTimeLimitInvalid',
      message: 'The daily OT request hours are not configured correctly.',
      ...base,
    }
  }

  const clock = getTimeZoneClock(now)
  const isAllowed = isWithinDailyTimeRange(clock?.minutes, startMinutes, endMinutes)

  if (!isAllowed) {
    return {
      isAllowed: false,
      code: 'REQUEST_DAILY_TIME_LIMIT_CLOSED',
      messageKey: 'ot.execution.requestDailyTimeLimitClosed',
      message: 'OT requests can only be submitted during the configured daily hours.',
      currentTime: clock?.time || null,
      ...base,
    }
  }

  return {
    isAllowed: true,
    code: 'REQUEST_DAILY_TIME_LIMIT_OPEN',
    messageKey: 'ot.execution.requestDailyTimeLimitOpen',
    message: 'OT request submissions are open during the configured daily hours.',
    currentTime: clock?.time || null,
    ...base,
  }
}

function mapSettings(settings = {}) {
  const requestAccess = getRequestSubmissionState(settings)

  return {
    id: s(settings?._id),
    key: SETTINGS_KEY,

    requestSubmissionOpen: settings?.requestSubmissionOpen !== false,
    requestDailyTimeLimitEnabled: settings?.requestDailyTimeLimitEnabled === true,
    requestDailyStartTime: normalizeTime(settings?.requestDailyStartTime),
    requestDailyEndTime: normalizeTime(settings?.requestDailyEndTime),
    allowBackdatedRequests: settings?.allowBackdatedRequests !== false,
    requestTimeZone: DEFAULT_TIME_ZONE,

    paymentRequiresFinalApproval: settings?.paymentRequiresFinalApproval === true,
    paymentApprovalMode:
      settings?.paymentRequiresFinalApproval === true
        ? 'REQUIRE_FINAL_APPROVAL'
        : 'ALLOW_WITHOUT_FINAL_APPROVAL',

    requestAccess,
    updatedBy: s(settings?.updatedBy) || null,
    createdAt: toIso(settings?.createdAt),
    updatedAt: toIso(settings?.updatedAt),
  }
}

async function getSettings() {
  const settings = await getOrCreateSettings()
  return mapSettings(settings)
}

async function getRequestAccess() {
  const settings = await getOrCreateSettings()
  return getRequestSubmissionState(settings)
}

async function getPaymentApprovalRule() {
  const settings = await getOrCreateSettings()

  return {
    paymentRequiresFinalApproval: settings?.paymentRequiresFinalApproval === true,
    paymentApprovalMode:
      settings?.paymentRequiresFinalApproval === true
        ? 'REQUIRE_FINAL_APPROVAL'
        : 'ALLOW_WITHOUT_FINAL_APPROVAL',
  }
}

async function updateSettings(payload = {}, authUser = {}) {
  const dailyTimeLimitEnabled = payload.requestDailyTimeLimitEnabled === true

  const next = {
    requestSubmissionOpen: payload.requestSubmissionOpen !== false,
    requestDailyTimeLimitEnabled: dailyTimeLimitEnabled,
    requestDailyStartTime: dailyTimeLimitEnabled
      ? normalizeTime(payload.requestDailyStartTime)
      : null,
    requestDailyEndTime: dailyTimeLimitEnabled
      ? normalizeTime(payload.requestDailyEndTime)
      : null,
    allowBackdatedRequests: payload.allowBackdatedRequests !== false,
    paymentRequiresFinalApproval: payload.paymentRequiresFinalApproval === true,
    updatedBy: actorAccountId(authUser),
  }

  const settings = await OTExecutionSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: next,
      // Clear the old one-off date-range fields. They have no effect in this version.
      $unset: {
        requestWindowEnabled: '',
        requestWindowStartAt: '',
        requestWindowEndAt: '',
      },
    },
    {
      new: true,
      upsert: true,
      // The $set payload already contains every active setting. Disable automatic
      // defaults here so MongoDB never receives conflicting $set/$setOnInsert paths.
      setDefaultsOnInsert: false,
      runValidators: true,
    },
  ).lean()

  return mapSettings(settings)
}

function throwRequestSubmissionDenied(state = {}) {
  throw new AppError({
    statusCode: 403,
    code: state.code,
    messageKey: state.messageKey,
    message: state.message,
    params: {
      dailyStartTime: state.dailyStartTime,
      dailyEndTime: state.dailyEndTime,
      requestTimeZone: state.requestTimeZone,
    },
  })
}

async function assertOTRequestSubmissionAllowed() {
  const state = await getRequestAccess()

  if (state.isAllowed) return state

  throwRequestSubmissionDenied(state)
}

// Used only while creating a brand-new request. The selected OT date is a plain
// YYYY-MM-DD value, so lexical comparison is correct and avoids server-local timezone
// conversion errors near midnight.
async function assertNewOTRequestAllowed(otDate) {
  const state = await getRequestAccess()

  if (!state.isAllowed) {
    throwRequestSubmissionDenied(state)
  }

  const requestedDate = normalizeYmd(otDate)
  const currentDate = normalizeYmd(state.currentDate)

  if (
    state.allowBackdatedRequests === false &&
    requestedDate &&
    currentDate &&
    requestedDate < currentDate
  ) {
    throw new AppError({
      statusCode: 403,
      code: 'BACKDATED_OT_REQUESTS_NOT_ALLOWED',
      messageKey: 'ot.execution.backdatedRequestsNotAllowed',
      message: `Creating a new OT request for ${requestedDate} is not allowed. Past-date OT requests are currently closed.`,
      params: {
        otDate: requestedDate,
        currentDate,
        requestTimeZone: state.requestTimeZone,
      },
    })
  }

  return state
}

module.exports = {
  getSettings,
  getRequestAccess,
  getPaymentApprovalRule,
  updateSettings,
  assertOTRequestSubmissionAllowed,
  assertNewOTRequestAllowed,
  getRequestSubmissionState,
  getTimeZoneYmd,
  isWithinDailyTimeRange,
}
