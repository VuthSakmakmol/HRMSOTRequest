<!-- frontend/src/modules/attendance/views/AttendanceImportView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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

import AttendanceImportDialog from '@/modules/attendance/components/AttendanceImportDialog.vue'
import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { useAuthStore } from '@/modules/auth/auth.store'
import { getAttendanceImports } from '@/modules/attendance/attendance.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate, formatDateTime } from '@/shared/utils/dateFormat'

const toast = useToast()
const auth = useAuthStore()
const { t } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const importDialogVisible = ref(false)
const latestImportResult = ref(null)

const filters = reactive({
  search: '',
  status: '',
  periodFrom: '',
  periodTo: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('attendance.statusLabel.processing'), value: 'PROCESSING' },
  { label: t('attendance.statusLabel.success'), value: 'SUCCESS' },
  { label: t('attendance.statusLabel.partialSuccess'), value: 'PARTIAL_SUCCESS' },
  { label: t('attendance.statusLabel.failed'), value: 'FAILED' },
])

const totalImports = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalImports.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalImports.value,
  }),
)

const canImportAttendance = computed(() => {
  if (auth.user?.isRootAdmin || auth.isRootAdmin) return true
  if (auth.hasPermission?.('ATTENDANCE_IMPORT')) return true
  return auth.hasAnyPermission?.(['ATTENDANCE_IMPORT']) ?? false
})

const latestImportInfo = computed(() => {
  return (
    latestImportResult.value?.import ||
    latestImportResult.value?.item ||
    latestImportResult.value ||
    null
  )
})

const latestFailedRowsPreview = computed(() => {
  const failedRows =
    latestImportResult.value?.failedRows ||
    latestImportResult.value?.failedRowPreview ||
    latestImportResult.value?.errors ||
    []

  return Array.isArray(failedRows) ? failedRows.slice(0, 8) : []
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function formatDateDMY(value) {
  return formatDate(value) || '—'
}

function formatPeriod(row) {
  const from = s(row?.periodFrom)
  const to = s(row?.periodTo)

  if (from && to && from !== to) {
    return `${formatDateDMY(from)} → ${formatDateDMY(to)}`
  }

  if (from) return formatDateDMY(from)
  if (to) return formatDateDMY(to)

  return '—'
}

function formatIssues(value) {
  if (Array.isArray(value) && value.length) return value.join(', ')
  if (typeof value === 'string' && value.trim()) return value.trim()
  return '—'
}

function getImportStatusSeverity(status) {
  const normalized = upper(status)

  if (normalized === 'SUCCESS') return 'success'
  if (normalized === 'PARTIAL_SUCCESS') return 'warning'
  if (normalized === 'FAILED') return 'danger'
  if (normalized === 'PROCESSING') return 'info'

  return 'secondary'
}

function formatImportStatusLabel(status) {
  const normalized = upper(status)

  const labels = {
    PROCESSING: t('attendance.statusLabel.processing'),
    SUCCESS: t('attendance.statusLabel.success'),
    PARTIAL_SUCCESS: t('attendance.statusLabel.partialSuccess'),
    FAILED: t('attendance.statusLabel.failed'),
  }

  return labels[normalized] || normalized || '-'
}

function formatImportNo(row) {
  return s(row?.importNo || row?.attendanceImportNo) || '—'
}

function formatFileName(row) {
  return s(row?.fileName) || '—'
}

function rowCount(row, field) {
  return Number(row?.[field] || 0)
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
    status: filters.status || undefined,
    periodFrom: s(filters.periodFrom) || undefined,
    periodTo: s(filters.periodTo) || undefined,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getAttendanceImports(buildQuery(page))

    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
    const total = normalizeTotal(payload)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value = new Set([page])
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

    showToast(
      'error',
      t('attendance.message.loadFailed'),
      getApiErrorMessage(error, t('attendance.import.noImports')),
    )
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
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
    importNo: 'importNo',
    fileName: 'fileName',
    status: 'status',
    createdAt: 'createdAt',
    importedAt: 'importedAt',
    rowCount: 'rowCount',
    successRowCount: 'successRowCount',
    failedRowCount: 'failedRowCount',
    duplicateRowCount: 'duplicateRowCount',
  }

  filters.sortField = fieldMap[event.sortField] || 'createdAt'
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
  filters.status = ''
  filters.periodFrom = ''
  filters.periodTo = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function refresh() {
  reloadFirstPage({ keepVisible: true })
}

function onImportSuccess(payload) {
  latestImportResult.value = payload

  const info =
    payload?.import ||
    payload?.item ||
    payload ||
    null

  showToast(
    'success',
    t('attendance.importDialog.importCompleted'),
    info?.status === 'PARTIAL_SUCCESS'
      ? t('attendance.importDialog.importCompletedPartial')
      : t('attendance.importDialog.importCompletedSuccess'),
    3500,
  )

  reloadFirstPage({ keepVisible: false })
}

watch(
  () => [filters.status, filters.periodFrom, filters.periodTo],
  () => {
    onFilterChange()
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
  <div class="ot-page-shell attendance-import-page">
    <section
      v-if="latestImportInfo"
      class="ot-table-card"
    >
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('attendance.import.latestImportResult') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <Tag
            :value="formatImportStatusLabel(latestImportInfo.status)"
            :severity="getImportStatusSeverity(latestImportInfo.status)"
          />
        </div>
      </div>

      <div class="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="ot-panel">
          <div class="ot-field-label">
            {{ t('attendance.field.importNo') }}
          </div>

          <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
            {{ latestImportInfo.importNo || '—' }}
          </div>
        </div>

        <div class="ot-panel">
          <div class="ot-field-label">
            {{ t('attendance.field.totalRows') }}
          </div>

          <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
            {{ Number(latestImportInfo.rowCount || 0) }}
          </div>
        </div>

        <div class="ot-panel">
          <div class="ot-field-label">
            {{ t('attendance.field.successRows') }}
          </div>

          <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
            {{ Number(latestImportInfo.successRowCount || 0) }}
          </div>
        </div>

        <div class="ot-panel">
          <div class="ot-field-label">
            {{ t('attendance.field.failedRows') }}
          </div>

          <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
            {{ Number(latestImportInfo.failedRowCount || 0) }}
          </div>
        </div>

        <div class="ot-panel">
          <div class="ot-field-label">
            {{ t('attendance.field.duplicateRows') }}
          </div>

          <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
            {{ Number(latestImportInfo.duplicateRowCount || 0) }}
          </div>
        </div>
      </div>

      <div
        v-if="latestFailedRowsPreview.length"
        class="border-t border-[color:var(--ot-border)] p-3"
      >
        <div class="mb-2 text-sm font-semibold text-[color:var(--ot-text)]">
          {{ t('attendance.import.failedRowPreview') }}
        </div>

        <div class="grid gap-2 md:grid-cols-2">
          <div
            v-for="row in latestFailedRowsPreview"
            :key="`${row.rawRowNo || row.rowNo || row.row || ''}-${row.message || row.reason || ''}`"
            class="ot-panel"
          >
            <div class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('attendance.field.row') }} {{ row.rawRowNo || row.rowNo || row.row || '—' }}
            </div>

            <div class="mt-1 text-xs leading-5 text-[color:var(--ot-text-muted)]">
              {{ row.message || row.reason || formatIssues(row.issues) }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ot-filter-bar attendance-import-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('attendance.field.searchImportPlaceholder')"
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
          :placeholder="t('common.allStatus')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.periodFrom"
          :label="t('attendance.field.periodFrom')"
          :placeholder="t('attendance.field.periodFrom')"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.periodTo"
          :label="t('attendance.field.periodTo')"
          :placeholder="t('attendance.field.periodTo')"
        />
      </div>

      <div class="attendance-import-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearFilters"
        />

        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="backgroundLoading"
          @click="refresh"
        />

        <Button
          v-if="canImportAttendance"
          :label="t('attendance.import.importAttendance')"
          icon="pi pi-upload"
          size="small"
          @click="importDialogVisible = true"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('attendance.import.importHistory') }}
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

      <div class="ot-table-wrapper">
        <AppTableLoading
          v-if="isFirstLoading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="7"
          :columns="6"
          icon="pi pi-upload"
        />

        <DataTable
          v-else
          :value="rows"
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortField"
          :sort-order="filters.sortOrder"
          table-style="min-width: 86rem"
          class="ot-data-table ot-data-table-compact"
          :virtual-scroller-options="useVirtualScroll ? {
            lazy: true,
            onLazyLoad: onVirtualLazyLoad,
            itemSize: 72,
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
                <i class="pi pi-upload" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('attendance.import.noImports') }}
              </div>
            </div>
          </template>

          <Column
            field="importNo"
            :header="t('attendance.field.importNo')"
            sortable
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-bold text-[color:var(--ot-text)]"
              >
                {{ formatImportNo(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="fileName"
            :header="t('attendance.field.fileName')"
            sortable
            style="min-width: 18rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex min-w-0 items-center gap-2"
                :title="formatFileName(data)"
              >
                <i class="pi pi-file-excel text-emerald-500" />

                <span class="truncate">
                  {{ formatFileName(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.period')"
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ formatPeriod(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.rows')"
            style="min-width: 24rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="attendance-row-tags"
              >
                <Tag
                  :value="`${t('attendance.field.totalRows')} ${rowCount(data, 'rowCount')}`"
                  class="attendance-row-tag attendance-row-tag-total"
                />

                <Tag
                  :value="`${t('attendance.field.successRows')} ${rowCount(data, 'successRowCount')}`"
                  class="attendance-row-tag attendance-row-tag-success"
                />

                <Tag
                  :value="`${t('attendance.field.failedRows')} ${rowCount(data, 'failedRowCount')}`"
                  class="attendance-row-tag attendance-row-tag-failed"
                />

                <Tag
                  :value="`${t('attendance.field.duplicateRows')} ${rowCount(data, 'duplicateRowCount')}`"
                  class="attendance-row-tag attendance-row-tag-duplicate"
                />
              </div>
            </template>
          </Column>

          <Column
            field="status"
            :header="t('common.status')"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="formatImportStatusLabel(data.status)"
                :severity="getImportStatusSeverity(data.status)"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('attendance.field.importedAt')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ formatDateTime(data.importedAt || data.createdAt) }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <AttendanceImportDialog
      v-model:visible="importDialogVisible"
      @success="onImportSuccess"
    />
  </div>
</template>

<style scoped>
.attendance-import-page {
  --attendance-total-rgb: 100 116 139;
  --attendance-success-rgb: 34 197 94;
  --attendance-failed-rgb: 239 68 68;
  --attendance-duplicate-rgb: 59 130 246;
}

.attendance-import-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.attendance-import-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.attendance-import-filter-actions > * {
  flex: 0 0 auto;
}

.attendance-row-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

:deep(.attendance-row-tag) {
  --attendance-tag-rgb: var(--attendance-total-rgb);
  min-height: 1.45rem;
  border: 1px solid rgb(var(--attendance-tag-rgb) / 0.28);
  background: rgb(var(--attendance-tag-rgb) / 0.11);
  color: rgb(var(--attendance-tag-rgb) / 1);
  padding: 0.14rem 0.48rem;
  font-size: 0.72rem;
  font-weight: 700;
}

:deep(.attendance-row-tag-total) {
  --attendance-tag-rgb: var(--attendance-total-rgb);
}

:deep(.attendance-row-tag-success) {
  --attendance-tag-rgb: var(--attendance-success-rgb);
}

:deep(.attendance-row-tag-failed) {
  --attendance-tag-rgb: var(--attendance-failed-rgb);
}

:deep(.attendance-row-tag-duplicate) {
  --attendance-tag-rgb: var(--attendance-duplicate-rgb);
}

@media (max-width: 768px) {
  .attendance-import-filter-actions {
    justify-content: stretch;
  }

  .attendance-import-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .attendance-import-filter-bar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .attendance-import-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .attendance-import-filter-bar {
    grid-template-columns:
      minmax(260px, 1.25fr)
      minmax(170px, 0.8fr)
      minmax(180px, 0.9fr)
      minmax(180px, 0.9fr);
  }
}
</style>