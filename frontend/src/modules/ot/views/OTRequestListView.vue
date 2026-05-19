<!-- frontend/src/modules/ot/views/OTRequestListView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestListView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import {
  exportOTRequestsExcel,
  getOTRequests,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const { t } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())
const expandedRows = ref({})

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const exporting = ref(false)

const filters = reactive({
  search: '',
  status: '',
  dayType: '',
  otDateFrom: '',
  otDateTo: '',
  sortBy: 'createdAt',
  sortOrder: -1,
})

let searchTimer = null
let currentRequestId = 0

const canCreate = computed(() => auth.hasPermission('OT_REQUEST_CREATE'))
const canExport = computed(() => auth.hasPermission('OT_REQUEST_VIEW'))

const totalRequests = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRequests.value > PAGE_SIZE)

const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalRequests.value,
  }),
)

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('ot.status.pending'), value: 'PENDING' },
  {
    label: t('ot.status.pendingRequesterConfirmation'),
    value: 'PENDING_REQUESTER_CONFIRMATION',
  },
  { label: t('ot.status.approved'), value: 'APPROVED' },
  { label: t('ot.status.rejected'), value: 'REJECTED' },
  { label: t('ot.status.requesterDisagreed'), value: 'REQUESTER_DISAGREED' },
  { label: t('ot.status.cancelled'), value: 'CANCELLED' },
])

const dayTypeOptions = computed(() => [
  { label: t('ot.requests.allDayTypes'), value: '' },
  { label: t('ot.dayType.workingDay'), value: 'WORKING_DAY' },
  { label: t('ot.dayType.sunday'), value: 'SUNDAY' },
  { label: t('ot.dayType.holiday'), value: 'HOLIDAY' },
])

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.requests)) return payload.requests
  if (Array.isArray(payload?.otRequests)) return payload.otRequests
  if (Array.isArray(payload?.rows)) return payload.rows

  return []
}

function normalizeTotal(payload) {
  return Number(
    payload?.pagination?.total ||
      payload?.pagination?.totalRecords ||
      payload?.total ||
      payload?.totalRecords ||
      payload?.count ||
      0,
  )
}

function normalizeRow(row) {
  if (!row) return row

  return {
    ...row,
    id: String(
      row?.id ||
        row?._id ||
        row?.requestId ||
        row?.otRequestId ||
        row?.requestNo ||
        '',
    ).trim(),
  }
}

function rowIdOf(row) {
  return String(row?.id || row?._id || row?.requestId || row?.otRequestId || '').trim()
}

function upper(value) {
  return String(value || '').trim().toUpperCase()
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }

  return ''
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateYMD(value) {
  if (!value) return undefined

  const raw = String(value || '').trim()

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) return raw

  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDateDMY(value) {
  if (!value) return '-'

  const raw = String(value || '').trim()

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return raw || '-'

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatDateTimeDMY(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')

  const dd = pad2(date.getDate())
  const mm = pad2(date.getMonth() + 1)
  const yyyy = date.getFullYear()
  const hh = pad2(date.getHours())
  const min = pad2(date.getMinutes())

  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

function statusLabel(value, key = '') {
  if (key) return t(key)

  const normalized = upper(value)

  if (normalized === 'PENDING') return t('ot.status.pending')
  if (normalized === 'PENDING_REQUESTER_CONFIRMATION') {
    return t('ot.status.pendingRequesterConfirmation')
  }
  if (normalized === 'APPROVED') return t('ot.status.approved')
  if (normalized === 'REJECTED') return t('ot.status.rejected')
  if (normalized === 'REQUESTER_DISAGREED') return t('ot.status.requesterDisagreed')
  if (normalized === 'CANCELLED') return t('ot.status.cancelled')

  return normalized || t('common.unknown')
}

function approvalDisplay(row) {
  const display = row?.approvalDisplay || {}

  return {
    type: firstText(display.type, row?.approvalDisplayType, row?.status, 'UNKNOWN'),
    label: firstText(
      display.label,
      row?.approvalDisplayLabel,
      row?.approvalStatusLabel,
      row?.statusLabel,
      statusLabel(row?.status, row?.statusKey),
    ),
    subLabel: firstText(display.subLabel, row?.approvalDisplaySubLabel, ''),
    severity: firstText(display.severity, row?.approvalDisplaySeverity, ''),
  }
}

function approvalDisplayTagClass(row) {
  const display = approvalDisplay(row)
  const type = upper(display.type)
  const severity = upper(display.severity)

  if (severity === 'SUCCESS' || type.includes('APPROVED')) {
    return ['ot-request-rgb-tag', 'approval-display-tag', 'ot-request-tag-approved']
  }

  if (
    severity === 'DANGER' ||
    severity === 'ERROR' ||
    type.includes('REJECTED') ||
    type.includes('DISAGREED')
  ) {
    return ['ot-request-rgb-tag', 'approval-display-tag', 'ot-request-tag-rejected']
  }

  if (severity === 'INFO' || type.includes('CONFIRMATION')) {
    return ['ot-request-rgb-tag', 'approval-display-tag', 'ot-request-tag-info']
  }

  if (severity === 'WARNING' || severity === 'WARN' || type.includes('PENDING')) {
    return ['ot-request-rgb-tag', 'approval-display-tag', 'ot-request-tag-pending']
  }

  if (type.includes('CANCELLED')) {
    return ['ot-request-rgb-tag', 'approval-display-tag', 'ot-request-tag-muted']
  }

  return ['ot-request-rgb-tag', 'approval-display-tag', 'ot-request-tag-muted']
}

function dayTypeLabel(value, key = '') {
  if (key) return t(key)

  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return t('ot.dayType.holiday')
  if (normalized === 'SUNDAY') return t('ot.dayType.sunday')
  if (normalized === 'WORKING_DAY') return t('ot.dayType.workingDay')

  return normalized || t('common.unknown')
}

function dayTypeTagClass(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return ['ot-request-rgb-tag', 'ot-request-tag-holiday']
  if (normalized === 'SUNDAY') return ['ot-request-rgb-tag', 'ot-request-tag-sunday']
  if (normalized === 'WORKING_DAY') return ['ot-request-rgb-tag', 'ot-request-tag-working']

  return ['ot-request-rgb-tag', 'ot-request-tag-muted']
}

function isLegacyManualMode(row) {
  const shiftId = String(row?.shiftId || '').trim()
  const shiftOtOptionId = String(row?.shiftOtOptionId || '').trim()

  return !shiftId && !shiftOtOptionId
}

function timingSourceLabel(row) {
  const source = upper(row?.otTimingSource || row?.timingSource || 'SHIFT_OPTION')

  if (source === 'CUSTOM_FIXED') return t('ot.requests.customFixed')

  return t('ot.requests.preset')
}

function timingSourceTagClass(row) {
  const source = upper(row?.otTimingSource || row?.timingSource || 'SHIFT_OPTION')

  if (source === 'CUSTOM_FIXED') return ['ot-request-rgb-tag', 'ot-request-tag-info']

  return ['ot-request-rgb-tag', 'ot-request-tag-muted']
}

function formatTimeRange(row) {
  const start = String(row?.requestStartTime || row?.startTime || row?.otStartTime || '').trim()
  const end = String(row?.requestEndTime || row?.endTime || row?.otEndTime || '').trim()

  if (!start && !end) return '-'

  return [start, end].filter(Boolean).join(' - ')
}

function formatOtOptionLabel(row) {
  const label = String(
    row?.shiftOtOptionLabel ||
      row?.shiftOTOptionLabel ||
      row?.otOptionLabel ||
      row?.shiftOtOptionName ||
      row?.otOptionName ||
      row?.optionName ||
      '',
  ).trim()

  if (label) return label

  return isLegacyManualMode(row) ? t('ot.approval.legacyManual') : '-'
}

function formatMinutesLabel(value) {
  const minutes = Number(value || 0)

  if (!minutes) return t('ot.common.minuteValue', { value: 0 })

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) {
    return t('ot.common.hourMinuteValue', {
      hours,
      minutes: mins,
    })
  }

  if (hours) return t('ot.common.hourValue', { value: hours })

  return t('ot.common.minuteValue', { value: mins })
}

function formatRequester(row) {
  const name = String(
    row?.requesterName ||
      row?.createdByName ||
      row?.ownerName ||
      row?.employeeName ||
      '',
  ).trim()

  const employeeNo = String(
    row?.requesterEmployeeNo ||
      row?.requesterEmployeeCode ||
      row?.requesterCode ||
      row?.createdByEmployeeNo ||
      row?.employeeNo ||
      '',
  ).trim()

  return {
    name: name || '-',
    employeeNo: employeeNo || '-',
  }
}

function getTargetEmployees(row) {
  if (Array.isArray(row?.employees)) return row.employees
  if (Array.isArray(row?.approvedEmployees)) return row.approvedEmployees
  if (Array.isArray(row?.requestedEmployees)) return row.requestedEmployees
  if (Array.isArray(row?.employeeItems)) return row.employeeItems
  if (Array.isArray(row?.targetEmployees)) return row.targetEmployees
  if (Array.isArray(row?.employeeList)) return row.employeeList
  if (Array.isArray(row?.staffRows)) return row.staffRows
  if (Array.isArray(row?.employeeDetails)) return row.employeeDetails
  if (Array.isArray(row?.requestEmployees)) return row.requestEmployees
  if (Array.isArray(row?.staff)) return row.staff
  if (Array.isArray(row?.details)) return row.details

  return []
}

function getEmployeeCount(row) {
  const explicitCount = Number(
    row?.employeeCount ||
      row?.approvedEmployeeCount ||
      row?.requestedEmployeeCount ||
      row?.totalEmployees ||
      row?.staffCount ||
      0,
  )

  if (explicitCount > 0) return explicitCount

  return getTargetEmployees(row).length
}

function employeeIdOf(employee) {
  return String(employee?.employeeId || employee?._id || employee?.id || '').trim()
}

function employeeNameOf(employee) {
  const employeeSnapshot = employee?.employee || employee?.employeeSnapshot || {}

  return String(
    employee?.employeeName ||
      employee?.displayName ||
      employee?.name ||
      employee?.fullName ||
      employeeSnapshot?.displayName ||
      employeeSnapshot?.employeeName ||
      '-',
  ).trim() || '-'
}

function employeeCodeOf(employee) {
  const employeeSnapshot = employee?.employee || employee?.employeeSnapshot || {}

  return String(
    employee?.employeeCode ||
      employee?.employeeNo ||
      employee?.code ||
      employee?.loginId ||
      employeeSnapshot?.employeeCode ||
      employeeSnapshot?.employeeNo ||
      '-',
  ).trim() || '-'
}

function employeePositionOf(employee) {
  const position = employee?.position || employee?.positionSnapshot || {}

  return String(
    employee?.positionName ||
      employee?.position ||
      employee?.positions ||
      employee?.positionTitle ||
      position?.name ||
      position?.positionName ||
      '-',
  ).trim() || '-'
}

function employeeDepartmentOf(employee) {
  return String(
    employee?.departmentName ||
      employee?.department?.name ||
      '-',
  ).trim() || '-'
}

function employeeLineOf(employee, row = null) {
  const directLabel = firstText(
    employee?.lineLabel,
    employee?.productionLineLabel,
    employee?.employeeLineLabel,
    employee?.assignedLineLabel,
    employee?.lineDisplay,
    employee?.productionLineDisplay,
    employee?.lineText,
  )

  if (directLabel) return directLabel

  const code = firstText(
    employee?.lineCode,
    employee?.productionLineCode,
    employee?.employeeLineCode,
    employee?.assignedLineCode,
    employee?.line?.code,
    employee?.line?.lineCode,
    employee?.productionLine?.code,
    employee?.productionLine?.lineCode,
    employee?.productionLineId?.code,
    employee?.productionLineId?.lineCode,
    employee?.lineId?.code,
    employee?.lineId?.lineCode,
    row?.lineCode,
    row?.productionLineCode,
    row?.line?.code,
    row?.productionLine?.code,
  )

  const name = firstText(
    employee?.lineName,
    employee?.productionLineName,
    employee?.employeeLineName,
    employee?.assignedLineName,
    employee?.line?.name,
    employee?.line?.lineName,
    employee?.productionLine?.name,
    employee?.productionLine?.lineName,
    employee?.productionLineId?.name,
    employee?.productionLineId?.lineName,
    employee?.lineId?.name,
    employee?.lineId?.lineName,
    row?.lineName,
    row?.productionLineName,
    row?.line?.name,
    row?.productionLine?.name,
  )

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name

  const fallback = firstText(
    employee?.lineNo,
    employee?.lineNumber,
    employee?.productionLineNo,
    employee?.productionLineNumber,
    employee?.line,
    employee?.productionLine,
  )

  return fallback
}

function lineSummaryOfRow(row) {
  const employees = getTargetEmployees(row)
  const uniqueLines = Array.from(
    new Set(
      employees
        .map((employee) => employeeLineOf(employee, row))
        .map((line) => String(line || '').trim())
        .filter(Boolean),
    ),
  )

  if (uniqueLines.length === 1) return uniqueLines[0]
  if (uniqueLines.length > 1) return uniqueLines.join(', ')

  return firstText(
    row?.lineLabel,
    row?.productionLineLabel,
    row?.lineCode,
    row?.productionLineCode,
    row?.lineName,
    row?.productionLineName,
  ) || '-'
}

function employeeOtTimeOf(employee, row) {
  const employeeStart = String(
    employee?.requestStartTime ||
      employee?.startTime ||
      employee?.otStartTime ||
      employee?.approvedStartTime ||
      '',
  ).trim()

  const employeeEnd = String(
    employee?.requestEndTime ||
      employee?.endTime ||
      employee?.otEndTime ||
      employee?.approvedEndTime ||
      '',
  ).trim()

  if (employeeStart || employeeEnd) {
    return [employeeStart, employeeEnd].filter(Boolean).join(' - ')
  }

  return formatTimeRange(row)
}

function employeeBreakMinutesOf(employee, row) {
  const value = Number(
    employee?.breakMinutes ??
      employee?.otBreakMinutes ??
      employee?.approvedBreakMinutes ??
      row?.breakMinutes ??
      0,
  )

  return Number.isFinite(value) && value >= 0 ? value : 0
}

function employeeTotalMinutesOf(employee, row) {
  const value = Number(
    employee?.totalMinutes ??
      employee?.requestedMinutes ??
      employee?.otMinutes ??
      employee?.approvedMinutes ??
      row?.totalMinutes ??
      row?.requestedMinutes ??
      0,
  )

  return Number.isFinite(value) && value >= 0 ? value : 0
}

function employeeTimeModeOf(employee) {
  const mode = upper(employee?.otTimeMode || employee?.timeMode || 'DEFAULT')

  return mode === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT'
}

function employeeTimeModeLabel(employee) {
  return employeeTimeModeOf(employee) === 'CUSTOM'
    ? t('ot.requests.timeMode.custom')
    : t('ot.requests.timeMode.default')
}

function employeeTimeModeTagClass(employee) {
  return employeeTimeModeOf(employee) === 'CUSTOM'
    ? ['ot-request-rgb-tag', 'ot-request-tag-pending']
    : ['ot-request-rgb-tag', 'ot-request-tag-approved']
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTRequests(buildQuery(page))

    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload).map(normalizeRow)
    const total = normalizeTotal(payload)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
      expandedRows.value = {}
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const nextRows = [...rows.value]

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    bootstrapped.value = true

    toast.add({
      severity: 'error',
      summary: t('common.loadFailed'),
      detail: getApiErrorMessage(error, t('ot.requests.loadFailed')),
      life: 3500,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
    expandedRows.value = {}
    bootstrapped.value = false
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
  })
}

function runSearchSoon() {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    reloadFirstPage({ keepVisible: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortBy = event.sortField || 'createdAt'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : -1

  reloadFirstPage({ keepVisible: true })
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

async function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
  filters.otDateFrom = ''
  filters.otDateTo = ''
  filters.sortBy = 'createdAt'
  filters.sortOrder = -1

  await reloadFirstPage({ keepVisible: true })
}

function getFilenameFromHeader(res, fallback) {
  const disposition = String(res?.headers?.['content-disposition'] || '')
  const match = disposition.match(/filename="?([^"]+)"?/i)

  return match?.[1] || fallback
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.URL.revokeObjectURL(url)
}

async function handleExport() {
  exporting.value = true

  try {
    const res = await exportOTRequestsExcel(buildExportQuery())

    const blob =
      res?.data instanceof Blob
        ? res.data
        : new Blob([res?.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

    downloadBlob(blob, getFilenameFromHeader(res, `ot-requests-${Date.now()}.xlsx`))

    toast.add({
      severity: 'success',
      summary: t('ot.requests.exported'),
      detail: t('ot.requests.exportedSuccess'),
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('ot.requests.exportFailed'),
      detail: getApiErrorMessage(error, t('ot.requests.exportFailed')),
      life: 3500,
    })
  } finally {
    exporting.value = false
  }
}

function openCreateRequest() {
  router.push('/ot/requests/create')
}

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell ot-request-list-page">
    <section class="ot-filter-bar ot-request-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('common.search')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.status') }}
        </label>

        <Select
          v-model="filters.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('common.status')"
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('ot.requests.dayType') }}
        </label>

        <Select
          v-model="filters.dayType"
          :options="dayTypeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('ot.requests.dayType')"
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateFrom"
          :label="t('ot.requests.otDateFrom')"
          :placeholder="t('ot.requests.otDateFrom')"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateTo"
          :label="t('ot.requests.otDateTo')"
          :placeholder="t('ot.requests.otDateTo')"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-request-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="ot-request-action-button"
          @click="clearFilters"
        />

        <Button
          v-if="canExport"
          :label="t('ot.requests.exportExcel')"
          icon="pi pi-file-excel"
          severity="secondary"
          outlined
          size="small"
          class="ot-request-action-button ot-request-export-button"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('ot.requests.newRequest')"
          icon="pi pi-plus"
          size="small"
          class="ot-request-action-button"
          @click="openCreateRequest"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('ot.requests.tableTitle') || t('ot.requests.requestNo') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ t('common.updating') }}
          </span>
        </div>
      </div>

      <AppTableLoading
        v-if="firstLoading"
        :title="t('ot.requests.loading')"
        :message="t('ot.requests.fetchingRecords')"
        :rows="8"
        :columns="14"
      />

      <DataTable
        v-else
        v-model:expandedRows="expandedRows"
        :value="rows"
        data-key="id"
        lazy
        removable-sort
        scrollable
        scroll-height="500px"
        :sort-field="filters.sortBy"
        :sort-order="filters.sortOrder"
        table-style="width: max-content; min-width: 100%; table-layout: auto;"
        class="ot-request-table ot-data-table ot-data-table-compact"
        :virtual-scroller-options="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 70,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
        @sort="onSort"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="ot-empty-state"
          >
            <div class="ot-empty-icon">
              <i class="pi pi-clock" />
            </div>

            <div class="ot-empty-title">
              {{ t('common.noData') }}
            </div>

            <div class="ot-empty-text">
              {{ t('ot.requests.noData') }}
            </div>
          </div>
        </template>

        <Column
          expander
          style="width: 3rem; min-width: 3rem"
        />

        <Column
          field="requestNo"
          :header="t('ot.requests.requestNo')"
          sortable
          style="width: 10rem; min-width: 10rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-request-no-text"
            >
              {{ data.requestNo || data.otRequestNo || '-' }}
            </span>
          </template>
        </Column>

        <Column
          :header="t('ot.requests.requester')"
          style="width: 13rem; min-width: 13rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="requester-cell"
            >
              <div class="ot-request-main-text">
                {{ formatRequester(data).name }}
              </div>

              <div class="ot-request-sub-text">
                {{ formatRequester(data).employeeNo }}
              </div>
            </div>
          </template>
        </Column>

        <Column
          field="status"
          :header="t('ot.requests.approvalStatus')"
          style="width: 15rem; min-width: 15rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="approval-status-cell"
            >
              <Tag
                :value="approvalDisplay(data).label"
                :class="approvalDisplayTagClass(data)"
              />
            </div>
          </template>
        </Column>

        <Column
          :header="t('ot.approval.requestedStaff')"
          style="width: 9rem; min-width: 9rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="t('ot.requests.staffCount', { count: Number(data?.requestedEmployeeCount || getEmployeeCount(data)) })"
              :class="['ot-request-rgb-tag', 'ot-request-tag-info']"
            />
          </template>
        </Column>

        <Column
          field="otDate"
          :header="t('ot.requests.otDate')"
          sortable
          style="width: 9rem; min-width: 9rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-request-meta-text"
            >
              {{ formatDateDMY(data.otDate) }}
            </span>
          </template>
        </Column>

        <Column
          :header="t('ot.requests.otTime')"
          style="width: 10rem; min-width: 10rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-request-meta-text"
            >
              {{ formatTimeRange(data) }}
            </span>
          </template>
        </Column>

        <Column
          :header="t('ot.requests.otOption')"
          style="width: 14rem; min-width: 14rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="ot-option-cell"
            >
              <div class="ot-request-main-text">
                {{ formatOtOptionLabel(data) }}
              </div>

              <div class="ot-request-sub-text">
                {{ t('ot.approval.requested') }}:
                {{ formatMinutesLabel(data.requestedMinutes) }}
              </div>
            </div>
          </template>
        </Column>

        <Column
          :header="t('ot.approval.breakTime')"
          style="width: 8rem; min-width: 8rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-request-meta-text"
            >
              {{ formatMinutesLabel(data.breakMinutes) }}
            </span>
          </template>
        </Column>

        <Column
          :header="t('ot.approval.totalRequestPaid')"
          style="width: 11rem; min-width: 11rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="formatMinutesLabel(data.totalMinutes)"
              :class="['ot-request-rgb-tag', 'ot-request-tag-approved']"
            />
          </template>
        </Column>

        <Column
          :header="t('nav.lines')"
          style="width: 12rem; min-width: 12rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-request-line-text"
            >
              {{ lineSummaryOfRow(data) }}
            </span>
          </template>
        </Column>

        <Column
          :header="t('ot.requests.timing')"
          style="width: 9rem; min-width: 9rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="timingSourceLabel(data)"
              :class="timingSourceTagClass(data)"
            />
          </template>
        </Column>

        <Column
          field="dayType"
          :header="t('ot.requests.dayType')"
          sortable
          style="width: 10rem; min-width: 10rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="dayTypeLabel(data.dayType, data.dayTypeKey)"
              :class="dayTypeTagClass(data.dayType)"
            />
          </template>
        </Column>

        <Column
          field="createdAt"
          :header="t('common.createdAt')"
          sortable
          style="width: 12rem; min-width: 12rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-request-meta-text"
            >
              {{ formatDateTimeDMY(data.createdAt) }}
            </span>
          </template>
        </Column>

        <template #expansion="{ data }">
          <div class="ot-expanded-box">
            <div
              v-if="getTargetEmployees(data).length"
              class="ot-expanded-content"
            >
              <div class="ot-expanded-responsive-table">
                <div class="ot-expanded-grid-row is-head">
                  <div>{{ t('common.no') }}</div>
                  <div>{{ t('ot.requests.employeeId') }}</div>
                  <div>{{ t('common.name') }}</div>
                  <div>{{ t('nav.positions') }}</div>
                  <div>{{ t('ot.requests.otTime') }}</div>
                  <div>{{ t('ot.requests.break') }}</div>
                  <div>{{ t('ot.approval.totalPaid') }}</div>
                  <div>{{ t('ot.requests.mode') }}</div>
                  <div>{{ t('nav.departments') }}</div>
                  <div>{{ t('nav.lines') }}</div>
                </div>

                <div
                  v-for="(employee, index) in getTargetEmployees(data)"
                  :key="employeeIdOf(employee) || index"
                  class="ot-expanded-grid-row"
                >
                  <div class="cell-center">
                    {{ index + 1 }}
                  </div>

                  <div class="cell-center cell-mono cell-wrap">
                    {{ employeeCodeOf(employee) }}
                  </div>

                  <div class="cell-center cell-strong cell-wrap">
                    {{ employeeNameOf(employee) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeePositionOf(employee) }}
                  </div>

                  <div class="cell-center cell-mono cell-wrap">
                    {{ employeeOtTimeOf(employee, data) }}
                  </div>

                  <div class="cell-center cell-mono">
                    {{ employeeBreakMinutesOf(employee, data) }}{{ t('ot.common.minShort') }}
                  </div>

                  <div class="cell-center cell-mono">
                    {{ formatMinutesLabel(employeeTotalMinutesOf(employee, data)) }}
                  </div>

                  <div class="cell-center">
                    <Tag
                      :value="employeeTimeModeLabel(employee)"
                      :class="employeeTimeModeTagClass(employee)"
                    />
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeDepartmentOf(employee) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeLineOf(employee, data) || '-' }}
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else
              class="ot-expanded-empty"
            >
              {{ t('ot.requests.noEmployeeData') }}
            </div>
          </div>
        </template>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="ot-request-updating-bar"
      >
        {{ t('common.updating') }}
      </div>
    </section>
  </div>
</template>

<style scoped>
.ot-request-list-page {
  --ot-req-approved-rgb: 34 197 94;
  --ot-req-pending-rgb: 245 158 11;
  --ot-req-rejected-rgb: 239 68 68;
  --ot-req-info-rgb: 59 130 246;
  --ot-req-muted-rgb: 100 116 139;
  --ot-req-holiday-rgb: 239 68 68;
  --ot-req-sunday-rgb: 245 158 11;
  --ot-req-working-rgb: 34 197 94;
}

.ot-request-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.ot-request-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.ot-request-filter-actions > * {
  flex: 0 0 auto;
}

.ot-request-no-text {
  color: rgb(var(--ot-req-info-rgb) / 1);
  font-size: 0.8rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.ot-request-main-text {
  color: var(--ot-text);
  font-size: 0.8rem;
  font-weight: 650;
  line-height: 1.25;
}

.ot-request-sub-text {
  margin-top: 0.12rem;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.ot-request-meta-text {
  color: var(--ot-text);
  font-size: 0.78rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.ot-request-line-text {
  display: inline-flex;
  max-width: 11rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.78rem;
  font-weight: 500;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-request-updating-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid var(--ot-border);
  padding: 0.55rem 0.75rem;
  color: var(--ot-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
}

:deep(.ot-request-action-button .p-button-icon) {
  font-size: 0.76rem;
}

:deep(.ot-request-export-button .p-button-icon) {
  font-size: 0.72rem;
}

/* =========================
   RGB Tags
   ========================= */

:deep(.ot-request-rgb-tag) {
  --ot-request-tag-rgb: var(--ot-req-muted-rgb);
  display: inline-flex !important;
  min-height: 1.42rem;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--ot-request-tag-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--ot-request-tag-rgb) / 0.11);
  color: rgb(var(--ot-request-tag-rgb) / 1);
  padding: 0.12rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  text-align: center !important;
  white-space: nowrap;
}

:deep(.ot-request-tag-approved) {
  --ot-request-tag-rgb: var(--ot-req-approved-rgb);
}

:deep(.ot-request-tag-pending) {
  --ot-request-tag-rgb: var(--ot-req-pending-rgb);
}

:deep(.ot-request-tag-rejected) {
  --ot-request-tag-rgb: var(--ot-req-rejected-rgb);
}

:deep(.ot-request-tag-info) {
  --ot-request-tag-rgb: var(--ot-req-info-rgb);
}

:deep(.ot-request-tag-muted) {
  --ot-request-tag-rgb: var(--ot-req-muted-rgb);
}

:deep(.ot-request-tag-working) {
  --ot-request-tag-rgb: var(--ot-req-working-rgb);
}

:deep(.ot-request-tag-sunday) {
  --ot-request-tag-rgb: var(--ot-req-sunday-rgb);
}

:deep(.ot-request-tag-holiday) {
  --ot-request-tag-rgb: var(--ot-req-holiday-rgb);
}

:deep(.p-tag.approval-display-tag) {
  max-width: 15rem;
}

:deep(.p-tag.approval-display-tag .p-tag-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* =========================
   Main table center
   ========================= */

:deep(.ot-request-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-thead > tr > th),
:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.8rem !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-column-header-content),
:deep(.ot-request-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-column-title),
:deep(.ot-request-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.ot-request-table.p-datatable .p-sortable-column-icon),
:deep(.ot-request-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.ot-request-table.p-datatable .p-tag),
:deep(.ot-request-table.p-datatable .p-button),
:deep(.ot-request-table.p-datatable .p-row-toggler) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.ot-request-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

:deep(.ot-request-table.p-datatable .p-row-toggler) {
  width: 1.72rem !important;
  height: 1.72rem !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-row-expansion > td) {
  height: auto !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: hidden !important;
}

.requester-cell,
.ot-option-cell {
  display: flex;
  min-width: max-content;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.approval-status-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

/* =========================
   Compact expanded dropdown
   ========================= */

.ot-expanded-box {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border-top: 1px solid var(--ot-border);
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, rgb(var(--ot-req-info-rgb) / 0.05), transparent),
    var(--ot-bg);
  padding: 0.55rem 0.7rem;
}

.ot-expanded-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
  margin-bottom: 0.5rem;
}

.ot-expanded-title {
  font-size: 0.8rem;
  font-weight: 650;
  color: var(--ot-text);
}

.ot-expanded-subtitle {
  margin-top: 0.08rem;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 500;
}

.ot-expanded-content {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.ot-expanded-responsive-table {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns:
    2.7rem
    minmax(4.8rem, 0.55fr)
    minmax(8rem, 1.1fr)
    minmax(7rem, 0.85fr)
    minmax(6.8rem, 0.7fr)
    minmax(4.2rem, 0.42fr)
    minmax(4.8rem, 0.48fr)
    minmax(4.8rem, 0.46fr)
    minmax(7rem, 0.8fr)
    minmax(7rem, 0.8fr);
  min-width: 980px;
  align-items: stretch;
}

.ot-expanded-grid-row > div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--ot-border);
  padding: 0.42rem 0.48rem;
  color: var(--ot-text);
  font-size: 0.7rem;
  font-weight: 500;
  line-height: 1.25;
  text-align: center;
}

.ot-expanded-grid-row.is-head > div {
  background: color-mix(in srgb, var(--ot-bg) 82%, transparent);
  color: var(--ot-text-muted);
  font-size: 0.64rem;
  font-weight: 650;
  white-space: nowrap;
}

.ot-expanded-grid-row:last-child > div {
  border-bottom: 0;
}

.ot-expanded-grid-row:not(.is-head):hover > div {
  background: color-mix(in srgb, var(--ot-bg) 68%, transparent);
}

.cell-center {
  justify-content: center !important;
  text-align: center !important;
}

.cell-mono {
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  font-weight: 650 !important;
}

.cell-wrap {
  overflow-wrap: anywhere;
  text-align: center !important;
  white-space: normal;
  word-break: break-word;
}

.ot-expanded-empty {
  border: 1px dashed var(--ot-border);
  border-radius: 0.75rem;
  padding: 0.8rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 500;
  text-align: center;
}

/* =========================
   Responsive
   ========================= */

@media (min-width: 1024px) {
  .ot-request-filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ot-request-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .ot-request-filter-bar {
    grid-template-columns:
      minmax(240px, 1.2fr)
      minmax(180px, 0.85fr)
      minmax(180px, 0.85fr)
      minmax(170px, 0.8fr)
      minmax(170px, 0.8fr);
  }
}

@media (max-width: 1200px) {
  .ot-expanded-grid-row > div {
    padding: 0.4rem 0.46rem;
    font-size: 0.67rem;
  }
}

@media (max-width: 768px) {
  .ot-request-filter-actions {
    justify-content: stretch;
  }

  .ot-request-filter-actions > * {
    flex: 1 1 100%;
  }

  .ot-expanded-header {
    align-items: stretch;
    flex-direction: column;
  }

  .ot-expanded-box {
    width: 100%;
    max-width: 100%;
    padding: 0.55rem;
  }

  .ot-expanded-content {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .ot-expanded-responsive-table {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .ot-expanded-grid-row {
    grid-template-columns:
      2.4rem
      5.8rem
      8.8rem
      8.2rem
      7.4rem
      4.8rem
      5.4rem
      5.4rem
      8.5rem
      9.5rem;
    min-width: 980px;
  }

  .ot-expanded-grid-row > div {
    padding: 0.4rem 0.48rem;
    font-size: 0.67rem;
    line-height: 1.25;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.63rem;
  }
}
</style>