<!-- frontend/src/modules/shift/views/ShiftListView.vue -->
<script setup>
// frontend/src/modules/shift/views/ShiftListView.vue

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

import ShiftImportDialog from '@/modules/shift/components/ShiftImportDialog.vue'
import {
  createShift,
  exportShiftsExcel,
  getShifts,
  updateShift,
} from '@/modules/shift/shift.api'
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

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const shiftDialogVisible = ref(false)
const importDialogVisible = ref(false)
const editingShiftId = ref('')

const filters = reactive({
  search: '',
  type: '',
  isActive: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  code: '',
  name: '',
  type: 'DAY',
  startTime: '',
  breakStartTime: '',
  breakEndTime: '',
  endTime: '',
  isActive: true,
})

let searchTimer = null
let currentRequestId = 0

const canView = computed(() => {
  if (typeof auth.hasPermission === 'function') return auth.hasPermission('SHIFT_VIEW')
  return !!auth.user?.isRootAdmin || auth.user?.effectivePermissionCodes?.includes('SHIFT_VIEW')
})

const canCreate = computed(() => {
  if (typeof auth.hasPermission === 'function') return auth.hasPermission('SHIFT_CREATE')
  return !!auth.user?.isRootAdmin || auth.user?.effectivePermissionCodes?.includes('SHIFT_CREATE')
})

const canUpdate = computed(() => {
  if (typeof auth.hasPermission === 'function') return auth.hasPermission('SHIFT_UPDATE')
  return !!auth.user?.isRootAdmin || auth.user?.effectivePermissionCodes?.includes('SHIFT_UPDATE')
})

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const typeOptions = computed(() => [
  { label: t('shift.filter.allTypes'), value: '' },
  { label: t('shift.type.day'), value: 'DAY' },
  { label: t('shift.type.night'), value: 'NIGHT' },
])

const shiftTypeOptions = computed(() => [
  { label: t('shift.type.day'), value: 'DAY' },
  { label: t('shift.type.night'), value: 'NIGHT' },
])

const isEditMode = computed(() => !!editingShiftId.value)
const totalShifts = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalShifts.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalShifts.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('shift.dialog.editTitle') : t('shift.dialog.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('shift.action.createShift'),
)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim() ||
    !String(form.type || '').trim() ||
    !String(form.startTime || '').trim() ||
    !String(form.breakStartTime || '').trim() ||
    !String(form.breakEndTime || '').trim() ||
    !String(form.endTime || '').trim()
  )
})

function tr(key, fallback = '') {
  return key && te?.(key) ? t(key) : fallback
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeTotal(payload) {
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

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    type: filters.type,
    isActive: filters.isActive,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!canView.value) {
    bootstrapped.value = true
    return
  }

  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getShifts(buildQuery(page))

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
      t('common.loadFailed'),
      getApiErrorMessage(error, t('shift.toast.loadFailedDetail')),
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

function onTypeChange() {
  reloadFirstPage({ keepVisible: true })
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.type = ''
  filters.isActive = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortField = event.sortField || 'createdAt'
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

function resetForm() {
  editingShiftId.value = ''
  form.code = ''
  form.name = ''
  form.type = 'DAY'
  form.startTime = ''
  form.breakStartTime = ''
  form.breakEndTime = ''
  form.endTime = ''
  form.isActive = true
}

function openCreateDialog() {
  resetForm()
  shiftDialogVisible.value = true
}

function openEditDialog(row) {
  if (!row) return

  editingShiftId.value = normalizeId(row)
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.type = row?.type || 'DAY'
  form.startTime = row?.startTime || ''
  form.breakStartTime = row?.breakStartTime || ''
  form.breakEndTime = row?.breakEndTime || ''
  form.endTime = row?.endTime || ''
  form.isActive = row?.isActive !== false

  shiftDialogVisible.value = true
}

function normalizeTime(value) {
  const raw = String(value || '').trim().replace('.', ':')
  const match = raw.match(/^(\d{1,2}):(\d{1,2})$/)

  if (!match) return raw

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return raw

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function onTimeBlur(field) {
  form[field] = normalizeTime(form[field])
}

async function submitShift() {
  saving.value = true

  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      type: String(form.type || '').trim().toUpperCase(),
      startTime: normalizeTime(form.startTime),
      breakStartTime: normalizeTime(form.breakStartTime),
      breakEndTime: normalizeTime(form.breakEndTime),
      endTime: normalizeTime(form.endTime),
      isActive: !!form.isActive,
    }

    if (editingShiftId.value) {
      await updateShift(editingShiftId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        t('shift.toast.updatedDetail'),
        3000,
      )
    } else {
      await createShift(payload)

      showToast(
        'success',
        t('common.created'),
        t('shift.toast.createdDetail'),
        3000,
      )
    }

    shiftDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildSaveErrorMessage(error, t('shift.toast.saveFailedDetail')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

function typeLabel(row) {
  if (!row) return ''

  return tr(
    row.typeKey,
    row.type === 'NIGHT' ? t('shift.type.night') : t('shift.type.day'),
  )
}

function statusLabel(row) {
  if (!row) return ''

  return tr(row.statusKey, row.isActive ? t('common.active') : t('common.inactive'))
}

function typeTagClass(type) {
  return [
    'shift-rgb-tag',
    type === 'NIGHT' ? 'shift-tag-night' : 'shift-tag-day',
  ]
}

function statusTagClass(active) {
  return [
    'shift-rgb-tag',
    active ? 'shift-tag-active' : 'shift-tag-inactive',
  ]
}

function crossMidnightTagClass(value) {
  return [
    'shift-rgb-tag',
    value ? 'shift-tag-warning' : 'shift-tag-inactive',
  ]
}

function formatMinutes(minutes) {
  const total = Number(minutes || 0)

  if (!total) return '-'

  const hours = Math.floor(total / 60)
  const mins = total % 60

  if (hours && mins) {
    return t('shift.duration.hoursMinutes', { hours, minutes: mins })
  }

  if (hours) {
    return t('shift.duration.hours', { hours })
  }

  return t('shift.duration.minutes', { minutes: mins })
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
    const res = await exportShiftsExcel({
      search: String(filters.search || '').trim(),
      type: filters.type,
      isActive: filters.isActive,
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, `shifts-${Date.now()}.xlsx`))

    showToast(
      'success',
      t('shift.toast.exportedTitle'),
      t('shift.toast.exportedDetail'),
      2500,
    )
  } catch (error) {
    showToast(
      'error',
      t('shift.toast.exportFailedTitle'),
      getApiErrorMessage(error, t('shift.toast.exportFailedDetail')),
      3500,
    )
  } finally {
    exporting.value = false
  }
}

async function handleImportSuccess(payload) {
  const summary = payload?.summary || payload?.item?.summary || {}
  const created = Number(summary.created || payload?.created || payload?.createdCount || 0)
  const updated = Number(summary.updated || payload?.updated || payload?.updatedCount || 0)
  const total = Number(summary.totalRows || created + updated || 0)

  showToast(
    'success',
    t('shift.import.toast.importedTitle'),
    t('shift.import.toast.importedDetail', { total, created, updated }),
    4000,
  )

  await reloadFirstPage({ keepVisible: false })
}

onMounted(async () => {
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell shift-list-page">
    <ShiftImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar shift-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('shift.filter.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('shift.filter.type') }}
        </label>

        <Select
          v-model="filters.type"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onTypeChange"
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
          @change="onStatusChange"
        />
      </div>

      <div class="shift-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="shift-action-button"
          @click="clearFilters"
        />

        <Button
          v-if="canCreate"
          :label="t('shift.action.importExcel')"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          class="shift-action-button"
          @click="importDialogVisible = true"
        />

        <Button
          :label="t('shift.action.exportExcel')"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          class="shift-action-button shift-export-button"
          :loading="exporting"
          :disabled="!canView"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('shift.action.newShift')"
          icon="pi pi-plus"
          size="small"
          class="shift-action-button"
          @click="openCreateDialog"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('shift.tableTitle') }}
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

      <div
        v-if="!canView"
        class="ot-empty-state"
      >
        <div class="ot-empty-icon">
          <i class="pi pi-lock" />
        </div>

        <div class="ot-empty-title">
          {{ t('auth.accessDenied') }}
        </div>

        <div class="ot-empty-text">
          {{ t('shift.permission.noView') }}
        </div>
      </div>

      <div
        v-else
        class="ot-table-wrapper"
      >
        <AppTableLoading
          v-if="isFirstLoading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="7"
          :columns="11"
          icon="pi pi-clock"
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
          table-style="min-width: 88rem"
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
                <i class="pi pi-clock" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('shift.table.empty') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('shift.column.code')"
            sortable
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-semibold text-[color:var(--ot-text)]"
              >
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('shift.column.name')"
            sortable
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ data.name || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="type"
            :header="t('shift.column.type')"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="typeLabel(data)"
                :class="typeTagClass(data.type)"
              />
            </template>
          </Column>

          <Column
            field="startTime"
            :header="t('shift.column.start')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.startTime || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="breakStartTime"
            :header="t('shift.column.breakStart')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.breakStartTime || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="breakEndTime"
            :header="t('shift.column.breakEnd')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.breakEndTime || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="endTime"
            :header="t('shift.column.end')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.endTime || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('shift.column.crossMidnight')"
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="data.crossMidnight ? t('common.yes') : t('common.no')"
                :class="crossMidnightTagClass(data.crossMidnight)"
              />
            </template>
          </Column>

          <Column
            :header="t('shift.column.working')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ formatMinutes(data.workingMinutes) }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="statusLabel(data)"
                :class="statusTagClass(data.isActive)"
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
            frozen
            align-frozen="right"
            style="width: 7rem; min-width: 7rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data && canUpdate"
                :label="t('common.edit')"
                icon="pi pi-pencil"
                size="small"
                outlined
                class="shift-action-button"
                @click="openEditDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="shiftDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '52rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="shift-dialog-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('shift.form.code') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('shift.form.codePlaceholder')"
              maxlength="30"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('shift.form.name') }}
            </label>

            <InputText
              v-model="form.name"
              class="w-full"
              :placeholder="t('shift.form.namePlaceholder')"
              maxlength="120"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('shift.form.type') }}
            </label>

            <Select
              v-model="form.type"
              :options="shiftTypeOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('shift.form.typePlaceholder')"
              class="w-full"
            />
          </div>

          <div class="shift-active-card">
            <span class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('shift.form.activeStatus') }}
            </span>

            <InputSwitch v-model="form.isActive" />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('shift.form.startTime') }}
            </label>

            <InputText
              v-model="form.startTime"
              class="w-full"
              placeholder="07:00"
              maxlength="5"
              @blur="onTimeBlur('startTime')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('shift.form.breakStartTime') }}
            </label>

            <InputText
              v-model="form.breakStartTime"
              class="w-full"
              placeholder="12:00"
              maxlength="5"
              @blur="onTimeBlur('breakStartTime')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('shift.form.breakEndTime') }}
            </label>

            <InputText
              v-model="form.breakEndTime"
              class="w-full"
              placeholder="13:00"
              maxlength="5"
              @blur="onTimeBlur('breakEndTime')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('shift.form.endTime') }}
            </label>

            <InputText
              v-model="form.endTime"
              class="w-full"
              placeholder="16:00"
              maxlength="5"
              @blur="onTimeBlur('endTime')"
            />
          </div>
        </div>

        <div class="ot-inline-info">
          {{ t('shift.form.timeHint') }}
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            :disabled="saving"
            @click="shiftDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitShift"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.shift-list-page {
  --shift-day-rgb: 14 165 233;
  --shift-night-rgb: 99 102 241;
  --shift-active-rgb: 34 197 94;
  --shift-inactive-rgb: 100 116 139;
  --shift-warning-rgb: 245 158 11;
}

.shift-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.shift-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.shift-filter-actions > * {
  flex: 0 0 auto;
}

:deep(.shift-rgb-tag) {
  --shift-tag-rgb: var(--shift-inactive-rgb);
  min-height: 1.45rem;
  border: 1px solid rgb(var(--shift-tag-rgb) / 0.28);
  background: rgb(var(--shift-tag-rgb) / 0.11);
  color: rgb(var(--shift-tag-rgb) / 1);
  padding: 0.14rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
}

:deep(.shift-tag-day) {
  --shift-tag-rgb: var(--shift-day-rgb);
}

:deep(.shift-tag-night) {
  --shift-tag-rgb: var(--shift-night-rgb);
}

:deep(.shift-tag-active) {
  --shift-tag-rgb: var(--shift-active-rgb);
}

:deep(.shift-tag-inactive) {
  --shift-tag-rgb: var(--shift-inactive-rgb);
}

:deep(.shift-tag-warning) {
  --shift-tag-rgb: var(--shift-warning-rgb);
}

:deep(.shift-action-button .p-button-icon) {
  font-size: 0.76rem;
}

:deep(.shift-export-button .p-button-icon) {
  font-size: 0.72rem;
}

.shift-dialog-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}

.shift-active-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  padding: 0.75rem 0.85rem;
}

@media (max-width: 768px) {
  .shift-filter-actions {
    justify-content: stretch;
  }

  .shift-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 768px) {
  .shift-dialog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .shift-filter-bar {
    grid-template-columns:
      minmax(260px, 1.3fr)
      minmax(180px, 0.9fr)
      minmax(170px, 0.8fr);
  }

  .shift-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .shift-dialog-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>