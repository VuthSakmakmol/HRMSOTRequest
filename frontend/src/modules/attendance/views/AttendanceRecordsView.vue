<!-- frontend/src/modules/attendance/views/AttendanceRecordsView.vue -->
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

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import { getAttendanceRecords } from '@/modules/attendance/attendance.api'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()

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
  attendanceDateFrom: '',
  attendanceDateTo: '',
})

const statusOptions = computed(() => [
  { label: t('attendance.option.allDerivedStatus'), value: '' },
  { label: t('attendance.statusLabel.present'), value: 'PRESENT' },
  { label: t('attendance.statusLabel.late'), value: 'LATE' },
  { label: t('attendance.statusLabel.absent'), value: 'ABSENT' },
  { label: t('attendance.statusLabel.forgetScanIn'), value: 'FORGET_SCAN_IN' },
  { label: t('attendance.statusLabel.forgetScanOut'), value: 'FORGET_SCAN_OUT' },
  { label: t('attendance.statusLabel.shiftMismatch'), value: 'SHIFT_MISMATCH' },
  { label: t('attendance.statusLabel.leave'), value: 'LEAVE' },
  { label: t('attendance.statusLabel.off'), value: 'OFF' },
  { label: t('attendance.statusLabel.unknown'), value: 'UNKNOWN' },
])

const importedStatusOptions = computed(() => [
  { label: t('attendance.option.allImportedStatus'), value: '' },
  { label: t('attendance.statusLabel.present'), value: 'PRESENT' },
  { label: t('attendance.statusLabel.absent'), value: 'ABSENT' },
  { label: t('attendance.statusLabel.leave'), value: 'LEAVE' },
  { label: t('attendance.statusLabel.off'), value: 'OFF' },
  { label: t('attendance.statusLabel.unknown'), value: 'UNKNOWN' },
])

const shiftMatchStatusOptions = computed(() => [
  { label: t('attendance.option.allShiftStatus'), value: '' },
  { label: t('attendance.statusLabel.matched'), value: 'MATCHED' },
  { label: t('attendance.statusLabel.mismatch'), value: 'MISMATCH' },
  { label: t('attendance.statusLabel.unknown'), value: 'UNKNOWN' },
])

const dayTypeOptions = computed(() => [
  { label: t('attendance.option.allDayTypes'), value: '' },
  { label: t('attendance.statusLabel.workingDay'), value: 'WORKING_DAY' },
  { label: t('attendance.statusLabel.sunday'), value: 'SUNDAY' },
  { label: t('attendance.statusLabel.holiday'), value: 'HOLIDAY' },
])

const totalRows = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRows.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalRows.value,
  }),
)

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
  return formatDate(value) || '-'
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
  return isMissingTime(value) ? t('attendance.statusLabel.missing') : value
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
    attendanceDateFrom: s(filters.attendanceDateFrom) || undefined,
    attendanceDateTo: s(filters.attendanceDateTo) || undefined,
    sortBy: 'attendanceDate',
    sortOrder: 'desc',
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
    const res = await getAttendanceRecords(buildQuery(page))

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
      getApiErrorMessage(error, t('attendance.records.loadFailed')),
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
  filters.attendanceDateFrom = ''
  filters.attendanceDateTo = ''

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
    PRESENT: t('attendance.statusLabel.present'),
    LATE: t('attendance.statusLabel.late'),
    ABSENT: t('attendance.statusLabel.absent'),
    FORGET_SCAN_IN: t('attendance.statusLabel.forgetScanIn'),
    FORGET_SCAN_OUT: t('attendance.statusLabel.forgetScanOut'),
    SHIFT_MISMATCH: t('attendance.statusLabel.shiftMismatch'),
    LEAVE: t('attendance.statusLabel.leave'),
    OFF: t('attendance.statusLabel.off'),
    UNKNOWN: t('attendance.statusLabel.unknown'),
  }

  return labels[normalized] || normalized || '-'
}

function shiftMatchLabel(value) {
  const normalized = upper(value)

  const labels = {
    MATCHED: t('attendance.statusLabel.matched'),
    MISMATCH: t('attendance.statusLabel.mismatch'),
    UNKNOWN: t('attendance.statusLabel.unknown'),
  }

  return labels[normalized] || normalized || '-'
}

function dayTypeLabel(value) {
  const normalized = upper(value)

  const labels = {
    WORKING_DAY: t('attendance.statusLabel.workingDay'),
    SUNDAY: t('attendance.statusLabel.sunday'),
    HOLIDAY: t('attendance.statusLabel.holiday'),
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

function formatLine(row) {
  const lineCode = s(row?.lineCode)
  const lineName = s(row?.lineName)

  if (lineCode && lineName) return `${lineCode} · ${lineName}`
  if (lineCode) return lineCode
  if (lineName) return lineName

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
  <div class="ot-page-shell">
    <section class="ot-filter-bar attendance-records-filter-bar">
      <div class="ot-field attendance-filter-search">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('attendance.field.searchRecordsPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field attendance-filter-employee">
        <label class="ot-field-label">
          {{ t('attendance.field.employeeNo') }}
        </label>

        <InputText
          v-model="filters.employeeNo"
          :placeholder="t('attendance.field.employeeNo')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field attendance-filter-select">
        <label class="ot-field-label">
          {{ t('attendance.field.derivedStatus') }}
        </label>

        <Select
          v-model="filters.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('attendance.field.derivedStatus')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field attendance-filter-select">
        <label class="ot-field-label">
          {{ t('attendance.field.importedStatus') }}
        </label>

        <Select
          v-model="filters.importedStatus"
          :options="importedStatusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('attendance.field.importedStatus')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field attendance-filter-select">
        <label class="ot-field-label">
          {{ t('attendance.field.shiftStatus') }}
        </label>

        <Select
          v-model="filters.shiftMatchStatus"
          :options="shiftMatchStatusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('attendance.field.shiftStatus')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field attendance-filter-day">
        <label class="ot-field-label">
          {{ t('attendance.field.dayType') }}
        </label>

        <Select
          v-model="filters.dayType"
          :options="dayTypeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('attendance.field.dayType')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field attendance-filter-date">
        <HolidayDatePicker
          v-model="filters.attendanceDateFrom"
          :label="t('common.fromDate')"
          :placeholder="t('common.fromDate')"
        />
      </div>

      <div class="ot-field attendance-filter-date">
        <HolidayDatePicker
          v-model="filters.attendanceDateTo"
          :label="t('common.toDate')"
          :placeholder="t('common.toDate')"
        />
      </div>

      <div class="ot-filter-actions attendance-records-filter-actions">
        <span class="ot-loaded-badge whitespace-nowrap">
          {{ loadedLabel }}
        </span>

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
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('attendance.records.attendanceList') }}
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
          :columns="16"
          icon="pi pi-clock"
        />

        <DataTable
          v-else
          :value="rows"
          lazy
          scrollable
          scroll-height="500px"
          table-style="min-width: 145rem"
          class="ot-data-table ot-data-table-compact attendance-records-table"
          :virtual-scroller-options="useVirtualScroll ? {
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
              class="ot-empty-state"
            >
              <div class="ot-empty-icon">
                <i class="pi pi-clock" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('attendance.records.noRecords') }}
              </div>
            </div>
          </template>

          <Column
            field="attendanceDate"
            :header="t('common.date')"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-bold text-[color:var(--ot-text)]"
              >
                {{ formatDateDMY(data.attendanceDate) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.employee')"
            style="min-width: 18rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-col"
              >
                <span class="font-bold text-[color:var(--ot-text)]">
                  {{ formatEmployee(data) }}
                </span>

                <span
                  v-if="shouldShowImportedEmployee(data)"
                  class="text-xs text-[color:var(--ot-text-muted)]"
                >
                  {{ t('attendance.field.importedEmployee') }}: {{ formatImportedEmployee(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.department')"
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ data.departmentName || data.importedDepartmentName || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.position')"
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ data.positionName || data.importedPositionName || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.line')"
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ formatLine(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.shift')"
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-col"
              >
                <span class="font-bold text-[color:var(--ot-text)]">
                  {{ formatShift(data) }}
                </span>

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ formatShiftTime(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.scanIn')"
            style="min-width: 8rem"
          >
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

          <Column
            :header="t('attendance.field.scanOut')"
            style="min-width: 8rem"
          >
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
            :header="t('attendance.field.importedStatus')"
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="statusLabel(data.importedStatus)"
                :severity="statusSeverity(data.importedStatus)"
              />
            </template>
          </Column>

          <Column
            field="status"
            :header="t('attendance.field.derivedStatus')"
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="statusLabel(data.status)"
                :severity="statusSeverity(data.status)"
              />
            </template>
          </Column>

          <Column
            field="dayType"
            :header="t('attendance.field.dayType')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="dayTypeLabel(data.dayType)"
                :severity="dayTypeSeverity(data.dayType)"
              />
            </template>
          </Column>

          <Column
            field="shiftMatchStatus"
            :header="t('attendance.field.shiftMatch')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="shiftMatchLabel(data.shiftMatchStatus)"
                :severity="shiftMatchSeverity(data.shiftMatchStatus)"
              />
            </template>
          </Column>

          <Column
            field="workedMinutes"
            :header="t('attendance.field.worked')"
            style="min-width: 8rem"
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
            :header="t('attendance.field.late')"
            style="min-width: 7rem"
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
            :header="t('attendance.field.earlyOut')"
            style="min-width: 8rem"
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

          <Column
            :header="t('attendance.field.importNo')"
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="text-sm text-[color:var(--ot-text-muted)]"
              >
                {{ formatImportNo(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.issues')"
            style="min-width: 20rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2 text-sm text-[color:var(--ot-text-muted)]"
              >
                {{ formatIssues(data.validationIssues) || data.derivedStatusReason || '-' }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scan-time-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.5rem;
  border-radius: 9999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.scan-time-chip.is-complete {
  background: rgba(16, 185, 129, 0.12);
  color: rgb(4, 120, 87);
}

.scan-time-chip.is-missing {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.minute-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.6rem;
  border-radius: 9999px;
  padding: 0.25rem 0.6rem;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.minute-chip.is-zero {
  background: rgba(100, 116, 139, 0.12);
  color: rgb(100, 116, 139);
}

.minute-chip.is-normal {
  background: rgba(14, 165, 233, 0.12);
  color: rgb(3, 105, 161);
}

.minute-chip.is-warning {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(180, 83, 9);
}

/* =========================================================
   Attendance Records responsive filter
   - Wide: one row when enough space
   - Medium: wraps naturally to 2 rows
   - Mobile: one column
   ========================================================= */

.attendance-records-filter-bar {
  display: flex !important;
  grid-template-columns: none !important;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
}

.attendance-records-filter-bar > .ot-field {
  min-width: 0;
}

/* Search should be wider */
.attendance-filter-search {
  flex: 1 1 260px;
  min-width: 220px;
}

/* Employee No can be compact */
.attendance-filter-employee {
  flex: 0 1 150px;
  min-width: 130px;
}

/* Status dropdowns */
.attendance-filter-select {
  flex: 0 1 180px;
  min-width: 155px;
}

/* Day Type */
.attendance-filter-day {
  flex: 0 1 150px;
  min-width: 135px;
}

/* Date pickers */
.attendance-filter-date {
  flex: 0 1 190px;
  min-width: 170px;
}

/* Action group stays at the right when there is enough space */
.attendance-records-filter-actions {
  flex: 0 0 auto;
  min-width: max-content;
  margin-left: auto;
  flex-wrap: nowrap;
  justify-content: flex-end;
}

/* If screen is not enough, actions go to new row */
@media (max-width: 1440px) {
  .attendance-records-filter-actions {
    flex: 1 1 100%;
    margin-left: 0;
    justify-content: flex-end;
  }
}

/* Tablet: 2-column style */
@media (max-width: 768px) {
  .attendance-filter-search,
  .attendance-filter-employee,
  .attendance-filter-select,
  .attendance-filter-day,
  .attendance-filter-date {
    flex: 1 1 calc(50% - 0.75rem);
    min-width: 0;
  }

  .attendance-records-filter-actions {
    flex-wrap: wrap;
  }
}

/* Mobile: 1-column style */
@media (max-width: 520px) {
  .attendance-filter-search,
  .attendance-filter-employee,
  .attendance-filter-select,
  .attendance-filter-day,
  .attendance-filter-date,
  .attendance-records-filter-actions {
    flex: 1 1 100%;
  }

  .attendance-records-filter-actions {
    justify-content: stretch;
  }

  .attendance-records-filter-actions :deep(.p-button),
  .attendance-records-filter-actions .ot-loaded-badge {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>