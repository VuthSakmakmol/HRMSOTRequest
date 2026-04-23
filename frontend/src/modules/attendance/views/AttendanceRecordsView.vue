<!-- frontend/src/modules/attendance/views/AttendanceRecordsView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
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
const SEARCH_DEBOUNCE_MS = 300

const loading = ref(false)
const rows = ref([])
const totalRecords = ref(0)

const filters = reactive({
  search: '',
  employeeNo: '',
  status: '',
  importedStatus: '',
  shiftMatchStatus: '',
  dayType: '',
  attendanceDateFrom: null,
  attendanceDateTo: null,
  page: 1,
  limit: PAGE_SIZE,
  sortField: 'attendanceDate',
  sortOrder: -1,
})

let searchTimer = null

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

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
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

function buildQuery() {
  return {
    page: filters.page,
    limit: filters.limit,
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

function formatIssues(value) {
  if (Array.isArray(value) && value.length) return value.join(', ')
  return ''
}

async function fetchAttendanceRecords() {
  loading.value = true

  try {
    const res = await getAttendanceRecords(buildQuery())
    const payload = normalizePayload(res)

    rows.value = Array.isArray(payload?.items) ? payload.items : []
    totalRecords.value = Number(payload?.pagination?.total || 0)
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
    loading.value = false
  }
}

function onSearchInput() {
  filters.page = 1

  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    fetchAttendanceRecords()
  }, SEARCH_DEBOUNCE_MS)
}

function onPage(event) {
  filters.page = Math.floor(Number(event.first || 0) / Number(event.rows || PAGE_SIZE)) + 1
  filters.limit = Number(event.rows || PAGE_SIZE)
  fetchAttendanceRecords()
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
  }

  filters.sortField = fieldMap[event.sortField] || 'attendanceDate'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : -1
  filters.page = 1
  fetchAttendanceRecords()
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
  filters.page = 1
  filters.limit = PAGE_SIZE
  filters.sortField = 'attendanceDate'
  filters.sortOrder = -1
  fetchAttendanceRecords()
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
    filters.page = 1
    fetchAttendanceRecords()
  },
)

watch(
  () => filters.employeeNo,
  () => {
    filters.page = 1

    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      fetchAttendanceRecords()
    }, SEARCH_DEBOUNCE_MS)
  },
)

onMounted(() => {
  fetchAttendanceRecords()
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Attendance Records
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Review backend-derived attendance results, imported status, shift matching, and worked minutes.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Total
          </div>
          <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
            {{ totalRows }}
          </div>
        </div>

        <Button
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="loading"
          @click="fetchAttendanceRecords"
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

    <Card class="attendance-records-card">
      <template #content>
        <div class="flex flex-col gap-4">
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

          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <DatePicker
              v-model="filters.attendanceDateFrom"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="Attendance Date From"
            />

            <DatePicker
              v-model="filters.attendanceDateTo"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="Attendance Date To"
            />
          </div>

          <DataTable
            :value="rows"
            lazy
            paginator
            removableSort
            :rows="filters.limit"
            :first="(filters.page - 1) * filters.limit"
            :totalRecords="totalRecords"
            :rowsPerPageOptions="[10, 20, 50]"
            responsiveLayout="scroll"
            scrollable
            tableStyle="min-width: 120rem"
            class="attendance-records-table"
            @page="onPage"
            @sort="onSort"
          >
            <template #empty>
              <div class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]">
                No attendance records found.
              </div>
            </template>

            <Column field="attendanceDate" header="Date" sortable style="min-width: 9rem" />

            <Column header="Employee" style="min-width: 16rem">
              <template #body="{ data }">
                <div class="font-medium text-[color:var(--ot-text)]">
                  {{ formatEmployee(data) }}
                </div>
              </template>
            </Column>

            <Column header="Imported Employee" style="min-width: 16rem">
              <template #body="{ data }">
                <div class="text-sm text-[color:var(--ot-text-muted)]">
                  {{ formatImportedEmployee(data) }}
                </div>
              </template>
            </Column>

            <Column field="clockIn" header="Clock In" style="min-width: 7rem" />
            <Column field="clockOut" header="Clock Out" style="min-width: 7rem" />

            <Column field="importedStatus" header="Imported Status" sortable style="min-width: 10rem">
              <template #body="{ data }">
                <Tag
                  :value="data.importedStatus || '-'"
                  :severity="statusSeverity(data.importedStatus)"
                />
              </template>
            </Column>

            <Column field="status" header="Derived Status" sortable style="min-width: 10rem">
              <template #body="{ data }">
                <Tag
                  :value="data.status || '-'"
                  :severity="statusSeverity(data.status)"
                />
              </template>
            </Column>

            <Column field="dayType" header="Day Type" sortable style="min-width: 9rem">
              <template #body="{ data }">
                <Tag
                  :value="data.dayType || '-'"
                  :severity="dayTypeSeverity(data.dayType)"
                />
              </template>
            </Column>

            <Column header="Shift" style="min-width: 12rem">
              <template #body="{ data }">
                {{ formatShift(data) }}
              </template>
            </Column>

            <Column field="shiftMatchStatus" header="Shift Status" sortable style="min-width: 10rem">
              <template #body="{ data }">
                <Tag
                  :value="data.shiftMatchStatus || 'UNKNOWN'"
                  :severity="shiftMatchSeverity(data.shiftMatchStatus)"
                />
              </template>
            </Column>

            <Column field="workedMinutes" header="Worked" sortable style="min-width: 7rem">
              <template #body="{ data }">
                {{ Number(data.workedMinutes || 0) }}
              </template>
            </Column>

            <Column field="lateMinutes" header="Late" sortable style="min-width: 7rem">
              <template #body="{ data }">
                {{ Number(data.lateMinutes || 0) }}
              </template>
            </Column>

            <Column field="earlyOutMinutes" header="Early Out" sortable style="min-width: 8rem">
              <template #body="{ data }">
                {{ Number(data.earlyOutMinutes || 0) }}
              </template>
            </Column>

            <Column header="Reason" style="min-width: 20rem">
              <template #body="{ data }">
                <div class="space-y-1">
                  <div class="text-xs text-[color:var(--ot-text-muted)]">
                    {{ data.derivedStatusReason || '-' }}
                  </div>
                  <div
                    v-if="formatIssues(data.validationIssues)"
                    class="text-[11px] text-amber-600 dark:text-amber-400"
                  >
                    {{ formatIssues(data.validationIssues) }}
                  </div>
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
:deep(.attendance-records-card .p-card-body) {
  padding: 1rem !important;
}

:deep(.attendance-records-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.attendance-records-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  vertical-align: middle !important;
}
</style>