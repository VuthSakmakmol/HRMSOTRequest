<!-- frontend/src/modules/org/views/LineView.vue -->
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
  departmentId: '',
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

function normalizeTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function normalizeId(row) {
  return String(row?.id || row?._id || row?.lineId || '').trim()
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

async function loadPositionOptions(departmentId = '') {
  if (!departmentId) {
    positionOptions.value = []
    return
  }

  positionLoading.value = true

  try {
    const res = await getPositionLookupOptions({
      limit: 100,
      isActive: true,
      departmentId,
    })

    positionOptions.value = normalizeLookupOptions(normalizePayload(res))
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
  form.departmentId = ''
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

async function openEditDialog(row) {
  if (!row) return

  editingLineId.value = normalizeId(row)
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.departmentId = row?.departmentId ? String(row.departmentId) : ''

  const rowPositionIds = Array.isArray(row?.positionIds)
    ? row.positionIds
    : Array.isArray(row?.positions)
      ? row.positions.map((item) => normalizeId(item))
      : []

  form.positionIds = rowPositionIds.map((id) => String(id)).filter(Boolean)
  form.description = row?.description || ''
  form.isActive = row?.isActive !== false

  if (!departmentOptions.value.length) {
    await loadDepartmentOptions()
  }

  if (form.departmentId) {
    await loadPositionOptions(form.departmentId)
  }

  lineDialogVisible.value = true
}

async function onFormDepartmentChange() {
  form.positionIds = []
  await loadPositionOptions(form.departmentId)
}

async function submitLine() {
  saving.value = true

  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      departmentId: String(form.departmentId || '').trim(),
      positionIds: Array.isArray(form.positionIds) ? form.positionIds : [],
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

function statusSeverity(active) {
  return active ? 'success' : 'secondary'
}

function departmentLabel(row) {
  if (!row) return '-'
  return buildLabel(row.departmentCode, row.departmentName) || '-'
}

function positionSummary(row) {
  const positions = Array.isArray(row?.positions) ? row.positions : []

  if (!positions.length) {
    return {
      visible: [],
      hidden: 0,
      emptyText: t('org.line.allPositionsInDepartment'),
    }
  }

  return {
    visible: positions.slice(0, 3),
    hidden: Math.max(0, positions.length - 3),
    emptyText: '',
  }
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
  <div class="ot-page-shell">
    <LineImportDialog
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
          :columns="7"
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
                class="font-bold"
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
            :header="t('org.line.department')"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ departmentLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('org.line.allowedPositions')"
            style="min-width: 19rem"
          >
            <template #body="{ data }">
              <div v-if="data">
                <div
                  v-if="positionSummary(data).visible.length"
                  class="flex flex-wrap gap-1"
                >
                  <Tag
                    v-for="position in positionSummary(data).visible"
                    :key="position.id || position._id || position.code || position.name"
                    :value="positionTagLabel(position)"
                    severity="info"
                  />

                  <Tag
                    v-if="positionSummary(data).hidden"
                    :value="`+${positionSummary(data).hidden}`"
                    severity="secondary"
                  />
                </div>

                <span
                  v-else
                  class="text-sm text-[color:var(--ot-text-muted)]"
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
                :severity="statusSeverity(data.isActive)"
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
              <span v-if="data">
                {{ formatDateTime(data.updatedAt) }}
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

    <Dialog
      v-model:visible="lineDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '44rem', maxWidth: '96vw' }"
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
            {{ t('org.line.department') }}
          </label>

          <Select
            v-model="form.departmentId"
            :options="departmentOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('org.line.selectDepartment')"
            class="w-full"
            filter
            show-clear
            :loading="departmentLoading"
            @change="onFormDepartmentChange"
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
            :disabled="!form.departmentId"
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
            :placeholder="t('org.line.descriptionPlaceholder')"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-semibold text-[color:var(--ot-text)]">
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