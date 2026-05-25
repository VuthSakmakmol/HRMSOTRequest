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

import { useOTRealtimeRefresh } from '@/modules/ot/otRealtimeRefresh'

import {
  exportOTRequestsExcel,
  getOTRequests,
} from '@/modules/ot/ot.api'

import {
  getApprovalDisplay,
  getApprovalTagClass,
  getEmployeeCount,
  getEmployeeDisplay,
  getEmployeePaidHoursLabel,
  getPaidHoursLabel,
  getRequesterDisplay,
  getTargetEmployees,
  normalizeOTRow,
} from '@/modules/ot/otDisplay'

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

  const normalized = normalizeOTRow(row)

  return {
    ...normalized,
    id: String(
      normalized?.id ||
        normalized?._id ||
        normalized?.requestId ||
        normalized?.otRequestId ||
        normalized?.requestNo ||
        '',
    ).trim(),
  }
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

function displayRequester(row) {
  return getRequesterDisplay(row)
}

function displayApproval(row) {
  return getApprovalDisplay(row)
}

function displayApprovalTagClass(row) {
  return getApprovalTagClass(row, 'ot-request')
}

function displayStaffCount(row) {
  return Number(row?.requestedEmployeeCount || getEmployeeCount(row) || 0)
}

function displayPaidTime(row) {
  return getPaidHoursLabel(row)
}

function displayEmployees(row) {
  return getTargetEmployees(row)
}

function employeeIdOf(employee) {
  return String(employee?.employeeId || employee?._id || employee?.id || '').trim()
}

function employeeCodeOf(employee) {
  return getEmployeeDisplay(employee).code
}

function employeeNameOf(employee) {
  return getEmployeeDisplay(employee).name
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
      employee?.departmentSnapshot?.name ||
      '-',
  ).trim() || '-'
}

function employeePaidTimeOf(employee, row) {
  return getEmployeePaidHoursLabel(employee, row)
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
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

useOTRealtimeRefresh(
  () =>
    reloadFirstPage({
      keepVisible: true,
    }),
  {
    name: 'OTRequestListView',
    debounceMs: 250,
  },
)

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
        :columns="8"
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
        :virtual-scroller-options="
          useVirtualScroll
            ? {
                lazy: true,
                onLazyLoad: onVirtualLazyLoad,
                itemSize: 70,
                delay: 0,
                showLoader: false,
                loading: false,
                numToleratedItems: 12,
              }
            : null
        "
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
                {{ displayRequester(data).name }}
              </div>

              <div class="ot-request-sub-text">
                {{ displayRequester(data).employeeNo }}
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
                :value="displayApproval(data).label"
                :class="displayApprovalTagClass(data)"
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
              :value="t('ot.requests.staffCount', { count: displayStaffCount(data) })"
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
          style="width: 9rem; min-width: 9rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="displayPaidTime(data)"
              :class="['ot-request-rgb-tag', 'ot-request-tag-info']"
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
              v-if="displayEmployees(data).length"
              class="ot-expanded-content"
            >
              <div class="ot-expanded-responsive-table">
                <div class="ot-expanded-grid-row is-head">
                  <div>{{ t('common.no') }}</div>
                  <div>{{ t('ot.requests.employeeId') }}</div>
                  <div>{{ t('common.name') }}</div>
                  <div>{{ t('nav.positions') }}</div>
                  <div>{{ t('ot.requests.otTime') }}</div>
                  <div>{{ t('nav.departments') }}</div>
                </div>

                <div
                  v-for="(employee, index) in displayEmployees(data)"
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

                  <div class="cell-center cell-mono">
                    {{ employeePaidTimeOf(employee, data) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeDepartmentOf(employee) }}
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
    </section>
  </div>
</template>

<style scoped>
.ot-page-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ot-filter-bar {
  display: grid;
  grid-template-columns: minmax(14rem, 1.4fr) minmax(11rem, 0.9fr) minmax(11rem, 0.9fr) minmax(11rem, 0.9fr) auto;
  gap: 0.75rem;
  align-items: end;
  padding: 0.85rem;
  border: 1px solid var(--surface-border);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.05), transparent 34%),
    var(--surface-card);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.ot-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.ot-field-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-color-secondary);
  letter-spacing: 0.01em;
}

.ot-request-filter-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 0.45rem;
  min-width: 18rem;
}

.ot-request-action-button {
  white-space: nowrap;
}

.ot-request-export-button :deep(.p-button-label) {
  white-space: nowrap;
}

.ot-loaded-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2rem;
  padding: 0.34rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.18);
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.ot-table-card {
  border: 1px solid var(--surface-border);
  border-radius: 20px;
  background: var(--surface-card);
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.07);
  overflow: hidden;
}

.ot-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--surface-border);
  background:
    linear-gradient(135deg, rgba(16, 185, 129, 0.06), transparent 30%),
    var(--surface-card);
}

.ot-table-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-color);
}

.ot-table-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.ot-request-table {
  width: 100%;
}

.ot-request-table :deep(.p-datatable-thead > tr > th) {
  padding: 0.68rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 800;
  color: var(--text-color-secondary);
  background: var(--surface-ground);
  border-color: var(--surface-border);
  white-space: nowrap;
}

.ot-request-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.6rem 0.75rem;
  vertical-align: middle;
  border-color: var(--surface-border);
}

.ot-request-table :deep(.p-datatable-tbody > tr) {
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.ot-request-table :deep(.p-datatable-tbody > tr:hover) {
  background: rgba(59, 130, 246, 0.035);
}

.ot-request-no-text {
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    'Liberation Mono',
    'Courier New',
    monospace;
  font-size: 0.82rem;
  font-weight: 800;
  color: #2563eb;
  white-space: nowrap;
}

.requester-cell {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.ot-request-main-text {
  font-size: 0.83rem;
  font-weight: 800;
  color: var(--text-color);
  line-height: 1.25;
}

.ot-request-sub-text {
  font-size: 0.74rem;
  font-weight: 650;
  color: var(--text-color-secondary);
  line-height: 1.2;
}

.ot-request-meta-text {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.approval-status-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ot-request-rgb-tag {
  border: 1px solid transparent;
  box-shadow: none;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.approval-display-tag {
  max-width: 13rem;
}

.approval-display-tag :deep(.p-tag-value) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-request-tag-approved {
  border-color: rgba(34, 197, 94, 0.28) !important;
  background: rgba(34, 197, 94, 0.12) !important;
  color: #15803d !important;
}

.ot-request-tag-rejected {
  border-color: rgba(239, 68, 68, 0.28) !important;
  background: rgba(239, 68, 68, 0.12) !important;
  color: #b91c1c !important;
}

.ot-request-tag-pending {
  border-color: rgba(245, 158, 11, 0.3) !important;
  background: rgba(245, 158, 11, 0.14) !important;
  color: #b45309 !important;
}

.ot-request-tag-info {
  border-color: rgba(59, 130, 246, 0.25) !important;
  background: rgba(59, 130, 246, 0.11) !important;
  color: #1d4ed8 !important;
}

.ot-request-tag-muted {
  border-color: rgba(100, 116, 139, 0.24) !important;
  background: rgba(100, 116, 139, 0.1) !important;
  color: #475569 !important;
}

.ot-expanded-box {
  padding: 0.75rem;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.04), transparent 34%),
    var(--surface-ground);
  border-radius: 14px;
}

.ot-expanded-content {
  overflow-x: auto;
}

.ot-expanded-responsive-table {
  display: flex;
  flex-direction: column;
  min-width: 720px;
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface-card);
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns: 4rem 9rem minmax(12rem, 1.2fr) minmax(10rem, 1fr) 8rem minmax(10rem, 1fr);
  align-items: center;
  min-height: 2.65rem;
  border-bottom: 1px solid var(--surface-border);
}

.ot-expanded-grid-row:last-child {
  border-bottom: 0;
}

.ot-expanded-grid-row > div {
  padding: 0.55rem 0.65rem;
  font-size: 0.78rem;
  border-right: 1px solid var(--surface-border);
}

.ot-expanded-grid-row > div:last-child {
  border-right: 0;
}

.ot-expanded-grid-row.is-head {
  min-height: 2.4rem;
  background: var(--surface-ground);
}

.ot-expanded-grid-row.is-head > div {
  font-size: 0.72rem;
  font-weight: 850;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.cell-center {
  text-align: center;
}

.cell-mono {
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    'Liberation Mono',
    'Courier New',
    monospace;
  font-weight: 800;
}

.cell-strong {
  font-weight: 800;
  color: var(--text-color);
}

.cell-wrap {
  overflow-wrap: anywhere;
}

.ot-expanded-empty {
  padding: 0.9rem;
  border: 1px dashed var(--surface-border);
  border-radius: 14px;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
  text-align: center;
  background: var(--surface-card);
}

.ot-empty-state {
  display: flex;
  min-height: 14rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 2rem;
  color: var(--text-color-secondary);
}

.ot-empty-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  font-size: 1.25rem;
}

.ot-empty-title {
  font-size: 0.95rem;
  font-weight: 850;
  color: var(--text-color);
}

.ot-empty-text {
  font-size: 0.82rem;
  text-align: center;
}

@media (max-width: 1100px) {
  .ot-filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-request-filter-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .ot-filter-bar {
    grid-template-columns: 1fr;
    padding: 0.75rem;
  }

  .ot-request-filter-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-request-action-button,
  .ot-loaded-badge {
    width: 100%;
    justify-content: center;
  }

  .ot-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ot-table-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .ot-expanded-box {
    padding: 0.5rem;
  }
}
</style>