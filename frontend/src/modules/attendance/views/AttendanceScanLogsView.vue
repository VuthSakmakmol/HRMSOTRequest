<!-- frontend/src/modules/attendance/views/AttendanceScanLogsView.vue -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import {
  getAttendanceScanLogs,
  getAttendanceScanSummary,
} from '@/modules/attendance/attendance.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate, formatDateTime } from '@/shared/utils/dateFormat'

const { t } = useI18n()
const toast = useToast()

const logs = ref([])
const total = ref(0)
const loading = ref(false)
const bootstrapped = ref(false)
const summary = ref({
  totalScans: 0,
  successCount: 0,
  failedCount: 0,
  uniqueFailedCardCount: 0,
})

const filters = reactive({
  attendanceDate: '',
  result: '',
  search: '',
})

const PAGE_SIZE = 50
let searchTimer = null

const resultOptions = computed(() => [
  { label: t('attendance.scanLogs.allResults'), value: '' },
  { label: t('attendance.scanLogs.result.success'), value: 'SUCCESS' },
  { label: t('attendance.scanLogs.result.employeeNotFound'), value: 'EMPLOYEE_NOT_FOUND' },
  { label: t('attendance.scanLogs.result.inactive'), value: 'EMPLOYEE_INACTIVE' },
  { label: t('attendance.scanLogs.result.invalidFormat'), value: 'INVALID_FORMAT' },
  { label: t('attendance.scanLogs.result.systemError'), value: 'SYSTEM_ERROR' },
])

function localYmd() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizePayload(response) {
  return response?.data?.data || response?.data || {}
}

function s(value) {
  return String(value ?? '').trim()
}

function resultLabel(value) {
  const map = {
    SUCCESS: t('attendance.scanLogs.result.success'),
    EMPLOYEE_NOT_FOUND: t('attendance.scanLogs.result.employeeNotFound'),
    EMPLOYEE_INACTIVE: t('attendance.scanLogs.result.inactive'),
    INVALID_FORMAT: t('attendance.scanLogs.result.invalidFormat'),
    SYSTEM_ERROR: t('attendance.scanLogs.result.systemError'),
  }

  return map[s(value).toUpperCase()] || s(value) || '—'
}

function resultClass(value) {
  return s(value).toUpperCase() === 'SUCCESS'
    ? 'attendance-status-success'
    : 'attendance-status-failed'
}

function formatEmployee(row) {
  if (!row?.employeeNo && !row?.employeeName) return '—'
  return [row.employeeNo, row.employeeName].filter(Boolean).join(' · ')
}

function buildParams() {
  return {
    page: 1,
    limit: PAGE_SIZE,
    attendanceDate: filters.attendanceDate || undefined,
    result: filters.result || undefined,
    search: s(filters.search) || undefined,
  }
}

async function loadLogs({ silent = false } = {}) {
  if (!silent) loading.value = true

  try {
    const [logsResponse, summaryResponse] = await Promise.all([
      getAttendanceScanLogs(buildParams()),
      getAttendanceScanSummary({ attendanceDate: filters.attendanceDate || undefined }),
    ])

    const logsPayload = normalizePayload(logsResponse)
    const summaryPayload = normalizePayload(summaryResponse)

    logs.value = Array.isArray(logsPayload?.items) ? logsPayload.items : []
    total.value = Number(logsPayload?.pagination?.total || 0)
    summary.value = {
      totalScans: Number(summaryPayload?.totalScans || 0),
      successCount: Number(summaryPayload?.successCount || 0),
      failedCount: Number(summaryPayload?.failedCount || 0),
      uniqueFailedCardCount: Number(summaryPayload?.uniqueFailedCardCount || 0),
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('attendance.message.loadFailed'),
      detail: getApiErrorMessage(error, t('attendance.scanLogs.loadFailed')),
      life: 3500,
    })
  } finally {
    loading.value = false
    bootstrapped.value = true
  }
}

function reload() {
  loadLogs()
}

function clearFilters() {
  filters.attendanceDate = localYmd()
  filters.result = ''
  filters.search = ''
  loadLogs()
}

watch(
  () => [filters.attendanceDate, filters.result],
  () => loadLogs(),
)

watch(
  () => filters.search,
  () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => loadLogs({ silent: true }), 250)
  },
)

onMounted(() => {
  filters.attendanceDate = localYmd()
  loadLogs()
})
</script>

<template>
  <main class="ot-page attendance-scan-logs-page">
    <section class="ot-page-heading">
      <div>
        <h1 class="ot-page-title">
          {{ t('attendance.scanLogs.title') }}
        </h1>
        <p class="ot-page-subtitle">
          {{ t('attendance.scanLogs.subtitle') }}
        </p>
      </div>
    </section>

    <section class="scan-log-summary-grid">
      <article class="scan-log-summary-card">
        <span>{{ t('attendance.scanLogs.totalScans') }}</span>
        <strong>{{ summary.totalScans }}</strong>
      </article>
      <article class="scan-log-summary-card is-success">
        <span>{{ t('attendance.scanLogs.validScans') }}</span>
        <strong>{{ summary.successCount }}</strong>
      </article>
      <article class="scan-log-summary-card is-error">
        <span>{{ t('attendance.scanLogs.failedScans') }}</span>
        <strong>{{ summary.failedCount }}</strong>
      </article>
      <article class="scan-log-summary-card is-warning">
        <span>{{ t('attendance.scanLogs.uniqueErrorCards') }}</span>
        <strong>{{ summary.uniqueFailedCardCount }}</strong>
      </article>
    </section>

    <section class="ot-filter-card scan-log-filter-card">
      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.attendanceDate"
          :label="t('attendance.field.attendanceDate')"
          :clearable="false"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">{{ t('attendance.field.status') }}</label>
        <Select
          v-model="filters.result"
          :options="resultOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field scan-log-search-field">
        <label class="ot-field-label">{{ t('common.search') }}</label>
        <InputText
          v-model="filters.search"
          class="w-full"
          :placeholder="t('attendance.scanLogs.searchPlaceholder')"
        />
      </div>

      <div class="ot-filter-actions">
        <span class="ot-loaded-badge">{{ total }} {{ t('attendance.scanLogs.logCount') }}</span>
        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="loading"
          @click="reload"
        />
        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearFilters"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-wrapper">
        <AppTableLoading
          v-if="!bootstrapped && loading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="8"
          :columns="6"
          icon="pi pi-barcode"
        />

        <DataTable
          v-else
          :value="logs"
          scrollable
          scroll-height="520px"
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
          class="ot-data-table ot-data-table-compact"
        >
          <template #empty>
            <div class="ot-empty-state">
              <div class="ot-empty-icon"><i class="pi pi-barcode" /></div>
              <div class="ot-empty-title">{{ t('common.noData') }}</div>
              <div class="ot-empty-text">{{ t('attendance.scanLogs.noLogs') }}</div>
            </div>
          </template>

          <Column
            :header="t('attendance.scanLogs.scanTime')"
            style="width: 12rem; min-width: 12rem"
          >
            <template #body="{ data }">
              {{ formatDateTime(data.scannedAt) || '—' }}
            </template>
          </Column>

          <Column
            :header="t('attendance.field.employee')"
            style="width: 18rem; min-width: 18rem"
          >
            <template #body="{ data }">
              {{ formatEmployee(data) }}
            </template>
          </Column>

          <Column
            :header="t('attendance.scanLogs.rawCardValue')"
            style="width: 12rem; min-width: 12rem"
          >
            <template #body="{ data }">
              <code>{{ data.rawScannedValue || '—' }}</code>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.status')"
            style="width: 12rem; min-width: 12rem"
          >
            <template #body="{ data }">
              <Tag
                :value="resultLabel(data.result)"
                :class="resultClass(data.result)"
              />
            </template>
          </Column>

          <Column
            :header="t('attendance.scanLogs.reason')"
            style="width: 25rem; min-width: 25rem"
          >
            <template #body="{ data }">
              {{ data.reason || '—' }}
            </template>
          </Column>

          <Column
            :header="t('attendance.scanLogs.station')"
            style="width: 11rem; min-width: 11rem"
          >
            <template #body="{ data }">
              {{ data.stationName || '—' }}
            </template>
          </Column>
        </DataTable>
      </div>
    </section>
  </main>
</template>

<style scoped>
.scan-log-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.scan-log-summary-card {
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-surface);
  color: var(--ot-text-muted);
}

.scan-log-summary-card strong {
  color: var(--ot-text);
  font-size: 1.45rem;
}

.scan-log-summary-card.is-success {
  border-color: color-mix(in srgb, #16a34a 35%, var(--ot-border));
}

.scan-log-summary-card.is-success strong {
  color: #16a34a;
}

.scan-log-summary-card.is-error {
  border-color: color-mix(in srgb, #dc2626 35%, var(--ot-border));
}

.scan-log-summary-card.is-error strong {
  color: #dc2626;
}

.scan-log-summary-card.is-warning {
  border-color: color-mix(in srgb, #d97706 35%, var(--ot-border));
}

.scan-log-summary-card.is-warning strong {
  color: #d97706;
}

.scan-log-filter-card {
  display: grid;
  grid-template-columns: minmax(11rem, 0.8fr) minmax(12rem, 0.8fr) minmax(16rem, 1.4fr) auto;
  align-items: end;
  gap: 0.75rem;
}

.scan-log-search-field {
  min-width: 0;
}

@media (max-width: 900px) {
  .scan-log-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scan-log-filter-card {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .scan-log-summary-grid,
  .scan-log-filter-card {
    grid-template-columns: 1fr;
  }
}
</style>
