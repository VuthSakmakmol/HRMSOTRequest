<!-- frontend/src/modules/access/views/SystemRoleView.vue -->
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

import RolePermissionSelector from '@/modules/access/components/RolePermissionSelector.vue'
import RolePermissionSummary from '@/modules/access/components/RolePermissionSummary.vue'
import {
  createSystemRole,
  getPermissionOptions,
  getSystemRoles,
  updateSystemRole,
} from '@/modules/access/systemRole.api'

const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const permissionLoading = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const roleDialogVisible = ref(false)
const editingRoleId = ref('')

const permissionOptions = ref([])

const filters = reactive({
  search: '',
  isActive: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  code: '',
  displayName: '',
  permissionIds: [],
  isActive: true,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const isEditMode = computed(() => !!editingRoleId.value)
const totalRoles = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalRoles.value}`)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRoles.value > PAGE_SIZE)
const selectedPermissionCount = computed(() =>
  Array.isArray(form.permissionIds) ? form.permissionIds.length : 0,
)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.displayName || '').trim()
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

function normalizePermissionItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload)) return payload
  return []
}

function mapPermissionOption(item) {
  const id = String(item?.id || item?._id || '')
  const code = String(item?.code || '').trim()
  const name = String(item?.name || '').trim()
  const module = String(item?.module || '').trim()

  return {
    value: id,
    code,
    name,
    module,
    description: String(item?.description || '').trim(),
    isActive: !!item?.isActive,
  }
}

function normalizeRolePermissionIds(row) {
  if (Array.isArray(row?.permissionIds) && row.permissionIds.length) {
    return row.permissionIds.map((v) => String(v))
  }

  if (Array.isArray(row?.permissions) && row.permissions.length) {
    return row.permissions
      .map((item) => String(item?.id || item?._id || ''))
      .filter(Boolean)
  }

  return []
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

async function fetchPermissions() {
  permissionLoading.value = true
  try {
    const res = await getPermissionOptions({
      page: 1,
      limit: 500,
      isActive: true,
    })

    const payload = normalizePayload(res)
    const items = normalizePermissionItems(payload)
    permissionOptions.value = items.map(mapPermissionOption)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Permissions load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load permissions',
      life: 3000,
    })
  } finally {
    permissionLoading.value = false
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getSystemRoles(buildQuery(page))
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
        'Failed to load roles',
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
  editingRoleId.value = ''
  form.code = ''
  form.displayName = ''
  form.permissionIds = []
  form.isActive = true
}

async function openCreateDialog() {
  resetForm()

  if (!permissionOptions.value.length) {
    await fetchPermissions()
  }

  roleDialogVisible.value = true
}

async function openEditDialog(row) {
  editingRoleId.value = row?.id || row?._id || ''
  form.code = row?.code || ''
  form.displayName = row?.displayName || ''
  form.permissionIds = normalizeRolePermissionIds(row)
  form.isActive = !!row?.isActive

  if (!permissionOptions.value.length) {
    await fetchPermissions()
  }

  roleDialogVisible.value = true
}

async function submitRole() {
  saving.value = true
  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      displayName: String(form.displayName || '').trim(),
      permissionIds: Array.isArray(form.permissionIds)
        ? [...new Set(form.permissionIds.map((v) => String(v)).filter(Boolean))]
        : [],
      isActive: !!form.isActive,
    }

    if (editingRoleId.value) {
      await updateSystemRole(editingRoleId.value, payload)
      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Role updated successfully',
        life: 2500,
      })
    } else {
      await createSystemRole(payload)
      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Role created successfully',
        life: 2500,
      })
    }

    roleDialogVisible.value = false
    resetForm()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Save failed' : 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save role',
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

onMounted(async () => {
  await Promise.all([
    reloadFirstPage({ keepVisible: false }),
    fetchPermissions(),
  ])
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Roles
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Manage system role master records and assign permissions by module.
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
            {{ totalRoles }}
          </div>
        </div>

        <Button
          label="New Role"
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
              placeholder="Search role code or display name"
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
        tableStyle="min-width: 74rem"
        class="role-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 76,
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
            No roles found.
          </div>
        </template>

        <Column field="code" header="Code" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data" class="font-medium">
              {{ data.code || '-' }}
            </span>
          </template>
        </Column>

        <Column field="displayName" header="Display Name" sortable style="min-width: 15rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.displayName || '-' }}</span>
          </template>
        </Column>

        <Column header="Permissions by Module" style="min-width: 28rem">
          <template #body="{ data }">
            <RolePermissionSummary
              v-if="data"
              :groups="data.permissionGroups || []"
              :maxPerModule="4"
            />
          </template>
        </Column>

        <Column header="Count" style="min-width: 6rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="String(data.permissionCount || 0)"
              severity="contrast"
              class="ot-count-tag"
            />
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
      v-model:visible="roleDialogVisible"
      modal
      :header="isEditMode ? 'Edit Role' : 'Create Role'"
      :style="{ width: '76rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Role Code
          </label>
          <InputText
            v-model="form.code"
            class="w-full"
            placeholder="Example: SYSTEM_ADMIN"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Display Name
          </label>
          <InputText
            v-model="form.displayName"
            class="w-full"
            placeholder="Example: System Administrator"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3 md:col-span-2">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Active Status
          </span>
          <InputSwitch v-model="form.isActive" />
        </div>

        <div class="space-y-3 md:col-span-2">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label class="text-sm font-medium text-[color:var(--ot-text)]">
                Permissions by Module
              </label>
              <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
                Select permissions clearly by module to avoid confusing role setup.
              </p>
            </div>

            <Tag
              :value="`${selectedPermissionCount} selected`"
              severity="contrast"
              class="ot-count-tag"
            />
          </div>

          <RolePermissionSelector
            v-model="form.permissionIds"
            :options="permissionOptions"
            :loading="permissionLoading"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="roleDialogVisible = false"
          />
          <Button
            :label="isEditMode ? 'Save Changes' : 'Create Role'"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitRole"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.role-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.role-table .p-datatable-tbody > tr > td) {
  padding: 0.72rem 0.9rem !important;
  height: 76px !important;
  vertical-align: middle !important;
}

:deep(.role-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

:deep(.p-tag.ot-count-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>