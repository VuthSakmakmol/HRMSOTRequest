<!-- frontend/src/modules/attendance/views/AttendanceImportView.vue -->
<script setup>
// frontend/src/modules/attendance/views/AttendanceImportView.vue

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

function importStatusTagClass(status) {
  const normalized = upper(status)

  if (normalized === 'SUCCESS') return 'attendance-status-success'
  if (normalized === 'PARTIAL_SUCCESS') return 'attendance-status-partial'
  if (normalized === 'FAILED') return 'attendance-status-failed'
  if (normalized === 'PROCESSING') return 'attendance-status-processing'

  return 'attendance-status-muted'
}

function latestImportCardClass(type) {
  if (type === 'success') return 'card-green'
  if (type === 'failed') return 'card-red'
  if (type === 'duplicate') return 'card-blue'
  if (type === 'total') return 'card-slate'

  return 'card-blue'
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
            class="attendance-rgb-tag"
            :class="importStatusTagClass(latestImportInfo.status)"
          />
        </div>
      </div>

      <div class="attendance-summary-grid">
        <div
          class="attendance-summary-card"
          :class="latestImportCardClass('total')"
        >
          <div class="summary-icon">
            <i class="pi pi-hashtag" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('attendance.field.importNo') }}
            </div>

            <div class="summary-value">
              {{ latestImportInfo.importNo || '—' }}
            </div>
          </div>
        </div>

        <div
          class="attendance-summary-card"
          :class="latestImportCardClass('total')"
        >
          <div class="summary-icon">
            <i class="pi pi-list" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('attendance.field.totalRows') }}
            </div>

            <div class="summary-value">
              {{ Number(latestImportInfo.rowCount || 0) }}
            </div>
          </div>
        </div>

        <div
          class="attendance-summary-card"
          :class="latestImportCardClass('success')"
        >
          <div class="summary-icon">
            <i class="pi pi-check-circle" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('attendance.field.successRows') }}
            </div>

            <div class="summary-value">
              {{ Number(latestImportInfo.successRowCount || 0) }}
            </div>
          </div>
        </div>

        <div
          class="attendance-summary-card"
          :class="latestImportCardClass('failed')"
        >
          <div class="summary-icon">
            <i class="pi pi-times-circle" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('attendance.field.failedRows') }}
            </div>

            <div class="summary-value">
              {{ Number(latestImportInfo.failedRowCount || 0) }}
            </div>
          </div>
        </div>

        <div
          class="attendance-summary-card"
          :class="latestImportCardClass('duplicate')"
        >
          <div class="summary-icon">
            <i class="pi pi-copy" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('attendance.field.duplicateRows') }}
            </div>

            <div class="summary-value">
              {{ Number(latestImportInfo.duplicateRowCount || 0) }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="latestFailedRowsPreview.length"
        class="attendance-failed-preview"
      >
        <div class="attendance-section-title">
          {{ t('attendance.import.failedRowPreview') }}
        </div>

        <div class="attendance-failed-grid">
          <div
            v-for="row in latestFailedRowsPreview"
            :key="`${row.rawRowNo || row.rowNo || row.row || ''}-${row.message || row.reason || ''}`"
            class="attendance-failed-card"
          >
            <div class="attendance-failed-row">
              {{ t('attendance.field.row') }} {{ row.rawRowNo || row.rowNo || row.row || '—' }}
            </div>

            <div class="attendance-failed-message">
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
          class="attendance-action-button"
          @click="clearFilters"
        />

        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          class="attendance-action-button"
          :loading="backgroundLoading"
          @click="refresh"
        />

        <Button
          v-if="canImportAttendance"
          :label="t('attendance.import.importAttendance')"
          icon="pi pi-upload"
          size="small"
          class="attendance-action-button"
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
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
          class="ot-data-table ot-data-table-compact attendance-import-table"
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
            style="width: 11rem; min-width: 11rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="attendance-code-text"
              >
                {{ formatImportNo(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="fileName"
            :header="t('attendance.field.fileName')"
            sortable
            style="width: 18rem; min-width: 18rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="attendance-file-cell"
                :title="formatFileName(data)"
              >
                <i class="pi pi-file-excel attendance-file-icon" />

                <span class="attendance-file-name">
                  {{ formatFileName(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.period')"
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="attendance-meta-text"
              >
                {{ formatPeriod(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.rows')"
            style="width: 24rem; min-width: 24rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="attendance-row-tags"
              >
                <Tag
                  :value="`${t('attendance.field.totalRows')} ${rowCount(data, 'rowCount')}`"
                  class="attendance-rgb-tag attendance-row-tag-total"
                />

                <Tag
                  :value="`${t('attendance.field.successRows')} ${rowCount(data, 'successRowCount')}`"
                  class="attendance-rgb-tag attendance-row-tag-success"
                />

                <Tag
                  :value="`${t('attendance.field.failedRows')} ${rowCount(data, 'failedRowCount')}`"
                  class="attendance-rgb-tag attendance-row-tag-failed"
                />

                <Tag
                  :value="`${t('attendance.field.duplicateRows')} ${rowCount(data, 'duplicateRowCount')}`"
                  class="attendance-rgb-tag attendance-row-tag-duplicate"
                />
              </div>
            </template>
          </Column>

          <Column
            field="status"
            :header="t('common.status')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="formatImportStatusLabel(data.status)"
                class="attendance-rgb-tag"
                :class="importStatusTagClass(data.status)"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('attendance.field.importedAt')"
            sortable
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="attendance-meta-text"
              >
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
  --attendance-code-rgb: 37 99 235;
  --attendance-name-rgb: 15 23 42;
  --attendance-meta-rgb: 71 85 105;

  --attendance-total-rgb: 100 116 139;
  --attendance-success-rgb: 34 197 94;
  --attendance-failed-rgb: 239 68 68;
  --attendance-duplicate-rgb: 59 130 246;
  --attendance-processing-rgb: 59 130 246;
  --attendance-partial-rgb: 245 158 11;
  --attendance-muted-rgb: 100 116 139;
}

/* =========================
   Latest import summary
   ========================= */

.attendance-summary-grid {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
}

.attendance-summary-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-surface);
  padding: 0.78rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.summary-icon {
  display: flex;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  font-size: 0.85rem;
}

.summary-content {
  min-width: 0;
  flex: 1;
}

.summary-label {
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-value {
  margin-top: 0.15rem;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.9rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-blue .summary-icon {
  background: rgb(var(--attendance-duplicate-rgb) / 0.13);
  color: rgb(var(--attendance-duplicate-rgb));
}

.card-green .summary-icon {
  background: rgb(var(--attendance-success-rgb) / 0.13);
  color: rgb(var(--attendance-success-rgb));
}

.card-red .summary-icon {
  background: rgb(var(--attendance-failed-rgb) / 0.13);
  color: rgb(var(--attendance-failed-rgb));
}

.card-slate .summary-icon {
  background: rgb(var(--attendance-total-rgb) / 0.13);
  color: rgb(var(--attendance-total-rgb));
}

.attendance-failed-preview {
  border-top: 1px solid var(--ot-border);
  padding: 0.75rem;
}

.attendance-section-title {
  margin-bottom: 0.5rem;
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.attendance-failed-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.attendance-failed-card {
  border: 1px dashed rgb(var(--attendance-failed-rgb) / 0.28);
  border-radius: 0.85rem;
  background: rgb(var(--attendance-failed-rgb) / 0.06);
  padding: 0.65rem 0.75rem;
}

.attendance-failed-row {
  color: var(--ot-text);
  font-size: 0.78rem;
  font-weight: 700;
}

.attendance-failed-message {
  margin-top: 0.2rem;
  color: var(--ot-text-muted);
  font-size: 0.73rem;
  font-weight: 500;
  line-height: 1.45;
}

/* =========================
   Filter bar
   ========================= */

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

/* =========================
   Text helpers
   ========================= */

.attendance-code-text,
.attendance-meta-text,
.attendance-file-name {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.attendance-code-text {
  color: rgb(var(--attendance-code-rgb));
  font-size: 0.8rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.attendance-meta-text {
  color: rgb(var(--attendance-meta-rgb));
  font-size: 0.78rem;
  font-weight: 500;
}

.attendance-file-cell {
  display: inline-flex;
  max-width: 17rem;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  text-align: center;
}

.attendance-file-icon {
  flex-shrink: 0;
  color: rgb(var(--attendance-success-rgb));
  font-size: 0.9rem;
}

.attendance-file-name {
  color: rgb(var(--attendance-name-rgb));
  font-size: 0.78rem;
  font-weight: 600;
}

/* =========================
   RGB tags
   ========================= */

.attendance-rgb-tag {
  --attendance-tag-rgb: var(--attendance-muted-rgb);
  display: inline-flex !important;
  min-height: 1.42rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--attendance-tag-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--attendance-tag-rgb) / 0.11);
  color: rgb(var(--attendance-tag-rgb) / 1);
  padding: 0.12rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 750;
  line-height: 1;
  text-align: center !important;
  vertical-align: middle;
  white-space: nowrap;
}

.attendance-status-success,
.attendance-row-tag-success {
  --attendance-tag-rgb: var(--attendance-success-rgb);
}

.attendance-status-failed,
.attendance-row-tag-failed {
  --attendance-tag-rgb: var(--attendance-failed-rgb);
}

.attendance-status-partial {
  --attendance-tag-rgb: var(--attendance-partial-rgb);
}

.attendance-status-processing,
.attendance-row-tag-duplicate {
  --attendance-tag-rgb: var(--attendance-processing-rgb);
}

.attendance-status-muted,
.attendance-row-tag-total {
  --attendance-tag-rgb: var(--attendance-total-rgb);
}

.attendance-row-tags {
  display: inline-flex;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  text-align: center;
}

/* =========================
   PrimeVue table center
   ========================= */

:deep(.attendance-import-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.attendance-import-table.p-datatable .p-datatable-thead > tr > th),
:deep(.attendance-import-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.attendance-import-table.p-datatable .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.attendance-import-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 58px !important;
  padding: 0.42rem 0.62rem !important;
  white-space: nowrap !important;
  font-size: 0.8rem !important;
}

:deep(.attendance-import-table.p-datatable .p-datatable-column-header-content),
:deep(.attendance-import-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.attendance-import-table.p-datatable .p-datatable-column-title),
:deep(.attendance-import-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.attendance-import-table.p-datatable .p-sortable-column-icon),
:deep(.attendance-import-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.attendance-import-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.attendance-import-table.p-datatable .p-tag),
:deep(.attendance-import-table.p-datatable .p-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.attendance-import-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

:deep(.attendance-action-button .p-button-label) {
  font-weight: 500 !important;
}

:deep(.attendance-action-button .p-button-icon) {
  font-size: 0.76rem;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .attendance-import-page {
  --attendance-name-rgb: 226 232 240;
  --attendance-meta-rgb: 203 213 225;
}

:global(.dark) .attendance-summary-card {
  box-shadow: none;
}

:global(.dark) .card-blue .summary-icon {
  background: rgb(var(--attendance-duplicate-rgb) / 0.18);
  color: #93c5fd;
}

:global(.dark) .card-green .summary-icon {
  background: rgb(var(--attendance-success-rgb) / 0.18);
  color: #86efac;
}

:global(.dark) .card-red .summary-icon {
  background: rgb(var(--attendance-failed-rgb) / 0.18);
  color: #fca5a5;
}

:global(.dark) .card-slate .summary-icon {
  background: rgb(var(--attendance-total-rgb) / 0.18);
  color: #cbd5e1;
}

:global(.dark) .attendance-rgb-tag {
  border-color: rgb(var(--attendance-tag-rgb) / 0.42);
  background: rgb(var(--attendance-tag-rgb) / 0.18);
}

:global(.dark) .attendance-failed-card {
  border-color: rgb(var(--attendance-failed-rgb) / 0.42);
  background: rgb(var(--attendance-failed-rgb) / 0.12);
}

/* =========================
   Responsive
   ========================= */

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