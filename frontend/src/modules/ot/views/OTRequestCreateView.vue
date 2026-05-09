<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestCreateView.vue

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import OTDetailView from '@/modules/ot/components/OTDetailView.vue'
import OTEmployeeMultiPicker from '@/modules/ot/components/OTEmployeeMultiPicker.vue'
import OTSubmitBar from '@/modules/ot/components/OTSubmitBar.vue'
import api from '@/shared/services/api'

import {
  createOTRequest,
  getShiftOTOptionsByShift,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()

const submitting = ref(false)
const loadingRequester = ref(false)
const loadingShiftOptions = ref(false)
const loadingUnavailableEmployees = ref(false)

const selectedEmployees = ref([])
const requesterEmployee = ref(null)
const shiftOptions = ref([])
const unavailableEmployees = ref([])
const selectedOptionDayType = ref('')
const lastLoadedShiftKey = ref('')

let unavailableRequestSeq = 0

const form = reactive({
  otDate: null,

  // SHIFT_OPTION = use admin preset time.
  // CUSTOM_FIXED = user enters custom default time but still selects option for policy/template.
  otTimingSource: 'SHIFT_OPTION',

  shiftOtOptionId: '',

  customStartTime: '',
  customEndTime: '',
  customBreakMinutes: 0,

  reason: '',
})

const selectedDateYMD = computed(() => formatYMD(form.otDate))

const selectedEmployeeIds = computed(() =>
  selectedEmployees.value
    .map((item) => getEmployeeId(item))
    .filter(Boolean),
)

const selectedOTOption = computed(() =>
  shiftOptions.value.find((item) => item.id === form.shiftOtOptionId) || null,
)

const isCustomFixedTime = computed(() => {
  return String(form.otTimingSource || 'SHIFT_OPTION').trim().toUpperCase() === 'CUSTOM_FIXED'
})

const unavailableEmployeeMap = computed(() => {
  const map = {}

  for (const item of unavailableEmployees.value) {
    const employeeId = String(item?.employeeId || '').trim()
    if (!employeeId) continue
    map[employeeId] = item
  }

  return map
})

const canAutoSelectEmployees = computed(() => {
  return Boolean(selectedDateYMD.value) && !loadingUnavailableEmployees.value
})

const requestPreview = computed(() => {
  if (!sharedShift.value || !selectedOTOption.value) return null

  const requestedMinutes = Number(selectedOTOption.value.requestedMinutes || 0)

  return {
    timingMode: String(selectedOTOption.value.timingMode || 'AFTER_SHIFT_END')
      .trim()
      .toUpperCase(),
    requestStartTime: String(selectedOTOption.value.requestStartTime || '').trim(),
    requestEndTime: String(selectedOTOption.value.requestEndTime || '').trim(),
    breakMinutes: 0,
    requestedMinutes,
    requestedHours: Number(
      selectedOTOption.value.requestedHours ||
        (requestedMinutes / 60).toFixed(2),
    ),
  }
})

const defaultTiming = computed(() => {
  if (isCustomFixedTime.value) {
    const startTime = String(form.customStartTime || '').trim()
    const endTime = String(form.customEndTime || '').trim()
    const breakMinutes = Number(form.customBreakMinutes || 0)
    const totalMinutes =
      startTime && endTime
        ? calculateTimeWindowMinutes(startTime, endTime, breakMinutes)
        : 0

    return {
      source: 'CUSTOM_FIXED',
      startTime,
      endTime,
      breakMinutes,
      requestedMinutes: totalMinutes,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
    }
  }

  return {
    source: 'SHIFT_OPTION',
    startTime: String(requestPreview.value?.requestStartTime || '').trim(),
    endTime: String(requestPreview.value?.requestEndTime || '').trim(),
    breakMinutes: Number(requestPreview.value?.breakMinutes || 0),
    requestedMinutes: Number(requestPreview.value?.requestedMinutes || 0),
    totalMinutes: Number(requestPreview.value?.requestedMinutes || 0),
    totalHours: Number(requestPreview.value?.requestedHours || 0),
  }
})

const pickerRequestPreview = computed(() => ({
  timingMode: defaultTiming.value.source,
  requestStartTime: defaultTiming.value.startTime,
  requestEndTime: defaultTiming.value.endTime,
  breakMinutes: defaultTiming.value.breakMinutes,
  requestedMinutes: defaultTiming.value.requestedMinutes,
  requestedHours: defaultTiming.value.totalHours,
}))

function getEmployeeId(employee) {
  return String(employee?._id || employee?.id || employee?.employeeId || '').trim()
}

function extractShiftInfo(employee) {
  const shift =
    employee?.shift ||
    employee?.shiftInfo ||
    employee?.assignedShift ||
    {}

  const shiftId = String(
    employee?.shiftId ||
      shift?._id ||
      shift?.id ||
      '',
  ).trim()

  if (!shiftId) return null

  return {
    shiftId,
    code: String(employee?.shiftCode || shift?.code || '').trim(),
    name: String(employee?.shiftName || shift?.name || '').trim(),
  }
}

const selectedShiftState = computed(() => {
  if (!selectedEmployees.value.length) {
    return {
      mode: 'none',
      shift: null,
      message: '',
    }
  }

  const shiftInfos = selectedEmployees.value.map(extractShiftInfo)
  const missingShiftCount = shiftInfos.filter((item) => !item?.shiftId).length

  if (missingShiftCount > 0) {
    return {
      mode: 'missing',
      shift: null,
      message: 'Some selected employees do not have assigned shift information.',
    }
  }

  const uniqueShiftIds = Array.from(new Set(shiftInfos.map((item) => item.shiftId)))

  if (uniqueShiftIds.length > 1) {
    return {
      mode: 'mixed',
      shift: null,
      message: 'Selected employees belong to different shifts. Please select one shift only.',
    }
  }

  return {
    mode: 'ready',
    shift: shiftInfos[0],
    message: '',
  }
})

const sharedShift = computed(() => selectedShiftState.value.shift || null)

const sharedShiftIdForPicker = computed(() => {
  return selectedShiftState.value.mode === 'ready'
    ? String(sharedShift.value?.shiftId || '').trim()
    : ''
})

const sharedShiftLabelForPicker = computed(() => {
  if (selectedShiftState.value.mode !== 'ready') return ''

  return [sharedShift.value?.code, sharedShift.value?.name]
    .filter(Boolean)
    .join(' · ')
})

function normalizeMeResponse(res) {
  const root =
    res?.data?.data?.user ||
    res?.data?.data ||
    res?.data?.user ||
    res?.data ||
    {}

  const employee =
    root?.employee ||
    root?.employeeProfile ||
    root?.employeeInfo ||
    {}

  const _id = String(
    employee?._id ||
      employee?.id ||
      root?.employeeId ||
      root?.employee?._id ||
      '',
  ).trim()

  const displayName = String(
    employee?.displayName ||
      employee?.name ||
      root?.displayName ||
      root?.name ||
      root?.loginId ||
      '',
  ).trim()

  const employeeNo = String(
    employee?.employeeNo || root?.employeeNo || '',
  ).trim()

  if (!_id || !displayName) return null

  return {
    _id,
    displayName,
    employeeNo,
  }
}

function normalizeUnavailableEmployeesResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

  return rows
    .map((item) => ({
      employeeId: String(item?.employeeId || '').trim(),
      employeeCode: String(item?.employeeCode || '').trim(),
      employeeName: String(item?.employeeName || '').trim(),
      employeeLabel: String(item?.employeeLabel || '').trim(),
      requestNo: String(item?.requestNo || '').trim(),
      status: String(item?.status || '').trim(),
      statusLabel: String(item?.statusLabel || '').trim(),
      otDate: String(item?.otDate || '').trim(),
    }))
    .filter((item) => item.employeeId)
}

function normalizeShiftOptionsResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

  selectedOptionDayType.value = String(payload?.dayType || '').trim().toUpperCase()

  return rows
    .map((item) => {
      const requestedMinutes = Number(item?.requestedMinutes || 0)
      const requestedHours = Number(
        item?.requestedHours || (requestedMinutes / 60).toFixed(2),
      )

      const timingMode = String(item?.timingMode || 'AFTER_SHIFT_END')
        .trim()
        .toUpperCase()

      const requestStartTime = String(
        item?.requestStartTime || item?.fixedStartTime || '',
      ).trim()

      const requestEndTime = String(
        item?.requestEndTime || item?.fixedEndTime || '',
      ).trim()

      const label = String(item?.label || '').trim()
      const dayTypeLabel = String(item?.dayTypeLabel || '').trim()
      const windowLabel =
        requestStartTime && requestEndTime
          ? `${requestStartTime} - ${requestEndTime}`
          : ''

      const parts = [
        label,
        dayTypeLabel,
        windowLabel,
        formatMinutesLabel(requestedMinutes),
      ].filter(Boolean)

      return {
        id: String(item?.id || item?._id || '').trim(),
        label,
        timingMode,
        applicableDayTypes: Array.isArray(item?.applicableDayTypes)
          ? item.applicableDayTypes
          : [],
        dayTypeLabel,
        requestStartTime,
        requestEndTime,
        requestedMinutes,
        requestedHours,
        sequence: Number(item?.sequence || 0),
        calculationPolicy: item?.calculationPolicy || null,
        optionLabel: parts.join(' · '),
      }
    })
    .filter((item) => item.id && item.label)
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatYMD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim())
}

function timeToMinutes(value) {
  if (!isHHmm(value)) return 0

  const [hh, mm] = String(value).split(':').map(Number)
  return hh * 60 + mm
}

function calculateRawTimeWindowMinutes(startTime, endTime) {
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
  if (!isHHmm(startTime) || !isHHmm(endTime)) return 0

  const rawMinutes = calculateRawTimeWindowMinutes(startTime, endTime)
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

function clearShiftOptions() {
  shiftOptions.value = []
  form.shiftOtOptionId = ''
  selectedOptionDayType.value = ''
  lastLoadedShiftKey.value = ''
}

function removeUnavailableSelectedEmployees() {
  const blockedMap = unavailableEmployeeMap.value
  const beforeCount = selectedEmployees.value.length

  selectedEmployees.value = selectedEmployees.value.filter((item) => {
    const employeeId = getEmployeeId(item)
    return !blockedMap[employeeId]
  })

  const removedCount = beforeCount - selectedEmployees.value.length

  if (removedCount > 0) {
    toast.add({
      severity: 'warn',
      summary: 'Employees removed',
      detail: `${removedCount} employee(s) already have OT request on this date and were removed from selection.`,
      life: 5000,
    })
  }
}

async function loadRequesterEmployee() {
  try {
    loadingRequester.value = true
    const res = await api.get('/auth/me')
    requesterEmployee.value = normalizeMeResponse(res)
  } catch (error) {
    requesterEmployee.value = null
    toast.add({
      severity: 'error',
      summary: 'Profile load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load your profile.',
      life: 3000,
    })
  } finally {
    loadingRequester.value = false
  }
}

async function loadUnavailableEmployeesForDate() {
  const otDate = selectedDateYMD.value
  const requestSeq = ++unavailableRequestSeq

  unavailableEmployees.value = []

  if (!otDate) return

  loadingUnavailableEmployees.value = true

  try {
    const res = await api.get('/ot/requests/unavailable-employees', {
      params: { otDate },
    })

    if (requestSeq !== unavailableRequestSeq) return

    unavailableEmployees.value = normalizeUnavailableEmployeesResponse(res)
    removeUnavailableSelectedEmployees()
  } catch (error) {
    unavailableEmployees.value = []

    toast.add({
      severity: 'warn',
      summary: 'OT availability check failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to check existing OT employees for this date.',
      life: 3500,
    })
  } finally {
    if (requestSeq === unavailableRequestSeq) {
      loadingUnavailableEmployees.value = false
    }
  }
}

async function loadShiftOptionsForSharedShift() {
  const state = selectedShiftState.value
  const otDate = selectedDateYMD.value

  if (!otDate) {
    clearShiftOptions()
    return
  }

  if (state.mode !== 'ready' || !state.shift?.shiftId) {
    clearShiftOptions()
    return
  }

  const loadKey = `${state.shift.shiftId}|${otDate}`

  if (lastLoadedShiftKey.value === loadKey) return

  loadingShiftOptions.value = true
  form.shiftOtOptionId = ''

  try {
    const res = await getShiftOTOptionsByShift(state.shift.shiftId, {
      otDate,
    })

    const rows = normalizeShiftOptionsResponse(res)

    shiftOptions.value = rows
    lastLoadedShiftKey.value = loadKey

    if (rows.length === 1) {
      form.shiftOtOptionId = rows[0].id
    }

    if (!rows.length) {
      toast.add({
        severity: 'warn',
        summary: 'No OT option',
        detail:
          selectedOptionDayType.value
            ? `No active OT option found for ${selectedOptionDayType.value}. Please ask admin to create one.`
            : 'No active OT option found for this shift/date.',
        life: 4500,
      })
    }
  } catch (error) {
    clearShiftOptions()

    toast.add({
      severity: 'error',
      summary: 'OT options failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load OT options for the selected shift and date.',
      life: 3500,
    })
  } finally {
    loadingShiftOptions.value = false
  }
}

function getEmployeeTiming(employee = {}) {
  const startTime = String(
    employee?.requestStartTime ||
      employee?.startTime ||
      defaultTiming.value.startTime ||
      '',
  ).trim()

  const endTime = String(
    employee?.requestEndTime ||
      employee?.endTime ||
      defaultTiming.value.endTime ||
      '',
  ).trim()

  const breakMinutes = Number(
    employee?.breakMinutes ??
      defaultTiming.value.breakMinutes ??
      0,
  )

  const requestedMinutes =
    Number(employee?.requestedMinutes || 0) ||
    calculateTimeWindowMinutes(startTime, endTime, breakMinutes) ||
    Number(defaultTiming.value.requestedMinutes || 0)

  return {
    startTime,
    endTime,
    breakMinutes,
    requestedMinutes,
  }
}

function buildEmployeePayloadRows() {
  return selectedEmployees.value
    .map((employee) => {
      const employeeId = getEmployeeId(employee)
      if (!employeeId) return null

      const timing = getEmployeeTiming(employee)

      return {
        employeeId,
        requestStartTime: timing.startTime,
        requestEndTime: timing.endTime,
        breakMinutes: timing.breakMinutes,
        requestedMinutes: timing.requestedMinutes,
        otTimeMode: String(employee?.otTimeMode || 'DEFAULT').trim().toUpperCase(),
      }
    })
    .filter(Boolean)
}

function buildEmployeeTimeOverridesPayload() {
  return buildEmployeePayloadRows()
    .filter((item) => item.otTimeMode === 'CUSTOM')
    .map((item) => ({
      employeeId: item.employeeId,
      startTime: item.requestStartTime,
      endTime: item.requestEndTime,
      breakMinutes: item.breakMinutes,
    }))
}

function buildPayload() {
  const employees = buildEmployeePayloadRows()

  const rootStartTime = String(
    form.customStartTime ||
      defaultTiming.value.startTime ||
      requestPreview.value?.requestStartTime ||
      '',
  ).trim()

  const rootEndTime = String(
    form.customEndTime ||
      defaultTiming.value.endTime ||
      requestPreview.value?.requestEndTime ||
      '',
  ).trim()

  const rootBreakMinutes = Number(
    form.customBreakMinutes ??
      defaultTiming.value.breakMinutes ??
      requestPreview.value?.breakMinutes ??
      0,
  )

  const rootRequestedMinutes =
    Number(defaultTiming.value.requestedMinutes || 0) ||
    calculateTimeWindowMinutes(rootStartTime, rootEndTime, rootBreakMinutes)

  return {
    employeeIds: selectedEmployeeIds.value,

    // New clean structure from MultiPicker.
    employees,

    // Old backend-compatible override structure.
    employeeTimeOverrides: buildEmployeeTimeOverridesPayload(),

    otDate: selectedDateYMD.value,

    otTimingSource: String(form.otTimingSource || 'SHIFT_OPTION')
      .trim()
      .toUpperCase(),

    shiftOtOptionId: String(form.shiftOtOptionId || '').trim(),

    // Backend-compatible root timing fields.
    // Even SHIFT_OPTION sends these because backend currently requires customStartTime.
    customStartTime: rootStartTime,
    customEndTime: rootEndTime,
    customBreakMinutes: rootBreakMinutes,

    startTime: rootStartTime,
    endTime: rootEndTime,
    requestStartTime: rootStartTime,
    requestEndTime: rootEndTime,
    breakMinutes: rootBreakMinutes,
    requestedMinutes: rootRequestedMinutes,
    totalMinutes: rootRequestedMinutes,
    totalHours: Number((rootRequestedMinutes / 60).toFixed(2)),

    reason: String(form.reason || '').trim(),
  }
}

function validateEmployeeTimingRows(employeeRows = []) {
  for (const row of employeeRows) {
    const label = row.employeeId

    if (!row.requestStartTime) return `Missing OT start time for employee ${label}.`
    if (!row.requestEndTime) return `Missing OT end time for employee ${label}.`

    if (!isHHmm(row.requestStartTime)) {
      return `Invalid OT start time for employee ${label}.`
    }

    if (!isHHmm(row.requestEndTime)) {
      return `Invalid OT end time for employee ${label}.`
    }

    if (row.requestStartTime === row.requestEndTime) {
      return `OT start time and end time cannot be the same for employee ${label}.`
    }

    const rawMinutes = calculateRawTimeWindowMinutes(
      row.requestStartTime,
      row.requestEndTime,
    )

    if (Number(row.breakMinutes || 0) >= rawMinutes) {
      return `Break minutes cannot be greater than or equal to OT duration for employee ${label}.`
    }
  }

  return ''
}

function validateBeforeSubmit(payload) {
  if (loadingUnavailableEmployees.value) {
    return 'Please wait until OT availability check finishes.'
  }

  if (!payload.otDate) return 'Please select OT date first.'
  if (!payload.employeeIds.length) return 'Please select at least 1 employee.'

  if (selectedShiftState.value.mode === 'missing') {
    return 'Some selected employees do not have assigned shift information.'
  }

  if (selectedShiftState.value.mode === 'mixed') {
    return 'Please select employees from one shift only before creating OT request.'
  }

  if (!payload.shiftOtOptionId) {
    return selectedOptionDayType.value
      ? `Please select OT option for ${selectedOptionDayType.value}.`
      : 'Please select OT option.'
  }

  if (payload.otTimingSource === 'CUSTOM_FIXED') {
    if (!payload.customStartTime) return 'Please enter custom start time.'
    if (!payload.customEndTime) return 'Please enter custom end time.'

    if (!isHHmm(payload.customStartTime)) {
      return 'Custom start time must be HH:mm, for example 18:00.'
    }

    if (!isHHmm(payload.customEndTime)) {
      return 'Custom end time must be HH:mm, for example 20:00.'
    }

    if (payload.customStartTime === payload.customEndTime) {
      return 'Custom start time and end time cannot be the same.'
    }

    const rawMinutes = calculateRawTimeWindowMinutes(
      payload.customStartTime,
      payload.customEndTime,
    )

    if (Number(payload.customBreakMinutes || 0) >= rawMinutes) {
      return 'Custom break minutes cannot be greater than or equal to OT duration.'
    }
  }

  if (!defaultTiming.value.startTime || !defaultTiming.value.endTime) {
    return 'Please select valid OT timing before submitting.'
  }

  const employeeTimingError = validateEmployeeTimingRows(payload.employees)
  if (employeeTimingError) return employeeTimingError

  return ''
}

function getErrorPayload(error) {
  return error?.response?.data || {}
}

function normalizeDuplicateEmployees(error) {
  const payload = getErrorPayload(error)

  const duplicates =
    payload?.duplicates ||
    payload?.details?.duplicates ||
    payload?.data?.duplicates ||
    []

  if (!Array.isArray(duplicates)) return []

  return duplicates
    .map((item) => ({
      employeeId: String(item?.employeeId || '').trim(),
      employeeCode: String(item?.employeeCode || '').trim(),
      employeeName: String(item?.employeeName || '').trim(),
      employeeLabel: String(item?.employeeLabel || '').trim(),
      requestNo: String(item?.requestNo || '').trim(),
      status: String(item?.status || '').trim(),
      otDate: String(item?.otDate || '').trim(),
    }))
    .filter((item) => item.employeeId)
}

function normalizeMissingClockInEmployees(error) {
  const payload = getErrorPayload(error)

  const rows =
    payload?.details?.missingEmployees ||
    payload?.data?.missingEmployees ||
    payload?.missingEmployees ||
    []

  if (!Array.isArray(rows)) return []

  return rows
    .map((item) => ({
      employeeId: String(item?.employeeId || '').trim(),
      employeeNo: String(item?.employeeNo || '').trim(),
      employeeName: String(item?.employeeName || '').trim(),
      employeeLabel: String(item?.employeeLabel || '').trim(),
    }))
    .filter((item) => item.employeeId)
}

function removeEmployeesFromSelectionByIds(employeeIds = []) {
  const idSet = new Set(employeeIds.map((id) => String(id || '').trim()).filter(Boolean))
  if (!idSet.size) return 0

  const beforeCount = selectedEmployees.value.length

  selectedEmployees.value = selectedEmployees.value.filter((item) => {
    const employeeId = getEmployeeId(item)
    return !idSet.has(employeeId)
  })

  return beforeCount - selectedEmployees.value.length
}

function buildDuplicateToastMessage(duplicates = []) {
  const preview = duplicates
    .slice(0, 5)
    .map((item) => {
      const employeeLabel =
        item.employeeLabel ||
        [item.employeeCode, item.employeeName].filter(Boolean).join(' - ') ||
        item.employeeId

      return item.requestNo ? `${employeeLabel} (${item.requestNo})` : employeeLabel
    })
    .join(', ')

  const moreText = duplicates.length > 5 ? ` and ${duplicates.length - 5} more` : ''

  return `These employees already have OT request on this date. Removed from selection: ${preview}${moreText}.`
}

function buildMissingClockInToastMessage(missing = []) {
  const preview = missing
    .slice(0, 5)
    .map((item) => {
      return (
        item.employeeLabel ||
        [item.employeeNo, item.employeeName].filter(Boolean).join(' - ') ||
        item.employeeId
      )
    })
    .join(', ')

  const moreText = missing.length > 5 ? ` and ${missing.length - 5} more` : ''

  return `Today OT requires attendance time-in. Removed from selection: ${preview}${moreText}.`
}

function buildApiErrorMessage(error) {
  const data = error?.response?.data

  if (!data) {
    return error?.message || 'Unknown error.'
  }

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

async function submit() {
  const payload = buildPayload()
  const message = validateBeforeSubmit(payload)

  if (message) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: message,
      life: 2500,
    })
    return
  }

  try {
    submitting.value = true
    await createOTRequest(payload)

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'OT request created successfully.',
      life: 2500,
    })

    router.push('/ot/requests')
  } catch (error) {
    const duplicates = normalizeDuplicateEmployees(error)

    if (duplicates.length) {
      const removedCount = removeEmployeesFromSelectionByIds(
        duplicates.map((item) => item.employeeId),
      )

      toast.add({
        severity: 'warn',
        summary: 'Duplicate OT employees',
        detail:
          removedCount > 0
            ? buildDuplicateToastMessage(duplicates)
            : error?.response?.data?.message ||
              buildDuplicateToastMessage(duplicates),
        life: 8000,
      })

      await loadUnavailableEmployeesForDate()
      return
    }

    const missingClockInEmployees = normalizeMissingClockInEmployees(error)

    if (missingClockInEmployees.length) {
      const removedCount = removeEmployeesFromSelectionByIds(
        missingClockInEmployees.map((item) => item.employeeId),
      )

      toast.add({
        severity: 'warn',
        summary: 'Attendance time-in required',
        detail:
          removedCount > 0
            ? buildMissingClockInToastMessage(missingClockInEmployees)
            : error?.response?.data?.message ||
              buildMissingClockInToastMessage(missingClockInEmployees),
        life: 8000,
      })

      return
    }

    console.error('Create OT failed:', error?.response?.data || error)

    toast.add({
      severity: 'error',
      summary: 'Create failed',
      detail: buildApiErrorMessage(error),
      life: 8000,
    })
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push('/ot/requests')
}

watch(
  () =>
    selectedShiftState.value.mode === 'ready'
      ? `${selectedShiftState.value.shift?.shiftId || ''}|${selectedDateYMD.value}`
      : '',
  async () => {
    await loadShiftOptionsForSharedShift()
  },
  { immediate: true },
)

watch(
  () => selectedDateYMD.value,
  async () => {
    selectedEmployees.value = []
    clearShiftOptions()
    await loadUnavailableEmployeesForDate()
  },
)

watch(
  () => [
    form.otTimingSource,
    form.customStartTime,
    form.customEndTime,
    form.customBreakMinutes,
  ].join('|'),
  () => {
    if (!isCustomFixedTime.value) {
      form.customStartTime = ''
      form.customEndTime = ''
      form.customBreakMinutes = 0
    }
  },
)

onMounted(async () => {
  await loadRequesterEmployee()
})
</script>

<template>
  <div class="ot-create-page">
    <OTDetailView
      :form="form"
      :selected-employee-count="selectedEmployeeIds.length"
      :selected-shift-state="selectedShiftState"
      :shift-options="shiftOptions"
      :loading-shift-options="loadingShiftOptions"
      :selected-ot-option="selectedOTOption"
      :request-preview="requestPreview"
    />

    <OTEmployeeMultiPicker
      v-model="selectedEmployees"
      :ot-date="selectedDateYMD"
      :selected-shift-id="sharedShiftIdForPicker"
      :selected-shift-label="sharedShiftLabelForPicker"
      :auto-select-all="true"
      :auto-select-ready="canAutoSelectEmployees"
      :blocked-employee-map="unavailableEmployeeMap"
      :blocked-loading="loadingUnavailableEmployees"
      :request-preview="pickerRequestPreview"
    />

    <div class="ot-create-bottom-grid">
      <div />

      <OTSubmitBar
        :submitting="submitting"
        :disabled="loadingRequester || loadingShiftOptions || loadingUnavailableEmployees"
        @submit="submit"
        @back="goBack"
      />
    </div>
  </div>
</template>

<style scoped>
.ot-create-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ot-create-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

@media (min-width: 1024px) {
  .ot-create-bottom-grid {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }
}
</style>