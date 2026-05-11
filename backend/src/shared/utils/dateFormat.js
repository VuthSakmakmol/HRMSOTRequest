// backend/src/shared/utils/dateFormat.js

function s(value) {
  return String(value ?? '').trim()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s(value))
}

function isDmy(value) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(s(value))
}

function normalizeDateInputToYmd(value) {
  if (!value) return ''

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(
      value.getUTCDate(),
    )}`
  }

  const raw = s(value)

  if (!raw) return ''
  if (isYmd(raw)) return raw

  if (isDmy(raw)) {
    const [dd, mm, yyyy] = raw.split('/')
    return `${yyyy}-${mm}-${dd}`
  }

  const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const dd = pad2(dmyMatch[1])
    const mm = pad2(dmyMatch[2])
    const yyyy = dmyMatch[3]
    return `${yyyy}-${mm}-${dd}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(
      parsed.getUTCDate(),
    )}`
  }

  return ''
}

function formatYmdToDmy(value) {
  const ymd = normalizeDateInputToYmd(value)

  if (!ymd || !isYmd(ymd)) return ''

  const [yyyy, mm, dd] = ymd.split('-')
  return `${dd}/${mm}/${yyyy}`
}

function formatDateTimeToDmy(value) {
  if (!value) return ''

  const parsed = value instanceof Date ? value : new Date(value)

  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return ''
  }

  return `${pad2(parsed.getUTCDate())}/${pad2(
    parsed.getUTCMonth() + 1,
  )}/${parsed.getUTCFullYear()}`
}

function formatDateTimeToDmyHm(value) {
  if (!value) return ''

  const parsed = value instanceof Date ? value : new Date(value)

  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return ''
  }

  return `${pad2(parsed.getUTCDate())}/${pad2(
    parsed.getUTCMonth() + 1,
  )}/${parsed.getUTCFullYear()} ${pad2(parsed.getUTCHours())}:${pad2(parsed.getUTCMinutes())}`
}

module.exports = {
  isYmd,
  isDmy,
  normalizeDateInputToYmd,
  formatYmdToDmy,
  formatDateTimeToDmy,
  formatDateTimeToDmyHm,
}