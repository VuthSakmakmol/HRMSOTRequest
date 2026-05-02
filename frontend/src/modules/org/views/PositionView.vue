<!-- frontend/src/modules/org/views/PositionView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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

import PositionImportDialog from '@/modules/org/components/PositionImportDialog.vue'
import {
  createPosition,
  exportPositions,
  getPositions,
  updatePosition,
} from '@/modules/org/position.api'
import { getDepartmentLookupOptions } from '@/modules/org/department.api'

const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const exporting = ref(false)
const loadingDepartments = ref(false)
const loadingReportsToPositions = ref(false)
const importDialogVisible = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const departmentOptions = ref([])
const reportsToPositionOptions = ref([])

const positionDialogVisible = ref(false)
const editingPositionId = ref('')

const filters = reactive({
  search: '',
  departmentId: '',
  isActive: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  code: '',
  name: '',
  departmentId: '',
  reportsToPositionId: null,
  managerScope: 'SAME_LINE',
  description: '',
  isActive: true,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const managerScopeOptions = [
  { label: 'Same Line', value: 'SAME_LINE' },
  { label: 'Global / Cross Department', value: 'GLOBAL' },
]

const isEditMode = computed(() => !!editingPositionId.value)
const totalPositions = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalPositions.value}`)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalPositions.value > PAGE_SIZE)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim() ||
    !String(form.departmentId || '').trim()
  )
})

const filteredReportsToPositionOptions = computed(() => {
  return reportsToPositionOptions.value.filter((item) => {
    if (!editingPositionId.value) return true
    return String(item.value) !== String(editingPositionId.value)
  })
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

function errorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

function mapDepartmentOptions(items = []) {
  return items.map((item) => ({
    label: item.label || `${item.code} - ${item.name}`,
    value: item._id || item.id,
  }))
}

function mapPositionOptions(items = []) {
  return items
    .filter(Boolean)
    .map((item) => ({
      label: [item.code, item.name].filter(Boolean).join(' - '),
      value: item._id || item.id,
      code: item.code || '',
      name: item.name || '',
    }))
}

function getPositionId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  return value._id || value.id || null
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    departmentId: filters.departmentId,
    isActive: filters.isActive,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
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

function getFilenameFromDisposition(disposition, fallbackName) {
  const match = /filename="?([^"]+)"?/i.exec(disposition || '')
  return match?.[1] || fallbackName
}

async function fetchDepartmentsForDropdown(search = '') {
  loadingDepartments.value = true

  try {
    const res = await getDepartmentLookupOptions({
      limit: 100,
      search: String(search || '').trim(),
      isActive: true,
    })

    const payload = normalizePayload(res)
    departmentOptions.value = mapDepartmentOptions(normalizeItems(payload))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Department load failed',
      detail: errorMessage(error, 'Failed to load departments'),
      life: 3000,
    })
  } finally {
    loadingDepartments.value = false
  }
}

async function fetchReportsToPositions() {
  reportsToPositionOptions.value = []
  loadingReportsToPositions.value = true

  try {
    const res = await getPositions({
      page: 1,
      limit: 100,
      isActive: 'true',
      sortBy: 'name',
      sortOrder: 'asc',
    })

    const payload = normalizePayload(res)
    reportsToPositionOptions.value = mapPositionOptions(normalizeItems(payload))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Position load failed',
      detail: errorMessage(error, 'Failed to load reports-to positions'),
      life: 3000,
    })
  } finally {
    loadingReportsToPositions.value = false
  }
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
    const total = normalizeTotal(payload)

    totalRecords.value = total

    if (replace) {
      const nextRows = Array.from({ length: total }, () => null)
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        rows.value[startIndex + i] = items[i]
      }

      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail: errorMessage(error, 'Failed to load positions'),
      life: 3000,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
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

function onDepartmentChange() {
  reloadFirstPage({ keepVisible: true })
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.departmentId = ''
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
  editingPositionId.value = ''
  form.code = ''
  form.name = ''
  form.departmentId = ''
  form.reportsToPositionId = null
  form.managerScope = 'SAME_LINE'
  form.description = ''
  form.isActive = true
  reportsToPositionOptions.value = []
}

async function openCreateDialog() {
  resetForm()
  await fetchReportsToPositions()
  positionDialogVisible.value = true
}

async function openEditDialog(row) {
  editingPositionId.value = row?.id || row?._id || ''
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.departmentId =
    row?.departmentId?._id ||
    row?.departmentId?.id ||
    row?.departmentId ||
    ''

  form.reportsToPositionId = getPositionId(row?.reportsToPositionId)
  form.managerScope = row?.managerScope || 'SAME_LINE'
  form.description = row?.description || ''
  form.isActive = !!row?.isActive

  await fetchReportsToPositions()

  positionDialogVisible.value = true
}

async function onFormDepartmentChange() {
  await fetchReportsToPositions()
}

async function submitPosition() {
  saving.value = true

  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      departmentId: String(form.departmentId || '').trim(),
      reportsToPositionId: form.reportsToPositionId || null,
      managerScope: form.managerScope || 'SAME_LINE',
      description: String(form.description || '').trim(),
      isActive: !!form.isActive,
    }

    if (editingPositionId.value) {
      await updatePosition(editingPositionId.value, payload)

      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Position updated successfully',
        life: 2500,
      })
    } else {
      await createPosition(payload)

      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Position created successfully',
        life: 2500,
      })
    }

    positionDialogVisible.value = false
    resetForm()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Update failed' : 'Create failed',
      detail: errorMessage(error, 'Failed to save position'),
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

async function handleExport() {
  exporting.value = true

  try {
    const res = await exportPositions({
      search: String(filters.search || '').trim(),
      departmentId: filters.departmentId,
      isActive: filters.isActive,
      sortBy: filters.sortField,
      sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const filename = getFilenameFromDisposition(
      res?.headers?.['content-disposition'],
      'positions-export.xlsx',
    )

    downloadBlob(blob, filename)

    toast.add({
      severity: 'success',
      summary: 'Exported',
      detail: 'Position excel exported successfully',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail: errorMessage(error, 'Failed to export positions'),
      life: 3500,
    })
  } finally {
    exporting.value = false
  }
}

async function handleImportSuccess(payload) {
  const data = payload?.data || payload || {}
  const createdCount = Number(data?.createdCount || 0)
  const updatedCount = Number(data?.updatedCount || 0)
  const skippedCount = Number(data?.skippedCount || 0)

  toast.add({
    severity: 'success',
    summary: 'Imported',
    detail: `Created ${createdCount}, Updated ${updatedCount}, Skipped ${skippedCount}`,
    life: 4000,
  })

  await reloadFirstPage({ keepVisible: false })
}

function statusSeverity(active) {
  return active ? 'success' : 'contrast'
}

function managerScopeSeverity(scope) {
  return scope === 'GLOBAL' ? 'info' : 'success'
}

function managerScopeLabel(scope) {
  return scope === 'GLOBAL' ? 'Global' : 'Same Line'
}

function departmentLabel(row) {
  const dept = row?.departmentId
  if (!dept) return '-'
  if (typeof dept === 'string') return dept
  return [dept.code, dept.name].filter(Boolean).join(' - ') || '-'
}

function reportsToPositionLabel(row) {
  const position = row?.reportsToPositionId

  if (!position) return '-'

  if (typeof position === 'string') {
    return position
  }

  return [position.code, position.name].filter(Boolean).join(' - ') || '-'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

onMounted(async () => {
  await fetchDepartmentsForDropdown()
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PositionImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Positions
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Manage position hierarchy and manager scope by department.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Total
          </div>
          <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
            {{ totalPositions }}
          </div>
        </div>

        <Button
          label="Import Excel"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          label="Export Excel"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          label="New Position"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[280px] xl:shrink-0">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filters.search"
              placeholder="Search code, name, description"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[220px] xl:shrink-0">
            <Select
              v-model="filters.departmentId"
              :options="[{ label: 'All Departments', value: '' }, ...departmentOptions]"
              optionLabel="label"
              optionValue="value"
              placeholder="Department"
              class="w-full"
              size="small"
              :loading="loadingDepartments"
              @change="onDepartmentChange"
            />
          </div>

          <div class="w-full xl:w-[160px] xl:shrink-0">
            <Select
              v-model="filters.isActive"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
              size="small"
              @change="onStatusChange"
            />
          </div>

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
              Loaded {{ summaryText }}
            </div>

            <Button
              label="Clear"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />
          </div>
        </div>
      </div>

      <DataTable
        :value="rows"
        lazy
        removableSort
        scrollable
        scrollHeight="500px"
        :sortField="filters.sortField"
        :sortOrder="filters.sortOrder"
        tableStyle="min-width: 88rem"
        class="position-table"
        :virtualScrollerOptions="useVirtualScroll ? {
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
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No positions found.
          </div>
        </template>

        <Column field="code" header="Code" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.code || '-' }}</span>
          </template>
        </Column>

        <Column field="name" header="Name" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.name || '-' }}</span>
          </template>
        </Column>

        <Column header="Department" style="min-width: 16rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">{{ departmentLabel(data) }}</span>
          </template>
        </Column>

        <Column header="Reports To Position" style="min-width: 18rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">
              {{ reportsToPositionLabel(data) }}
            </span>
          </template>
        </Column>

        <Column header="Manager Scope" style="min-width: 12rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="managerScopeLabel(data.managerScope)"
              :severity="managerScopeSeverity(data.managerScope)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column field="description" header="Description" style="min-width: 18rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">
              {{ data.description || '-' }}
            </span>
          </template>
        </Column>

        <Column field="isActive" header="Status" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.isActive ? 'Active' : 'Inactive'"
              :severity="statusSeverity(data.isActive)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column field="createdAt" header="Created At" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>

        <Column header="Actions" style="width: 7rem; min-width: 7rem">
          <template #body="{ data }">
            <Button
              v-if="data"
              label="Edit"
              icon="pi pi-pencil"
              size="small"
              outlined
              @click="openEditDialog(data)"
            />
          </template>
        </Column>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </div>

    <Dialog
      v-model:visible="positionDialogVisible"
      modal
      :header="isEditMode ? 'Edit Position' : 'Create Position'"
      :style="{ width: '44rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Position Code
          </label>
          <InputText
            v-model="form.code"
            class="w-full"
            placeholder="Example: SW"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Position Name
          </label>
          <InputText
            v-model="form.name"
            class="w-full"
            placeholder="Example: Sewer"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Department
          </label>
          <Select
            v-model="form.departmentId"
            :options="departmentOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select department"
            class="w-full"
            filter
            :loading="loadingDepartments"
            @change="onFormDepartmentChange"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Reports To Position
          </label>
          <Select
            v-model="form.reportsToPositionId"
            :options="filteredReportsToPositionOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Optional: select parent/supervisor position"
            class="w-full"
            filter
            showClear
            :loading="loadingReportsToPositions"
          />
          <p class="text-xs text-[color:var(--ot-text-muted)]">
            Example: Sewer reports to Sewer-Supervisor. Sewer-Supervisor can report to HR or GM from another department.
          </p>
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Manager Scope
          </label>
          <Select
            v-model="form.managerScope"
            :options="managerScopeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select manager scope"
            class="w-full"
          />
          <p class="text-xs text-[color:var(--ot-text-muted)]">
            Same Line = find manager in same production line. Global = find manager by parent position across departments.
          </p>
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Description
          </label>
          <Textarea
            v-model="form.description"
            class="w-full"
            rows="3"
            placeholder="Optional position description"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3 md:col-span-2">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Active Status
          </span>
          <InputSwitch v-model="form.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="positionDialogVisible = false"
          />
          <Button
            :label="isEditMode ? 'Save Changes' : 'Create Position'"
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
:deep(.position-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.position-table .p-datatable-tbody > tr > td) {
  padding: 0.72rem 0.9rem !important;
  height: 72px !important;
}

:deep(.position-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>