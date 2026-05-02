<!-- frontend/src/modules/org/views/LineView.vue -->
<script setup>
// frontend/src/modules/org/views/LineView.vue
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
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import LineImportDialog from '@/modules/org/components/LineImportDialog.vue'

import {
  createLine,
  exportLinesExcel,
  getDepartmentLookupOptions,
  getLines,
  getPositionLookupOptions,
  updateLine,
} from '@/modules/org/line.api'

const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const exporting = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const lineDialogVisible = ref(false)
const importDialogVisible = ref(false)
const editingLineId = ref('')

const departments = ref([])
const positions = ref([])

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

const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const isEditMode = computed(() => !!editingLineId.value)
const totalLines = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalLines.value}`)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalLines.value > PAGE_SIZE)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim() ||
    !String(form.departmentId || '').trim()
  )
})

const isExportDisabled = computed(() => exporting.value || totalLines.value <= 0)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeTotal(payload) {
  if (typeof payload?.total === 'number') return payload.total
  if (typeof payload?.pagination?.total === 'number') return payload.pagination.total
  return 0
}

function errorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    departmentId: filters.departmentId || '',
    isActive: filters.isActive || 'all',
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim(),
    departmentId: filters.departmentId || '',
    isActive: filters.isActive || 'all',
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

function getFilenameFromDisposition(disposition, fallback) {
  const raw = String(disposition || '')

  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])

  const normalMatch = raw.match(/filename="?([^"]+)"?/i)
  if (normalMatch?.[1]) return normalMatch[1]

  return fallback
}

function downloadBlobResponse(response, fallbackName) {
  const blob = response?.data
  const disposition =
    response?.headers?.['content-disposition'] ||
    response?.headers?.['Content-Disposition']

  const filename = getFilenameFromDisposition(disposition, fallbackName)

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.URL.revokeObjectURL(url)
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
      detail: errorMessage(error, 'Failed to load production lines'),
      life: 3500,
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

function resetForm() {
  editingLineId.value = ''
  form.code = ''
  form.name = ''
  form.departmentId = ''
  form.positionIds = []
  form.description = ''
  form.isActive = true
  positions.value = []
}

async function loadDepartments() {
  try {
    const res = await getDepartmentLookupOptions({
      limit: 100,
      isActive: 'true',
    })

    const payload = normalizePayload(res)
    departments.value = normalizeItems(payload).map((item) => ({
      id: String(item.id || item._id),
      code: item.code || '',
      name: item.name || '',
      label: item.label || [item.code, item.name].filter(Boolean).join(' - '),
    }))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail: errorMessage(error, 'Failed to load departments'),
      life: 3500,
    })
  }
}

async function loadPositions(departmentId = '') {
  if (!departmentId) {
    positions.value = []
    return
  }

  try {
    const res = await getPositionLookupOptions({
      limit: 100,
      isActive: 'true',
      departmentId,
    })

    const payload = normalizePayload(res)
    positions.value = normalizeItems(payload).map((item) => ({
      id: String(item.id || item._id),
      code: item.code || '',
      name: item.name || '',
      label: item.label || [item.code, item.name].filter(Boolean).join(' - '),
    }))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail: errorMessage(error, 'Failed to load positions'),
      life: 3500,
    })
  }
}

function openCreateDialog() {
  resetForm()
  lineDialogVisible.value = true
}

async function openEditDialog(row) {
  editingLineId.value = row?.id || row?._id || ''
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.departmentId = row?.departmentId ? String(row.departmentId) : ''
  form.positionIds = Array.isArray(row?.positionIds)
    ? row.positionIds.map((id) => String(id))
    : []
  form.description = row?.description || ''
  form.isActive = row?.isActive !== false

  if (form.departmentId) {
    await loadPositions(form.departmentId)
  }

  lineDialogVisible.value = true
}

async function onFormDepartmentChange() {
  form.positionIds = []
  await loadPositions(form.departmentId)
}

async function submitLine() {
  saving.value = true

  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      departmentId: form.departmentId,
      positionIds: Array.isArray(form.positionIds) ? form.positionIds : [],
      description: String(form.description || '').trim(),
      isActive: !!form.isActive,
    }

    if (editingLineId.value) {
      await updateLine(editingLineId.value, payload)

      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Production line updated successfully',
        life: 2500,
      })
    } else {
      await createLine(payload)

      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Production line created successfully',
        life: 2500,
      })
    }

    lineDialogVisible.value = false
    resetForm()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Save failed' : 'Create failed',
      detail: errorMessage(error, 'Failed to save production line'),
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

async function exportLines() {
  if (isExportDisabled.value) return

  exporting.value = true

  try {
    const response = await exportLinesExcel(buildExportQuery())
    const today = new Date().toISOString().slice(0, 10)

    downloadBlobResponse(response, `production-lines-${today}.xlsx`)

    toast.add({
      severity: 'success',
      summary: 'Exported',
      detail: 'Production lines exported successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail: errorMessage(error, 'Failed to export production lines'),
      life: 3500,
    })
  } finally {
    exporting.value = false
  }
}

async function onImportSuccess() {
  await reloadFirstPage({ keepVisible: false })
}

function statusSeverity(active) {
  return active ? 'success' : 'contrast'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function departmentLabel(row) {
  if (!row) return '-'
  return [row.departmentCode, row.departmentName].filter(Boolean).join(' - ') || '-'
}

function positionSummary(row) {
  const positions = Array.isArray(row?.positions) ? row.positions : []

  if (!positions.length) {
    return {
      visible: [],
      hidden: 0,
      emptyText: 'All positions in department',
    }
  }

  return {
    visible: positions.slice(0, 3),
    hidden: Math.max(0, positions.length - 3),
    emptyText: '',
  }
}

onMounted(async () => {
  await loadDepartments()
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          label="New Line"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />

        <Button
          label="Import"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          label="Export"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="exporting"
          :disabled="isExportDisabled"
          @click="exportLines"
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

          <div class="w-full xl:w-[240px] xl:shrink-0">
            <Select
              v-model="filters.departmentId"
              :options="departments"
              optionLabel="label"
              optionValue="id"
              placeholder="Department"
              showClear
              filter
              class="w-full"
              size="small"
              @change="onFilterChange"
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
              @change="onFilterChange"
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
        tableStyle="min-width: 74rem"
        class="line-table"
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
            No production lines found.
          </div>
        </template>

        <Column field="code" header="Code" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <span v-if="data" class="font-medium">
              {{ data.code || '-' }}
            </span>
          </template>
        </Column>

        <Column field="name" header="Line Name" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <div v-if="data" class="min-w-0">
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ data.name || '-' }}
              </div>
              <div
                v-if="data.description"
                class="mt-0.5 line-clamp-1 text-xs text-[color:var(--ot-text-muted)]"
              >
                {{ data.description }}
              </div>
            </div>
          </template>
        </Column>

        <Column header="Department" style="min-width: 16rem">
          <template #body="{ data }">
            <span v-if="data">
              {{ departmentLabel(data) }}
            </span>
          </template>
        </Column>

        <Column header="Allowed Positions" style="min-width: 19rem">
          <template #body="{ data }">
            <div v-if="data">
              <div
                v-if="positionSummary(data).visible.length"
                class="flex flex-wrap gap-1"
              >
                <Tag
                  v-for="position in positionSummary(data).visible"
                  :key="position.id || position._id"
                  :value="position.code || position.name"
                  severity="info"
                  class="ot-small-tag"
                />

                <Tag
                  v-if="positionSummary(data).hidden"
                  :value="`+${positionSummary(data).hidden}`"
                  severity="secondary"
                  class="ot-small-tag"
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

        <Column field="isActive" header="Status" sortable style="min-width: 7rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.isActive ? 'Active' : 'Inactive'"
              :severity="statusSeverity(data.isActive)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column field="updatedAt" header="Updated At" sortable style="min-width: 13rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTime(data.updatedAt) }}</span>
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
      v-model:visible="lineDialogVisible"
      modal
      :header="isEditMode ? 'Edit Production Line' : 'Create Production Line'"
      :style="{ width: '44rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Line Code <span class="text-red-500">*</span>
          </label>
          <InputText
            v-model="form.code"
            class="w-full"
            placeholder="Example: LINE-01"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Line Name <span class="text-red-500">*</span>
          </label>
          <InputText
            v-model="form.name"
            class="w-full"
            placeholder="Example: Line 01"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Department <span class="text-red-500">*</span>
          </label>
          <Select
            v-model="form.departmentId"
            :options="departments"
            optionLabel="label"
            optionValue="id"
            placeholder="Select department"
            showClear
            filter
            class="w-full"
            @change="onFormDepartmentChange"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Allowed Positions
          </label>
          <MultiSelect
            v-model="form.positionIds"
            :options="positions"
            optionLabel="label"
            optionValue="id"
            placeholder="Optional: Sewer, Sewer Supervisor..."
            display="chip"
            filter
            class="w-full"
            :disabled="!form.departmentId"
          />
          <p class="text-xs text-[color:var(--ot-text-muted)]">
            Leave empty if this line can be used by all positions in the selected department.
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
            placeholder="Optional production line description"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3 md:col-span-2">
          <div>
            <span class="text-sm font-medium text-[color:var(--ot-text)]">
              Active Status
            </span>
            <p class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
              Inactive lines will not be used for new employee assignment.
            </p>
          </div>

          <InputSwitch v-model="form.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="lineDialogVisible = false"
          />
          <Button
            :label="isEditMode ? 'Save Changes' : 'Create Line'"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitLine"
          />
        </div>
      </template>
    </Dialog>

    <LineImportDialog
      v-model:visible="importDialogVisible"
      @success="onImportSuccess"
    />
  </div>
</template>

<style scoped>
:deep(.line-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.line-table .p-datatable-tbody > tr > td) {
  padding: 0.72rem 0.9rem !important;
  height: 72px !important;
}

:deep(.line-table .p-tag.ot-status-tag),
:deep(.line-table .p-tag.ot-small-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>