// backend/src/modules/calendar/services/dayType.service.js

const Holiday = require('../models/Holiday')

const DAY_TYPES = Object.freeze({
  WORKING_DAY: 'WORKING_DAY',
  SUNDAY: 'SUNDAY',
  HOLIDAY: 'HOLIDAY',
})

function s(value) {
  return String(value ?? '').trim()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toYmd(value) {
  if (!value) return ''

  if (typeof value === 'string') {
    const raw = s(value)

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(
        parsed.getUTCDate(),
      )}`
    }

    return ''
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(
      value.getUTCDate(),
    )}`
  }

  return ''
}

function ymdToUtcRange(ymd) {
  const raw = toYmd(ymd)

  if (!raw) {
    return {
      start: null,
      end: null,
    }
  }

  const [year, month, day] = raw.split('-').map(Number)

  return {
    start: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0)),
  }
}

function isSunday(ymd) {
  const raw = toYmd(ymd)
  if (!raw) return false

  const [year, month, day] = raw.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

  return date.getUTCDay() === 0
}

async function findHolidayByDate(ymd) {
  const raw = toYmd(ymd)
  if (!raw) return null

  const { start, end } = ymdToUtcRange(raw)

  if (!start || !end) return null

  return Holiday.findOne({
    isActive: { $ne: false },
    date: {
      $gte: start,
      $lt: end,
    },
  })
    .lean()
    .exec()
}

async function classifyDayType(dateInput) {
  const date = toYmd(dateInput)

  if (!date) {
    return {
      date: '',
      dayType: DAY_TYPES.WORKING_DAY,
      isHoliday: false,
      isSunday: false,
      holiday: null,
    }
  }

  const holiday = await findHolidayByDate(date)
  const sunday = isSunday(date)

  if (holiday) {
    return {
      date,
      dayType: DAY_TYPES.HOLIDAY,
      isHoliday: true,
      isSunday: sunday,
      holiday: {
        id: String(holiday._id),
        code: s(holiday.code),
        name: s(holiday.name),
        date,
      },
    }
  }

  if (sunday) {
    return {
      date,
      dayType: DAY_TYPES.SUNDAY,
      isHoliday: false,
      isSunday: true,
      holiday: null,
    }
  }

  return {
    date,
    dayType: DAY_TYPES.WORKING_DAY,
    isHoliday: false,
    isSunday: false,
    holiday: null,
  }
}

module.exports = {
  DAY_TYPES,
  toYmd,
  classifyDayType,
}