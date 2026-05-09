<!-- frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue -->
<script setup>
// frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
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

  requestPreview: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const toast = useToast()

const PAGE_SIZE = 10
const GROUP_VISIBLE_STEP = 10
const BULK_PAGE_SIZE = 100
const MAX_BULK_PAGES = 100
const SEARCH_DEBOUNCE_MS = 260
const SCROLL_LOAD_OFFSET = 140

const loadingAccess = ref(false)
const loadingLines = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const backgroundFetchingAll = ref(false)
const selectingManaged = ref(false)

const search = ref('')
const selectedLineId = ref('')
const employeeScope = ref('MANAGED')
const canSelectOtherEmployees = ref(false)

const employees = ref([])
const total = ref(0)
const loadedPages = ref(new Set())

const remoteLineOptions = ref([])
const expandedLineRows = ref({})
const lineVisibleCountMap = reactive({})

const managedEmployeeIds = ref(new Set())
const managedIdsLoaded = ref(false)

let searchTimer = null
let requestSeq = 0
let backgroundLoadToken = 0
let autoSelectKey = ''

const selectedRows = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

const selectedIds = computed(() => {
  return new Set(selectedRows.value.map((item) => getEmployeeId(item)).filter(Boolean))
})

const selectedCount = computed(() => selectedRows.value.length)

const selectedWithLineCount = computed(() => {
  return selectedRows.value.filter((item) => hasLine(item)).length
})

const selectedNoLineCount = computed(() => {
  return selectedRows.value.filter((item) => !hasLine(item)).length
})

const outsideSelectedCount = computed(() => {
  return selectedRows.value.filter((item) => item?.isOutsideManaged === true).length
})

const blockedStamp = computed(() => {
  const map = props.blockedEmployeeMap || {}
  return Object.keys(map).sort().join('|')
})

const loadedCount = computed(() => employees.value.length)

const loadedCountLabel = computed(() => {
  const loaded = loadedCount.value
  const all = total.value || loaded
  return `${loaded}/${all}`
})

const hasMoreEmployees = computed(() => {
  return loadedCount.value < Number(total.value || 0)
})

const nextPageToLoad = computed(() => {
  return loadedPages.value.size + 1
})

const defaultTime = computed(() => {
  const preview = props.requestPreview || {}

  const requestStartTime = String(
    preview.requestStartTime ||
      preview.startTime ||
      '',
  ).trim()

  const requestEndTime = String(
    preview.requestEndTime ||
      preview.endTime ||
      '',
  ).trim()

  const breakMinutes = Number(preview.breakMinutes || 0)

  const requestedMinutes =
    Number(preview.requestedMinutes || 0) ||
    calculateTimeWindowMinutes(requestStartTime, requestEndTime, breakMinutes)

  return {
    requestStartTime,
    requestEndTime,
    breakMinutes,
    requestedMinutes,
  }
})

const defaultTimeKey = computed(() => {
  return [
    defaultTime.value.requestStartTime,
    defaultTime.value.requestEndTime,
    defaultTime.value.breakMinutes,
    defaultTime.value.requestedMinutes,
  ].join('|')
})

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

const lineGroups = computed(() => buildLineGroups(displayedEmployees.value))

const hasAnyRows = computed(() => lineGroups.value.length > 0)

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

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim())
}

function timeToMinutes(value) {
  if (!isHHmm(value)) return 0

  const [hh, mm] = String(value).split(':').map(Number)
  return hh * 60 + mm
}

function calculateRawWindowMinutes(startTime, endTime) {
  if (!isHHmm(startTime) || !isHHmm(endTime)) return 0

  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  let minutes = end - start

  if (minutes <= 0) {
    minutes += 1440
  }

  return minutes
}

function calculateTimeWindowMinutes(startTime, endTime, breakMinutes = 0) {
  const rawMinutes = calculateRawWindowMinutes(startTime, endTime)
  const safeBreak = Number(breakMinutes || 0)

  return Math.max(0, rawMinutes - safeBreak)
}

function formatMinutesLabel(value) {
  const minutes = Number(value || 0)

  if (!minutes) return '0 min'

  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60

  if (hh && mm) return `${hh}h ${mm}m`
  if (hh) return `${hh}h`
  return `${mm}m`
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

function hasLine(employee) {
  return Boolean(
    toTrimmedString(employee?.lineId) ||
      toTrimmedString(employee?.lineCode) ||
      toTrimmedString(employee?.lineName),
  )
}

function getLineGroupKey(employee) {
  if (!hasLine(employee)) return 'NO_LINE'

  return (
    toTrimmedString(employee?.lineId) ||
    toTrimmedString(employee?.lineCode) ||
    toTrimmedString(employee?.lineName)
  )
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

function normalizeSelectedEmployeeRecord(source = {}) {
  const base = normalizeEmployeeRecord(source, {
    isOutsideManaged: source?.isOutsideManaged === true,
  })

  if (!base) return null

  const startTime = toTrimmedString(source?.requestStartTime || defaultTime.value.requestStartTime)
  const endTime = toTrimmedString(source?.requestEndTime || defaultTime.value.requestEndTime)
  const breakMinutes = Number(source?.breakMinutes ?? defaultTime.value.breakMinutes ?? 0)

  const requestedMinutes =
    Number(source?.requestedMinutes || 0) ||
    calculateTimeWindowMinutes(startTime, endTime, breakMinutes) ||
    Number(defaultTime.value.requestedMinutes || 0)

  return {
    ...base,
    requestStartTime: startTime,
    requestEndTime: endTime,
    breakMinutes,
    requestedMinutes,
    otTimeMode: toUpperCode(source?.otTimeMode || 'DEFAULT'),
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
      pagination?.totalRecords ??
      root?.total ??
      res?.data?.total ??
      normalizedRows.length,
  )

  return {
    rows: normalizedRows,
    total: totalRows,
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

function compareLineGroups(a, b) {
  if (a.id === 'NO_LINE') return 1
  if (b.id === 'NO_LINE') return -1

  return a.label.localeCompare(b.label)
}

function buildLineLabel(employee = {}) {
  if (!hasLine(employee)) return 'No Line'

  return (
    [employee?.lineCode, employee?.lineName].filter(Boolean).join(' · ') ||
    'Unnamed line'
  )
}

function buildShiftLabel(employee = {}) {
  return (
    [employee?.shiftCode, employee?.shiftName].filter(Boolean).join(' · ') ||
    'No shift'
  )
}

function buildApiErrorMessage(error) {
  const data = error?.response?.data

  if (!data) return error?.message || 'Unknown error.'

  const details =
    data?.details ||
    data?.errors ||
    data?.data?.details ||
    data?.data?.errors

  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => {
        if (typeof item === 'string') return item

        const path = Array.isArray(item?.path)
          ? item.path.join('.')
          : item?.path || item?.field || ''

        const message = item?.message || item?.msg || 'Invalid value'

        return path ? `${path}: ${message}` : message
      })
      .join('\n')
  }

  if (typeof details === 'object' && details) {
    return JSON.stringify(details, null, 2)
  }

  return data?.message || error?.message || 'Unable to create OT request.'
}

function getSelectedEmployee(employee) {
  const id = getEmployeeId(employee)
  if (!id) return null

  return selectedRows.value.find((item) => getEmployeeId(item) === id) || null
}

function getEditableEmployee(employee) {
  return getSelectedEmployee(employee) || normalizeSelectedEmployeeRecord(employee) || employee
}

function getEmployeeStartTime(employee) {
  return toTrimmedString(getEditableEmployee(employee)?.requestStartTime || '')
}

function getEmployeeEndTime(employee) {
  return toTrimmedString(getEditableEmployee(employee)?.requestEndTime || '')
}

function getEmployeeBreakMinutes(employee) {
  return Number(getEditableEmployee(employee)?.breakMinutes || 0)
}

function getEmployeeRequestedMinutes(employee) {
  const editable = getEditableEmployee(employee)

  const current = Number(editable?.requestedMinutes || 0)
  if (current > 0) return current

  return calculateTimeWindowMinutes(
    editable?.requestStartTime,
    editable?.requestEndTime,
    editable?.breakMinutes,
  )
}

function getEmployeeTimeMode(employee) {
  return toUpperCode(getEditableEmployee(employee)?.otTimeMode || 'DEFAULT')
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
    const normalized = normalizeSelectedEmployeeRecord(item)

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

function toggleEmployee(employee, checked) {
  if (!checked) {
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

function updateSelectedEmployeeTime(employee, patch = {}) {
  const id = getEmployeeId(employee)
  if (!id) return

  const exists = isSelected(employee)

  if (!exists && isEmployeeDisabled(employee)) {
    toast.add({
      severity: 'warn',
      summary: 'Cannot edit employee',
      detail: getEmployeeBlockInfo(employee).reason,
      life: 3000,
    })
    return
  }

  const baseRows = exists
    ? selectedRows.value
    : [...selectedRows.value, normalizeSelectedEmployeeRecord(employee)]

  const nextRows = baseRows.map((item) => {
    if (getEmployeeId(item) !== id) return item

    const next = {
      ...item,
      ...patch,
      otTimeMode: 'CUSTOM',
    }

    next.breakMinutes = Number(next.breakMinutes || 0)
    next.requestedMinutes = calculateTimeWindowMinutes(
      next.requestStartTime,
      next.requestEndTime,
      next.breakMinutes,
    )

    return next
  })

  emitSelected(nextRows)
}

function resetEmployeeTime(employee) {
  const id = getEmployeeId(employee)
  if (!id) return

  const nextRows = selectedRows.value.map((item) => {
    if (getEmployeeId(item) !== id) return item

    return {
      ...item,
      requestStartTime: defaultTime.value.requestStartTime,
      requestEndTime: defaultTime.value.requestEndTime,
      breakMinutes: defaultTime.value.breakMinutes,
      requestedMinutes: defaultTime.value.requestedMinutes,
      otTimeMode: 'DEFAULT',
    }
  })

  emitSelected(nextRows)
}

function updateDefaultSelectedEmployeeTimes() {
  if (!selectedRows.value.length) return

  const nextRows = selectedRows.value.map((item) => {
    const mode = toUpperCode(item?.otTimeMode || 'DEFAULT')

    if (mode === 'CUSTOM') return item

    return {
      ...item,
      requestStartTime: defaultTime.value.requestStartTime,
      requestEndTime: defaultTime.value.requestEndTime,
      breakMinutes: defaultTime.value.breakMinutes,
      requestedMinutes: defaultTime.value.requestedMinutes,
      otTimeMode: 'DEFAULT',
    }
  })

  emitSelected(nextRows)
}

function buildLineGroups(rows = []) {
  const map = new Map()

  for (const employee of rows) {
    const lineKey = getLineGroupKey(employee)

    if (!map.has(lineKey)) {
      map.set(lineKey, {
        id: lineKey,
        lineId: toTrimmedString(employee?.lineId),
        label: buildLineLabel(employee),
        isNoLine: lineKey === 'NO_LINE',
        rows: [],
        count: 0,
        selectedCount: 0,
        disabledCount: 0,
        outsideCount: 0,
      })
    }

    const group = map.get(lineKey)

    group.rows.push(employee)
    group.count += 1

    if (isSelected(employee)) group.selectedCount += 1
    if (isEmployeeDisabled(employee) && !isSelected(employee)) group.disabledCount += 1
    if (employee?.isOutsideManaged) group.outsideCount += 1
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort(compareEmployeeRows),
      selectableCount: group.rows.filter((row) => !isEmployeeDisabled(row)).length,
    }))
    .sort(compareLineGroups)
}

function isLineExpanded(group) {
  return expandedLineRows.value[group.id] === true
}

function toggleLineExpanded(group) {
  expandedLineRows.value = {
    ...expandedLineRows.value,
    [group.id]: !isLineExpanded(group),
  }
}

function syncLineState() {
  const nextExpanded = {
    ...expandedLineRows.value,
  }

  for (const group of lineGroups.value) {
    if (nextExpanded[group.id] === undefined) {
      nextExpanded[group.id] = false
    }

    if (!lineVisibleCountMap[group.id]) {
      lineVisibleCountMap[group.id] = GROUP_VISIBLE_STEP
    }
  }

  expandedLineRows.value = nextExpanded
}

function getVisibleRowsForGroup(group) {
  const limit = Number(lineVisibleCountMap[group.id] || GROUP_VISIBLE_STEP)
  return group.rows.slice(0, limit)
}

function groupHasMoreLocalRows(group) {
  const limit = Number(lineVisibleCountMap[group.id] || GROUP_VISIBLE_STEP)
  return group.rows.length > limit
}

function onLineEmployeeScroll(event, group) {
  const target = event?.target
  if (!target) return

  const nearBottom =
    target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_LOAD_OFFSET

  if (!nearBottom) return

  if (groupHasMoreLocalRows(group)) {
    lineVisibleCountMap[group.id] =
      Number(lineVisibleCountMap[group.id] || GROUP_VISIBLE_STEP) + GROUP_VISIBLE_STEP
  }
}

function isLineGroupSelected(group) {
  const rows = getSelectableRows(group?.rows || [])
  if (!rows.length) return false

  return rows.every((employee) => selectedIds.value.has(getEmployeeId(employee)))
}

function toggleLineGroup(group, checked) {
  const rows = group?.rows || []

  if (checked) {
    selectRows(rows)
    return
  }

  removeRows(rows)
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

    const loaded = currentPage * BULK_PAGE_SIZE
    keepLoading = loaded < payload.total && payload.rows.length > 0
    currentPage += 1

    if (currentPage > MAX_BULK_PAGES) keepLoading = false
  }

  managedEmployeeIds.value = ids
  managedIdsLoaded.value = true
}

function resetEmployeeListState() {
  backgroundLoadToken += 1
  backgroundFetchingAll.value = false

  employees.value = []
  total.value = 0
  loadedPages.value = new Set()
  expandedLineRows.value = {}

  for (const key of Object.keys(lineVisibleCountMap)) {
    delete lineVisibleCountMap[key]
  }
}

function mergeLoadedEmployees(existingRows = [], newRows = []) {
  const map = new Map()

  for (const row of existingRows) {
    const id = getEmployeeId(row)
    if (id) map.set(id, row)
  }

  for (const row of newRows) {
    const id = getEmployeeId(row)
    if (id) map.set(id, row)
  }

  return Array.from(map.values()).sort((a, b) => {
    const lineA = hasLine(a) ? buildLineLabel(a) : '~~~~NO_LINE'
    const lineB = hasLine(b) ? buildLineLabel(b) : '~~~~NO_LINE'

    const lineCompare = lineA.localeCompare(lineB)
    if (lineCompare !== 0) return lineCompare

    return compareEmployeeRows(a, b)
  })
}

async function fetchEmployeePage(targetPage = 1, { replace = false, silent = false } = {}) {
  if (!props.otDate) {
    resetEmployeeListState()
    return
  }

  if (!replace && loadedPages.value.has(targetPage)) return
  if (!replace && !hasMoreEmployees.value && loadedPages.value.size > 0) return

  const currentSeq = ++requestSeq

  if (replace) {
    loading.value = true
  } else if (!silent) {
    loadingMore.value = true
  }

  try {
    if (employeeScope.value === 'ALL' && !managedIdsLoaded.value) {
      await loadManagedIds()
    }

    const res = await getEmployeeLookupOptions(buildEmployeeParams(targetPage))

    const payload = normalizeEmployeeLookupResponse(res, {
      markOutsideManaged: employeeScope.value === 'ALL',
    })

    if (currentSeq !== requestSeq) return

    total.value = payload.total

    if (replace) {
      employees.value = payload.rows
      loadedPages.value = new Set([targetPage])
      expandedLineRows.value = {}
    } else {
      employees.value = mergeLoadedEmployees(employees.value, payload.rows)
      loadedPages.value.add(targetPage)
    }

    syncLineState()
  } catch (error) {
    if (replace) {
      resetEmployeeListState()
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
    if (currentSeq === requestSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

async function fetchAllRemainingEmployeePages() {
  if (!props.otDate) return
  if (backgroundFetchingAll.value) return
  if (!hasMoreEmployees.value) return

  const token = ++backgroundLoadToken

  backgroundFetchingAll.value = true

  try {
    let page = nextPageToLoad.value

    while (
      token === backgroundLoadToken &&
      props.otDate &&
      hasMoreEmployees.value &&
      page <= MAX_BULK_PAGES
    ) {
      await fetchEmployeePage(page, {
        replace: false,
        silent: true,
      })

      page = nextPageToLoad.value
    }
  } finally {
    if (token === backgroundLoadToken) {
      backgroundFetchingAll.value = false
    }
  }
}

async function resetAndLoadEmployees() {
  resetEmployeeListState()

  await fetchEmployeePage(1, {
    replace: true,
  })

  fetchAllRemainingEmployeePages()
}

async function onLazyScroll(event) {
  const target = event?.target
  if (!target) return

  if (loading.value || loadingMore.value || backgroundFetchingAll.value) return
  if (!hasMoreEmployees.value) return

  const nearBottom =
    target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_LOAD_OFFSET

  if (!nearBottom) return

  await fetchEmployeePage(nextPageToLoad.value, {
    replace: false,
    silent: false,
  })

  fetchAllRemainingEmployeePages()
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

      const loaded = currentPage * BULK_PAGE_SIZE
      keepLoading = loaded < payload.total && payload.rows.length > 0
      currentPage += 1

      if (currentPage > MAX_BULK_PAGES) keepLoading = false
    }

    const selectableRows = rows.filter((row) => {
      return hasLine(row) && !getEmployeeBlockInfo(row).blocked
    })

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

function onSearchInput() {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    resetAndLoadEmployees()
  }, SEARCH_DEBOUNCE_MS)
}

function onFilterChange() {
  resetAndLoadEmployees()
}

function clearFilters() {
  search.value = ''
  selectedLineId.value = ''
  resetAndLoadEmployees()
}

watch(employeeScope, async () => {
  await resetAndLoadEmployees()
})

watch(lineGroups, () => {
  syncLineState()
})

watch(defaultTimeKey, () => {
  updateDefaultSelectedEmployeeTimes()
})

watch(
  () => [props.otDate, props.selectedShiftId].join('|'),
  async () => {
    search.value = ''
    selectedLineId.value = ''
    resetEmployeeListState()
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
    <div class="ot-compact-header">
      <div class="ot-title-block">
        <h2 class="ot-picker-title">
          2. Choose employees <span class="ot-required-star">*</span>
        </h2>
      </div>

      <IconField class="ot-search-field">
        <InputIcon class="pi pi-search" />

        <InputText
          v-model.trim="search"
          class="w-full"
          size="small"
          placeholder="Search ID, name, line, position, or shift..."
          @input="onSearchInput"
        />
      </IconField>

      <Select
        v-model="employeeScope"
        :options="employeeScopeOptions"
        optionLabel="label"
        optionValue="value"
        class="ot-scope-filter"
        size="small"
        placeholder="Employee scope"
        :disabled="loadingAccess || !canSelectOtherEmployees"
      />

      <Select
        v-model="selectedLineId"
        :options="lineOptions"
        optionLabel="label"
        optionValue="value"
        class="ot-line-filter"
        size="small"
        placeholder="All lines"
        :loading="loadingLines"
        @change="onFilterChange"
      />

      <div class="ot-inline-tags">
        <Tag
          :value="props.selectedShiftLabel || 'Shift required'"
          :severity="props.selectedShiftLabel ? 'success' : 'warning'"
          class="ot-status-tag"
        />

        <Tag
          :value="backgroundFetchingAll ? `${loadedCountLabel} loading all...` : `${loadedCountLabel} loaded`"
          :severity="backgroundFetchingAll ? 'warning' : 'info'"
          class="ot-status-tag"
        />
      </div>

      <div class="ot-mini-summary">
        <div class="ot-mini-chip">
          <span>Selected</span>
          <strong>{{ selectedCount }}</strong>
        </div>

        <div class="ot-mini-chip">
          <span>With Line</span>
          <strong>{{ selectedWithLineCount }}</strong>
        </div>

        <div class="ot-mini-chip is-warn">
          <span>No Line</span>
          <strong>{{ selectedNoLineCount }}</strong>
        </div>

        <div
          v-if="outsideSelectedCount"
          class="ot-mini-chip is-warn"
        >
          <span>Other</span>
          <strong>{{ outsideSelectedCount }}</strong>
        </div>
      </div>

      <div class="ot-header-actions">
        <Button
          label="Clear Filter"
          icon="pi pi-refresh"
          size="small"
          severity="secondary"
          outlined
          @click="clearFilters"
        />

        <Button
          v-if="selectedCount"
          label="Clear Selection"
          icon="pi pi-times"
          size="small"
          severity="danger"
          outlined
          @click="clearSelected"
        />
      </div>
    </div>

    <Message
      v-if="!props.otDate"
      severity="info"
      :closable="false"
      class="mx-3 mb-3"
    >
      Choose OT date first.
    </Message>

    <Message
      v-else-if="props.blockedLoading"
      severity="info"
      :closable="false"
      class="mx-3 mb-3"
    >
      Checking employees already used in OT on this date...
    </Message>

    <div
      v-if="props.otDate"
      class="ot-table-shell"
    >
      <div
        v-if="loading || loadingAccess || selectingManaged"
        class="ot-loading-state"
      >
        <ProgressSpinner
          style="width: 34px; height: 34px"
          strokeWidth="4"
        />

        <span>
          {{ selectingManaged ? 'Auto-selecting employees with line...' : 'Loading employees...' }}
        </span>
      </div>

      <div
        v-else-if="!hasAnyRows"
        class="ot-empty-state"
      >
        <i class="pi pi-users" />

        <strong>No employees found</strong>

        <span>Try another keyword, line filter, or employee scope.</span>
      </div>

      <div
        v-else
        class="ot-lazy-scroll-shell"
        @scroll.passive="onLazyScroll"
      >
        <section
          v-for="group in lineGroups"
          :key="group.id"
          class="ot-line-group"
          :class="{ 'is-no-line': group.isNoLine }"
        >
          <div class="ot-line-sticky-head">
            <button
              type="button"
              class="ot-line-toggle"
              @click="toggleLineExpanded(group)"
            >
              <i
                class="pi"
                :class="isLineExpanded(group) ? 'pi-chevron-down' : 'pi-chevron-right'"
              />

              <span>{{ group.label }}</span>
            </button>

            <div class="ot-line-head-right">
              <Tag
                :value="`${group.count} staff`"
                severity="secondary"
                class="ot-status-tag"
              />

              <Tag
                :value="`${group.selectedCount}/${group.count} selected`"
                :severity="group.selectedCount ? 'success' : 'secondary'"
                class="ot-status-tag"
              />

              <Tag
                v-if="group.disabledCount"
                :value="`${group.disabledCount} unavailable`"
                severity="danger"
                class="ot-status-tag"
              />

              <Tag
                v-if="group.isNoLine"
                value="Manual only"
                severity="warning"
                class="ot-status-tag"
              />

              <Checkbox
                binary
                :modelValue="isLineGroupSelected(group)"
                :disabled="!group.selectableCount"
                @update:modelValue="(checked) => toggleLineGroup(group, checked)"
              />
            </div>
          </div>

          <div
            v-if="isLineExpanded(group)"
            class="ot-line-body"
          >
            <div
              class="ot-line-employee-scroll"
              @scroll.passive="(event) => onLineEmployeeScroll(event, group)"
            >
              <table class="ot-employee-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th></th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Break</th>
                    <th>Total</th>
                    <th>Mode</th>
                    <th>Shift</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  <tr
                    v-for="(employee, index) in getVisibleRowsForGroup(group)"
                    :key="getEmployeeId(employee)"
                  >
                    <td class="cell-center">
                      {{ index + 1 }}
                    </td>

                    <td class="cell-center">
                      <Checkbox
                        binary
                        :modelValue="isSelected(employee)"
                        :disabled="isEmployeeDisabled(employee) && !isSelected(employee)"
                        @update:modelValue="(checked) => toggleEmployee(employee, checked)"
                      />
                    </td>

                    <td>
                      <span class="cell-mono">
                        {{ employee.employeeNo || 'No ID' }}
                      </span>
                    </td>

                    <td>
                      <span class="cell-strong">
                        {{ employee.displayName || '-' }}
                      </span>
                    </td>

                    <td>
                      {{ employee.positionName || '-' }}
                    </td>

                    <td>
                      <InputText
                        :modelValue="getEmployeeStartTime(employee)"
                        type="time"
                        class="ot-time-input"
                        :disabled="isEmployeeDisabled(employee) && !isSelected(employee)"
                        @update:modelValue="(value) => updateSelectedEmployeeTime(employee, { requestStartTime: value })"
                      />
                    </td>

                    <td>
                      <InputText
                        :modelValue="getEmployeeEndTime(employee)"
                        type="time"
                        class="ot-time-input"
                        :disabled="isEmployeeDisabled(employee) && !isSelected(employee)"
                        @update:modelValue="(value) => updateSelectedEmployeeTime(employee, { requestEndTime: value })"
                      />
                    </td>

                    <td>
                      <InputNumber
                        :modelValue="getEmployeeBreakMinutes(employee)"
                        class="ot-break-input"
                        inputClass="ot-break-input-field"
                        :min="0"
                        :max="1440"
                        :step="5"
                        :disabled="isEmployeeDisabled(employee) && !isSelected(employee)"
                        @update:modelValue="(value) => updateSelectedEmployeeTime(employee, { breakMinutes: value })"
                      />
                    </td>

                    <td>
                      <span class="cell-mono">
                        {{ formatMinutesLabel(getEmployeeRequestedMinutes(employee)) }}
                      </span>
                    </td>

                    <td>
                      <div class="mode-cell">
                        <Tag
                          :value="getEmployeeTimeMode(employee) === 'CUSTOM' ? 'Custom' : 'Default'"
                          :severity="getEmployeeTimeMode(employee) === 'CUSTOM' ? 'warn' : 'success'"
                          class="ot-status-tag"
                        />

                        <Button
                          v-if="isSelected(employee) && getEmployeeTimeMode(employee) === 'CUSTOM'"
                          icon="pi pi-undo"
                          text
                          rounded
                          size="small"
                          severity="secondary"
                          title="Reset to default time"
                          @click="resetEmployeeTime(employee)"
                        />
                      </div>
                    </td>

                    <td>
                      {{ buildShiftLabel(employee) }}
                    </td>

                    <td>
                      <Tag
                        v-if="isEmployeeDisabled(employee) && !isSelected(employee)"
                        :value="getEmployeeBlockInfo(employee).reason"
                        severity="danger"
                        class="ot-status-tag"
                      />

                      <Tag
                        v-else-if="isSelected(employee)"
                        value="Selected"
                        severity="success"
                        class="ot-status-tag"
                      />

                      <Tag
                        v-else-if="group.isNoLine"
                        value="Manual Select"
                        severity="warning"
                        class="ot-status-tag"
                      />

                      <Tag
                        v-else
                        value="Available"
                        severity="secondary"
                        class="ot-status-tag"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                v-if="groupHasMoreLocalRows(group)"
                class="ot-line-scroll-hint"
              >
                Scroll inside this line to show more employees...
              </div>
            </div>
          </div>
        </section>

        <div
          v-if="loadingMore"
          class="ot-more-loading"
        >
          <ProgressSpinner
            style="width: 22px; height: 22px"
            strokeWidth="4"
          />

          <span>Loading more employees...</span>
        </div>

        <div
          v-else-if="!hasMoreEmployees && loadedCount"
          class="ot-end-line"
        >
          All matched employees loaded.
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ot-employee-picker {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1.25rem;
  background: var(--ot-surface);
}

.ot-compact-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border-bottom: 1px solid var(--ot-border);
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-title-block {
  flex: 0 0 auto;
  min-width: 170px;
}

.ot-picker-title {
  white-space: nowrap;
  font-size: 1.02rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-required-star {
  color: #ef4444;
  font-weight: 600;
}

.ot-search-field {
  flex: 1 1 320px;
  min-width: 240px;
}

.ot-scope-filter {
  flex: 0 0 150px;
  width: 150px;
}

.ot-line-filter {
  flex: 0 0 170px;
  width: 170px;
}

.ot-inline-tags {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.35rem;
}

.ot-mini-summary {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.ot-mini-chip {
  min-width: 68px;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
  padding: 0.35rem 0.55rem;
  text-align: center;
}

.ot-mini-chip.is-warn {
  border-color: color-mix(in srgb, #f59e0b 45%, var(--ot-border));
  background: color-mix(in srgb, #f59e0b 10%, var(--ot-bg));
}

.ot-mini-chip span {
  display: block;
  font-size: 0.56rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-mini-chip strong {
  display: block;
  margin-top: 0.06rem;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--ot-text);
}

.ot-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.4rem;
}

.ot-table-shell {
  min-height: 280px;
  background: var(--ot-surface);
}

.ot-loading-state,
.ot-empty-state {
  display: flex;
  min-height: 280px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  color: var(--ot-text-muted);
  text-align: center;
}

.ot-empty-state i {
  font-size: 1.8rem;
}

.ot-empty-state strong {
  font-weight: 600;
  color: var(--ot-text);
}

.ot-lazy-scroll-shell {
  max-height: 560px;
  overflow: auto;
  background: var(--ot-bg);
}

.ot-line-group {
  border-bottom: 1px solid var(--ot-border);
  background: var(--ot-surface);
}

.ot-line-group.is-no-line {
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.08), transparent),
    var(--ot-surface);
}

.ot-line-sticky-head {
  position: sticky;
  top: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 3.1rem;
  border-bottom: 1px solid var(--ot-border);
  background: color-mix(in srgb, var(--ot-surface) 96%, transparent);
  padding: 0.48rem 0.75rem;
  backdrop-filter: blur(10px);
}

.ot-line-toggle {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  color: var(--ot-text);
  font-size: 0.86rem;
  font-weight: 600;
  text-align: left;
}

.ot-line-toggle i {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: var(--ot-text-muted);
}

.ot-line-toggle span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-line-head-right {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.ot-line-body {
  padding: 0.65rem;
  background: var(--ot-bg);
}

.ot-line-employee-scroll {
  max-height: 432px;
  overflow: auto;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
}

.ot-employee-table {
  width: max-content;
  min-width: 100%;
  table-layout: auto;
  border-collapse: separate;
  border-spacing: 0;
}

.ot-employee-table th {
  position: sticky;
  top: 0;
  z-index: 8;
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.06), transparent),
    var(--ot-surface);
  padding: 0.5rem 0.65rem;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

.ot-employee-table td {
  height: 42px;
  border-bottom: 1px solid var(--ot-border);
  padding: 0.38rem 0.65rem;
  color: var(--ot-text);
  font-size: 0.78rem;
  vertical-align: middle;
  white-space: nowrap;
}

.ot-employee-table tr:last-child td {
  border-bottom: 0;
}

.ot-employee-table tbody tr:hover td {
  background: color-mix(in srgb, var(--ot-bg) 70%, transparent);
}

.cell-center {
  text-align: center;
}

.cell-mono {
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
  font-weight: 500;
}

.cell-strong {
  font-weight: 600;
  color: var(--ot-text);
}

.mode-cell {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.ot-time-input {
  width: 6.8rem;
}

.ot-break-input {
  width: 5rem;
}

:deep(.ot-break-input-field) {
  width: 5rem !important;
  text-align: center;
}

.ot-line-scroll-hint,
.ot-more-loading,
.ot-end-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.58rem;
  border-top: 1px solid var(--ot-border);
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 500;
}

.ot-more-loading,
.ot-end-line {
  background: var(--ot-surface);
}

:deep(.p-checkbox) {
  width: 1rem !important;
  height: 1rem !important;
}

:deep(.p-checkbox-box) {
  width: 1rem !important;
  height: 1rem !important;
}

:deep(.p-tag.ot-status-tag) {
  min-height: 1.32rem !important;
  padding: 0.12rem 0.46rem !important;
  border: 1px solid transparent !important;
  border-radius: 999px !important;
  font-size: 0.68rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}

:deep(.p-button.p-button-sm) {
  min-height: 1.85rem !important;
  padding: 0.3rem 0.52rem !important;
  border-radius: 0.55rem !important;
  font-size: 0.74rem !important;
}

:deep(.p-inputtext),
:deep(.p-select),
:deep(.p-inputnumber-input) {
  font-size: 0.82rem !important;
}

@media (max-width: 1280px) {
  .ot-compact-header {
    flex-wrap: wrap;
  }

  .ot-mini-summary {
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .ot-compact-header {
    align-items: stretch;
    flex-direction: column;
  }

  .ot-title-block,
  .ot-search-field,
  .ot-scope-filter,
  .ot-line-filter,
  .ot-mini-summary,
  .ot-header-actions,
  .ot-inline-tags {
    width: 100%;
    flex: 1 1 auto;
  }

  .ot-mini-summary,
  .ot-header-actions,
  .ot-inline-tags {
    flex-wrap: wrap;
  }

  .ot-line-sticky-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .ot-line-head-right {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .ot-line-employee-scroll {
    max-height: 432px;
  }

  .ot-employee-table {
    min-width: 980px;
  }
}
</style>