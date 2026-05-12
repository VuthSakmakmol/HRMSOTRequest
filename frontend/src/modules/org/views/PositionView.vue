<!-- frontend/src/modules/org/views/PositionView.vue -->
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
import InputNumber from 'primevue/inputnumber'
import InputSwitch from 'primevue/inputswitch'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import {
  createPosition,
  exportPositionsExcel,
  getPositionLookupOptions,
  getPositions,
  updatePosition,
} from '@/modules/org/position.api'
import { getDepartmentLookupOptions } from '@/modules/org/department.api'
import PositionImportDialog from '@/modules/org/components/PositionImportDialog.vue'
import { useAuthStore } from '@/modules/auth/auth.store'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { buildSaveErrorMessage, getApiErrorMessage } from '@/shared/utils/apiError'

const toast = useToast()
const auth = useAuthStore()
const { t } = useI18n()

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

const positionDialogVisible = ref(false)
const editingPositionId = ref('')

const departmentOptions = ref([])
const reportsToPositionOptions = ref([])
const departmentLoading = ref(false)
const reportsToLoading = ref(false)

const filters = reactive({
  search: '',
  isActive: '',
  departmentId: '',
  hierarchyScope: '',
  sortField: 'code',
  sortOrder: 1,
})

const form = reactive({
  code: '',
  name: '',
  description: '',
  departmentId: '',
  reportsToPositionId: '',
  hierarchyScope: 'SAME_LINE',
  level: 0,
  isActive: true,
})

const canCreate = computed(() => auth.hasPermission('POSITION_CREATE'))
const canUpdate = computed(() => auth.hasPermission('POSITION_UPDATE'))

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const hierarchyScopeOptions = computed(() => [
  { label: t('org.position.scopeSameLine'), value: 'SAME_LINE' },
  { label: t('org.position.scopeGlobal'), value: 'GLOBAL' },
  { label: t('org.position.scopeCrossDepartment'), value: 'CROSS_DEPARTMENT' },
])

const reportsToOptionsForForm = computed(() => {
  const currentId = String(editingPositionId.value || '').trim()

  return reportsToPositionOptions.value.filter((item) => {
    return String(item.value || '') !== currentId
  })
})

const isEditMode = computed(() => !!editingPositionId.value)
const totalPositions = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalPositions.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalPositions.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('org.position.editTitle') : t('org.position.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('org.position.createTitle'),
)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim() ||
    !String(form.departmentId || '').trim()
  )
})

let searchTimer = null
let currentRequestId = 0

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

function normalizeLookupOptions(payload) {
  return normalizeItems(payload)
    .map((item) => {
      const id = normalizeId(item)
      const code = String(item?.code || '').trim()
      const name = String(item?.name || '').trim()
      const label = String(item?.label || [code, name].filter(Boolean).join(' - ')).trim()

      if (!id) return null

      return {
        ...item,
        id,
        value: id,
        code,
        name,
        label: label || code || name || id,
      }
    })
    .filter(Boolean)
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: String(filters.isActive || '').trim(),
    departmentId: String(filters.departmentId || '').trim(),
    hierarchyScope: String(filters.hierarchyScope || '').trim(),
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
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

async function loadDepartmentOptions() {
  departmentLoading.value = true

  try {
    const res = await getDepartmentLookupOptions({
      limit: 100,
      isActive: true,
    })

    departmentOptions.value = normalizeLookupOptions(normalizePayload(res))
  } catch (error) {
    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('org.position.departmentLookupFailed')),
      3500,
    )
  } finally {
    departmentLoading.value = false
  }
}

async function loadReportsToPositionOptions() {
  reportsToLoading.value = true

  try {
    const res = await getPositionLookupOptions({
      limit: 100,
      isActive: true,
    })

    reportsToPositionOptions.value = normalizeLookupOptions(normalizePayload(res))
  } catch (error) {
    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('org.position.reportsToLookupFailed')),
      3500,
    )
  } finally {
    reportsToLoading.value = false
  }
}

async function loadLookupOptions() {
  await Promise.all([
    loadDepartmentOptions(),
    loadReportsToPositionOptions(),
  ])
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getPositions(buildQuery(page))

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
      getApiErrorMessage(error, t('org.position.loadFailed')),
      3500,
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
  filters.departmentId = ''
  filters.hierarchyScope = ''
  filters.sortField = 'code'
  filters.sortOrder = 1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortField = event.sortField || 'code'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : 1

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
  editingPositionId.value = ''
  form.code = ''
  form.name = ''
  form.description = ''
  form.departmentId = ''
  form.reportsToPositionId = ''
  form.hierarchyScope = 'SAME_LINE'
  form.level = 0
  form.isActive = true
}

async function openCreateDialog() {
  resetForm()

  if (!departmentOptions.value.length || !reportsToPositionOptions.value.length) {
    await loadLookupOptions()
  }

  positionDialogVisible.value = true
}

async function openEditDialog(row) {
  if (!row) return

  editingPositionId.value = normalizeId(row)
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.description = row?.description || ''
  form.departmentId = row?.departmentId || ''
  form.reportsToPositionId = row?.reportsToPositionId || ''
  form.hierarchyScope = row?.hierarchyScope || 'SAME_LINE'
  form.level = Number(row?.level || 0)
  form.isActive = row?.isActive !== false

  if (!departmentOptions.value.length || !reportsToPositionOptions.value.length) {
    await loadLookupOptions()
  }

  positionDialogVisible.value = true
}

async function submitPosition() {
  saving.value = true

  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim(),
      departmentId: String(form.departmentId || '').trim(),
      reportsToPositionId: String(form.reportsToPositionId || '').trim(),
      hierarchyScope: form.hierarchyScope || 'SAME_LINE',
      level: Number(form.level || 0),
      isActive: !!form.isActive,
    }

    if (editingPositionId.value) {
      await updatePosition(editingPositionId.value, payload)
      showToast('success', t('common.updated'), t('org.position.updatedSuccess'), 2500)
    } else {
      await createPosition(payload)
      showToast('success', t('common.created'), t('org.position.createdSuccess'), 2500)
    }

    positionDialogVisible.value = false
    resetForm()

    await Promise.all([
      reloadFirstPage({ keepVisible: false }),
      loadReportsToPositionOptions(),
    ])
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildSaveErrorMessage(error, t('org.position.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

function statusSeverity(active) {
  return active ? 'success' : 'secondary'
}

function scopeLabel(value) {
  if (value === 'SAME_LINE') return t('org.position.scopeSameLine')
  if (value === 'GLOBAL') return t('org.position.scopeGlobal')
  if (value === 'CROSS_DEPARTMENT') return t('org.position.scopeCrossDepartment')

  return value || '-'
}

function scopeSeverity(value) {
  if (value === 'SAME_LINE') return 'success'
  if (value === 'GLOBAL') return 'info'
  if (value === 'CROSS_DEPARTMENT') return 'warning'

  return 'secondary'
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
    const res = await exportPositionsExcel({
      search: String(filters.search || '').trim(),
      isActive: String(filters.isActive || '').trim(),
      departmentId: String(filters.departmentId || '').trim(),
      hierarchyScope: String(filters.hierarchyScope || '').trim(),
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, `positions-${Date.now()}.xlsx`))

    showToast('success', t('org.position.exported'), t('org.position.exportedSuccess'), 2500)
  } catch (error) {
    showToast(
      'error',
      t('org.position.exportFailed'),
      getApiErrorMessage(error, t('org.position.exportFailed')),
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
  const failed = Number(summary.failed || payload?.failed || payload?.failedCount || 0)

  showToast(
    failed > 0 ? 'warn' : 'success',
    t('org.position.imported'),
    t('org.position.importedSuccess', { created, updated, failed }),
    4500,
  )

  await Promise.all([
    reloadFirstPage({ keepVisible: false }),
    loadLookupOptions(),
  ])
}

onMounted(async () => {
  await Promise.all([
    loadLookupOptions(),
    reloadFirstPage({ keepVisible: false }),
  ])
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell">
    <PositionImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar ot-filter-bar-6">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('org.position.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('org.position.department') }}
        </label>

        <Select
          v-model="filters.departmentId"
          :options="departmentOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          filter
          show-clear
          :loading="departmentLoading"
          :placeholder="t('org.position.allDepartments')"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('org.position.hierarchyScope') }}
        </label>

        <Select
          v-model="filters.hierarchyScope"
          :options="hierarchyScopeOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          show-clear
          :placeholder="t('org.position.allScopes')"
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

      <div class="ot-filter-actions xl:col-span-2">
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
          :label="t('org.position.importExcel')"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          :label="t('org.position.exportExcel')"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('org.position.newPosition')"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('org.position.tableTitle') }}
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
          :columns="8"
          icon="pi pi-briefcase"
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
          table-style="min-width: 74rem"
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
                <i class="pi pi-briefcase" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('org.position.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-bold"
              >
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('common.name')"
            sortable
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="min-w-0"
              >
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ data.name || '-' }}
                </div>

                <div
                  v-if="data.description"
                  class="ot-truncate-2 mt-1 text-xs text-[color:var(--ot-text-muted)]"
                >
                  {{ data.description }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            field="departmentName"
            :header="t('org.position.department')"
            sortable
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.departmentLabel || t('common.none') }}
              </span>
            </template>
          </Column>

          <Column
            field="reportsToPositionName"
            :header="t('org.position.reportsToPosition')"
            sortable
            style="min-width: 15rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.reportsToPositionLabel || t('common.none') }}
              </span>
            </template>
          </Column>

          <Column
            field="hierarchyScope"
            :header="t('org.position.hierarchyScope')"
            sortable
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                class="ot-scope-tag"
                :value="scopeLabel(data.hierarchyScope)"
                :severity="scopeSeverity(data.hierarchyScope)"
              />
            </template>
          </Column>

          <Column
            field="level"
            :header="t('org.position.level')"
            sortable
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-semibold"
              >
                {{ data.level ?? 0 }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="min-width: 7rem"
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
            :header="t('common.actions')"
            style="width: 7rem; min-width: 7rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data && canUpdate"
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

    <Dialog
      v-model:visible="positionDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '48rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.position.positionCode') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('org.position.codeExample')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.position.positionName') }}
            </label>

            <InputText
              v-model="form.name"
              class="w-full"
              :placeholder="t('org.position.nameExample')"
            />
          </div>
        </div>

        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.position.department') }}
            </label>

            <Select
              v-model="form.departmentId"
              :options="departmentOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              filter
              show-clear
              :loading="departmentLoading"
              :placeholder="t('org.position.selectDepartment')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.position.reportsToPosition') }}
            </label>

            <Select
              v-model="form.reportsToPositionId"
              :options="reportsToOptionsForForm"
              option-label="label"
              option-value="value"
              class="w-full"
              filter
              show-clear
              :loading="reportsToLoading"
              :placeholder="t('org.position.selectReportsToPosition')"
            />
          </div>
        </div>

        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.position.hierarchyScope') }}
            </label>

            <Select
              v-model="form.hierarchyScope"
              :options="hierarchyScopeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :placeholder="t('org.position.selectHierarchyScope')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.position.level') }}
            </label>

            <InputNumber
              v-model="form.level"
              class="w-full"
              input-class="w-full"
              :min="0"
              show-buttons
            />
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('common.description') }}
          </label>

          <Textarea
            v-model="form.description"
            class="w-full"
            rows="3"
            :placeholder="t('org.position.descriptionPlaceholder')"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <div>
            <div class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('common.active') }}
            </div>

            <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
              {{ t('org.position.activeHelp') }}
            </div>
          </div>

          <InputSwitch v-model="form.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            @click="positionDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitPosition"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.ot-scope-tag {
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.01em;
}
</style>