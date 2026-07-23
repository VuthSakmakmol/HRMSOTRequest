<!-- frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue -->
<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import {
  createAttendanceFromOTVerification,
  deleteAttendanceFromOTVerification,
  createOTRequestFromAttendanceVerification,
  exportDailyOTAttendanceVerification,
  getDailyOTAttendanceVerification,
  getOTAttendanceVerificationHistory,
  recoverAttendanceFromOTVerification,
  recoverOTRequestFromAttendanceVerification,
} from '@/modules/attendance/attendance.api'
import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate, formatDateTime, toApiDate } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()
const auth = useAuthStore()
const canDeleteAttendance = computed(() => auth.hasPermission?.('ATTENDANCE_DELETE') === true)

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 300

// The verification list uses the same lazy-scroll strategy as Attendance Import.
// `rows` has one slot for every backend row; unloaded slots stay null until scrolled into view.
const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())
const loading = ref(false)
const backgroundLoading = ref(false)
const exporting = ref(false)
const actionRowId = ref('')
const hasLoaded = ref(false)
const requestSequence = ref(0)

const historyVisible = ref(false)
const historyRows = ref([])
const historyLoading = ref(false)

const summary = ref(emptySummary())
const filters = reactive({
  attendanceDate: toApiDate(new Date(), ''),
  search: '',
  requester: '',
  employee: '',
  line: '',
  result: '',
  status: '',
})

function tx(key, fallback, params = {}) {
  const translated = t(key, params)
  return translated === key ? fallback : translated
}

const resultOptions = computed(() => [
  { label: tx('attendance.verification.allResults', 'All results'), value: '' },
  { label: tx('attendance.verification.result.matched', 'Matched'), value: 'MATCHED' },
  { label: tx('attendance.verification.result.missingAttendance', 'Missing attendance'), value: 'MISSING_ATTENDANCE' },
  { label: tx('attendance.verification.result.missingOtRequest', 'Missing OT request'), value: 'MISSING_OT_REQUEST' },
  { label: tx('attendance.verification.result.policyMismatch', 'Policy mismatch'), value: 'POLICY_MISMATCH' },
  { label: tx('attendance.verification.result.pendingReview', 'Pending review'), value: 'PENDING_REVIEW' },
  { label: tx('attendance.verification.result.attendanceOnly', 'Attendance only'), value: 'ATTENDANCE_ONLY' },
])

const statusOptions = computed(() => [
  { label: tx('attendance.verification.allRequestStatuses', 'All request statuses'), value: '' },
  { label: tx('ot.status.pending', 'Pending'), value: 'PENDING' },
  { label: tx('ot.status.approved', 'Approved'), value: 'APPROVED' },
  { label: tx('ot.status.rejected', 'Rejected'), value: 'REJECTED' },
  { label: tx('ot.status.cancelled', 'Cancelled'), value: 'CANCELLED' },
])

const apiDate = computed(() => toApiDate(filters.attendanceDate, ''))
const selectedDateLabel = computed(() => formatDate(apiDate.value) || tx('attendance.verification.selectDate', 'Select date'))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const loadedLabel = computed(() =>
  tx(
    'common.loaded',
    `Loaded ${loadedCount.value} of ${totalRecords.value}`,
    { loaded: loadedCount.value, total: totalRecords.value },
  ),
)
const hasAnyData = computed(() => rows.value.some(Boolean))
const isFirstLoading = computed(() => loading.value && !hasLoaded.value)
const useVirtualScroll = computed(() => totalRecords.value > PAGE_SIZE)

const summaryCards = computed(() => [
  {
    label: tx('attendance.verification.summary.requests', 'Requests'),
    value: summary.value.requestCount,
    icon: 'pi pi-file-edit',
    className: 'card-blue',
  },
  {
    label: tx('attendance.verification.summary.employees', 'Employees'),
    value: summary.value.employeeCount,
    icon: 'pi pi-users',
    className: 'card-slate',
  },
  {
    label: tx('attendance.verification.summary.matched', 'Matched'),
    value: summary.value.matchedCount,
    icon: 'pi pi-check-circle',
    className: 'card-green',
  },
  {
    label: tx('attendance.verification.summary.missingAttendance', 'No attendance'),
    value: summary.value.missingAttendanceCount,
    icon: 'pi pi-clock',
    className: 'card-amber',
  },
  {
    label: tx('attendance.verification.summary.missingOtRequest', 'No OT request'),
    value: summary.value.missingRequestCount,
    icon: 'pi pi-file-plus',
    className: 'card-red',
  },
  {
    label: tx('attendance.verification.summary.policyMismatch', 'Policy mismatch'),
    value: summary.value.policyMismatchCount,
    icon: 'pi pi-exclamation-triangle',
    className: 'card-purple',
  },
  {
    label: tx('attendance.verification.summary.pendingReview', 'Pending review'),
    value: summary.value.pendingReviewCount,
    icon: 'pi pi-hourglass',
    className: 'card-amber',
  },
])

function emptySummary() {
  return {
    requestCount: 0,
    employeeCount: 0,
    totalRows: 0,
    matchedCount: 0,
    missingAttendanceCount: 0,
    missingRequestCount: 0,
    attendanceOnlyCount: 0,
    policyMismatchCount: 0,
    pendingReviewCount: 0,
  }
}

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizePayload(response) {
  return response?.data?.data || response?.data || {}
}

function formatMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value || 0)))
  if (!minutes) return '—'

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (!hours) return `${rest}m`
  if (!rest) return `${hours}h`
  return `${hours}h ${rest}m`
}

function displayOtMinutes(row = {}) {
  if (row?.request?.id) {
    return Number(row?.requestedOtMinutes || 0)
  }

  return Number(row?.verifiedOtMinutes || row?.potentialOtMinutes || 0)
}

function policyWindowHint(row = {}) {
  if (row?.request?.id) {
    if (upper(row?.policyResult) === 'MATCH') {
      return tx('attendance.verification.policyVerified', 'Policy verified')
    }

    if (Number(row?.verifiedOtMinutes || 0) > 0) {
      return `${tx('attendance.verification.verified', 'Verified')}: ${formatMinutes(row.verifiedOtMinutes)}`
    }

    return s(row?.policyReason)
  }

  const start = s(row?.policyWindowStartTime)
  const end = s(row?.policyWindowEndTime || row?.attendance?.clockOut)

  if (start && end && Number(row?.potentialOtMinutes || 0) > 0) {
    return `${start} - ${end}`
  }

  return s(row?.policyReason) || tx('attendance.verification.policyChecked', 'Policy checked')
}

function displayEmployee(row) {
  return [s(row?.employee?.employeeNo), s(row?.employee?.employeeName)].filter(Boolean).join(' · ') || '—'
}

function displayRequester(row) {
  return [s(row?.request?.requesterEmployeeCode), s(row?.request?.requesterName)].filter(Boolean).join(' · ') || '—'
}

function displayLine(row) {
  return s(row?.employee?.lineName || row?.employee?.lineCode) || '—'
}

function displayShift(row) {
  return s(row?.request?.shiftName || row?.attendance?.shiftName) || '—'
}

function attendanceText(row) {
  if (!row?.attendance?.id) return '—'

  const clockIn = s(row.attendance.clockIn) || '—'
  const clockOut = s(row.attendance.clockOut) || '—'
  return `${clockIn} – ${clockOut}`
}

function sourceLabel(value) {
  const source = upper(value || 'IMPORT')

  if (source === 'SCAN_STATION') {
    return tx('attendance.source.scanStation', 'Scan Station')
  }

  if (source === 'OT_VERIFICATION') {
    return tx('attendance.source.otVerification', 'OT Verification')
  }

  return tx('attendance.source.import', 'Excel Import')
}

function sourceTagClass(value) {
  const source = upper(value || 'IMPORT')
  if (source === 'SCAN_STATION') return 'attendance-source-scan'
  if (source === 'OT_VERIFICATION') return 'attendance-source-verification'
  return 'attendance-source-import'
}

function resultLabel(value) {
  const labels = {
    MATCHED: tx('attendance.verification.result.matched', 'Matched'),
    MISSING_ATTENDANCE: tx('attendance.verification.result.missingAttendance', 'Missing attendance'),
    MISSING_OT_REQUEST: tx('attendance.verification.result.missingOtRequest', 'Missing OT request'),
    POLICY_MISMATCH: tx('attendance.verification.result.policyMismatch', 'Policy mismatch'),
    PENDING_REVIEW: tx('attendance.verification.result.pendingReview', 'Pending review'),
    ATTENDANCE_ONLY: tx('attendance.verification.result.attendanceOnly', 'Attendance only'),
  }

  return labels[upper(value)] || '—'
}

function resultTagClass(value) {
  const classes = {
    MATCHED: 'attendance-result-matched',
    MISSING_ATTENDANCE: 'attendance-result-missing-attendance',
    MISSING_OT_REQUEST: 'attendance-result-missing-request',
    POLICY_MISMATCH: 'attendance-result-policy-mismatch',
    PENDING_REVIEW: 'attendance-result-pending-review',
    ATTENDANCE_ONLY: 'attendance-result-attendance-only',
  }

  return classes[upper(value)] || 'attendance-result-muted'
}

function requestStatusLabel(value) {
  const status = upper(value)
  const labels = {
    PENDING: tx('ot.status.pending', 'Pending'),
    APPROVED: tx('ot.status.approved', 'Approved'),
    REJECTED: tx('ot.status.rejected', 'Rejected'),
    CANCELLED: tx('ot.status.cancelled', 'Cancelled'),
  }

  return labels[status] || status || '—'
}

function requestStatusTagClass(value) {
  const classes = {
    PENDING: 'attendance-status-pending',
    APPROVED: 'attendance-status-approved',
    REJECTED: 'attendance-status-rejected',
    CANCELLED: 'attendance-status-cancelled',
  }

  return classes[upper(value)] || 'attendance-status-muted'
}

function buildParams(page = 1) {
  return {
    attendanceDate: apiDate.value,
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
    requester: s(filters.requester) || undefined,
    employee: s(filters.employee) || undefined,
    line: s(filters.line) || undefined,
    result: filters.result || undefined,
    status: filters.status || undefined,
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!apiDate.value) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
    summary.value = emptySummary()
    hasLoaded.value = true
    return
  }

  if (!replace && loadedPages.value.has(page)) return

  const sequence = ++requestSequence.value

  if (silent) {
    backgroundLoading.value = true
  } else {
    loading.value = true
  }

  try {
    const payload = normalizePayload(await getDailyOTAttendanceVerification(buildParams(page)))
    if (sequence !== requestSequence.value) return

    const items = Array.isArray(payload.items) ? payload.items : []
    const total = Number(payload?.pagination?.total || 0)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total
    summary.value = { ...emptySummary(), ...(payload.summary || {}) }

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value = new Set([page])
    } else {
      const nextRows = rows.value.length === total
        ? [...rows.value]
        : Array.from({ length: total }, (_, index) => rows.value[index] || null)

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value.add(page)
    }

    hasLoaded.value = true
  } catch (error) {
    if (sequence !== requestSequence.value) return

    if (replace) {
      rows.value = []
      totalRecords.value = 0
      loadedPages.value = new Set()
      summary.value = emptySummary()
    }

    hasLoaded.value = true

    toast.add({
      severity: 'error',
      summary: tx('attendance.verification.loadFailed', 'Verification could not load'),
      detail: getApiErrorMessage(error, tx('attendance.verification.loadFailedDetail', 'Please check the selected date and try again.')),
      life: 4500,
    })
  } finally {
    if (sequence === requestSequence.value) {
      loading.value = false
      backgroundLoading.value = false
    }
  }
}

async function reload() {
  await fetchPage(1, { replace: true, silent: hasLoaded.value })
}

function clearFilters() {
  filters.search = ''
  filters.requester = ''
  filters.employee = ''
  filters.line = ''
  filters.result = ''
  filters.status = ''
  reload()
}

async function onVirtualLazyLoad(event) {
  if (!useVirtualScroll.value) return

  const first = Number(event?.first || 0)
  const last = Number(event?.last || first + PAGE_SIZE)
  const startPage = Math.floor(first / PAGE_SIZE) + 1
  const endPage = Math.floor(Math.max(last - 1, first) / PAGE_SIZE) + 1

  for (let page = startPage; page <= endPage; page += 1) {
    if (!loadedPages.value.has(page)) {
      await fetchPage(page, { silent: true })
    }
  }
}

let filterTimer = null

function scheduleFilterReload() {
  window.clearTimeout(filterTimer)
  filterTimer = window.setTimeout(reload, SEARCH_DELAY_MS)
}

function actionMessage(row, action) {
  const employee = displayEmployee(row)

  if (action === 'createAttendance') {
    return tx(
      'attendance.verification.confirmCreateAttendance',
      `Create attendance for ${employee} from OT request ${row?.request?.requestNo || ''}?`,
      { employee, requestNo: row?.request?.requestNo || '' },
    )
  }

  if (action === 'createRequest') {
    return tx(
      'attendance.verification.confirmCreateRequest',
      `Create a Pending OT request for ${employee} from actual attendance time? The employee's direct manager will be the requester.`,
      { employee },
    )
  }

  if (action === 'recoverRequest') {
    return tx(
      'attendance.verification.confirmRecoverRequest',
      `Recover OT request ${row?.request?.requestNo || ''} for ${employee}? The generated request will be removed and this row will return to Missing OT Request.`,
      { employee, requestNo: row?.request?.requestNo || '' },
    )
  }

  if (action === 'deleteAttendance') {
    return tx(
      'attendance.verification.confirmDeleteAttendance',
      `Delete the attendance record for ${employee}? This cannot be undone and verification will show No Attendance.`,
      { employee },
    )
  }

  return tx(
    'attendance.verification.confirmRecoverAttendance',
    `Recover this OT Verification attendance for ${employee}? It will return to No Attendance.`,
    { employee },
  )
}

async function runAction(row, action) {
  if (!window.confirm(actionMessage(row, action))) return

  actionRowId.value = row.id

  try {
    let response

    if (action === 'createAttendance') {
      response = await createAttendanceFromOTVerification({
        otRequestId: row.request.id,
        employeeId: row.employee.employeeId,
      })
    } else if (action === 'createRequest') {
      response = await createOTRequestFromAttendanceVerification({
        attendanceRecordId: row.attendance.id,
      })
    } else if (action === 'recoverRequest') {
      response = await recoverOTRequestFromAttendanceVerification({
        otRequestId: row.request.id,
      })
    } else if (action === 'recover') {
      response = await recoverAttendanceFromOTVerification({
        attendanceRecordId: row.attendance.id,
      })
    } else {
      response = await deleteAttendanceFromOTVerification(row.attendance.id)
    }

    const payload = normalizePayload(response)
    const detail = action === 'createRequest'
      ? tx('attendance.verification.requestCreatedDetail', `OT request ${payload?.otRequest?.requestNo || ''} was created.`, { requestNo: payload?.otRequest?.requestNo || '' })
      : action === 'recoverRequest'
        ? tx('attendance.verification.requestRecoveredDetail', `OT request ${payload?.requestNo || row?.request?.requestNo || ''} was recovered successfully.`, { requestNo: payload?.requestNo || row?.request?.requestNo || '' })
        : action === 'deleteAttendance'
          ? tx('attendance.verification.attendanceDeletedDetail', 'Attendance was deleted successfully.')
        : action === 'recover'
          ? tx('attendance.verification.attendanceRecoveredDetail', 'Attendance was recovered successfully.')
          : tx('attendance.verification.attendanceCreatedDetail', 'Attendance was created successfully.')

    toast.add({
      severity: 'success',
      summary: tx('common.completed', 'Completed'),
      detail,
      life: 3500,
    })

    await reload()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tx('attendance.verification.actionFailed', 'Action was not completed'),
      detail: getApiErrorMessage(error, tx('attendance.verification.actionFailedDetail', 'Please check the row and try again.')),
      life: 5000,
    })
  } finally {
    actionRowId.value = ''
  }
}

async function openHistory(row = null) {
  historyVisible.value = true
  historyLoading.value = true

  try {
    const payload = normalizePayload(await getOTAttendanceVerificationHistory({
      attendanceDate: apiDate.value || undefined,
      attendanceRecordId: row?.attendance?.id || undefined,
      otRequestId: row?.request?.id || undefined,
    }))

    historyRows.value = Array.isArray(payload.items) ? payload.items : []
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tx('attendance.verification.historyLoadFailed', 'History could not load'),
      detail: getApiErrorMessage(error, tx('attendance.verification.historyLoadFailedDetail', 'Please try again.')),
      life: 4000,
    })
  } finally {
    historyLoading.value = false
  }
}

async function exportExcel() {
  if (!apiDate.value || exporting.value) return

  exporting.value = true

  try {
    const response = await exportDailyOTAttendanceVerification({
      ...buildParams(1),
      page: 1,
      limit: 5000,
    })

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `OT_Verification_${apiDate.value}.xlsx`

    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tx('attendance.verification.exportFailed', 'Export failed'),
      detail: getApiErrorMessage(error, tx('attendance.verification.exportFailedDetail', 'Please try again.')),
      life: 4000,
    })
  } finally {
    exporting.value = false
  }
}

watch(
  apiDate,
  () => {
    reload()
  },
  { immediate: true },
)

watch(
  () => [filters.result, filters.status],
  () => reload(),
)

watch(
  () => [filters.search, filters.requester, filters.employee, filters.line],
  () => scheduleFilterReload(),
)

onBeforeUnmount(() => window.clearTimeout(filterTimer))
</script>

<template>
  <div class="ot-page-shell attendance-verification-page attendance-verification-page--full">
    <section class="ot-filter-bar attendance-verification-filter-bar">
      <div class="ot-field verification-date-field">
        <HolidayDatePicker
          v-model="filters.attendanceDate"
          :label="tx('attendance.verification.date', 'Verification date')"
          :placeholder="tx('attendance.verification.date', 'Verification date')"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="tx('attendance.verification.searchPlaceholder', 'Request no., employee, line...')"
            class="w-full"
            size="small"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ tx('attendance.verification.requester', 'Requester') }}
        </label>

        <InputText
          v-model="filters.requester"
          :placeholder="tx('attendance.verification.requesterPlaceholder', 'Requester ID or name')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ tx('attendance.verification.employee', 'Employee') }}
        </label>

        <InputText
          v-model="filters.employee"
          :placeholder="tx('attendance.verification.employeePlaceholder', 'Employee ID or name')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ tx('attendance.verification.line', 'Line') }}
        </label>

        <InputText
          v-model="filters.line"
          :placeholder="tx('attendance.verification.linePlaceholder', 'Line code or name')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ tx('attendance.verification.requestStatus', 'Request status') }}
        </label>

        <Select
          v-model="filters.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ tx('attendance.verification.resultLabel', 'Result') }}
        </label>

        <Select
          v-model="filters.result"
          :options="resultOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
        />
      </div>

      <div class="attendance-verification-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="attendance-action-button"
          @click="clearFilters"
        />

        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          class="attendance-action-button"
          :loading="loading"
          @click="reload"
        />

        <Button
          :label="t('common.export')"
          icon="pi pi-file-excel"
          severity="success"
          outlined
          size="small"
          class="attendance-action-button"
          :loading="exporting"
          @click="exportExcel"
        />

        <Button
          :label="tx('attendance.verification.history', 'History')"
          icon="pi pi-history"
          severity="secondary"
          outlined
          size="small"
          class="attendance-action-button"
          @click="openHistory()"
        />
      </div>
    </section>

    <section class="ot-table-card attendance-verification-summary-card-wrap">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ tx('attendance.verification.title', 'Daily OT Verification') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <Tag
            :value="selectedDateLabel"
            class="attendance-rgb-tag attendance-date-tag"
          />
        </div>
      </div>

      <div class="attendance-summary-grid">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="attendance-summary-card"
          :class="card.className"
        >
          <div class="summary-icon">
            <i :class="card.icon" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ card.label }}
            </div>

            <div class="summary-value">
              {{ Number(card.value || 0) }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ tx('attendance.verification.listTitle', 'Verification List') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="loading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ t('common.updating') }}
          </span>
        </div>
      </div>

      <div class="ot-table-wrapper">
        <AppTableLoading
          v-if="isFirstLoading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="7"
          :columns="8"
          icon="pi pi-check-square"
        />

        <DataTable
          v-else
          :value="rows"
          lazy
          scrollable
          scroll-height="560px"
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
          class="ot-data-table ot-data-table-compact attendance-verification-table"
          :virtual-scroller-options="useVirtualScroll ? {
            lazy: true,
            onLazyLoad: onVirtualLazyLoad,
            itemSize: 58,
            delay: 0,
            showLoader: false,
            loading: false,
            numToleratedItems: 16,
          } : null"
        >
          <template #empty>
            <div class="ot-empty-state">
              <div class="ot-empty-icon">
                <i :class="hasLoaded ? 'pi pi-calendar-times' : 'pi pi-spin pi-spinner'" />
              </div>

              <div class="ot-empty-title">
                {{ tx('attendance.verification.emptyTitle', 'No verification rows') }}
              </div>

              <div class="ot-empty-text">
                {{ tx('attendance.verification.emptyText', 'Select a Calendar date or adjust the filters.') }}
              </div>
            </div>
          </template>

          <Column
            :header="tx('attendance.verification.requestNo', 'Request No.')"
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <span class="attendance-code-text">
                {{ data?.request?.requestNo || '—' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('common.status')"
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data?.request?.status"
                :value="requestStatusLabel(data?.request?.status)"
                class="attendance-rgb-tag"
                :class="requestStatusTagClass(data?.request?.status)"
              />
              <span v-else class="attendance-meta-text">—</span>
            </template>
          </Column>

          <Column
            :header="tx('attendance.verification.requester', 'Requester')"
            style="width: 15rem; min-width: 15rem"
          >
            <template #body="{ data }">
              <span class="attendance-name-text">
                {{ displayRequester(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tx('attendance.verification.employee', 'Employee')"
            style="width: 18rem; min-width: 18rem"
          >
            <template #body="{ data }">
              <span class="attendance-name-text">
                {{ displayEmployee(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tx('attendance.verification.line', 'Line')"
            style="width: 11rem; min-width: 11rem"
          >
            <template #body="{ data }">
              <span class="attendance-meta-text">
                {{ displayLine(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tx('attendance.verification.shift', 'Shift')"
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <span class="attendance-meta-text">
                {{ displayShift(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tx('attendance.verification.otHours', 'OT Time')"
            style="width: 8rem; min-width: 8rem"
          >
            <template #body="{ data }">
              <div class="attendance-time-cell">
                <span class="attendance-time-value">
                  {{ formatMinutes(displayOtMinutes(data)) }}
                </span>

                <span
                  v-if="policyWindowHint(data)"
                  class="attendance-cell-hint attendance-policy-hint"
                  :title="data?.policyReason || policyWindowHint(data)"
                >
                  {{ policyWindowHint(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="tx('attendance.verification.attendance', 'Attendance')"
            style="width: 14rem; min-width: 14rem"
          >
            <template #body="{ data }">
              <div class="attendance-attendance-cell">
                <span class="attendance-meta-text">
                  {{ attendanceText(data) }}
                </span>

                <Tag
                  v-if="data?.attendance?.id"
                  :value="sourceLabel(data?.attendance?.attendanceSource)"
                  class="attendance-rgb-tag attendance-source-tag"
                  :class="sourceTagClass(data?.attendance?.attendanceSource)"
                />
              </div>
            </template>
          </Column>

          <Column
            :header="tx('attendance.verification.resultLabel', 'Result')"
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <Tag
                :value="resultLabel(data?.result)"
                class="attendance-rgb-tag"
                :class="resultTagClass(data?.result)"
              />
            </template>
          </Column>

          <Column
            :header="t('common.action')"
            class="ot-action-col-header"
            style="width: 18rem; min-width: 18rem"
          >
            <template #body="{ data }">
              <div class="attendance-verification-actions ot-action-col-body">
                <Button
                  v-if="data?.canCreateAttendance"
                  :label="tx('attendance.verification.createAttendance', 'Create attendance')"
                  icon="pi pi-clock"
                  size="small"
                  severity="warning"
                  class="attendance-row-action"
                  :loading="actionRowId === data?.id"
                  @click="runAction(data, 'createAttendance')"
                />

                <Button
                  v-if="data?.canCreateOTRequest"
                  :label="tx('attendance.verification.createOtRequest', 'Create OT request')"
                  icon="pi pi-file-plus"
                  size="small"
                  severity="success"
                  class="attendance-row-action"
                  :loading="actionRowId === data?.id"
                  @click="runAction(data, 'createRequest')"
                />

                <Button
                  v-if="data?.canRecoverOTRequest"
                  :label="tx('attendance.verification.recoverOtRequest', 'Recover OT request')"
                  icon="pi pi-undo"
                  size="small"
                  severity="danger"
                  outlined
                  class="attendance-row-action"
                  :loading="actionRowId === data?.id"
                  @click="runAction(data, 'recoverRequest')"
                />

                <Button
                  v-if="data?.canRecoverAttendance"
                  :label="tx('attendance.verification.recover', 'Recover')"
                  icon="pi pi-undo"
                  size="small"
                  severity="danger"
                  outlined
                  class="attendance-row-action"
                  :loading="actionRowId === data?.id"
                  @click="runAction(data, 'recover')"
                />

                <Button
                  v-if="canDeleteAttendance && data?.attendance?.id && !data?.canRecoverAttendance"
                  :label="tx('attendance.verification.deleteAttendance', 'Delete attendance')"
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  class="attendance-row-action"
                  :loading="actionRowId === data?.id"
                  @click="runAction(data, 'deleteAttendance')"
                />

                <span
                  v-if="
                    !data?.canCreateAttendance &&
                    !data?.canCreateOTRequest &&
                    !data?.canRecoverOTRequest &&
                    !data?.canRecoverAttendance &&
                    !(canDeleteAttendance && data?.attendance?.id)
                  "
                  class="attendance-meta-text"
                >
                  —
                </span>

                <Button
                  icon="pi pi-history"
                  :aria-label="tx('attendance.verification.history', 'History')"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  class="attendance-history-button"
                  @click="openHistory(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="historyVisible"
      modal
      :header="tx('attendance.verification.historyTitle', 'Verification History')"
      :style="{ width: 'min(920px, 96vw)' }"
    >
      <DataTable
        :value="historyRows"
        :loading="historyLoading"
        scrollable
        scroll-height="420px"
        size="small"
        table-style="min-width: 46rem"
        class="attendance-history-table"
      >
        <Column
          field="createdAt"
          :header="tx('attendance.verification.historyTime', 'Time')"
          style="width: 13rem"
        >
          <template #body="{ data }">
            {{ formatDateTime(data.createdAt) || '—' }}
          </template>
        </Column>

        <Column
          field="action"
          :header="t('common.action')"
          style="width: 13rem"
        >
          <template #body="{ data }">
            <Tag
              :value="data.action || '—'"
              class="attendance-rgb-tag attendance-history-action"
            />
          </template>
        </Column>

        <Column
          :header="tx('attendance.verification.employee', 'Employee')"
          style="width: 18rem"
        >
          <template #body="{ data }">
            {{ [data.employeeNo, data.employeeName].filter(Boolean).join(' · ') || '—' }}
          </template>
        </Column>

        <Column
          :header="tx('attendance.verification.requestNo', 'Request No.')"
          style="width: 14rem"
        >
          <template #body="{ data }">
            {{ data.generatedOTRequestNo || data.sourceOTRequestNo || '—' }}
          </template>
        </Column>
      </DataTable>
    </Dialog>
  </div>
</template>

<style scoped>
.attendance-verification-page {
  --attendance-code-rgb: 37 99 235;
  --attendance-name-rgb: 15 23 42;
  --attendance-meta-rgb: 71 85 105;
  --attendance-total-rgb: 100 116 139;
  --attendance-success-rgb: 34 197 94;
  --attendance-failed-rgb: 239 68 68;
  --attendance-amber-rgb: 245 158 11;
  --attendance-blue-rgb: 59 130 246;
  --attendance-muted-rgb: 100 116 139;

  display: grid;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  gap: 0.8rem;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box;
  overflow-x: clip;
}

/* This page must use the complete application content area beside the sidebar. */
:global(.attendance-verification-page.ot-page-shell),
:global(.attendance-verification-page.ot-page-shell > .ot-filter-bar),
:global(.attendance-verification-page.ot-page-shell > .ot-table-card) {
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  box-sizing: border-box;
}

/* =========================
   Filter bar — never wider than the page
   ========================= */
.attendance-verification-filter-bar {
  display: grid;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
  align-items: end;
  overflow: visible;
  box-sizing: border-box;
}

.attendance-verification-filter-bar :deep(.ot-field),
.attendance-verification-filter-bar :deep(.p-iconfield),
.attendance-verification-filter-bar :deep(.p-inputtext),
.attendance-verification-filter-bar :deep(.p-select),
.attendance-verification-filter-bar :deep(.p-select-label) {
  min-width: 0 !important;
  max-width: 100%;
}

.attendance-verification-filter-bar :deep(.p-inputtext),
.attendance-verification-filter-bar :deep(.p-select) {
  width: 100% !important;
  box-sizing: border-box;
}

.verification-date-field {
  position: relative;
  z-index: 5;
  min-width: 0;
}

.attendance-verification-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  box-sizing: border-box;
}

.attendance-verification-filter-actions > * {
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
}

/* =========================
   Summary cards
   ========================= */
.attendance-verification-summary-card-wrap {
  width: 100%;
  min-width: 0;
  overflow: visible;
}

.attendance-summary-grid {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.75rem;
  padding: 0.75rem;
  box-sizing: border-box;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
}

.attendance-summary-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-surface);
  padding: 0.78rem;
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.04);
}

.summary-icon {
  display: flex;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  font-size: 0.85rem;
}

.summary-content { min-width: 0; flex: 1; }
.summary-label { overflow: hidden; color: var(--ot-text-muted); font-size: 0.68rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.summary-value { margin-top: 0.15rem; overflow: hidden; color: var(--ot-text); font-size: 0.9rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.card-blue .summary-icon { background: rgb(var(--attendance-blue-rgb) / 0.13); color: rgb(var(--attendance-blue-rgb)); }
.card-green .summary-icon { background: rgb(var(--attendance-success-rgb) / 0.13); color: rgb(var(--attendance-success-rgb)); }
.card-red .summary-icon { background: rgb(var(--attendance-failed-rgb) / 0.13); color: rgb(var(--attendance-failed-rgb)); }
.card-amber .summary-icon { background: rgb(var(--attendance-amber-rgb) / 0.13); color: rgb(var(--attendance-amber-rgb)); }
.card-slate .summary-icon { background: rgb(var(--attendance-total-rgb) / 0.13); color: rgb(var(--attendance-total-rgb)); }
.card-purple .summary-icon { background: rgb(139 92 246 / 0.13); color: rgb(124 58 237); }

/* =========================
   Cells and RGB tags
   ========================= */
.attendance-code-text,
.attendance-name-text,
.attendance-meta-text {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}
.attendance-code-text { color: rgb(var(--attendance-code-rgb)); font-size: 0.8rem; font-weight: 750; font-variant-numeric: tabular-nums; }
.attendance-name-text { color: rgb(var(--attendance-name-rgb)); font-size: 0.78rem; font-weight: 650; }
.attendance-meta-text { color: rgb(var(--attendance-meta-rgb)); font-size: 0.78rem; font-weight: 500; }
.attendance-time-cell,
.attendance-attendance-cell { display: inline-flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; gap: 0.24rem; }
.attendance-time-value { color: var(--ot-text); font-size: 0.8rem; font-weight: 750; white-space: nowrap; }
.attendance-cell-hint { color: var(--ot-text-muted); font-size: 0.65rem; font-weight: 550; white-space: nowrap; }
.attendance-policy-hint { max-width: 10rem; overflow: hidden; text-overflow: ellipsis; }

.attendance-rgb-tag {
  --attendance-tag-rgb: var(--attendance-muted-rgb);
  display: inline-flex !important;
  min-height: 1.42rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--attendance-tag-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--attendance-tag-rgb) / 0.11);
  color: rgb(var(--attendance-tag-rgb));
  padding: 0.12rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 750;
  line-height: 1;
  text-align: center !important;
  vertical-align: middle;
  white-space: nowrap;
}
.attendance-date-tag,
.attendance-source-import,
.attendance-result-attendance-only,
.attendance-history-action { --attendance-tag-rgb: var(--attendance-blue-rgb); }
.attendance-source-scan,
.attendance-status-approved,
.attendance-result-matched { --attendance-tag-rgb: var(--attendance-success-rgb); }
.attendance-source-verification,
.attendance-status-pending,
.attendance-result-missing-attendance,
.attendance-result-pending-review { --attendance-tag-rgb: var(--attendance-amber-rgb); }
.attendance-status-rejected,
.attendance-result-missing-request { --attendance-tag-rgb: var(--attendance-failed-rgb); }
.attendance-result-policy-mismatch { --attendance-tag-rgb: 124 58 237; }
.attendance-status-cancelled,
.attendance-status-muted,
.attendance-result-muted { --attendance-tag-rgb: var(--attendance-total-rgb); }
.attendance-source-tag { min-height: 1.3rem; font-size: 0.64rem; }

.attendance-verification-actions { display: inline-flex; min-height: 2rem; align-items: center; justify-content: center; gap: 0.28rem; white-space: nowrap; }
:deep(.attendance-row-action .p-button-label) { font-size: 0.7rem; font-weight: 650; }
:deep(.attendance-row-action .p-button-icon),
:deep(.attendance-history-button .p-button-icon),
:deep(.attendance-action-button .p-button-icon) { font-size: 0.76rem; }

/* =========================
   Lazy table
   ========================= */
:deep(.attendance-verification-table.p-datatable) { width: 100%; min-width: 0; }
:deep(.attendance-verification-table.p-datatable .p-datatable-wrapper) { width: 100%; max-width: 100%; overflow-x: auto; }
:deep(.attendance-verification-table.p-datatable .p-datatable-table) { width: max-content !important; min-width: 100% !important; table-layout: auto !important; }
:deep(.attendance-verification-table.p-datatable .p-datatable-thead > tr > th),
:deep(.attendance-verification-table.p-datatable .p-datatable-tbody > tr > td) { text-align: center !important; vertical-align: middle !important; }
:deep(.attendance-verification-table.p-datatable .p-datatable-thead > tr > th) { padding: 0.58rem 0.68rem !important; white-space: nowrap !important; font-size: 0.78rem !important; font-weight: 650 !important; }
:deep(.attendance-verification-table.p-datatable .p-datatable-tbody > tr > td) { height: 58px !important; padding: 0.42rem 0.62rem !important; white-space: nowrap !important; font-size: 0.8rem !important; }
:deep(.attendance-verification-table.p-datatable .p-datatable-tbody > tr > td > *) { margin-inline: auto !important; }
:deep(.attendance-verification-table.p-datatable .p-tag),
:deep(.attendance-verification-table.p-datatable .p-button) { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin-inline: auto !important; text-align: center !important; }
:deep(.attendance-verification-table.p-datatable .p-tag-value) { max-width: 100%; overflow: hidden; text-align: center !important; text-overflow: ellipsis; }
:deep(.attendance-history-table .p-datatable-thead > tr > th),
:deep(.attendance-history-table .p-datatable-tbody > tr > td) { text-align: center; vertical-align: middle; }

/* =========================
   Dark mode
   ========================= */
:global(.dark) .attendance-verification-page { --attendance-name-rgb: 226 232 240; --attendance-meta-rgb: 203 213 225; }
:global(.dark) .attendance-summary-card { box-shadow: none; }
:global(.dark) .card-blue .summary-icon { background: rgb(var(--attendance-blue-rgb) / 0.18); color: #93c5fd; }
:global(.dark) .card-green .summary-icon { background: rgb(var(--attendance-success-rgb) / 0.18); color: #86efac; }
:global(.dark) .card-red .summary-icon { background: rgb(var(--attendance-failed-rgb) / 0.18); color: #fca5a5; }
:global(.dark) .card-purple .summary-icon { background: rgb(139 92 246 / 0.2); color: #c4b5fd; }
:global(.dark) .card-amber .summary-icon { background: rgb(var(--attendance-amber-rgb) / 0.18); color: #fcd34d; }
:global(.dark) .card-slate .summary-icon { background: rgb(var(--attendance-total-rgb) / 0.18); color: #cbd5e1; }
:global(.dark) .attendance-rgb-tag { border-color: rgb(var(--attendance-tag-rgb) / 0.42); background: rgb(var(--attendance-tag-rgb) / 0.18); }

/* =========================
   Small screens
   ========================= */
@media (max-width: 640px) {
  .attendance-verification-filter-actions { justify-content: stretch; }
  .attendance-verification-filter-actions > * { flex: 1 1 calc(50% - 0.25rem); }
  .attendance-verification-filter-actions .ot-loaded-badge { flex-basis: 100%; }
  .attendance-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1200px) {
  .attendance-summary-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}

/* =========================================
   Verification table: exact header/cell alignment
   ========================================= */
:deep(.attendance-verification-table.p-datatable .p-datatable-thead > tr > th),
:deep(.attendance-verification-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.attendance-verification-table.p-datatable .p-datatable-column-header-content),
:deep(.attendance-verification-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  min-width: 0 !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.28rem !important;
  text-align: center !important;
}

:deep(.attendance-verification-table.p-datatable .p-datatable-column-title),
:deep(.attendance-verification-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  min-width: 0 !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.attendance-verification-table.p-datatable .p-sortable-column-icon),
:deep(.attendance-verification-table.p-datatable .p-datatable-sort-icon) {
  margin-inline: 0 !important;
  flex: 0 0 auto !important;
}

:deep(.attendance-verification-table.p-datatable .p-datatable-tbody > tr > td > *),
:deep(.attendance-verification-table.p-datatable .attendance-time-cell),
:deep(.attendance-verification-table.p-datatable .attendance-attendance-cell),
:deep(.attendance-verification-table.p-datatable .attendance-verification-actions) {
  margin-inline: auto !important;
}

:deep(.attendance-verification-table.p-datatable .p-datatable-tbody > tr > td .p-button),
:deep(.attendance-verification-table.p-datatable .p-datatable-tbody > tr > td .p-tag) {
  margin-inline: auto !important;
}

</style>
