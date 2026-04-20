<!-- frontend/src/modules/org/views/EmployeeView.vue -->
<script setup>
// frontend/src/modules/org/views/EmployeeView.vue
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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

import EmployeeImportDialog from '@/modules/org/components/EmployeeImportDialog.vue'
import { getDepartments } from '@/modules/org/department.api'
import { getPositions } from '@/modules/org/position.api'
import {
  createEmployee,
  exportEmployeesExcel,
  getEmployees,
  updateEmployee,
} from '@/modules/org/employee.api'
import { getShifts } from '@/modules/shift/shift.api'

const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const exporting = ref(false)
const loadingDepartments = ref(false)
const loadingPositions = ref(false)
const loadingManagers = ref(false)
const loadingShifts = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const employeeDialogVisible = ref(false)
const editingEmployeeId = ref('')

const importDialogVisible = ref(false)

const departmentOptions = ref([])
const positionOptions = ref([])
const managerOptions = ref([])
const shiftOptions = ref([])

const filters = reactive({
  search: '',
  departmentId: '',
  positionId: '',
  shiftId: '',
  isActive: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  employeeNo: '',
  displayName: '',
  departmentId: '',
  positionId: '',
  shiftId: '',
  reportsToEmployeeId: '',
  phone: '',
  email: '',
  joinDate: '',
  isActive: true,

  accountMode: 'WITHOUT_ACCOUNT',
  hasAccount: false,
  accountLoginId: '',
  accountIsActive: false,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const accountModeOptions = [
  { label: 'Create without account', value: 'WITHOUT_ACCOUNT' },
  { label: 'Create with account', value: 'WITH_ACCOUNT' },
]

const isEditMode = computed(() => !!editingEmployeeId.value)
const totalEmployees = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalEmployees.value}`)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalEmployees.value > PAGE_SIZE)

const wantsCreateAccount = computed(() => {
  return !isEditMode.value && form.accountMode === 'WITH_ACCOUNT'
})

const wantsProvisionAccount = computed(() => {
  return isEditMode.value && !form.hasAccount && form.accountMode === 'WITH_ACCOUNT'
})

const isPhoneRequired = computed(() => {
  return wantsCreateAccount.value || wantsProvisionAccount.value
})

const phonePreviewPassword = computed(() => {
  const employeeNo = String(form.employeeNo || '').trim().toUpperCase()
  const phone = String(form.phone || '').trim()
  if (!employeeNo || !phone) return '-'
  return `${employeeNo}${phone}`
})

const isSaveDisabled = computed(() => {
  if (
    saving.value ||
    !String(form.employeeNo || '').trim() ||
    !String(form.displayName || '').trim() ||
    !String(form.departmentId || '').trim() ||
    !String(form.positionId || '').trim() ||
    !String(form.shiftId || '').trim()
  ) {
    return true
  }

  if (isPhoneRequired.value && !String(form.phone || '').trim()) {
    return true
  }

  return false
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function mapDepartmentOptions(items = []) {
  return items.map((item) => ({
    label: `${item.code} - ${item.name}`,
    value: item._id || item.id,
  }))
}

function mapPositionOptions(items = []) {
  return items.map((item) => ({
    label: `${item.code} - ${item.name}`,
    value: item._id || item.id,
  }))
}

function mapManagerOptions(items = []) {
  return [
    { label: 'No Manager', value: '' },
    ...items
      .filter(Boolean)
      .map((item) => ({
        label: `${item.employeeNo} - ${item.displayName}`,
        value: item._id || item.id,
      })),
  ]
}

function mapShiftOptions(items = []) {
  return items.map((item) => ({
    label: `${item.code} - ${item.name}${item.type ? ` (${item.type})` : ''}`,
    value: item._id || item.id,
  }))
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    departmentId: filters.departmentId,
    positionId: filters.positionId,
    shiftId: filters.shiftId,
    isActive: filters.isActive,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

async function fetchDepartmentsForDropdown() {
  loadingDepartments.value = true
  try {
    const res = await getDepartments({
      page: 1,
      limit: 100,
      search: '',
      isActive: 'true',
      sortField: 'name',
    })
    const payload = normalizePayload(res)
    departmentOptions.value = mapDepartmentOptions(normalizeItems(payload))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Department load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load departments',
      life: 3000,
    })
  } finally {
    loadingDepartments.value = false
  }
}

async function fetchPositionsForDropdown(departmentId = '') {
  loadingPositions.value = true
  try {
    const res = await getPositions({
      page: 1,
      limit: 100,
      search: '',
      departmentId,
      isActive: 'true',
      sortField: 'name',
    })
    const payload = normalizePayload(res)
    positionOptions.value = mapPositionOptions(normalizeItems(payload))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Position load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load positions',
      life: 3000,
    })
  } finally {
    loadingPositions.value = false
  }
}

async function fetchManagersForDropdown() {
  loadingManagers.value = true
  try {
    const res = await getEmployees({
      page: 1,
      limit: 100,
      search: '',
      isActive: 'true',
      sortBy: 'displayName',
      sortOrder: 'asc',
    })
    const payload = normalizePayload(res)
    managerOptions.value = mapManagerOptions(normalizeItems(payload))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Manager load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load managers',
      life: 3000,
    })
  } finally {
    loadingManagers.value = false
  }
}

async function fetchShiftsForDropdown() {
  loadingShifts.value = true
  try {
    const res = await getShifts({
      page: 1,
      limit: 100,
      search: '',
      isActive: true,
      sortBy: 'name',
      sortOrder: 'asc',
    })
    const payload = normalizePayload(res)
    shiftOptions.value = mapShiftOptions(normalizeItems(payload))
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Shift load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load shifts',
      life: 3000,
    })
  } finally {
    loadingShifts.value = false
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getEmployees(buildQuery(page))
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
        'Failed to load employees',
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

function onDepartmentFilterChange() {
  filters.positionId = ''
  fetchPositionsForDropdown(filters.departmentId || '')
  reloadFirstPage({ keepVisible: true })
}

function onPositionChange() {
  reloadFirstPage({ keepVisible: true })
}

function onShiftChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.departmentId = ''
  filters.positionId = ''
  filters.shiftId = ''
  filters.isActive = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1
  fetchPositionsForDropdown('')
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
  editingEmployeeId.value = ''
  form.employeeNo = ''
  form.displayName = ''
  form.departmentId = ''
  form.positionId = ''
  form.shiftId = ''
  form.reportsToEmployeeId = ''
  form.phone = ''
  form.email = ''
  form.joinDate = ''
  form.isActive = true
  form.accountMode = 'WITHOUT_ACCOUNT'
  form.hasAccount = false
  form.accountLoginId = ''
  form.accountIsActive = false
  positionOptions.value = []
}

async function openCreateDialog() {
  resetForm()
  await fetchPositionsForDropdown('')
  employeeDialogVisible.value = true
}

async function openEditDialog(row) {
  editingEmployeeId.value = row?.id || row?._id || ''
  form.employeeNo = row?.employeeNo || ''
  form.displayName = row?.displayName || ''
  form.departmentId =
    row?.departmentId?._id ||
    row?.departmentId?.id ||
    row?.departmentId ||
    ''

  await fetchPositionsForDropdown(form.departmentId)

  form.positionId =
    row?.positionId?._id ||
    row?.positionId?.id ||
    row?.positionId ||
    ''

  form.shiftId =
    row?.shiftId?._id ||
    row?.shiftId?.id ||
    row?.shiftId ||
    ''

  form.reportsToEmployeeId =
    row?.reportsToEmployeeId?._id ||
    row?.reportsToEmployeeId?.id ||
    row?.reportsToEmployeeId ||
    ''

  form.phone = row?.phone || ''
  form.email = row?.email || ''
  form.joinDate = row?.joinDate ? String(row.joinDate).slice(0, 10) : ''
  form.isActive = !!row?.isActive
  form.hasAccount = !!row?.hasAccount
  form.accountLoginId = row?.accountLoginId || ''
  form.accountIsActive = !!row?.accountIsActive
  form.accountMode = 'WITHOUT_ACCOUNT'

  employeeDialogVisible.value = true
}

async function submitEmployee() {
  saving.value = true
  try {
    const payload = {
      employeeNo: String(form.employeeNo || '').trim().toUpperCase(),
      displayName: String(form.displayName || '').trim(),
      departmentId: String(form.departmentId || '').trim(),
      positionId: String(form.positionId || '').trim(),
      shiftId: String(form.shiftId || '').trim(),
      reportsToEmployeeId: String(form.reportsToEmployeeId || '').trim() || null,
      phone: String(form.phone || '').trim(),
      email: String(form.email || '').trim().toLowerCase(),
      joinDate: String(form.joinDate || '').trim() || null,
      isActive: !!form.isActive,
    }

    if (editingEmployeeId.value) {
      payload.provisionAccount = wantsProvisionAccount.value
      await updateEmployee(editingEmployeeId.value, payload)

      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: wantsProvisionAccount.value
          ? 'Employee updated and account provisioned successfully'
          : 'Employee updated successfully',
        life: 2500,
      })
    } else {
      payload.createAccount = wantsCreateAccount.value
      await createEmployee(payload)

      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: wantsCreateAccount.value
          ? 'Employee and account created successfully'
          : 'Employee created successfully',
        life: 2500,
      })
    }

    employeeDialogVisible.value = false
    resetForm()
    await fetchManagersForDropdown()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Update failed' : 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save employee',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

function statusSeverity(active) {
  return active ? 'success' : 'contrast'
}

function accountSeverity(row) {
  return row?.hasAccount ? 'success' : 'warn'
}

function accountStatusLabel(row) {
  return row?.hasAccount ? 'Has Account' : 'No Account'
}

function departmentLabel(row) {
  const dept = row?.departmentId
  if (!dept) return row?.departmentName || '-'
  if (typeof dept === 'string') return row?.departmentName || dept
  return [dept.code, dept.name].filter(Boolean).join(' - ') || row?.departmentName || '-'
}

function positionLabel(row) {
  const pos = row?.positionId
  if (!pos) return row?.positionName || '-'
  if (typeof pos === 'string') return row?.positionName || pos
  return [pos.code, pos.name].filter(Boolean).join(' - ') || row?.positionName || '-'
}

function shiftLabel(row) {
  const code = row?.shiftCode || row?.shiftId?.code || ''
  const name = row?.shiftName || row?.shiftId?.name || ''
  const type = row?.shiftType || row?.shiftId?.type || ''
  const base = [code, name].filter(Boolean).join(' - ')
  return type ? `${base} (${type})` : base || '-'
}

function managerLabel(row) {
  const manager = row?.reportsToEmployeeId
  if (!manager) return row?.reportsToEmployeeName || '-'
  if (typeof manager === 'string') return row?.reportsToEmployeeName || manager
  return [manager.employeeNo, manager.displayName].filter(Boolean).join(' - ') || row?.reportsToEmployeeName || '-'
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
    const res = await exportEmployeesExcel({
      search: String(filters.search || '').trim(),
      departmentId: filters.departmentId,
      positionId: filters.positionId,
      shiftId: filters.shiftId,
      isActive: filters.isActive,
      sortBy: filters.sortField,
      sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, `employees-${Date.now()}.xlsx`)

    toast.add({
      severity: 'success',
      summary: 'Exported',
      detail: 'Employee excel exported successfully',
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
    detail: `Import completed. Created: ${payload?.summary?.created || 0}, Updated: ${payload?.summary?.updated || 0}`,
    life: 3500,
  })

  await fetchManagersForDropdown()
  await reloadFirstPage({ keepVisible: false })
}

watch(
  () => form.departmentId,
  async (newDepartmentId, oldDepartmentId) => {
    if (newDepartmentId === oldDepartmentId) return
    form.positionId = ''
    await fetchPositionsForDropdown(newDepartmentId || '')
  },
)

onMounted(async () => {
  await Promise.all([
    fetchDepartmentsForDropdown(),
    fetchPositionsForDropdown(''),
    fetchShiftsForDropdown(),
    fetchManagersForDropdown(),
  ])
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <EmployeeImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Employees
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Manage employee master records, account provisioning, reporting lines, and assigned shifts.
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
            {{ totalEmployees }}
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
          label="New Employee"
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
              placeholder="Search employee no, name, email, phone"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <Select
              v-model="filters.departmentId"
              :options="[{ label: 'All Departments', value: '' }, ...departmentOptions]"
              optionLabel="label"
              optionValue="value"
              placeholder="Department"
              class="w-full"
              size="small"
              :loading="loadingDepartments"
              @change="onDepartmentFilterChange"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <Select
              v-model="filters.positionId"
              :options="[{ label: 'All Positions', value: '' }, ...positionOptions]"
              optionLabel="label"
              optionValue="value"
              placeholder="Position"
              class="w-full"
              size="small"
              :loading="loadingPositions"
              @change="onPositionChange"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <Select
              v-model="filters.shiftId"
              :options="[{ label: 'All Shifts', value: '' }, ...shiftOptions]"
              optionLabel="label"
              optionValue="value"
              placeholder="Shift"
              class="w-full"
              size="small"
              :loading="loadingShifts"
              @change="onShiftChange"
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
        tableStyle="min-width: 108rem"
        class="employee-table"
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
            No employees found.
          </div>
        </template>

        <Column field="employeeNo" header="Employee No" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.employeeNo || '-' }}</span>
          </template>
        </Column>

        <Column field="displayName" header="Display Name" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.displayName || '-' }}</span>
          </template>
        </Column>

        <Column field="departmentName" header="Department" style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">{{ departmentLabel(data) }}</span>
          </template>
        </Column>

        <Column field="positionName" header="Position" style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">{{ positionLabel(data) }}</span>
          </template>
        </Column>

        <Column header="Shift" style="min-width: 15rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">{{ shiftLabel(data) }}</span>
          </template>
        </Column>

        <Column header="Manager" style="min-width: 15rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">{{ managerLabel(data) }}</span>
          </template>
        </Column>

        <Column field="email" header="Email" style="min-width: 16rem">
          <template #body="{ data }">
            <span v-if="data" class="line-clamp-1">{{ data.email || '-' }}</span>
          </template>
        </Column>

        <Column field="phone" header="Phone" style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.phone || '-' }}</span>
          </template>
        </Column>

        <Column header="Account" style="min-width: 11rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-col gap-1">
              <Tag
                :value="accountStatusLabel(data)"
                :severity="accountSeverity(data)"
                class="ot-status-tag"
              />
              <span
                v-if="data.hasAccount"
                class="text-xs text-[color:var(--ot-text-muted)]"
              >
                {{ data.accountLoginId || '-' }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="joinDate" header="Join Date" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data">
              {{ data.joinDate ? String(data.joinDate).slice(0, 10) : '-' }}
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
      v-model:visible="employeeDialogVisible"
      modal
      :header="isEditMode ? 'Edit Employee' : 'Create Employee'"
      :style="{ width: '60rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Employee No
          </label>
          <InputText
            v-model="form.employeeNo"
            class="w-full"
            placeholder="Example: EMP001"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Display Name
          </label>
          <InputText
            v-model="form.displayName"
            class="w-full"
            placeholder="Example: John Smith"
          />
        </div>

        <div class="space-y-2">
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
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Position
          </label>
          <Select
            v-model="form.positionId"
            :options="positionOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select position"
            class="w-full"
            filter
            :loading="loadingPositions"
            :disabled="!form.departmentId"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Shift
          </label>
          <Select
            v-model="form.shiftId"
            :options="shiftOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select shift"
            class="w-full"
            filter
            :loading="loadingShifts"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Manager
          </label>
          <Select
            v-model="form.reportsToEmployeeId"
            :options="managerOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select manager"
            class="w-full"
            filter
            :loading="loadingManagers"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Join Date
          </label>
          <InputText
            v-model="form.joinDate"
            type="date"
            class="w-full"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Email
          </label>
          <InputText
            v-model="form.email"
            class="w-full"
            placeholder="example@company.com"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Phone
            <span v-if="isPhoneRequired" class="text-red-500">*</span>
          </label>
          <InputText
            v-model="form.phone"
            class="w-full"
            placeholder="Phone number"
            :invalid="isPhoneRequired && !String(form.phone || '').trim()"
          />
          <small
            v-if="isPhoneRequired"
            class="text-[color:var(--ot-text-muted)]"
          >
            Phone is required when account will be created.
          </small>
        </div>

        <div class="space-y-3 rounded-xl border border-[color:var(--ot-border)] p-4 md:col-span-2">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-sm font-semibold text-[color:var(--ot-text)]">
                Account Setup
              </div>
              <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                Backend creates login using employee number and phone only when requested.
              </div>
            </div>

            <Tag
              v-if="isEditMode"
              :value="form.hasAccount ? 'Account exists' : 'No account yet'"
              :severity="form.hasAccount ? 'success' : 'warn'"
              class="ot-status-tag"
            />
          </div>

          <div v-if="!isEditMode" class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Create Mode
            </label>
            <Select
              v-model="form.accountMode"
              :options="accountModeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full md:w-[320px]"
            />
          </div>

          <div
            v-else-if="form.hasAccount"
            class="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] px-4 py-3">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
                Account Status
              </div>
              <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
                Already provisioned
              </div>
            </div>

            <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] px-4 py-3">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
                Login ID
              </div>
              <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
                {{ form.accountLoginId || '-' }}
              </div>
            </div>

            <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] px-4 py-3">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
                Account Active
              </div>
              <div class="mt-1 text-sm font-semibold text-[color:var(--ot-text)]">
                {{ form.accountIsActive ? 'Yes' : 'No' }}
              </div>
            </div>
          </div>

          <div v-else class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Provision Account
            </label>
            <Select
              v-model="form.accountMode"
              :options="accountModeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full md:w-[320px]"
            />
            <small class="text-[color:var(--ot-text-muted)]">
              Choose “Create with account” to provision login for this employee now.
            </small>
          </div>

          <div
            v-if="wantsCreateAccount || wantsProvisionAccount"
            class="grid grid-cols-1 gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30 md:grid-cols-2"
          >
            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                Login ID
              </div>
              <div class="mt-1 text-sm font-bold text-emerald-900 dark:text-emerald-100">
                {{ String(form.employeeNo || '').trim().toUpperCase() || '-' }}
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                Default Password
              </div>
              <div class="mt-1 break-all text-sm font-bold text-emerald-900 dark:text-emerald-100">
                {{ phonePreviewPassword }}
              </div>
            </div>
          </div>
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
            @click="employeeDialogVisible = false"
          />
          <Button
            :label="isEditMode ? 'Save Changes' : 'Create Employee'"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitEmployee"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.employee-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.employee-table .p-datatable-tbody > tr > td) {
  padding: 0.72rem 0.9rem !important;
  height: 72px !important;
}

:deep(.employee-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>