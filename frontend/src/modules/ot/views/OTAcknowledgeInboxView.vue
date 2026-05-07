<!-- frontend/src/modules/ot/views/OTAcknowledgeInboxView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTAcknowledgeInboxView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
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

import { getOTAcknowledgementInbox } from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const filters = reactive({
  search: '',
  status: '',
  dayType: '',
  otDateFrom: null,
  otDateTo: null,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Pending Confirmation', value: 'PENDING_REQUESTER_CONFIRMATION' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Requester Disagreed', value: 'REQUESTER_DISAGREED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const dayTypeOptions = [
  { label: 'All Day Types', value: '' },
  { label: 'Working Day', value: 'WORKING_DAY' },
  { label: 'Sunday', value: 'SUNDAY' },
  { label: 'Holiday', value: 'HOLIDAY' },
]

const totalRequests = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalRequests.value}`)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRequests.value > PAGE_SIZE)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function errorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

function formatDateYMD(value) {
  if (!value) return undefined

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
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

function normalizeClassKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

function statusSeverity(value) {
  const status = String(value || '').toUpperCase()

  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'REQUESTER_DISAGREED') return 'danger'
  if (status === 'CANCELLED') return 'contrast'
  if (status === 'PENDING') return 'warning'
  if (status === 'PENDING_REQUESTER_CONFIRMATION') return 'warning'

  return 'secondary'
}

function dayTypeSeverity(value) {
  const dayType = String(value || '').toUpperCase()

  if (dayType === 'HOLIDAY') return 'danger'
  if (dayType === 'SUNDAY') return 'warning'
  if (dayType === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function dayTypeClass(value) {
  return `ot-day-${normalizeClassKey(value || 'unknown')}`
}

function statusClass(value) {
  return `ot-status-${normalizeClassKey(value || 'unknown')}`
}

function formatRequester(row) {
  const name = String(row?.requesterName || '').trim()
  const employeeNo = String(row?.requesterEmployeeNo || '').trim()

  return {
    name: name || '-',
    employeeNo: employeeNo || '-',
  }
}

function formatTimeRange(row) {
  const start = String(row?.requestStartTime || row?.startTime || '').trim()
  const end = String(row?.requestEndTime || row?.endTime || '').trim()

  if (!start && !end) return '-'

  return [start, end].filter(Boolean).join(' - ')
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
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
    const items = normalizeItems(payload)
    const total = Number(payload?.pagination?.total || 0)

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

      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        rows.value[startIndex + i] = items[i]
      }

      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail: errorMessage(error, 'Failed to load acknowledgement inbox'),
      life: 3000,
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

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function onDayTypeChange() {
  reloadFirstPage({ keepVisible: true })
}

function onDateChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
  filters.otDateFrom = null
  filters.otDateTo = null

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

function goDetail(id) {
  if (!id) return
  router.push(`/ot/requests/${id}`)
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
    <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-3">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            <i class="pi pi-info-circle"></i>
          </div>

          <div>
            <h2 class="text-base font-semibold text-[color:var(--ot-text)]">
              Acknowledge Inbox
            </h2>
            <p class="text-xs text-[color:var(--ot-text-muted)]">
              View-only OT requests where you are included as an acknowledge/FYI person.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[200px] xl:shrink-0">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              placeholder="Search"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[175px] xl:shrink-0">
            <Select
              v-model="filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
              size="small"
              @change="onStatusChange"
            />
          </div>

          <div class="w-full xl:w-[175px] xl:shrink-0">
            <Select
              v-model="filters.dayType"
              :options="dayTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Day Type"
              class="w-full"
              size="small"
              @change="onDayTypeChange"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateFrom"
              dateFormat="yy-mm-dd"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date From"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateTo"
              dateFormat="yy-mm-dd"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date To"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
              Loaded {{ summaryText }}
            </div>

            <Button
              label="Clear"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />
          </div>
        </div>
      </div>

      <DataTable
        :value="rows"
        lazy
        scrollable
        scrollHeight="500px"
        tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
        class="ot-ack-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 64,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No acknowledgement requests found.
          </div>
        </template>

        <Column field="requestNo" header="Request No">
          <template #body="{ data }">
            <span
              v-if="data"
              class="font-medium text-[color:var(--ot-text)]"
            >
              {{ data.requestNo || '-' }}
            </span>
          </template>
        </Column>

        <Column header="Requester">
          <template #body="{ data }">
            <div v-if="data" class="whitespace-nowrap">
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ formatRequester(data).name }}
              </div>
              <div class="text-xs text-[color:var(--ot-text-muted)]">
                {{ formatRequester(data).employeeNo }}
              </div>
            </div>
          </template>
        </Column>

        <Column header="Acknowledgement">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.acknowledgementLabel || 'FYI'"
              :severity="data.acknowledgementSeverity || 'info'"
              class="ot-status-tag ot-ack-tag"
            />
          </template>
        </Column>

        <Column field="otDate" header="OT Date">
          <template #body="{ data }">
            <span v-if="data">{{ data.otDate || '-' }}</span>
          </template>
        </Column>

        <Column header="OT Time">
          <template #body="{ data }">
            <span v-if="data">{{ formatTimeRange(data) }}</span>
          </template>
        </Column>

        <Column field="dayType" header="Day Type">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.dayType || '-'"
              :severity="dayTypeSeverity(data.dayType)"
              class="ot-status-tag"
              :class="dayTypeClass(data.dayType)"
            />
          </template>
        </Column>

        <Column field="status" header="Request Status">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.status || '-'"
              :severity="statusSeverity(data.status)"
              class="ot-status-tag"
              :class="statusClass(data.status)"
            />
          </template>
        </Column>

        <Column header="Employees">
          <template #body="{ data }">
            <span v-if="data">{{ data.employeeCount || 0 }}</span>
          </template>
        </Column>

        <Column field="createdAt" header="Created At">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>

        <Column header="Actions">
          <template #body="{ data }">
            <Button
              v-if="data"
              label="View"
              icon="pi pi-eye"
              size="small"
              outlined
              @click="goDetail(data._id || data.id)"
            />
          </template>
        </Column>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.ot-ack-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-ack-table .p-datatable-thead > tr > th) {
  padding: 0.62rem 0.75rem !important;
  white-space: nowrap !important;
}

:deep(.ot-ack-table .p-datatable-tbody > tr > td) {
  padding: 0.55rem 0.75rem !important;
  height: 64px !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

:deep(.ot-ack-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
  white-space: nowrap !important;
}

:deep(.p-tag.ot-ack-tag) {
  background: #e0f2fe !important;
  color: #075985 !important;
  border-color: #38bdf8 !important;
}

:deep(.p-tag.ot-day-working-day) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-day-sunday) {
  background: #ffedd5 !important;
  color: #9a3412 !important;
  border-color: #f97316 !important;
}

:deep(.p-tag.ot-day-holiday) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:deep(.p-tag.ot-status-pending),
:deep(.p-tag.ot-status-pending-requester-confirmation) {
  background: #fef3c7 !important;
  color: #92400e !important;
  border-color: #f59e0b !important;
}

:deep(.p-tag.ot-status-approved) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-status-rejected),
:deep(.p-tag.ot-status-requester-disagreed) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:deep(.p-tag.ot-status-cancelled) {
  background: #e5e7eb !important;
  color: #374151 !important;
  border-color: #9ca3af !important;
}

:global(.dark) :deep(.p-tag.ot-ack-tag) {
  background: rgba(56, 189, 248, 0.14) !important;
  color: #7dd3fc !important;
  border-color: rgba(56, 189, 248, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-working-day) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-sunday) {
  background: rgba(249, 115, 22, 0.18) !important;
  color: #fdba74 !important;
  border-color: rgba(249, 115, 22, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-holiday) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-pending),
:global(.dark) :deep(.p-tag.ot-status-pending-requester-confirmation) {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-approved) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-rejected),
:global(.dark) :deep(.p-tag.ot-status-requester-disagreed) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-cancelled) {
  background: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
  border-color: rgba(148, 163, 184, 0.45) !important;
}
</style>