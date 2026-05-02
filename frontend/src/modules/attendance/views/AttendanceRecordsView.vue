<!-- frontend/src/modules/attendance/views/AttendanceRecordsView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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

import { getAttendanceRecords } from '@/modules/attendance/attendance.api'

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
  employeeNo: '',
  status: '',
  importedStatus: '',
  shiftMatchStatus: '',
  dayType: '',
  attendanceDateFrom: null,
  attendanceDateTo: null,
  sortField: 'attendanceDate',
  sortOrder: -1,
})

let searchTimer = null
let currentRequestId = 0

const statusOptions = [
  { label: 'All Derived Status', value: '' },
  { label: 'Present', value: 'PRESENT' },
  { label: 'Late', value: 'LATE' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Forget Scan In', value: 'FORGET_SCAN_IN' },
  { label: 'Forget Scan Out', value: 'FORGET_SCAN_OUT' },
  { label: 'Shift Mismatch', value: 'SHIFT_MISMATCH' },
  { label: 'Leave', value: 'LEAVE' },
  { label: 'Off', value: 'OFF' },
  { label: 'Unknown', value: 'UNKNOWN' },
]

const importedStatusOptions = [
  { label: 'All Imported Status', value: '' },
  { label: 'Present', value: 'PRESENT' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Leave', value: 'LEAVE' },
  { label: 'Off', value: 'OFF' },
  { label: 'Unknown', value: 'UNKNOWN' },
]

const shiftMatchStatusOptions = [
  { label: 'All Shift Status', value: '' },
  { label: 'Matched', value: 'MATCHED' },
  { label: 'Mismatch', value: 'MISMATCH' },
  { label: 'Unknown', value: 'UNKNOWN' },
]

const dayTypeOptions = [
  { label: 'All Day Types', value: '' },
  { label: 'Working Day', value: 'WORKING_DAY' },
  { label: 'Sunday', value: 'SUNDAY' },
  { label: 'Holiday', value: 'HOLIDAY' },
]

const totalRows = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalRows.value}`)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRows.value > PAGE_SIZE)

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function formatDateYMD(value) {
  if (!value) return undefined

  const date = value instanceof Date ? value : new Date(value)
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
    employeeNo: String(filters.employeeNo || '').trim() || undefined,
    status: filters.status || undefined,
    importedStatus: filters.importedStatus || undefined,
    shiftMatchStatus: filters.shiftMatchStatus || undefined,
    dayType: filters.dayType || undefined,
    attendanceDateFrom: formatDateYMD(filters.attendanceDateFrom),
    attendanceDateTo: formatDateYMD(filters.attendanceDateTo),
    sortBy: filters.sortField,
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
    const res = await getAttendanceRecords(buildQuery(page))
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
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load attendance records.',
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

function onFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  const fieldMap = {
    attendanceDate: 'attendanceDate',
    importedStatus: 'importedStatus',
    status: 'status',
    dayType: 'dayType',
    shiftMatchStatus: 'shiftMatchStatus',
    workedMinutes: 'workedMinutes',
    lateMinutes: 'lateMinutes',
    earlyOutMinutes: 'earlyOutMinutes',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }

  filters.sortField = fieldMap[event.sortField] || 'attendanceDate'
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

function clearFilters() {
  filters.search = ''
  filters.employeeNo = ''
  filters.status = ''
  filters.importedStatus = ''
  filters.shiftMatchStatus = ''
  filters.dayType = ''
  filters.attendanceDateFrom = null
  filters.attendanceDateTo = null
  filters.sortField = 'attendanceDate'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function refresh() {
  reloadFirstPage({ keepVisible: true })
}

function statusSeverity(value) {
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'PRESENT') return 'success'
  if (normalized === 'LATE') return 'warning'
  if (normalized === 'ABSENT') return 'danger'
  if (normalized === 'FORGET_SCAN_IN' || normalized === 'FORGET_SCAN_OUT') return 'info'
  if (normalized === 'SHIFT_MISMATCH') return 'danger'
  if (normalized === 'LEAVE') return 'help'
  if (normalized === 'OFF') return 'secondary'
  if (normalized === 'UNKNOWN') return 'contrast'

  return 'secondary'
}

function shiftMatchSeverity(value) {
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'MATCHED') return 'success'
  if (normalized === 'MISMATCH') return 'danger'

  return 'secondary'
}

function dayTypeSeverity(value) {
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'HOLIDAY') return 'danger'
  if (normalized === 'SUNDAY') return 'warning'
  if (normalized === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function formatEmployee(row) {
  const employeeNo = String(row?.employeeNo || '').trim()
  const employeeName = String(row?.employeeName || '').trim()

  if (employeeNo && employeeName) return `${employeeNo} - ${employeeName}`
  if (employeeNo) return employeeNo
  if (employeeName) return employeeName

  return '-'
}

function formatImportedEmployee(row) {
  const employeeNo = String(row?.importedEmployeeId || '').trim()
  const employeeName = String(row?.importedEmployeeName || '').trim()

  if (employeeNo && employeeName) return `${employeeNo} - ${employeeName}`
  if (employeeNo) return employeeNo
  if (employeeName) return employeeName

  return '-'
}

function formatShift(row) {
  const shiftCode = String(row?.shiftCode || '').trim()
  const shiftName = String(row?.shiftName || '').trim()

  if (shiftCode && shiftName) return `${shiftCode} - ${shiftName}`
  if (shiftCode) return shiftCode
  if (shiftName) return shiftName

  return '-'
}

function formatImportNo(row) {
  return (
    String(row?.attendanceImportNo || '').trim() ||
    String(row?.importNo || '').trim() ||
    '-'
  )
}

function formatMinutes(value) {
  const minutes = Number(value || 0)

  if (!minutes) return '0m'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`

  return `${mins}m`
}

function formatIssues(value) {
  if (Array.isArray(value) && value.length) return value.join(', ')
  return ''
}

watch(
  () => [
    filters.status,
    filters.importedStatus,
    filters.shiftMatchStatus,
    filters.dayType,
    filters.attendanceDateFrom,
    filters.attendanceDateTo,
  ],
  () => {
    onFilterChange()
  },
)

watch(
  () => filters.employeeNo,
  () => {
    runSearchSoon()
  },
)

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
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="backgroundLoading"
          @click="refresh"
        />

        <Button
          label="Clear"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearFilters"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-1 gap-2 xl:grid-cols-7">
            <IconField class="w-full xl:col-span-2">
              <InputIcon class="pi pi-search" />
              <InputText
                v-model="filters.search"
                placeholder="Search employee, imported name, reason"
                class="w-full"
                size="small"
                @input="onSearchInput"
              />
            </IconField>

            <InputText
              v-model="filters.employeeNo"
              placeholder="Employee No"
              class="w-full"
              size="small"
            />

            <Select
              v-model="filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Derived Status"
              class="w-full"
              size="small"
            />

            <Select
              v-model="filters.importedStatus"
              :options="importedStatusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Imported Status"
              class="w-full"
              size="small"
            />

            <Select
              v-model="filters.shiftMatchStatus"
              :options="shiftMatchStatusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Shift Status"
              class="w-full"
              size="small"
            />

            <Select
              v-model="filters.dayType"
              :options="dayTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Day Type"
              class="w-full"
              size="small"
            />
          </div>

          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[180px,180px,1fr]">
            <DatePicker
              v-model="filters.attendanceDateFrom"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="Date From"
            />

            <DatePicker
              v-model="filters.attendanceDateTo"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="Date To"
            />

            <div class="flex items-center justify-end">
              <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
                Loaded {{ summaryText }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        :value="rows"
        lazy
        removableSort
        scrollable
        scrollHeight="500px"
        :sortField="filters.sortField"
        :sortOrder="filters.sortOrder"
        tableStyle="min-width: 126rem"
        class="attendance-records-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 76,
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
            No attendance records found.
          </div>
        </template>

        <Column field="attendanceDate" header="Date" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.attendanceDate || '-' }}</span>
          </template>
        </Column>

        <Column header="Employee" style="min-width: 17rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-col">
              <span class="font-medium text-[color:var(--ot-text)]">
                {{ formatEmployee(data) }}
              </span>
              <span class="text-xs text-[color:var(--ot-text-muted)]">
                Imported: {{ formatImportedEmployee(data) }}
              </span>
            </div>
          </template>
        </Column>

        <Column header="Shift" style="min-width: 16rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-col">
              <span class="font-medium text-[color:var(--ot-text)]">
                {{ formatShift(data) }}
              </span>
              <span class="text-xs text-[color:var(--ot-text-muted)]">
                {{ data.shiftStartTime || '-' }} - {{ data.shiftEndTime || '-' }}
              </span>
            </div>
          </template>
        </Column>

        <Column header="Clock" style="min-width: 12rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-col text-sm">
              <span>
                In:
                <span class="font-medium text-[color:var(--ot-text)]">
                  {{ data.clockIn || '-' }}
                </span>
              </span>
              <span>
                Out:
                <span class="font-medium text-[color:var(--ot-text)]">
                  {{ data.clockOut || '-' }}
                </span>
              </span>
            </div>
          </template>
        </Column>

        <Column field="importedStatus" header="Imported Status" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.importedStatus || '-'"
              :severity="statusSeverity(data.importedStatus)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column field="status" header="Derived Status" sortable style="min-width: 11rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.status || '-'"
              :severity="statusSeverity(data.status)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column field="dayType" header="Day Type" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.dayType || '-'"
              :severity="dayTypeSeverity(data.dayType)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column field="shiftMatchStatus" header="Shift Match" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.shiftMatchStatus || '-'"
              :severity="shiftMatchSeverity(data.shiftMatchStatus)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column field="workedMinutes" header="Worked" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatMinutes(data.workedMinutes) }}</span>
          </template>
        </Column>

        <Column field="lateMinutes" header="Late" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatMinutes(data.lateMinutes) }}</span>
          </template>
        </Column>

        <Column field="earlyOutMinutes" header="Early Out" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatMinutes(data.earlyOutMinutes) }}</span>
          </template>
        </Column>

        <Column header="Import" style="min-width: 12rem">
          <template #body="{ data }">
            <span v-if="data" class="text-sm text-[color:var(--ot-text-muted)]">
              {{ formatImportNo(data) }}
            </span>
          </template>
        </Column>

        <Column header="Issues" style="min-width: 24rem">
          <template #body="{ data }">
            <div
              v-if="data"
              class="line-clamp-2 text-sm text-[color:var(--ot-text-muted)]"
              :title="formatIssues(data.validationIssues)"
            >
              {{ formatIssues(data.validationIssues) || '—' }}
            </div>
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
:deep(.attendance-records-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.attendance-records-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  height: 76px !important;
  vertical-align: middle !important;
}

:deep(.attendance-records-table .p-tag.attendance-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
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