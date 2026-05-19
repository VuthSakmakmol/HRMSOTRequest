<!-- frontend/src/modules/org/views/PositionView.vue -->
<script setup>
// frontend/src/modules/org/views/PositionView.vue

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

function nameOnlyLabel(value) {
  const text = String(value || '').trim()

  if (!text) return ''

  if (text.includes(' - ')) {
    return text.split(' - ').slice(1).join(' - ').trim() || text
  }

  return text
}

function departmentDisplay(row = {}) {
  return (
    row.departmentName ||
    row.department?.name ||
    nameOnlyLabel(row.departmentLabel) ||
    '-'
  )
}

function reportsToPositionDisplay(row = {}) {
  return (
    row.reportsToPositionName ||
    row.reportsToPosition?.name ||
    nameOnlyLabel(row.reportsToPositionLabel) ||
    t('common.none')
  )
}

function scopeLabel(value) {
  if (value === 'SAME_LINE') return t('org.position.scopeSameLine')
  if (value === 'GLOBAL') return t('org.position.scopeGlobal')
  if (value === 'CROSS_DEPARTMENT') return t('org.position.scopeCrossDepartment')

  return value || '-'
}

function activeTagClass(active) {
  return active ? 'position-active-tag' : 'position-inactive-tag'
}

function scopeTagClass(value) {
  if (value === 'SAME_LINE') return 'position-scope-same-line-tag'
  if (value === 'GLOBAL') return 'position-scope-global-tag'
  if (value === 'CROSS_DEPARTMENT') return 'position-scope-cross-department-tag'

  return 'position-scope-default-tag'
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

  showToast(
    'success',
    t('org.position.imported'),
    t('org.position.importedSuccess', { created, updated }),
    3500,
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
  <div class="ot-page-shell position-page">
    <PositionImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar position-filter-bar">
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

      <div class="position-filter-actions">
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
          table-style="min-width: 100%"
          class="ot-data-table ot-data-table-compact position-data-table"
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
            style="width: 8rem; min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="position-code-text"
              >
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('common.name')"
            sortable
            style="width: 14rem; min-width: 14rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="position-name-stack"
              >
                <div class="position-name-text">
                  {{ data.name || '-' }}
                </div>

                <div
                  v-if="data.description"
                  class="position-description-text"
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
            style="width: 14rem; min-width: 14rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="position-meta-text"
              >
                {{ departmentDisplay(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="reportsToPositionName"
            :header="t('org.position.reportsToPosition')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="position-meta-text"
              >
                {{ reportsToPositionDisplay(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="hierarchyScope"
            :header="t('org.position.hierarchyScope')"
            sortable
            style="width: 8rem; min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="scopeLabel(data.hierarchyScope)"
                class="position-rgb-tag"
                :class="scopeTagClass(data.hierarchyScope)"
              />
            </template>
          </Column>

          <Column
            field="level"
            :header="t('org.position.level')"
            sortable
            style="width: 5rem; min-width: 5rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="position-level-text"
              >
                {{ data.level ?? 0 }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="width: 4rem; min-width: 5rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="data.isActive ? t('common.active') : t('common.inactive')"
                class="position-rgb-tag"
                :class="activeTagClass(data.isActive)"
              />
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

        <div class="position-active-box">
          <div>
            <div class="position-active-title">
              {{ t('common.active') }}
            </div>

            <div class="position-active-help">
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
.position-page {
  --position-code-rgb: 37, 99, 235;
  --position-name-rgb: 15, 23, 42;
  --position-meta-rgb: 71, 85, 105;

  --position-active-rgb: 22, 163, 74;
  --position-inactive-rgb: 100, 116, 139;

  --position-same-line-rgb: 22, 163, 74;
  --position-global-rgb: 14, 165, 233;
  --position-cross-rgb: 245, 158, 11;
  --position-default-rgb: 100, 116, 139;
}

.position-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.position-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.position-filter-actions > * {
  flex: 0 0 auto;
}

.position-active-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  padding: 0.75rem 0.9rem;
}

.position-active-title {
  color: var(--ot-text);
  font-size: 0.86rem;
  font-weight: 650;
}

.position-active-help {
  margin-top: 0.2rem;
  color: var(--ot-text-muted);
  font-size: 0.74rem;
  line-height: 1.35;
}

/* =========================
   Table text
   ========================= */

.position-code-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--position-code-rgb));
  font-size: 0.82rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.position-name-stack {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.position-name-text {
  max-width: 100%;
  overflow: hidden;
  color: rgb(var(--position-name-rgb));
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.position-description-text {
  display: -webkit-box;
  max-width: 100%;
  margin-top: 0.18rem;
  overflow: hidden;
  color: rgb(var(--position-meta-rgb));
  font-size: 0.72rem;
  line-height: 1.3;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.position-meta-text,
.position-level-text {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: rgb(var(--position-meta-rgb));
  font-size: 0.8rem;
  font-weight: 500;
  text-align: center;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.position-level-text {
  color: rgb(var(--position-name-rgb));
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* =========================
   RGB Tags
   ========================= */

.position-rgb-tag {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.2rem 0.58rem;
  font-size: 0.7rem;
  font-weight: 750;
  line-height: 1;
  text-align: center;
  vertical-align: middle;
  white-space: nowrap;
}

.position-active-tag {
  border-color: rgba(var(--position-active-rgb), 0.24);
  background: rgba(var(--position-active-rgb), 0.12);
  color: rgb(var(--position-active-rgb));
}

.position-inactive-tag {
  border-color: rgba(var(--position-inactive-rgb), 0.24);
  background: rgba(var(--position-inactive-rgb), 0.12);
  color: rgb(var(--position-inactive-rgb));
}

.position-scope-same-line-tag {
  border-color: rgba(var(--position-same-line-rgb), 0.24);
  background: rgba(var(--position-same-line-rgb), 0.12);
  color: rgb(var(--position-same-line-rgb));
}

.position-scope-global-tag {
  border-color: rgba(var(--position-global-rgb), 0.24);
  background: rgba(var(--position-global-rgb), 0.12);
  color: rgb(var(--position-global-rgb));
}

.position-scope-cross-department-tag {
  border-color: rgba(var(--position-cross-rgb), 0.26);
  background: rgba(var(--position-cross-rgb), 0.13);
  color: rgb(var(--position-cross-rgb));
}

.position-scope-default-tag {
  border-color: rgba(var(--position-default-rgb), 0.24);
  background: rgba(var(--position-default-rgb), 0.12);
  color: rgb(var(--position-default-rgb));
}

/* =========================
   PrimeVue table center
   ========================= */

.position-page :deep(.position-data-table.p-datatable .p-datatable-table) {
  table-layout: auto !important;
}

.position-page :deep(.position-data-table.p-datatable .p-datatable-thead > tr > th),
.position-page :deep(.position-data-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

.position-page :deep(.position-data-table.p-datatable .p-datatable-column-header-content),
.position-page :deep(.position-data-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

.position-page :deep(.position-data-table.p-datatable .p-datatable-column-title),
.position-page :deep(.position-data-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

.position-page :deep(.position-data-table.p-datatable .p-sortable-column-icon),
.position-page :deep(.position-data-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

.position-page :deep(.position-data-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

.position-page :deep(.position-data-table.p-datatable .p-tag),
.position-rgb-tag {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

.position-page :deep(.position-data-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

.position-page :deep(.position-data-table.p-datatable .p-frozen-column),
.position-page :deep(.position-data-table.p-datatable .p-datatable-frozen-column) {
  text-align: center !important;
  vertical-align: middle !important;
}

.position-page :deep(.position-data-table.p-datatable .p-frozen-column .p-button),
.position-page :deep(.position-data-table.p-datatable .p-datatable-frozen-column .p-button) {
  display: inline-flex !important;
  margin-inline: auto !important;
  align-items: center !important;
  justify-content: center !important;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .position-page {
  --position-name-rgb: 226, 232, 240;
  --position-meta-rgb: 203, 213, 225;
}

:global(.dark) .position-active-tag {
  border-color: rgba(var(--position-active-rgb), 0.36);
  background: rgba(var(--position-active-rgb), 0.18);
}

:global(.dark) .position-inactive-tag {
  border-color: rgba(var(--position-inactive-rgb), 0.36);
  background: rgba(var(--position-inactive-rgb), 0.18);
}

:global(.dark) .position-scope-same-line-tag {
  border-color: rgba(var(--position-same-line-rgb), 0.36);
  background: rgba(var(--position-same-line-rgb), 0.18);
}

:global(.dark) .position-scope-global-tag {
  border-color: rgba(var(--position-global-rgb), 0.36);
  background: rgba(var(--position-global-rgb), 0.18);
}

:global(.dark) .position-scope-cross-department-tag {
  border-color: rgba(var(--position-cross-rgb), 0.38);
  background: rgba(var(--position-cross-rgb), 0.2);
}

:global(.dark) .position-scope-default-tag {
  border-color: rgba(var(--position-default-rgb), 0.36);
  background: rgba(var(--position-default-rgb), 0.18);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .position-filter-actions {
    justify-content: stretch;
  }

  .position-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .position-filter-bar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .position-filter-bar {
    grid-template-columns:
      minmax(260px, 1.3fr)
      minmax(230px, 1.1fr)
      minmax(220px, 1fr)
      minmax(160px, 0.8fr);
  }

  .position-filter-actions {
    grid-column: 1 / -1;
  }
}
</style>