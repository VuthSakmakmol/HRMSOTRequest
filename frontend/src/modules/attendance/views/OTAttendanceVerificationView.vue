<!-- frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue -->
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'

import {
  searchOTVerificationRequests,
  verifyOTAttendance,
} from '@/modules/attendance/attendance.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const searchLoading = ref(false)
const payload = ref(null)

const verificationDate = ref(null)
const requestOptions = ref([])
const selectedOtRequestId = ref('')
const tableSearch = ref('')
const tableCategory = ref('')

const categoryOptions = [
  { label: 'All Results', value: '' },
  { label: 'Matched', value: 'MATCH' },
  { label: 'Match Without Exact Out', value: 'MATCH_WITHOUT_EXACT_OUT' },
  { label: 'Mismatch', value: 'MISMATCH' },
  { label: 'Absent Approved', value: 'ABSENT_APPROVED' },
  { label: 'Pending Review', value: 'PENDING_REVIEW' },
  { label: 'Shift Mismatch', value: 'SHIFT_MISMATCH' },
  { label: 'Not Approved', value: 'NOT_APPROVED' },
  { label: 'Not Eligible', value: 'NOT_ELIGIBLE' },
]

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

const isFixedTimeRequest = computed(() => {
  return verification.value?.isFixedTimeOt === true || requestTimingMode.value === 'FIXED_TIME'
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

const summaryCards = computed(() => [
  {
    label: 'Approved',
    value: Number(verification.value?.approvedEmployeeCount || 0),
    icon: 'pi pi-users',
    tone: 'blue',
  },
  {
    label: 'Matched',
    value: verificationRows.value.filter((row) => row.result === 'MATCH').length,
    icon: 'pi pi-check-circle',
    tone: 'green',
  },
  {
    label: 'Mismatch',
    value: verificationRows.value.filter((row) => row.result === 'MISMATCH').length,
    icon: 'pi pi-times-circle',
    tone: 'red',
  },
  {
    label: 'Pending',
    value: Number(verification.value?.pendingReviewCount || 0),
    icon: 'pi pi-clock',
    tone: 'violet',
  },
  {
    label: 'Absent',
    value: Number(verification.value?.absentFromApprovedCount || 0),
    icon: 'pi pi-user-minus',
    tone: 'amber',
  },
  {
    label: 'Not Approved',
    value: Number(verification.value?.attendedButNotApprovedCount || 0),
    icon: 'pi pi-exclamation-triangle',
    tone: 'cyan',
  },
])

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
    put(row, 'PENDING_REVIEW', 'MISMATCH')
  }

  for (const row of notEligibleEmployees.value) {
    put(row, 'NOT_ELIGIBLE', 'MISMATCH')
  }

  for (const row of absentFromApproved.value) {
    put(row, 'ABSENT_APPROVED', 'MISMATCH')
  }

  return Array.from(map.values())
})

const filteredVerificationRows = computed(() => {
  const keyword = String(tableSearch.value || '').trim().toLowerCase()
  const category = String(tableCategory.value || '').trim()

  return verificationRows.value.filter((row) => {
    if (category && row.category !== category && row.result !== category) return false

    if (!keyword) return true

    return [
      row.employeeNo,
      row.employeeName,
      row.categoryLabel,
      row.result,
      row.attendanceStatus,
      row.rawDecision,
      row.reason,
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
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

function parseYMD(value) {
  const raw = s(value)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
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
    MISMATCH: 3,
    NOT_APPROVED: 4,
    NOT_ELIGIBLE: 5,
    PENDING_REVIEW: 6,
    SHIFT_MISMATCH: 7,
    ABSENT_APPROVED: 8,
  }

  return priority[category] || 0
}

function categoryLabel(category) {
  const labels = {
    MATCH: 'Matched',
    MATCH_WITHOUT_EXACT_OUT: 'Match Without Exact Out',
    MISMATCH: 'Mismatch',
    ABSENT_APPROVED: 'Absent Approved',
    PENDING_REVIEW: 'Pending Review',
    SHIFT_MISMATCH: 'Shift Mismatch',
    NOT_APPROVED: 'Not Approved',
    NOT_ELIGIBLE: 'Not Eligible',
  }

  return labels[category] || category || '-'
}

function categorySeverity(category) {
  const normalized = upper(category)

  if (normalized === 'MATCH') return 'success'
  if (normalized === 'MATCH_WITHOUT_EXACT_OUT') return 'success'
  if (normalized === 'PENDING_REVIEW') return 'info'
  if (normalized === 'ABSENT_APPROVED') return 'warning'
  if (normalized === 'NOT_APPROVED') return 'info'
  if (normalized === 'SHIFT_MISMATCH') return 'danger'
  if (normalized === 'NOT_ELIGIBLE') return 'contrast'
  if (normalized === 'MISMATCH') return 'danger'

  return 'secondary'
}

function statusSeverity(value) {
  const normalized = upper(value)

  if (['APPROVED', 'PRESENT', 'MATCH'].includes(normalized)) return 'success'
  if (['PENDING', 'PENDING_REVIEW', 'PENDING_REQUESTER_CONFIRMATION', 'LATE'].includes(normalized)) return 'warning'
  if (['REJECTED', 'ABSENT', 'SHIFT_MISMATCH', 'MISMATCH'].includes(normalized)) return 'danger'
  if (['FORGET_SCAN_IN', 'FORGET_SCAN_OUT'].includes(normalized)) return 'info'
  if (['CANCELLED', 'OFF'].includes(normalized)) return 'secondary'

  return 'contrast'
}

function dayTypeSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return 'danger'
  if (normalized === 'SUNDAY') return 'warning'
  if (normalized === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function timingModeLabel(value) {
  const normalized = upper(value)

  if (normalized === 'FIXED_TIME') return 'Fixed OT'
  if (normalized === 'AFTER_SHIFT_END') return 'After Shift'

  return 'OT Option'
}

function timingModeSeverity(value) {
  return upper(value) === 'FIXED_TIME' ? 'warning' : 'info'
}

function resultSeverity(value) {
  return upper(value) === 'MATCH' ? 'success' : 'danger'
}

function requestOptionLabel(row) {
  const requestNo = s(row?.requestNo) || 'No Request No'
  const requester = s(row?.requesterName)
  const option = s(row?.shiftOtOptionLabel)
  const approvedCount = Number(row?.approvedEmployeeCount || 0)

  return [
    requestNo,
    requester,
    option,
    `${approvedCount} approved`,
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

    console.log('[OTAttendanceVerification] verify payload:', nextPayload)

    payload.value = nextPayload

    if (!verificationDate.value && nextPayload?.otRequest?.otDate) {
      verificationDate.value = parseYMD(nextPayload.otRequest.otDate)
    }
  } catch (error) {
    console.error('[OTAttendanceVerification] verify failed:', error)

    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load OT attendance verification.',
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

async function loadRequestsByDate() {
  const selectedDate = formatDateYMD(verificationDate.value)

  if (!selectedDate) {
    toast.add({
      severity: 'warn',
      summary: 'Attendance date required',
      detail: 'Please select attendance date first.',
      life: 2500,
    })
    return
  }

  searchLoading.value = true
  requestOptions.value = []
  selectedOtRequestId.value = ''
  clearCurrentResultOnly()

  try {
    const response = await searchOTVerificationRequests({
      page: 1,
      limit: 100,
      status: 'APPROVED',
      otDateFrom: selectedDate,
      otDateTo: selectedDate,
    })

    const payloadValue = normalizePayload(response)
    const items = normalizeItems(payloadValue)

    console.log('[OTAttendanceVerification] date search response:', payloadValue)

    requestOptions.value = normalizeRequestOptions(items)

    if (!requestOptions.value.length) {
      toast.add({
        severity: 'warn',
        summary: 'No approved OT requests',
        detail: 'No approved OT request found for the selected date.',
        life: 3000,
      })
    }
  } catch (error) {
    console.error('[OTAttendanceVerification] date search failed:', error)

    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load approved OT requests.',
      life: 3500,
    })
  } finally {
    searchLoading.value = false
  }
}

async function onRequestSelected() {
  if (!selectedOtRequestId.value) {
    clearCurrentResultOnly()
    return
  }

  await loadData()
}

function clearAll() {
  verificationDate.value = null
  requestOptions.value = []
  selectedOtRequestId.value = ''
  clearCurrentResultOnly()
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push('/attendance/imports')
}

watch(
  () => verificationDate.value,
  () => {
    requestOptions.value = []
    selectedOtRequestId.value = ''
    clearCurrentResultOnly()
  },
)

onMounted(() => {
  if (routeOtRequestId.value) {
    selectedOtRequestId.value = routeOtRequestId.value
    loadData()
  }
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-5">
    <section
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] shadow-sm"
    >
      <div class="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold tracking-tight text-[color:var(--ot-text)]">
              OT Attendance Verification
            </h1>

            <Tag
              v-if="payload"
              :value="isFixedTimeRequest ? 'Fixed OT' : timingModeLabel(requestTimingMode)"
              :severity="timingModeSeverity(requestTimingMode)"
              rounded
            />

            <Tag
              v-if="otRequest?.dayType"
              :value="otRequest.dayType"
              :severity="dayTypeSeverity(otRequest.dayType)"
              rounded
            />
          </div>

          <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
            Select date, choose approved OT request, then review matched and exception employees.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            label="Back"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            size="small"
            @click="goBack"
          />

          <Button
            label="Refresh"
            icon="pi pi-refresh"
            size="small"
            :loading="loading"
            :disabled="!activeOtRequestId"
            @click="loadData"
          />
        </div>
      </div>
    </section>

    <section
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] shadow-sm"
    >
      <div class="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[190px,minmax(0,1fr),auto,auto] lg:items-end">
        <div class="space-y-1">
          <label class="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--ot-text-muted)]">
            OT Date
          </label>

          <DatePicker
            v-model="verificationDate"
            dateFormat="yy-mm-dd"
            showIcon
            fluid
            inputClass="w-full"
            placeholder="Select date"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--ot-text-muted)]">
            Approved OT Request
          </label>

          <Select
            v-model="selectedOtRequestId"
            :options="requestOptions"
            optionLabel="optionLabel"
            optionValue="id"
            class="w-full"
            placeholder="Search date first, then select request"
            :loading="searchLoading"
            :disabled="!requestOptions.length || searchLoading"
            filter
            @change="onRequestSelected"
          />
        </div>

        <Button
          label="Search Date"
          icon="pi pi-search"
          size="small"
          :loading="searchLoading"
          @click="loadRequestsByDate"
        />

        <Button
          label="Clear"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearAll"
        />
      </div>
    </section>

    <template v-if="payload">
      <section class="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="verification-stat-card"
          :class="`tone-${card.tone}`"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">
              {{ card.label }}
            </div>
            <i :class="card.icon" class="text-xs opacity-70" />
          </div>
          <div class="mt-1 text-xl font-bold leading-none">
            {{ card.value }}
          </div>
        </div>
      </section>

      <section
        class="grid grid-cols-1 gap-3 rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-3 shadow-sm md:grid-cols-2 xl:grid-cols-6"
      >
        <div class="info-box xl:col-span-1">
          <div class="info-label">Request No</div>
          <div class="info-value">{{ otRequest.requestNo || '-' }}</div>
        </div>

        <div class="info-box xl:col-span-1">
          <div class="info-label">Requester</div>
          <div class="info-value">
            {{ otRequest.requesterEmployeeNo || '-' }} · {{ otRequest.requesterName || '-' }}
          </div>
        </div>

        <div class="info-box">
          <div class="info-label">Shift</div>
          <div class="info-value">{{ requestShiftTime }}</div>
        </div>

        <div class="info-box">
          <div class="info-label">Expected OT</div>
          <div class="info-value">{{ requestExpectedOtTime }}</div>
        </div>

        <div class="info-box">
          <div class="info-label">Requested</div>
          <div class="info-value">{{ requestRequestedOtLabel }}</div>
        </div>

        <div class="info-box">
          <div class="info-label">Policy</div>
          <div class="info-value truncate" :title="requestPolicyLabel">
            {{ requestPolicyLabel }}
          </div>
        </div>
      </section>

      <Card class="overflow-hidden rounded-2xl shadow-sm">
        <template #content>
          <div class="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-base font-semibold text-[color:var(--ot-text)]">
                Verification Result
              </div>

              <Tag
                :value="`${filteredVerificationRows.length} rows`"
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
                  placeholder="Search employee/result/reason"
                />
              </IconField>

              <Select
                v-model="tableCategory"
                :options="categoryOptions"
                optionLabel="label"
                optionValue="value"
                size="small"
                class="w-full sm:w-48"
                placeholder="Result"
              />
            </div>
          </div>

          <DataTable
            :value="filteredVerificationRows"
            dataKey="rowKey"
            scrollable
            scrollHeight="520px"
            tableStyle="min-width: 96rem"
            class="verification-table"
            stripedRows
          >
            <template #empty>
              <div class="py-8 text-center text-sm text-[color:var(--ot-text-muted)]">
                No verification rows found.
              </div>
            </template>

            <Column header="Result" style="min-width: 10rem">
              <template #body="{ data }">
                <div class="flex flex-col gap-1">
                  <Tag
                    :value="data.result"
                    :severity="resultSeverity(data.result)"
                    class="verify-tag"
                  />
                  <Tag
                    :value="data.categoryLabel"
                    :severity="categorySeverity(data.category)"
                    class="verify-tag"
                  />
                </div>
              </template>
            </Column>

            <Column header="Employee" style="min-width: 16rem">
              <template #body="{ data }">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ data.employeeNo || '-' }}
                </div>
                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.employeeName || '-' }}
                </div>
              </template>
            </Column>

            <Column header="OT Type" style="min-width: 9rem">
              <template #body="{ data }">
                <Tag
                  :value="data.isFixed ? 'Fixed OT' : timingModeLabel(data.timingMode)"
                  :severity="timingModeSeverity(data.timingMode)"
                  class="verify-tag"
                />
              </template>
            </Column>

            <Column header="Attendance" style="min-width: 13rem">
              <template #body="{ data }">
                <div class="flex flex-col gap-1 text-sm">
                  <div>
                    In:
                    <span class="font-semibold">{{ data.clockIn || '-' }}</span>
                    · Out:
                    <span class="font-semibold">{{ data.clockOut || '-' }}</span>
                  </div>
                  <Tag
                    :value="data.attendanceStatus || '-'"
                    :severity="statusSeverity(data.attendanceStatus)"
                    class="verify-tag w-fit"
                  />
                </div>
              </template>
            </Column>

            <Column header="Expected OT" style="min-width: 11rem">
              <template #body="{ data }">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ data.expectedOtTime }}
                </div>
                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  Requested: {{ formatMinutesLabel(data.requestedMinutes) }}
                </div>
              </template>
            </Column>

            <Column header="Credited OT" style="min-width: 10rem">
              <template #body="{ data }">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ formatMinutesLabel(data.roundedOtMinutes) }}
                </div>
                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  Actual: {{ formatMinutesLabel(data.actualOtMinutes) }}
                </div>
              </template>
            </Column>

            <Column header="Shift" style="min-width: 13rem">
              <template #body="{ data }">
                <div class="font-medium text-[color:var(--ot-text)]">
                  {{ data.shiftName || '-' }}
                </div>
                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.shiftTime }}
                </div>
              </template>
            </Column>

            <Column header="Reason" style="min-width: 25rem">
              <template #body="{ data }">
                <div class="line-clamp-2 text-sm text-[color:var(--ot-text-muted)]" :title="data.reason">
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
      Select an OT date, search approved requests, then choose one request to verify.
    </div>
  </div>
</template>

<style scoped>
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
  font-weight: 700;
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
  font-weight: 700;
  color: var(--ot-text);
}

:deep(.verification-table .p-datatable-thead > tr > th) {
  padding: 0.65rem 0.8rem !important;
}

:deep(.verification-table .p-datatable-tbody > tr > td) {
  height: 72px !important;
  padding: 0.55rem 0.8rem !important;
  vertical-align: middle !important;
}

:deep(.p-tag.verify-tag) {
  min-height: 1.3rem !important;
  padding: 0.1rem 0.45rem !important;
  font-size: 0.68rem !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>