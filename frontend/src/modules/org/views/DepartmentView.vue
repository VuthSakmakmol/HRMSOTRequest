<!-- frontend/src/modules/org/views/DepartmentView.vue -->
<script setup>
// frontend/src/modules/org/views/DepartmentView.vue

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

import {
  createDepartment,
  exportDepartmentsExcel,
  getDepartments,
  updateDepartment,
} from '@/modules/org/department.api'
import DepartmentImportDialog from '@/modules/org/components/DepartmentImportDialog.vue'
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
const importDialogVisible = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const departmentDialogVisible = ref(false)
const editingDepartmentId = ref('')

const filters = reactive({
  search: '',
  isActive: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  code: '',
  name: '',
  isActive: true,
})

const canCreate = computed(() => auth.hasPermission('DEPARTMENT_CREATE'))
const canUpdate = computed(() => auth.hasPermission('DEPARTMENT_UPDATE'))

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const isEditMode = computed(() => !!editingDepartmentId.value)
const totalDepartments = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalDepartments.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalDepartments.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('org.department.editTitle') : t('org.department.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('org.department.createTitle'),
)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim()
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

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: filters.isActive,
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

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getDepartments(buildQuery(page))

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
      getApiErrorMessage(error, t('org.department.loadFailed')),
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

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
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
  editingDepartmentId.value = ''
  form.code = ''
  form.name = ''
  form.isActive = true
}

function openCreateDialog() {
  resetForm()
  departmentDialogVisible.value = true
}

function openEditDialog(row) {
  editingDepartmentId.value = normalizeId(row)
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.isActive = row?.isActive !== false
  departmentDialogVisible.value = true
}

async function submitDepartment() {
  saving.value = true

  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      isActive: !!form.isActive,
    }

    if (editingDepartmentId.value) {
      await updateDepartment(editingDepartmentId.value, payload)
      showToast('success', t('common.updated'), t('org.department.updatedSuccess'), 2500)
    } else {
      await createDepartment(payload)
      showToast('success', t('common.created'), t('org.department.createdSuccess'), 2500)
    }

    departmentDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildSaveErrorMessage(error, t('org.department.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

function activeTagClass(active) {
  return active ? 'department-active-tag' : 'department-inactive-tag'
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
    const res = await exportDepartmentsExcel({
      search: String(filters.search || '').trim(),
      isActive: filters.isActive,
      sortField: filters.sortField,
      sortOrder: filters.sortOrder,
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, `departments-${Date.now()}.xlsx`))

    showToast('success', t('org.department.exported'), t('org.department.exportedSuccess'), 2500)
  } catch (error) {
    showToast(
      'error',
      t('org.department.exportFailed'),
      getApiErrorMessage(error, t('org.department.exportFailed')),
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
    t('org.department.imported'),
    t('org.department.importedSuccess', { created, updated }),
    3500,
  )

  await reloadFirstPage({ keepVisible: false })
}

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell department-page">
    <DepartmentImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar department-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('org.department.searchPlaceholder')"
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
          v-model="filters.isActive"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onStatusChange"
        />
      </div>

      <div class="department-filter-actions">
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
          :label="t('org.department.importExcel')"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          :label="t('org.department.exportExcel')"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('org.department.newDepartment')"
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
            {{ t('org.department.tableTitle') }}
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
          :columns="5"
          icon="pi pi-building"
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
          class="ot-data-table ot-data-table-compact department-data-table"
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
                <i class="pi pi-building" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('org.department.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="department-code-text"
              >
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('common.name')"
            sortable
            style="width: 16rem; min-width: 16rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="department-name-text"
              >
                {{ data.name || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="width: 8rem; min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="data.isActive ? t('common.active') : t('common.inactive')"
                class="department-rgb-tag"
                :class="activeTagClass(data.isActive)"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="department-meta-text"
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
                @click="openEditDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="departmentDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '38rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.department.departmentCode') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('org.department.codeExample')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.department.departmentName') }}
            </label>

            <InputText
              v-model="form.name"
              class="w-full"
              :placeholder="t('org.department.nameExample')"
            />
          </div>
        </div>

        <div class="department-active-box">
          <span class="department-active-label">
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
            @click="departmentDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitDepartment"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.department-page {
  --department-code-rgb: 37, 99, 235;
  --department-name-rgb: 15, 23, 42;
  --department-meta-rgb: 71, 85, 105;
  --department-active-rgb: 22, 163, 74;
  --department-inactive-rgb: 100, 116, 139;
}

.department-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.department-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.department-filter-actions > * {
  flex: 0 0 auto;
}

.department-active-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  padding: 0.75rem 0.9rem;
}

.department-active-label {
  color: var(--ot-text);
  font-size: 0.86rem;
  font-weight: 650;
}

/* =========================
   Table text
   ========================= */

.department-code-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--department-code-rgb));
  font-size: 0.82rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.department-name-text,
.department-meta-text {
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

.department-name-text {
  color: rgb(var(--department-name-rgb));
  font-size: 0.82rem;
  font-weight: 650;
}

.department-meta-text {
  color: rgb(var(--department-meta-rgb));
  font-size: 0.8rem;
  font-weight: 500;
}

/* =========================
   RGB Tags
   ========================= */

.department-rgb-tag {
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

.department-active-tag {
  border-color: rgba(var(--department-active-rgb), 0.24);
  background: rgba(var(--department-active-rgb), 0.12);
  color: rgb(var(--department-active-rgb));
}

.department-inactive-tag {
  border-color: rgba(var(--department-inactive-rgb), 0.24);
  background: rgba(var(--department-inactive-rgb), 0.12);
  color: rgb(var(--department-inactive-rgb));
}

/* =========================
   PrimeVue table center
   ========================= */

.department-page :deep(.department-data-table.p-datatable .p-datatable-table) {
  table-layout: auto !important;
}

.department-page :deep(.department-data-table.p-datatable .p-datatable-thead > tr > th),
.department-page :deep(.department-data-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

.department-page :deep(.department-data-table.p-datatable .p-datatable-column-header-content),
.department-page :deep(.department-data-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

.department-page :deep(.department-data-table.p-datatable .p-datatable-column-title),
.department-page :deep(.department-data-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

.department-page :deep(.department-data-table.p-datatable .p-sortable-column-icon),
.department-page :deep(.department-data-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

.department-page :deep(.department-data-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

.department-page :deep(.department-data-table.p-datatable .p-tag),
.department-rgb-tag {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

.department-page :deep(.department-data-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

.department-page :deep(.department-data-table.p-datatable .p-frozen-column),
.department-page :deep(.department-data-table.p-datatable .p-datatable-frozen-column) {
  text-align: center !important;
  vertical-align: middle !important;
}

.department-page :deep(.department-data-table.p-datatable .p-frozen-column .p-button),
.department-page :deep(.department-data-table.p-datatable .p-datatable-frozen-column .p-button) {
  display: inline-flex !important;
  margin-inline: auto !important;
  align-items: center !important;
  justify-content: center !important;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .department-page {
  --department-name-rgb: 226, 232, 240;
  --department-meta-rgb: 203, 213, 225;
}

:global(.dark) .department-active-tag {
  border-color: rgba(var(--department-active-rgb), 0.36);
  background: rgba(var(--department-active-rgb), 0.18);
}

:global(.dark) .department-inactive-tag {
  border-color: rgba(var(--department-inactive-rgb), 0.36);
  background: rgba(var(--department-inactive-rgb), 0.18);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .department-filter-actions {
    justify-content: stretch;
  }

  .department-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .department-filter-bar {
    grid-template-columns:
      minmax(260px, 1.4fr)
      minmax(170px, 0.8fr);
  }

  .department-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .department-filter-bar {
    grid-template-columns:
      minmax(320px, 1.6fr)
      minmax(180px, 0.8fr);
  }
}
</style>