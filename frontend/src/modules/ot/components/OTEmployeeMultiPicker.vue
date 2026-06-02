<!-- frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue -->
<script setup>
// frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
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

const emit = defineEmits(['update:modelValue', 'loading-change'])

const toast = useToast()
const { t } = useI18n()

const PAGE_SIZE = 10
const GROUP_VISIBLE_STEP = 10
const BULK_PAGE_SIZE = 100
const MAX_BULK_PAGES = 100
const SCROLL_LOAD_OFFSET = 140
const MIN_OT_DURATION_MINUTES = 60
const MAX_OT_DURATION_MINUTES = 24 * 60
const OT_DURATION_STEP_MINUTES = 30

const loadingAccess = ref(false)
const loadingLines = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const backgroundFetchingAll = ref(false)
const selectingManaged = ref(false)
const manualSelectionTouched = ref(false)

const search = ref('')
const employeeSearchValue = ref('')
const selectedLineId = ref('')
const employeeScope = ref('MANAGED')
const canSelectOtherEmployees = ref(false)

const employeeSuggestions = ref([])
const loadingSuggestions = ref(false)

const employees = ref([])
const total = ref(0)
const loadedPages = ref(new Set())

const remoteLineOptions = ref([])
const expandedLineRows = ref({})
const lineVisibleCountMap = reactive({})

let requestSeq = 0
let backgroundLoadToken = 0
let autoSelectKey = ''
let lastWatchedOtDate = ''

const selectedRows = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

const selectedIds = computed(() => {
  return new Set(selectedRows.value.map((item) => getEmployeeId(item)).filter(Boolean))
})

const selectedRowsKey = computed(() => {
  return selectedRows.value
    .map((item) => getEmployeeId(item))
    .filter(Boolean)
    .sort()
    .join('|')
})

const blockedStamp = computed(() => {
  const map = props.blockedEmployeeMap || {}
  return Object.keys(map).sort().join('|')
})

const loadedCount = computed(() => employees.value.length)

const hasMoreEmployees = computed(() => {
  return loadedCount.value < Number(total.value || 0)
})

const nextPageToLoad = computed(() => {
  return loadedPages.value.size + 1
})

const hasActiveTableFilter = computed(() => {
  return Boolean(
    toTrimmedString(search.value) ||
      toTrimmedString(selectedLineId.value),
  )
})

// Important UX rule:
// The table is a selected-employee review table, not a full employee directory.
// Candidate employees are fetched silently for auto-select and only appear while searching.
const hasSearchCandidateMode = computed(() => Boolean(toTrimmedString(search.value)))

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
    Number(
      preview.totalRequestPaidMinutes ??
        preview.totalMinutes ??
        preview.requestedMinutes ??
        0,
    ) ||
    calculateTimeWindowMinutes(requestStartTime, requestEndTime, breakMinutes)

  return {
    requestStartTime,
    requestEndTime,
    breakMinutes,

    // User-facing requested OT = after break.
    requestedMinutes,
    totalRequestPaidMinutes: requestedMinutes,
    totalMinutes: requestedMinutes,
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

const pickerBusy = computed(() => {
  return (
    loadingAccess.value ||
    loadingLines.value ||
    loading.value ||
    loadingMore.value ||
    backgroundFetchingAll.value ||
    selectingManaged.value ||
    props.blockedLoading
  )
})

const employeeScopeOptions = computed(() => [
  {
    label: t('ot.requests.create.employeePicker.myEmployees'),
    value: 'MANAGED',
  },
  {
    label: t('ot.requests.create.employeePicker.allEmployees'),
    value: 'ALL',
  },
])

const lineOptions = computed(() => [
  {
    label: t('ot.requests.create.employeePicker.allLines'),
    value: '',
  },
  ...remoteLineOptions.value,
])

const displayedEmployees = computed(() => {
  const keyword = toTrimmedString(search.value).toLowerCase()
  const lineId = toTrimmedString(selectedLineId.value)

  return employees.value
    .filter((employee) => {
      if (lineId && toTrimmedString(employee?.lineId) !== lineId) {
        return isSelected(employee)
      }

      if (!keyword) return true

      if (isSelected(employee)) return true

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

function pad2(value) {
  return String(value).padStart(2, '0')
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

function addMinutesToHHmm(startTime, minutesToAdd = 0) {
  if (!isHHmm(startTime)) return ''

  const start = timeToMinutes(startTime)
  const total = (start + Number(minutesToAdd || 0)) % 1440
  const hours = Math.floor(total / 60)
  const minutes = total % 60

  return `${pad2(hours)}:${pad2(minutes)}`
}

function clampNumber(value, min, max) {
  const number = Number(value)

  if (!Number.isFinite(number)) return min

  return Math.min(max, Math.max(min, number))
}

function normalizeDurationMinutes(value) {
  const hours = Number(value || 0)

  if (!Number.isFinite(hours) || hours <= 0) return 0

  const rawMinutes = hours * 60
  const steppedMinutes = Math.round(rawMinutes / OT_DURATION_STEP_MINUTES) * OT_DURATION_STEP_MINUTES

  return clampNumber(steppedMinutes, MIN_OT_DURATION_MINUTES, MAX_OT_DURATION_MINUTES)
}

function durationHoursToMinutes(value) {
  return normalizeDurationMinutes(value)
}

function minutesToHoursNumber(value) {
  const minutes = Number(value || 0)

  if (!Number.isFinite(minutes) || minutes <= 0) return null

  const steppedMinutes = normalizeDurationMinutes(minutes / 60)
  const hours = steppedMinutes / 60

  return Number(hours.toFixed(1))
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

function extractPermissionCodesFromAny(value, result = []) {
  if (!value) return result

  if (Array.isArray(value)) {
    for (const item of value) {
      extractPermissionCodesFromAny(item, result)
    }

    return result
  }

  if (typeof value === 'string') {
    const code = toUpperCode(value)
    if (code) result.push(code)
    return result
  }

  if (typeof value === 'object') {
    const directCode = toUpperCode(
      value.code ||
        value.permissionCode ||
        value.name ||
        value.value ||
        '',
    )

    if (directCode) result.push(directCode)

    extractPermissionCodesFromAny(value.permissions, result)
    extractPermissionCodesFromAny(value.permissionCodes, result)
    extractPermissionCodesFromAny(value.effectivePermissions, result)
    extractPermissionCodesFromAny(value.effectivePermissionCodes, result)
    extractPermissionCodesFromAny(value.directPermissions, result)
    extractPermissionCodesFromAny(value.directPermissionCodes, result)

    return result
  }

  return result
}

function extractRoleCodesFromAny(value, result = []) {
  if (!value) return result

  if (Array.isArray(value)) {
    for (const item of value) {
      extractRoleCodesFromAny(item, result)
    }

    return result
  }

  if (typeof value === 'string') {
    const code = toUpperCode(value)
    if (code) result.push(code)
    return result
  }

  if (typeof value === 'object') {
    const directCode = toUpperCode(
      value.code ||
        value.roleCode ||
        value.name ||
        value.value ||
        '',
    )

    if (directCode) result.push(directCode)

    extractRoleCodesFromAny(value.roles, result)
    extractRoleCodesFromAny(value.roleCodes, result)
    extractRoleCodesFromAny(value.systemRoles, result)

    return result
  }

  return result
}

function extractAuthAccess(res) {
  const root = extractAuthRoot(res)

  const permissionCodes = [
    ...extractPermissionCodesFromAny(root?.effectivePermissionCodes),
    ...extractPermissionCodesFromAny(root?.permissionCodes),
    ...extractPermissionCodesFromAny(root?.directPermissionCodes),
    ...extractPermissionCodesFromAny(root?.effectivePermissions),
    ...extractPermissionCodesFromAny(root?.permissions),
    ...extractPermissionCodesFromAny(root?.directPermissions),
    ...extractPermissionCodesFromAny(root?.rolePermissions),
    ...extractPermissionCodesFromAny(root?.access?.effectivePermissionCodes),
    ...extractPermissionCodesFromAny(root?.access?.permissions),
  ]
    .map(toUpperCode)
    .filter(Boolean)

  const roleCodes = [
    ...extractRoleCodesFromAny(root?.roleCodes),
    ...extractRoleCodesFromAny(root?.roles),
    ...extractRoleCodesFromAny(root?.systemRoles),
    ...extractRoleCodesFromAny(root?.access?.roleCodes),
  ]
    .map(toUpperCode)
    .filter(Boolean)

  const permissionSet = new Set(permissionCodes)
  const roleSet = new Set(roleCodes)

  const isRootAdmin =
    root?.isRootAdmin === true ||
    root?.access?.isRootAdmin === true ||
    roleSet.has('ROOT_ADMIN')

  const canLookupAll =
    isRootAdmin ||
    permissionSet.has('OT_ADD_OTHER_LINE_EMPLOYEE') ||
    permissionSet.has('OT_SELECT_OTHER_EMPLOYEE') ||
    permissionSet.has('EMPLOYEE_LOOKUP_ALL') ||
    permissionSet.has('EMPLOYEE_VIEW_ALL') ||
    permissionSet.has('ORG_EMPLOYEE_VIEW_ALL') ||
    permissionSet.has('ORG.EMPLOYEE_VIEW_ALL')

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
      (Array.isArray(employee?.lineIds) && employee.lineIds.some((lineId) => toTrimmedString(lineId))) ||
      toTrimmedString(employee?.lineCode) ||
      toTrimmedString(employee?.lineName),
  )
}

function noLineNotEligibleMessage() {
  return t('ot.requests.create.employeePicker.noLineNotEligible')
}

function getLineGroupKey(employee) {
  if (!hasLine(employee)) return 'NO_LINE'

  return (
    toTrimmedString(employee?.lineId) ||
    toTrimmedString(employee?.lineCode) ||
    toTrimmedString(employee?.lineName)
  )
}

function normalizeEmployeeRecord(source = {}) {
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
    employeeLabel:
      [employeeNo, displayName].filter(Boolean).join(' - ') ||
      displayName ||
      employeeNo,
    positionName,
    ...line,
    ...shift,
    isOutsideManaged: source?.isOutsideManaged === true,
  }
}

function normalizeSelectedEmployeeRecord(source = {}) {
  const base = normalizeEmployeeRecord(source)

  if (!base || !hasLine(base)) return null

  const startTime = toTrimmedString(source?.requestStartTime || defaultTime.value.requestStartTime)
  const endTime = toTrimmedString(source?.requestEndTime || defaultTime.value.requestEndTime)
  const breakMinutes = Number(source?.breakMinutes ?? defaultTime.value.breakMinutes ?? 0)

  const requestedMinutes =
    Number(
      source?.totalRequestPaidMinutes ??
        source?.totalMinutes ??
        source?.requestedMinutes ??
        0,
    ) ||
    calculateTimeWindowMinutes(startTime, endTime, breakMinutes) ||
    Number(defaultTime.value.requestedMinutes || 0)

  return {
    ...base,
    requestStartTime: startTime,
    requestEndTime: endTime,
    breakMinutes,

    // User-facing requested OT = after break.
    requestedMinutes,
    totalRequestPaidMinutes: requestedMinutes,
    totalMinutes: requestedMinutes,

    otTimeMode: toUpperCode(source?.otTimeMode || 'DEFAULT'),
  }
}

function normalizeEmployeeLookupResponse(res) {
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
        .map((item) => normalizeEmployeeRecord(item))
        .filter(Boolean)
        .filter(hasLine)
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

    const name = toTrimmedString(row?.name || row?.lineName)
    const label = name || t('ot.requests.create.employeePicker.unnamedLine')

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
  if (!hasLine(employee)) return t('ot.requests.create.employeePicker.noLine')

  return (
    toTrimmedString(employee?.lineName) ||
    t('ot.requests.create.employeePicker.unnamedLine')
  )
}

function buildShiftLabel(employee = {}) {
  return (
    toTrimmedString(employee?.shiftCode) ||
    t('ot.requests.create.employeePicker.noShift')
  )
}

function buildApiErrorMessage(error) {
  const data = error?.response?.data

  if (!data) return error?.message || t('ot.requests.create.employeePicker.unknownError')

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

        const message =
          item?.message ||
          item?.msg ||
          t('ot.requests.create.employeePicker.invalidValue')

        return path ? `${path}: ${message}` : message
      })
      .join('\n')
  }

  if (typeof details === 'object' && details) {
    return JSON.stringify(details, null, 2)
  }

  return (
    data?.message ||
    error?.message ||
    t('ot.requests.create.employeePicker.employeeLoadFailedDetail')
  )
}

function getSelectedEmployee(employee) {
  const id = getEmployeeId(employee)
  if (!id) return null

  return selectedRows.value.find((item) => getEmployeeId(item) === id) || null
}

function getEditableEmployee(employee) {
  return getSelectedEmployee(employee) || normalizeSelectedEmployeeRecord(employee) || employee
}

function getEmployeeRequestedMinutes(employee) {
  const editable = getEditableEmployee(employee)

  const current = Number(
    editable?.totalRequestPaidMinutes ??
      editable?.totalMinutes ??
      editable?.requestedMinutes ??
      0,
  )

  if (current > 0) return current

  return calculateTimeWindowMinutes(
    editable?.requestStartTime,
    editable?.requestEndTime,
    editable?.breakMinutes,
  )
}

function getEmployeeDurationHours(employee) {
  return minutesToHoursNumber(getEmployeeRequestedMinutes(employee))
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
      reason: t('ot.requests.create.employeePicker.invalidEmployee'),
    }
  }

  if (!hasLine(employee)) {
    return {
      blocked: true,
      reason: noLineNotEligibleMessage(),
    }
  }

  const unavailable = getBlockedRecord(employee)

  if (unavailable) {
    const requestNo = toTrimmedString(unavailable?.requestNo)
    const status = toTrimmedString(unavailable?.statusLabel || unavailable?.status)

    return {
      blocked: true,
      reason: requestNo
        ? t('ot.requests.create.employeePicker.alreadyInRequest', { requestNo })
        : status || t('ot.requests.create.employeePicker.alreadyUnavailable'),
    }
  }

  const shiftId = toTrimmedString(employee?.shiftId)

  if (!shiftId) {
    return {
      blocked: true,
      reason: t('ot.requests.create.employeePicker.employeeNoShift'),
    }
  }

  if (props.selectedShiftId && shiftId !== props.selectedShiftId) {
    return {
      blocked: true,
      reason: t('ot.requests.create.employeePicker.shiftMismatch'),
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

function markManualSelectionTouched() {
  manualSelectionTouched.value = true
}

function selectRows(rows = [], options = {}) {
  const isManual = options.manual !== false

  if (isManual) {
    markManualSelectionTouched()
  }

  const safeRows = getSelectableRows(rows)

  if (!safeRows.length) {
    toast.add({
      severity: 'warn',
      summary: t('ot.requests.create.employeePicker.cannotSelectTitle'),
      detail: t('ot.requests.create.employeePicker.noSelectableInGroup'),
      life: 2500,
    })
    return
  }

  emitSelected([...selectedRows.value, ...safeRows])
}

function removeRows(rows = [], options = {}) {
  const isManual = options.manual !== false

  if (isManual) {
    markManualSelectionTouched()
  }

  const removeIds = new Set(rows.map((item) => getEmployeeId(item)).filter(Boolean))

  emitSelected(
    selectedRows.value.filter((item) => !removeIds.has(getEmployeeId(item))),
  )
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
      summary: t('ot.requests.create.employeePicker.cannotSelectEmployeeTitle'),
      detail: blockInfo.reason,
      life: 3000,
    })
    return
  }

  selectRows([employee])
}

function updateSelectedEmployeeDuration(employee, hoursValue) {
  markManualSelectionTouched()

  const id = getEmployeeId(employee)
  if (!id) return

  const exists = isSelected(employee)

  if (!exists && isEmployeeDisabled(employee)) {
    toast.add({
      severity: 'warn',
      summary: t('ot.requests.create.employeePicker.cannotEditEmployeeTitle'),
      detail: getEmployeeBlockInfo(employee).reason,
      life: 3000,
    })
    return
  }

  const normalized = normalizeSelectedEmployeeRecord(employee)

  if (!normalized) return

  const baseRows = exists
    ? selectedRows.value
    : [...selectedRows.value, normalized]

  const paidMinutes = durationHoursToMinutes(hoursValue)
  const nextRows = baseRows.map((item) => {
    if (getEmployeeId(item) !== id) return item

    const startTime = toTrimmedString(
      item.requestStartTime ||
        defaultTime.value.requestStartTime,
    )

    const endTime = startTime && paidMinutes
      ? addMinutesToHHmm(startTime, paidMinutes)
      : ''

    return {
      ...item,
      requestStartTime: startTime,
      requestEndTime: endTime,
      breakMinutes: 0,
      requestedMinutes: paidMinutes,
      totalRequestPaidMinutes: paidMinutes,
      totalMinutes: paidMinutes,
      otTimeMode: 'CUSTOM',
    }
  })

  emitSelected(nextRows)
}

function resetEmployeeTime(employee) {
  markManualSelectionTouched()

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
      totalRequestPaidMinutes: defaultTime.value.requestedMinutes,
      totalMinutes: defaultTime.value.requestedMinutes,
      otTimeMode: 'DEFAULT',
    }
  })

  emitSelected(nextRows)
}

function updateDefaultSelectedEmployeeTimes() {
  if (!selectedRows.value.length) return

  const nextRows = selectedRows.value.map((item) => {
    const mode = toUpperCode(item?.otTimeMode || 'DEFAULT')

    if (mode === 'CUSTOM') {
      const paidMinutes = Number(
        item?.totalRequestPaidMinutes ??
          item?.totalMinutes ??
          item?.requestedMinutes ??
          0,
      )

      const startTime = defaultTime.value.requestStartTime
      const endTime = startTime && paidMinutes
        ? addMinutesToHHmm(startTime, paidMinutes)
        : ''

      return {
        ...item,
        requestStartTime: startTime,
        requestEndTime: endTime,
        breakMinutes: 0,
        requestedMinutes: paidMinutes,
        totalRequestPaidMinutes: paidMinutes,
        totalMinutes: paidMinutes,
        otTimeMode: 'CUSTOM',
      }
    }

    return {
      ...item,
      requestStartTime: defaultTime.value.requestStartTime,
      requestEndTime: defaultTime.value.requestEndTime,
      breakMinutes: defaultTime.value.breakMinutes,
      requestedMinutes: defaultTime.value.requestedMinutes,
      totalRequestPaidMinutes: defaultTime.value.requestedMinutes,
      totalMinutes: defaultTime.value.requestedMinutes,
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
  const hasSearchOrLineFilter = Boolean(
    toTrimmedString(search.value) ||
      toTrimmedString(selectedLineId.value),
  )

  const shouldOpenNewLineGroups = Boolean(
    props.otDate ||
      props.autoSelectReady ||
      hasSearchOrLineFilter,
  )

  const nextExpanded = {
    ...expandedLineRows.value,
  }

  for (const group of lineGroups.value) {
    if (hasSearchOrLineFilter) {
      nextExpanded[group.id] = true
    } else if (nextExpanded[group.id] === undefined) {
      nextExpanded[group.id] = shouldOpenNewLineGroups
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
    otEligibleOnly: true,
    hasLineOnly: true,
    scope: targetScope,
    all: targetScope === 'ALL',
    includeAll: targetScope === 'ALL',
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
    otEligibleOnly: true,
    hasLineOnly: true,
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
      summary: t('ot.requests.create.employeePicker.lineFilterUnavailableTitle'),
      detail: buildApiErrorMessage(error) || t('ot.requests.create.employeePicker.lineFilterUnavailableDetail'),
      life: 3000,
    })
  } finally {
    loadingLines.value = false
  }
}

function clearLineUiState() {
  expandedLineRows.value = {}

  for (const key of Object.keys(lineVisibleCountMap)) {
    delete lineVisibleCountMap[key]
  }
}

function resetEmployeeListState() {
  backgroundLoadToken += 1
  backgroundFetchingAll.value = false

  employees.value = []
  total.value = 0
  loadedPages.value = new Set()
  clearLineUiState()
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

function showSelectedOnlyTable() {
  backgroundLoadToken += 1
  backgroundFetchingAll.value = false
  loading.value = false
  loadingMore.value = false

  employees.value = mergeLoadedEmployees(selectedRows.value, [])
  total.value = employees.value.length
  loadedPages.value = new Set()

  clearLineUiState()
  syncLineState()
}

function upsertEmployeesToTable(rows = []) {
  employees.value = mergeLoadedEmployees(selectedRows.value, [
    ...employees.value,
    ...rows,
  ])

  total.value = Math.max(Number(total.value || 0), employees.value.length)
  syncLineState()
}

function openEmployeeGroup(employee) {
  const groupId = getLineGroupKey(employee)

  expandedLineRows.value = {
    ...expandedLineRows.value,
    [groupId]: true,
  }

  lineVisibleCountMap[groupId] = Math.max(
    Number(lineVisibleCountMap[groupId] || GROUP_VISIBLE_STEP),
    GROUP_VISIBLE_STEP,
  )
}

function clearEmployeeSuggestionSearch() {
  employeeSearchValue.value = ''
  employeeSuggestions.value = []
  search.value = ''
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
    const res = await getEmployeeLookupOptions(buildEmployeeParams(targetPage))

    const payload = normalizeEmployeeLookupResponse(res)

    if (currentSeq !== requestSeq) return

    total.value = payload.total

    if (replace) {
      employees.value = mergeLoadedEmployees(selectedRows.value, payload.rows)
      loadedPages.value = new Set([targetPage])
      clearLineUiState()
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
      summary: t('ot.requests.create.employeePicker.employeeLoadFailedTitle'),
      detail: buildApiErrorMessage(error),
      life: 3000,
    })
  } finally {
    if (currentSeq === requestSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

async function resetAndLoadEmployees() {
  // Do not load every employee into the visible table.
  // Keep the table clean and show selected employees only.
  resetEmployeeListState()
  showSelectedOnlyTable()
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
}

async function autoSelectManagedEmployees() {
  if (!props.autoSelectAll) return
  if (!props.autoSelectReady) return
  if (!props.otDate) return
  if (props.blockedLoading) return
  if (selectingManaged.value) return

  // Auto-select is only first-time helper.
  // After user manually changes/unselects employee, do not auto-select again.
  if (manualSelectionTouched.value) return

  const nextKey = [
    props.otDate,
    toTrimmedString(props.selectedShiftId),
    defaultTimeKey.value,
    blockedStamp.value,
  ].join('|')

  if (autoSelectKey === nextKey) return

  autoSelectKey = nextKey
  selectingManaged.value = true

  try {
    const rows = []
    let currentPage = 1
    let keepLoading = true

    while (keepLoading) {
      const res = await getEmployeeLookupOptions(buildBulkManagedParams(currentPage))
      const payload = normalizeEmployeeLookupResponse(res)

      rows.push(...payload.rows)

      const loaded = currentPage * BULK_PAGE_SIZE
      keepLoading = loaded < payload.total && payload.rows.length > 0
      currentPage += 1

      if (currentPage > MAX_BULK_PAGES) keepLoading = false
    }

    const selectableRows = rows.filter((row) => !getEmployeeBlockInfo(row).blocked)
    const nextSelectedRows = mergeUniqueRows([...selectedRows.value, ...selectableRows])

    emitSelected(nextSelectedRows)

    // Fetch silently, but do not show all fetched/unselected employees.
    // The requester should only review the employees that will be submitted.
    employees.value = mergeLoadedEmployees(nextSelectedRows, [])
    total.value = employees.value.length
    loadedPages.value = new Set()
    clearLineUiState()
    syncLineState()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('ot.requests.create.employeePicker.autoSelectFailedTitle'),
      detail: buildApiErrorMessage(error) || t('ot.requests.create.employeePicker.autoSelectFailedDetail'),
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

async function searchEmployeeSuggestions(event = {}) {
  const keyword = toTrimmedString(event.query)
  employeeSearchValue.value = keyword
  search.value = keyword

  if (!props.otDate || !keyword) {
    employeeSuggestions.value = []
    showSelectedOnlyTable()
    return
  }

  const suggestionScope = canSelectOtherEmployees.value ? 'ALL' : employeeScope.value

  loadingSuggestions.value = true

  try {
    const res = await getEmployeeLookupOptions({
      page: 1,
      limit: 20,
      search: keyword,
      q: keyword,
      lineId: '',
      shiftId: toTrimmedString(props.selectedShiftId),
      isActive: true,
      otEligibleOnly: true,
      hasLineOnly: true,
      scope: suggestionScope,
      all: suggestionScope === 'ALL',
      includeAll: suggestionScope === 'ALL',
    })

    const payload = normalizeEmployeeLookupResponse(res)

    employeeSuggestions.value = payload.rows

    // Show only selected rows + current search matches.
    employees.value = mergeLoadedEmployees(selectedRows.value, payload.rows)
    total.value = employees.value.length
    loadedPages.value = new Set([1])
    clearLineUiState()
    syncLineState()
  } catch {
    employeeSuggestions.value = []
  } finally {
    loadingSuggestions.value = false
  }
}

function onEmployeeAutocompleteSelect(event = {}) {
  const employee = normalizeEmployeeRecord(event.value)

  if (!employee) {
    clearEmployeeSuggestionSearch()
    showSelectedOnlyTable()
    return
  }

  const info = getEmployeeBlockInfo(employee)

  if (info.blocked) {
    toast.add({
      severity: 'warn',
      summary: t('ot.requests.create.employeePicker.cannotSelectEmployeeTitle'),
      detail: info.reason,
      life: 3000,
    })

    clearEmployeeSuggestionSearch()
    showSelectedOnlyTable()
    return
  }

  const selectedLine = toTrimmedString(selectedLineId.value)
  const employeeLine = toTrimmedString(employee.lineId)

  if (selectedLine && selectedLine !== employeeLine) {
    selectedLineId.value = ''
  }

  selectRows([employee])

  // Keep table simple after select:
  // selected employees only, so it will not show every line.
  employees.value = mergeLoadedEmployees([...selectedRows.value, employee], [])
  total.value = employees.value.length
  clearLineUiState()
  syncLineState()
  openEmployeeGroup(employee)

  clearEmployeeSuggestionSearch()
}

function onFilterChange() {
  // Line filter should not load a long unselected employee list.
  showSelectedOnlyTable()
}

watch(employeeScope, () => {
  // Switching to All Employees changes the search/auto-select scope only.
  // It must not turn the table into a long employee directory.
  clearEmployeeSuggestionSearch()
  showSelectedOnlyTable()
})

watch(employeeSearchValue, (value) => {
  if (toTrimmedString(value)) return

  if (!toTrimmedString(search.value) && !employeeSuggestions.value.length) return

  search.value = ''
  employeeSuggestions.value = []
  showSelectedOnlyTable()
})

watch(
  pickerBusy,
  (value) => {
    emit('loading-change', value)
  },
  { immediate: true },
)

watch(lineGroups, () => {
  syncLineState()
})

watch(defaultTimeKey, () => {
  updateDefaultSelectedEmployeeTimes()
})

watch(
  () => props.otDate,
  async () => {
    const nextOtDate = toTrimmedString(props.otDate)
    const dateChanged = nextOtDate !== lastWatchedOtDate

    if (dateChanged) {
      // New OT date = allow first-time auto-select again.
      manualSelectionTouched.value = false
      autoSelectKey = ''
      lastWatchedOtDate = nextOtDate
    }

    search.value = ''
    employeeSearchValue.value = ''
    employeeSuggestions.value = []
    selectedLineId.value = ''

    resetEmployeeListState()

    if (!props.otDate) return

    await autoSelectManagedEmployees()

    if (!employees.value.length) {
      showSelectedOnlyTable()
    } else {
      syncLineState()
    }
  },
)

watch(
  () => [props.otDate, props.autoSelectReady, props.blockedLoading, blockedStamp.value].join('|'),
  async () => {
    removeInvalidSelectedRows()
    await autoSelectManagedEmployees()

    if (!employees.value.length) {
      showSelectedOnlyTable()
    } else {
      syncLineState()
    }
  },
)

watch(selectedRowsKey, () => {
  syncLineState()
})

onMounted(async () => {
  await Promise.all([
    loadAccess(),
    loadLineOptions(),
  ])

  lastWatchedOtDate = toTrimmedString(props.otDate)

  await autoSelectManagedEmployees()

  if (!employees.value.length) {
    showSelectedOnlyTable()
  } else {
    syncLineState()
  }
})

onBeforeUnmount(() => {
  backgroundLoadToken += 1
})
</script>

<template>
  <section class="ot-employee-picker">
    <div class="ot-compact-header">
      <div class="ot-title-block">
        <h2 class="ot-picker-title">
          {{ t('ot.requests.create.employeePicker.title') }}
          <span class="ot-required-star">*</span>
        </h2>
      </div>

      <AutoComplete
        v-model="employeeSearchValue"
        :suggestions="employeeSuggestions"
        option-label="employeeLabel"
        class="ot-search-field"
        input-class="w-full"
        panel-class="ot-employee-suggest-panel"
        :placeholder="t('ot.requests.create.employeePicker.searchPlaceholder')"
        :loading="loadingSuggestions"
        :min-length="1"
        :delay="180"
        @complete="searchEmployeeSuggestions"
        @item-select="onEmployeeAutocompleteSelect"
      >
        <template #option="{ option }">
          <div class="ot-suggest-option">
            <span class="ot-suggest-id">
              {{ option.employeeNo || t('ot.requests.create.employeePicker.noEmployeeId') }}
            </span>

            <span class="ot-suggest-name">
              {{ option.displayName || '-' }}
            </span>

            <small>
              {{ option.lineName || option.positionName || '-' }}
            </small>
          </div>
        </template>
      </AutoComplete>

      <Select
        v-model="employeeScope"
        :options="employeeScopeOptions"
        option-label="label"
        option-value="value"
        class="ot-scope-filter"
        size="small"
        :placeholder="t('ot.requests.create.employeePicker.scopePlaceholder')"
        :disabled="loadingAccess"
      />

      <Select
        v-model="selectedLineId"
        :options="lineOptions"
        option-label="label"
        option-value="value"
        class="ot-line-filter"
        size="small"
        :placeholder="t('ot.requests.create.employeePicker.allLines')"
        :loading="loadingLines"
        @change="onFilterChange"
      />
    </div>

    <Message
      v-if="!props.otDate"
      severity="info"
      :closable="false"
      class="mx-3 mb-3"
    >
      {{ t('ot.requests.create.employeePicker.chooseDateFirst') }}
    </Message>

    <Message
      v-else-if="props.blockedLoading"
      severity="info"
      :closable="false"
      class="mx-3 mb-3"
    >
      {{ t('ot.requests.create.employeePicker.checkingBlocked') }}
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
          stroke-width="4"
        />

        <span>
          {{
            selectingManaged
              ? t('ot.requests.create.employeePicker.autoSelecting')
              : t('ot.requests.create.employeePicker.loadingEmployees')
          }}
        </span>
      </div>

      <div
        v-else-if="!hasAnyRows"
        class="ot-empty-state"
      >
        <i class="pi pi-users" />

        <strong>{{ t('ot.requests.create.employeePicker.emptyTitle') }}</strong>

        <span>{{ t('ot.requests.create.employeePicker.emptyText') }}</span>
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
                :value="t('ot.requests.create.employeePicker.staffCount', { count: group.count })"
                severity="secondary"
                class="ot-status-tag"
              />

              <Tag
                :value="t('ot.requests.create.employeePicker.groupSelectedCount', {
                  selected: group.selectedCount,
                  total: group.count,
                })"
                :severity="group.selectedCount ? 'success' : 'secondary'"
                class="ot-status-tag"
              />

              <Tag
                v-if="group.disabledCount"
                :value="t('ot.requests.create.employeePicker.unavailableCount', {
                  count: group.disabledCount,
                })"
                severity="danger"
                class="ot-status-tag"
              />

              <Tag
                v-if="group.isNoLine"
                :value="t('ot.requests.create.employeePicker.manualOnly')"
                severity="warning"
                class="ot-status-tag"
              />

              <Checkbox
                binary
                :model-value="isLineGroupSelected(group)"
                :disabled="!group.selectableCount"
                @update:model-value="(checked) => toggleLineGroup(group, checked)"
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
                    <th>{{ t('common.no') }}</th>
                    <th></th>
                    <th>{{ t('ot.requests.employeeId') }}</th>
                    <th>{{ t('common.name') }}</th>
                    <th>{{ t('nav.positions') }}</th>
                    <th>{{ t('ot.requests.create.otTime') }}</th>
                  </tr>
                </thead>

                <tbody>
                  <tr
                    v-for="(employee, index) in getVisibleRowsForGroup(group)"
                    :key="getEmployeeId(employee)"
                    :class="{ 'is-blocked-row': getEmployeeBlockInfo(employee).blocked && !isSelected(employee) }"
                  >
                    <td class="cell-center">
                      {{ index + 1 }}
                    </td>

                    <td class="cell-center">
                      <Checkbox
                        binary
                        :model-value="isSelected(employee)"
                        :disabled="isEmployeeDisabled(employee) && !isSelected(employee)"
                        @update:model-value="(checked) => toggleEmployee(employee, checked)"
                      />
                    </td>

                    <td>
                      <span class="cell-mono">
                        {{ employee.employeeNo || t('ot.requests.create.employeePicker.noEmployeeId') }}
                      </span>
                    </td>

                    <td>
                      <span class="cell-strong">
                        {{ employee.displayName || '-' }}
                      </span>
                    </td>

                    <td>
                      <div class="cell-stack">
                        <span>{{ employee.positionName || '-' }}</span>

                        <Tag
                          v-if="getEmployeeBlockInfo(employee).blocked && !isSelected(employee)"
                          :value="getEmployeeBlockInfo(employee).reason"
                          severity="danger"
                          class="ot-status-tag"
                        />
                      </div>
                    </td>

                    <td>
                      <div class="ot-time-total-cell">
                        <InputNumber
                          :model-value="getEmployeeDurationHours(employee)"
                          class="ot-duration-input"
                          input-class="ot-duration-input-field"
                          :min="1"
                          :max="24"
                          :step="0.5"
                          :min-fraction-digits="0"
                          :max-fraction-digits="1"
                          suffix=" h"
                          show-buttons
                          button-layout="horizontal"
                          decrement-button-icon="pi pi-minus"
                          increment-button-icon="pi pi-plus"
                          :disabled="isEmployeeDisabled(employee) && !isSelected(employee)"
                          @update:model-value="(value) => updateSelectedEmployeeDuration(employee, value)"
                        />

                        <Button
                          v-if="isSelected(employee) && getEmployeeTimeMode(employee) === 'CUSTOM'"
                          icon="pi pi-undo"
                          text
                          rounded
                          size="small"
                          severity="secondary"
                          :title="t('ot.requests.create.employeePicker.resetDefaultTime')"
                          @click="resetEmployeeTime(employee)"
                        />
                      </div>
                    </td>

                  </tr>
                </tbody>
              </table>

              <div
                v-if="groupHasMoreLocalRows(group)"
                class="ot-line-scroll-hint"
              >
                {{ t('ot.requests.create.employeePicker.scrollMoreLocal') }}
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
            stroke-width="4"
          />

          <span>{{ t('ot.requests.create.employeePicker.loadingMore') }}</span>
        </div>

        <div
          v-else-if="!hasMoreEmployees && loadedCount && hasActiveTableFilter"
          class="ot-end-line"
        >
          {{ t('ot.requests.create.employeePicker.allMatchedLoaded') }}
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

.ot-employee-table tbody tr.is-blocked-row td {
  background: color-mix(in srgb, #ef4444 5%, var(--ot-surface));
  color: var(--ot-text-muted);
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

.cell-stack {
  display: inline-flex;
  max-width: 18rem;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.32rem;
}

.ot-duration-input {
  width: 8.8rem;
}

:deep(.ot-duration-input .p-inputnumber-input),
:deep(.ot-duration-input-field) {
  width: 3.9rem !important;
  min-width: 3.9rem !important;
  text-align: center;
  font-size: 0.78rem !important;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

:deep(.ot-duration-input .p-inputnumber-button) {
  width: 1.85rem !important;
  padding-inline: 0 !important;
}

.ot-suggest-option {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 0.2rem 0.65rem;
  align-items: center;
}

.ot-suggest-id {
  color: var(--ot-text);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.ot-suggest-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-suggest-option small {
  grid-column: 1 / -1;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
}

.ot-time-total-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 9.6rem;
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
}

@media (max-width: 768px) {
  .ot-employee-picker {
    border-radius: 1rem;
  }

  .ot-compact-header {
    align-items: stretch;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.65rem;
  }

  .ot-title-block,
  .ot-search-field,
  .ot-scope-filter,
  .ot-line-filter {
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
  }

  .ot-picker-title {
    font-size: 0.92rem;
  }

  .ot-table-shell {
    min-height: 240px;
  }

  .ot-lazy-scroll-shell {
    max-height: 62vh;
  }

  .ot-line-sticky-head {
    align-items: stretch;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.5rem 0.6rem;
  }

  .ot-line-head-right {
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.32rem;
  }

  .ot-line-body {
    padding: 0.5rem;
  }

  .ot-line-employee-scroll {
    max-height: 58vh;
    -webkit-overflow-scrolling: touch;
  }

  .ot-employee-table {
    min-width: 780px;
  }

  .ot-employee-table th {
    padding: 0.46rem 0.5rem;
    font-size: 0.68rem;
  }

  .ot-employee-table td {
    padding: 0.34rem 0.5rem;
    font-size: 0.74rem;
  }

  .ot-duration-input {
    width: 8rem;
  }

  .ot-time-total-cell {
    min-width: 8.6rem;
  }

  :deep(.p-inputtext),
  :deep(.p-select-label),
  :deep(.p-inputnumber-input) {
    font-size: 16px !important;
  }

  :deep(.ot-duration-input .p-inputnumber-input),
  :deep(.ot-duration-input-field) {
    width: 3.4rem !important;
    min-width: 3.4rem !important;
    font-size: 16px !important;
  }
}
</style>