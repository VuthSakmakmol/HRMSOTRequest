// frontend/src/shared/utils/dateFormat.js

function s(value) {
  return String(value ?? '').trim()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

export function parseDate(value) {
  if (!value) return null

  if (value instanceof Date) {
    return isValidDate(value) ? value : null
  }

  const raw = s(value)
  if (!raw) return null

  // Full ISO datetime should keep time.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const date = new Date(raw)
    return isValidDate(date) ? date : null
  }

  // Date-only API format: YYYY-MM-DD
  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    const year = Number(ymdMatch[1])
    const month = Number(ymdMatch[2])
    const day = Number(ymdMatch[3])

    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date
    }

    return null
  }

  // UI date format: DD/MM/YYYY
  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2])
    const year = Number(dmyMatch[3])

    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date
    }

    return null
  }

  const date = new Date(raw)
  return isValidDate(date) ? date : null
}

export function formatDate(value, fallback = '-') {
  const date = parseDate(value)
  if (!date) return fallback

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function formatDateTime(value, fallback = '-') {
  const date = parseDate(value)
  if (!date) return fallback

  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function formatTime(value, fallback = '-') {
  const raw = s(value)
  if (!raw) return fallback

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})/)
  if (hhmm) {
    return `${pad2(hhmm[1])}:${hhmm[2]}`
  }

  const date = parseDate(value)
  if (!date) return fallback

  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function toApiDate(value, fallback = '') {
  const date = parseDate(value)
  if (!date) return fallback

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function todayApiDate() {
  return toApiDate(new Date())
}

export function formatDateRange(from, to, fallback = '-') {
  const start = formatDate(from, '')
  const end = formatDate(to, '')

  if (start && end) return `${start} - ${end}`
  if (start) return start
  if (end) return end

  return fallback
}