<!-- frontend/src/modules/org/views/EmployeeView.vue -->
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
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import EmployeeImportDialog from '@/modules/org/components/EmployeeImportDialog.vue'
import { getDepartmentLookupOptions } from '@/modules/org/department.api'
import { getPositionLookupOptions } from '@/modules/org/position.api'
import { getLineLookupOptions } from '@/modules/org/line.api'
import {
  createEmployee,
  exportEmployeesExcel,
  getEmployeeLookupOptions,
  getEmployees,
  updateEmployee,
} from '@/modules/org/employee.api'
import { getShiftLookupOptions } from '@/modules/shift/shift.api'
import { useAuthStore } from '@/modules/auth/auth.store'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { buildSaveErrorMessage, getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate, formatDateTime, toApiDate } from '@/shared/utils/dateFormat'

const toast = useToast()
const auth = useAuthStore()
const { t } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const exporting = ref(false)

const loadingDepartments = ref(false)
const loadingPositions = ref(false)
const loadingLines = ref(false)
const loadingManagers = ref(false)
const loadingShifts = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const employeeDialogVisible = ref(false)
const importDialogVisible = ref(false)
const editingEmployeeId = ref('')

const departmentOptions = ref([])
const positionOptions = ref([])
const lineOptions = ref([])
const managerOptions = ref([])
const shiftOptions = ref([])

const filters = reactive({
  search: '',
  departmentId: '',
  positionId: '',
  lineId: '',
  shiftId: '',
  isActive: '',
  sortBy: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  employeeCode: '',
  displayName: '',
  departmentId: '',
  positionId: '',
  lineId: null,
  shiftId: '',
  reportsToEmployeeId: null,
  otWorkflowRole: 'NONE',
  phone: '',
  email: '',
  joinDate: '',
  createAccount: false,
  accountLoginId: '',
  accountPassword: '',
  accountMustChangePassword: true,
  accountIsActive: true,
  hasAccount: false,
  currentAccountLoginId: '',
  isActive: true,
})

const canCreate = computed(() => auth.hasPermission('EMPLOYEE_CREATE'))
const canUpdate = computed(() => auth.hasPermission('EMPLOYEE_UPDATE'))

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const departmentFilterOptions = computed(() => [
  { label: t('org.employee.allDepartments'), value: '' },
  ...departmentOptions.value,
])

const positionFilterOptions = computed(() => [
  { label: t('org.employee.allPositions'), value: '' },
  ...positionOptions.value,
])

const lineFilterOptions = computed(() => [
  { label: t('org.employee.allLines'), value: '' },
  ...lineOptions.value,
])

const shiftFilterOptions = computed(() => [
  { label: t('org.employee.allShifts'), value: '' },
  ...shiftOptions.value,
])

const otWorkflowRoleOptions = computed(() => [
  { label: t('org.employee.otWorkflowRole.none'), value: 'NONE' },
  { label: t('org.employee.otWorkflowRole.approver'), value: 'APPROVER' },
  { label: t('org.employee.otWorkflowRole.acknowledge'), value: 'ACKNOWLEDGE' },
])

const generatedAccountLoginId = computed(() =>
  String(form.accountLoginId || form.employeeCode || '').trim().toLowerCase(),
)

const generatedAccountPassword = computed(() => {
  const explicitPassword = String(form.accountPassword || '').trim()

  if (explicitPassword) return explicitPassword

  const employeeCode = String(form.employeeCode || '').trim().toUpperCase()
  const phone = String(form.phone || '').trim().replace(/\s+/g, '')

  if (!employeeCode || !phone) return ''

  return `${employeeCode}${phone}`
})

const accountPreviewText = computed(() => {
  if (form.hasAccount) {
    return t('org.employee.accountAlreadyExists')
  }

  if (!form.createAccount) return t('org.employee.accountDefaultNoAccount')

  return t('org.employee.accountPreview', {
    loginId: generatedAccountLoginId.value || '-',
    password: generatedAccountPassword.value || '-',
  })
})

const showCreateAccountFields = computed(() => !form.hasAccount && form.createAccount)

const isEditMode = computed(() => !!editingEmployeeId.value)
const totalEmployees = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalEmployees.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalEmployees.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('org.employee.editTitle') : t('org.employee.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('org.employee.createTitle'),
)

const isSaveDisabled = computed(() => {
  if (
    saving.value ||
    !String(form.employeeCode || '').trim() ||
    !String(form.displayName || '').trim() ||
    !String(form.departmentId || '').trim() ||
    !String(form.positionId || '').trim() ||
    !String(form.shiftId || '').trim()
  ) {
    return true
  }

  if (!form.hasAccount && form.createAccount) {
    return (
      !generatedAccountLoginId.value ||
      !String(form.phone || '').trim() ||
      !generatedAccountPassword.value ||
      generatedAccountPassword.value.length < 6
    )
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

function normalizeTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function normalizeId(row) {
  return String(row?.id || row?._id || row?.employeeId || '').trim()
}

function normalizeRefId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  return value?.id || value?._id || value?.employeeId || null
}

function buildLabel(...parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' - ')
}

function mapDepartmentOptions(items = []) {
  return items
    .map((item) => ({
      label: item.label || buildLabel(item.code, item.name),
      value: normalizeId(item),
    }))
    .filter((item) => item.value)
}

function mapPositionOptions(items = []) {
  return items
    .map((item) => ({
      label: item.label || buildLabel(item.code, item.name),
      value: normalizeId(item),
      code: item.code || '',
      name: item.name || '',
      departmentId: item.departmentId || null,
      reportsToPositionId: item.reportsToPositionId || null,
      reportsToPositionCode: item.reportsToPositionCode || '',
      reportsToPositionName: item.reportsToPositionName || '',
      hierarchyScope: item.hierarchyScope || item.managerScope || 'SAME_LINE',
      managerScope: item.hierarchyScope || item.managerScope || 'SAME_LINE',
    }))
    .filter((item) => item.value)
}

function mapLineOptions(items = []) {
  return items
    .map((item) => ({
      label: item.label || buildLabel(item.code, item.name),
      value: normalizeId(item),
      code: item.code || '',
      name: item.name || '',
      departmentId: item.departmentId || null,
    }))
    .filter((item) => item.value)
}

function mapShiftOptions(items = []) {
  return items
    .map((item) => {
      const code = item.code || item.shiftCode || ''
      const name = item.name || item.shiftName || ''
      const type = item.type || item.shiftType || ''
      const time =
        item.startTime && item.endTime
          ? `${item.startTime}-${item.endTime}`
          : ''

      return {
        label:
          item.label ||
          [buildLabel(code, name), type, time].filter(Boolean).join(' · '),
        value: normalizeId(item) || item.shiftId,
      }
    })
    .filter((item) => item.value)
}

function mapManagerOptions(items = []) {
  return [
    { label: t('org.employee.noManager'), value: null },
    ...items
      .filter(Boolean)
      .filter((item) => {
        const itemId = normalizeId(item)
        return !editingEmployeeId.value || itemId !== editingEmployeeId.value
      })
      .map((item) => ({
        label: item.label || buildLabel(item.employeeCode, item.displayName),
        value: normalizeId(item),
      }))
      .filter((item) => item.value),
  ]
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    departmentId: filters.departmentId,
    positionId: filters.positionId,
    lineId: filters.lineId,
    shiftId: filters.shiftId,
    isActive: filters.isActive,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

async function fetchDepartmentsForDropdown(search = '') {
  loadingDepartments.value = true

  try {
    const res = await getDepartmentLookupOptions({
      limit: 100,
      search: String(search || '').trim(),
      isActive: true,
    })

    departmentOptions.value = mapDepartmentOptions(normalizeItems(normalizePayload(res)))
  } catch (error) {
    showToast(
      'error',
      t('org.employee.departmentLoadFailed'),
      getApiErrorMessage(error, t('org.employee.departmentLoadFailed')),
    )
  } finally {
    loadingDepartments.value = false
  }
}

async function fetchPositionsForDropdown(departmentId = '', search = '') {
  loadingPositions.value = true

  try {
    const res = await getPositionLookupOptions({
      limit: 100,
      search: String(search || '').trim(),
      departmentId: String(departmentId || '').trim(),
      isActive: true,
    })

    positionOptions.value = mapPositionOptions(normalizeItems(normalizePayload(res)))
  } catch (error) {
    showToast(
      'error',
      t('org.employee.positionLoadFailed'),
      getApiErrorMessage(error, t('org.employee.positionLoadFailed')),
    )
  } finally {
    loadingPositions.value = false
  }
}

async function fetchLinesForDropdown(departmentId = '', search = '') {
  loadingLines.value = true

  try {
    const res = await getLineLookupOptions({
      page: 1,
      limit: 100,
      search: String(search || '').trim(),
      departmentId: String(departmentId || '').trim(),
      isActive: true,
    })

    lineOptions.value = mapLineOptions(normalizeItems(normalizePayload(res)))
  } catch (error) {
    showToast(
      'error',
      t('org.employee.lineLoadFailed'),
      getApiErrorMessage(error, t('org.employee.lineLoadFailed')),
    )
  } finally {
    loadingLines.value = false
  }
}

async function fetchShiftsForDropdown(search = '') {
  loadingShifts.value = true

  try {
    const res = await getShiftLookupOptions({
      page: 1,
      limit: 100,
      search: String(search || '').trim(),
      isActive: true,
    })

    shiftOptions.value = mapShiftOptions(normalizeItems(normalizePayload(res)))
  } catch (error) {
    showToast(
      'error',
      t('org.employee.shiftLoadFailed'),
      getApiErrorMessage(error, t('org.employee.shiftLoadFailed')),
    )
  } finally {
    loadingShifts.value = false
  }
}

async function fetchManagersForDropdown() {
  loadingManagers.value = true

  try {
    let res

    try {
      res = await getEmployeeLookupOptions({
        page: 1,
        limit: 100,
        search: '',
        isActive: true,
        scope: 'ALL',
      })
    } catch (error) {
      if (Number(error?.response?.status || 0) !== 403) {
        throw error
      }

      res = await getEmployeeLookupOptions({
        page: 1,
        limit: 100,
        search: '',
        isActive: true,
        scope: 'MANAGED',
      })
    }

    managerOptions.value = mapManagerOptions(normalizeItems(normalizePayload(res)))
  } catch (error) {
    showToast(
      'error',
      t('org.employee.managerLoadFailed'),
      getApiErrorMessage(error, t('org.employee.managerLoadFailed')),
    )
  } finally {
    loadingManagers.value = false
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
      getApiErrorMessage(error, t('org.employee.loadFailed')),
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

async function onDepartmentFilterChange() {
  filters.positionId = ''
  filters.lineId = ''

  await Promise.all([
    fetchPositionsForDropdown(filters.departmentId),
    fetchLinesForDropdown(filters.departmentId),
  ])

  await reloadFirstPage({ keepVisible: true })
}

function onPositionFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onLineFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onShiftFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

async function clearFilters() {
  filters.search = ''
  filters.departmentId = ''
  filters.positionId = ''
  filters.lineId = ''
  filters.shiftId = ''
  filters.isActive = ''
  filters.sortBy = 'createdAt'
  filters.sortOrder = -1

  await Promise.all([
    fetchPositionsForDropdown(''),
    fetchLinesForDropdown(''),
  ])

  await reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortBy = event.sortField || 'createdAt'
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
  form.employeeCode = ''
  form.displayName = ''
  form.departmentId = ''
  form.positionId = ''
  form.lineId = null
  form.shiftId = ''
  form.reportsToEmployeeId = null
  form.otWorkflowRole = 'NONE'
  form.phone = ''
  form.email = ''
  form.joinDate = ''
  form.createAccount = false
  form.accountLoginId = ''
  form.accountPassword = ''
  form.accountMustChangePassword = true
  form.accountIsActive = true
  form.hasAccount = false
  form.currentAccountLoginId = ''
  form.isActive = true
}

async function openCreateDialog() {
  resetForm()

  await Promise.all([
    fetchPositionsForDropdown(''),
    fetchLinesForDropdown(''),
    fetchManagersForDropdown(),
  ])

  employeeDialogVisible.value = true
}

async function openEditDialog(row) {
  editingEmployeeId.value = normalizeId(row)

  form.employeeCode = row?.employeeCode || ''
  form.displayName = row?.displayName || ''
  form.departmentId = normalizeRefId(row?.departmentId) || row?.departmentId || ''

  await Promise.all([
    fetchPositionsForDropdown(form.departmentId),
    fetchLinesForDropdown(form.departmentId),
    fetchManagersForDropdown(),
  ])

  form.positionId = normalizeRefId(row?.positionId) || row?.positionId || ''
  form.lineId = normalizeRefId(row?.lineId) || row?.lineId || null
  form.shiftId = normalizeRefId(row?.shiftId) || row?.shiftId || ''
  form.reportsToEmployeeId =
    normalizeRefId(row?.reportsToEmployeeId) ||
    row?.reportsToEmployeeId ||
    null
  form.otWorkflowRole = String(row?.otWorkflowRole || 'NONE').toUpperCase()
  form.phone = row?.phone || ''
  form.email = row?.email || ''
  form.joinDate = row?.joinDate ? toApiDate(row.joinDate, '') : ''
  form.createAccount = false
  form.accountLoginId = ''
  form.accountPassword = ''
  form.accountMustChangePassword = true
  form.accountIsActive = true
  form.hasAccount = !!row?.hasAccount
  form.currentAccountLoginId = row?.accountLoginId || ''
  form.isActive = row?.isActive !== false

  employeeDialogVisible.value = true
}

async function onFormDepartmentChange() {
  form.positionId = ''
  form.lineId = null
  form.reportsToEmployeeId = null

  await Promise.all([
    fetchPositionsForDropdown(form.departmentId),
    fetchLinesForDropdown(form.departmentId),
  ])
}

function onFormPositionChange() {
  form.reportsToEmployeeId = null
}

function onFormLineChange() {
  form.reportsToEmployeeId = null
}

async function submitEmployee() {
  saving.value = true

  try {
    const payload = {
      employeeCode: String(form.employeeCode || '').trim().toUpperCase(),
      displayName: String(form.displayName || '').trim(),
      departmentId: String(form.departmentId || '').trim(),
      positionId: String(form.positionId || '').trim(),
      lineId: form.lineId || null,
      shiftId: String(form.shiftId || '').trim(),
      reportsToEmployeeId: form.reportsToEmployeeId || null,
      otWorkflowRole: String(form.otWorkflowRole || 'NONE').trim().toUpperCase(),
      phone: String(form.phone || '').trim(),
      email: String(form.email || '').trim().toLowerCase(),
      joinDate: String(form.joinDate || '').trim() || null,
      isActive: !!form.isActive,
    }

    const willCreateAccount = !!form.createAccount && !form.hasAccount

    if (willCreateAccount) {
      payload.createAccount = {
        enabled: true,
        loginId: String(form.accountLoginId || '').trim().toLowerCase(),
        password: String(form.accountPassword || '').trim(),
        mustChangePassword: !!form.accountMustChangePassword,
        isActive: !!form.accountIsActive,
      }
    }

    if (editingEmployeeId.value) {
      await updateEmployee(editingEmployeeId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        willCreateAccount
          ? t('org.employee.updatedWithAccountSuccess')
          : t('org.employee.updatedSuccess'),
        3000,
      )
    } else {
      await createEmployee(payload)

      showToast(
        'success',
        t('common.created'),
        willCreateAccount
          ? t('org.employee.createdWithAccountSuccess')
          : t('org.employee.createdSuccess'),
        3000,
      )
    }

    employeeDialogVisible.value = false
    resetForm()

    await fetchManagersForDropdown()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildSaveErrorMessage(error, t('org.employee.saveFailed')),
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
    const res = await exportEmployeesExcel({
      search: String(filters.search || '').trim(),
      departmentId: filters.departmentId,
      positionId: filters.positionId,
      lineId: filters.lineId,
      shiftId: filters.shiftId,
      isActive: filters.isActive,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
    })

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, `employees-${Date.now()}.xlsx`))

    showToast('success', t('org.employee.exported'), t('org.employee.exportedSuccess'), 2500)
  } catch (error) {
    showToast(
      'error',
      t('org.employee.exportFailed'),
      getApiErrorMessage(error, t('org.employee.exportFailed')),
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
    t('org.employee.imported'),
    t('org.employee.importedSuccess', { created, updated }),
    4000,
  )

  await fetchManagersForDropdown()
  await reloadFirstPage({ keepVisible: false })
}

function statusSeverity(active) {
  return active ? 'success' : 'secondary'
}

function accountSeverity(row) {
  return row?.hasAccount ? 'success' : 'warn'
}

function accountStatusLabel(row) {
  return row?.hasAccount ? t('org.employee.hasAccount') : t('org.employee.noAccount')
}

function otWorkflowRoleLabel(value) {
  const role = String(value || 'NONE').toUpperCase()

  if (role === 'APPROVER') return t('org.employee.otWorkflowRole.approver')
  if (role === 'ACKNOWLEDGE') return t('org.employee.otWorkflowRole.acknowledge')

  return t('org.employee.otWorkflowRole.none')
}

function otWorkflowRoleSeverity(value) {
  const role = String(value || 'NONE').toUpperCase()

  if (role === 'APPROVER') return 'success'
  if (role === 'ACKNOWLEDGE') return 'info'

  return 'secondary'
}

function departmentLabel(row) {
  return buildLabel(row?.departmentCode, row?.departmentName) || '-'
}

function positionLabel(row) {
  return buildLabel(row?.positionCode, row?.positionName) || '-'
}

function lineLabel(row) {
  return buildLabel(row?.lineCode, row?.lineName) || '-'
}

function shiftLabel(row) {
  const base = buildLabel(row?.shiftCode, row?.shiftName)
  const type = row?.shiftType || ''
  const time =
    row?.shiftStartTime && row?.shiftEndTime
      ? `${row.shiftStartTime}-${row.shiftEndTime}`
      : ''

  return [base, type, time].filter(Boolean).join(' · ') || '-'
}

function managerLabel(row) {
  const lineManagers = Array.isArray(row?.lineManagers) ? row.lineManagers : []

  if (lineManagers.length) {
    return lineManagers
      .map((manager) => buildLabel(manager.employeeCode, manager.displayName))
      .filter(Boolean)
      .join(', ')
  }

  if (row?.lineManagerNames) {
    return row.lineManagerNames
  }

  return buildLabel(row?.reportsToEmployeeCode, row?.reportsToEmployeeName) || '-'
}

onMounted(async () => {
  await Promise.all([
    fetchDepartmentsForDropdown(),
    fetchPositionsForDropdown(''),
    fetchLinesForDropdown(''),
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
  <div class="ot-page-shell">
    <EmployeeImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar ot-filter-bar-6">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('org.employee.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('nav.departments') }}
        </label>

        <Select
          v-model="filters.departmentId"
          :options="departmentFilterOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          :loading="loadingDepartments"
          @change="onDepartmentFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('nav.positions') }}
        </label>

        <Select
          v-model="filters.positionId"
          :options="positionFilterOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          :loading="loadingPositions"
          @change="onPositionFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('nav.lines') }}
        </label>

        <Select
          v-model="filters.lineId"
          :options="lineFilterOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          :loading="loadingLines"
          @change="onLineFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('nav.shift') }}
        </label>

        <Select
          v-model="filters.shiftId"
          :options="shiftFilterOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          :loading="loadingShifts"
          @change="onShiftFilterChange"
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
          @change="onStatusChange"
        />
      </div>

      <div class="ot-filter-actions xl:col-span-6">
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
          :label="t('org.employee.importExcel')"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          :label="t('org.employee.exportExcel')"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="exporting"
          @click="handleExport"
        />

        <Button
          v-if="canCreate"
          :label="t('org.employee.newEmployee')"
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
            {{ t('org.employee.tableTitle') }}
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
          :columns="12"
          icon="pi pi-users"
        />

        <DataTable
          v-else
          :value="rows"
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortBy"
          :sort-order="filters.sortOrder"
          table-style="min-width: 124rem"
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
                <i class="pi pi-users" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('org.employee.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="employeeCode"
            :header="t('org.employee.employeeCode')"
            sortable
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-bold"
              >
                {{ data.employeeCode || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="displayName"
            :header="t('org.employee.displayName')"
            sortable
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.displayName || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.departments')"
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ departmentLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.positions')"
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ positionLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.lines')"
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ lineLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.shift')"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ shiftLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('org.employee.manager')"
            style="min-width: 22rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
                :title="managerLabel(data)"
              >
                {{ managerLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="otWorkflowRole"
            :header="t('org.employee.otRole')"
            sortable
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="otWorkflowRoleLabel(data.otWorkflowRole)"
                :severity="otWorkflowRoleSeverity(data.otWorkflowRole)"
              />
            </template>
          </Column>

          <Column
            field="email"
            :header="t('org.employee.email')"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ data.email || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="phone"
            :header="t('org.employee.phone')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.phone || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.accounts')"
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-col gap-1"
              >
                <Tag
                  :value="accountStatusLabel(data)"
                  :severity="accountSeverity(data)"
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

          <Column
            field="joinDate"
            :header="t('org.employee.joinDate')"
            sortable
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ data.joinDateText || formatDate(data.joinDate) }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="min-width: 8rem"
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
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ formatDateTime(data.createdAt) }}
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
      v-model:visible="employeeDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '60rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.employeeCode') }}
            </label>

            <InputText
              v-model="form.employeeCode"
              class="w-full"
              :placeholder="t('org.employee.employeeCodeExample')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.displayName') }}
            </label>

            <InputText
              v-model="form.displayName"
              class="w-full"
              :placeholder="t('org.employee.displayNameExample')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.departments') }}
            </label>

            <Select
              v-model="form.departmentId"
              :options="departmentOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('org.employee.selectDepartment')"
              class="w-full"
              filter
              :loading="loadingDepartments"
              @change="onFormDepartmentChange"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.positions') }}
            </label>

            <Select
              v-model="form.positionId"
              :options="positionOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('org.employee.selectPosition')"
              class="w-full"
              filter
              :loading="loadingPositions"
              :disabled="!form.departmentId"
              @change="onFormPositionChange"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.lines') }}
            </label>

            <Select
              v-model="form.lineId"
              :options="lineOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('org.employee.selectLine')"
              class="w-full"
              filter
              show-clear
              :loading="loadingLines"
              :disabled="!form.departmentId"
              @change="onFormLineChange"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.shift') }}
            </label>

            <Select
              v-model="form.shiftId"
              :options="shiftOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('org.employee.selectShift')"
              class="w-full"
              filter
              :loading="loadingShifts"
            />
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('org.employee.manager') }}
          </label>

          <Select
            v-model="form.reportsToEmployeeId"
            :options="managerOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('org.employee.selectManager')"
            class="w-full"
            filter
            show-clear
            :loading="loadingManagers"
          />
        </div>

        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.otRole') }}
            </label>

            <Select
              v-model="form.otWorkflowRole"
              :options="otWorkflowRoleOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.joinDate') }}
            </label>

            <InputText
              v-model="form.joinDate"
              type="date"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.email') }}
            </label>

            <InputText
              v-model="form.email"
              class="w-full"
              placeholder="example@company.com"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.phone') }}
            </label>

            <InputText
              v-model="form.phone"
              class="w-full"
              :placeholder="t('org.employee.phonePlaceholder')"
            />
          </div>
        </div>

        <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] p-4">
          <div
            v-if="form.hasAccount"
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('org.employee.accountAlreadyExists') }}
            </div>

            <Tag
              :value="form.currentAccountLoginId || t('org.employee.hasAccount')"
              severity="success"
            />
          </div>

          <template v-else>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="text-sm font-semibold text-[color:var(--ot-text)]">
                {{ t('org.employee.createLoginAccount') }}
              </div>

              <InputSwitch v-model="form.createAccount" />
            </div>

            <div
              v-if="showCreateAccountFields"
              class="mt-4 space-y-4"
            >
              <div class="ot-form-grid">
                <div class="ot-field">
                  <label class="ot-field-label">
                    {{ t('auth.loginId') }}
                  </label>

                  <InputText
                    v-model="form.accountLoginId"
                    class="w-full"
                    :placeholder="t('org.employee.accountLoginIdPlaceholder')"
                  />
                </div>

                <div class="ot-field">
                  <label class="ot-field-label">
                    {{ t('org.employee.defaultPassword') }}
                  </label>

                  <InputText
                    v-model="form.accountPassword"
                    class="w-full"
                    :placeholder="t('org.employee.defaultPasswordPlaceholder')"
                  />
                </div>
              </div>

              <div
                v-if="!String(form.phone || '').trim()"
                class="ot-inline-error"
              >
                {{ t('org.employee.accountPhoneRequired') }}
              </div>

              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-3">
                  <div class="text-sm font-semibold text-[color:var(--ot-text)]">
                    {{ t('auth.account.forcePasswordChange') }}
                  </div>

                  <InputSwitch v-model="form.accountMustChangePassword" />
                </div>

                <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-3">
                  <div class="text-sm font-semibold text-[color:var(--ot-text)]">
                    {{ t('org.employee.accountActive') }}
                  </div>

                  <InputSwitch v-model="form.accountIsActive" />
                </div>
              </div>

              <div class="ot-inline-info">
                {{ accountPreviewText }}
              </div>
            </div>

            <div
              v-else
              class="ot-inline-info mt-4"
            >
              {{ accountPreviewText }}
            </div>
          </template>
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
            @click="employeeDialogVisible = false"
          />

          <Button
            :label="saveLabel"
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