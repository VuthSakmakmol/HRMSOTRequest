<!-- frontend/src/modules/org/views/LineView.vue -->
<script setup>
// frontend/src/modules/org/views/LineView.vue

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
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import LineImportDialog from '@/modules/org/components/LineImportDialog.vue'
import {
  createLine,
  exportLinesExcel,
  getLines,
  updateLine,
} from '@/modules/org/line.api'
import { getDepartmentLookupOptions } from '@/modules/org/department.api'
import { getPositionLookupOptions } from '@/modules/org/position.api'
import { useAuthStore } from '@/modules/auth/auth.store'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { buildSaveErrorMessage, getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'

const toast = useToast()
const auth = useAuthStore()
const { t } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const exporting = ref(false)

const departmentLoading = ref(false)
const positionLoading = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const lineDialogVisible = ref(false)
const importDialogVisible = ref(false)
const editingLineId = ref('')

const departmentOptions = ref([])
const positionOptions = ref([])

const filters = reactive({
  search: '',
  departmentId: '',
  isActive: 'all',
  sortField: 'code',
  sortOrder: 1,
})

const form = reactive({
  code: '',
  name: '',
  departmentIds: [],
  positionIds: [],
  description: '',
  isActive: true,
})

const canCreate = computed(() => auth.hasPermission('LINE_CREATE'))
const canUpdate = computed(() => auth.hasPermission('LINE_UPDATE'))

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: 'all' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const departmentFilterOptions = computed(() => [
  { label: t('org.line.allDepartments'), value: '' },
  ...departmentOptions.value,
])

const isEditMode = computed(() => !!editingLineId.value)
const totalLines = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalLines.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalLines.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('org.line.editTitle') : t('org.line.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('org.line.createTitle'),
)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim() ||
    !normalizeIdList(form.departmentIds).length
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

function normalizeTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function normalizeId(row) {
  return String(row?.id || row?._id || row?.lineId || '').trim()
}

function normalizeIdList(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ]
}

function buildLabel(...parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' - ')
}

function normalizeLookupOptions(payload) {
  return normalizeItems(payload)
    .map((item) => {
      const id = normalizeId(item)
      const code = String(item?.code || '').trim()
      const name = String(item?.name || '').trim()
      const label = String(item?.label || buildLabel(code, name)).trim()

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
    departmentId: String(filters.departmentId || '').trim(),
    isActive: String(filters.isActive || 'all').trim(),
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim(),
    departmentId: String(filters.departmentId || '').trim(),
    isActive: String(filters.isActive || 'all').trim(),
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
      getApiErrorMessage(error, t('org.line.departmentLoadFailed')),
      3500,
    )
  } finally {
    departmentLoading.value = false
  }
}

async function loadPositionOptions(departmentIds = []) {
  const ids = normalizeIdList(departmentIds)

  if (!ids.length) {
    positionOptions.value = []
    return
  }

  positionLoading.value = true

  try {
    const responses = await Promise.all(
      ids.map((departmentId) =>
        getPositionLookupOptions({
          limit: 100,
          isActive: true,
          departmentId,
        }),
      ),
    )

    const optionMap = new Map()

    responses.forEach((res) => {
      normalizeLookupOptions(normalizePayload(res)).forEach((item) => {
        if (!item?.id) return
        optionMap.set(item.id, item)
      })
    })

    positionOptions.value = Array.from(optionMap.values()).sort((a, b) =>
      String(a.label || '').localeCompare(String(b.label || '')),
    )
  } catch (error) {
    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('org.line.positionLoadFailed')),
      3500,
    )
  } finally {
    positionLoading.value = false
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getLines(buildQuery(page))

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
      getApiErrorMessage(error, t('org.line.loadFailed')),
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
  filters.departmentId = ''
  filters.isActive = 'all'
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
  editingLineId.value = ''
  form.code = ''
  form.name = ''
  form.departmentIds = []
  form.positionIds = []
  form.description = ''
  form.isActive = true
  positionOptions.value = []
}

async function openCreateDialog() {
  resetForm()

  if (!departmentOptions.value.length) {
    await loadDepartmentOptions()
  }

  lineDialogVisible.value = true
}

function getRowDepartmentIds(row) {
  if (Array.isArray(row?.departmentIds) && row.departmentIds.length) {
    return normalizeIdList(row.departmentIds)
  }

  if (Array.isArray(row?.departments) && row.departments.length) {
    return normalizeIdList(row.departments.map((item) => normalizeId(item)))
  }

  return row?.departmentId ? [String(row.departmentId)] : []
}

async function openEditDialog(row) {
  if (!row) return

  editingLineId.value = normalizeId(row)
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.departmentIds = getRowDepartmentIds(row)

  const rowPositionIds = Array.isArray(row?.positionIds)
    ? row.positionIds
    : Array.isArray(row?.positions)
      ? row.positions.map((item) => normalizeId(item))
      : []

  form.positionIds = normalizeIdList(rowPositionIds)
  form.description = row?.description || ''
  form.isActive = row?.isActive !== false

  if (!departmentOptions.value.length) {
    await loadDepartmentOptions()
  }

  if (form.departmentIds.length) {
    await loadPositionOptions(form.departmentIds)
  }

  lineDialogVisible.value = true
}

async function onFormDepartmentsChange() {
  form.positionIds = []
  await loadPositionOptions(form.departmentIds)
}

async function submitLine() {
  saving.value = true

  try {
    const departmentIds = normalizeIdList(form.departmentIds)

    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      departmentId: departmentIds[0] || '',
      departmentIds,
      positionIds: normalizeIdList(form.positionIds),
      description: String(form.description || '').trim(),
      isActive: !!form.isActive,
    }

    if (editingLineId.value) {
      await updateLine(editingLineId.value, payload)
      showToast('success', t('common.updated'), t('org.line.updatedSuccess'), 2500)
    } else {
      await createLine(payload)
      showToast('success', t('common.created'), t('org.line.createdSuccess'), 2500)
    }

    lineDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildSaveErrorMessage(error, t('org.line.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
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
    const res = await exportLinesExcel(buildExportQuery())

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, `production-lines-${Date.now()}.xlsx`))

    showToast('success', t('org.line.exported'), t('org.line.exportedSuccess'), 2500)
  } catch (error) {
    showToast(
      'error',
      t('org.line.exportFailed'),
      getApiErrorMessage(error, t('org.line.exportFailed')),
      3500,
    )
  } finally {
    exporting.value = false
  }
}

async function handleImportSuccess(payload = {}) {
  const summary = payload?.summary || {}
  const created = Number(summary.created || payload?.created || payload?.createdCount || 0)
  const updated = Number(summary.updated || payload?.updated || payload?.updatedCount || 0)

  showToast(
    'success',
    t('org.line.imported'),
    t('org.line.importedSuccess', { created, updated }),
    3500,
  )

  await reloadFirstPage({ keepVisible: false })
}

function activeTagClass(active) {
  return active ? 'line-active-tag' : 'line-inactive-tag'
}

function departmentSummary(row) {
  const departments = Array.isArray(row?.departments) ? row.departments : []

  if (!departments.length && row?.departmentId) {
    return {
      visible: [
        {
          id: row.departmentId,
          code: row.departmentCode,
          name: row.departmentName,
          label: row.departmentLabel,
        },
      ],
      hidden: 0,
      emptyText: '-',
    }
  }

  if (!departments.length) {
    return {
      visible: [],
      hidden: 0,
      emptyText: '-',
    }
  }

  return {
    visible: departments.slice(0, 3),
    hidden: Math.max(0, departments.length - 3),
    emptyText: '',
  }
}

function positionSummary(row) {
  const positions = Array.isArray(row?.positions) ? row.positions : []

  if (!positions.length) {
    return {
      visible: [],
      hidden: 0,
      emptyText: t('org.line.allPositionsInDepartments'),
    }
  }

  return {
    visible: positions.slice(0, 3),
    hidden: Math.max(0, positions.length - 3),
    emptyText: '',
  }
}

function departmentTagLabel(department) {
  return department?.code || department?.name || department?.label || '-'
}

function positionTagLabel(position) {
  return position?.code || position?.name || position?.label || '-'
}

onMounted(async () => {
  await loadDepartmentOptions()
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell line-page">
    <LineImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar line-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('org.line.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('org.line.department') }}
        </label>

        <Select
          v-model="filters.departmentId"
          :options="departmentFilterOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          filter
          show-clear
          :loading="departmentLoading"
          :placeholder="t('org.line.allDepartments')"
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

      <div class="line-filter-actions">
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
          :label="t('org.line.importExcel')"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          :label="t('org.line.exportExcel')"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('org.line.newLine')"
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
            {{ t('org.line.tableTitle') }}
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
          icon="pi pi-sitemap"
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
          class="ot-data-table ot-data-table-compact line-data-table"
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
                <i class="pi pi-sitemap" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('org.line.noData') }}
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
                class="line-code-text"
              >
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('org.line.lineName')"
            sortable
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="min-w-0"
              >
                <div class="line-name-text">
                  {{ data.name || '-' }}
                </div>

                <div
                  v-if="data.description"
                  class="line-description-text"
                >
                  {{ data.description }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="t('org.line.departments')"
            style="min-width: 19rem"
          >
            <template #body="{ data }">
              <div v-if="data">
                <div
                  v-if="departmentSummary(data).visible.length"
                  class="line-tag-list"
                >
                  <Tag
                    v-for="department in departmentSummary(data).visible"
                    :key="department.id || department._id || department.code || department.name"
                    :value="departmentTagLabel(department)"
                    class="line-rgb-tag line-department-tag"
                  />

                  <Tag
                    v-if="departmentSummary(data).hidden"
                    :value="`+${departmentSummary(data).hidden}`"
                    class="line-rgb-tag line-more-tag"
                  />
                </div>

                <span
                  v-else
                  class="line-empty-text"
                >
                  {{ departmentSummary(data).emptyText }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('org.line.allowedPositions')"
            style="min-width: 21rem"
          >
            <template #body="{ data }">
              <div v-if="data">
                <div
                  v-if="positionSummary(data).visible.length"
                  class="line-tag-list"
                >
                  <Tag
                    v-for="position in positionSummary(data).visible"
                    :key="position.id || position._id || position.code || position.name"
                    :value="positionTagLabel(position)"
                    class="line-rgb-tag line-position-tag"
                  />

                  <Tag
                    v-if="positionSummary(data).hidden"
                    :value="`+${positionSummary(data).hidden}`"
                    class="line-rgb-tag line-more-tag"
                  />
                </div>

                <span
                  v-else
                  class="line-empty-text"
                >
                  {{ positionSummary(data).emptyText }}
                </span>
              </div>
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
                class="line-rgb-tag"
                :class="activeTagClass(data.isActive)"
              />
            </template>
          </Column>

          <Column
            field="updatedAt"
            :header="t('common.updatedAt')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="line-meta-text"
              >
                {{ formatDateTime(data.updatedAt) }}
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
                @click="openEditDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="lineDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '50rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.line.lineCode') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('org.line.codeExample')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.line.lineName') }}
            </label>

            <InputText
              v-model="form.name"
              class="w-full"
              :placeholder="t('org.line.nameExample')"
            />
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('org.line.departments') }}
          </label>

          <MultiSelect
            v-model="form.departmentIds"
            :options="departmentOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('org.line.selectDepartments')"
            display="chip"
            class="w-full"
            filter
            :loading="departmentLoading"
            @change="onFormDepartmentsChange"
          />
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('org.line.allowedPositions') }}
          </label>

          <MultiSelect
            v-model="form.positionIds"
            :options="positionOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('org.line.selectAllowedPositions')"
            display="chip"
            filter
            class="w-full"
            :loading="positionLoading"
            :disabled="!form.departmentIds.length"
          />

          <div class="line-help-text">
            {{ t('org.line.allowedPositionsMultiDepartmentHelp') }}
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
            :placeholder="t('org.line.descriptionPlaceholder')"
          />
        </div>

        <div class="line-active-box">
          <span class="line-active-label">
            {{ t('common.active') }}
          </span>

          <InputSwitch v-model="form.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            @click="lineDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitLine"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.line-page {
  --line-code-rgb: 37, 99, 235;
  --line-name-rgb: 15, 23, 42;
  --line-meta-rgb: 71, 85, 105;

  --line-department-rgb: 14, 116, 144;
  --line-position-rgb: 37, 99, 235;
  --line-more-rgb: 100, 116, 139;

  --line-active-rgb: 22, 163, 74;
  --line-inactive-rgb: 100, 116, 139;
}

.line-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.line-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.line-filter-actions > * {
  flex: 0 0 auto;
}

.line-code-text {
  color: rgb(var(--line-code-rgb));
  font-size: 0.82rem;
  font-weight: 700;
}

.line-name-text {
  color: rgb(var(--line-name-rgb));
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.25;
}

.line-description-text {
  display: -webkit-box;
  margin-top: 0.18rem;
  overflow: hidden;
  color: rgb(var(--line-meta-rgb));
  font-size: 0.72rem;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.line-meta-text {
  color: rgb(var(--line-meta-rgb));
  font-size: 0.8rem;
  font-weight: 500;
}

.line-tag-list {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.line-rgb-tag {
  max-width: 100%;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.2rem 0.58rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
}

.line-department-tag {
  border-color: rgba(var(--line-department-rgb), 0.24);
  background: rgba(var(--line-department-rgb), 0.1);
  color: rgb(var(--line-department-rgb));
}

.line-position-tag {
  border-color: rgba(var(--line-position-rgb), 0.24);
  background: rgba(var(--line-position-rgb), 0.11);
  color: rgb(var(--line-position-rgb));
}

.line-more-tag {
  border-color: rgba(var(--line-more-rgb), 0.24);
  background: rgba(var(--line-more-rgb), 0.1);
  color: rgb(var(--line-more-rgb));
}

.line-active-tag {
  border-color: rgba(var(--line-active-rgb), 0.24);
  background: rgba(var(--line-active-rgb), 0.12);
  color: rgb(var(--line-active-rgb));
}

.line-inactive-tag {
  border-color: rgba(var(--line-inactive-rgb), 0.24);
  background: rgba(var(--line-inactive-rgb), 0.12);
  color: rgb(var(--line-inactive-rgb));
}

.line-empty-text {
  color: rgb(var(--line-meta-rgb));
  font-size: 0.8rem;
}

.line-help-text {
  margin-top: 0.35rem;
  color: var(--ot-text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

.line-active-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  padding: 0.75rem 0.9rem;
}

.line-active-label {
  color: var(--ot-text);
  font-size: 0.86rem;
  font-weight: 650;
}

.line-page :deep(.p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.dark) .line-page {
  --line-name-rgb: 226, 232, 240;
  --line-meta-rgb: 203, 213, 225;
}

:global(.dark) .line-department-tag {
  border-color: rgba(var(--line-department-rgb), 0.36);
  background: rgba(var(--line-department-rgb), 0.18);
}

:global(.dark) .line-position-tag {
  border-color: rgba(var(--line-position-rgb), 0.36);
  background: rgba(var(--line-position-rgb), 0.18);
}

:global(.dark) .line-more-tag {
  border-color: rgba(var(--line-more-rgb), 0.36);
  background: rgba(var(--line-more-rgb), 0.16);
}

:global(.dark) .line-active-tag {
  border-color: rgba(var(--line-active-rgb), 0.36);
  background: rgba(var(--line-active-rgb), 0.18);
}

:global(.dark) .line-inactive-tag {
  border-color: rgba(var(--line-inactive-rgb), 0.36);
  background: rgba(var(--line-inactive-rgb), 0.18);
}

@media (max-width: 768px) {
  .line-filter-actions {
    justify-content: stretch;
  }

  .line-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .line-filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .line-filter-bar {
    grid-template-columns:
      minmax(260px, 1.3fr)
      minmax(240px, 1.2fr)
      minmax(170px, 0.8fr);
  }

  .line-filter-actions {
    grid-column: 1 / -1;
  }
}
</style>