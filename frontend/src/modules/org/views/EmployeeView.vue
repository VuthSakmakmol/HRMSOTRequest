<!-- frontend/src/modules/org/views/EmployeeView.vue -->
<script setup>
// frontend/src/modules/org/views/EmployeeView.vue

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

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
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
  lineIds: [],
  shiftId: '',
  reportsToEmployeeId: null,
  otWorkflowRole: 'NONE',
  phone: '',
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

  if (!form.createAccount) {
    return t('org.employee.accountDefaultNoAccount')
  }

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
  return String(row?.value || row?._id || row?.id || row?.employeeId || '').trim()
}

function normalizeRefId(value) {
  if (!value) return ''

  if (typeof value === 'string') {
    return value.trim()
  }

  return String(value.value || value._id || value.id || '').trim()
}

function isMongoId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || '').trim())
}

/**
 * Important:
 * This helper is ONLY for line IDs.
 * Do not use employeeId here.
 */
function normalizeLineRefId(value) {
  if (!value) return ''

  if (typeof value === 'string') {
    return value.trim()
  }

  return String(
    value.value ||
      value.lineId ||
      value._id ||
      value.id ||
      '',
  ).trim()
}

function normalizeLineOptionValue(item = {}) {
  return normalizeLineRefId(item)
}

function findLineOptionByAnyValue(value) {
  const raw = String(value || '').trim()

  if (!raw) return null

  return (
    lineOptions.value.find((option) => {
      return [
        option.value,
        option.id,
        option._id,
        option.lineId,
        option.code,
        option.name,
        option.label,
      ]
        .map((item) => String(item || '').trim())
        .includes(raw)
    }) || null
  )
}

function normalizeSelectedLineIds(values = []) {
  const result = []
  const currentEmployeeId = String(editingEmployeeId.value || '').trim()

  for (const value of Array.isArray(values) ? values : []) {
    let raw = normalizeLineRefId(value)

    if (!raw) continue

    // Main protection for your current bug:
    // never allow the employee _id to be sent as a lineId.
    if (currentEmployeeId && raw === currentEmployeeId) {
      continue
    }

    const matched = findLineOptionByAnyValue(raw)
    const matchedValue = normalizeLineOptionValue(matched)

    if (isMongoId(matchedValue)) {
      result.push(matchedValue)
      continue
    }

    // Keep valid Mongo ID only when it does not equal employee ID.
    // This supports existing saved line ids even if the option list is not loaded.
    if (isMongoId(raw)) {
      result.push(raw)
    }
  }

  return [...new Set(result)]
}

function getRowLineIds(row = {}) {
  const values = []

  if (Array.isArray(row.lines) && row.lines.length) {
    values.push(...row.lines)
  }

  if (Array.isArray(row.lineIds) && row.lineIds.length) {
    values.push(...row.lineIds)
  }

  if (row.lineId) {
    values.push(row.lineId)
  }

  return normalizeSelectedLineIds(values)
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
    .map((item) => {
      const value = normalizeLineOptionValue(item)
      const code = item.code || item.lineCode || ''
      const name = item.name || item.lineName || ''
      const label = item.label || buildLabel(code, name) || value

      if (!value) return null

      return {
        label,
        value,
        id: value,
        _id: value,
        lineId: value,
        code,
        name,
        departmentId: item.departmentId || null,
        departmentIds: Array.isArray(item.departmentIds) ? item.departmentIds : [],
        departments: Array.isArray(item.departments) ? item.departments : [],
      }
    })
    .filter(Boolean)
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
  form.lineIds = []
  form.shiftId = ''
  form.reportsToEmployeeId = null
  form.otWorkflowRole = 'NONE'
  form.phone = ''
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

  // Fixed: use real ProductionLine ids only.
  form.lineIds = getRowLineIds(row)

  form.shiftId = normalizeRefId(row?.shiftId) || row?.shiftId || ''
  form.reportsToEmployeeId =
    normalizeRefId(row?.reportsToEmployeeId) ||
    row?.reportsToEmployeeId ||
    null
  form.otWorkflowRole = String(row?.otWorkflowRole || 'NONE').toUpperCase()
  form.phone = row?.phone || ''
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
  form.lineIds = []
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
  form.lineIds = normalizeSelectedLineIds(form.lineIds)
  form.reportsToEmployeeId = null
}

async function submitEmployee() {
  saving.value = true

  try {
    const lineIds = normalizeSelectedLineIds(form.lineIds)

    const payload = {
      employeeCode: String(form.employeeCode || '').trim().toUpperCase(),
      displayName: String(form.displayName || '').trim(),
      departmentId: String(form.departmentId || '').trim(),
      positionId: String(form.positionId || '').trim(),
      lineId: lineIds[0] || null,
      lineIds,
      shiftId: String(form.shiftId || '').trim(),
      reportsToEmployeeId: form.reportsToEmployeeId || null,
      otWorkflowRole: String(form.otWorkflowRole || 'NONE').trim().toUpperCase(),
      phone: String(form.phone || '').trim(),
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

    showToast(
      'success',
      t('org.employee.exported'),
      t('org.employee.exportedSuccess'),
      2500,
    )
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
  const accountsCreated = Number(
    summary.accountsCreated || payload?.accountsCreated || 0,
  )

  showToast(
    'success',
    t('org.employee.imported'),
    t('org.employee.importedSuccess', { created, updated, accountsCreated }),
    4000,
  )

  await fetchManagersForDropdown()
  await reloadFirstPage({ keepVisible: false })
}

function accountStatusLabel(row) {
  return row?.hasAccount ? t('org.employee.hasAccount') : t('org.employee.noAccount')
}

function accountTagClass(row) {
  return row?.hasAccount ? 'employee-account-tag' : 'employee-no-account-tag'
}

function activeTagClass(active) {
  return active ? 'employee-active-tag' : 'employee-inactive-tag'
}

function otWorkflowRoleLabel(value) {
  const role = String(value || 'NONE').toUpperCase()

  if (role === 'APPROVER') return t('org.employee.otWorkflowRole.approver')
  if (role === 'ACKNOWLEDGE') return t('org.employee.otWorkflowRole.acknowledge')

  return t('org.employee.otWorkflowRole.none')
}

function otWorkflowRoleTagClass(value) {
  const role = String(value || 'NONE').toUpperCase()

  if (role === 'APPROVER') return 'employee-ot-approver-tag'
  if (role === 'ACKNOWLEDGE') return 'employee-ot-acknowledge-tag'

  return 'employee-ot-none-tag'
}

function departmentLabel(row) {
  return row?.departmentName || row?.department?.name || row?.departmentCode || '-'
}

function positionLabel(row) {
  return row?.positionName || row?.position?.name || row?.positionCode || '-'
}

function lineLabel(row) {
  const lines = Array.isArray(row?.lines) ? row.lines : []

  if (lines.length) {
    return (
      lines
        .map((line) => line.name || line.lineName || line.label || line.code)
        .filter(Boolean)
        .join(', ') || '-'
    )
  }

  return row?.lineName || row?.linesLabel || row?.lineCode || '-'
}

function shiftLabel(row) {
  return row?.shiftName || row?.shift?.name || row?.shiftCode || '-'
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
  <div class="ot-page-shell employee-page">
    <EmployeeImportDialog
      v-model:visible="importDialogVisible"
      @success="handleImportSuccess"
    />

    <section class="ot-filter-bar employee-filter-bar">
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

      <div class="employee-filter-actions">
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
          table-style="min-width: 100%"
          class="ot-data-table ot-data-table-compact employee-data-table"
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
                class="employee-code-text"
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
              <span
                v-if="data"
                class="employee-name-text"
              >
                {{ data.displayName || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="departmentId"
            :header="t('nav.departments')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ departmentLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="positionId"
            :header="t('nav.positions')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ positionLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="lineId"
            :header="t('nav.lines')"
            style="min-width: 6rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text employee-line-text"
              >
                {{ lineLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="shiftId"
            :header="t('nav.shift')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ shiftLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="reportsToEmployeeId"
            :header="t('org.employee.manager')"
            style="min-width: 15rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ managerLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="otWorkflowRole"
            :header="t('org.employee.otWorkflowRole.title')"
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="otWorkflowRoleLabel(data.otWorkflowRole)"
                class="employee-rgb-tag"
                :class="otWorkflowRoleTagClass(data.otWorkflowRole)"
              />
            </template>
          </Column>

          <Column
            field="phone"
            :header="t('org.employee.phone')"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ data.phone || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.accounts')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="employee-account-stack"
              >
                <Tag
                  :value="accountStatusLabel(data)"
                  class="employee-rgb-tag"
                  :class="accountTagClass(data)"
                />

                <span
                  v-if="data.hasAccount"
                  class="employee-account-login"
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
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ data.joinDateText || formatDate(data.joinDate) }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="min-width: 6rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="data.isActive ? t('common.active') : t('common.inactive')"
                class="employee-rgb-tag"
                :class="activeTagClass(data.isActive)"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ formatDateTime(data.createdAt) }}
              </span>
            </template>
          </Column>

          <Column
            field="updatedAt"
            :header="t('common.updatedAt')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="employee-meta-text"
              >
                {{ formatDateTime(data.updatedAt) }}
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
      v-model:visible="employeeDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '72rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="employee-dialog-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.employeeCode') }}
            </label>

            <InputText
              v-model="form.employeeCode"
              class="w-full"
              :placeholder="t('org.employee.employeeCode')"
              size="small"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.displayName') }}
            </label>

            <InputText
              v-model="form.displayName"
              class="w-full"
              :placeholder="t('org.employee.displayName')"
              size="small"
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
              class="w-full"
              size="small"
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
              class="w-full"
              size="small"
              filter
              :loading="loadingPositions"
              @change="onFormPositionChange"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.lines') }}
            </label>

            <MultiSelect
              v-model="form.lineIds"
              :options="lineOptions"
              option-label="label"
              option-value="value"
              display="chip"
              filter
              class="w-full"
              :loading="loadingLines"
              :placeholder="t('org.employee.selectLines')"
              @change="onFormLineChange"
            />

            <small class="employee-help-text">
              {{ t('org.employee.lineHelp') }}
            </small>
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
              class="w-full"
              size="small"
              filter
              :loading="loadingShifts"
            />
          </div>

          <div class="ot-field employee-dialog-full">
            <label class="ot-field-label">
              {{ t('org.employee.manager') }}
            </label>

            <Select
              v-model="form.reportsToEmployeeId"
              :options="managerOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              size="small"
              filter
              show-clear
              :loading="loadingManagers"
              :placeholder="t('org.employee.selectManager')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.otWorkflowRole.title') }}
            </label>

            <Select
              v-model="form.otWorkflowRole"
              :options="otWorkflowRoleOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              size="small"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.joinDate') }}
            </label>

            <HolidayDatePicker
              v-model="form.joinDate"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('org.employee.phone') }}
            </label>

            <InputText
              v-model="form.phone"
              class="w-full"
              :placeholder="t('org.employee.phone')"
              size="small"
            />
          </div>
        </div>

        <div class="employee-account-card">
          <div class="employee-account-card-header">
            <div>
              <div class="employee-section-title">
                {{ t('nav.accounts') }}
              </div>

              <p class="employee-help-text">
                {{ accountPreviewText }}
              </p>
            </div>

            <Tag
              v-if="form.hasAccount"
              :value="form.currentAccountLoginId || generatedAccountLoginId || '-'"
              rounded
            />
          </div>

          <div
            v-if="!form.hasAccount"
            class="employee-switch-box"
          >
            <span class="employee-section-title">
              {{ t('org.employee.createLoginAccount') }}
            </span>

            <InputSwitch v-model="form.createAccount" />
          </div>

          <div
            v-if="showCreateAccountFields"
            class="employee-dialog-grid employee-account-grid"
          >
            <div class="ot-field">
              <label class="ot-field-label">
                {{ t('org.employee.accountLoginId') }}
              </label>

              <InputText
                v-model="form.accountLoginId"
                class="w-full"
                :placeholder="generatedAccountLoginId || form.employeeCode"
                size="small"
              />
            </div>

            <div class="ot-field">
              <label class="ot-field-label">
                {{ t('org.employee.accountPassword') }}
              </label>

              <InputText
                v-model="form.accountPassword"
                class="w-full"
                :placeholder="generatedAccountPassword || 'EmployeeCodePhone'"
                size="small"
              />
            </div>

            <div class="employee-switch-box">
              <span class="employee-section-title">
                {{ t('org.employee.mustChangePassword') }}
              </span>

              <InputSwitch v-model="form.accountMustChangePassword" />
            </div>

            <div class="employee-switch-box">
              <span class="employee-section-title">
                {{ t('common.active') }}
              </span>

              <InputSwitch v-model="form.accountIsActive" />
            </div>
          </div>
        </div>

        <div class="employee-active-box">
          <span class="employee-section-title">
            {{ t('common.active') }}
          </span>

          <InputSwitch v-model="form.isActive" />
        </div>
      </div>

      <template #footer>
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          text
          :disabled="saving"
          @click="employeeDialogVisible = false"
        />

        <Button
          :label="saveLabel"
          icon="pi pi-check"
          :loading="saving"
          :disabled="isSaveDisabled"
          @click="submitEmployee"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.employee-page {
  --employee-name-rgb: 15, 23, 42;
  --employee-meta-rgb: 71, 85, 105;
  --employee-active-rgb: 16, 185, 129;
  --employee-inactive-rgb: 239, 68, 68;
  --employee-account-rgb: 14, 165, 233;
  --employee-no-account-rgb: 100, 116, 139;
  --employee-ot-approver-rgb: 34, 197, 94;
  --employee-ot-acknowledge-rgb: 168, 85, 247;
  --employee-ot-none-rgb: 100, 116, 139;
}

.employee-filter-bar {
  align-items: end;
}

.employee-filter-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.employee-dialog-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

.employee-dialog-full {
  grid-column: 1 / -1;
}

.employee-account-card {
  margin-top: 1rem;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ot-surface) 92%, transparent);
  padding: 0.85rem;
}

.employee-account-card-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.employee-account-grid {
  margin-top: 0.85rem;
}

.employee-switch-box,
.employee-active-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.75rem 0.9rem;
}

.employee-active-box {
  margin-top: 1rem;
  background: transparent;
}

.employee-section-title {
  color: var(--ot-text);
  font-size: 0.86rem;
  font-weight: 650;
}

.employee-help-text {
  display: block;
  margin-top: 0.25rem;
  color: var(--ot-muted);
  font-size: 0.75rem;
  line-height: 1.35;
}

/* =========================
   Table text center helpers
   ========================= */

.employee-code-text,
.employee-name-text,
.employee-meta-text {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  text-align: center;
  vertical-align: middle;
}

.employee-code-text {
  color: rgb(37, 99, 235);
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.employee-name-text {
  color: rgba(var(--employee-name-rgb), 1);
  font-size: 0.8rem;
  font-weight: 650;
}

.employee-meta-text {
  color: rgba(var(--employee-meta-rgb), 1);
  font-size: 0.76rem;
  font-weight: 500;
}

.employee-line-text {
  display: inline-block;
  max-width: 17rem;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.employee-account-stack {
  display: inline-flex;
  max-width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  text-align: center;
}

.employee-account-login {
  display: inline-block;
  max-width: 10rem;
  overflow: hidden;
  color: var(--ot-muted);
  font-size: 0.7rem;
  font-weight: 650;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* =========================
   Tags
   ========================= */

.employee-rgb-tag {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 750;
  line-height: 1;
  text-align: center;
  vertical-align: middle;
  white-space: nowrap;
}

.employee-active-tag {
  border-color: rgba(var(--employee-active-rgb), 0.28);
  background: rgba(var(--employee-active-rgb), 0.12);
  color: rgb(var(--employee-active-rgb));
}

.employee-inactive-tag {
  border-color: rgba(var(--employee-inactive-rgb), 0.28);
  background: rgba(var(--employee-inactive-rgb), 0.12);
  color: rgb(var(--employee-inactive-rgb));
}

.employee-account-tag {
  border-color: rgba(var(--employee-account-rgb), 0.28);
  background: rgba(var(--employee-account-rgb), 0.12);
  color: rgb(var(--employee-account-rgb));
}

.employee-no-account-tag {
  border-color: rgba(var(--employee-no-account-rgb), 0.28);
  background: rgba(var(--employee-no-account-rgb), 0.12);
  color: rgb(var(--employee-no-account-rgb));
}

.employee-ot-approver-tag {
  border-color: rgba(var(--employee-ot-approver-rgb), 0.28);
  background: rgba(var(--employee-ot-approver-rgb), 0.12);
  color: rgb(var(--employee-ot-approver-rgb));
}

.employee-ot-acknowledge-tag {
  border-color: rgba(var(--employee-ot-acknowledge-rgb), 0.28);
  background: rgba(var(--employee-ot-acknowledge-rgb), 0.12);
  color: rgb(var(--employee-ot-acknowledge-rgb));
}

.employee-ot-none-tag {
  border-color: rgba(var(--employee-ot-none-rgb), 0.28);
  background: rgba(var(--employee-ot-none-rgb), 0.12);
  color: rgb(var(--employee-ot-none-rgb));
}

/* =========================
   PrimeVue DataTable center
   ========================= */

.employee-page :deep(.employee-data-table .p-datatable-table) {
  table-layout: auto;
}

.employee-page :deep(.employee-data-table .p-datatable-thead > tr > th),
.employee-page :deep(.employee-data-table .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap;
}

.employee-page :deep(.employee-data-table .p-column-header-content) {
  width: 100%;
  justify-content: center !important;
  gap: 0.25rem;
  text-align: center;
}

.employee-page :deep(.employee-data-table .p-column-title) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.employee-page :deep(.employee-data-table .p-sortable-column-icon) {
  margin-inline-start: 0.2rem;
}

.employee-page :deep(.employee-data-table .p-datatable-tbody > tr > td) {
  height: 42px;
  padding-block: 0.42rem;
  font-size: 0.78rem;
}

.employee-page :deep(.employee-data-table .p-datatable-thead > tr > th) {
  padding-block: 0.5rem;
  font-size: 0.74rem;
  font-weight: 750;
}

.employee-page :deep(.employee-data-table .p-datatable-tbody > tr > td > *) {
  margin-inline: auto;
}

.employee-page :deep(.employee-data-table .p-frozen-column) {
  text-align: center !important;
}

.employee-page :deep(.employee-data-table .p-frozen-column .p-button) {
  margin-inline: auto;
}

.employee-page :deep(.employee-data-table .p-button) {
  justify-content: center;
}

.employee-page :deep(.p-tag) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.employee-page :deep(.p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
}

.employee-page :deep(.p-multiselect-label) {
  align-items: center;
}

.employee-page :deep(.p-multiselect-token) {
  max-width: 100%;
  border-radius: 999px;
  font-size: 0.72rem;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .employee-page {
  --employee-name-rgb: 226, 232, 240;
  --employee-meta-rgb: 203, 213, 225;
}

:global(.dark) .employee-active-tag {
  border-color: rgba(var(--employee-active-rgb), 0.36);
  background: rgba(var(--employee-active-rgb), 0.18);
}

:global(.dark) .employee-inactive-tag {
  border-color: rgba(var(--employee-inactive-rgb), 0.36);
  background: rgba(var(--employee-inactive-rgb), 0.18);
}

:global(.dark) .employee-account-tag {
  border-color: rgba(var(--employee-account-rgb), 0.36);
  background: rgba(var(--employee-account-rgb), 0.18);
}

:global(.dark) .employee-no-account-tag {
  border-color: rgba(var(--employee-no-account-rgb), 0.36);
  background: rgba(var(--employee-no-account-rgb), 0.18);
}

:global(.dark) .employee-ot-approver-tag {
  border-color: rgba(var(--employee-ot-approver-rgb), 0.36);
  background: rgba(var(--employee-ot-approver-rgb), 0.18);
}

:global(.dark) .employee-ot-acknowledge-tag {
  border-color: rgba(var(--employee-ot-acknowledge-rgb), 0.36);
  background: rgba(var(--employee-ot-acknowledge-rgb), 0.18);
}

:global(.dark) .employee-ot-none-tag {
  border-color: rgba(var(--employee-ot-none-rgb), 0.36);
  background: rgba(var(--employee-ot-none-rgb), 0.18);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .employee-filter-actions {
    justify-content: stretch;
  }

  .employee-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 640px) {
  .employee-account-card-header {
    flex-direction: row;
    align-items: center;
  }
}

@media (min-width: 768px) {
  .employee-dialog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .employee-filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .employee-filter-actions {
    grid-column: 1 / -1;
  }

  .employee-dialog-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
/* =========================
   Force Employee table center alignment
   Put this at the bottom of <style scoped>
   ========================= */

.employee-page :deep(.employee-data-table.p-datatable .p-datatable-table) {
  table-layout: auto !important;
}

.employee-page :deep(.employee-data-table.p-datatable .p-datatable-thead > tr > th),
.employee-page :deep(.employee-data-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

.employee-page :deep(.employee-data-table.p-datatable .p-datatable-thead > tr > th) {
  justify-content: center !important;
}

.employee-page :deep(.employee-data-table.p-datatable .p-datatable-column-header-content),
.employee-page :deep(.employee-data-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

.employee-page :deep(.employee-data-table.p-datatable .p-datatable-column-title),
.employee-page :deep(.employee-data-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

.employee-page :deep(.employee-data-table.p-datatable .p-sortable-column-icon),
.employee-page :deep(.employee-data-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

/* Center all direct content inside body cells */
.employee-page :deep(.employee-data-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

/* Center text helper spans */
.employee-code-text,
.employee-name-text,
.employee-meta-text,
.employee-line-text {
  display: inline-flex !important;
  max-width: 100%;
  min-width: 0;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
}

/* Keep long line/manager text clean but centered */
.employee-line-text,
.employee-meta-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Center account column */
.employee-account-stack {
  display: inline-flex !important;
  max-width: 100%;
  flex-direction: column;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

.employee-account-login {
  display: inline-block;
  max-width: 10rem;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Center tags */
.employee-page :deep(.employee-data-table.p-datatable .p-tag),
.employee-rgb-tag {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
  vertical-align: middle !important;
}

.employee-page :deep(.employee-data-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

/* Center action column */
.employee-page :deep(.employee-data-table.p-datatable .p-frozen-column),
.employee-page :deep(.employee-data-table.p-datatable .p-datatable-frozen-column) {
  text-align: center !important;
  vertical-align: middle !important;
}

.employee-page :deep(.employee-data-table.p-datatable .p-frozen-column .p-button),
.employee-page :deep(.employee-data-table.p-datatable .p-datatable-frozen-column .p-button) {
  display: inline-flex !important;
  margin-inline: auto !important;
  align-items: center !important;
  justify-content: center !important;
}

/* Center normal buttons in table */
.employee-page :deep(.employee-data-table.p-datatable .p-button) {
  justify-content: center !important;
}
</style>