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
import { formatDate, formatDateTime, toApiDate } from '@/shared/utils/dateFormat'
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

function normalizeText(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return normalizeText(value).toUpperCase()
}

function humanize(value) {
  const raw = normalizeText(value)

  if (!raw) return '-'

  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numberOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function minuteLabel(value) {
  const minutes = numberOrNull(value)

  if (minutes === null) return '-'
  if (minutes <= 0) return '0 min'

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours && rest) return `${hours}h ${rest}m`
  if (hours) return `${hours}h`

  return `${rest} min`
}

function dateFilterValue(value) {
  return toApiDate(value, '')
}

function safeDate(value) {
  return value ? formatDate(value) : '-'
}

function safeDateTime(value) {
  return value ? formatDateTime(value) : '-'
}

function approvalLabel(row) {
  return (
    normalizeText(row?.approvalDisplay?.label) ||
    normalizeText(row?.approvalStatusLabel) ||
    normalizeText(row?.statusLabel) ||
    humanize(row?.approvalStatus || row?.status)
  )
}

function approvalTagClass(row) {
  const displaySeverity = upper(row?.approvalDisplay?.severity)
  const status = upper(row?.approvalStatus || row?.status)

  if (displaySeverity === 'SUCCESS' || status.includes('APPROVED')) {
    return ['ot-request-rgb-tag', 'ot-request-tag-approved']
  }

  if (
    displaySeverity === 'DANGER' ||
    displaySeverity === 'ERROR' ||
    status.includes('REJECTED')
  ) {
    return ['ot-request-rgb-tag', 'ot-request-tag-rejected']
  }

  if (status.includes('CANCELLED')) {
    return ['ot-request-rgb-tag', 'ot-request-tag-muted']
  }

  if (
    displaySeverity === 'WARNING' ||
    displaySeverity === 'WARN' ||
    status.includes('PENDING')
  ) {
    return ['ot-request-rgb-tag', 'ot-request-tag-pending']
  }

  if (displaySeverity === 'INFO') {
    return ['ot-request-rgb-tag', 'ot-request-tag-info']
  }

  return ['ot-request-rgb-tag', 'ot-request-tag-muted']
}

function dayTypeLabel(row) {
  const dayType = upper(row?.dayType)

  if (normalizeText(row?.dayTypeLabel)) return row.dayTypeLabel
  if (dayType === 'WORKING_DAY') return t('ot.dayType.workingDay')
  if (dayType === 'SUNDAY') return t('ot.dayType.sunday')
  if (dayType === 'HOLIDAY') return t('ot.dayType.holiday')

  return humanize(row?.dayType)
}

function dayTypeTagClass(row) {
  const dayType = upper(row?.dayType)

  if (dayType === 'WORKING_DAY') return ['ot-request-rgb-tag', 'ot-request-tag-working']
  if (dayType === 'SUNDAY') return ['ot-request-rgb-tag', 'ot-request-tag-sunday']
  if (dayType === 'HOLIDAY') return ['ot-request-rgb-tag', 'ot-request-tag-holiday']

  return ['ot-request-rgb-tag', 'ot-request-tag-muted']
}

function timingTagClass() {
  return ['ot-request-rgb-tag', 'ot-request-tag-muted']
}

function staffTagClass() {
  return ['ot-request-rgb-tag', 'ot-request-tag-info']
}

function detailModeTagClass() {
  return ['ot-request-rgb-tag', 'ot-request-tag-approved']
}

function requestNo(row) {
  return normalizeText(row?.requestNo || row?.otRequestNo || row?.code) || '-'
}

function requesterName(row) {
  return (
    normalizeText(row?.requesterName) ||
    normalizeText(row?.requesterDisplayName) ||
    normalizeText(row?.requesterEmployeeName) ||
    normalizeText(row?.createdByName) ||
    normalizeText(row?.employeeName) ||
    '-'
  )
}

function requesterCode(row) {
  return (
    normalizeText(row?.requesterCode) ||
    normalizeText(row?.requesterEmployeeCode) ||
    normalizeText(row?.requesterEmployeeNo) ||
    normalizeText(row?.employeeCode) ||
    normalizeText(row?.employeeNo) ||
    ''
  )
}

function staffCount(row) {
  const direct = numberOrNull(row?.staffCount ?? row?.employeeCount ?? row?.totalEmployees)

  if (direct !== null) return direct

  return detailRows(row).length
}

function staffCountLabel(row) {
  return t('ot.requests.staffCount', {
    count: staffCount(row),
  })
}

function otDateLabel(row) {
  return normalizeText(row?.otDateText) || safeDate(row?.otDate || row?.date)
}

function otTimeLabel(row) {
  const preset =
    normalizeText(row?.otTime) ||
    normalizeText(row?.timeText) ||
    normalizeText(row?.otTimeText)

  if (preset) return preset

  const start = normalizeText(row?.startTime || row?.otStartTime)
  const end = normalizeText(row?.endTime || row?.otEndTime)

  return start && end ? `${start} - ${end}` : '-'
}

function timingLabel(row) {
  return (
    normalizeText(row?.timingLabel) ||
    normalizeText(row?.shiftOTOptionName) ||
    normalizeText(row?.otOptionName) ||
    normalizeText(row?.optionName) ||
    humanize(row?.timingMode || row?.optionMode)
  )
}

function detailRows(row) {
  const source =
    row?.staffRows ||
    row?.employeeDetails ||
    row?.requestEmployees ||
    row?.employees ||
    row?.staff ||
    row?.details ||
    []

  return Array.isArray(source) ? source : []
}

function detailEmployeeCode(item) {
  const employee = item?.employee || item?.employeeSnapshot || {}

  return (
    normalizeText(item?.employeeCode) ||
    normalizeText(item?.employeeNo) ||
    normalizeText(item?.code) ||
    normalizeText(employee?.employeeCode) ||
    normalizeText(employee?.employeeNo) ||
    '-'
  )
}

function detailEmployeeName(item) {
  const employee = item?.employee || item?.employeeSnapshot || {}

  return (
    normalizeText(item?.employeeName) ||
    normalizeText(item?.displayName) ||
    normalizeText(item?.name) ||
    normalizeText(employee?.displayName) ||
    normalizeText(employee?.employeeName) ||
    '-'
  )
}

function detailPositionLabel(item) {
  const position = item?.position || item?.positionSnapshot || {}

  return (
    normalizeText(item?.positionName) ||
    normalizeText(item?.position) ||
    normalizeText(item?.positions) ||
    normalizeText(position?.name) ||
    normalizeText(position?.positionName) ||
    '-'
  )
}

function detailOtTimeLabel(item, row) {
  const preset =
    normalizeText(item?.otTime) ||
    normalizeText(item?.otTimeText) ||
    normalizeText(item?.timeText)

  if (preset) return preset

  const start = normalizeText(
    item?.startTime ||
      item?.otStartTime ||
      row?.startTime ||
      row?.otStartTime,
  )

  const end = normalizeText(
    item?.endTime ||
      item?.otEndTime ||
      row?.endTime ||
      row?.otEndTime,
  )

  return start && end ? `${start} - ${end}` : '-'
}

function detailBreakLabel(item, row) {
  const value =
    item?.breakMinutes ??
    item?.breakTimeMinutes ??
    item?.deductedBreakMinutes ??
    row?.breakMinutes

  return minuteLabel(value)
}

function detailTotalLabel(item) {
  const value =
    item?.totalPaidMinutes ??
    item?.paidMinutes ??
    item?.approvedMinutes ??
    item?.totalMinutes ??
    item?.requestMinutes ??
    item?.requestedMinutes

  return minuteLabel(value)
}

function detailModeLabel(item) {
  return (
    normalizeText(item?.modeLabel) ||
    normalizeText(item?.timingModeLabel) ||
    normalizeText(item?.calculationModeLabel) ||
    humanize(item?.mode || item?.timingMode || item?.calculationMode || 'DEFAULT')
  )
}

function detailLineLabel(item) {
  const line = item?.line || item?.lineSnapshot || {}

  return (
    normalizeText(item?.lineName) ||
    normalizeText(line?.name) ||
    normalizeText(line?.lineName) ||
    normalizeText(item?.lineCode) ||
    normalizeText(line?.code) ||
    '-'
  )
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: normalizeText(filters.search),
    status: filters.status,
    dayType: filters.dayType,
    otDateFrom: dateFilterValue(filters.otDateFrom),
    otDateTo: dateFilterValue(filters.otDateTo),
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
    const res = await exportOTRequestsExcel({
      search: normalizeText(filters.search),
      status: filters.status,
      dayType: filters.dayType,
      otDateFrom: dateFilterValue(filters.otDateFrom),
      otDateTo: dateFilterValue(filters.otDateTo),
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        :columns="10"
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

        <Column expander />

        <Column
          field="requestNo"
          :header="t('ot.requests.requestNo')"
          sortable
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="font-medium"
            >
              {{ requestNo(data) }}
            </span>
          </template>
        </Column>

        <Column :header="t('ot.requests.requester')">
          <template #body="{ data }">
            <div
              v-if="data"
              class="requester-cell"
            >
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ requesterName(data) }}
              </div>

              <div
                v-if="requesterCode(data)"
                class="text-xs text-[color:var(--ot-text-muted)]"
              >
                {{ requesterCode(data) }}
              </div>
            </div>
          </template>
        </Column>

        <Column :header="t('ot.requests.approvalStatus')">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="approvalLabel(data)"
              :class="approvalTagClass(data)"
            />
          </template>
        </Column>

        <Column :header="t('ot.requests.staff')">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="staffCountLabel(data)"
              :class="staffTagClass()"
            />
          </template>
        </Column>

        <Column
          field="otDate"
          :header="t('ot.requests.otDate')"
          sortable
        >
          <template #body="{ data }">
            <span v-if="data">{{ otDateLabel(data) }}</span>
          </template>
        </Column>

        <Column :header="t('ot.requests.otTime')">
          <template #body="{ data }">
            <span v-if="data">{{ otTimeLabel(data) }}</span>
          </template>
        </Column>

        <Column :header="t('ot.requests.timing')">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="timingLabel(data)"
              :class="timingTagClass()"
            />
          </template>
        </Column>

        <Column
          field="dayType"
          :header="t('ot.requests.dayType')"
          sortable
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="dayTypeLabel(data)"
              :class="dayTypeTagClass(data)"
            />
          </template>
        </Column>

        <Column
          field="createdAt"
          :header="t('common.createdAt')"
          sortable
        >
          <template #body="{ data }">
            <span v-if="data">{{ safeDateTime(data.createdAt) }}</span>
          </template>
        </Column>

        <template #expansion="{ data }">
          <div class="ot-expanded-box">
            <div class="ot-expanded-content">
              <div class="ot-expanded-header">
                <div>
                  <div class="ot-expanded-title">
                    {{ t('ot.requests.employees') }}
                  </div>

                  <div class="ot-expanded-subtitle">
                    {{ t('ot.requests.otTime') }}: {{ otTimeLabel(data) }}
                    · {{ t('ot.requests.timing') }}: {{ timingLabel(data) }}
                  </div>
                </div>

                <Tag
                  :value="staffCountLabel(data)"
                  :class="staffTagClass()"
                />
              </div>

              <div class="ot-expanded-responsive-table">
                <div class="ot-expanded-grid-row is-head">
                  <div>{{ t('common.no') }}</div>
                  <div>{{ t('org.employee.employeeCode') }}</div>
                  <div>{{ t('org.employee.displayName') }}</div>
                  <div>{{ t('nav.positions') }}</div>
                  <div>{{ t('ot.requests.otTime') }}</div>
                  <div>{{ t('ot.requests.break') }}</div>
                  <div>{{ t('ot.requests.total') }}</div>
                  <div>{{ t('ot.requests.mode') }}</div>
                  <div>{{ t('nav.lines') }}</div>
                </div>

                <div
                  v-for="(item, index) in detailRows(data)"
                  :key="item.id || item._id || item.employeeId || item.employeeCode || index"
                  class="ot-expanded-grid-row"
                >
                  <div class="cell-center">{{ index + 1 }}</div>
                  <div class="cell-center cell-mono cell-wrap">{{ detailEmployeeCode(item) }}</div>
                  <div class="cell-center cell-strong cell-wrap">{{ detailEmployeeName(item) }}</div>
                  <div class="cell-center cell-wrap">{{ detailPositionLabel(item) }}</div>
                  <div class="cell-center cell-mono cell-wrap">{{ detailOtTimeLabel(item, data) }}</div>
                  <div class="cell-center cell-mono">{{ detailBreakLabel(item, data) }}</div>
                  <div class="cell-center cell-mono">{{ detailTotalLabel(item) }}</div>
                  <div class="cell-center">
                    <Tag
                      :value="detailModeLabel(item)"
                      :class="detailModeTagClass()"
                    />
                  </div>
                  <div class="cell-center cell-wrap">{{ detailLineLabel(item) }}</div>
                </div>

                <div
                  v-if="!detailRows(data).length"
                  class="ot-expanded-empty"
                >
                  {{ t('ot.requests.noEmployeeData') }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
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

:deep(.ot-request-rgb-tag) {
  --ot-request-tag-rgb: var(--ot-req-muted-rgb);
  min-height: 1.42rem;
  border: 1px solid rgb(var(--ot-request-tag-rgb) / 0.28);
  background: rgb(var(--ot-request-tag-rgb) / 0.11);
  color: rgb(var(--ot-request-tag-rgb) / 1);
  padding: 0.12rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  border-radius: 999px;
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

:deep(.ot-request-action-button .p-button-icon) {
  font-size: 0.76rem;
}

:deep(.ot-request-export-button .p-button-icon) {
  font-size: 0.72rem;
}

/* Same base table behavior as ApprovalInbox */
:deep(.ot-request-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-request-table .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  text-align: center !important;
  vertical-align: middle !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.ot-request-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  text-align: center !important;
  font-size: 0.8rem !important;
}

:deep(.ot-request-table .p-column-header-content) {
  justify-content: center !important;
}

:deep(.ot-request-table .p-row-toggler) {
  width: 1.72rem !important;
  height: 1.72rem !important;
  margin-inline: auto !important;
}

:deep(.ot-request-table .p-datatable-row-expansion > td) {
  height: auto !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: hidden !important;
}

.requester-cell {
  min-width: max-content;
  text-align: center;
}

/* Expanded area same style direction as ApprovalInbox */
.ot-expanded-box {
  position: sticky;
  left: 0;
  width: min(100%, 1120px);
  max-width: none;
  overflow: visible;
  border-top: 1px solid var(--ot-border);
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, rgb(var(--ot-req-info-rgb) / 0.05), transparent),
    var(--ot-bg);
  padding: 0.7rem;
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
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-expanded-content {
  width: 100%;
  max-width: none;
  overflow: visible;
}

.ot-expanded-responsive-table {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns:
    2.7rem
    minmax(5rem, 0.6fr)
    minmax(8rem, 1.1fr)
    minmax(7rem, 0.85fr)
    minmax(7rem, 0.75fr)
    minmax(4.5rem, 0.45fr)
    minmax(5rem, 0.5fr)
    minmax(5rem, 0.5fr)
    minmax(8rem, 0.85fr);
  align-items: stretch;
}

.ot-expanded-grid-row > div {
  min-width: 0;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--ot-border);
  padding: 0.42rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ot-text);
  line-height: 1.25;
}

.ot-expanded-grid-row.is-head > div {
  background: color-mix(in srgb, var(--ot-bg) 82%, transparent);
  font-size: 0.64rem;
  font-weight: 650;
  color: var(--ot-text-muted);
  white-space: nowrap;
}

.ot-expanded-grid-row:last-child > div {
  border-bottom: 0;
}

.ot-expanded-grid-row:not(.is-head):hover > div {
  background: color-mix(in srgb, var(--ot-bg) 68%, transparent);
}

.cell-center {
  justify-content: center;
  text-align: center;
}

.cell-mono {
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  font-weight: 650 !important;
}

.cell-wrap {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ot-expanded-empty {
  border-top: 1px solid var(--ot-border);
  padding: 0.8rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

@media (max-width: 768px) {
  .ot-request-filter-actions {
    justify-content: stretch;
  }

  .ot-request-filter-actions > * {
    flex: 1 1 100%;
  }

  .ot-expanded-header {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-expanded-box {
    width: max-content;
    min-width: 1080px;
    max-width: none;
    padding: 0.6rem;
  }

  .ot-expanded-content {
    width: max-content;
    min-width: 1080px;
    max-width: none;
    overflow: visible;
  }

  .ot-expanded-responsive-table {
    width: max-content;
    min-width: 1080px;
    max-width: none;
    overflow: visible;
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
      9.5rem;
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
      minmax(260px, 1.25fr)
      minmax(190px, 0.85fr)
      minmax(190px, 0.85fr)
      minmax(180px, 0.8fr)
      minmax(180px, 0.8fr);
  }
}

/* =========================================================
   Force OT Request List table content center
   ========================================================= */

:deep(.ot-request-table .p-datatable-thead > tr > th),
:deep(.ot-request-table .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.ot-request-table .p-column-header-content) {
  justify-content: center !important;
  text-align: center !important;
}

:deep(.ot-request-table .p-datatable-tbody > tr > td > *) {
  margin-left: auto !important;
  margin-right: auto !important;
}

:deep(.ot-request-table .p-tag),
:deep(.ot-request-table .p-button),
:deep(.ot-request-table .p-row-toggler) {
  margin-left: auto !important;
  margin-right: auto !important;
}

.requester-cell {
  display: flex;
  min-width: max-content;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* Expanded employee table center */
.ot-expanded-grid-row > div {
  justify-content: center !important;
  text-align: center !important;
}

.ot-expanded-grid-row.is-head > div {
  justify-content: center !important;
  text-align: center !important;
}

.cell-center,
.cell-wrap,
.cell-mono,
.cell-strong {
  justify-content: center !important;
  text-align: center !important;
}
</style>