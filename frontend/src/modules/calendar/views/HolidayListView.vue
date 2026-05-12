<!-- frontend/src/modules/calendar/views/HolidayListView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputSwitch from 'primevue/inputswitch'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import {
  createHoliday,
  exportHolidaysExcel,
  getHolidays,
  updateHoliday,
} from '@/modules/calendar/holiday.api'
import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import HolidayImportDialog from '@/modules/calendar/components/HolidayImportDialog.vue'
import { useAuthStore } from '@/modules/auth/auth.store'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { buildSaveErrorMessage, getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'

const toast = useToast()
const auth = useAuthStore()
const { t, te } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const exporting = ref(false)
const importDialogVisible = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const holidayDialogVisible = ref(false)
const editingHolidayId = ref('')
const selectedDayInfo = ref(null)

const previewLoading = ref(false)
const previewMonth = ref(getMonthStart(new Date()))
const previewSelectedDate = ref(new Date())
const previewHolidayRows = ref([])

const filters = reactive({
  search: '',
  isActive: '',
  fromDate: '',
  toDate: '',
  sortField: 'date',
  sortOrder: -1,
})

const form = reactive({
  date: '',
  code: '',
  name: '',
  description: '',
  isPaidHoliday: true,
  isActive: true,
})

const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const canCreate = computed(() => auth.hasPermission('HOLIDAY_CREATE'))
const canUpdate = computed(() => auth.hasPermission('HOLIDAY_UPDATE'))

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const isEditMode = computed(() => !!editingHolidayId.value)
const totalHolidays = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalHolidays.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalHolidays.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('calendar.holiday.editTitle') : t('calendar.holiday.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('calendar.holiday.createTitle'),
)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.date || '').trim() ||
    !String(form.name || '').trim()
  )
})

const previewMonthTitle = computed(() => {
  return previewMonth.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})

const previewSelectedYmd = computed(() => formatYmd(previewSelectedDate.value))

const previewHolidayMap = computed(() => {
  const map = new Map()

  for (const item of previewHolidayRows.value) {
    if (item?.date) {
      map.set(item.date, item)
    }
  }

  return map
})

const previewSelectedHoliday = computed(() => {
  return previewHolidayMap.value.get(previewSelectedYmd.value) || null
})

const previewSelectedDayLabel = computed(() => {
  if (previewSelectedHoliday.value) return previewSelectedHoliday.value.name
  if (previewSelectedDate.value.getDay() === 0) return label('calendar.holidayPicker.sunday', 'Sunday')
  return label('calendar.holidayPicker.workingDay', 'Working Day')
})

const previewSelectedDaySeverity = computed(() => {
  if (previewSelectedHoliday.value) return 'danger'
  if (previewSelectedDate.value.getDay() === 0) return 'warning'
  return 'success'
})

const previewSortedHolidays = computed(() => {
  return [...previewHolidayRows.value].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || '')),
  )
})

const previewCalendarDays = computed(() => {
  const year = previewMonth.value.getFullYear()
  const month = previewMonth.value.getMonth()

  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []

  for (let index = 0; index < firstDayIndex; index += 1) {
    const day = daysInPrevMonth - firstDayIndex + index + 1
    const date = new Date(year, month - 1, day)

    cells.push(buildPreviewCell(date, false))
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)

    cells.push(buildPreviewCell(date, true))
  }

  while (cells.length < 42) {
    const nextDay = cells.length - (firstDayIndex + daysInMonth) + 1
    const date = new Date(year, month + 1, nextDay)

    cells.push(buildPreviewCell(date, false))
  }

  return cells
})

let searchTimer = null
let currentRequestId = 0

function label(key, fallback) {
  return te(key) ? t(key) : fallback
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizePaginationTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function normalizeId(row) {
  return String(row?.id || row?._id || '').trim()
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function getMonthStart(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatYmd(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function normalizeYmd(value) {
  const raw = String(value || '').trim()

  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) return ''

  return formatYmd(date)
}

function ymdToDate(ymd) {
  const raw = normalizeYmd(ymd)

  if (!raw) return new Date()

  const [year, month, day] = raw.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function formatDate(value) {
  const raw = normalizeYmd(value)

  if (!raw) return '-'

  const [year, month, day] = raw.split('-')

  return `${day}/${month}/${year}`
}

function formatPrettyDate(value) {
  const raw = normalizeYmd(value)

  if (!raw) return '-'

  const date = ymdToDate(raw)

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isToday(date) {
  return formatYmd(date) === formatYmd(new Date())
}

function isSameDate(a, b) {
  return formatYmd(a) === formatYmd(b)
}

function isSunday(date) {
  return date.getDay() === 0
}

function buildPreviewCell(date, inCurrentMonth) {
  const ymd = formatYmd(date)
  const holiday = previewHolidayMap.value.get(ymd) || null

  return {
    key: ymd,
    ymd,
    date,
    day: date.getDate(),
    holiday,
    inCurrentMonth,
    isToday: isToday(date),
    isSelected: isSameDate(date, previewSelectedDate.value),
    isSunday: isSunday(date),
    isHoliday: !!holiday,
  }
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: filters.isActive,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

async function fetchPreviewHolidays() {
  previewLoading.value = true

  try {
    const year = previewMonth.value.getFullYear()
    const month = previewMonth.value.getMonth() + 1

    const res = await getHolidays({
      page: 1,
      limit: 100,
      search: '',
      isActive: true,
      year,
      month,
      sortField: 'date',
      sortOrder: 1,
    })

    const payload = normalizePayload(res)

    previewHolidayRows.value = normalizeItems(payload)
  } catch (error) {
    previewHolidayRows.value = []

    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('calendar.holiday.loadFailed')),
    )
  } finally {
    previewLoading.value = false
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getHolidays(buildQuery(page))

    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
    const total = normalizePaginationTotal(payload)
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
      t('common.loadFailed'),
      getApiErrorMessage(error, t('calendar.holiday.loadFailed')),
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

function clearFilters() {
  filters.search = ''
  filters.isActive = ''
  filters.fromDate = ''
  filters.toDate = ''
  filters.sortField = 'date'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortField = event.sortField || 'date'
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

function previousPreviewMonth() {
  previewMonth.value = new Date(
    previewMonth.value.getFullYear(),
    previewMonth.value.getMonth() - 1,
    1,
  )

  fetchPreviewHolidays()
}

function nextPreviewMonth() {
  previewMonth.value = new Date(
    previewMonth.value.getFullYear(),
    previewMonth.value.getMonth() + 1,
    1,
  )

  fetchPreviewHolidays()
}

function goPreviewToday() {
  const now = new Date()

  previewSelectedDate.value = now
  previewMonth.value = getMonthStart(now)

  fetchPreviewHolidays()
}

function selectPreviewCell(cell) {
  previewSelectedDate.value = new Date(cell.date)

  if (!cell.inCurrentMonth) {
    previewMonth.value = getMonthStart(cell.date)
    fetchPreviewHolidays()
  }
}

function resetForm() {
  editingHolidayId.value = ''
  selectedDayInfo.value = null

  form.date = ''
  form.code = ''
  form.name = ''
  form.description = ''
  form.isPaidHoliday = true
  form.isActive = true
}

function openCreateDialog(date = '') {
  resetForm()

  form.date = normalizeYmd(date) || previewSelectedYmd.value

  holidayDialogVisible.value = true
}

function openEditDialog(row) {
  editingHolidayId.value = normalizeId(row)
  selectedDayInfo.value = null

  form.date = normalizeYmd(row?.date)
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.description = row?.description || ''
  form.isPaidHoliday = row?.isPaidHoliday !== false
  form.isActive = row?.isActive !== false

  holidayDialogVisible.value = true
}

function onFormDateInfo(info) {
  selectedDayInfo.value = info || null
}

async function submitHoliday() {
  saving.value = true

  try {
    const payload = {
      date: String(form.date || '').trim(),
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim(),
      isPaidHoliday: !!form.isPaidHoliday,
      isActive: !!form.isActive,
    }

    if (editingHolidayId.value) {
      await updateHoliday(editingHolidayId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        t('calendar.holiday.updatedSuccess'),
        2500,
      )
    } else {
      await createHoliday(payload)

      showToast(
        'success',
        t('common.created'),
        t('calendar.holiday.createdSuccess'),
        2500,
      )
    }

    holidayDialogVisible.value = false
    resetForm()

    await Promise.all([
      reloadFirstPage({ keepVisible: false }),
      fetchPreviewHolidays(),
    ])
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildSaveErrorMessage(error, t('calendar.holiday.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

function statusSeverity(active) {
  return active ? 'success' : 'secondary'
}

function paidSeverity(isPaid) {
  return isPaid ? 'warning' : 'secondary'
}

function dayTypeSeverity(dayType) {
  if (dayType === 'HOLIDAY') return 'danger'
  if (dayType === 'SUNDAY') return 'warning'
  return 'success'
}

function getFilenameFromHeader(res, fallback) {
  const disposition = String(res?.headers?.['content-disposition'] || '')
  const match = disposition.match(/filename="?([^"]+)"?/i)

  return match?.[1] || fallback
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.URL.revokeObjectURL(url)
}

async function handleExport() {
  exporting.value = true

  try {
    const res = await exportHolidaysExcel({
      search: String(filters.search || '').trim(),
      isActive: filters.isActive,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, `holidays-${Date.now()}.xlsx`))

    showToast(
      'success',
      t('calendar.holiday.exported'),
      t('calendar.holiday.exportedSuccess'),
      2500,
    )
  } catch (error) {
    showToast(
      'error',
      t('calendar.holiday.exportFailed'),
      getApiErrorMessage(error, t('calendar.holiday.exportFailed')),
      3500,
    )
  } finally {
    exporting.value = false
  }
}

async function handleImportSuccess(payload) {
  const summary = payload?.summary || {}
  const created = Number(summary.created || payload?.created || payload?.createdCount || 0)
  const updated = Number(summary.updated || payload?.updated || payload?.updatedCount || 0)

  showToast(
    'success',
    t('calendar.holiday.imported'),
    t('calendar.holiday.importedSuccess', { created, updated }),
    3500,
  )

  await Promise.all([
    reloadFirstPage({ keepVisible: false }),
    fetchPreviewHolidays(),
  ])
}

onMounted(() => {
  Promise.all([
    reloadFirstPage({ keepVisible: false }),
    fetchPreviewHolidays(),
  ])
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell">
    <HolidayImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar ot-filter-bar-5">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('calendar.holiday.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.fromDate"
          :label="t('common.fromDate')"
          :placeholder="t('common.fromDate')"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.toDate"
          :label="t('common.toDate')"
          :placeholder="t('common.toDate')"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.status') }}
        </label>

        <Select
          v-model="filters.isActive"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-filter-actions xl:col-span-5">
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
          v-if="canCreate"
          :label="t('calendar.holiday.importExcel')"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          :label="t('calendar.holiday.exportExcel')"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('calendar.holiday.newHoliday')"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog()"
        />
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside class="ot-table-card holiday-preview-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ label('calendar.holiday.previewTitle', 'Calendar Preview') }}
            </h2>

            <div class="ot-table-subtitle">
              {{ previewMonthTitle }}
            </div>
          </div>

          <div class="ot-table-actions">
            <Tag
              :value="label('calendar.holiday.previewCount', `${previewHolidayRows.length} holidays`)"
              severity="info"
            />
          </div>
        </div>

        <div class="holiday-preview-body">
          <div class="holiday-calendar-box">
            <div class="holiday-calendar-top">
              <button
                type="button"
                class="holiday-preview-nav"
                @click="previousPreviewMonth"
              >
                <i class="pi pi-chevron-left" />
              </button>

              <div class="min-w-0 text-center">
                <div class="holiday-month-title">
                  {{ previewMonthTitle }}
                </div>

                <div class="holiday-month-subtitle">
                  <span v-if="previewLoading">{{ t('common.loading') }}</span>
                  <span v-else>
                    {{ previewHolidayRows.length }}
                    {{ label('calendar.holiday.activeHolidays', 'active holiday(s)') }}
                  </span>
                </div>
              </div>

              <button
                type="button"
                class="holiday-preview-nav"
                @click="nextPreviewMonth"
              >
                <i class="pi pi-chevron-right" />
              </button>
            </div>

            <div class="grid grid-cols-7 gap-1.5">
              <div
                v-for="weekLabel in weekLabels"
                :key="weekLabel"
                class="holiday-week-label"
              >
                {{ weekLabel }}
              </div>

              <button
                v-for="cell in previewCalendarDays"
                :key="cell.key"
                type="button"
                class="holiday-preview-cell"
                :class="{
                  'is-outside': !cell.inCurrentMonth,
                  'is-today': cell.isToday,
                  'is-selected': cell.isSelected,
                  'is-sunday': cell.isSunday,
                  'is-holiday': cell.isHoliday,
                }"
                :title="cell.holiday?.name || (cell.isSunday ? label('calendar.holidayPicker.sunday', 'Sunday') : '')"
                @click="selectPreviewCell(cell)"
              >
                <span>{{ cell.day }}</span>

                <span
                  v-if="cell.isHoliday"
                  class="holiday-preview-dot"
                />
              </button>
            </div>
          </div>

          <div class="holiday-selected-card">
            <div class="flex flex-col gap-3">
              <div class="min-w-0">
                <div class="holiday-selected-label">
                  {{ label('calendar.holiday.selectedDate', 'Selected Date') }}
                </div>

                <div class="holiday-selected-title">
                  {{ formatPrettyDate(previewSelectedDate) }}
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <Tag
                  :value="previewSelectedDayLabel"
                  :severity="previewSelectedDaySeverity"
                />

                <Tag
                  v-if="previewSelectedHoliday?.code"
                  :value="previewSelectedHoliday.code"
                  severity="secondary"
                />
              </div>

              <div class="flex flex-wrap justify-end gap-2">
                <Button
                  :label="label('calendar.holidayPicker.today', 'Today')"
                  icon="pi pi-calendar"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="goPreviewToday"
                />

                <Button
                  v-if="canCreate && !previewSelectedHoliday"
                  :label="label('calendar.holiday.createOnSelectedDate', 'Create')"
                  icon="pi pi-plus"
                  size="small"
                  @click="openCreateDialog(previewSelectedYmd)"
                />

                <Button
                  v-if="canUpdate && previewSelectedHoliday"
                  :label="label('calendar.holiday.editHoliday', 'Edit')"
                  icon="pi pi-pencil"
                  outlined
                  size="small"
                  @click="openEditDialog(previewSelectedHoliday)"
                />
              </div>
            </div>
          </div>

          <div
            v-if="previewSortedHolidays.length"
            class="holiday-month-list"
          >
            <button
              v-for="item in previewSortedHolidays"
              :key="item.id || item._id || item.date"
              type="button"
              class="holiday-summary-row"
              @click="previewSelectedDate = ymdToDate(item.date)"
            >
              <div class="min-w-0">
                <div class="truncate text-sm font-medium text-[color:var(--ot-text)]">
                  {{ item.name }}
                </div>

                <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                  {{ formatDate(item.date) }}
                </div>
              </div>

              <Tag
                :value="item.code || t('calendar.holiday.noCode')"
                severity="secondary"
              />
            </button>
          </div>
        </div>
      </aside>

      <section class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('calendar.holiday.tableTitle') }}
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
            :title="label('common.loadingData', 'Loading data')"
            :message="label('common.fetchingRecords', 'Fetching records')"
            :rows="7"
            :columns="8"
            icon="pi pi-calendar"
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
            table-style="min-width: 82rem"
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
                  <i class="pi pi-calendar" />
                </div>

                <div class="ot-empty-title">
                  {{ t('common.noData') }}
                </div>

                <div class="ot-empty-text">
                  {{ t('calendar.holiday.noData') }}
                </div>
              </div>
            </template>

            <Column
              field="date"
              :header="t('common.date')"
              sortable
              style="min-width: 8.5rem"
            >
              <template #body="{ data }">
                <span
                  v-if="data"
                  class="font-medium text-[color:var(--ot-text)]"
                >
                  {{ formatDate(data.date) }}
                </span>
              </template>
            </Column>

            <Column
              field="code"
              :header="t('common.code')"
              sortable
              style="min-width: 8rem"
            >
              <template #body="{ data }">
                <Tag
                  v-if="data"
                  :value="data.code || t('calendar.holiday.noCode')"
                  severity="secondary"
                />
              </template>
            </Column>

            <Column
              field="name"
              :header="t('common.name')"
              sortable
              style="min-width: 14rem"
            >
              <template #body="{ data }">
                <span
                  v-if="data"
                  class="text-[color:var(--ot-text)]"
                >
                  {{ data.name || '-' }}
                </span>
              </template>
            </Column>

            <Column
              field="description"
              :header="t('common.description')"
              style="min-width: 18rem"
            >
              <template #body="{ data }">
                <span
                  v-if="data"
                  class="ot-truncate-2 text-[color:var(--ot-text-muted)]"
                >
                  {{ data.description || '-' }}
                </span>
              </template>
            </Column>

            <Column
              field="isPaidHoliday"
              :header="t('calendar.holiday.paidHoliday')"
              sortable
              style="min-width: 9rem"
            >
              <template #body="{ data }">
                <Tag
                  v-if="data"
                  :value="data.isPaidHoliday ? t('calendar.holiday.paid') : t('calendar.holiday.unpaid')"
                  :severity="paidSeverity(data.isPaidHoliday)"
                />
              </template>
            </Column>

            <Column
              field="isActive"
              :header="t('common.status')"
              sortable
              style="min-width: 7.5rem"
            >
              <template #body="{ data }">
                <Tag
                  v-if="data"
                  :value="data.isActive ? t('common.active') : t('common.inactive')"
                  :severity="statusSeverity(data.isActive)"
                />
              </template>
            </Column>

            <Column
              field="createdAt"
              :header="t('common.createdAt')"
              sortable
              style="min-width: 13rem"
            >
              <template #body="{ data }">
                <span
                  v-if="data"
                  class="text-sm text-[color:var(--ot-text-muted)]"
                >
                  {{ formatDateTime(data.createdAt) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('common.actions')"
              style="width: 7rem; min-width: 7rem"
            >
              <template #body="{ data }">
                <Button
                  v-if="data && canUpdate"
                  :label="t('common.edit')"
                  icon="pi pi-pencil"
                  size="small"
                  outlined
                  @click="openEditDialog(data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </section>
    </section>

    <Dialog
      v-model:visible="holidayDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '42rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <HolidayDatePicker
              v-model="form.date"
              :label="t('common.date')"
              :placeholder="t('calendar.holiday.selectHolidayDate')"
              :clearable="false"
              @selected-info="onFormDateInfo"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('calendar.holiday.holidayCode') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('calendar.holiday.codeExample')"
            />
          </div>
        </div>

        <div
          v-if="selectedDayInfo"
          class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] px-4 py-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-[color:var(--ot-text)]">
              {{ t('calendar.holiday.selectedDayType') }}
            </span>

            <Tag
              :value="selectedDayInfo.dayType || '-'"
              :severity="dayTypeSeverity(selectedDayInfo.dayType)"
            />

            <span
              v-if="selectedDayInfo.holiday?.name"
              class="text-sm text-[color:var(--ot-text-muted)]"
            >
              {{ selectedDayInfo.holiday.name }}
            </span>
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('calendar.holiday.holidayName') }}
          </label>

          <InputText
            v-model="form.name"
            class="w-full"
            :placeholder="t('calendar.holiday.nameExample')"
          />
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('common.description') }}
          </label>

          <Textarea
            v-model="form.description"
            class="w-full"
            rows="3"
            :placeholder="t('calendar.holiday.descriptionPlaceholder')"
          />
        </div>

        <div class="ot-form-grid">
          <div class="holiday-switch-card">
            <div>
              <div class="text-sm font-medium text-[color:var(--ot-text)]">
                {{ t('calendar.holiday.paidHoliday') }}
              </div>

              <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                {{ t('calendar.holiday.paidHolidayHelp') }}
              </div>
            </div>

            <InputSwitch v-model="form.isPaidHoliday" />
          </div>

          <div class="holiday-switch-card">
            <div>
              <div class="text-sm font-semibold text-[color:var(--ot-text)]">
                {{ t('common.active') }}
              </div>

              <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                {{ t('calendar.holiday.activeHelp') }}
              </div>
            </div>

            <InputSwitch v-model="form.isActive" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            @click="holidayDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitHoliday"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.holiday-preview-card {
  align-self: start;
}

.holiday-preview-body {
  display: grid;
  gap: 0.85rem;
  padding: 0.85rem;
}

.holiday-calendar-box {
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  background: var(--ot-bg);
  padding: 0.85rem;
}

.holiday-calendar-top {
  margin-bottom: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.holiday-preview-nav {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ot-border);
  border-radius: 9999px;
  background: var(--ot-surface);
  color: var(--ot-text);
  transition: 0.18s ease;
}

.holiday-month-title {
  color: var(--ot-text);
  font-size: 0.95rem;
  font-weight: 650;
}

.holiday-month-subtitle {
  margin-top: 0.12rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 500;
}

.holiday-week-label {
  padding-bottom: 0.15rem;
  text-align: center;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.holiday-preview-cell {
  position: relative;
  display: inline-flex;
  min-height: 2.15rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: 0.18s ease;
}

.holiday-selected-label {
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.holiday-selected-title {
  margin-top: 0.2rem;
  color: var(--ot-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.holiday-preview-cell:hover {
  background: rgba(148, 163, 184, 0.13);
}

.holiday-preview-cell.is-outside {
  color: var(--ot-text-muted);
  opacity: 0.42;
}

.holiday-preview-cell.is-today {
  box-shadow: inset 0 0 0 1px var(--ot-border);
}

.holiday-preview-cell.is-sunday {
  color: var(--ot-danger);
}

.holiday-preview-cell.is-holiday {
  background: var(--ot-danger-soft);
  color: var(--ot-danger);
}

.holiday-preview-cell.is-selected,
.holiday-preview-cell.is-selected.is-sunday,
.holiday-preview-cell.is-selected.is-holiday {
  background: var(--p-primary-500);
  color: #ffffff;
}

.holiday-preview-dot {
  position: absolute;
  right: 0.43rem;
  bottom: 0.34rem;
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 9999px;
  background: currentColor;
}

.holiday-selected-card {
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  background: var(--ot-bg);
  padding: 0.85rem;
}

.holiday-selected-label {
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.holiday-selected-title {
  margin-top: 0.2rem;
  color: var(--ot-text);
  font-size: 0.9rem;
  font-weight: 800;
}

.holiday-month-list {
  display: grid;
  gap: 0.5rem;
}

.holiday-summary-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  background: var(--ot-surface);
  padding: 0.65rem 0.75rem;
  text-align: left;
  transition: 0.18s ease;
}

.holiday-summary-row:hover {
  background: var(--ot-hover, rgba(148, 163, 184, 0.08));
}

.holiday-switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  background: var(--ot-bg);
  padding: 0.85rem 1rem;
}

@media (max-width: 640px) {
  .holiday-preview-body {
    padding: 0.75rem;
  }

  .holiday-preview-cell {
    min-height: 2rem;
    font-size: 0.78rem;
  }
}
</style>