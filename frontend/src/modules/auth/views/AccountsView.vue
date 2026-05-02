<!-- frontend/src/modules/auth/views/AccountsView.vue -->
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
import MultiSelect from 'primevue/multiselect'
import Password from 'primevue/password'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import {
  createAccount,
  getAccounts,
  getEmployeeOptions,
  getRoleOptions,
  resetAccountPassword,
  updateAccount,
} from '@/modules/auth/account.api'

const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const resetting = ref(false)
const loadingOptions = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const employeeOptions = ref([])
const roleOptions = ref([])

const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const resetDialogVisible = ref(false)
const selectedAccount = ref(null)

const filters = reactive({
  search: '',
  isActive: '',
})

const createForm = reactive({
  loginId: '',
  password: '',
  displayName: '',
  employeeId: null,
  roleIds: [],
  directPermissionCodes: [],
  mustChangePassword: false,
  isActive: true,
})

const editForm = reactive({
  loginId: '',
  displayName: '',
  employeeId: null,
  roleIds: [],
  directPermissionCodes: [],
  mustChangePassword: false,
  isActive: true,
})

const resetForm = reactive({
  newPassword: '',
  mustChangePassword: true,
})

const directPermissionInput = ref('')
const editDirectPermissionInput = ref('')

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const yesNoOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
]

const totalAccounts = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalAccounts.value}`)

const isCreateDisabled = computed(() => {
  return (
    saving.value ||
    !String(createForm.loginId || '').trim() ||
    !String(createForm.password || '').trim() ||
    !String(createForm.displayName || '').trim()
  )
})

const isEditDisabled = computed(() => {
  return (
    saving.value ||
    !String(editForm.loginId || '').trim() ||
    !String(editForm.displayName || '').trim()
  )
})

const isResetDisabled = computed(() => {
  return resetting.value || !String(resetForm.newPassword || '').trim()
})

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalAccounts.value > PAGE_SIZE)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeId(row) {
  return row?.id || row?._id || ''
}

function normalizeRefId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  return value?.id || value?._id || null
}

function employeeLabel(item = {}) {
  const employeeNo = String(item?.employeeNo || '').trim()
  const displayName = String(item?.displayName || '').trim()
  return [employeeNo, displayName].filter(Boolean).join(' - ') || 'Unnamed Employee'
}

function normalizeEmployeeOptions(payload) {
  const items = normalizeItems(payload)

  return items.map((item) => ({
    label: employeeLabel(item),
    value: normalizeId(item),
  }))
}

function normalizeRoleOptions(payload) {
  const items = normalizeItems(payload)

  return items.map((item) => ({
    label: item?.displayName || item?.name || item?.title || item?.code || 'Unnamed Role',
    value: item?.id || item?._id,
  }))
}

function normalizePermissionCodes(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map((v) => String(v || '').trim().toUpperCase()).filter(Boolean))]
}

function permissionChips(input) {
  return normalizePermissionCodes(String(input || '').split(','))
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: filters.isActive,
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getAccounts(buildQuery(page))
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
        'Failed to load accounts',
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

async function fetchOptions() {
  loadingOptions.value = true

  try {
    const [employeeResult, roleResult] = await Promise.allSettled([
      getEmployeeOptions({ page: 1, limit: 100, isActive: true }),
      getRoleOptions({ page: 1, limit: 100, isActive: true }),
    ])

    if (employeeResult.status === 'fulfilled') {
      employeeOptions.value = normalizeEmployeeOptions(normalizePayload(employeeResult.value))
    } else {
      employeeOptions.value = []
      toast.add({
        severity: 'warn',
        summary: 'Reference data',
        detail: 'Employee options could not be loaded',
        life: 3000,
      })
    }

    if (roleResult.status === 'fulfilled') {
      roleOptions.value = normalizeRoleOptions(normalizePayload(roleResult.value))
    } else {
      roleOptions.value = []
      toast.add({
        severity: 'warn',
        summary: 'Reference data',
        detail: 'Role options could not be loaded',
        life: 3000,
      })
    }
  } finally {
    loadingOptions.value = false
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

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.isActive = ''
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

function resetCreateForm() {
  createForm.loginId = ''
  createForm.password = ''
  createForm.displayName = ''
  createForm.employeeId = null
  createForm.roleIds = []
  createForm.directPermissionCodes = []
  createForm.mustChangePassword = false
  createForm.isActive = true
  directPermissionInput.value = ''
}

function resetEditForm() {
  editForm.loginId = ''
  editForm.displayName = ''
  editForm.employeeId = null
  editForm.roleIds = []
  editForm.directPermissionCodes = []
  editForm.mustChangePassword = false
  editForm.isActive = true
  editDirectPermissionInput.value = ''
}

function resetResetForm() {
  resetForm.newPassword = ''
  resetForm.mustChangePassword = true
}

function openCreateDialog() {
  resetCreateForm()
  createDialogVisible.value = true
}

function openEditDialog(row) {
  selectedAccount.value = row
  editForm.loginId = row?.loginId || ''
  editForm.displayName = row?.displayName || ''
  editForm.employeeId = normalizeRefId(row?.employeeId)
  editForm.roleIds = Array.isArray(row?.roleIds) ? [...row.roleIds] : []
  editForm.directPermissionCodes = Array.isArray(row?.directPermissionCodes)
    ? [...row.directPermissionCodes]
    : []
  editForm.mustChangePassword = !!row?.mustChangePassword
  editForm.isActive = !!row?.isActive
  editDirectPermissionInput.value = editForm.directPermissionCodes.join(', ')
  editDialogVisible.value = true
}

function openResetDialog(row) {
  selectedAccount.value = row
  resetResetForm()
  resetDialogVisible.value = true
}

async function submitCreate() {
  saving.value = true
  try {
    await createAccount({
      loginId: String(createForm.loginId || '').trim(),
      password: createForm.password,
      displayName: String(createForm.displayName || '').trim(),
      employeeId: createForm.employeeId || null,
      roleIds: Array.isArray(createForm.roleIds) ? createForm.roleIds : [],
      directPermissionCodes: permissionChips(directPermissionInput.value),
      mustChangePassword: !!createForm.mustChangePassword,
      isActive: !!createForm.isActive,
    })

    createDialogVisible.value = false
    resetCreateForm()

    toast.add({
      severity: 'success',
      summary: 'Created',
      detail: 'Account created successfully',
      life: 2500,
    })

    await fetchOptions()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create account',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

async function submitEdit() {
  const accountId = normalizeId(selectedAccount.value)
  if (!accountId) return

  saving.value = true
  try {
    await updateAccount(accountId, {
      loginId: String(editForm.loginId || '').trim(),
      displayName: String(editForm.displayName || '').trim(),
      employeeId: editForm.employeeId || null,
      roleIds: Array.isArray(editForm.roleIds) ? editForm.roleIds : [],
      directPermissionCodes: permissionChips(editDirectPermissionInput.value),
      mustChangePassword: !!editForm.mustChangePassword,
      isActive: !!editForm.isActive,
    })

    editDialogVisible.value = false
    resetEditForm()

    toast.add({
      severity: 'success',
      summary: 'Updated',
      detail: 'Account updated successfully',
      life: 2500,
    })

    await fetchOptions()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Update failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update account',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

async function submitResetPassword() {
  const accountId = normalizeId(selectedAccount.value)
  if (!accountId) return

  resetting.value = true
  try {
    await resetAccountPassword(accountId, {
      newPassword: resetForm.newPassword,
      mustChangePassword: !!resetForm.mustChangePassword,
    })

    resetDialogVisible.value = false
    resetResetForm()

    toast.add({
      severity: 'success',
      summary: 'Password reset',
      detail: 'Password reset successfully',
      life: 2500,
    })

    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Reset failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to reset password',
      life: 3500,
    })
  } finally {
    resetting.value = false
  }
}

function statusSeverity(active) {
  return active ? 'success' : 'contrast'
}

function yesNoSeverity(value) {
  return value ? 'warn' : 'contrast'
}

function formatRoleNames(roleIds = []) {
  if (!Array.isArray(roleIds) || !roleIds.length) return '-'

  const labelMap = new Map(roleOptions.value.map((item) => [item.value, item.label]))
  return roleIds.map((id) => labelMap.get(id) || id).join(', ')
}

function formatEmployeeName(employeeValue) {
  if (!employeeValue) return '-'

  if (typeof employeeValue === 'object') {
    return employeeLabel(employeeValue)
  }

  const found = employeeOptions.value.find((item) => item.value === employeeValue)
  return found?.label || '-'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

onMounted(async () => {
  await fetchOptions()
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
          label="New Account"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[320px] xl:shrink-0">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filters.search"
              placeholder="Search login ID or display name"
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
        scrollable
        scrollHeight="500px"
        tableStyle="min-width: 96rem"
        class="accounts-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 72,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No accounts found.
          </div>
        </template>

        <Column field="loginId" header="Login ID" style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.loginId || '-' }}</span>
          </template>
        </Column>

        <Column field="displayName" header="Display Name" style="min-width: 12rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.displayName || '-' }}</span>
          </template>
        </Column>

        <Column header="Employee" style="min-width: 16rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatEmployeeName(data.employeeId) }}</span>
          </template>
        </Column>

        <Column header="Roles" style="min-width: 18rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-2">
              {{ formatRoleNames(data.roleIds) }}
            </span>
          </template>
        </Column>

        <Column header="Direct Permissions" style="min-width: 18rem">
          <template #body="{ data }">
            <div
              v-if="data && Array.isArray(data.directPermissionCodes) && data.directPermissionCodes.length"
              class="flex flex-wrap gap-1"
            >
              <Tag
                v-for="code in data.directPermissionCodes"
                :key="code"
                :value="code"
                severity="info"
                class="ot-status-tag"
              />
            </div>
            <span v-else-if="data">-</span>
          </template>
        </Column>

        <Column header="Must Change" style="min-width: 8rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.mustChangePassword ? 'Yes' : 'No'"
              :severity="yesNoSeverity(data.mustChangePassword)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column header="Status" style="min-width: 8rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.isActive ? 'Active' : 'Inactive'"
              :severity="statusSeverity(data.isActive)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column header="Created At" style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>

        <Column header="Actions" style="width: 13rem; min-width: 13rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-wrap gap-2">
              <Button
                label="Edit"
                icon="pi pi-pencil"
                size="small"
                outlined
                @click="openEditDialog(data)"
              />
              <Button
                label="Reset"
                icon="pi pi-key"
                size="small"
                severity="danger"
                outlined
                @click="openResetDialog(data)"
              />
            </div>
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
      v-model:visible="createDialogVisible"
      modal
      header="Create Account"
      :style="{ width: '52rem', maxWidth: '96vw' }"
      @hide="resetCreateForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Login ID
          </label>
          <InputText
            v-model="createForm.loginId"
            class="w-full"
            placeholder="Example: root_admin"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Display Name
          </label>
          <InputText
            v-model="createForm.displayName"
            class="w-full"
            placeholder="Example: System Root Admin"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Password
          </label>
          <Password
            v-model="createForm.password"
            class="w-full"
            inputClass="w-full"
            toggleMask
            :feedback="false"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Employee
          </label>
          <Select
            v-model="createForm.employeeId"
            :options="employeeOptions"
            optionLabel="label"
            optionValue="value"
            filter
            showClear
            placeholder="Select employee"
            class="w-full"
            :loading="loadingOptions"
            :disabled="!employeeOptions.length"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Roles
          </label>
          <MultiSelect
            v-model="createForm.roleIds"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            filter
            display="chip"
            placeholder="Select roles"
            class="w-full"
            :loading="loadingOptions"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Direct Permission Codes
          </label>
          <InputText
            v-model="directPermissionInput"
            class="w-full"
            placeholder="Example: ACCOUNT_VIEW, ACCOUNT_CREATE"
          />
          <p class="text-xs text-[color:var(--ot-text-muted)]">
            Separate permission codes with commas.
          </p>
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Must change password on first login
          </span>
          <InputSwitch v-model="createForm.mustChangePassword" />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Active Status
          </span>
          <InputSwitch v-model="createForm.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="createDialogVisible = false"
          />
          <Button
            label="Create Account"
            :loading="saving"
            :disabled="isCreateDisabled"
            size="small"
            @click="submitCreate"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="editDialogVisible"
      modal
      header="Edit Account"
      :style="{ width: '52rem', maxWidth: '96vw' }"
      @hide="resetEditForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Login ID
          </label>
          <InputText
            v-model="editForm.loginId"
            class="w-full"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Display Name
          </label>
          <InputText
            v-model="editForm.displayName"
            class="w-full"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Employee
          </label>
          <Select
            v-model="editForm.employeeId"
            :options="employeeOptions"
            optionLabel="label"
            optionValue="value"
            filter
            showClear
            placeholder="Select employee"
            class="w-full"
            :loading="loadingOptions"
            :disabled="!employeeOptions.length"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Must Change Password
          </label>
          <Select
            v-model="editForm.mustChangePassword"
            :options="yesNoOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Roles
          </label>
          <MultiSelect
            v-model="editForm.roleIds"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            filter
            display="chip"
            placeholder="Select roles"
            class="w-full"
            :loading="loadingOptions"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Direct Permission Codes
          </label>
          <InputText
            v-model="editDirectPermissionInput"
            class="w-full"
            placeholder="Example: ACCOUNT_VIEW, ACCOUNT_CREATE"
          />
        </div>

        <div class="md:col-span-2 flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Active Status
          </span>
          <InputSwitch v-model="editForm.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="editDialogVisible = false"
          />
          <Button
            label="Save Changes"
            :loading="saving"
            :disabled="isEditDisabled"
            size="small"
            @click="submitEdit"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="resetDialogVisible"
      modal
      header="Reset Password"
      :style="{ width: '34rem', maxWidth: '95vw' }"
      @hide="resetResetForm"
    >
      <div class="space-y-5">
        <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          Resetting password for <strong>{{ selectedAccount?.loginId }}</strong>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            New Password
          </label>
          <Password
            v-model="resetForm.newPassword"
            class="w-full"
            inputClass="w-full"
            toggleMask
            :feedback="false"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Force password change after reset
          </span>
          <InputSwitch v-model="resetForm.mustChangePassword" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="resetDialogVisible = false"
          />
          <Button
            label="Reset Password"
            severity="danger"
            :loading="resetting"
            :disabled="isResetDisabled"
            size="small"
            @click="submitResetPassword"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.accounts-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.accounts-table .p-datatable-tbody > tr > td) {
  padding: 0.72rem 0.9rem !important;
  height: 72px !important;
}

:deep(.accounts-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>