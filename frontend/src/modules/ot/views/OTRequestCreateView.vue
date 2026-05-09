<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestCreateView.vue

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

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

const employeeTimeOverrides = reactive({})

const adjustDialogVisible = ref(false)
const adjustEmployee = ref(null)

const adjustForm = reactive({
  startTime: '',
  endTime: '',
  breakMinutes: 0,
})

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

const selectedOverrideCount = computed(() => Object.keys(employeeTimeOverrides).length)

const canAutoSelectEmployees = computed(() => {
  return Boolean(formatYMD(form.otDate)) && !loadingUnavailableEmployees.value
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
    breakMinutes: 0,
    requestedMinutes: Number(requestPreview.value?.requestedMinutes || 0),
    totalMinutes: Number(requestPreview.value?.requestedMinutes || 0),
    totalHours: Number(requestPreview.value?.requestedHours || 0),
  }
})

const selectedEmployeeRowsForTiming = computed(() => {
  return selectedEmployees.value.map((employee, index) => {
    const employeeId = getEmployeeId(employee)
    const override = employeeTimeOverrides[employeeId] || null
    const timing = override || defaultTiming.value

    return {
      no: index + 1,
      employee,
      employeeId,
      employeeNo: String(employee?.employeeNo || employee?.employeeCode || '').trim(),
      displayName: String(employee?.displayName || employee?.employeeName || employee?.name || '').trim(),
      positionName: String(employee?.positionName || employee?.position?.name || '').trim(),
      lineLabel: buildLineLabel(employee),
      isCustom: Boolean(override),
      startTime: timing.startTime || '',
      endTime: timing.endTime || '',
      breakMinutes: Number(timing.breakMinutes || 0),
      totalMinutes: Number(timing.totalMinutes || timing.requestedMinutes || 0),
      totalHours: Number(timing.totalHours || 0),
    }
  })
})

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

function buildLineLabel(employee = {}) {
  return (
    String(employee?.lineLabel || '').trim() ||
    [employee?.lineCode, employee?.lineName].filter(Boolean).join(' · ') ||
    'No line'
  )
}

function clearShiftOptions() {
  shiftOptions.value = []
  form.shiftOtOptionId = ''
  selectedOptionDayType.value = ''
  lastLoadedShiftKey.value = ''
  clearAllEmployeeTimeOverrides()
}

function clearAllEmployeeTimeOverrides() {
  for (const key of Object.keys(employeeTimeOverrides)) {
    delete employeeTimeOverrides[key]
  }
}

function cleanupEmployeeTimeOverrides() {
  const selectedIdSet = new Set(selectedEmployeeIds.value)

  for (const key of Object.keys(employeeTimeOverrides)) {
    if (!selectedIdSet.has(key)) {
      delete employeeTimeOverrides[key]
    }
  }
}

function removeUnavailableSelectedEmployees() {
  const blockedMap = unavailableEmployeeMap.value
  const beforeCount = selectedEmployees.value.length

  selectedEmployees.value = selectedEmployees.value.filter((item) => {
    const employeeId = getEmployeeId(item)
    return !blockedMap[employeeId]
  })

  cleanupEmployeeTimeOverrides()

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
  const otDate = formatYMD(form.otDate)
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
  const otDate = formatYMD(form.otDate)

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
  clearAllEmployeeTimeOverrides()

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

function openAdjustEmployee(employee) {
  const employeeId = getEmployeeId(employee)
  if (!employeeId) return

  const override = employeeTimeOverrides[employeeId]
  const fallback = defaultTiming.value

  if (!fallback.startTime || !fallback.endTime) {
    toast.add({
      severity: 'warn',
      summary: 'Default OT time required',
      detail: 'Please select OT option or enter custom default time first.',
      life: 3000,
    })
    return
  }

  adjustEmployee.value = employee

  adjustForm.startTime = override?.startTime || fallback.startTime || ''
  adjustForm.endTime = override?.endTime || fallback.endTime || ''
  adjustForm.breakMinutes = Number(override?.breakMinutes ?? fallback.breakMinutes ?? 0)

  adjustDialogVisible.value = true
}

function saveAdjustEmployeeTime() {
  const employee = adjustEmployee.value
  const employeeId = getEmployeeId(employee)

  if (!employeeId) return

  const startTime = String(adjustForm.startTime || '').trim()
  const endTime = String(adjustForm.endTime || '').trim()
  const breakMinutes = Number(adjustForm.breakMinutes || 0)

  if (!isHHmm(startTime)) {
    toast.add({
      severity: 'warn',
      summary: 'Invalid start time',
      detail: 'Start time must be HH:mm, for example 18:00.',
      life: 2500,
    })
    return
  }

  if (!isHHmm(endTime)) {
    toast.add({
      severity: 'warn',
      summary: 'Invalid end time',
      detail: 'End time must be HH:mm, for example 21:00.',
      life: 2500,
    })
    return
  }

  if (startTime === endTime) {
    toast.add({
      severity: 'warn',
      summary: 'Invalid OT time',
      detail: 'Start time and end time cannot be the same.',
      life: 2500,
    })
    return
  }

  const rawMinutes = calculateRawTimeWindowMinutes(startTime, endTime)

  if (breakMinutes >= rawMinutes) {
    toast.add({
      severity: 'warn',
      summary: 'Invalid break',
      detail: 'Break minutes cannot be greater than or equal to OT duration.',
      life: 2500,
    })
    return
  }

  const totalMinutes = calculateTimeWindowMinutes(startTime, endTime, breakMinutes)

  employeeTimeOverrides[employeeId] = {
    employeeId,
    startTime,
    endTime,
    breakMinutes,
    requestedMinutes: totalMinutes,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
  }

  adjustDialogVisible.value = false
  adjustEmployee.value = null
}

function resetEmployeeTime(employee) {
  const employeeId = getEmployeeId(employee)
  if (!employeeId) return

  delete employeeTimeOverrides[employeeId]
}

function buildPayload() {
  return {
    employeeIds: selectedEmployeeIds.value,
    otDate: formatYMD(form.otDate),

    otTimingSource: String(form.otTimingSource || 'SHIFT_OPTION')
      .trim()
      .toUpperCase(),

    shiftOtOptionId: String(form.shiftOtOptionId || '').trim(),

    customStartTime: String(form.customStartTime || '').trim(),
    customEndTime: String(form.customEndTime || '').trim(),
    customBreakMinutes: Number(form.customBreakMinutes || 0),

    employeeTimeOverrides: Object.values(employeeTimeOverrides).map((item) => ({
      employeeId: String(item.employeeId || '').trim(),
      startTime: String(item.startTime || '').trim(),
      endTime: String(item.endTime || '').trim(),
      breakMinutes: Number(item.breakMinutes || 0),
    })),

    reason: String(form.reason || '').trim(),
  }
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

  cleanupEmployeeTimeOverrides()

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

    toast.add({
      severity: 'error',
      summary: 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to create OT request.',
      life: 4000,
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
      ? `${selectedShiftState.value.shift?.shiftId || ''}|${formatYMD(form.otDate)}`
      : '',
  async () => {
    await loadShiftOptionsForSharedShift()
  },
  { immediate: true },
)

watch(
  () => formatYMD(form.otDate),
  async () => {
    selectedEmployees.value = []
    clearShiftOptions()
    clearAllEmployeeTimeOverrides()
    await loadUnavailableEmployeesForDate()
  },
)

watch(
  () => selectedEmployeeIds.value.join('|'),
  () => {
    cleanupEmployeeTimeOverrides()
  },
)

watch(
  () => form.shiftOtOptionId,
  () => {
    clearAllEmployeeTimeOverrides()
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

    clearAllEmployeeTimeOverrides()
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
      auto-select-all
      :ot-date="formatYMD(form.otDate)"
      :selected-shift-id="sharedShiftIdForPicker"
      :selected-shift-label="sharedShiftLabelForPicker"
      :auto-select-ready="canAutoSelectEmployees"
      :blocked-employee-map="unavailableEmployeeMap"
      :blocked-loading="loadingUnavailableEmployees"
    />

    <section
      v-if="selectedEmployees.length"
      class="ot-time-adjust-card"
    >
      <div class="ot-time-adjust-head">
        <div class="min-w-0">
          <h2>Employee OT time</h2>
          <p>
            Default:
            <strong>
              {{ defaultTiming.startTime || '-' }} - {{ defaultTiming.endTime || '-' }}
            </strong>
            · {{ formatMinutesLabel(defaultTiming.totalMinutes) }}
            <span v-if="selectedOptionDayType">
              · {{ selectedOptionDayType }}
            </span>
          </p>
        </div>

        <div class="ot-time-tags">
          <Tag
            :value="`${selectedEmployees.length} employees`"
            severity="info"
          />

          <Tag
            v-if="selectedOverrideCount"
            :value="`${selectedOverrideCount} adjusted`"
            severity="warn"
          />

          <Tag
            v-else
            value="All default"
            severity="success"
          />
        </div>
      </div>

      <Message
        severity="info"
        :closable="false"
        class="ot-adjust-note"
      >
        Use Adjust only for employees who work different OT time from the default.
      </Message>

      <div class="ot-time-table-wrap">
        <table class="ot-time-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Employee</th>
              <th>Position</th>
              <th>Line</th>
              <th>OT Time</th>
              <th>Total</th>
              <th>Mode</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="row in selectedEmployeeRowsForTiming"
              :key="row.employeeId"
            >
              <td>{{ row.no }}</td>

              <td>
                <div class="ot-employee-cell">
                  <strong>{{ row.employeeNo || 'No ID' }}</strong>
                  <span>{{ row.displayName || 'Unknown' }}</span>
                </div>
              </td>

              <td>{{ row.positionName || '-' }}</td>

              <td>{{ row.lineLabel }}</td>

              <td>
                <strong>{{ row.startTime || '-' }} - {{ row.endTime || '-' }}</strong>
                <small v-if="row.breakMinutes">
                  Break {{ row.breakMinutes }}m
                </small>
              </td>

              <td>{{ formatMinutesLabel(row.totalMinutes) }}</td>

              <td>
                <Tag
                  :value="row.isCustom ? 'Custom' : 'Default'"
                  :severity="row.isCustom ? 'warn' : 'success'"
                />
              </td>

              <td>
                <div class="ot-row-actions">
                  <Button
                    label="Adjust"
                    icon="pi pi-pencil"
                    size="small"
                    outlined
                    @click="openAdjustEmployee(row.employee)"
                  />

                  <Button
                    v-if="row.isCustom"
                    label="Reset"
                    icon="pi pi-refresh"
                    size="small"
                    severity="secondary"
                    text
                    @click="resetEmployeeTime(row.employee)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="ot-create-bottom-grid">
      <div />

      <OTSubmitBar
        :submitting="submitting"
        :disabled="loadingRequester || loadingShiftOptions || loadingUnavailableEmployees"
        @submit="submit"
        @back="goBack"
      />
    </div>

    <Dialog
      v-model:visible="adjustDialogVisible"
      modal
      header="Adjust employee OT time"
      class="ot-adjust-dialog"
      :style="{ width: 'min(96vw, 520px)' }"
    >
      <div class="ot-adjust-body">
        <div
          v-if="adjustEmployee"
          class="ot-adjust-employee"
        >
          <strong>
            {{ adjustEmployee.employeeNo || adjustEmployee.employeeCode || 'No ID' }}
          </strong>

          <span>
            {{ adjustEmployee.displayName || adjustEmployee.employeeName || adjustEmployee.name }}
          </span>
        </div>

        <div class="ot-adjust-grid">
          <div class="ot-field">
            <label>Start Time</label>

            <InputText
              v-model.trim="adjustForm.startTime"
              placeholder="18:00"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label>End Time</label>

            <InputText
              v-model.trim="adjustForm.endTime"
              placeholder="21:00"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label>Break Minutes</label>

            <InputNumber
              v-model="adjustForm.breakMinutes"
              class="w-full"
              inputClass="w-full"
              :min="0"
              :max="1440"
              :step="5"
              showButtons
            />
          </div>
        </div>

        <div class="ot-adjust-preview">
          <span>Total OT</span>
          <strong>
            {{
              formatMinutesLabel(
                calculateTimeWindowMinutes(
                  adjustForm.startTime,
                  adjustForm.endTime,
                  adjustForm.breakMinutes,
                ),
              )
            }}
          </strong>
        </div>
      </div>

      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          @click="adjustDialogVisible = false"
        />

        <Button
          label="Save"
          icon="pi pi-check"
          @click="saveAdjustEmployeeTime"
        />
      </template>
    </Dialog>
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

.ot-time-adjust-card {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1.25rem;
  background: var(--ot-surface);
}

.ot-time-adjust-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--ot-border);
  padding: 1rem;
}

.ot-time-adjust-head h2 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-time-adjust-head p {
  margin: 0.22rem 0 0;
  font-size: 0.78rem;
  color: var(--ot-text-muted);
}

.ot-time-adjust-head p strong {
  color: var(--ot-text);
  font-weight: 600;
}

.ot-time-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}

.ot-adjust-note {
  margin: 0.75rem 1rem 0;
}

.ot-time-table-wrap {
  overflow-x: auto;
  padding: 0.85rem 1rem 1rem;
}

.ot-time-table {
  width: 100%;
  min-width: 860px;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
}

.ot-time-table th,
.ot-time-table td {
  border-bottom: 1px solid var(--ot-border);
  padding: 0.62rem 0.72rem;
  text-align: left;
  vertical-align: middle;
  font-size: 0.82rem;
  color: var(--ot-text);
  white-space: nowrap;
}

.ot-time-table th {
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.08), transparent),
    var(--ot-surface);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-time-table tr:last-child td {
  border-bottom: 0;
}

.ot-time-table td small {
  display: block;
  margin-top: 0.12rem;
  font-size: 0.7rem;
  color: var(--ot-text-muted);
}

.ot-employee-cell {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.ot-employee-cell strong {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-employee-cell span {
  font-size: 0.78rem;
  color: var(--ot-text-muted);
}

.ot-row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
}

.text-right {
  text-align: right !important;
}

.ot-adjust-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.ot-adjust-employee {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-adjust-employee strong {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-adjust-employee span {
  display: block;
  margin-top: 0.12rem;
  font-size: 0.8rem;
  color: var(--ot-text-muted);
}

.ot-adjust-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
}

.ot-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.ot-field label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-adjust-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-adjust-preview span {
  font-size: 0.76rem;
  color: var(--ot-text-muted);
}

.ot-adjust-preview strong {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ot-text);
}

:deep(.p-button.p-button-sm) {
  padding: 0.34rem 0.58rem !important;
  font-size: 0.78rem !important;
}

:deep(.p-tag) {
  font-weight: 500 !important;
}

:deep(.ot-adjust-dialog .p-dialog-content) {
  background: var(--ot-surface) !important;
}

:deep(.p-inputtext),
:deep(.p-inputnumber-input) {
  font-size: 0.86rem;
}

@media (min-width: 768px) {
  .ot-adjust-grid {
    grid-template-columns: 1fr 1fr 160px;
  }
}

@media (min-width: 1024px) {
  .ot-create-bottom-grid {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }
}
</style>