<!-- frontend/src/modules/ot/views/OTAcknowledgeInboxView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTAcknowledgeInboxView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
import { getOTAcknowledgementInbox } from '@/modules/ot/ot.api'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'

const { t, te } = useI18n()
const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())
const expandedRows = ref({})

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const filters = reactive({
  search: '',
  status: '',
  dayType: '',
  otDateFrom: '',
  otDateTo: '',
})

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

const totalRequests = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)

const summaryText = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalRequests.value,
  }),
)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRequests.value > PAGE_SIZE)

const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})

let searchTimer = null
let currentRequestId = 0

function label(key, fallback) {
  return te(key) ? t(key) : fallback
}

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

function pad2(value) {
  return String(value).padStart(2, '0')
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

function errorMessage(error, fallback = '') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.messageKey ||
    error?.response?.data?.error ||
    error?.message ||
    fallback ||
    t('common.somethingWentWrong')
  )
}

function translateBackendKey(key, fallback = '-') {
  const value = String(key || '').trim()
  if (!value) return fallback

  return te(value) ? t(value) : fallback
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

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
  }
}

function normalizeDisplayStatus(value) {
  const status = upper(value)

  if (status === 'PENDING_REQUESTER_CONFIRMATION') return 'PENDING'
  if (status === 'REQUESTER_DISAGREED') return 'REJECTED'

  return status
}

function statusLabel(value, key = '') {
  if (key) return translateBackendKey(key, value || '-')

  const status = normalizeDisplayStatus(value)

  if (status === 'PENDING') return t('ot.status.pending')
  if (status === 'APPROVED') return t('ot.status.approved')
  if (status === 'REJECTED') return t('ot.status.rejected')
  if (status === 'CANCELLED') return t('ot.status.cancelled')

  return status || t('common.unknown')
}

function statusTagClass(value) {
  const status = normalizeDisplayStatus(value)

  if (status === 'APPROVED') return ['ot-ack-rgb-tag', 'ot-ack-tag-approved']
  if (status === 'REJECTED') return ['ot-ack-rgb-tag', 'ot-ack-tag-rejected']
  if (status === 'CANCELLED') return ['ot-ack-rgb-tag', 'ot-ack-tag-muted']
  if (status === 'PENDING') return ['ot-ack-rgb-tag', 'ot-ack-tag-pending']

  return ['ot-ack-rgb-tag', 'ot-ack-tag-muted']
}

function dayTypeLabel(value, key = '') {
  if (key) return translateBackendKey(key, value || '-')

  const dayType = upper(value)

  if (dayType === 'HOLIDAY') return t('ot.dayType.holiday')
  if (dayType === 'SUNDAY') return t('ot.dayType.sunday')
  if (dayType === 'WORKING_DAY') return t('ot.dayType.workingDay')

  return dayType || t('common.unknown')
}

function dayTypeTagClass(value) {
  const dayType = upper(value)

  if (dayType === 'HOLIDAY') return ['ot-ack-rgb-tag', 'ot-ack-tag-holiday']
  if (dayType === 'SUNDAY') return ['ot-ack-rgb-tag', 'ot-ack-tag-sunday']
  if (dayType === 'WORKING_DAY') return ['ot-ack-rgb-tag', 'ot-ack-tag-working']

  return ['ot-ack-rgb-tag', 'ot-ack-tag-muted']
}

function acknowledgementLabel(row) {
  if (row?.acknowledgementKey) {
    return translateBackendKey(row.acknowledgementKey, row?.acknowledgementLabel || 'FYI')
  }

  return row?.acknowledgementLabel || t('ot.acknowledge.fyi')
}

function acknowledgementTagClass(row) {
  const severity = upper(row?.acknowledgementSeverity)

  if (severity === 'SUCCESS') return ['ot-ack-rgb-tag', 'ot-ack-tag-approved']
  if (severity === 'WARNING' || severity === 'WARN') return ['ot-ack-rgb-tag', 'ot-ack-tag-pending']
  if (severity === 'DANGER' || severity === 'ERROR') return ['ot-ack-rgb-tag', 'ot-ack-tag-rejected']

  return ['ot-ack-rgb-tag', 'ot-ack-tag-info']
}

function staffTagClass() {
  return ['ot-ack-rgb-tag', 'ot-ack-tag-info']
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

  if (source === 'CUSTOM_FIXED') return ['ot-ack-rgb-tag', 'ot-ack-tag-info']

  return ['ot-ack-rgb-tag', 'ot-ack-tag-muted']
}

function formatTimeRange(row) {
  const start = String(row?.requestStartTime || row?.startTime || '').trim()
  const end = String(row?.requestEndTime || row?.endTime || '').trim()

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

  return firstText(
    employee?.lineNo,
    employee?.lineNumber,
    employee?.productionLineNo,
    employee?.productionLineNumber,
    employee?.line,
    employee?.productionLine,
  )
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
    ? ['ot-ack-rgb-tag', 'ot-ack-tag-pending']
    : ['ot-ack-rgb-tag', 'ot-ack-tag-approved']
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTAcknowledgementInbox(buildQuery(page))
    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload).map(normalizeRow)
    const total = Number(
      payload?.pagination?.total ||
        payload?.pagination?.totalRecords ||
        payload?.total ||
        payload?.totalRecords ||
        0,
    )

    totalRecords.value = total

    if (replace) {
      const nextRows = Array.from({ length: total }, () => null)
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const nextRows = [...rows.value]
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
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
      detail: errorMessage(error, t('ot.acknowledge.loadFailed')),
      life: 3000,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true, resetExpanded = false } = {}) {
  if (resetExpanded) {
    expandedRows.value = {}
  }

  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
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
    reloadFirstPage({ keepVisible: true, resetExpanded: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true, resetExpanded: true })
}

function onDayTypeChange() {
  reloadFirstPage({ keepVisible: true, resetExpanded: true })
}

function onDateChange() {
  reloadFirstPage({ keepVisible: true, resetExpanded: true })
}

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
  filters.otDateFrom = ''
  filters.otDateTo = ''

  reloadFirstPage({ keepVisible: true, resetExpanded: true })
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

onMounted(() => {
  reloadFirstPage({ keepVisible: false, resetExpanded: true })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell ot-ack-page">
    <section class="ot-filter-bar ot-ack-filter-bar">
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
          @change="onStatusChange"
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
          @change="onDayTypeChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateFrom"
          :label="t('ot.requests.otDateFrom')"
          :placeholder="t('ot.requests.otDateFrom')"
          @change="onDateChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateTo"
          :label="t('ot.requests.otDateTo')"
          :placeholder="t('ot.requests.otDateTo')"
          @change="onDateChange"
        />
      </div>

      <div class="ot-ack-filter-actions">
        <span class="ot-loaded-badge">
          {{ summaryText }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="ot-ack-action-button"
          @click="clearFilters"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ label('ot.acknowledge.inbox', 'OT Acknowledge Inbox') }}
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
        :title="t('ot.acknowledge.loading')"
        :message="t('ot.acknowledge.fetchingRecords')"
        :rows="8"
        :columns="14"
      />

      <DataTable
        v-else
        v-model:expandedRows="expandedRows"
        :value="rows"
        data-key="id"
        lazy
        scrollable
        scroll-height="500px"
        table-style="width: max-content; min-width: 100%; table-layout: auto;"
        class="ot-ack-table ot-data-table ot-data-table-compact"
        :virtual-scroller-options="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 70,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="ot-empty-state"
          >
            <div class="ot-empty-icon">
              <i class="pi pi-bell" />
            </div>

            <div class="ot-empty-title">
              {{ t('common.noData') }}
            </div>

            <div class="ot-empty-text">
              {{ t('ot.acknowledge.noData') }}
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
          style="width: 10rem; min-width: 10rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-ack-request-no-text"
            >
              {{ data.requestNo || '-' }}
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
              <div class="ot-ack-main-text">
                {{ formatRequester(data).name }}
              </div>

              <div class="ot-ack-sub-text">
                {{ formatRequester(data).employeeNo }}
              </div>
            </div>
          </template>
        </Column>

        <Column
          :header="t('ot.acknowledge.acknowledgement')"
          style="width: 11rem; min-width: 11rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="acknowledgementLabel(data)"
              :class="acknowledgementTagClass(data)"
            />
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
              :class="staffTagClass()"
            />
          </template>
        </Column>

        <Column
          field="status"
          :header="t('ot.acknowledge.requestStatus')"
          style="width: 10rem; min-width: 10rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="statusLabel(data.status, data.statusKey)"
              :class="statusTagClass(data.status)"
            />
          </template>
        </Column>

        <Column
          field="otDate"
          :header="t('ot.requests.otDate')"
          style="width: 9rem; min-width: 9rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-ack-meta-text"
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
              class="ot-ack-meta-text"
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
              <div class="ot-ack-main-text">
                {{ formatOtOptionLabel(data) }}
              </div>

              <div class="ot-ack-sub-text">
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
              class="ot-ack-meta-text"
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
              :class="['ot-ack-rgb-tag', 'ot-ack-tag-approved']"
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
              class="ot-ack-line-text"
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
          style="width: 12rem; min-width: 12rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-ack-meta-text"
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
        class="ot-ack-updating-bar"
      >
        {{ t('common.updating') }}
      </div>
    </section>
  </div>
</template>

<style scoped>
.ot-ack-page {
  --ot-ack-approved-rgb: 34 197 94;
  --ot-ack-pending-rgb: 245 158 11;
  --ot-ack-rejected-rgb: 239 68 68;
  --ot-ack-info-rgb: 59 130 246;
  --ot-ack-muted-rgb: 100 116 139;
  --ot-ack-holiday-rgb: 239 68 68;
  --ot-ack-sunday-rgb: 245 158 11;
  --ot-ack-working-rgb: 34 197 94;
}

.ot-ack-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.ot-ack-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.ot-ack-filter-actions > * {
  flex: 0 0 auto;
}

.ot-ack-request-no-text {
  color: rgb(var(--ot-ack-info-rgb) / 1);
  font-size: 0.8rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.ot-ack-main-text {
  color: var(--ot-text);
  font-size: 0.8rem;
  font-weight: 650;
  line-height: 1.25;
}

.ot-ack-sub-text {
  margin-top: 0.12rem;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.ot-ack-meta-text {
  color: var(--ot-text);
  font-size: 0.78rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.ot-ack-line-text {
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

.ot-ack-updating-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid var(--ot-border);
  padding: 0.55rem 0.75rem;
  color: var(--ot-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
}

:deep(.ot-ack-action-button .p-button-icon) {
  font-size: 0.76rem;
}

/* =========================
   RGB Tags
   ========================= */

:deep(.ot-ack-rgb-tag) {
  --ot-ack-tag-rgb: var(--ot-ack-muted-rgb);
  display: inline-flex !important;
  min-height: 1.42rem;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--ot-ack-tag-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--ot-ack-tag-rgb) / 0.11);
  color: rgb(var(--ot-ack-tag-rgb) / 1);
  padding: 0.12rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  text-align: center !important;
  white-space: nowrap;
}

:deep(.ot-ack-tag-approved) {
  --ot-ack-tag-rgb: var(--ot-ack-approved-rgb);
}

:deep(.ot-ack-tag-pending) {
  --ot-ack-tag-rgb: var(--ot-ack-pending-rgb);
}

:deep(.ot-ack-tag-rejected) {
  --ot-ack-tag-rgb: var(--ot-ack-rejected-rgb);
}

:deep(.ot-ack-tag-info) {
  --ot-ack-tag-rgb: var(--ot-ack-info-rgb);
}

:deep(.ot-ack-tag-muted) {
  --ot-ack-tag-rgb: var(--ot-ack-muted-rgb);
}

:deep(.ot-ack-tag-working) {
  --ot-ack-tag-rgb: var(--ot-ack-working-rgb);
}

:deep(.ot-ack-tag-sunday) {
  --ot-ack-tag-rgb: var(--ot-ack-sunday-rgb);
}

:deep(.ot-ack-tag-holiday) {
  --ot-ack-tag-rgb: var(--ot-ack-holiday-rgb);
}

/* =========================
   Main table center
   ========================= */

:deep(.ot-ack-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-thead > tr > th),
:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.8rem !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-column-header-content),
:deep(.ot-ack-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-column-title),
:deep(.ot-ack-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.ot-ack-table.p-datatable .p-tag),
:deep(.ot-ack-table.p-datatable .p-button),
:deep(.ot-ack-table.p-datatable .p-row-toggler) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.ot-ack-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

:deep(.ot-ack-table.p-datatable .p-row-toggler) {
  width: 1.72rem !important;
  height: 1.72rem !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-row-expansion > td) {
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
    linear-gradient(135deg, rgb(var(--ot-ack-info-rgb) / 0.05), transparent),
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
  .ot-ack-filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ot-ack-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .ot-ack-filter-bar {
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
  .ot-ack-filter-actions {
    justify-content: stretch;
  }

  .ot-ack-filter-actions > * {
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