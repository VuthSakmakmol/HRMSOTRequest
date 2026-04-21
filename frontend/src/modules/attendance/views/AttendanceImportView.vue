<!-- frontend/src/modules/attendance/views/AttendanceImportView.vue -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'

import { useAuthStore } from '@/modules/auth/auth.store'
import AttendanceImportDialog from '@/modules/attendance/components/AttendanceImportDialog.vue'
import {
  getAttendanceImportById,
  getAttendanceImports,
} from '@/modules/attendance/attendance.api'

const toast = useToast()
const auth = useAuthStore()

const loading = ref(false)
const detailLoading = ref(false)
const importDialogVisible = ref(false)

const imports = ref([])
const totalRecords = ref(0)

const selectedImportDetail = ref(null)
const detailVisible = ref(false)
const latestImportResult = ref(null)

const filters = reactive({
  search: '',
  status: '',
  periodFrom: '',
  periodTo: '',
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Partial Success', value: 'PARTIAL_SUCCESS' },
  { label: 'Failed', value: 'FAILED' },
]

const rowsPerPageOptions = [10, 20, 50, 100]

const first = computed(() => (filters.page - 1) * filters.limit)

const failedRowsPreview = computed(() => {
  return Array.isArray(latestImportResult.value?.failedRows)
    ? latestImportResult.value.failedRows.slice(0, 8)
    : []
})

const canImportAttendance = computed(() => {
  if (auth.isRootAdmin) return true
  return auth.hasAnyPermission?.(['ATTENDANCE_IMPORT']) ?? false
})

let searchTimer = null

function normalizePayload(res) {
  return res?.data?.data || res?.data || null
}

function formatDateTime(value) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(value)
  }
}

function formatPeriod(row) {
  const from = String(row?.periodFrom || '').trim()
  const to = String(row?.periodTo || '').trim()

  if (from && to) return `${from} → ${to}`
  if (from) return from
  if (to) return to
  return '—'
}

function formatIssues(value) {
  if (Array.isArray(value) && value.length) return value.join(', ')
  return '—'
}

function getImportStatusSeverity(status) {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCESS':
      return 'success'
    case 'PARTIAL_SUCCESS':
      return 'warning'
    case 'FAILED':
      return 'danger'
    case 'PROCESSING':
      return 'info'
    default:
      return 'secondary'
  }
}

function getMatchSeverity(value) {
  if (value === true) return 'success'
  if (value === false) return 'danger'
  return 'secondary'
}

function getShiftStatusSeverity(value) {
  switch (String(value || '').toUpperCase()) {
    case 'MATCHED':
      return 'success'
    case 'MISMATCH':
      return 'danger'
    default:
      return 'secondary'
  }
}

function displayResolvedEmployee(row) {
  const code = String(row?.employeeNo || '').trim()
  const name = String(row?.employeeName || '').trim()

  if (code && name) return `${code} - ${name}`
  if (code) return code
  if (name) return name
  return '—'
}

function displayShift(row) {
  const code = String(row?.shiftCode || '').trim()
  const name = String(row?.shiftName || '').trim()

  if (code && name) return `${code} - ${name}`
  if (code) return code
  if (name) return name
  return '—'
}

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.periodFrom = ''
  filters.periodTo = ''
  filters.page = 1
  filters.limit = 10
  filters.sortBy = 'createdAt'
  filters.sortOrder = 'desc'
  fetchImports()
}

async function fetchImports() {
  loading.value = true

  try {
    const response = await getAttendanceImports({
      page: filters.page,
      limit: filters.limit,
      search: filters.search || undefined,
      status: filters.status || undefined,
      periodFrom: filters.periodFrom || undefined,
      periodTo: filters.periodTo || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    const payload = normalizePayload(response) || {}

    imports.value = Array.isArray(payload.items) ? payload.items : []
    totalRecords.value = Number(payload.pagination?.total || 0)
  } catch (error) {
    console.error(error)
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail: error?.response?.data?.message || 'Unable to load attendance imports',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

async function openImportDetail(row) {
  if (!row?.id) return

  detailVisible.value = true
  detailLoading.value = true
  selectedImportDetail.value = null

  try {
    const response = await getAttendanceImportById(row.id)
    selectedImportDetail.value = normalizePayload(response)
  } catch (error) {
    console.error(error)
    toast.add({
      severity: 'error',
      summary: 'Detail failed',
      detail: error?.response?.data?.message || 'Unable to load attendance import detail',
      life: 3000,
    })
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

async function handleImportSuccess(payload) {
  latestImportResult.value = normalizePayload(payload)
  filters.page = 1
  await fetchImports()
}

function onPage(event) {
  filters.page = Math.floor(event.first / event.rows) + 1
  filters.limit = event.rows
  fetchImports()
}

function onSort(event) {
  filters.sortBy = event.sortField || 'createdAt'
  filters.sortOrder = event.sortOrder === 1 ? 'asc' : 'desc'
  filters.page = 1
  fetchImports()
}

watch(
  () => filters.status,
  () => {
    filters.page = 1
    fetchImports()
  },
)

watch(
  () => [filters.periodFrom, filters.periodTo],
  () => {
    filters.page = 1
    fetchImports()
  },
)

watch(
  () => filters.search,
  () => {
    filters.page = 1
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      fetchImports()
    }, 400)
  },
)

onMounted(() => {
  fetchImports()
})
</script>

<template>
  <div class="flex flex-col gap-4 p-3 md:p-4">
    <section
      class="overflow-hidden rounded-3xl border border-[color:var(--ot-border)] bg-gradient-to-r from-sky-50 via-white to-emerald-50 shadow-sm dark:from-surface-900 dark:via-surface-900 dark:to-surface-800"
    >
      <div class="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <span
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-sky-600 shadow-sm ring-1 ring-black/5 dark:bg-surface-800 dark:text-sky-400"
            >
              <i class="pi pi-upload text-base" />
            </span>

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-semibold tracking-tight text-[color:var(--ot-text)]">
                  Attendance Import
                </h1>
                <Tag value="Attendance" severity="info" rounded />
              </div>

              <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
                Import attendance files with sample guidance, review history, and inspect validation results.
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            v-if="canImportAttendance"
            label="Import Attendance"
            icon="pi pi-upload"
            size="small"
            @click="importDialogVisible = true"
          />
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            outlined
            size="small"
            :loading="loading"
            @click="fetchImports"
          />
          <Button
            label="Clear Filters"
            icon="pi pi-filter-slash"
            severity="secondary"
            outlined
            size="small"
            @click="clearFilters"
          />
        </div>
      </div>
    </section>

    <Card
      v-if="latestImportResult"
      class="compact-card rounded-3xl border border-emerald-200 shadow-sm dark:border-emerald-800"
    >
      <template #title>
        <div class="flex items-center gap-2 text-base">
          <i class="pi pi-check-circle text-emerald-500" />
          <span>Latest Import Result</span>
        </div>
      </template>

      <template #content>
        <div class="flex flex-col gap-3">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="attendance-metric-box">
              <div class="attendance-metric-label">Import No</div>
              <div class="attendance-metric-value">
                {{ latestImportResult.import?.importNo || '—' }}
              </div>
            </div>

            <div class="attendance-metric-box">
              <div class="attendance-metric-label">Status</div>
              <div class="mt-1">
                <Tag
                  :value="latestImportResult.import?.status || '—'"
                  :severity="getImportStatusSeverity(latestImportResult.import?.status)"
                />
              </div>
            </div>

            <div class="attendance-metric-box">
              <div class="attendance-metric-label">Sheet</div>
              <div class="attendance-metric-value">
                {{ latestImportResult.sheetName || '—' }}
              </div>
            </div>

            <div class="attendance-metric-box">
              <div class="attendance-metric-label">Failed Rows</div>
              <div class="attendance-metric-value">
                {{ latestImportResult.import?.failedRowCount || 0 }}
              </div>
            </div>
          </div>

          <div
            v-if="failedRowsPreview.length"
            class="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
              Failed Row Preview
            </div>

            <div class="grid gap-2 md:grid-cols-2">
              <div
                v-for="row in failedRowsPreview"
                :key="`${row.rawRowNo}-${row.message}`"
                class="rounded-xl bg-white px-3 py-2 text-sm dark:bg-surface-900"
              >
                <div class="font-semibold">Row {{ row.rawRowNo }}</div>
                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ row.message }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card class="compact-card rounded-3xl shadow-sm">
      <template #title>
        <div class="flex items-center gap-2 text-base">
          <i class="pi pi-history text-sky-500" />
          <span>Import History</span>
        </div>
      </template>

      <template #content>
        <div class="flex flex-col gap-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr),180px,160px,160px]">
            <InputText
              v-model="filters.search"
              placeholder="Search import no, file name, remark..."
              class="w-full"
            />

            <Dropdown
              v-model="filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
            />

            <input
              v-model="filters.periodFrom"
              type="date"
              class="h-10 rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 text-sm text-[color:var(--ot-text)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
            >

            <input
              v-model="filters.periodTo"
              type="date"
              class="h-10 rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 text-sm text-[color:var(--ot-text)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
            >
          </div>

          <DataTable
            :value="imports"
            dataKey="id"
            lazy
            paginator
            size="small"
            :rows="filters.limit"
            :first="first"
            :totalRecords="totalRecords"
            :rowsPerPageOptions="rowsPerPageOptions"
            :loading="loading"
            removableSort
            sortMode="single"
            :sortField="filters.sortBy"
            :sortOrder="filters.sortOrder === 'asc' ? 1 : -1"
            responsiveLayout="scroll"
            stripedRows
            class="attendance-table"
            @page="onPage"
            @sort="onSort"
          >
            <template #empty>
              <div class="py-8 text-center text-sm text-[color:var(--ot-text-muted)]">
                No attendance imports found.
              </div>
            </template>

            <Column field="importNo" header="Import No" sortable style="min-width: 11rem" />

            <Column field="fileName" header="File Name" sortable style="min-width: 14rem">
              <template #body="{ data }">
                <div class="min-w-0">
                  <div class="truncate font-medium text-[color:var(--ot-text)]">
                    {{ data.fileName || '—' }}
                  </div>
                </div>
              </template>
            </Column>

            <Column header="Period" style="min-width: 11rem">
              <template #body="{ data }">
                <span class="text-sm">{{ formatPeriod(data) }}</span>
              </template>
            </Column>

            <Column header="Rows" style="min-width: 16rem">
              <template #body="{ data }">
                <div class="flex flex-wrap gap-1.5">
                  <Tag :value="`T ${Number(data?.rowCount || 0)}`" severity="secondary" />
                  <Tag :value="`S ${Number(data?.successRowCount || 0)}`" severity="success" />
                  <Tag :value="`F ${Number(data?.failedRowCount || 0)}`" severity="warning" />
                  <Tag :value="`D ${Number(data?.duplicateRowCount || 0)}`" severity="info" />
                </div>
              </template>
            </Column>

            <Column field="status" header="Status" sortable style="min-width: 9rem">
              <template #body="{ data }">
                <Tag
                  :value="data.status"
                  :severity="getImportStatusSeverity(data.status)"
                />
              </template>
            </Column>

            <Column field="createdAt" header="Created" sortable style="min-width: 12rem">
              <template #body="{ data }">
                <span class="text-sm">{{ formatDateTime(data.createdAt) }}</span>
              </template>
            </Column>

            <Column header="Action" style="width: 7rem; min-width: 7rem">
              <template #body="{ data }">
                <Button
                  label="View"
                  icon="pi pi-eye"
                  text
                  size="small"
                  @click="openImportDetail(data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="detailVisible"
      modal
      maximizable
      :style="{ width: '96vw', maxWidth: '1280px' }"
      header="Attendance Import Detail"
    >
      <div v-if="detailLoading" class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]">
        Loading import detail...
      </div>

      <div v-else-if="selectedImportDetail" class="flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="attendance-metric-box">
            <div class="attendance-metric-label">Import No</div>
            <div class="attendance-metric-value">{{ selectedImportDetail.importNo }}</div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">Status</div>
            <div class="mt-1">
              <Tag
                :value="selectedImportDetail.status"
                :severity="getImportStatusSeverity(selectedImportDetail.status)"
              />
            </div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">Period</div>
            <div class="attendance-metric-value">{{ formatPeriod(selectedImportDetail) }}</div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">File Name</div>
            <div class="attendance-metric-value break-all">{{ selectedImportDetail.fileName }}</div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="attendance-stat-box">
            <div class="attendance-stat-label">Total Rows</div>
            <div class="attendance-stat-value">{{ selectedImportDetail.rowCount || 0 }}</div>
          </div>

          <div class="attendance-stat-box border-emerald-200 dark:border-emerald-800">
            <div class="attendance-stat-label">Success Rows</div>
            <div class="attendance-stat-value text-emerald-600 dark:text-emerald-400">
              {{ selectedImportDetail.successRowCount || 0 }}
            </div>
          </div>

          <div class="attendance-stat-box border-amber-200 dark:border-amber-800">
            <div class="attendance-stat-label">Failed Rows</div>
            <div class="attendance-stat-value text-amber-600 dark:text-amber-400">
              {{ selectedImportDetail.failedRowCount || 0 }}
            </div>
          </div>

          <div class="attendance-stat-box border-sky-200 dark:border-sky-800">
            <div class="attendance-stat-label">Duplicate Rows</div>
            <div class="attendance-stat-value text-sky-600 dark:text-sky-400">
              {{ selectedImportDetail.duplicateRowCount || 0 }}
            </div>
          </div>
        </div>

        <Card class="compact-card rounded-3xl shadow-sm">
          <template #title>
            <div class="flex items-center gap-2 text-base">
              <i class="pi pi-table text-sky-500" />
              <span>Imported Row Preview</span>
            </div>
          </template>

          <template #content>
            <DataTable
              :value="selectedImportDetail.previewRecords || []"
              dataKey="id"
              responsiveLayout="scroll"
              stripedRows
              size="small"
              class="attendance-table"
            >
              <template #empty>
                <div class="py-8 text-center text-sm text-[color:var(--ot-text-muted)]">
                  No preview records found.
                </div>
              </template>

              <Column field="rawRowNo" header="Row" style="min-width: 5rem" />
              <Column field="importedEmployeeId" header="Imported ID" style="min-width: 9rem" />
              <Column field="importedEmployeeName" header="Imported Name" style="min-width: 12rem" />
              <Column field="attendanceDate" header="Date" style="min-width: 9rem" />
              <Column field="clockIn" header="In" style="min-width: 6rem" />
              <Column field="clockOut" header="Out" style="min-width: 6rem" />
              <Column field="status" header="Status" style="min-width: 8rem">
                <template #body="{ data }">
                  <Tag :value="data.status || '—'" />
                </template>
              </Column>
              <Column field="importedDepartmentName" header="Imported Department" style="min-width: 11rem" />
              <Column field="importedPositionName" header="Imported Position" style="min-width: 11rem" />
              <Column field="importedShiftName" header="Imported Shift" style="min-width: 10rem" />
              <Column header="Resolved Employee" style="min-width: 13rem">
                <template #body="{ data }">
                  {{ displayResolvedEmployee(data) }}
                </template>
              </Column>
              <Column header="Matched" style="min-width: 8rem">
                <template #body="{ data }">
                  <Tag
                    :value="data.employeeMatched ? 'MATCHED' : 'NOT FOUND'"
                    :severity="getMatchSeverity(data.employeeMatched)"
                  />
                </template>
              </Column>
              <Column header="Shift" style="min-width: 10rem">
                <template #body="{ data }">
                  {{ displayShift(data) }}
                </template>
              </Column>
              <Column field="shiftMatchStatus" header="Shift Status" style="min-width: 9rem">
                <template #body="{ data }">
                  <Tag
                    :value="data.shiftMatchStatus || 'UNKNOWN'"
                    :severity="getShiftStatusSeverity(data.shiftMatchStatus)"
                  />
                </template>
              </Column>
              <Column header="Issues" style="min-width: 18rem">
                <template #body="{ data }">
                  <span class="text-xs text-[color:var(--ot-text-muted)]">
                    {{ formatIssues(data.validationIssues) }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>
    </Dialog>

    <AttendanceImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />
  </div>
</template>

<style scoped>
:deep(.compact-card .p-card-body) {
  padding: 0.95rem !important;
}

:deep(.compact-card .p-card-title) {
  font-size: 1rem !important;
  font-weight: 700 !important;
}

:deep(.attendance-table .p-datatable-thead > tr > th) {
  padding: 0.65rem 0.75rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

:deep(.attendance-table .p-datatable-tbody > tr > td) {
  padding: 0.65rem 0.75rem !important;
  vertical-align: middle !important;
}

.attendance-metric-box {
  border: 1px solid var(--ot-border);
  background: var(--ot-bg);
  border-radius: 1rem;
  padding: 0.9rem;
}

.attendance-metric-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.attendance-metric-value {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ot-text);
  word-break: break-word;
}

.attendance-stat-box {
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  border-radius: 1rem;
  padding: 0.95rem;
}

.attendance-stat-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.attendance-stat-value {
  margin-top: 0.4rem;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--ot-text);
}

@media (max-width: 640px) {
  :deep(.compact-card .p-card-body) {
    padding: 0.8rem !important;
  }

  .attendance-metric-box,
  .attendance-stat-box {
    padding: 0.8rem;
  }
}
</style>