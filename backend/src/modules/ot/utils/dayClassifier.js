// backend/src/modules/ot/utils/dayClassifier.js

function toTrimmedString(value) {
  return String(value ?? '').trim()
}

function normalizeHolidaySet(holidays = []) {
  return new Set(
    (Array.isArray(holidays) ? holidays : [])
      .map((d) => toTrimmedString(d))
      .filter(Boolean)
  )
}

function parseDateOnly(dateInput) {
  const raw = toTrimmedString(dateInput)
  if (!raw) return null

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }

  return utc
}

function formatDateOnly(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDayType(dateInput, options = {}) {
  const date = parseDateOnly(dateInput)
  if (!date) {
    const err = new Error('Invalid otDate. Expected YYYY-MM-DD.')
    err.status = 400
    throw err
  }

  const ymd = formatDateOnly(date)
  const holidaySet = normalizeHolidaySet(options.holidays)

  if (holidaySet.has(ymd)) {
    return 'HOLIDAY'
  }

  const dayOfWeek = date.getUTCDay()
  if (dayOfWeek === 0) {
    return 'SUNDAY'
  }

  return 'WORKING_DAY'
}

module.exports = {
  parseDateOnly,
  formatDateOnly,
  getDayType,
}