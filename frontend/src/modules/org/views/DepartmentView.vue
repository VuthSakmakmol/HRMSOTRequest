<!-- frontend/src/modules/org/views/DepartmentView.vue -->
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

import {
  createDepartment,
  exportDepartmentsExcel,
  getDepartments,
  updateDepartment,
} from '@/modules/org/department.api'
import DepartmentImportDialog from '@/modules/org/components/DepartmentImportDialog.vue'

const toast = useToast()

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
  description: '',
  isActive: true,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const isEditMode = computed(() => !!editingDepartmentId.value)
const totalDepartments = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalDepartments.value}`)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim()
  )
})

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalDepartments.value > PAGE_SIZE)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
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
    const total = Number(payload?.pagination?.total || 0)

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
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load departments',
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
  form.description = ''
  form.isActive = true
}

function openCreateDialog() {
  resetForm()
  departmentDialogVisible.value = true
}

function openEditDialog(row) {
  editingDepartmentId.value = row?.id || row?._id || ''
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.description = row?.description || ''
  form.isActive = !!row?.isActive
  departmentDialogVisible.value = true
}

async function submitDepartment() {
  saving.value = true
  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim(),
      isActive: !!form.isActive,
    }

    if (editingDepartmentId.value) {
      await updateDepartment(editingDepartmentId.value, payload)
      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Department updated successfully',
        life: 2500,
      })
    } else {
      await createDepartment(payload)
      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Department created successfully',
        life: 2500,
      })
    }

    departmentDialogVisible.value = false
    resetForm()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Save failed' : 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save department',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

function statusSeverity(active) {
  return active ? 'success' : 'contrast'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
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

    downloadBlob(blob, `departments-${Date.now()}.xlsx`)

    toast.add({
      severity: 'success',
      summary: 'Exported',
      detail: 'Department excel exported successfully',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to export excel',
      life: 3500,
    })
  } finally {
    exporting.value = false
  }
}

async function handleImportSuccess(payload) {
  toast.add({
    severity: 'success',
    summary: 'Imported',
    detail: `Import completed. Created: ${payload?.createdCount || 0}, Updated: ${payload?.updatedCount || 0}`,
    life: 3500,
  })

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
  <div class="flex flex-col gap-4">
    <DepartmentImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Departments
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Manage department master records for organization structure.
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
            {{ totalDepartments }}
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
          label="New Department"
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
        tableStyle="min-width: 62rem"
        class="department-table"
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
            No departments found.
          </div>
        </template>

        <Column field="code" header="Code" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.code || '-' }}</span>
          </template>
        </Column>

        <Column field="name" header="Name" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.name || '-' }}</span>
          </template>
        </Column>

        <Column field="description" header="Description" style="min-width: 18rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">
              {{ data.description || '-' }}
            </span>
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

        <Column field="createdAt" header="Created At" sortable style="min-width: 13rem">
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
      v-model:visible="departmentDialogVisible"
      modal
      :header="isEditMode ? 'Edit Department' : 'Create Department'"
      :style="{ width: '38rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Department Code
          </label>
          <InputText
            v-model="form.code"
            class="w-full"
            placeholder="Example: HR"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Department Name
          </label>
          <InputText
            v-model="form.name"
            class="w-full"
            placeholder="Example: Human Resources"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Description
          </label>
          <Textarea
            v-model="form.description"
            class="w-full"
            rows="3"
            placeholder="Optional department description"
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
            @click="departmentDialogVisible = false"
          />
          <Button
            :label="isEditMode ? 'Save Changes' : 'Create Department'"
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
:deep(.department-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.department-table .p-datatable-tbody > tr > td) {
  padding: 0.72rem 0.9rem !important;
  height: 72px !important;
}

:deep(.department-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>