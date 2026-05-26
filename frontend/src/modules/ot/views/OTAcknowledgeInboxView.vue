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
import AppTableLoading from '@/shared/components/AppTableLoading.vue'

import { getApiErrorMessage } from '@/shared/utils/apiError'
import { getOTAcknowledgementInbox } from '@/modules/ot/ot.api'
import { useOTRealtimeRefresh } from '@/modules/ot/otRealtimeRefresh'

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

const { t, te } = useI18n()
const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const SCROLL_LOAD_DISTANCE = 180
const FILTER_STACK_WIDTH = 1280

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())
const loadingPages = ref(new Set())
const expandedRows = ref({})

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const loadingMore = ref(false)

const tableScrollShell = ref(null)
const filterBarRef = ref(null)
const filterActionsStacked = ref(false)

const filters = reactive({
  search: '',
  status: '',
  otDateFrom: '',
  otDateTo: '',
  sortBy: 'createdAt',
  sortOrder: -1,
})

let searchTimer = null
let queryVersion = 0
let filterResizeObserver = null

const statusOptions = computed(() => [
  { label: tr('common.allStatus', 'All Status'), value: '' },
  { label: tr('ot.status.pending', 'Pending Approval'), value: 'PENDING' },
  {
    label: tr('ot.status.pendingRequesterConfirmation', 'Waiting Requester Confirmation'),
    value: 'PENDING_REQUESTER_CONFIRMATION',
  },
  { label: tr('ot.status.approved', 'Approved'), value: 'APPROVED' },
  { label: tr('ot.status.rejected', 'Rejected'), value: 'REJECTED' },
  { label: tr('ot.status.requesterDisagreed', 'Requester Disagreed'), value: 'REQUESTER_DISAGREED' },
  { label: tr('ot.status.cancelled', 'Cancelled'), value: 'CANCELLED' },
])

const totalRequests = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.length)
const hasAnyData = computed(() => rows.value.length > 0)
const hasMorePages = computed(() => loadedCount.value < totalRequests.value)

const summaryText = computed(() =>
  tr('common.loaded', 'Loaded {loaded} of {total}', {
    loaded: loadedCount.value,
    total: totalRequests.value,
  }),
)

const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})

function tr(key, fallback, params) {
  if (typeof te === 'function' && !te(key)) return fallback

  const value = t(key, params || {})

  if (!value || value === key) return fallback

  return value
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
  return getApprovalTagClass(row, 'ot-ack')
}

function displayStaffCount(row) {
  return Number(row?.effectiveEmployeeCount || row?.requestedEmployeeCount || getEmployeeCount(row) || 0)
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

function employeeLineOf(employee) {
  const line =
    employee?.line ||
    employee?.productionLine ||
    employee?.lineSnapshot ||
    employee?.productionLineSnapshot ||
    employee?.lineId ||
    employee?.productionLineId ||
    {}

  const code = String(
    employee?.lineCode ||
      employee?.productionLineCode ||
      line?.code ||
      line?.lineCode ||
      line?.productionLineCode ||
      '',
  ).trim()

  const name = String(
    employee?.lineName ||
      employee?.productionLineName ||
      line?.name ||
      line?.lineName ||
      line?.productionLineName ||
      '',
  ).trim()

  if (code && name && code !== name) return `${code} · ${name}`

  return code || name || '-'
}

function employeePaidTimeOf(employee, row) {
  return getEmployeePaidHoursLabel(employee, row)
}

function acknowledgementLabel(row) {
  const key = String(row?.acknowledgementKey || '').trim()
  const label = String(row?.acknowledgementLabel || '').trim()

  if (key && typeof te === 'function' && te(key)) {
    return t(key)
  }

  return label || tr('ot.acknowledge.fyi', 'FYI')
}

function acknowledgementTagClass(row) {
  const severity = String(row?.acknowledgementSeverity || '').trim().toUpperCase()

  if (severity === 'SUCCESS') return ['ot-ack-rgb-tag', 'ot-ack-tag-approved']
  if (severity === 'WARNING' || severity === 'WARN') return ['ot-ack-rgb-tag', 'ot-ack-tag-pending']
  if (severity === 'DANGER' || severity === 'ERROR') return ['ot-ack-rgb-tag', 'ot-ack-tag-rejected']

  return ['ot-ack-rgb-tag', 'ot-ack-tag-info']
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

function setLoadingPage(page, value) {
  const next = new Set(loadingPages.value)

  if (value) {
    next.add(page)
  } else {
    next.delete(page)
  }

  loadingPages.value = next
}

function mergeRows(existingRows, incomingRows) {
  const existingIds = new Set(
    existingRows.map((row) => String(row?.id || '').trim()).filter(Boolean),
  )

  const nextRows = [...existingRows]

  for (const item of incomingRows) {
    const id = String(item?.id || '').trim()

    if (id && existingIds.has(id)) continue

    nextRows.push(item)

    if (id) existingIds.add(id)
  }

  return nextRows
}

async function fetchPage(page, { replace = false, silent = false, version = queryVersion } = {}) {
  if (!replace && loadedPages.value.has(page)) return
  if (!replace && loadingPages.value.has(page)) return

  setLoadingPage(page, true)

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTAcknowledgementInbox(buildQuery(page))

    if (version !== queryVersion) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload).map(normalizeRow).filter((row) => row?.id)
    const total = normalizeTotal(payload)

    totalRecords.value = total

    if (replace) {
      rows.value = items
      loadedPages.value = new Set([page])
      expandedRows.value = {}
    } else {
      rows.value = mergeRows(rows.value, items)

      const nextLoadedPages = new Set(loadedPages.value)
      nextLoadedPages.add(page)
      loadedPages.value = nextLoadedPages
    }

    bootstrapped.value = true
  } catch (error) {
    bootstrapped.value = true

    toast.add({
      severity: 'error',
      summary: tr('common.loadFailed', 'Load Failed'),
      detail: getApiErrorMessage(error, tr('ot.acknowledge.loadFailed', 'Failed to load acknowledge inbox')),
      life: 3500,
    })
  } finally {
    setLoadingPage(page, false)
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  queryVersion += 1

  loadedPages.value = new Set()
  loadingPages.value = new Set()

  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    expandedRows.value = {}
    bootstrapped.value = false
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
    version: queryVersion,
  })

  if (tableScrollShell.value && !keepVisible) {
    tableScrollShell.value.scrollTop = 0
  }
}

async function loadNextPage() {
  if (loadingMore.value) return
  if (backgroundLoading.value) return
  if (!hasMorePages.value) return

  const loaded = [...loadedPages.value]
  const nextPage = loaded.length ? Math.max(...loaded) + 1 : 1

  loadingMore.value = true

  try {
    await fetchPage(nextPage, {
      replace: false,
      silent: false,
      version: queryVersion,
    })
  } finally {
    loadingMore.value = false
  }
}

function onTableScroll(event) {
  const element = event?.target
  if (!element) return
  if (!hasMorePages.value) return
  if (loadingMore.value || backgroundLoading.value) return

  const distanceToBottom =
    element.scrollHeight - element.scrollTop - element.clientHeight

  if (distanceToBottom <= SCROLL_LOAD_DISTANCE) {
    loadNextPage()
  }
}

function updateFilterLayout() {
  const width = Number(filterBarRef.value?.getBoundingClientRect?.().width || 0)

  filterActionsStacked.value = width > 0 && width < FILTER_STACK_WIDTH
}

function setupFilterObserver() {
  updateFilterLayout()

  window.addEventListener('resize', updateFilterLayout)

  if (typeof ResizeObserver === 'undefined' || !filterBarRef.value) return

  filterResizeObserver = new ResizeObserver(() => {
    updateFilterLayout()
  })

  filterResizeObserver.observe(filterBarRef.value)
}

function cleanupFilterObserver() {
  window.removeEventListener('resize', updateFilterLayout)

  if (filterResizeObserver) {
    filterResizeObserver.disconnect()
    filterResizeObserver = null
  }
}

useOTRealtimeRefresh(
  () =>
    reloadFirstPage({
      keepVisible: true,
    }),
  {
    name: 'OTAcknowledgeInboxView',
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
  filters.sortBy = event?.sortField || 'createdAt'
  filters.sortOrder = typeof event?.sortOrder === 'number' ? event.sortOrder : -1

  reloadFirstPage({ keepVisible: true })
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

onMounted(() => {
  setupFilterObserver()
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  cleanupFilterObserver()
})
</script>

<template>
  <div class="ot-page-shell ot-ack-page">
    <section
      ref="filterBarRef"
      class="ot-filter-bar ot-ack-filter-bar"
      :class="{ 'is-filter-stacked': filterActionsStacked }"
    >
      <div class="ot-field">
        <label class="ot-field-label">
          {{ tr('common.search', 'Search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="tr('common.search', 'Search')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ tr('common.status', 'Status') }}
        </label>

        <Select
          v-model="filters.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="tr('common.status', 'Status')"
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateFrom"
          :label="tr('ot.requests.otDateFrom', 'OT Date From')"
          :placeholder="tr('ot.requests.otDateFrom', 'OT Date From')"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateTo"
          :label="tr('ot.requests.otDateTo', 'OT Date To')"
          :placeholder="tr('ot.requests.otDateTo', 'OT Date To')"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-ack-filter-actions">
        <span class="ot-loaded-badge">
          {{ summaryText }}
        </span>

        <Button
          :label="tr('common.clear', 'Clear')"
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
            {{ tr('ot.acknowledge.inboxTitle', 'OT Acknowledge Inbox') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ tr('common.updating', 'Updating') }}
          </span>
        </div>
      </div>

      <AppTableLoading
        v-if="firstLoading"
        :title="tr('ot.acknowledge.loading', 'Loading acknowledge inbox')"
        :message="tr('ot.acknowledge.fetchingRecords', 'Fetching acknowledge records')"
        :rows="8"
        :columns="9"
        icon="pi pi-eye"
      />

      <div
        v-else
        ref="tableScrollShell"
        class="ot-ack-table-scroll"
        @scroll.passive="onTableScroll"
      >
        <DataTable
          v-model:expandedRows="expandedRows"
          :value="rows"
          data-key="id"
          lazy
          removable-sort
          row-hover
          :sort-field="filters.sortBy"
          :sort-order="filters.sortOrder"
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
          class="ot-ack-table ot-data-table ot-data-table-compact"
          @sort="onSort"
        >
          <template #empty>
            <div
              v-if="bootstrapped"
              class="ot-empty-state"
            >
              <div class="ot-empty-icon">
                <i class="pi pi-eye" />
              </div>

              <div class="ot-empty-title">
                {{ tr('common.noData', 'No Data') }}
              </div>

              <div class="ot-empty-text">
                {{ tr('ot.acknowledge.noData', 'No acknowledge requests found') }}
              </div>
            </div>
          </template>

          <Column
            expander
            style="width: 3.2rem; min-width: 3.2rem"
          />

          <Column
            field="requestNo"
            :header="tr('ot.requests.requestNo', 'Request No')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <span class="ot-request-no-text">
                {{ data.requestNo || data.otRequestNo || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.requester', 'Requester')"
            style="width: 14rem; min-width: 14rem"
          >
            <template #body="{ data }">
              <div class="requester-cell">
                <div class="ot-main-text">
                  {{ displayRequester(data).name }}
                </div>

                <div class="ot-sub-text">
                  {{ displayRequester(data).employeeNo }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            field="status"
            :header="tr('ot.requests.approvalStatus', 'Approval Status')"
            sortable
            style="width: 16rem; min-width: 16rem"
          >
            <template #body="{ data }">
              <div class="approval-status-cell">
                <Tag
                  :value="displayApproval(data).label"
                  :class="[
                    'ot-ack-rgb-tag',
                    'approval-display-tag',
                    displayApprovalTagClass(data),
                  ]"
                />
              </div>
            </template>
          </Column>

          <Column
            :header="tr('ot.acknowledge.type', 'Acknowledge')"
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                :value="acknowledgementLabel(data)"
                :class="acknowledgementTagClass(data)"
              />
            </template>
          </Column>

          <Column
            :header="tr('ot.approval.requestedStaff', 'Staff')"
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                :value="tr('ot.requests.staffCount', `${displayStaffCount(data)} staff`, {
                  count: displayStaffCount(data),
                })"
                class="ot-ack-rgb-tag ot-ack-tag-info"
              />
            </template>
          </Column>

          <Column
            field="otDate"
            :header="tr('ot.requests.otDate', 'OT Date')"
            sortable
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <span class="ot-meta-text">
                {{ formatDateDMY(data.otDate) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.otTime', 'OT Time')"
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                :value="displayPaidTime(data)"
                class="ot-ack-rgb-tag ot-ack-tag-info"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="tr('common.createdAt', 'Created At')"
            sortable
            style="width: 12.5rem; min-width: 12.5rem"
          >
            <template #body="{ data }">
              <span class="ot-meta-text">
                {{ formatDateTimeDMY(data.createdAt) }}
              </span>
            </template>
          </Column>

          <template #expansion="{ data }">
            <div class="ot-expanded-box">
              <div
                v-if="displayEmployees(data).length"
                class="ot-expanded-table-scroll"
              >
                <div class="ot-expanded-grid-row is-head">
                  <div>{{ tr('common.no', 'No') }}</div>
                  <div>{{ tr('ot.requests.employeeId', 'Employee ID') }}</div>
                  <div>{{ tr('common.name', 'Name') }}</div>
                  <div>{{ tr('nav.positions', 'Position') }}</div>
                  <div>{{ tr('ot.requests.otTime', 'OT Time') }}</div>
                  <div>Line</div>
                </div>

                <div
                  v-for="(employee, index) in displayEmployees(data)"
                  :key="employeeIdOf(employee) || index"
                  class="ot-expanded-grid-row"
                >
                  <div class="cell-center">
                    {{ index + 1 }}
                  </div>

                  <div class="cell-center cell-code">
                    {{ employeeCodeOf(employee) }}
                  </div>

                  <div class="cell-center cell-strong cell-wrap">
                    {{ employeeNameOf(employee) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeePositionOf(employee) }}
                  </div>

                  <div class="cell-center">
                    <Tag
                      :value="employeePaidTimeOf(employee, data)"
                      class="ot-ack-rgb-tag ot-ack-tag-info"
                    />
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeLineOf(employee) }}
                  </div>
                </div>
              </div>

              <div
                v-else
                class="ot-expanded-empty"
              >
                {{ tr('ot.requests.noEmployeeData', 'No employee data') }}
              </div>
            </div>
          </template>
        </DataTable>

        <div
          v-if="bootstrapped && hasAnyData"
          class="ot-list-bottom-bar"
        >
          <span class="ot-loaded-badge">
            {{ summaryText }}
          </span>

          <Button
            v-if="hasMorePages"
            :label="loadingMore ? 'Loading more...' : 'Load more'"
            icon="pi pi-angle-down"
            severity="secondary"
            outlined
            size="small"
            class="ot-ack-action-button"
            :loading="loadingMore"
            @click="loadNextPage"
          />

          <span
            v-else
            class="ot-all-loaded-text"
          >
            All matched requests loaded
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ot-ack-page {
  --ot-list-code-rgb: 37 99 235;
  --ot-list-text-rgb: 15 23 42;
  --ot-list-muted-rgb: 100 116 139;
  --ot-list-soft-rgb: 148 163 184;
  --ot-list-green-rgb: 34 197 94;
  --ot-list-amber-rgb: 245 158 11;
  --ot-list-red-rgb: 239 68 68;
  --ot-list-blue-rgb: 59 130 246;
  --ot-list-purple-rgb: 168 85 247;
  --ot-list-row-border: 148 163 184;

  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 1rem;
  overflow-x: hidden;
}

.ot-ack-page,
.ot-ack-page :deep(.p-component),
.ot-ack-page :deep(.p-inputtext),
.ot-ack-page :deep(.p-button),
.ot-ack-page :deep(.p-select),
.ot-ack-page :deep(.p-select-label) {
  font-family: inherit;
}

/* =========================
   Filter bar
   ========================= */

.ot-ack-filter-bar {
  display: grid;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  grid-template-columns:
    minmax(220px, 1.25fr)
    minmax(150px, 0.75fr)
    minmax(170px, 0.85fr)
    minmax(170px, 0.85fr)
    minmax(0, auto);
  gap: 0.75rem;
  align-items: end;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 1.05rem;
  background:
    linear-gradient(135deg, rgb(var(--ot-list-blue-rgb) / 0.055), transparent 34%),
    var(--surface-card);
  box-shadow: 0 12px 34px rgb(15 23 42 / 0.055);
  padding: 0.85rem;
}

.ot-ack-filter-bar.is-filter-stacked {
  grid-template-columns:
    minmax(220px, 1.25fr)
    minmax(150px, 0.75fr)
    minmax(170px, 0.85fr)
    minmax(170px, 0.85fr);
}

.ot-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
}

.ot-field-label {
  color: var(--text-color-secondary);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.ot-ack-filter-actions {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-ack-filter-bar.is-filter-stacked .ot-ack-filter-actions {
  grid-column: 1 / -1;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.ot-ack-action-button {
  max-width: 100%;
  white-space: nowrap;
}

.ot-ack-action-button :deep(.p-button-label) {
  overflow: hidden;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-ack-action-button :deep(.p-button-icon) {
  flex: 0 0 auto;
  font-size: 0.76rem;
}

.ot-loaded-badge {
  display: inline-flex;
  min-height: 1.9rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid rgb(var(--ot-list-blue-rgb) / 0.22);
  border-radius: 999px;
  background: rgb(var(--ot-list-blue-rgb) / 0.09);
  color: rgb(var(--ot-list-blue-rgb));
  padding: 0.28rem 0.62rem;
  font-size: 0.74rem;
  font-weight: 750;
  line-height: 1;
  white-space: nowrap;
}

/* =========================
   Table card
   ========================= */

.ot-table-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 1.15rem;
  background: var(--surface-card);
  box-shadow: 0 16px 42px rgb(15 23 42 / 0.07);
}

.ot-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid rgb(var(--ot-list-row-border) / 0.14);
  background:
    linear-gradient(135deg, rgb(var(--ot-list-blue-rgb) / 0.055), transparent 32%),
    var(--surface-card);
  padding: 0.82rem 1rem;
}

.ot-table-title {
  margin: 0;
  color: var(--text-color);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.25;
}

.ot-table-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-ack-table-scroll {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  max-height: min(66vh, 660px);
  min-height: 22rem;
  overflow: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

/* =========================
   PrimeVue table center/stability
   ========================= */

:deep(.ot-ack-table.p-datatable) {
  max-width: 100% !important;
  min-width: 0 !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-wrapper) {
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: visible !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-thead > tr > th) {
  position: sticky !important;
  top: 0;
  z-index: 5;
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  border-color: rgb(var(--ot-list-row-border) / 0.14) !important;
  background: var(--surface-ground) !important;
  color: var(--text-color-secondary) !important;
  padding: 0.58rem 0.68rem !important;
  font-size: 0.76rem !important;
  font-weight: 750 !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 64px !important;
  border-color: rgb(var(--ot-list-row-border) / 0.08) !important;
  padding: 0.44rem 0.68rem !important;
  color: var(--text-color) !important;
  font-size: 0.8rem !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr.p-datatable-row-expansion > td) {
  height: auto !important;
  border-color: transparent !important;
  padding: 0.45rem 0.75rem 0.75rem !important;
  background: transparent !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr) {
  transition:
    background-color 0.14s ease,
    box-shadow 0.14s ease;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr:hover) {
  background: rgb(var(--ot-list-blue-rgb) / 0.03) !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr.p-row-expanded) {
  background: rgb(var(--ot-list-blue-rgb) / 0.035) !important;
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

:deep(.ot-ack-table.p-datatable .p-sortable-column-icon),
:deep(.ot-ack-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.ot-ack-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.ot-ack-table.p-datatable .p-row-toggler) {
  display: inline-flex !important;
  width: 1.85rem !important;
  height: 1.85rem !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 999px !important;
  color: rgb(var(--ot-list-blue-rgb)) !important;
}

:deep(.ot-ack-table.p-datatable .p-row-toggler:hover) {
  background: rgb(var(--ot-list-blue-rgb) / 0.1) !important;
}

:deep(.ot-ack-table.p-datatable .p-tag),
:deep(.ot-ack-table.p-datatable .p-button) {
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

/* =========================
   Table text
   ========================= */

.ot-request-no-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--ot-list-code-rgb));
  font-size: 0.82rem;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.005em;
  text-align: center;
  white-space: nowrap;
}

.requester-cell,
.approval-status-cell {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  text-align: center;
}

.ot-main-text {
  max-width: 13rem;
  overflow: hidden;
  color: rgb(var(--ot-list-text-rgb));
  font-size: 0.82rem;
  font-weight: 660;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-sub-text {
  max-width: 12rem;
  overflow: hidden;
  color: var(--text-color-secondary);
  font-size: 0.71rem;
  font-weight: 520;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-meta-text {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: rgb(var(--ot-list-muted-rgb));
  font-size: 0.78rem;
  font-weight: 560;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* =========================
   RGB tags
   ========================= */

.ot-ack-rgb-tag {
  --ot-ack-tag-rgb: var(--ot-list-muted-rgb);

  display: inline-flex !important;
  min-height: 1.42rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--ot-ack-tag-rgb) / 0.28) !important;
  border-radius: 999px !important;
  background: rgb(var(--ot-ack-tag-rgb) / 0.11) !important;
  color: rgb(var(--ot-ack-tag-rgb)) !important;
  padding: 0.12rem 0.5rem !important;
  font-size: 0.7rem !important;
  font-weight: 730 !important;
  line-height: 1 !important;
  text-align: center !important;
  white-space: nowrap !important;
}

.approval-display-tag {
  max-width: 13.5rem;
}

.ot-ack-tag-approved {
  --ot-ack-tag-rgb: var(--ot-list-green-rgb);
}

.ot-ack-tag-rejected {
  --ot-ack-tag-rgb: var(--ot-list-red-rgb);
}

.ot-ack-tag-pending {
  --ot-ack-tag-rgb: var(--ot-list-amber-rgb);
}

.ot-ack-tag-info {
  --ot-ack-tag-rgb: var(--ot-list-blue-rgb);
}

.ot-ack-tag-muted {
  --ot-ack-tag-rgb: var(--ot-list-muted-rgb);
}

.ot-ack-tag-purple {
  --ot-ack-tag-rgb: var(--ot-list-purple-rgb);
}

/* =========================
   Expanded child table
   ========================= */

.ot-expanded-box {
  max-width: 100%;
  min-width: 0;
  border: 1px solid rgb(var(--ot-list-blue-rgb) / 0.12);
  border-radius: 0.95rem;
  background:
    linear-gradient(135deg, rgb(var(--ot-list-blue-rgb) / 0.035), transparent 35%),
    var(--surface-ground);
  padding: 0.72rem;
}

.ot-expanded-table-scroll {
  max-width: 100%;
  min-width: 740px;
  max-height: 19rem;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgb(var(--ot-list-row-border) / 0.12);
  border-radius: 0.85rem;
  background: var(--surface-card);
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns:
    4rem
    9rem
    minmax(12rem, 1.2fr)
    minmax(10rem, 1fr)
    8rem
    minmax(10rem, 1fr);
  min-height: 2.55rem;
  align-items: center;
  border-bottom: 1px solid rgb(var(--ot-list-row-border) / 0.075);
}

.ot-expanded-grid-row:last-child {
  border-bottom: 0;
}

.ot-expanded-grid-row > div {
  display: flex;
  min-width: 0;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-right: 1px solid rgb(var(--ot-list-row-border) / 0.07);
  padding: 0.48rem 0.62rem;
  color: var(--text-color-secondary);
  font-size: 0.76rem;
  font-weight: 500;
  line-height: 1.28;
  text-align: center;
}

.ot-expanded-grid-row > div:last-child {
  border-right: 0;
}

.ot-expanded-grid-row.is-head {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 2.35rem;
  background: var(--surface-ground);
}

.ot-expanded-grid-row.is-head > div {
  color: var(--text-color-secondary);
  font-size: 0.7rem;
  font-weight: 740;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.cell-center {
  text-align: center;
}

.cell-code {
  color: rgb(var(--ot-list-blue-rgb)) !important;
  font-weight: 700 !important;
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  color: var(--text-color) !important;
  font-weight: 650 !important;
}

.cell-wrap {
  overflow-wrap: anywhere;
  white-space: normal;
}

.ot-expanded-empty {
  border: 1px dashed rgb(var(--ot-list-row-border) / 0.18);
  border-radius: 0.85rem;
  background: var(--surface-card);
  color: var(--text-color-secondary);
  padding: 0.85rem;
  font-size: 0.8rem;
  font-weight: 520;
  text-align: center;
}

/* =========================
   Bottom state
   ========================= */

.ot-list-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-top: 1px solid rgb(var(--ot-list-row-border) / 0.1);
  background: var(--surface-card);
  padding: 0.65rem;
}

.ot-all-loaded-text {
  color: var(--text-color-secondary);
  font-size: 0.74rem;
  font-weight: 600;
}

/* =========================
   Empty state
   ========================= */

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
  background: rgb(var(--ot-list-blue-rgb) / 0.1);
  color: rgb(var(--ot-list-blue-rgb));
  font-size: 1.25rem;
}

.ot-empty-title {
  color: var(--text-color);
  font-size: 0.95rem;
  font-weight: 800;
}

.ot-empty-text {
  max-width: 26rem;
  font-size: 0.82rem;
  line-height: 1.4;
  text-align: center;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .ot-ack-page {
  --ot-list-text-rgb: 226 232 240;
  --ot-list-muted-rgb: 203 213 225;
  --ot-list-row-border: 71 85 105;
}

:global(.dark) .ot-ack-rgb-tag {
  border-color: rgb(var(--ot-ack-tag-rgb) / 0.42) !important;
  background: rgb(var(--ot-ack-tag-rgb) / 0.18) !important;
}

:global(.dark) .ot-expanded-box {
  border-color: rgb(var(--ot-list-blue-rgb) / 0.22);
  background:
    linear-gradient(135deg, rgb(var(--ot-list-blue-rgb) / 0.075), transparent 35%),
    var(--surface-ground);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 1100px) {
  .ot-ack-filter-bar,
  .ot-ack-filter-bar.is-filter-stacked {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-ack-filter-actions,
  .ot-ack-filter-bar.is-filter-stacked .ot-ack-filter-actions {
    grid-column: 1 / -1;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .ot-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ot-table-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .ot-ack-filter-bar,
  .ot-ack-filter-bar.is-filter-stacked {
    grid-template-columns: 1fr;
    padding: 0.75rem;
  }

  .ot-ack-filter-actions,
  .ot-ack-filter-bar.is-filter-stacked .ot-ack-filter-actions {
    align-items: stretch;
    justify-content: stretch;
  }

  .ot-ack-filter-actions > * {
    flex: 1 1 100%;
  }

  .ot-loaded-badge,
  .ot-ack-action-button {
    width: 100%;
    justify-content: center;
  }

  .ot-ack-table-scroll {
    max-height: 64vh;
  }

  .ot-list-bottom-bar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>