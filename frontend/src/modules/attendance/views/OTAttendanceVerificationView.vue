<!-- frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue -->
<script setup>
// frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'

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

const requestStatusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('attendance.statusLabel.pending'), value: 'PENDING' },
  { label: t('common.approve'), value: 'APPROVED' },
  { label: t('common.reject'), value: 'REJECTED' },
  { label: t('attendance.statusLabel.cancelled') || 'Cancelled', value: 'CANCELLED' },
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

  if (code && name) return `${code} · ${name}`

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
    icon: 'pi pi-users',
    tone: 'blue',
  },
  {
    label: t('attendance.verification.matched'),
    value: verificationRows.value.filter((row) => row.result === 'MATCH').length,
    icon: 'pi pi-check-circle',
    tone: 'green',
  },
  {
    label: t('attendance.verification.needsCheck'),
    value: needsCheckVerificationRows.value.length,
    icon: 'pi pi-times-circle',
    tone: 'red',
  },
  {
    label: t('attendance.verification.forgetIn'),
    value: forgetScanInRows.value.length,
    icon: 'pi pi-sign-in',
    tone: 'violet',
  },
  {
    label: t('attendance.verification.forgetOut'),
    value: forgetScanOutRows.value.length,
    icon: 'pi pi-sign-out',
    tone: 'violet',
  },
  {
    label: t('attendance.verification.absent'),
    value: Number(verification.value?.absentFromApprovedCount || 0),
    icon: 'pi pi-user-minus',
    tone: 'amber',
  },
  {
    label: t('attendance.verification.notInOt'),
    value: Number(verification.value?.attendedButNotApprovedCount || 0),
    icon: 'pi pi-exclamation-triangle',
    tone: 'cyan',
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

function statusSeverity(value) {
  const normalized = upper(value)

  if (['APPROVED', 'PRESENT', 'MATCH'].includes(normalized)) return 'success'
  if (['PENDING', 'LATE'].includes(normalized)) return 'warning'

  if (
    [
      'REJECTED',
      'ABSENT',
      'SHIFT_MISMATCH',
      'MISMATCH',
    ].includes(normalized)
  ) {
    return 'danger'
  }

  if (['FORGET_SCAN_IN', 'FORGET_SCAN_OUT'].includes(normalized)) return 'info'
  if (['CANCELLED', 'OFF'].includes(normalized)) return 'secondary'

  return 'contrast'
}

function requestStatusSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'APPROVED') return 'success'
  if (normalized === 'PENDING') return 'warning'
  if (normalized === 'REJECTED') return 'danger'
  if (normalized === 'CANCELLED') return 'secondary'

  return 'secondary'
}

function timingModeLabel(value) {
  const normalized = upper(value)

  if (normalized === 'FIXED_TIME') return t('attendance.verification.fixedOt')
  if (normalized === 'AFTER_SHIFT_END') return t('attendance.verification.afterShift')

  return t('attendance.verification.otOption')
}

function timingModeSeverity(value) {
  return upper(value) === 'FIXED_TIME' ? 'warning' : 'info'
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
  if (normalized === 'APPROVED') return t('common.approve')
  if (normalized === 'REJECTED') return t('common.reject')
  if (normalized === 'CANCELLED') return t('attendance.statusLabel.cancelled') || 'Cancelled'
  if (normalized === 'DRAFT') return t('attendance.statusLabel.draft') || 'Draft'

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
  if (!activeOtRequestId.value) {
    clearCurrentResultOnly()
    return
  }

  loading.value = true

  try {
    const response = await verifyOTAttendance(activeOtRequestId.value)
    const nextPayload = response?.data?.data || null

    payload.value = nextPayload

    if (!verificationDate.value && nextPayload?.otRequest?.otDate) {
      suppressRequestSearch = true
      verificationDate.value = formatDateYMD(nextPayload.otRequest.otDate)
    }
  } catch (error) {
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
    loading.value = false
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

async function onRequestSelected() {
  if (!selectedOtRequestId.value) {
    clearCurrentResultOnly()
    return
  }

  await loadData()
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

onMounted(() => {
  if (routeOtRequestId.value) {
    selectedOtRequestId.value = routeOtRequestId.value
    loadData()
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(requestSearchTimer)
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-5">
    <section
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] shadow-sm"
    >
      <div class="ot-filter-row">
        <div class="filter-field">
          <HolidayDatePicker
            v-model="verificationDate"
            :label="t('attendance.verification.otDate')"
            :placeholder="t('attendance.verification.selectOtDate')"
          />
        </div>

        <div class="filter-field">
          <label class="filter-label">
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
            @change="onRequestSelected"
          />
        </div>

        <div class="filter-field">
          <label class="filter-label">
            {{ t('attendance.verification.requestStatus') }}
          </label>

          <Select
            v-model="selectedRequestStatus"
            :options="requestStatusOptions"
            option-label="label"
            option-value="value"
            class="w-full"
            :placeholder="t('common.allStatus')"
          />
        </div>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="filter-button"
          @click="clearAll"
        />
      </div>
    </section>

    <template v-if="payload">
      <Message
        v-if="!isFinalApprovedRequest"
        severity="warn"
        :closable="false"
        class="verification-warning"
      >
        {{
          t('attendance.verification.nonFinalWarning', {
            status: requestStatusLabel(otRequest.status),
          })
        }}
      </Message>

      <section class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="verification-stat-card"
          :class="`tone-${card.tone}`"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] font-medium uppercase tracking-[0.1em] opacity-75">
              {{ card.label }}
            </div>

            <i
              :class="card.icon"
              class="text-xs opacity-70"
            />
          </div>

          <div class="mt-1 text-xl font-medium leading-none">
            {{ card.value }}
          </div>
        </div>
      </section>

      <section
        class="grid grid-cols-1 gap-3 rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-3 shadow-sm md:grid-cols-2 xl:grid-cols-7"
      >
        <div class="info-box xl:col-span-1">
          <div class="info-label">{{ t('attendance.verification.requestNo') }}</div>
          <div class="info-value">{{ otRequest.requestNo || '-' }}</div>
        </div>

        <div class="info-box xl:col-span-1">
          <div class="info-label">{{ t('common.status') }}</div>
          <div class="info-value">
            <Tag
              :value="requestStatusLabel(otRequest.status)"
              :severity="requestStatusSeverity(otRequest.status)"
              class="verify-tag"
            />
          </div>
        </div>

        <div class="info-box xl:col-span-1">
          <div class="info-label">{{ t('attendance.verification.requester') }}</div>
          <div class="info-value">
            {{ otRequest.requesterEmployeeNo || '-' }} · {{ otRequest.requesterName || '-' }}
          </div>
        </div>

        <div class="info-box">
          <div class="info-label">{{ t('attendance.verification.shift') }}</div>
          <div class="info-value">{{ requestShiftTime }}</div>
        </div>

        <div class="info-box">
          <div class="info-label">{{ t('attendance.verification.expectedOt') }}</div>
          <div class="info-value">{{ requestExpectedOtTime }}</div>
        </div>

        <div class="info-box">
          <div class="info-label">{{ t('attendance.verification.requested') }}</div>
          <div class="info-value">{{ requestRequestedOtLabel }}</div>
        </div>

        <div class="info-box">
          <div class="info-label">{{ t('attendance.verification.policy') }}</div>
          <div
            class="info-value truncate"
            :title="requestPolicyLabel"
          >
            {{ requestPolicyLabel }}
          </div>
        </div>
      </section>

      <Card class="overflow-hidden rounded-2xl shadow-sm">
        <template #content>
          <div class="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-base font-medium text-[color:var(--ot-text)]">
                {{ t('attendance.verification.verificationResult') }}
              </div>

              <Tag
                :value="t('attendance.verification.rowCount', { count: filteredVerificationRows.length })"
                severity="secondary"
                rounded
              />
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <IconField class="w-full sm:w-72">
                <InputIcon class="pi pi-search" />

                <InputText
                  v-model="tableSearch"
                  size="small"
                  class="w-full"
                  :placeholder="t('attendance.verification.searchPlaceholder')"
                />
              </IconField>

              <Select
                v-model="tableCategory"
                :options="categoryOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="w-full sm:w-56"
                :placeholder="t('attendance.verification.result')"
              />
            </div>
          </div>

          <DataTable
            :value="filteredVerificationRows"
            data-key="rowKey"
            scrollable
            scroll-height="520px"
            table-style="width: max-content; min-width: 100%;"
            class="verification-table"
            striped-rows
          >
            <template #empty>
              <div class="py-8 text-center text-sm text-[color:var(--ot-text-muted)]">
                {{ t('attendance.verification.noVerificationRows') }}
              </div>
            </template>

            <Column :header="t('attendance.verification.meaning')">
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

            <Column :header="t('attendance.verification.employee')">
              <template #body="{ data }">
                <div class="font-medium text-[color:var(--ot-text)]">
                  {{ data.employeeNo || '-' }}
                </div>

                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.employeeName || '-' }}
                </div>
              </template>
            </Column>

            <Column :header="t('attendance.verification.otType')">
              <template #body="{ data }">
                <Tag
                  :value="data.isFixed ? t('attendance.verification.fixedOt') : timingModeLabel(data.timingMode)"
                  :severity="timingModeSeverity(data.timingMode)"
                  class="verify-tag"
                />
              </template>
            </Column>

            <Column :header="t('attendance.verification.scanIn')">
              <template #body="{ data }">
                <span
                  class="scan-time-chip"
                  :class="scanTimeTone(data.clockIn)"
                >
                  {{ scanTimeLabel(data.clockIn) }}
                </span>
              </template>
            </Column>

            <Column :header="t('attendance.verification.scanOut')">
              <template #body="{ data }">
                <span
                  class="scan-time-chip"
                  :class="scanTimeTone(data.clockOut)"
                >
                  {{ scanTimeLabel(data.clockOut) }}
                </span>
              </template>
            </Column>

            <Column :header="t('attendance.verification.status')">
              <template #body="{ data }">
                <Tag
                  :value="attendanceStatusLabel(data.attendanceStatus)"
                  :severity="statusSeverity(data.attendanceStatus)"
                  class="verify-tag"
                />
              </template>
            </Column>

            <Column :header="t('attendance.verification.expectedOt')">
              <template #body="{ data }">
                <div class="font-medium text-[color:var(--ot-text)]">
                  {{ data.expectedOtTime }}
                </div>

                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ t('attendance.verification.requested') }}: {{ formatMinutesLabel(data.requestedMinutes) }}
                </div>
              </template>
            </Column>

            <Column :header="t('attendance.verification.creditedOt')">
              <template #body="{ data }">
                <div class="font-medium text-[color:var(--ot-text)]">
                  {{ formatMinutesLabel(data.roundedOtMinutes) }}
                </div>

                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ t('attendance.verification.actual') }}: {{ formatMinutesLabel(data.actualOtMinutes) }}
                </div>
              </template>
            </Column>

            <Column :header="t('attendance.verification.shift')">
              <template #body="{ data }">
                <div class="font-medium text-[color:var(--ot-text)]">
                  {{ data.shiftName || '-' }}
                </div>

                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.shiftTime }}
                </div>
              </template>
            </Column>

            <Column :header="t('attendance.verification.reason')">
              <template #body="{ data }">
                <div
                  class="reason-cell line-clamp-2 text-sm text-[color:var(--ot-text-muted)]"
                  :title="data.reason"
                >
                  {{ data.reason || data.rawDecision || '-' }}
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>

    <div
      v-else
      class="rounded-2xl border border-dashed border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
    >
      {{ t('attendance.verification.emptyInstruction') }}
    </div>
  </div>
</template>

<style scoped>
.ot-filter-row {
  display: grid;
  grid-template-columns: minmax(160px, 190px) minmax(260px, 1fr) minmax(170px, 200px) auto;
  gap: 0.75rem;
  align-items: end;
  padding: 0.75rem;
}

.filter-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.filter-label {
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.filter-button {
  min-height: 2.4rem;
  white-space: nowrap;
}

.verification-warning {
  border-radius: 1rem;
}

.verification-stat-card {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  padding: 0.8rem 0.9rem;
  background: var(--ot-surface);
  color: var(--ot-text);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.tone-blue {
  background: color-mix(in srgb, #3b82f6 9%, var(--ot-surface));
  color: #1d4ed8;
}

.tone-green {
  background: color-mix(in srgb, #22c55e 10%, var(--ot-surface));
  color: #15803d;
}

.tone-red {
  background: color-mix(in srgb, #ef4444 9%, var(--ot-surface));
  color: #b91c1c;
}

.tone-violet {
  background: color-mix(in srgb, #8b5cf6 10%, var(--ot-surface));
  color: #6d28d9;
}

.tone-amber {
  background: color-mix(in srgb, #f59e0b 12%, var(--ot-surface));
  color: #b45309;
}

.tone-cyan {
  background: color-mix(in srgb, #06b6d4 10%, var(--ot-surface));
  color: #0e7490;
}

:global(.dark) .tone-blue,
:global(.dark) .tone-green,
:global(.dark) .tone-red,
:global(.dark) .tone-violet,
:global(.dark) .tone-amber,
:global(.dark) .tone-cyan {
  color: var(--ot-text);
}

.info-box {
  min-width: 0;
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-bg);
  padding: 0.75rem 0.85rem;
}

.info-label {
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.info-value {
  margin-top: 0.2rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--ot-text);
}

.result-meaning-label {
  width: fit-content;
  overflow: hidden;
  border-radius: 999px;
  padding: 0.22rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meaning-label.is-match {
  background: rgba(16, 185, 129, 0.12);
  color: rgb(4, 120, 87);
}

.result-meaning-label.is-mismatch {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.result-meaning-label.is-warning {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(180, 83, 9);
}

.result-meaning-label.is-forget {
  background: rgba(139, 92, 246, 0.13);
  color: rgb(109, 40, 217);
}

.scan-time-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.scan-time-chip.is-complete {
  background: rgba(16, 185, 129, 0.12);
  color: rgb(4, 120, 87);
}

.scan-time-chip.is-missing {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.reason-cell {
  max-width: clamp(14rem, 28vw, 30rem);
}

:deep(.verification-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.verification-table .p-datatable-thead > tr > th) {
  width: auto !important;
  padding: 0.65rem 0.8rem !important;
  white-space: nowrap !important;
}

:deep(.verification-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  height: 68px !important;
  padding: 0.55rem 0.8rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

:deep(.p-tag.verify-tag) {
  min-height: 1.3rem !important;
  padding: 0.1rem 0.5rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 1100px) {
  .ot-filter-row {
    grid-template-columns: 1fr 1fr;
  }

  .filter-button {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .ot-filter-row {
    grid-template-columns: 1fr;
  }
}
</style>