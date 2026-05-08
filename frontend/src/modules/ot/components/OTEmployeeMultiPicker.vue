<!-- frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue -->
<script setup>
// frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import api from '@/shared/services/api'
import { getEmployeeLookupOptions } from '@/modules/org/employee.api'
import { getLineLookupOptions } from '@/modules/org/line.api'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },

  otDate: {
    type: String,
    default: '',
  },

  selectedShiftId: {
    type: String,
    default: '',
  },

  selectedShiftLabel: {
    type: String,
    default: '',
  },

  autoSelectAll: {
    type: Boolean,
    default: false,
  },

  autoSelectReady: {
    type: Boolean,
    default: true,
  },

  blockedEmployeeMap: {
    type: Object,
    default: () => ({}),
  },

  blockedLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const toast = useToast()

const PAGE_SIZE = 30
const BULK_PAGE_SIZE = 100
const MAX_BULK_PAGES = 100

const dialogVisible = ref(false)
const scrollRef = ref(null)

const loadingAccess = ref(false)
const loadingLines = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const selectingManaged = ref(false)

const search = ref('')
const selectedLineId = ref('')
const employeeScope = ref('MANAGED')
const canSelectOtherEmployees = ref(false)

const employees = ref([])
const remoteLineOptions = ref([])

const managedEmployeeIds = ref(new Set())
const managedIdsLoaded = ref(false)

const page = ref(1)
const total = ref(0)
const hasMore = ref(false)

let searchTimer = null
let requestSeq = 0
let autoSelectKey = ''

const selectedRows = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

const selectedIds = computed(() => {
  return new Set(selectedRows.value.map((item) => getEmployeeId(item)).filter(Boolean))
})

const selectedCount = computed(() => selectedRows.value.length)

const outsideSelectedCount = computed(() => {
  return selectedRows.value.filter((item) => item?.isOutsideManaged === true).length
})

const managedSelectedCount = computed(() => {
  return Math.max(0, selectedCount.value - outsideSelectedCount.value)
})

const blockedStamp = computed(() => {
  const map = props.blockedEmployeeMap || {}
  return Object.keys(map).sort().join('|')
})

const loadedCountLabel = computed(() => {
  const loaded = employees.value.length
  const all = total.value || loaded
  return `${loaded}/${all}`
})

const canUsePicker = computed(() => {
  return Boolean(props.otDate && props.autoSelectReady)
})

const selectedPreview = computed(() => selectedRows.value.slice(0, 12))

const employeeScopeOptions = computed(() => {
  const options = [
    {
      label: 'My employees',
      value: 'MANAGED',
    },
  ]

  if (canSelectOtherEmployees.value) {
    options.push({
      label: 'All employees',
      value: 'ALL',
    })
  }

  return options
})

const lineOptions = computed(() => [
  {
    label: 'All lines',
    value: '',
  },
  ...remoteLineOptions.value,
])

const displayedEmployees = computed(() => {
  const keyword = toTrimmedString(search.value).toLowerCase()
  const lineId = toTrimmedString(selectedLineId.value)

  return employees.value
    .filter((employee) => {
      if (lineId && toTrimmedString(employee?.lineId) !== lineId) return false

      if (!keyword) return true

      const haystack = [
        employee.employeeNo,
        employee.displayName,
        employee.lineCode,
        employee.lineName,
        employee.positionName,
        employee.shiftCode,
        employee.shiftName,
        employee.isOutsideManaged ? 'outside other employee' : 'my employee managed team',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
    .sort(compareEmployeeRows)
})

const managedDisplayedEmployees = computed(() =>
  displayedEmployees.value.filter((employee) => !employee?.isOutsideManaged),
)

const outsideDisplayedEmployees = computed(() =>
  displayedEmployees.value.filter((employee) => employee?.isOutsideManaged),
)

const managedLineGroups = computed(() => buildLineGroups(managedDisplayedEmployees.value, 'managed'))
const outsideLineGroups = computed(() => buildLineGroups(outsideDisplayedEmployees.value, 'outside'))
const allLineGroups = computed(() => buildLineGroups(displayedEmployees.value, 'all'))

function toTrimmedString(value) {
  return String(value ?? '').trim()
}

function toUpperCode(value) {
  return toTrimmedString(value).toUpperCase()
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeBoolean(...values) {
  for (const value of values) {
    if (value === true || value === false) return value
    if (value === 1 || value === 0) return Boolean(value)

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true
      if (['false', '0', 'no', 'n'].includes(normalized)) return false
    }
  }

  return false
}

function getEmployeeId(employee) {
  return toTrimmedString(employee?._id || employee?.id || employee?.employeeId)
}

function extractAuthRoot(res) {
  return (
    res?.data?.data?.user ||
    res?.data?.data ||
    res?.data?.user ||
    res?.data ||
    {}
  )
}

function extractAuthAccess(res) {
  const root = extractAuthRoot(res)

  const permissionCodes = [
    ...(Array.isArray(root?.effectivePermissionCodes) ? root.effectivePermissionCodes : []),
    ...(Array.isArray(root?.permissionCodes) ? root.permissionCodes : []),
    ...(Array.isArray(root?.directPermissionCodes) ? root.directPermissionCodes : []),
  ]
    .map(toUpperCode)
    .filter(Boolean)

  const roleCodes = Array.isArray(root?.roleCodes)
    ? root.roleCodes.map(toUpperCode).filter(Boolean)
    : []

  const permissionSet = new Set(permissionCodes)
  const roleSet = new Set(roleCodes)

  const isRootAdmin = root?.isRootAdmin === true || roleSet.has('ROOT_ADMIN')

  const canLookupAll =
    isRootAdmin ||
    permissionSet.has('EMPLOYEE_LOOKUP_ALL') ||
    permissionSet.has('EMPLOYEE_VIEW_ALL') ||
    permissionSet.has('ORG_EMPLOYEE_VIEW_ALL') ||
    permissionSet.has('ORG.EMPLOYEE_VIEW_ALL') ||
    permissionSet.has('OT_ADD_OTHER_LINE_EMPLOYEE') ||
    permissionSet.has('OT_SELECT_OTHER_EMPLOYEE')

  return {
    isRootAdmin,
    canLookupAll,
  }
}

function extractLineFields(source = {}) {
  const lineObj =
    (isObject(source?.lineId) && source.lineId) ||
    (isObject(source?.line) && source.line) ||
    (isObject(source?.lineInfo) && source.lineInfo) ||
    (isObject(source?.productionLine) && source.productionLine) ||
    {}

  const rawLineId =
    !isObject(source?.lineId) && source?.lineId
      ? source.lineId
      : lineObj?._id || lineObj?.id || ''

  const lineId = toTrimmedString(rawLineId)
  const lineCode = toTrimmedString(source?.lineCode || lineObj?.code || '')
  const lineName = toTrimmedString(source?.lineName || lineObj?.name || '')

  return {
    lineId,
    lineCode,
    lineName,
  }
}

function extractShiftFields(source = {}) {
  const shiftObj =
    (isObject(source?.shiftId) && source.shiftId) ||
    (isObject(source?.shift) && source.shift) ||
    (isObject(source?.shiftInfo) && source.shiftInfo) ||
    (isObject(source?.assignedShift) && source.assignedShift) ||
    {}

  const rawShiftId =
    !isObject(source?.shiftId) && source?.shiftId
      ? source.shiftId
      : shiftObj?._id || shiftObj?.id || ''

  const shiftId = toTrimmedString(rawShiftId)
  const shiftCode = toTrimmedString(source?.shiftCode || shiftObj?.code || '')
  const shiftName = toTrimmedString(source?.shiftName || shiftObj?.name || '')
  const shiftType = toTrimmedString(source?.shiftType || shiftObj?.type || '')
  const shiftStartTime = toTrimmedString(source?.shiftStartTime || shiftObj?.startTime || '')
  const shiftEndTime = toTrimmedString(source?.shiftEndTime || shiftObj?.endTime || '')
  const shiftCrossMidnight = normalizeBoolean(source?.shiftCrossMidnight, shiftObj?.crossMidnight)

  return {
    shiftId,
    shiftCode,
    shiftName,
    shiftType,
    shiftStartTime,
    shiftEndTime,
    shiftCrossMidnight,
  }
}

function isOutsideManagedEmployee(employeeId, explicitValue = undefined) {
  if (explicitValue === true || explicitValue === false) return explicitValue

  const id = toTrimmedString(employeeId)
  if (!id) return false
  if (!managedIdsLoaded.value) return false

  return !managedEmployeeIds.value.has(id)
}

function normalizeEmployeeRecord(source = {}, options = {}) {
  const id = toTrimmedString(source?._id || source?.id || source?.employeeId || '')

  const employeeNo = toTrimmedString(
    source?.employeeNo ||
      source?.employeeCode ||
      source?.code ||
      source?.loginId ||
      '',
  )

  const displayName = toTrimmedString(
    source?.displayName ||
      source?.employeeName ||
      source?.name ||
      source?.fullName ||
      '',
  )

  const positionName = toTrimmedString(
    source?.positionName ||
      source?.position?.name ||
      source?.positionTitle ||
      '',
  )

  if (!id || !displayName) return null

  const line = extractLineFields(source)
  const shift = extractShiftFields(source)

  return {
    _id: id,
    id,
    employeeNo,
    displayName,
    positionName,
    ...line,
    ...shift,
    isOutsideManaged: isOutsideManagedEmployee(
      id,
      options.isOutsideManaged ?? source?.isOutsideManaged,
    ),
  }
}

function normalizeEmployeeLookupResponse(res, options = {}) {
  const root = res?.data?.data || res?.data || {}

  const rows =
    root?.items ||
    root?.rows ||
    root?.employees ||
    root?.data ||
    res?.data?.items ||
    res?.data?.rows ||
    []

  const normalizedRows = Array.isArray(rows)
    ? rows
        .map((item) =>
          normalizeEmployeeRecord(item, {
            isOutsideManaged:
              options.markOutsideManaged === true
                ? isOutsideManagedEmployee(getEmployeeId(item), item?.isOutsideManaged)
                : false,
          }),
        )
        .filter(Boolean)
    : []

  const pagination = root?.pagination || res?.data?.pagination || {}

  const totalRows = Number(
    pagination?.total ??
      root?.total ??
      res?.data?.total ??
      normalizedRows.length,
  )

  const totalPages = Number(
    pagination?.totalPages ?? Math.max(1, Math.ceil(totalRows / PAGE_SIZE)),
  )

  const responseHasMore =
    typeof root?.hasMore === 'boolean'
      ? root.hasMore
      : typeof pagination?.hasMore === 'boolean'
        ? pagination.hasMore
        : Number(pagination?.page || page.value) < totalPages

  return {
    rows: normalizedRows,
    total: totalRows,
    hasMore: responseHasMore,
  }
}

function normalizeLineOptionsResponse(res) {
  const root = res?.data?.data || res?.data || {}

  const rows =
    root?.items ||
    root?.rows ||
    root?.lines ||
    root?.data ||
    res?.data?.items ||
    res?.data?.rows ||
    []

  if (!Array.isArray(rows)) return []

  const map = new Map()

  for (const row of rows) {
    const id = toTrimmedString(row?._id || row?.id || row?.lineId)
    if (!id) continue

    const code = toTrimmedString(row?.code || row?.lineCode)
    const name = toTrimmedString(row?.name || row?.lineName)
    const label = [code, name].filter(Boolean).join(' · ') || 'Unnamed line'

    map.set(id, {
      label,
      value: id,
    })
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function compareEmployeeRows(a, b) {
  return `${a?.employeeNo || ''} ${a?.displayName || ''}`.localeCompare(
    `${b?.employeeNo || ''} ${b?.displayName || ''}`,
  )
}

function buildEmployeeDisplay(employee = {}) {
  return [employee?.employeeNo || 'No ID', employee?.displayName || 'Unknown']
    .filter(Boolean)
    .join(' - ')
}

function buildLineLabel(employee = {}) {
  return (
    [employee?.lineCode, employee?.lineName].filter(Boolean).join(' · ') ||
    'No line'
  )
}

function buildShiftLabel(employee = {}) {
  return (
    [employee?.shiftCode, employee?.shiftName].filter(Boolean).join(' · ') ||
    'No shift'
  )
}

function getBlockedRecord(employee) {
  const id = getEmployeeId(employee)
  if (!id) return null

  const map = props.blockedEmployeeMap || {}

  if (map instanceof Map) {
    return map.get(id) || null
  }

  return map[id] || null
}

function getEmployeeBlockInfo(employee) {
  const id = getEmployeeId(employee)

  if (!id) {
    return {
      blocked: true,
      reason: 'Invalid employee.',
    }
  }

  const unavailable = getBlockedRecord(employee)

  if (unavailable) {
    const requestNo = toTrimmedString(unavailable?.requestNo)
    const status = toTrimmedString(unavailable?.statusLabel || unavailable?.status)

    return {
      blocked: true,
      reason: requestNo
        ? `Already in OT request ${requestNo}`
        : status || 'Already unavailable for this date.',
    }
  }

  const shiftId = toTrimmedString(employee?.shiftId)

  if (!shiftId) {
    return {
      blocked: true,
      reason: 'Employee has no shift.',
    }
  }

  if (props.selectedShiftId && shiftId !== props.selectedShiftId) {
    return {
      blocked: true,
      reason: 'Employee shift does not match selected shift.',
    }
  }

  return {
    blocked: false,
    reason: '',
  }
}

function isSelected(employee) {
  return selectedIds.value.has(getEmployeeId(employee))
}

function isEmployeeDisabled(employee) {
  if (isSelected(employee)) return false
  return getEmployeeBlockInfo(employee).blocked
}

function getSelectableRows(rows = []) {
  return rows.filter((row) => !isEmployeeDisabled(row))
}

function mergeUniqueRows(rows = []) {
  const map = new Map()

  for (const item of rows) {
    const normalized = normalizeEmployeeRecord(item, {
      isOutsideManaged: item?.isOutsideManaged === true,
    })

    if (!normalized) continue
    map.set(normalized._id, normalized)
  }

  return Array.from(map.values()).sort(compareEmployeeRows)
}

function emitSelected(rows = []) {
  emit('update:modelValue', mergeUniqueRows(rows))
}

function selectRows(rows = []) {
  const safeRows = getSelectableRows(rows)

  if (!safeRows.length) {
    toast.add({
      severity: 'warn',
      summary: 'Cannot select',
      detail: 'No selectable employee in this group.',
      life: 2500,
    })
    return
  }

  emitSelected([...selectedRows.value, ...safeRows])
}

function removeRows(rows = []) {
  const removeIds = new Set(rows.map((item) => getEmployeeId(item)).filter(Boolean))

  emitSelected(
    selectedRows.value.filter((item) => !removeIds.has(getEmployeeId(item))),
  )
}

function clearSelected() {
  emitSelected([])
}

function toggleEmployee(employee) {
  if (isSelected(employee)) {
    removeRows([employee])
    return
  }

  const blockInfo = getEmployeeBlockInfo(employee)

  if (blockInfo.blocked) {
    toast.add({
      severity: 'warn',
      summary: 'Cannot select employee',
      detail: blockInfo.reason,
      life: 3000,
    })
    return
  }

  selectRows([employee])
}

function buildLineGroups(rows = [], prefix = 'main') {
  const map = new Map()

  for (const employee of rows) {
    const lineId = toTrimmedString(employee?.lineId)
    const lineKey = lineId || 'NO_LINE'

    if (!map.has(lineKey)) {
      map.set(lineKey, {
        key: `${prefix}:${lineKey}`,
        lineId,
        label: buildLineLabel(employee),
        rows: [],
        count: 0,
        selectedCount: 0,
        disabledCount: 0,
      })
    }

    const group = map.get(lineKey)

    group.rows.push(employee)
    group.count += 1

    if (isSelected(employee)) group.selectedCount += 1
    if (isEmployeeDisabled(employee) && !isSelected(employee)) group.disabledCount += 1
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort(compareEmployeeRows),
      selectableCount: group.rows.filter((row) => !isEmployeeDisabled(row)).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function selectLineGroup(group) {
  selectRows(group.rows || [])
}

function clearLineGroup(group) {
  removeRows(group.rows || [])
}

function buildEmployeeParams(targetPage, targetScope = employeeScope.value) {
  return {
    page: targetPage,
    limit: PAGE_SIZE,
    search: toTrimmedString(search.value),
    q: toTrimmedString(search.value),
    lineId: toTrimmedString(selectedLineId.value),
    shiftId: toTrimmedString(props.selectedShiftId),
    isActive: true,
    scope: targetScope,
  }
}

function buildBulkManagedParams(targetPage) {
  return {
    page: targetPage,
    limit: BULK_PAGE_SIZE,
    search: '',
    q: '',
    lineId: '',
    shiftId: toTrimmedString(props.selectedShiftId),
    isActive: true,
    scope: 'MANAGED',
  }
}

async function loadAccess() {
  loadingAccess.value = true

  try {
    const res = await api.get('/auth/me')
    const access = extractAuthAccess(res)

    canSelectOtherEmployees.value = access.canLookupAll

    if (!canSelectOtherEmployees.value && employeeScope.value === 'ALL') {
      employeeScope.value = 'MANAGED'
    }
  } catch {
    canSelectOtherEmployees.value = false
    employeeScope.value = 'MANAGED'
  } finally {
    loadingAccess.value = false
  }
}

async function loadLineOptions() {
  loadingLines.value = true

  try {
    const res = await getLineLookupOptions({
      page: 1,
      limit: 100,
      isActive: 'true',
      sortBy: 'code',
      sortOrder: 'asc',
    })

    remoteLineOptions.value = normalizeLineOptionsResponse(res)
  } catch (error) {
    remoteLineOptions.value = []

    toast.add({
      severity: 'warn',
      summary: 'Line filter unavailable',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load line filter options.',
      life: 3000,
    })
  } finally {
    loadingLines.value = false
  }
}

async function loadManagedIds() {
  managedEmployeeIds.value = new Set()
  managedIdsLoaded.value = false

  if (!props.otDate) {
    managedIdsLoaded.value = true
    return
  }

  const ids = new Set()
  let currentPage = 1
  let keepLoading = true

  while (keepLoading) {
    const res = await getEmployeeLookupOptions({
      page: currentPage,
      limit: BULK_PAGE_SIZE,
      search: '',
      q: '',
      lineId: '',
      shiftId: toTrimmedString(props.selectedShiftId),
      isActive: true,
      scope: 'MANAGED',
    })

    const payload = normalizeEmployeeLookupResponse(res, {
      markOutsideManaged: false,
    })

    for (const row of payload.rows) {
      const id = getEmployeeId(row)
      if (id) ids.add(id)
    }

    keepLoading = payload.hasMore === true && payload.rows.length > 0
    currentPage += 1

    if (currentPage > MAX_BULK_PAGES) keepLoading = false
  }

  managedEmployeeIds.value = ids
  managedIdsLoaded.value = true
}

async function ensureScrollableFill() {
  await nextTick()

  const el = scrollRef.value
  if (!el || loading.value || loadingMore.value || !hasMore.value) return

  const needsMore = el.scrollHeight <= el.clientHeight + 90

  if (needsMore) {
    await loadEmployees()
  }
}

async function loadEmployees(options = {}) {
  const { reset = false } = options

  if (!props.otDate) {
    employees.value = []
    total.value = 0
    page.value = 1
    hasMore.value = false
    return
  }

  if (loading.value || loadingMore.value) return
  if (!reset && !hasMore.value) return

  const targetPage = reset ? 1 : page.value
  const currentSeq = ++requestSeq

  if (targetPage === 1) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    if (employeeScope.value === 'ALL' && !managedIdsLoaded.value) {
      await loadManagedIds()
    }

    const res = await getEmployeeLookupOptions(buildEmployeeParams(targetPage))

    if (currentSeq !== requestSeq) return

    const payload = normalizeEmployeeLookupResponse(res, {
      markOutsideManaged: employeeScope.value === 'ALL',
    })

    total.value = payload.total
    hasMore.value = payload.hasMore

    if (reset) {
      employees.value = payload.rows
      page.value = 2

      await nextTick()

      if (scrollRef.value) {
        scrollRef.value.scrollTop = 0
      }
    } else {
      employees.value = mergeUniqueRows([...employees.value, ...payload.rows])
      page.value = targetPage + 1
    }

    await ensureScrollableFill()
  } catch (error) {
    if (reset) {
      employees.value = []
      total.value = 0
      hasMore.value = false
    }

    toast.add({
      severity: 'error',
      summary: 'Employee load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load employees.',
      life: 3000,
    })
  } finally {
    if (targetPage === 1) {
      loading.value = false
    } else {
      loadingMore.value = false
    }
  }
}

async function resetAndLoadEmployees() {
  page.value = 1
  hasMore.value = true
  await loadEmployees({ reset: true })
}

async function autoSelectManagedEmployees() {
  if (!props.autoSelectAll) return
  if (!props.autoSelectReady) return
  if (!props.otDate) return
  if (props.blockedLoading) return
  if (selectingManaged.value) return

  const nextKey = `${props.otDate}|${props.selectedShiftId}|${blockedStamp.value}`

  if (autoSelectKey === nextKey) return

  autoSelectKey = nextKey
  selectingManaged.value = true

  try {
    const rows = []
    let currentPage = 1
    let keepLoading = true

    while (keepLoading) {
      const res = await getEmployeeLookupOptions(buildBulkManagedParams(currentPage))

      const payload = normalizeEmployeeLookupResponse(res, {
        markOutsideManaged: false,
      })

      rows.push(...payload.rows)

      keepLoading = payload.hasMore === true && payload.rows.length > 0
      currentPage += 1

      if (currentPage > MAX_BULK_PAGES) keepLoading = false
    }

    const selectableRows = rows.filter((row) => !getEmployeeBlockInfo(row).blocked)

    emitSelected(selectableRows)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Auto select failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to auto-select your employees.',
      life: 3000,
    })
  } finally {
    selectingManaged.value = false
  }
}

function removeInvalidSelectedRows() {
  const beforeCount = selectedRows.value.length

  const nextRows = selectedRows.value.filter((row) => {
    const info = getEmployeeBlockInfo(row)
    return !info.blocked
  })

  if (nextRows.length !== beforeCount) {
    emitSelected(nextRows)
  }
}

function handleScroll(event) {
  const el = event?.target
  if (!el || loading.value || loadingMore.value || !hasMore.value) return

  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 160

  if (nearBottom) {
    loadEmployees()
  }
}

function openPicker() {
  dialogVisible.value = true

  nextTick(() => {
    ensureScrollableFill()
  })
}

watch(search, () => {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    resetAndLoadEmployees()
  }, 260)
})

watch(selectedLineId, () => {
  resetAndLoadEmployees()
})

watch(employeeScope, async () => {
  await resetAndLoadEmployees()
})

watch(
  () => [props.otDate, props.selectedShiftId].join('|'),
  async () => {
    search.value = ''
    selectedLineId.value = ''
    employees.value = []
    total.value = 0
    page.value = 1
    hasMore.value = false
    autoSelectKey = ''

    if (!props.otDate) return

    await loadManagedIds()
    await resetAndLoadEmployees()
    await autoSelectManagedEmployees()
  },
)

watch(
  () => [props.otDate, props.autoSelectReady, props.blockedLoading, blockedStamp.value].join('|'),
  async () => {
    removeInvalidSelectedRows()
    await autoSelectManagedEmployees()
  },
)

onMounted(async () => {
  await Promise.all([
    loadAccess(),
    loadLineOptions(),
  ])

  await loadManagedIds()
  await resetAndLoadEmployees()
  await autoSelectManagedEmployees()
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <section class="ot-employee-picker">
    <div class="ot-picker-summary">
      <div class="min-w-0">
        <h2 class="ot-picker-title">
          2. Choose employees <span class="ot-required-star">*</span>
        </h2>
      </div>

      <div class="ot-picker-actions">
        <div class="ot-count-box">
          <span>Selected</span>
          <strong>{{ selectedCount }}</strong>
        </div>

        <div class="ot-count-box">
          <span>My Team</span>
          <strong>{{ managedSelectedCount }}</strong>
        </div>

        <div
          v-if="outsideSelectedCount"
          class="ot-count-box is-warn"
        >
          <span>Other</span>
          <strong>{{ outsideSelectedCount }}</strong>
        </div>

        <Button
          label="Open Picker"
          icon="pi pi-window-maximize"
          size="small"
          :disabled="!props.otDate"
          @click="openPicker"
        />
      </div>
    </div>

    <Message
      v-if="!props.otDate"
      severity="info"
      :closable="false"
      class="m-3"
    >
      Choose OT date first.
    </Message>

    <Message
      v-else-if="props.blockedLoading"
      severity="info"
      :closable="false"
      class="m-3"
    >
      Checking employees already used in OT on this date...
    </Message>

    <div
      v-if="selectedPreview.length"
      class="ot-selected-preview"
    >
      <div
        v-for="employee in selectedPreview"
        :key="getEmployeeId(employee)"
        class="ot-selected-chip"
        :class="{ 'is-outside-managed': employee.isOutsideManaged }"
      >
        <span>{{ employee.employeeNo || 'No ID' }}</span>
        <small>{{ employee.displayName }}</small>
      </div>

      <Tag
        v-if="selectedCount > selectedPreview.length"
        :value="`+${selectedCount - selectedPreview.length} more`"
        severity="info"
      />

      <Tag
        v-if="props.selectedShiftLabel"
        :value="props.selectedShiftLabel"
        severity="success"
      />

      <Tag
        v-if="outsideSelectedCount"
        :value="`${outsideSelectedCount} outside team`"
        severity="warn"
      />

      <Tag
        v-if="selectingManaged || props.blockedLoading"
        value="Updating..."
        severity="info"
      />
    </div>

    <Message
      v-else-if="props.otDate && props.autoSelectReady && !selectingManaged && !props.blockedLoading"
      severity="warn"
      :closable="false"
      class="m-3"
    >
      No employee selected.
    </Message>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      maximizable
      class="ot-fullscreen-dialog"
      :style="{ width: '100vw', height: '100vh', maxHeight: '100vh' }"
    >
      <template #header>
        <div class="ot-dialog-header">
          <div class="min-w-0">
            <div class="ot-picker-eyebrow">
              OT Employee Picker
            </div>

            <div class="ot-dialog-title">
              Select employees by line
            </div>
          </div>

          <div class="ot-dialog-tags">
            <Tag
              :value="`${selectedCount} selected`"
              severity="contrast"
            />

            <Tag
              v-if="props.selectedShiftLabel"
              :value="props.selectedShiftLabel"
              severity="success"
            />

            <Tag
              :value="`${loadedCountLabel} loaded`"
              severity="info"
            />

            <Tag
              v-if="outsideSelectedCount"
              :value="`${outsideSelectedCount} outside team`"
              severity="warn"
            />
          </div>
        </div>
      </template>

      <div class="ot-dialog-body">
        <div class="ot-dialog-toolbar">
          <IconField class="ot-search-field">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model.trim="search"
              class="w-full"
              placeholder="Search ID, name, line, or shift..."
            />
          </IconField>

          <Select
            v-model="employeeScope"
            :options="employeeScopeOptions"
            optionLabel="label"
            optionValue="value"
            class="ot-scope-filter"
            placeholder="Employee scope"
            :disabled="loadingAccess || !canSelectOtherEmployees"
          />

          <Select
            v-model="selectedLineId"
            :options="lineOptions"
            optionLabel="label"
            optionValue="value"
            class="ot-line-filter"
            placeholder="All lines"
            :loading="loadingLines"
          />

          <Button
            label="Auto Select My Employees"
            icon="pi pi-check-square"
            severity="success"
            size="small"
            :loading="selectingManaged || props.blockedLoading"
            :disabled="!canUsePicker || selectingManaged || props.blockedLoading"
            @click="autoSelectManagedEmployees"
          />

          <Button
            label="Clear"
            icon="pi pi-times"
            severity="danger"
            outlined
            size="small"
            :disabled="!selectedCount"
            @click="clearSelected"
          />
        </div>

        <div
          ref="scrollRef"
          class="ot-employee-scroll"
          @scroll="handleScroll"
        >
          <div
            v-if="loading || loadingAccess || selectingManaged"
            class="ot-loading-state"
          >
            <ProgressSpinner style="width: 42px; height: 42px" strokeWidth="4" />

            <span>
              {{ selectingManaged ? 'Auto-selecting your employees...' : 'Loading employees...' }}
            </span>
          </div>

          <div
            v-else-if="!displayedEmployees.length"
            class="ot-empty-state"
          >
            <i class="pi pi-users" />
            <strong>No employees found</strong>
            <span>Try another keyword or line filter.</span>
          </div>

          <div
            v-else-if="employeeScope === 'ALL'"
            class="ot-split-panels"
          >
            <section class="ot-split-panel is-managed">
              <div class="ot-panel-header">
                <div>
                  <div class="ot-panel-title">
                    <i class="pi pi-users" />
                    <span>My employees</span>
                  </div>

                  <p>Auto-selected by default.</p>
                </div>

                <Tag
                  :value="`${managedDisplayedEmployees.length}`"
                  severity="success"
                />
              </div>

              <div
                v-if="!managedLineGroups.length"
                class="ot-panel-empty"
              >
                No employee found in your team.
              </div>

              <div
                v-else
                class="ot-line-stack"
              >
                <section
                  v-for="group in managedLineGroups"
                  :key="group.key"
                  class="ot-line-group"
                >
                  <div class="ot-line-header">
                    <div class="min-w-0">
                      <div class="ot-line-title">
                        {{ group.label }}
                      </div>

                      <div class="ot-line-subtitle">
                        {{ group.selectedCount }}/{{ group.count }} selected
                      </div>
                    </div>

                    <div class="ot-line-actions">
                      <Button
                        v-if="group.selectedCount"
                        label="Clear line"
                        size="small"
                        severity="danger"
                        text
                        @click="clearLineGroup(group)"
                      />

                      <Button
                        v-else
                        label="Select line"
                        size="small"
                        severity="success"
                        text
                        :disabled="!group.selectableCount"
                        @click="selectLineGroup(group)"
                      />
                    </div>
                  </div>

                  <div class="ot-employee-list">
                    <button
                      v-for="employee in group.rows"
                      :key="employee._id"
                      type="button"
                      class="ot-employee-row"
                      :class="{
                        'is-selected': selectedIds.has(employee._id),
                        'is-disabled': isEmployeeDisabled(employee),
                        'is-outside-managed': employee.isOutsideManaged,
                      }"
                      :title="getEmployeeBlockInfo(employee).reason || buildEmployeeDisplay(employee)"
                      :disabled="isEmployeeDisabled(employee)"
                      @click="toggleEmployee(employee)"
                    >
                      <span class="ot-check-circle">
                        <i
                          v-if="selectedIds.has(employee._id)"
                          class="pi pi-check"
                        />
                      </span>

                      <span class="ot-employee-identity">
                        <strong>{{ employee.employeeNo || 'No ID' }}</strong>
                        <small>{{ employee.displayName }}</small>
                        <em>{{ buildShiftLabel(employee) }}</em>
                      </span>
                    </button>
                  </div>
                </section>
              </div>
            </section>

            <section class="ot-split-panel is-outside">
              <div class="ot-panel-header">
                <div>
                  <div class="ot-panel-title">
                    <i class="pi pi-exclamation-triangle" />
                    <span>Other employees</span>
                  </div>

                  <p>Outside your team. Select only if needed.</p>
                </div>

                <Tag
                  :value="`${outsideDisplayedEmployees.length}`"
                  severity="warn"
                />
              </div>

              <div
                v-if="!outsideLineGroups.length"
                class="ot-panel-empty"
              >
                No outside employee found.
              </div>

              <div
                v-else
                class="ot-line-stack"
              >
                <section
                  v-for="group in outsideLineGroups"
                  :key="group.key"
                  class="ot-line-group"
                >
                  <div class="ot-line-header">
                    <div class="min-w-0">
                      <div class="ot-line-title">
                        {{ group.label }}
                      </div>

                      <div class="ot-line-subtitle">
                        {{ group.selectedCount }}/{{ group.count }} selected
                      </div>
                    </div>

                    <div class="ot-line-actions">
                      <Button
                        v-if="group.selectedCount"
                        label="Clear line"
                        size="small"
                        severity="danger"
                        text
                        @click="clearLineGroup(group)"
                      />

                      <Button
                        v-else
                        label="Select line"
                        size="small"
                        severity="warning"
                        text
                        :disabled="!group.selectableCount"
                        @click="selectLineGroup(group)"
                      />
                    </div>
                  </div>

                  <div class="ot-employee-list">
                    <button
                      v-for="employee in group.rows"
                      :key="employee._id"
                      type="button"
                      class="ot-employee-row is-outside-managed"
                      :class="{
                        'is-selected': selectedIds.has(employee._id),
                        'is-disabled': isEmployeeDisabled(employee),
                      }"
                      :title="getEmployeeBlockInfo(employee).reason || buildEmployeeDisplay(employee)"
                      :disabled="isEmployeeDisabled(employee)"
                      @click="toggleEmployee(employee)"
                    >
                      <span class="ot-check-circle">
                        <i
                          v-if="selectedIds.has(employee._id)"
                          class="pi pi-check"
                        />
                      </span>

                      <span class="ot-employee-identity">
                        <strong>{{ employee.employeeNo || 'No ID' }}</strong>
                        <small>{{ employee.displayName }}</small>
                        <em>{{ buildShiftLabel(employee) }}</em>
                      </span>
                    </button>
                  </div>
                </section>
              </div>
            </section>
          </div>

          <div
            v-else
            class="ot-line-stack"
          >
            <section
              v-for="group in allLineGroups"
              :key="group.key"
              class="ot-line-group"
            >
              <div class="ot-line-header">
                <div class="min-w-0">
                  <div class="ot-line-title">
                    {{ group.label }}
                  </div>

                  <div class="ot-line-subtitle">
                    {{ group.selectedCount }}/{{ group.count }} selected
                  </div>
                </div>

                <div class="ot-line-actions">
                  <Button
                    v-if="group.selectedCount"
                    label="Clear line"
                    size="small"
                    severity="danger"
                    text
                    @click="clearLineGroup(group)"
                  />

                  <Button
                    v-else
                    label="Select line"
                    size="small"
                    severity="success"
                    text
                    :disabled="!group.selectableCount"
                    @click="selectLineGroup(group)"
                  />
                </div>
              </div>

              <div class="ot-employee-list">
                <button
                  v-for="employee in group.rows"
                  :key="employee._id"
                  type="button"
                  class="ot-employee-row"
                  :class="{
                    'is-selected': selectedIds.has(employee._id),
                    'is-disabled': isEmployeeDisabled(employee),
                    'is-outside-managed': employee.isOutsideManaged,
                  }"
                  :title="getEmployeeBlockInfo(employee).reason || buildEmployeeDisplay(employee)"
                  :disabled="isEmployeeDisabled(employee)"
                  @click="toggleEmployee(employee)"
                >
                  <span class="ot-check-circle">
                    <i
                      v-if="selectedIds.has(employee._id)"
                      class="pi pi-check"
                    />
                  </span>

                  <span class="ot-employee-identity">
                    <strong>{{ employee.employeeNo || 'No ID' }}</strong>
                    <small>{{ employee.displayName }}</small>
                    <em>{{ buildShiftLabel(employee) }}</em>
                  </span>
                </button>
              </div>
            </section>
          </div>

          <div
            v-if="loadingMore"
            class="ot-more-loading"
          >
            <ProgressSpinner style="width: 24px; height: 24px" strokeWidth="4" />
            <span>Loading more...</span>
          </div>

          <div
            v-else-if="!hasMore && displayedEmployees.length"
            class="ot-all-loaded"
          >
            All loaded
          </div>
        </div>
      </div>
    </Dialog>
  </section>
</template>

<style scoped>
.ot-employee-picker {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1.25rem;
  background: var(--ot-surface);
}

.ot-picker-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.ot-picker-eyebrow {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-picker-title {
  margin-top: 0.18rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-picker-subtitle {
  margin-top: 0.22rem;
  font-size: 0.78rem;
  color: var(--ot-text-muted);
}

.ot-required-star {
  color: #ef4444;
  font-weight: 600;
}

.ot-picker-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-count-box {
  min-width: 76px;
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-bg);
  padding: 0.45rem 0.65rem;
  text-align: center;
}

.ot-count-box.is-warn {
  border-color: color-mix(in srgb, #f59e0b 45%, var(--ot-border));
  background: color-mix(in srgb, #f59e0b 10%, var(--ot-bg));
}

.ot-count-box span {
  display: block;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-count-box strong {
  display: block;
  margin-top: 0.08rem;
  font-size: 0.96rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-selected-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.42rem;
  border-top: 1px solid var(--ot-border);
  padding: 0.75rem 1rem 1rem;
}

.ot-selected-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  max-width: 250px;
  border: 1px solid color-mix(in srgb, #22c55e 42%, var(--ot-border));
  border-radius: 999px;
  background: color-mix(in srgb, #22c55e 12%, var(--ot-surface));
  padding: 0.32rem 0.62rem;
}

.ot-selected-chip.is-outside-managed {
  border-color: color-mix(in srgb, #f59e0b 55%, var(--ot-border));
  background: color-mix(in srgb, #f59e0b 14%, var(--ot-surface));
}

.ot-selected-chip span {
  flex: 0 0 auto;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-selected-chip small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-dialog-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ot-dialog-title {
  margin-top: 0.15rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-dialog-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}

.ot-dialog-body {
  display: flex;
  height: calc(100vh - 7.25rem);
  min-height: 0;
  flex-direction: column;
  gap: 0.75rem;
}

.ot-dialog-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.6rem;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.75rem;
}

.ot-search-field,
.ot-scope-filter,
.ot-line-filter {
  width: 100%;
}

.ot-employee-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-loading-state,
.ot-empty-state {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--ot-text-muted);
  text-align: center;
}

.ot-empty-state i {
  font-size: 2rem;
}

.ot-empty-state strong {
  font-weight: 600;
  color: var(--ot-text);
}

.ot-split-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  align-items: flex-start;
}

.ot-split-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.75rem;
}

.ot-split-panel.is-managed {
  border-color: color-mix(in srgb, #22c55e 28%, var(--ot-border));
}

.ot-split-panel.is-outside {
  border-color: color-mix(in srgb, #f59e0b 45%, var(--ot-border));
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.08), transparent),
    var(--ot-surface);
}

.ot-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--ot-border);
  padding-bottom: 0.65rem;
}

.ot-panel-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-panel-title i {
  font-size: 0.82rem;
  color: var(--ot-text-muted);
}

.ot-panel-header p {
  margin-top: 0.18rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-panel-empty {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  padding: 1rem;
  text-align: center;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-line-stack {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.ot-line-group {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-surface);
}

.ot-line-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.08), transparent),
    var(--ot-surface);
  padding: 0.68rem 0.78rem;
}

.ot-line-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-line-subtitle {
  margin-top: 0.12rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-line-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.35rem;
}

.ot-employee-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 0.42rem;
  padding: 0.6rem;
}

.ot-employee-row {
  position: relative;
  display: flex;
  min-height: 56px;
  cursor: pointer;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
  padding: 0.5rem 0.6rem;
  text-align: left;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;
}

.ot-employee-row:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #3b82f6 34%, var(--ot-border));
}

.ot-employee-row.is-selected {
  border-color: color-mix(in srgb, #22c55e 62%, var(--ot-border));
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(59, 130, 246, 0.04)),
    var(--ot-surface);
}

.ot-employee-row.is-outside-managed {
  border-color: color-mix(in srgb, #f59e0b 52%, var(--ot-border));
}

.ot-employee-row.is-disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
}

.ot-check-circle {
  display: inline-flex;
  width: 1.28rem;
  height: 1.28rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ot-border);
  border-radius: 999px;
  background: var(--ot-bg);
  color: #16a34a;
  font-size: 0.66rem;
}

.ot-employee-row.is-selected .ot-check-circle {
  border-color: color-mix(in srgb, #22c55e 62%, var(--ot-border));
  background: rgba(34, 197, 94, 0.1);
}

.ot-employee-identity {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.08rem;
}

.ot-employee-identity strong,
.ot-employee-identity small,
.ot-employee-identity em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-employee-identity strong {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-employee-identity small {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-employee-identity em {
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 500;
  color: color-mix(in srgb, var(--ot-text-muted) 84%, #3b82f6);
}

.ot-more-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 1rem;
  font-size: 0.82rem;
  color: var(--ot-text-muted);
}

.ot-all-loaded {
  padding: 1rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

:deep(.ot-fullscreen-dialog .p-dialog-header) {
  border-bottom: 1px solid var(--ot-border);
}

:deep(.ot-fullscreen-dialog .p-dialog-content) {
  height: 100%;
  padding: 0.75rem !important;
  background: var(--ot-bg) !important;
}

:deep(.ot-search-field .p-inputtext) {
  min-height: 2.45rem !important;
}

:deep(.p-button.p-button-sm) {
  padding: 0.34rem 0.58rem !important;
  font-size: 0.78rem !important;
}

:deep(.p-tag) {
  font-weight: 500 !important;
}

@media (min-width: 768px) {
  .ot-dialog-toolbar {
    grid-template-columns:
      minmax(240px, 1fr)
      170px
      190px
      auto
      auto;
    align-items: center;
  }
}

@media (min-width: 1280px) {
  .ot-split-panels {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>