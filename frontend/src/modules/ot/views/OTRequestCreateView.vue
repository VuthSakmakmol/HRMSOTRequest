<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestCreateView.vue

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

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
const employeePickerLoading = ref(false)

let unavailableRequestSeq = 0

const form = reactive({
  otDate: null,
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

const submitDisabled = computed(() => {
  return (
    loadingRequester.value ||
    loadingShiftOptions.value ||
    loadingUnavailableEmployees.value ||
    employeePickerLoading.value ||
    submitting.value ||
    !selectedEmployeeIds.value.length
  )
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
      message: t('ot.requests.create.missingShift'),
    }
  }

  const uniqueShiftIds = Array.from(new Set(shiftInfos.map((item) => item.shiftId)))

  if (uniqueShiftIds.length > 1) {
    return {
      mode: 'mixed',
      shift: null,
      message: t('ot.requests.create.mixedShift'),
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

  return String(sharedShift.value?.code || '').trim()
})

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

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

        // Number 4 dropdown shows only OT option name.
        optionLabel: label,
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

  if (!minutes) return t('ot.common.minuteValue', { value: 0 })

  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60

  if (hh && mm) {
    return t('ot.common.hourMinuteValue', {
      hours: hh,
      minutes: mm,
    })
  }

  if (hh) return t('ot.common.hourValue', { value: hh })
  return t('ot.common.minuteValue', { value: mm })
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
    showToast(
      'warn',
      t('ot.requests.create.employeesRemoved'),
      t('ot.requests.create.employeesRemovedDetail', { count: removedCount }),
      5000,
    )
  }
}

async function loadRequesterEmployee() {
  loadingRequester.value = true

  try {
    const res = await api.get('/auth/me')
    requesterEmployee.value = normalizeMeResponse(res)
  } catch (error) {
    requesterEmployee.value = null

    showToast(
      'error',
      t('ot.requests.create.profileLoadFailed'),
      buildApiErrorMessage(error, t('ot.requests.create.profileLoadFailedDetail')),
      3500,
    )
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

    showToast(
      'warn',
      t('ot.requests.create.availabilityFailed'),
      buildApiErrorMessage(error, t('ot.requests.create.availabilityFailedDetail')),
      3500,
    )
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
      showToast(
        'warn',
        t('ot.requests.create.noOptionTitle'),
        selectedOptionDayType.value
          ? t('ot.requests.create.noOptionForDayType', {
              dayType: selectedOptionDayType.value,
            })
          : t('ot.requests.create.noOptionGeneric'),
        4500,
      )
    }
  } catch (error) {
    clearShiftOptions()

    showToast(
      'error',
      t('ot.requests.create.optionsFailed'),
      buildApiErrorMessage(error, t('ot.requests.create.optionsFailedDetail')),
      3500,
    )
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
    employeeTimeOverrides: buildEmployeeTimeOverridesPayload(),
    employees,

    otDate: selectedDateYMD.value,

    otTimingSource: String(form.otTimingSource || 'SHIFT_OPTION')
      .trim()
      .toUpperCase(),

    shiftOtOptionId: String(form.shiftOtOptionId || '').trim(),

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
    const employeeLabel = findSelectedEmployeeLabel(row.employeeId)

    if (!row.requestStartTime) {
      return t('ot.requests.create.missingEmployeeStart', { employee: employeeLabel })
    }

    if (!row.requestEndTime) {
      return t('ot.requests.create.missingEmployeeEnd', { employee: employeeLabel })
    }

    if (!isHHmm(row.requestStartTime)) {
      return t('ot.requests.create.employeeStartInvalid', { employee: employeeLabel })
    }

    if (!isHHmm(row.requestEndTime)) {
      return t('ot.requests.create.employeeEndInvalid', { employee: employeeLabel })
    }

    if (row.requestStartTime === row.requestEndTime) {
      return t('ot.requests.create.employeeTimeSame', { employee: employeeLabel })
    }

    const rawMinutes = calculateRawTimeWindowMinutes(
      row.requestStartTime,
      row.requestEndTime,
    )

    if (Number(row.breakMinutes || 0) >= rawMinutes) {
      return t('ot.requests.create.employeeBreakTooLong', { employee: employeeLabel })
    }
  }

  return ''
}

function validateBeforeSubmit(payload) {
  if (loadingUnavailableEmployees.value) {
    return t('ot.requests.create.waitAvailability')
  }

  if (!payload.otDate) return t('ot.requests.create.selectDateFirst')
  if (!payload.employeeIds.length) return t('ot.requests.create.selectAtLeastOneEmployee')

  if (selectedShiftState.value.mode === 'missing') {
    return t('ot.requests.create.missingShift')
  }

  if (selectedShiftState.value.mode === 'mixed') {
    return t('ot.requests.create.mixedShift')
  }

  if (!payload.shiftOtOptionId) {
    return selectedOptionDayType.value
      ? t('ot.requests.create.selectOtOptionForDayType', {
          dayType: selectedOptionDayType.value,
        })
      : t('ot.requests.create.selectOtOptionRequired')
  }

  if (payload.otTimingSource === 'CUSTOM_FIXED') {
    if (!payload.customStartTime) return t('ot.requests.create.enterCustomStartTime')
    if (!payload.customEndTime) return t('ot.requests.create.enterCustomEndTime')

    if (!isHHmm(payload.customStartTime)) {
      return t('ot.requests.create.customStartInvalid')
    }

    if (!isHHmm(payload.customEndTime)) {
      return t('ot.requests.create.customEndInvalid')
    }

    if (payload.customStartTime === payload.customEndTime) {
      return t('ot.requests.create.customTimeSame')
    }

    const rawMinutes = calculateRawTimeWindowMinutes(
      payload.customStartTime,
      payload.customEndTime,
    )

    if (Number(payload.customBreakMinutes || 0) >= rawMinutes) {
      return t('ot.requests.create.breakTooLong')
    }
  }

  if (!defaultTiming.value.startTime || !defaultTiming.value.endTime) {
    return t('ot.requests.create.selectValidTiming')
  }

  const employeeTimingError = validateEmployeeTimingRows(payload.employees || [])
  if (employeeTimingError) return employeeTimingError

  return ''
}

function getErrorPayload(error) {
  return error?.response?.data || {}
}

function getErrorObject(error) {
  const payload = getErrorPayload(error)

  return (
    payload?.error ||
    payload?.data?.error ||
    {}
  )
}

function getErrorParams(error) {
  const payload = getErrorPayload(error)
  const errorObject = getErrorObject(error)

  return (
    payload?.params ||
    payload?.details?.params ||
    payload?.data?.params ||
    payload?.data?.details?.params ||
    errorObject?.params ||
    errorObject?.details?.params ||
    {}
  )
}

function getErrorCode(error) {
  const payload = getErrorPayload(error)
  const errorObject = getErrorObject(error)

  return String(
    payload?.code ||
      payload?.data?.code ||
      errorObject?.code ||
      '',
  ).trim().toUpperCase()
}

function getErrorMessageText(error) {
  const payload = getErrorPayload(error)
  const errorObject = getErrorObject(error)

  return String(
    payload?.message ||
      payload?.data?.message ||
      errorObject?.message ||
      error?.message ||
      '',
  ).trim()
}

function normalizeDuplicateEmployees(error) {
  const payload = getErrorPayload(error)
  const errorObject = getErrorObject(error)
  const params = getErrorParams(error)

  const duplicates =
    payload?.duplicates ||
    payload?.details?.duplicates ||
    payload?.data?.duplicates ||
    payload?.data?.details?.duplicates ||
    errorObject?.duplicates ||
    errorObject?.details?.duplicates ||
    errorObject?.params?.duplicates ||
    params?.duplicates ||
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
  const errorObject = getErrorObject(error)
  const params = getErrorParams(error)

  const rows =
    payload?.details?.missingEmployees ||
    payload?.data?.missingEmployees ||
    payload?.data?.details?.missingEmployees ||
    payload?.missingEmployees ||
    errorObject?.missingEmployees ||
    errorObject?.details?.missingEmployees ||
    errorObject?.params?.missingEmployees ||
    params?.missingEmployees ||
    []

  if (!Array.isArray(rows)) return []

  return rows
    .map((item) => ({
      employeeId: String(item?.employeeId || '').trim(),
      employeeNo: String(item?.employeeNo || item?.employeeCode || '').trim(),
      employeeCode: String(item?.employeeCode || item?.employeeNo || '').trim(),
      employeeName: String(item?.employeeName || '').trim(),
      employeeLabel: String(item?.employeeLabel || '').trim(),
    }))
    .filter((item) => item.employeeId)
}

function buildApiErrorMessage(error, fallback = '') {
  const payload = getErrorPayload(error)
  const errorObject = getErrorObject(error)

  const details =
    payload?.details ||
    payload?.errors ||
    payload?.data?.details ||
    payload?.data?.errors ||
    errorObject?.details ||
    errorObject?.errors

  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => {
        if (typeof item === 'string') return item

        const path = Array.isArray(item?.path)
          ? item.path.join('.')
          : item?.path || item?.field || ''

        const message = item?.message || item?.msg || t('common.somethingWentWrong')

        return path ? `${path}: ${message}` : message
      })
      .join('\n')
  }

  const code = getErrorCode(error)
  const message = getErrorMessageText(error)

  if (code === 'ACCOUNT_EMPLOYEE_LINK_REQUIRED') {
    return t('ot.requests.create.accountEmployeeLinkRequired')
  }

  if (code === 'OT_APPROVER_NOT_FOUND') {
    return t('ot.requests.create.approverNotFound')
  }

  if (code === 'OT_TODAY_ATTENDANCE_TIME_IN_REQUIRED') {
    return t('ot.requests.create.todayAttendanceRequired')
  }

  if (code === 'OT_EMPLOYEE_DUPLICATE_DATE') {
    return t('ot.requests.create.duplicateGeneric')
  }

  return message || fallback || t('ot.requests.create.createFailedDetail')
}

function findSelectedEmployeeLabel(employeeId) {
  const targetId = String(employeeId || '').trim()
  const employee = selectedEmployees.value.find((item) => getEmployeeId(item) === targetId)

  if (!employee) return targetId || t('common.unknown')

  return (
    employee.employeeLabel ||
    [employee.employeeNo, employee.displayName].filter(Boolean).join(' - ') ||
    targetId
  )
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

function buildEmployeePreview(rows = []) {
  return rows
    .slice(0, 5)
    .map((item) => {
      return (
        item.employeeLabel ||
        [item.employeeCode || item.employeeNo, item.employeeName].filter(Boolean).join(' - ') ||
        item.employeeId
      )
    })
    .filter(Boolean)
    .join(', ')
}

function buildDuplicateToastMessage(duplicates = []) {
  const preview = buildEmployeePreview(duplicates)
  const moreCount = Math.max(0, duplicates.length - 5)

  return moreCount
    ? t('ot.requests.create.duplicateDetailMore', {
        preview,
        more: moreCount,
      })
    : t('ot.requests.create.duplicateDetail', {
        preview,
      })
}

function buildMissingClockInToastMessage(missing = []) {
  const preview = buildEmployeePreview(missing)
  const moreCount = Math.max(0, missing.length - 5)

  return moreCount
    ? t('ot.requests.create.missingClockInDetailMore', {
        preview,
        more: moreCount,
      })
    : t('ot.requests.create.missingClockInDetail', {
        preview,
      })
}

async function submit() {
  const payload = buildPayload()
  const message = validateBeforeSubmit(payload)

  if (message) {
    showToast(
      'warn',
      t('ot.requests.create.validationTitle'),
      message,
      3500,
    )
    return
  }

  submitting.value = true

  try {
    await createOTRequest(payload)

    showToast(
      'success',
      t('ot.requests.create.successTitle'),
      t('ot.requests.create.successMessage'),
      2500,
    )

    router.push('/ot/requests')
  } catch (error) {
    const duplicates = normalizeDuplicateEmployees(error)

    if (duplicates.length) {
      const removedCount = removeEmployeesFromSelectionByIds(
        duplicates.map((item) => item.employeeId),
      )

      showToast(
        'warn',
        t('ot.requests.create.duplicateTitle'),
        removedCount > 0
          ? buildDuplicateToastMessage(duplicates)
          : buildApiErrorMessage(error, buildDuplicateToastMessage(duplicates)),
        8000,
      )

      await loadUnavailableEmployeesForDate()
      return
    }

    const missingClockInEmployees = normalizeMissingClockInEmployees(error)

    if (missingClockInEmployees.length) {
      const removedCount = removeEmployeesFromSelectionByIds(
        missingClockInEmployees.map((item) => item.employeeId),
      )

      showToast(
        'warn',
        t('ot.requests.create.missingClockInTitle'),
        removedCount > 0
          ? buildMissingClockInToastMessage(missingClockInEmployees)
          : buildApiErrorMessage(error, buildMissingClockInToastMessage(missingClockInEmployees)),
        9000,
      )

      return
    }

    console.error('[OTRequestCreateView] create failed:', error?.response?.data || error)

    showToast(
      'error',
      t('common.createFailed'),
      buildApiErrorMessage(error, t('ot.requests.create.createFailedDetail')),
      8000,
    )
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
      @loading-change="employeePickerLoading = $event"
    />

    <div class="ot-create-bottom-grid">
      <div />

      <OTSubmitBar
        :submitting="submitting"
        :disabled="submitDisabled"
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