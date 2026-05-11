<!-- frontend/src/modules/org/views/PositionView.vue -->
<template>
  <section class="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <!-- Header -->
      <div class="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold tracking-tight">
                Positions
              </h1>

              <span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {{ pagination.total }} total
              </span>

              <span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                {{ rows.length }} loaded
              </span>
            </div>

            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage position codes, hierarchy, department mapping, and active status.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              label="Download Sample"
              icon="pi pi-download"
              severity="secondary"
              outlined
              size="small"
              :loading="sampleLoading"
              @click="handleDownloadSample"
            />

            <Button
              label="Import"
              icon="pi pi-upload"
              severity="secondary"
              outlined
              size="small"
              @click="openImportDialog"
            />

            <Button
              label="Export"
              icon="pi pi-file-excel"
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
      </div>

      <!-- Content Card -->
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <!-- Filters -->
        <div class="border-b border-slate-200 p-3 dark:border-slate-800">
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,220px)_minmax(180px,220px)_minmax(140px,180px)_auto] xl:items-center">
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search" />
              <InputText
                v-model="filters.search"
                class="w-full"
                size="small"
                placeholder="Search code, name, department..."
              />
            </span>

            <Dropdown
              v-model="filters.departmentCode"
              class="w-full"
              size="small"
              :options="departmentOptions"
              option-label="label"
              option-value="code"
              filter
              show-clear
              placeholder="Department"
              :loading="departmentLoading"
            />

            <Dropdown
              v-model="filters.hierarchyScope"
              class="w-full"
              size="small"
              :options="hierarchyScopeOptions"
              option-label="label"
              option-value="value"
              show-clear
              placeholder="Hierarchy Scope"
            />

            <Dropdown
              v-model="filters.isActive"
              class="w-full"
              size="small"
              :options="activeOptions"
              option-label="label"
              option-value="value"
              show-clear
              placeholder="Status"
            />

            <div class="flex items-center gap-2">
              <Button
                label="Refresh"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                size="small"
                :loading="loading"
                @click="reload"
              />

              <Button
                label="Clear"
                icon="pi pi-filter-slash"
                severity="secondary"
                outlined
                size="small"
                @click="clearFilters"
              />
            </div>
          </div>
        </div>

        <!-- Table -->
        <DataTable
          :value="rows"
          data-key="code"
          size="small"
          striped-rows
          scrollable
          scroll-height="520px"
          class="text-sm"
          :loading="loading && !rows.length"
        >
          <Column header="#" class="w-16">
            <template #body="{ index }">
              <span class="text-xs text-slate-500">
                {{ index + 1 }}
              </span>
            </template>
          </Column>

          <Column header="Code">
            <template #body="{ data }">
              <span class="font-semibold text-slate-900 dark:text-slate-100">
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column header="Name">
            <template #body="{ data }">
              <div class="min-w-[180px]">
                <div class="font-medium">
                  {{ data.name || '-' }}
                </div>

                <div
                  v-if="data.description"
                  class="mt-0.5 max-w-[320px] truncate text-xs text-slate-500"
                >
                  {{ data.description }}
                </div>
              </div>
            </template>
          </Column>

          <Column header="Department">
            <template #body="{ data }">
              <span class="text-sm">
                {{ data.departmentLabel || data.departmentName || 'None' }}
              </span>
            </template>
          </Column>

          <Column header="Reports To">
            <template #body="{ data }">
              <span class="text-sm">
                {{ data.reportsToPositionLabel || 'None' }}
              </span>
            </template>
          </Column>

          <Column header="Scope">
            <template #body="{ data }">
              <Tag
                :value="scopeLabel(data.hierarchyScope)"
                :severity="scopeSeverity(data.hierarchyScope)"
                rounded
              />
            </template>
          </Column>

          <Column header="Level">
            <template #body="{ data }">
              <span class="font-medium">
                {{ data.level ?? 0 }}
              </span>
            </template>
          </Column>

          <Column header="Status">
            <template #body="{ data }">
              <Tag
                :value="data.isActive ? 'Active' : 'Inactive'"
                :severity="data.isActive ? 'success' : 'danger'"
                rounded
              />
            </template>
          </Column>

          <Column header="Updated">
            <template #body="{ data }">
              <span class="text-xs text-slate-500">
                {{ data.updatedAtDisplayHm || data.createdAtDisplayHm || '-' }}
              </span>
            </template>
          </Column>

          <Column header="Action" frozen align-frozen="right">
            <template #body="{ data }">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                aria-label="Edit"
                @click="openEditDialog(data)"
              />
            </template>
          </Column>

          <template #empty>
            <div class="py-10 text-center text-sm text-slate-500">
              No positions found.
            </div>
          </template>
        </DataTable>

        <div
          ref="sentinelRef"
          class="flex min-h-[52px] items-center justify-center border-t border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-800"
        >
          <span v-if="loadingMore">Loading more...</span>
          <span v-else-if="pagination.hasMore">Scroll to load more</span>
          <span v-else>All positions loaded</span>
        </div>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <Dialog
      v-model:visible="formDialog.visible"
      modal
      :header="formDialog.mode === 'create' ? 'New Position' : 'Edit Position'"
      class="w-[95vw] max-w-3xl"
    >
      <form class="grid grid-cols-1 gap-4 md:grid-cols-2" @submit.prevent="submitForm">
        <div>
          <label class="mb-1 block text-sm font-medium">Code</label>
          <InputText
            v-model="form.code"
            class="w-full"
            autocomplete="off"
            placeholder="Example: SEWER"
          />
          <small class="mt-1 block text-slate-500">
            User-facing position code.
          </small>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium">Name</label>
          <InputText
            v-model="form.name"
            class="w-full"
            autocomplete="off"
            placeholder="Example: Sewer"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium">Department</label>
          <Dropdown
            v-model="form.departmentCode"
            class="w-full"
            :options="departmentOptions"
            option-label="label"
            option-value="code"
            filter
            show-clear
            placeholder="Select department"
            :loading="departmentLoading"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium">Reports To Position</label>
          <Dropdown
            v-model="form.reportsToPositionCode"
            class="w-full"
            :options="reportsToOptions"
            option-label="label"
            option-value="code"
            filter
            show-clear
            placeholder="Select parent position"
            :loading="reportsToLoading"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium">Hierarchy Scope</label>
          <Dropdown
            v-model="form.hierarchyScope"
            class="w-full"
            :options="hierarchyScopeOptions"
            option-label="label"
            option-value="value"
            placeholder="Select scope"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium">Level</label>
          <InputNumber
            v-model="form.level"
            class="w-full"
            input-class="w-full"
            :min="0"
            show-buttons
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-1 block text-sm font-medium">Description</label>
          <Textarea
            v-model="form.description"
            class="w-full"
            rows="3"
            auto-resize
            placeholder="Optional"
          />
        </div>

        <div class="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div>
            <div class="text-sm font-medium">Active</div>
            <div class="text-xs text-slate-500">
              Inactive positions will be hidden from normal lookup selectors.
            </div>
          </div>

          <InputSwitch v-model="form.isActive" />
        </div>
      </form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            outlined
            @click="formDialog.visible = false"
          />

          <Button
            :label="formDialog.mode === 'create' ? 'Create' : 'Save'"
            icon="pi pi-check"
            :loading="saving"
            @click="submitForm"
          />
        </div>
      </template>
    </Dialog>

    <!-- Import Dialog -->
    <Dialog
      v-model:visible="importDialog.visible"
      modal
      header="Import Positions"
      class="w-[95vw] max-w-xl"
    >
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
          Import columns:
          <span class="font-medium">
            Code, Name, Department Code, Reports To Position Code, Hierarchy Scope, Level, Description, Active
          </span>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          @change="onFileChange"
        />

        <div v-if="selectedFile" class="text-sm text-slate-600 dark:text-slate-300">
          Selected:
          <span class="font-medium">{{ selectedFile.name }}</span>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            outlined
            @click="importDialog.visible = false"
          />

          <Button
            label="Import"
            icon="pi pi-upload"
            :disabled="!selectedFile"
            :loading="importing"
            @click="handleImport"
          />
        </div>
      </template>
    </Dialog>
  </section>
</template>

<script setup>
// frontend/src/modules/org/views/PositionView.vue

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import {
  createPosition,
  downloadPositionImportSample,
  exportPositionsExcel,
  getPositionLookupOptions,
  getPositions,
  importPositionsExcel,
  updatePosition,
} from '@/modules/org/position.api'

import { getDepartmentLookupOptions } from '@/modules/org/department.api'

defineOptions({
  name: 'PositionView',
})

const toast = useToast()

const rows = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const saving = ref(false)
const exporting = ref(false)
const importing = ref(false)
const sampleLoading = ref(false)

const departmentLoading = ref(false)
const reportsToLoading = ref(false)

const sentinelRef = ref(null)
const observer = ref(null)
const fileInputRef = ref(null)
const selectedFile = ref(null)

const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasMore: false,
})

const filters = reactive({
  search: '',
  departmentCode: null,
  hierarchyScope: null,
  isActive: null,
  sortBy: 'createdAt',
  sortOrder: 'desc',
})

const formDialog = reactive({
  visible: false,
  mode: 'create',
  editingCode: '',
})

const importDialog = reactive({
  visible: false,
})

const form = reactive({
  code: '',
  name: '',
  description: '',
  departmentCode: null,
  reportsToPositionCode: null,
  hierarchyScope: 'SAME_LINE',
  level: 0,
  isActive: true,
})

const departmentOptions = ref([])
const reportsToOptions = ref([])

const activeOptions = [
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
]

const hierarchyScopeOptions = [
  { label: 'Same Line', value: 'SAME_LINE' },
  { label: 'Global', value: 'GLOBAL' },
  { label: 'Cross Department', value: 'CROSS_DEPARTMENT' },
]

const filterParams = computed(() => ({
  page: pagination.page,
  limit: pagination.limit,
  search: filters.search || '',
  departmentCode: filters.departmentCode || undefined,
  hierarchyScope: filters.hierarchyScope || undefined,
  isActive: typeof filters.isActive === 'boolean' ? filters.isActive : undefined,
  sortBy: filters.sortBy,
  sortOrder: filters.sortOrder,
}))

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizeApiList(response) {
  return response?.data?.data?.items || response?.data?.items || []
}

function normalizeLookupItems(items = []) {
  return items
    .map((item) => {
      const code = upper(item.code)

      if (!code) return null

      const name = s(item.name)
      const label = s(item.label) || (name ? `${code} - ${name}` : code)

      return {
        ...item,
        code,
        value: code,
        name,
        label,
      }
    })
    .filter(Boolean)
}

function showSuccess(message) {
  toast.add({
    severity: 'success',
    summary: 'Success',
    detail: message,
    life: 3000,
  })
}

function showError(error, fallback = 'Something went wrong') {
  toast.add({
    severity: 'error',
    summary: 'Error',
    detail: error?.response?.data?.message || error?.message || fallback,
    life: 5000,
  })
}

function scopeLabel(value) {
  if (value === 'SAME_LINE') return 'Same Line'
  if (value === 'GLOBAL') return 'Global'
  if (value === 'CROSS_DEPARTMENT') return 'Cross Dept'
  return value || 'Unknown'
}

function scopeSeverity(value) {
  if (value === 'SAME_LINE') return 'success'
  if (value === 'GLOBAL') return 'info'
  if (value === 'CROSS_DEPARTMENT') return 'warning'
  return 'secondary'
}

function saveBlob(response, filename) {
  const blob = new Blob([response.data])
  const url = window.URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.URL.revokeObjectURL(url)
}

function getExportFileName(response, fallback) {
  const disposition = response?.headers?.['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/i)
  return match?.[1] || fallback
}

async function fetchDepartments() {
  departmentLoading.value = true

  try {
    const response = await getDepartmentLookupOptions({
      limit: 100,
      isActive: true,
    })

    departmentOptions.value = normalizeLookupItems(normalizeApiList(response))
  } catch (error) {
    showError(error, 'Failed to load departments')
  } finally {
    departmentLoading.value = false
  }
}

async function fetchReportsToOptions() {
  reportsToLoading.value = true

  try {
    const response = await getPositionLookupOptions({
      limit: 100,
      isActive: true,
    })

    const items = normalizeLookupItems(normalizeApiList(response))

    reportsToOptions.value = items.filter((item) => item.code !== upper(formDialog.editingCode))
  } catch (error) {
    showError(error, 'Failed to load position lookup')
  } finally {
    reportsToLoading.value = false
  }
}

async function fetchRows({ append = false } = {}) {
  if (append) {
    if (loadingMore.value || !pagination.hasMore) return
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const response = await getPositions(filterParams.value)
    const data = response.data?.data || response.data || {}

    const items = data.items || []
    const pageInfo = data.pagination || {}

    rows.value = append ? [...rows.value, ...items] : items

    pagination.page = Number(pageInfo.page || pagination.page)
    pagination.limit = Number(pageInfo.limit || pagination.limit)
    pagination.total = Number(pageInfo.total || 0)
    pagination.totalPages = Number(pageInfo.totalPages || 1)
    pagination.hasMore = pageInfo.hasMore === true
  } catch (error) {
    showError(error, 'Failed to load positions')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function reload() {
  pagination.page = 1
  rows.value = []
  return fetchRows()
}

function clearFilters() {
  filters.search = ''
  filters.departmentCode = null
  filters.hierarchyScope = null
  filters.isActive = null
  filters.sortBy = 'createdAt'
  filters.sortOrder = 'desc'
  reload()
}

function resetForm() {
  form.code = ''
  form.name = ''
  form.description = ''
  form.departmentCode = null
  form.reportsToPositionCode = null
  form.hierarchyScope = 'SAME_LINE'
  form.level = 0
  form.isActive = true
}

async function openCreateDialog() {
  resetForm()
  formDialog.mode = 'create'
  formDialog.editingCode = ''
  formDialog.visible = true
  await fetchReportsToOptions()
}

async function openEditDialog(item) {
  resetForm()

  formDialog.mode = 'edit'
  formDialog.editingCode = item.code || ''

  form.code = item.code || ''
  form.name = item.name || ''
  form.description = item.description || ''
  form.departmentCode = item.departmentCode || null
  form.reportsToPositionCode = item.reportsToPositionCode || null
  form.hierarchyScope = item.hierarchyScope || 'SAME_LINE'
  form.level = Number(item.level || 0)
  form.isActive = item.isActive === true

  formDialog.visible = true
  await fetchReportsToOptions()
}

function buildPayload() {
  return {
    code: upper(form.code),
    name: s(form.name),
    description: s(form.description),
    departmentCode: upper(form.departmentCode),
    reportsToPositionCode: upper(form.reportsToPositionCode),
    hierarchyScope: form.hierarchyScope || 'SAME_LINE',
    level: Number(form.level || 0),
    isActive: form.isActive === true,
  }
}

async function submitForm() {
  if (saving.value) return

  const payload = buildPayload()

  if (!payload.code) {
    showError(new Error('Code is required'))
    return
  }

  if (!payload.name) {
    showError(new Error('Name is required'))
    return
  }

  saving.value = true

  try {
    if (formDialog.mode === 'create') {
      await createPosition(payload)
      showSuccess('Position created successfully')
    } else {
      await updatePosition(formDialog.editingCode, payload)
      showSuccess('Position updated successfully')
    }

    formDialog.visible = false
    await reload()
    await fetchReportsToOptions()
  } catch (error) {
    showError(error, 'Failed to save position')
  } finally {
    saving.value = false
  }
}

async function handleDownloadSample() {
  sampleLoading.value = true

  try {
    const response = await downloadPositionImportSample()
    saveBlob(response, getExportFileName(response, 'position-import-sample.xlsx'))
  } catch (error) {
    showError(error, 'Failed to download sample')
  } finally {
    sampleLoading.value = false
  }
}

async function handleExport() {
  exporting.value = true

  try {
    const response = await exportPositionsExcel({
      search: filters.search || '',
      departmentCode: filters.departmentCode || undefined,
      hierarchyScope: filters.hierarchyScope || undefined,
      isActive: typeof filters.isActive === 'boolean' ? filters.isActive : undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    saveBlob(response, getExportFileName(response, 'positions.xlsx'))
  } catch (error) {
    showError(error, 'Failed to export positions')
  } finally {
    exporting.value = false
  }
}

function openImportDialog() {
  selectedFile.value = null
  importDialog.visible = true

  nextTick(() => {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  })
}

function onFileChange(event) {
  selectedFile.value = event.target.files?.[0] || null
}

async function handleImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true

  try {
    const response = await importPositionsExcel(selectedFile.value)
    const data = response.data?.data || {}

    showSuccess(
      `Import completed. Success: ${data.successCount || 0}, Failed: ${data.failedCount || 0}`,
    )

    importDialog.visible = false
    selectedFile.value = null

    await reload()
    await fetchReportsToOptions()
  } catch (error) {
    showError(error, 'Failed to import positions')
  } finally {
    importing.value = false
  }
}

function setupObserver() {
  if (observer.value) {
    observer.value.disconnect()
  }

  observer.value = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]

      if (!entry?.isIntersecting) return
      if (!pagination.hasMore) return
      if (loading.value || loadingMore.value) return

      pagination.page += 1
      fetchRows({ append: true })
    },
    {
      root: null,
      threshold: 0.1,
    },
  )

  if (sentinelRef.value) {
    observer.value.observe(sentinelRef.value)
  }
}

let filterTimer = null

watch(
  () => [
    filters.search,
    filters.departmentCode,
    filters.hierarchyScope,
    filters.isActive,
  ],
  () => {
    window.clearTimeout(filterTimer)
    filterTimer = window.setTimeout(() => {
      reload()
    }, 300)
  },
)

onMounted(async () => {
  await Promise.all([
    fetchDepartments(),
    fetchRows(),
  ])

  await nextTick()
  setupObserver()
})

onBeforeUnmount(() => {
  window.clearTimeout(filterTimer)

  if (observer.value) {
    observer.value.disconnect()
  }
})
</script>