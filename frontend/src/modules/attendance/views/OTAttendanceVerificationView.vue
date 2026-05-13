<!-- frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue -->
<script setup>
// frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'

import {
  searchOTVerificationRequests,
  verifyOTAttendance,
} from '@/modules/attendance/attendance.api'

const route = useRoute()
const toast = useToast()
const { t } = useI18n()

const loading = ref(false)
const searchLoading = ref(false)
const payload = ref(null)

const verificationDate = ref('')
const requestOptions = ref([])
const selectedOtRequestId = ref('')
const selectedRequestStatus = ref('')
const tableSearch = ref('')
const tableCategory = ref('')

let requestSearchTimer = null
let suppressRequestSearch = false
let currentVerifyRequestId = 0

const requestStatusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('attendance.statusLabel.pending'), value: 'PENDING' },
  { label: t('ot.status.approved'), value: 'APPROVED' },
  { label: t('ot.status.rejected'), value: 'REJECTED' },
  { label: t('attendance.statusLabel.cancelled'), value: 'CANCELLED' },
])

const categoryOptions = computed(() => [
  { label: t('attendance.verification.allResults'), value: '' },
  { label: t('attendance.verification.matched'), value: 'MATCH' },
  { label: t('attendance.verification.acceptedByPolicy'), value: 'MATCH_WITHOUT_EXACT_OUT' },
  { label: t('attendance.verification.needsCheck'), value: 'MISMATCH' },
  { label: t('attendance.verification.forgetScanIn'), value: 'FORGET_SCAN_IN' },
  { label: t('attendance.verification.forgetScanOut'), value: 'FORGET_SCAN_OUT' },
  { label: t('attendance.verification.otStaffAbsent'), value: 'ABSENT_APPROVED' },
  { label: t('attendance.verification.wrongShift'), value: 'SHIFT_MISMATCH' },
  { label: t('attendance.verification.notInOtStaff'), value: 'NOT_APPROVED' },
  { label: t('attendance.verification.notEligible'), value: 'NOT_ELIGIBLE' },
])

const routeOtRequestId = computed(() => {
  return (
    String(route.params.otRequestId || '').trim() ||
    String(route.params.id || '').trim() ||
    String(route.query.otRequestId || '').trim() ||
    String(route.query.id || '').trim()
  )
})

const activeOtRequestId = computed(() => {
  return String(selectedOtRequestId.value || routeOtRequestId.value || '').trim()
})

const otRequest = computed(() => payload.value?.otRequest || {})
const verification = computed(() => payload.value?.verification || {})

const requestStatus = computed(() => upper(otRequest.value?.status))
const isFinalApprovedRequest = computed(() => requestStatus.value === 'APPROVED')

const attendedEmployees = computed(() => asArray(verification.value?.attendedEmployees))
const absentFromApproved = computed(() => asArray(verification.value?.absentFromApproved))
const attendedButNotApproved = computed(() => asArray(verification.value?.attendedButNotApproved))
const shiftMismatchEmployees = computed(() => asArray(verification.value?.shiftMismatchEmployees))
const pendingReviewEmployees = computed(() => asArray(verification.value?.pendingReviewEmployees))
const notEligibleEmployees = computed(() => asArray(verification.value?.notEligibleEmployees))

const requestTimingMode = computed(() => {
  return upper(
    verification.value?.shiftOtOptionTimingMode ||
      otRequest.value?.shiftOtOptionTimingMode ||
      '',
  )
})

const requestRequestedOtLabel = computed(() =>
  formatMinutesLabel(
    verification.value?.requestedMinutes ??
      otRequest.value?.requestedMinutes ??
      otRequest.value?.totalMinutes ??
      0,
  ),
)

const requestShiftTime = computed(() => {
  const start = displayTime(otRequest.value?.shiftStartTime)
  const end = displayTime(otRequest.value?.shiftEndTime)

  return `${start} - ${end}`
})

const requestExpectedOtTime = computed(() => {
  const start = displayTime(
    verification.value?.expectedOtStartTime,
    otRequest.value?.expectedOtStartTime,
    otRequest.value?.requestStartTime,
    otRequest.value?.startTime,
  )

  const end = displayTime(
    verification.value?.expectedOtEndTime,
    otRequest.value?.expectedOtEndTime,
    otRequest.value?.requestEndTime,
    otRequest.value?.endTime,
  )

  return `${start} - ${end}`
})

const requestPolicyLabel = computed(() => {
  const code = String(
    verification.value?.policyCode ||
      otRequest.value?.otCalculationPolicySnapshot?.code ||
      '',
  ).trim()

  const name = String(
    verification.value?.policyName ||
      otRequest.value?.otCalculationPolicySnapshot?.name ||
      '',
  ).trim()

  if (code && name) return ` ${name}`

  return code || name || '-'
})

const verificationRows = computed(() => {
  const map = new Map()

  function put(row, category, fallbackResult = '') {
    const key = getEmployeeKey(row)
    if (!key) return

    const normalized = normalizeVerificationRow(row, category, fallbackResult)

    const existing = map.get(key)
    if (!existing) {
      map.set(key, normalized)
      return
    }

    const existingPriority = categoryPriority(existing.category)
    const nextPriority = categoryPriority(normalized.category)

    if (nextPriority >= existingPriority) {
      map.set(key, {
        ...existing,
        ...normalized,
      })
    }
  }

  for (const row of attendedEmployees.value) {
    put(row, row?.otResult === 'MATCH' ? 'MATCH' : 'MISMATCH', row?.otResult)
  }

  for (const row of attendedButNotApproved.value) {
    put(row, 'NOT_APPROVED', 'MISMATCH')
  }

  for (const row of shiftMismatchEmployees.value) {
    put(row, 'SHIFT_MISMATCH', 'MISMATCH')
  }

  for (const row of pendingReviewEmployees.value) {
    const status = upper(row?.attendanceStatus || row?.status)

    if (status === 'FORGET_SCAN_IN') {
      put(row, 'FORGET_SCAN_IN', 'MISMATCH')
    } else if (status === 'FORGET_SCAN_OUT') {
      put(row, 'FORGET_SCAN_OUT', 'MISMATCH')
    } else {
      put(row, 'FORGET_SCAN_OUT', 'MISMATCH')
    }
  }

  for (const row of notEligibleEmployees.value) {
    put(row, 'NOT_ELIGIBLE', 'MISMATCH')
  }

  for (const row of absentFromApproved.value) {
    put(row, 'ABSENT_APPROVED', 'MISMATCH')
  }

  return Array.from(map.values())
})

const forgetScanInRows = computed(() => {
  return verificationRows.value.filter((row) => row.category === 'FORGET_SCAN_IN')
})

const forgetScanOutRows = computed(() => {
  return verificationRows.value.filter((row) => row.category === 'FORGET_SCAN_OUT')
})

const needsCheckVerificationRows = computed(() => {
  return verificationRows.value.filter((row) => {
    return (
      row.result === 'MISMATCH' &&
      row.category !== 'FORGET_SCAN_IN' &&
      row.category !== 'FORGET_SCAN_OUT'
    )
  })
})

const summaryCards = computed(() => [
  {
    label: t('attendance.verification.requestStaff'),
    value: Number(
      verification.value?.approvedEmployeeCount ||
        verification.value?.requestedEmployeeCount ||
        0,
    ),
    tone: 'info',
  },
  {
    label: t('attendance.verification.matched'),
    value: verificationRows.value.filter((row) => row.result === 'MATCH').length,
    tone: 'match',
  },
  {
    label: t('attendance.verification.needsCheck'),
    value: needsCheckVerificationRows.value.length,
    tone: 'danger',
  },
  {
    label: t('attendance.verification.forgetIn'),
    value: forgetScanInRows.value.length,
    tone: 'purple',
  },
  {
    label: t('attendance.verification.forgetOut'),
    value: forgetScanOutRows.value.length,
    tone: 'purple',
  },
  {
    label: t('attendance.verification.absent'),
    value: Number(verification.value?.absentFromApprovedCount || 0),
    tone: 'danger',
  },
  {
    label: t('attendance.verification.notInOt'),
    value: Number(verification.value?.attendedButNotApprovedCount || 0),
    tone: 'warning',
  },
])

const filteredVerificationRows = computed(() => {
  const keyword = String(tableSearch.value || '').trim().toLowerCase()
  const category = String(tableCategory.value || '').trim()

  return verificationRows.value.filter((row) => {
    if (!rowMatchesCategory(row, category)) return false

    if (!keyword) return true

    return [
      row.employeeNo,
      row.employeeName,
      row.categoryLabel,
      row.result,
      resultMeaningLabel(row),
      attendanceStatusLabel(row.attendanceStatus),
      row.attendanceStatus,
      row.rawDecision,
      row.reason,
      row.clockIn,
      row.clockOut,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const resultLoadedLabel = computed(() =>
  t('common.loaded', {
    loaded: filteredVerificationRows.value.length,
    total: verificationRows.value.length,
  }),
)

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payloadValue) {
  return Array.isArray(payloadValue?.items) ? payloadValue.items : []
}

function formatDateYMD(value) {
  const raw = s(value)

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

function normalizeTimeValue(value) {
  const raw = s(value)
  if (!raw) return ''

  const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (timeMatch) {
    const hh = String(Number(timeMatch[1])).padStart(2, '0')
    const mm = String(Number(timeMatch[2])).padStart(2, '0')

    return `${hh}:${mm}`
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')

  return `${hh}:${mm}`
}

function displayTime(...values) {
  for (const value of values) {
    const normalized = normalizeTimeValue(value)
    if (normalized) return normalized
  }

  return '-'
}

function isMissingTime(value) {
  const raw = s(value)
  return !raw || raw === '-'
}

function scanTimeLabel(value) {
  return isMissingTime(value) ? t('attendance.statusLabel.missing') : value
}

function scanTimeTone(value) {
  return isMissingTime(value) ? 'is-missing' : 'is-complete'
}

function formatMinutesLabel(value) {
  const minutes = Math.max(0, Number(value || 0))

  if (!minutes) return '0m'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`

  return `${mins}m`
}

function getEmployeeKey(row) {
  return (
    s(row?.employeeId) ||
    upper(row?.employeeCode) ||
    upper(row?.employeeNo) ||
    s(row?.id)
  )
}

function categoryPriority(category) {
  const priority = {
    MATCH: 1,
    MATCH_WITHOUT_EXACT_OUT: 2,
    FORGET_SCAN_IN: 3,
    FORGET_SCAN_OUT: 3,
    MISMATCH: 4,
    NOT_APPROVED: 5,
    NOT_ELIGIBLE: 6,
    SHIFT_MISMATCH: 7,
    ABSENT_APPROVED: 8,
  }

  return priority[category] || 0
}

function categoryLabel(category) {
  const labels = {
    MATCH: t('attendance.verification.matched'),
    MATCH_WITHOUT_EXACT_OUT: t('attendance.verification.acceptedByPolicy'),
    FORGET_SCAN_IN: t('attendance.verification.forgetScanIn'),
    FORGET_SCAN_OUT: t('attendance.verification.forgetScanOut'),
    MISMATCH: t('attendance.verification.needsCheck'),
    ABSENT_APPROVED: t('attendance.verification.otStaffAbsent'),
    SHIFT_MISMATCH: t('attendance.verification.wrongShift'),
    NOT_APPROVED: t('attendance.verification.notInOtStaff'),
    NOT_ELIGIBLE: t('attendance.verification.notEligible'),
  }

  return labels[category] || category || '-'
}

function rowMatchesCategory(row, category) {
  const normalizedCategory = upper(category)
  if (!normalizedCategory) return true

  const rowCategory = upper(row?.category)
  const rowResult = upper(row?.result)

  if (normalizedCategory === 'MATCH') {
    return rowResult === 'MATCH'
  }

  if (normalizedCategory === 'MISMATCH') {
    return (
      rowResult === 'MISMATCH' &&
      rowCategory !== 'FORGET_SCAN_IN' &&
      rowCategory !== 'FORGET_SCAN_OUT'
    )
  }

  return rowCategory === normalizedCategory
}

function statusTagClass(value) {
  const normalized = upper(value)

  const map = {
    APPROVED: 'verify-tag-match',
    PRESENT: 'verify-tag-match',
    MATCH: 'verify-tag-match',
    PENDING: 'verify-tag-warning',
    LATE: 'verify-tag-warning',
    REJECTED: 'verify-tag-danger',
    ABSENT: 'verify-tag-danger',
    SHIFT_MISMATCH: 'verify-tag-danger',
    MISMATCH: 'verify-tag-danger',
    FORGET_SCAN_IN: 'verify-tag-info',
    FORGET_SCAN_OUT: 'verify-tag-info',
    CANCELLED: 'verify-tag-muted',
    OFF: 'verify-tag-muted',
  }

  return ['verify-tag', map[normalized] || 'verify-tag-muted']
}

function requestStatusTagClass(value) {
  const normalized = upper(value)

  const map = {
    APPROVED: 'verify-tag-match',
    PENDING: 'verify-tag-warning',
    REJECTED: 'verify-tag-danger',
    CANCELLED: 'verify-tag-muted',
  }

  return ['verify-tag', map[normalized] || 'verify-tag-muted']
}

function timingModeLabel(value) {
  const normalized = upper(value)

  if (normalized === 'FIXED_TIME') return t('attendance.verification.fixedOt')
  if (normalized === 'AFTER_SHIFT_END') return t('attendance.verification.afterShift')

  return t('attendance.verification.otOption')
}

function timingModeTagClass(value) {
  return ['verify-tag', upper(value) === 'FIXED_TIME' ? 'verify-tag-warning' : 'verify-tag-info']
}

function attendanceStatusLabel(value) {
  const normalized = upper(value)

  const labels = {
    PRESENT: t('attendance.statusLabel.present'),
    LATE: t('attendance.statusLabel.late'),
    ABSENT: t('attendance.statusLabel.absent'),
    OFF: t('attendance.statusLabel.off'),
    FORGET_SCAN_IN: t('attendance.statusLabel.forgetScanIn'),
    FORGET_SCAN_OUT: t('attendance.statusLabel.forgetScanOut'),
    SHIFT_MISMATCH: t('attendance.statusLabel.shiftMismatch'),
    MISMATCH: t('attendance.verification.needsCheck'),
    PENDING: t('attendance.statusLabel.pending'),
  }

  return labels[normalized] || normalized || '-'
}

function isPartialCredited(row) {
  const result = upper(row?.result)
  const requested = Number(row?.requestedMinutes || 0)
  const credited = Number(row?.roundedOtMinutes || 0)

  return result === 'MISMATCH' && requested > 0 && credited > 0 && credited < requested
}

function resultMeaningTone(row) {
  if (isPartialCredited(row)) return 'is-warning'

  if (row?.category === 'FORGET_SCAN_IN' || row?.category === 'FORGET_SCAN_OUT') {
    return 'is-forget'
  }

  return upper(row?.result) === 'MATCH' ? 'is-match' : 'is-mismatch'
}

function resultMeaningLabel(row) {
  const category = upper(row?.category)
  const result = upper(row?.result)
  const requested = Number(row?.requestedMinutes || 0)
  const credited = Number(row?.roundedOtMinutes || 0)
  const actual = Number(row?.actualOtMinutes || 0)
  const clockIn = s(row?.clockIn)
  const clockOut = s(row?.clockOut)
  const attendanceStatus = upper(row?.attendanceStatus)

  if (category === 'FORGET_SCAN_IN') return t('attendance.verification.meaningLabel.forgetScanIn')
  if (category === 'FORGET_SCAN_OUT') return t('attendance.verification.meaningLabel.forgetScanOut')
  if (category === 'MATCH_WITHOUT_EXACT_OUT') return t('attendance.verification.meaningLabel.acceptedByPolicy')
  if (category === 'ABSENT_APPROVED') return t('attendance.verification.meaningLabel.otStaffAbsent')
  if (category === 'SHIFT_MISMATCH') return t('attendance.verification.meaningLabel.wrongShift')
  if (category === 'NOT_APPROVED') return t('attendance.verification.meaningLabel.notInOtStaff')
  if (category === 'NOT_ELIGIBLE') return t('attendance.verification.meaningLabel.notEligible')

  if (result === 'MATCH') return t('attendance.verification.meaningLabel.otMatchedRequest')
  if (attendanceStatus === 'ABSENT') return t('attendance.verification.meaningLabel.absent')

  if (!clockIn || !clockOut || clockIn === '-' || clockOut === '-') {
    return t('attendance.verification.meaningLabel.missingScanTime')
  }

  if (requested > 0 && credited <= 0) return t('attendance.verification.meaningLabel.noCreditedOt')
  if (requested > 0 && credited < requested) return t('attendance.verification.meaningLabel.creditedLessThanRequest')
  if (requested > 0 && credited > requested) return t('attendance.verification.meaningLabel.creditedOverRequest')
  if (actual > 0 && credited !== actual) return t('attendance.verification.meaningLabel.adjustedByRule')

  return t('attendance.verification.meaningLabel.checkOtRule')
}

function requestStatusLabel(value) {
  const normalized = upper(value)

  if (normalized === 'PENDING') return t('attendance.statusLabel.pending')
  if (normalized === 'APPROVED') return t('ot.status.approved')
  if (normalized === 'REJECTED') return t('ot.status.rejected')
  if (normalized === 'CANCELLED') return t('attendance.statusLabel.cancelled')
  if (normalized === 'DRAFT') return t('attendance.statusLabel.draft')

  return normalized || '-'
}

function requestOptionLabel(row) {
  const requestNo = s(row?.requestNo) || t('attendance.verification.noRequestNo')
  const status = requestStatusLabel(row?.status)
  const requester = s(row?.requesterName)
  const option = s(row?.shiftOtOptionLabel)

  const staffCount = Number(
    row?.employeeCount ||
      row?.approvedEmployeeCount ||
      row?.requestedEmployeeCount ||
      0,
  )

  return [
    requestNo,
    `${t('attendance.verification.statusPrefix')}: ${status}`,
    requester,
    option,
    `${staffCount} ${t('attendance.verification.staff')}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function normalizeRequestOptions(items = []) {
  return items
    .map((item) => {
      const id = s(item?.id || item?._id)

      if (!id) return null

      return {
        ...item,
        id,
        optionLabel: requestOptionLabel(item),
      }
    })
    .filter(Boolean)
}

function normalizeVerificationRow(row, category, fallbackResult = '') {
  const rawDecision = upper(row?.rawOtDecision)

  const isNoExactOutMatch = [
    'APPROVED_WITHOUT_EXACT_CLOCK_OUT',
    'FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT',
  ].includes(rawDecision)

  const result = upper(
    row?.otResult ||
      fallbackResult ||
      (category === 'MATCH' || category === 'MATCH_WITHOUT_EXACT_OUT'
        ? 'MATCH'
        : 'MISMATCH'),
  )

  const timingMode = upper(
    row?.shiftOtOptionTimingMode ||
      verification.value?.shiftOtOptionTimingMode ||
      requestTimingMode.value,
  )

  const isFixed = row?.isFixedTimeOt === true || timingMode === 'FIXED_TIME'

  const finalCategory =
    isNoExactOutMatch && result === 'MATCH'
      ? 'MATCH_WITHOUT_EXACT_OUT'
      : category

  return {
    rowKey: getEmployeeKey(row),
    employeeId: s(row?.employeeId),
    employeeNo: upper(row?.employeeCode || row?.employeeNo),
    employeeName: s(row?.employeeName),

    category: finalCategory,
    categoryLabel: categoryLabel(finalCategory),

    result,
    rawDecision,
    reason: s(row?.otResultReason || row?.derivedStatusReason),
    timingMode,
    isFixed,

    clockIn: displayTime(row?.clockIn),
    clockOut: displayTime(row?.clockOut),
    attendanceStatus: upper(row?.attendanceStatus || row?.status),

    shiftName: s(row?.shiftName || otRequest.value?.shiftName),
    shiftTime: `${displayTime(row?.shiftStartTime, otRequest.value?.shiftStartTime)} - ${displayTime(row?.shiftEndTime, otRequest.value?.shiftEndTime)}`,

    expectedOtTime: `${displayTime(row?.expectedOtStartTime, verification.value?.expectedOtStartTime)} - ${displayTime(row?.expectedOtEndTime, verification.value?.expectedOtEndTime)}`,

    requestedMinutes: Number(
      row?.requestedMinutes ??
        row?.requestedOtMinutes ??
        verification.value?.requestedMinutes ??
        otRequest.value?.requestedMinutes ??
        0,
    ),

    roundedOtMinutes: Number(row?.roundedOtMinutes ?? row?.actualOtMinutes ?? 0),
    actualOtMinutes: Number(row?.actualOtMinutes ?? 0),
    eligibleOtMinutes: Number(row?.eligibleOtMinutes ?? 0),

    workedMinutes: Number(row?.workedMinutes || 0),
    lateMinutes: Number(row?.lateMinutes || 0),
    earlyOutMinutes: Number(row?.earlyOutMinutes || 0),

    policyAllowNoExactOut: row?.policyAllowApprovedOtWithoutExactClockOut === true,
  }
}

function clearCurrentResultOnly() {
  payload.value = null
  tableSearch.value = ''
  tableCategory.value = ''
}

async function loadData() {
  const otRequestId = activeOtRequestId.value

  if (!otRequestId) {
    clearCurrentResultOnly()
    return
  }

  const requestId = ++currentVerifyRequestId
  loading.value = true

  try {
    const response = await verifyOTAttendance(otRequestId)
    const nextPayload = normalizePayload(response)

    if (requestId !== currentVerifyRequestId) return

    payload.value = nextPayload || null

    if (!payload.value?.otRequest) {
      toast.add({
        severity: 'warn',
        summary: t('attendance.verification.loadFailed'),
        detail: t('attendance.verification.loadVerificationFailed'),
        life: 3500,
      })
      return
    }

    if (!verificationDate.value && payload.value?.otRequest?.otDate) {
      suppressRequestSearch = true
      verificationDate.value = formatDateYMD(payload.value.otRequest.otDate)
    }
  } catch (error) {
    if (requestId !== currentVerifyRequestId) return

    clearCurrentResultOnly()

    toast.add({
      severity: 'error',
      summary: t('attendance.verification.loadFailed'),
      detail:
        error?.response?.data?.message ||
        error?.message ||
        t('attendance.verification.loadVerificationFailed'),
      life: 4000,
    })
  } finally {
    if (requestId === currentVerifyRequestId) {
      loading.value = false
    }
  }
}

async function loadRequestsByDate(options = {}) {
  const { silent = false } = options
  const selectedDate = formatDateYMD(verificationDate.value)

  if (!selectedDate) {
    requestOptions.value = []
    selectedOtRequestId.value = ''
    clearCurrentResultOnly()

    if (!silent) {
      toast.add({
        severity: 'warn',
        summary: t('attendance.verification.otDateRequired'),
        detail: t('attendance.verification.otDateRequiredDetail'),
        life: 2500,
      })
    }

    return
  }

  searchLoading.value = true
  requestOptions.value = []
  selectedOtRequestId.value = ''
  clearCurrentResultOnly()

  try {
    const params = {
      page: 1,
      limit: 100,
      otDateFrom: selectedDate,
      otDateTo: selectedDate,
    }

    if (selectedRequestStatus.value) {
      params.status = selectedRequestStatus.value
    }

    const response = await searchOTVerificationRequests(params)
    const payloadValue = normalizePayload(response)
    const items = normalizeItems(payloadValue)

    requestOptions.value = normalizeRequestOptions(items)

    if (!requestOptions.value.length && !silent) {
      toast.add({
        severity: 'warn',
        summary: t('attendance.verification.noOtRequests'),
        detail: t('attendance.verification.noOtRequestsDetail'),
        life: 3000,
      })
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('attendance.verification.loadFailed'),
      detail:
        error?.response?.data?.message ||
        error?.message ||
        t('attendance.verification.loadRequestsFailed'),
      life: 3500,
    })
  } finally {
    searchLoading.value = false
  }
}

function scheduleRequestSearch() {
  window.clearTimeout(requestSearchTimer)

  requestOptions.value = []
  selectedOtRequestId.value = ''
  clearCurrentResultOnly()

  if (!verificationDate.value) {
    return
  }

  requestSearchTimer = window.setTimeout(() => {
    loadRequestsByDate({ silent: true })
  }, 250)
}

function clearAll() {
  window.clearTimeout(requestSearchTimer)

  verificationDate.value = ''
  selectedRequestStatus.value = ''
  requestOptions.value = []
  selectedOtRequestId.value = ''
  clearCurrentResultOnly()
}

watch(
  () => [
    formatDateYMD(verificationDate.value),
    selectedRequestStatus.value,
  ],
  () => {
    if (suppressRequestSearch) {
      suppressRequestSearch = false
      return
    }

    scheduleRequestSearch()
  },
)

watch(
  () => selectedOtRequestId.value,
  async (value, oldValue) => {
    if (value === oldValue) return

    if (!value) {
      clearCurrentResultOnly()
      return
    }

    await loadData()
  },
)

onMounted(() => {
  if (routeOtRequestId.value) {
    selectedOtRequestId.value = routeOtRequestId.value
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(requestSearchTimer)
})
</script>

<template>
  <div class="ot-page-shell ot-verification-page">
    <section class="ot-filter-bar ot-verification-filter-bar">
      <div class="ot-field">
        <HolidayDatePicker
          v-model="verificationDate"
          :label="t('attendance.verification.otDate')"
          :placeholder="t('attendance.verification.selectOtDate')"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('attendance.verification.searchOtRequest') }}
        </label>

        <Select
          v-model="selectedOtRequestId"
          :options="requestOptions"
          option-label="optionLabel"
          option-value="id"
          class="w-full"
          :placeholder="t('attendance.verification.selectOtRequest')"
          :loading="searchLoading"
          :disabled="!requestOptions.length || searchLoading"
          filter
          size="small"
          @update:model-value="loadData"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('attendance.verification.requestStatus') }}
        </label>

        <Select
          v-model="selectedRequestStatus"
          :options="requestStatusOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          :placeholder="t('common.allStatus')"
          size="small"
        />
      </div>

      <div class="ot-verification-filter-actions">
        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearAll"
        />
      </div>
    </section>

    <Message
      v-if="payload && !isFinalApprovedRequest"
      severity="warn"
      :closable="false"
    >
      {{
        t('attendance.verification.nonFinalWarning', {
          status: requestStatusLabel(otRequest.status),
        })
      }}
    </Message>

    <AppTableLoading
      v-if="loading"
      :title="t('common.loadingData')"
      :message="t('attendance.verification.loadingVerification')"
      :rows="6"
      :columns="8"
      icon="pi pi-check-circle"
    />

    <template v-else-if="payload">
      <section class="verification-summary-grid">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="verification-summary-card"
          :class="`is-${card.tone}`"
        >
          <div class="verification-summary-value">
            {{ card.value }}
          </div>

          <div class="verification-summary-label">
            {{ card.label }}
          </div>
        </div>
      </section>

      <section class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ otRequest.requestNo || t('attendance.verification.requestNo') }}
            </h2>
          </div>

          <div class="ot-table-actions">
            <Tag
              :value="requestStatusLabel(otRequest.status)"
              :class="requestStatusTagClass(otRequest.status)"
            />
          </div>
        </div>

        <div class="verification-info-grid">
          <div class="verification-info-card">
            <div class="ot-field-label">
              {{ t('attendance.verification.requester') }}
            </div>

            <div class="verification-info-value truncate">
              {{ otRequest.requesterName || '-' }}
            </div>
          </div>

          <div class="verification-info-card">
            <div class="ot-field-label">
              {{ t('attendance.verification.shift') }}
            </div>

            <div class="verification-info-value">
              {{ requestShiftTime }}
            </div>
          </div>

          <div class="verification-info-card">
            <div class="ot-field-label">
              {{ t('attendance.verification.expectedOt') }}
            </div>

            <div class="verification-info-value">
              {{ requestExpectedOtTime }}
            </div>
          </div>

          <div class="verification-info-card">
            <div class="ot-field-label">
              {{ t('attendance.verification.requested') }}
            </div>

            <div class="verification-info-value">
              {{ requestRequestedOtLabel }}
            </div>
          </div>

          <div class="verification-info-card">
            <div class="ot-field-label">
              {{ t('attendance.verification.policy') }}
            </div>

            <div
              class="verification-info-value truncate"
              :title="requestPolicyLabel"
            >
              {{ requestPolicyLabel }}
            </div>
          </div>

          <div class="verification-info-card">
            <div class="ot-field-label">
              {{ t('attendance.verification.otType') }}
            </div>

            <div class="mt-1">
              <Tag
                :value="timingModeLabel(requestTimingMode)"
                :class="timingModeTagClass(requestTimingMode)"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('attendance.verification.verificationResult') }}
            </h2>
          </div>

          <div class="ot-table-actions">
            <span class="ot-loaded-badge">
              {{ resultLoadedLabel }}
            </span>
          </div>
        </div>

        <section class="ot-filter-bar ot-verification-result-filter-bar">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('common.search') }}
            </label>

            <IconField>
              <InputIcon class="pi pi-search" />

              <InputText
                v-model="tableSearch"
                size="small"
                class="w-full"
                :placeholder="t('attendance.verification.searchPlaceholder')"
              />
            </IconField>
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('attendance.verification.result') }}
            </label>

            <Select
              v-model="tableCategory"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              size="small"
              class="w-full"
              :placeholder="t('attendance.verification.result')"
            />
          </div>
        </section>

        <div class="ot-table-wrapper">
          <DataTable
            :value="filteredVerificationRows"
            data-key="rowKey"
            scrollable
            scroll-height="520px"
            table-style="min-width: 104rem"
            class="ot-data-table ot-data-table-compact verification-table"
          >
            <template #empty>
              <div class="ot-empty-state">
                <div class="ot-empty-icon">
                  <i class="pi pi-check-circle" />
                </div>

                <div class="ot-empty-title">
                  {{ t('common.noData') }}
                </div>

                <div class="ot-empty-text">
                  {{ t('attendance.verification.noVerificationRows') }}
                </div>
              </div>
            </template>

            <Column
              :header="t('attendance.verification.meaning')"
              style="min-width: 18rem"
            >
              <template #body="{ data }">
                <div
                  class="result-meaning-label"
                  :class="resultMeaningTone(data)"
                  :title="data.reason || data.rawDecision || resultMeaningLabel(data)"
                >
                  {{ resultMeaningLabel(data) }}
                </div>
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.employee')"
              style="min-width: 15rem"
            >
              <template #body="{ data }">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ data.employeeNo || '-' }}
                </div>

                <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.employeeName || '-' }}
                </div>
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.otType')"
              style="min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="data.isFixed ? t('attendance.verification.fixedOt') : timingModeLabel(data.timingMode)"
                  :class="timingModeTagClass(data.timingMode)"
                />
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.scanIn')"
              style="min-width: 8rem"
            >
              <template #body="{ data }">
                <span
                  class="scan-time-chip"
                  :class="scanTimeTone(data.clockIn)"
                >
                  {{ scanTimeLabel(data.clockIn) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.scanOut')"
              style="min-width: 8rem"
            >
              <template #body="{ data }">
                <span
                  class="scan-time-chip"
                  :class="scanTimeTone(data.clockOut)"
                >
                  {{ scanTimeLabel(data.clockOut) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.status')"
              style="min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="attendanceStatusLabel(data.attendanceStatus)"
                  :class="statusTagClass(data.attendanceStatus)"
                />
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.expectedOt')"
              style="min-width: 13rem"
            >
              <template #body="{ data }">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ data.expectedOtTime }}
                </div>

                <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                  {{ t('attendance.verification.requested') }}:
                  {{ formatMinutesLabel(data.requestedMinutes) }}
                </div>
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.creditedOt')"
              style="min-width: 11rem"
            >
              <template #body="{ data }">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ formatMinutesLabel(data.roundedOtMinutes) }}
                </div>

                <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                  {{ t('attendance.verification.actual') }}:
                  {{ formatMinutesLabel(data.actualOtMinutes) }}
                </div>
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.shift')"
              style="min-width: 13rem"
            >
              <template #body="{ data }">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ data.shiftName || '-' }}
                </div>

                <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.shiftTime }}
                </div>
              </template>
            </Column>

            <Column
              :header="t('attendance.verification.reason')"
              style="min-width: 18rem"
            >
              <template #body="{ data }">
                <div
                  class="ot-truncate-2 text-sm text-[color:var(--ot-text-muted)]"
                  :title="data.reason"
                >
                  {{ data.reason || data.rawDecision || '-' }}
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </section>
    </template>

    <div
      v-else
      class="ot-empty-state rounded-2xl border border-dashed border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div class="ot-empty-icon">
        <i class="pi pi-check-circle" />
      </div>

      <div class="ot-empty-title">
        {{ t('attendance.verification.verificationResult') }}
      </div>

      <div class="ot-empty-text">
        {{ t('attendance.verification.emptyInstruction') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.ot-verification-page {
  --verify-match-rgb: 34 197 94;
  --verify-warning-rgb: 245 158 11;
  --verify-danger-rgb: 239 68 68;
  --verify-info-rgb: 59 130 246;
  --verify-purple-rgb: 139 92 246;
  --verify-muted-rgb: 100 116 139;
}

.ot-verification-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  align-items: end;
}

.ot-verification-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.ot-verification-result-filter-bar {
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  box-shadow: none;
}

.verification-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.verification-summary-card {
  --summary-rgb: var(--verify-muted-rgb);
  display: flex;
  min-height: 4.2rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--summary-rgb) / 0.24);
  border-radius: var(--ot-radius-md);
  background:
    linear-gradient(180deg, rgb(var(--summary-rgb) / 0.12), rgb(var(--summary-rgb) / 0.05)),
    var(--ot-surface);
  padding: 0.55rem 0.65rem;
  text-align: center;
}

.verification-summary-card.is-match {
  --summary-rgb: var(--verify-match-rgb);
}

.verification-summary-card.is-warning {
  --summary-rgb: var(--verify-warning-rgb);
}

.verification-summary-card.is-danger {
  --summary-rgb: var(--verify-danger-rgb);
}

.verification-summary-card.is-info {
  --summary-rgb: var(--verify-info-rgb);
}

.verification-summary-card.is-purple {
  --summary-rgb: var(--verify-purple-rgb);
}

.verification-summary-value {
  color: rgb(var(--summary-rgb) / 1);
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.05;
  text-align: center;
}

.verification-summary-label {
  margin-top: 0.25rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
}

.verification-info-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.6rem;
  padding: 0.75rem;
}

.verification-info-card {
  min-width: 0;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  background: var(--ot-bg);
  padding: 0.6rem 0.7rem;
}

.verification-info-value {
  margin-top: 0.2rem;
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.25;
}

:deep(.verify-tag) {
  --verify-tag-rgb: var(--verify-muted-rgb);
  min-height: 1.45rem;
  border: 1px solid rgb(var(--verify-tag-rgb) / 0.28);
  background: rgb(var(--verify-tag-rgb) / 0.11);
  color: rgb(var(--verify-tag-rgb) / 1);
  padding: 0.14rem 0.48rem;
  font-size: 0.72rem;
  font-weight: 700;
}

:deep(.verify-tag-match) {
  --verify-tag-rgb: var(--verify-match-rgb);
}

:deep(.verify-tag-warning) {
  --verify-tag-rgb: var(--verify-warning-rgb);
}

:deep(.verify-tag-danger) {
  --verify-tag-rgb: var(--verify-danger-rgb);
}

:deep(.verify-tag-info) {
  --verify-tag-rgb: var(--verify-info-rgb);
}

:deep(.verify-tag-muted) {
  --verify-tag-rgb: var(--verify-muted-rgb);
}

.scan-time-chip {
  --scan-rgb: var(--verify-muted-rgb);
  display: inline-flex;
  min-width: 4.25rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--scan-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--scan-rgb) / 0.11);
  color: rgb(var(--scan-rgb) / 1);
  padding: 0.22rem 0.58rem;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.scan-time-chip.is-complete {
  --scan-rgb: var(--verify-match-rgb);
}

.scan-time-chip.is-missing {
  --scan-rgb: var(--verify-danger-rgb);
}

.result-meaning-label {
  --meaning-rgb: var(--verify-muted-rgb);
  width: fit-content;
  max-width: 17rem;
  overflow: hidden;
  border: 1px solid rgb(var(--meaning-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--meaning-rgb) / 0.11);
  color: rgb(var(--meaning-rgb) / 1);
  padding: 0.22rem 0.58rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meaning-label.is-match {
  --meaning-rgb: var(--verify-match-rgb);
}

.result-meaning-label.is-mismatch {
  --meaning-rgb: var(--verify-danger-rgb);
}

.result-meaning-label.is-warning {
  --meaning-rgb: var(--verify-warning-rgb);
}

.result-meaning-label.is-forget {
  --meaning-rgb: var(--verify-purple-rgb);
}

@media (min-width: 640px) {
  .verification-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .verification-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .verification-summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .ot-verification-filter-bar {
    grid-template-columns:
      minmax(180px, 220px)
      minmax(320px, 1fr)
      minmax(180px, 220px);
  }

  .ot-verification-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .verification-summary-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .verification-info-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .ot-verification-result-filter-bar {
    grid-template-columns: minmax(260px, 1fr) minmax(220px, 280px);
  }
}

@media (max-width: 768px) {
  .ot-verification-filter-actions {
    justify-content: stretch;
  }

  .ot-verification-filter-actions > * {
    flex: 1 1 100%;
  }
}
</style>