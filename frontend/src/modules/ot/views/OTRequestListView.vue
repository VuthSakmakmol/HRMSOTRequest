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
import DatePicker from 'primevue/datepicker'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

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
  otDateFrom: null,
  otDateTo: null,
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

function normalizePrimeSeverity(value, fallback = 'secondary') {
  const raw = upper(value)

  if (raw === 'SUCCESS') return 'success'
  if (raw === 'DANGER') return 'danger'
  if (raw === 'ERROR') return 'danger'
  if (raw === 'WARNING') return 'warn'
  if (raw === 'WARN') return 'warn'
  if (raw === 'INFO') return 'info'
  if (raw === 'SECONDARY') return 'secondary'
  if (raw === 'CONTRAST') return 'contrast'

  return fallback
}

function approvalLabel(row) {
  return (
    normalizeText(row?.approvalDisplay?.label) ||
    normalizeText(row?.approvalStatusLabel) ||
    normalizeText(row?.statusLabel) ||
    humanize(row?.approvalStatus || row?.status)
  )
}

function approvalSeverity(row) {
  const displaySeverity = normalizeText(row?.approvalDisplay?.severity)

  if (displaySeverity) {
    return normalizePrimeSeverity(displaySeverity, 'secondary')
  }

  const status = upper(row?.approvalStatus || row?.status)

  if (status.includes('APPROVED')) return 'success'
  if (status.includes('REJECTED')) return 'danger'
  if (status.includes('CANCELLED')) return 'secondary'
  if (status.includes('PENDING')) return 'warn'

  return 'secondary'
}

function dayTypeLabel(row) {
  const dayType = upper(row?.dayType)

  if (normalizeText(row?.dayTypeLabel)) return row.dayTypeLabel
  if (dayType === 'WORKING_DAY') return t('ot.dayType.workingDay')
  if (dayType === 'SUNDAY') return t('ot.dayType.sunday')
  if (dayType === 'HOLIDAY') return t('ot.dayType.holiday')

  return humanize(row?.dayType)
}

function dayTypeSeverity(row) {
  const dayType = upper(row?.dayType)

  if (dayType === 'WORKING_DAY') return 'success'
  if (dayType === 'SUNDAY') return 'warn'
  if (dayType === 'HOLIDAY') return 'danger'

  return 'secondary'
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

  const start = normalizeText(item?.startTime || item?.otStartTime || row?.startTime || row?.otStartTime)
  const end = normalizeText(item?.endTime || item?.otEndTime || row?.endTime || row?.otEndTime)

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
  filters.otDateFrom = null
  filters.otDateTo = null
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
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="canExport"
          :label="t('ot.requests.exportExcel')"
          icon="pi pi-file-excel"
          severity="success"
          outlined
          size="small"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('ot.requests.newRequest')"
          icon="pi pi-plus"
          size="small"
          @click="openCreateRequest"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="ot-request-filter-row">
          <IconField class="w-full xl:w-[260px] xl:shrink-0">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              :placeholder="t('common.search')"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[230px] xl:shrink-0">
            <Select
              v-model="filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              :placeholder="t('common.status')"
              class="w-full"
              size="small"
              @change="onFilterChange"
            />
          </div>

          <div class="w-full xl:w-[230px] xl:shrink-0">
            <Select
              v-model="filters.dayType"
              :options="dayTypeOptions"
              optionLabel="label"
              optionValue="value"
              :placeholder="t('ot.requests.dayType')"
              class="w-full"
              size="small"
              @change="onFilterChange"
            />
          </div>

          <div class="w-full xl:w-[200px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateFrom"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              :placeholder="t('ot.requests.otDateFrom')"
              @date-select="onFilterChange"
              @clear-click="onFilterChange"
            />
          </div>

          <div class="w-full xl:w-[200px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateTo"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              :placeholder="t('ot.requests.otDateTo')"
              @date-select="onFilterChange"
              @clear-click="onFilterChange"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2 xl:ml-auto xl:shrink-0">
            <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
              {{ loadedLabel }}
            </div>

            <Button
              :label="t('common.clear')"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />
          </div>
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
        dataKey="id"
        lazy
        removableSort
        scrollable
        scrollHeight="500px"
        :sortField="filters.sortBy"
        :sortOrder="filters.sortOrder"
        tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
        class="ot-request-table"
        :virtualScrollerOptions="useVirtualScroll ? {
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
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            {{ t('ot.requests.noData') }}
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
              :severity="approvalSeverity(data)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column :header="t('ot.requests.staff')">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="staffCountLabel(data)"
              severity="info"
              class="ot-status-tag"
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
              severity="secondary"
              class="ot-status-tag"
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
              :severity="dayTypeSeverity(data)"
              class="ot-status-tag"
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
                  severity="info"
                  class="ot-status-tag"
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
                      severity="success"
                      class="ot-status-tag"
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
    </div>
  </div>
</template>

<style scoped>
.ot-request-filter-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 1280px) {
  .ot-request-filter-row {
    flex-direction: row;
    align-items: center;
  }
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
  padding: 0.62rem 0.72rem !important;
  white-space: nowrap !important;
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.ot-request-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 70px !important;
  padding: 0.5rem 0.72rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  text-align: center !important;
}

:deep(.ot-request-table .p-column-header-content) {
  justify-content: center !important;
}

:deep(.ot-request-table .p-row-toggler) {
  width: 1.75rem !important;
  height: 1.75rem !important;
  margin-inline: auto !important;
}

:deep(.ot-request-table .p-datatable-row-expansion > td) {
  height: auto !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: hidden !important;
}

:deep(.ot-request-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
  white-space: nowrap !important;
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
    linear-gradient(135deg, rgba(59, 130, 246, 0.05), transparent),
    var(--ot-bg);
  padding: 0.75rem;
}

.ot-expanded-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.ot-expanded-title {
  font-size: 0.82rem;
  font-weight: 600;
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
  border-radius: 0.85rem;
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
  padding: 0.46rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text);
  line-height: 1.28;
}

.ot-expanded-grid-row.is-head > div {
  background: color-mix(in srgb, var(--ot-bg) 82%, transparent);
  font-size: 0.66rem;
  font-weight: 600;
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
  font-weight: 600 !important;
}

.cell-wrap {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ot-expanded-empty {
  border-top: 1px solid var(--ot-border);
  padding: 0.85rem;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

@media (max-width: 1200px) {
  .ot-expanded-box {
    width: min(100%, 1120px);
  }

  .ot-expanded-grid-row > div {
    padding: 0.42rem 0.46rem;
    font-size: 0.68rem;
  }
}

@media (max-width: 768px) {
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
    padding: 0.42rem 0.5rem;
    font-size: 0.68rem;
    line-height: 1.25;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.64rem;
  }

  .cell-wrap {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}
</style>