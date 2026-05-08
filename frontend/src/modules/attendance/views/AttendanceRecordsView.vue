<!-- frontend/src/modules/attendance/views/AttendanceRecordsView.vue -->
<script setup>
// frontend/src/modules/attendance/views/AttendanceRecordsView.vue

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
  { label: 'Wrong Shift', value: 'SHIFT_MISMATCH' },
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

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
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

function formatDateDMY(value) {
  if (!value) return '-'

  const raw = s(value)

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return raw || '-'

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()

  return `${dd}/${mm}/${yyyy}`
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

function displayTime(value) {
  return normalizeTimeValue(value) || '-'
}

function isMissingTime(value) {
  const raw = s(value)
  return !raw || raw === '-'
}

function scanTimeLabel(value) {
  return isMissingTime(value) ? 'Missing' : value
}

function scanTimeTone(value) {
  return isMissingTime(value) ? 'is-missing' : 'is-complete'
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
    employeeNo: s(filters.employeeNo) || undefined,
    status: filters.status || undefined,
    importedStatus: filters.importedStatus || undefined,
    shiftMatchStatus: filters.shiftMatchStatus || undefined,
    dayType: filters.dayType || undefined,
    attendanceDateFrom: formatDateYMD(filters.attendanceDateFrom),
    attendanceDateTo: formatDateYMD(filters.attendanceDateTo),
    sortBy: 'attendanceDate',
    sortOrder: 'desc',
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

  reloadFirstPage({ keepVisible: true })
}

function refresh() {
  reloadFirstPage({ keepVisible: true })
}

function statusSeverity(value) {
  const normalized = upper(value)

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
  const normalized = upper(value)

  if (normalized === 'MATCHED') return 'success'
  if (normalized === 'MISMATCH') return 'danger'
  if (normalized === 'UNKNOWN') return 'secondary'

  return 'secondary'
}

function dayTypeSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return 'danger'
  if (normalized === 'SUNDAY') return 'warning'
  if (normalized === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function statusLabel(value) {
  const normalized = upper(value)

  const labels = {
    PRESENT: 'Present',
    LATE: 'Late',
    ABSENT: 'Absent',
    FORGET_SCAN_IN: 'Forget Scan In',
    FORGET_SCAN_OUT: 'Forget Scan Out',
    SHIFT_MISMATCH: 'Wrong Shift',
    LEAVE: 'Leave',
    OFF: 'Off',
    UNKNOWN: 'Unknown',
  }

  return labels[normalized] || normalized || '-'
}

function shiftMatchLabel(value) {
  const normalized = upper(value)

  const labels = {
    MATCHED: 'Matched',
    MISMATCH: 'Mismatch',
    UNKNOWN: 'Unknown',
  }

  return labels[normalized] || normalized || '-'
}

function dayTypeLabel(value) {
  const normalized = upper(value)

  const labels = {
    WORKING_DAY: 'Working Day',
    SUNDAY: 'Sunday',
    HOLIDAY: 'Holiday',
  }

  return labels[normalized] || normalized || '-'
}

function formatEmployee(row) {
  const employeeNo = s(row?.employeeNo)
  const employeeName = s(row?.employeeName)

  if (employeeNo && employeeName) return `${employeeNo} · ${employeeName}`
  if (employeeNo) return employeeNo
  if (employeeName) return employeeName

  return '-'
}

function formatImportedEmployee(row) {
  const employeeNo = s(row?.importedEmployeeId)
  const employeeName = s(row?.importedEmployeeName)

  if (employeeNo && employeeName) return `${employeeNo} · ${employeeName}`
  if (employeeNo) return employeeNo
  if (employeeName) return employeeName

  return '-'
}

function shouldShowImportedEmployee(row) {
  const imported = formatImportedEmployee(row)
  const employee = formatEmployee(row)

  return imported !== '-' && imported !== employee
}

function formatShift(row) {
  const shiftCode = s(row?.shiftCode)
  const shiftName = s(row?.shiftName)

  if (shiftCode && shiftName) return `${shiftCode} · ${shiftName}`
  if (shiftCode) return shiftCode
  if (shiftName) return shiftName

  return '-'
}

function formatShiftTime(row) {
  const start = displayTime(row?.shiftStartTime)
  const end = displayTime(row?.shiftEndTime)

  if (start === '-' && end === '-') return '-'

  return `${start} - ${end}`
}

function formatImportNo(row) {
  return s(row?.attendanceImportNo) || s(row?.importNo) || '-'
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

function minuteTone(value, type = '') {
  const minutes = Number(value || 0)

  if (minutes <= 0) return 'is-zero'
  if (type === 'late' || type === 'early') return 'is-warning'

  return 'is-normal'
}

function formatIssues(value) {
  if (Array.isArray(value) && value.length) return value.join(', ')
  if (typeof value === 'string' && value.trim()) return value.trim()
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
    <section
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="attendance-filter-panel">
          <div class="attendance-main-filter-row">
            <IconField class="filter-search">
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

          <div class="attendance-date-action-row">
            <DatePicker
              v-model="filters.attendanceDateFrom"
              dateFormat="dd/mm/yy"
              showIcon
              class="date-filter-control"
              inputClass="w-full"
              placeholder="Date From"
            />

            <DatePicker
              v-model="filters.attendanceDateTo"
              dateFormat="dd/mm/yy"
              showIcon
              class="date-filter-control"
              inputClass="w-full"
              placeholder="Date To"
            />

            <div class="loaded-chip">
              Loaded {{ summaryText }}
            </div>

            <Button
              label="Refresh"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              :loading="backgroundLoading"
              class="date-action-button"
              @click="refresh"
            />

            <Button
              label="Clear"
              icon="pi pi-filter-slash"
              severity="secondary"
              outlined
              size="small"
              class="date-action-button"
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
        tableStyle="width: max-content; min-width: 100%;"
        class="attendance-records-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 72,
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
            No attendance records found.
          </div>
        </template>

        <Column
          field="attendanceDate"
          header="Date"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="text-sm text-[color:var(--ot-text)]"
            >
              {{ formatDateDMY(data.attendanceDate) }}
            </span>
          </template>
        </Column>

        <Column header="Employee">
          <template #body="{ data }">
            <div
              v-if="data"
              class="employee-cell"
            >
              <span class="font-medium text-[color:var(--ot-text)]">
                {{ formatEmployee(data) }}
              </span>

              <span
                v-if="shouldShowImportedEmployee(data)"
                class="text-xs text-[color:var(--ot-text-muted)]"
              >
                Imported: {{ formatImportedEmployee(data) }}
              </span>
            </div>
          </template>
        </Column>

        <Column header="Shift">
          <template #body="{ data }">
            <div
              v-if="data"
              class="shift-cell"
            >
              <span class="font-medium text-[color:var(--ot-text)]">
                {{ formatShift(data) }}
              </span>

              <span class="text-xs text-[color:var(--ot-text-muted)]">
                {{ formatShiftTime(data) }}
              </span>
            </div>
          </template>
        </Column>

        <Column header="Scan In">
          <template #body="{ data }">
            <span
              v-if="data"
              class="scan-time-chip"
              :class="scanTimeTone(displayTime(data.clockIn))"
            >
              {{ scanTimeLabel(displayTime(data.clockIn)) }}
            </span>
          </template>
        </Column>

        <Column header="Scan Out">
          <template #body="{ data }">
            <span
              v-if="data"
              class="scan-time-chip"
              :class="scanTimeTone(displayTime(data.clockOut))"
            >
              {{ scanTimeLabel(displayTime(data.clockOut)) }}
            </span>
          </template>
        </Column>

        <Column
          field="importedStatus"
          header="Imported Status"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="statusLabel(data.importedStatus)"
              :severity="statusSeverity(data.importedStatus)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column
          field="status"
          header="Derived Status"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="statusLabel(data.status)"
              :severity="statusSeverity(data.status)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column
          field="dayType"
          header="Day Type"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="dayTypeLabel(data.dayType)"
              :severity="dayTypeSeverity(data.dayType)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column
          field="shiftMatchStatus"
          header="Shift Match"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="shiftMatchLabel(data.shiftMatchStatus)"
              :severity="shiftMatchSeverity(data.shiftMatchStatus)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column
          field="workedMinutes"
          header="Worked"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="minute-chip"
              :class="minuteTone(data.workedMinutes)"
            >
              {{ formatMinutes(data.workedMinutes) }}
            </span>
          </template>
        </Column>

        <Column
          field="lateMinutes"
          header="Late"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="minute-chip"
              :class="minuteTone(data.lateMinutes, 'late')"
            >
              {{ formatMinutes(data.lateMinutes) }}
            </span>
          </template>
        </Column>

        <Column
          field="earlyOutMinutes"
          header="Early Out"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="minute-chip"
              :class="minuteTone(data.earlyOutMinutes, 'early')"
            >
              {{ formatMinutes(data.earlyOutMinutes) }}
            </span>
          </template>
        </Column>

        <Column header="Import">
          <template #body="{ data }">
            <span
              v-if="data"
              class="text-sm text-[color:var(--ot-text-muted)]"
            >
              {{ formatImportNo(data) }}
            </span>
          </template>
        </Column>

        <Column header="Issues">
          <template #body="{ data }">
            <div
              v-if="data"
              class="issues-cell line-clamp-2 text-sm text-[color:var(--ot-text-muted)]"
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
    </section>
  </div>
</template>

<style scoped>
.attendance-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.attendance-main-filter-row {
  display: grid;
  grid-template-columns:
    minmax(260px, 1.4fr)
    minmax(130px, 0.7fr)
    minmax(150px, 0.8fr)
    minmax(150px, 0.8fr)
    minmax(145px, 0.78fr)
    minmax(130px, 0.7fr);
  gap: 0.5rem;
  align-items: center;
}

.attendance-date-action-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.05rem;
}

.filter-search {
  min-width: 0;
}

.date-filter-control {
  width: 160px;
  min-width: 160px;
}

.loaded-chip {
  display: inline-flex;
  min-width: 120px;
  min-height: 2.15rem;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-radius: 0.65rem;
  border: 1px solid var(--ot-border);
  padding: 0 0.75rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.date-action-button {
  min-width: max-content;
  height: 2.15rem;
  white-space: nowrap;
}

:deep(.attendance-records-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.attendance-records-table .p-datatable-thead > tr > th) {
  width: auto !important;
  padding: 0.64rem 0.75rem !important;
  white-space: nowrap !important;
}

:deep(.attendance-records-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  height: 72px !important;
  padding: 0.54rem 0.75rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

:deep(.attendance-records-table .p-tag.attendance-tag) {
  min-height: 1.3rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

.employee-cell,
.shift-cell {
  display: inline-flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.12rem;
  white-space: nowrap;
}

.scan-time-chip,
.minute-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.18rem 0.52rem;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.scan-time-chip.is-complete {
  background: color-mix(in srgb, #22c55e 11%, transparent);
  color: #15803d;
}

.scan-time-chip.is-missing {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #b91c1c;
}

.minute-chip.is-normal {
  background: color-mix(in srgb, #22c55e 11%, transparent);
  color: #15803d;
}

.minute-chip.is-warning {
  background: color-mix(in srgb, #f59e0b 16%, transparent);
  color: #b45309;
}

.minute-chip.is-zero {
  background: color-mix(in srgb, #64748b 11%, transparent);
  color: #475569;
}

:global(.dark) .scan-time-chip.is-complete,
:global(.dark) .scan-time-chip.is-missing,
:global(.dark) .minute-chip.is-normal,
:global(.dark) .minute-chip.is-warning,
:global(.dark) .minute-chip.is-zero {
  color: var(--ot-text);
}

.issues-cell {
  max-width: clamp(16rem, 32vw, 34rem);
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 1280px) {
  .attendance-main-filter-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .filter-search {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .attendance-main-filter-row {
    grid-template-columns: 1fr 1fr;
  }

  .filter-search {
    grid-column: span 2;
  }

  :deep(.attendance-records-table .p-datatable-tbody > tr > td) {
    height: 68px !important;
  }
}

@media (max-width: 520px) {
  .attendance-main-filter-row {
    grid-template-columns: 1fr;
  }

  .filter-search {
    grid-column: span 1;
  }
}
</style>