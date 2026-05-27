<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'

import OTDetailView from '@/modules/ot/components/OTDetailView.vue'
import OTEmployeeMultiPicker from '@/modules/ot/components/OTEmployeeMultiPicker.vue'
import OTSubmitBar from '@/modules/ot/components/OTSubmitBar.vue'
import api from '@/shared/services/api'

import {
  createOTRequest,
  getOTRequestById,
  getShiftOTOptionsByShift,
  updateOTRequest,
} from '@/modules/ot/ot.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const submitting = ref(false)
const confirmVisible = ref(false)
const confirmPayload = ref(null)

const loadingRequester = ref(false)
const loadingEditRequest = ref(false)
const loadingShiftOptions = ref(false)
const loadingUnavailableEmployees = ref(false)
const employeePickerLoading = ref(false)

const selectedEmployees = ref([])
const requesterEmployee = ref(null)
const editRequestDetail = ref(null)
const shiftOptions = ref([])
const unavailableEmployees = ref([])
const selectedOptionDayType = ref('')
const lastLoadedShiftKey = ref('')

let unavailableRequestSeq = 0
const hydratingEditRequest = ref(false)

const form = reactive({
  otDate: null,
  shiftId: '',
  otTimingSource: 'SHIFT_OPTION',
  shiftOtOptionId: '',
  customStartTime: '',
  customEndTime: '',
  customBreakMinutes: 0,
  customDurationHours: null,
  reason: '',
})

const editRequestId = computed(() => s(route.params.id))
const isEditMode = computed(() => Boolean(editRequestId.value))
const pageLoading = computed(() => loadingRequester.value || loadingEditRequest.value)

const selectedDateYMD = computed(() => formatYMD(form.otDate))

const selectedEmployeeIds = computed(() => {
  return [
    ...new Set(
      selectedEmployees.value
        .map((item) => getEmployeeId(item))
        .filter(Boolean),
    ),
  ]
})

const selectedShift = computed(() => {
  const requesterShift = buildRequesterShiftOption(requesterEmployee.value)
  const selectedId = s(form.shiftId)

  if (!requesterShift?.id) return null
  if (!selectedId) return requesterShift

  return requesterShift.id === selectedId ? requesterShift : null
})

const selectedShiftState = computed(() => {
  if (!selectedShift.value?.id) {
    return {
      mode: 'missing',
      shift: null,
      message: labelOr(
        'ot.requests.create.requesterShiftMissing',
        'Requester shift is not assigned. Please update the employee shift before creating OT.',
      ),
    }
  }

  return {
    mode: 'ready',
    shift: {
      shiftId: selectedShift.value.id,
      code: selectedShift.value.code,
      name: selectedShift.value.name,
      label: selectedShift.value.label,
    },
    message: '',
  }
})

const selectedOTOption = computed(() => {
  const selectedId = s(form.shiftOtOptionId)

  if (!selectedId) return null

  return (
    shiftOptions.value.find((item) => {
      return s(item.id || item._id) === selectedId
    }) || null
  )
})

const isCustomFixedTime = computed(() => {
  return upper(form.otTimingSource || 'SHIFT_OPTION') === 'CUSTOM_FIXED'
})

const unavailableEmployeeMap = computed(() => {
  const map = {}
  const currentRequestId = editRequestId.value
  const currentRequestNo = s(editRequestDetail.value?.requestNo)

  for (const item of unavailableEmployees.value) {
    const employeeId = s(item?.employeeId)
    if (!employeeId) continue

    const sameRequest =
      currentRequestId &&
      (s(item?.requestId) === currentRequestId ||
        s(item?.otRequestId) === currentRequestId ||
        s(item?.id) === currentRequestId ||
        (currentRequestNo && s(item?.requestNo) === currentRequestNo))

    if (sameRequest) continue

    map[employeeId] = item
  }

  return map
})

const backendTimingPreview = computed(() => {
  const option = selectedOTOption.value

  if (!option) return null

  const backendPaidMinutes = positiveNumber(
    option.totalRequestPaidMinutes,
    option.totalMinutes,
    option.requestedMinutes,
  )

  return {
    source: 'BACKEND_SHIFT_OPTION_LOOKUP',

    timingMode: upper(option.timingMode || 'AFTER_SHIFT_END'),

    requestStartTime: s(option.requestStartTime || option.startTime),
    requestEndTime: s(option.requestEndTime || option.endTime),
    startTime: s(option.requestStartTime || option.startTime),
    endTime: s(option.requestEndTime || option.endTime),

    breakMinutes: n(option.breakMinutes),
    requestedMinutes: n(option.requestedMinutes),
    totalRequestPaidMinutes: backendPaidMinutes,
    totalMinutes: backendPaidMinutes,
    totalHours: round2(backendPaidMinutes / 60),

    paidMinutes: backendPaidMinutes,
    paidHours: round2(backendPaidMinutes / 60),
    paidHoursLabel: formatDurationMinutes(backendPaidMinutes),
    requestedHoursLabel: formatDurationMinutes(option.requestedMinutes),
    breakLabel: formatDurationMinutes(option.breakMinutes),
  }
})

const requestPreview = computed(() => {
  if (selectedShiftState.value.mode !== 'ready') return null
  if (!selectedOTOption.value) return null

  return backendTimingPreview.value
})

const pickerRequestPreview = computed(() => requestPreview.value)

const confirmOptionLabel = computed(() => {
  const option = selectedOTOption.value || {}

  return s(
    option.optionLabel ||
      option.label ||
      option.name ||
      form.shiftOtOptionId,
  )
})

const confirmTimeLabel = computed(() => {
  if (isCustomFixedTime.value && Number(form.customDurationHours || 0) > 0) {
    return formatDurationMinutes(Number(form.customDurationHours || 0) * 60)
  }

  return formatDurationMinutes(
    backendTimingPreview.value?.totalRequestPaidMinutes ||
      selectedOTOption.value?.totalRequestPaidMinutes ||
      selectedOTOption.value?.requestedMinutes ||
      editRequestDetail.value?.totalRequestPaidMinutes ||
      editRequestDetail.value?.requestedMinutes ||
      0,
  )
})

const employeePickerReady = computed(() => {
  return Boolean(
    selectedDateYMD.value &&
      selectedShiftState.value.mode === 'ready' &&
      form.shiftOtOptionId &&
      selectedOTOption.value &&
      backendTimingPreview.value?.totalRequestPaidMinutes > 0,
  )
})

const autoSelectEmployeesReady = computed(() => {
  return Boolean(
    !isEditMode.value &&
      employeePickerReady.value &&
      !loadingUnavailableEmployees.value &&
      !loadingShiftOptions.value,
  )
})

const sharedShiftIdForPicker = computed(() => {
  return selectedShiftState.value.mode === 'ready'
    ? s(selectedShiftState.value.shift?.shiftId)
    : ''
})

const sharedShiftLabelForPicker = computed(() => {
  if (selectedShiftState.value.mode !== 'ready') return ''

  return s(
    selectedShiftState.value.shift?.code ||
      selectedShiftState.value.shift?.label ||
      selectedShiftState.value.shift?.name,
  )
})

const canSubmitEditRequest = computed(() => {
  if (!isEditMode.value) return true
  return editRequestDetail.value?.canEdit === true
})

const submitDisabled = computed(() => {
  return (
    pageLoading.value ||
    loadingShiftOptions.value ||
    loadingUnavailableEmployees.value ||
    employeePickerLoading.value ||
    submitting.value ||
    !canSubmitEditRequest.value ||
    !selectedDateYMD.value ||
    selectedShiftState.value.mode !== 'ready' ||
    !form.shiftOtOptionId ||
    !selectedOTOption.value ||
    !selectedEmployeeIds.value.length
  )
})

const submitLabel = computed(() => {
  return isEditMode.value
    ? labelOr('common.update', 'Update')
    : labelOr('ot.requests.create.submitRequest', 'Submit request')
})

const confirmDialogTitle = computed(() => {
  return isEditMode.value
    ? labelOr('ot.requests.edit.confirmUpdateTitle', 'Confirm OT request update')
    : labelOr('ot.requests.create.confirmSubmitTitle', 'Confirm OT request')
})

const confirmSubmitLabel = computed(() => {
  return isEditMode.value
    ? labelOr('common.update', 'Update')
    : labelOr('ot.requests.create.submitRequest', 'Submit request')
})

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function round2(value) {
  return Math.round(n(value) * 100) / 100
}

function positiveNumber(...values) {
  for (const value of values) {
    const number = Number(value)

    if (Number.isFinite(number) && number > 0) {
      return number
    }
  }

  return 0
}

function labelOr(key, fallback) {
  const value = t(key)
  return value === key ? fallback : value
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function parseYMDToDate(value) {
  const raw = s(value)
  if (!raw) return null

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatYMD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDurationMinutes(value) {
  const minutes = Math.round(Number(value || 0))

  if (!Number.isFinite(minutes) || minutes <= 0) return '-'

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60

  if (hours > 0 && restMinutes === 0) {
    return `${hours} h`
  }

  if (hours > 0 && restMinutes > 0) {
    return `${hours} h ${restMinutes} min`
  }

  return `${minutes} min`
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getEmployeeId(employee = {}) {
  return s(employee?._id || employee?.id || employee?.employeeId)
}

function normalizePayload(res) {
  const payload = res?.data?.data || res?.data || {}
  return payload?.item || payload
}

function normalizeAuthUser(res) {
  const payload =
    res?.data?.item ||
    res?.data?.data?.item ||
    res?.data?.data?.user ||
    res?.data?.user ||
    res?.data ||
    {}

  return payload?.item || payload
}

function normalizeShiftRecord(source = {}) {
  const shiftObject =
    (isObject(source?.shift) && source.shift) ||
    (isObject(source?.shiftId) && source.shiftId) ||
    source ||
    {}

  const rawId =
    source?.id ||
    source?._id ||
    (!isObject(source?.shiftId) ? source?.shiftId : '') ||
    shiftObject?.id ||
    shiftObject?._id ||
    ''

  const id = s(rawId)
  if (!id) return null

  const code = s(source?.code || source?.shiftCode || shiftObject?.code)
  const name = s(source?.name || source?.shiftName || shiftObject?.name)

  return {
    id,
    _id: id,
    code,
    name,
    label: s(
      source?.label ||
        source?.shiftLabel ||
        [code, name].filter(Boolean).join(' - ') ||
        code ||
        name ||
        id,
    ),
    type: s(source?.type || source?.shiftType || shiftObject?.type),
    startTime: s(source?.startTime || source?.shiftStartTime || shiftObject?.startTime),
    endTime: s(source?.endTime || source?.shiftEndTime || shiftObject?.endTime),
    breakStartTime: s(source?.breakStartTime || shiftObject?.breakStartTime),
    breakEndTime: s(source?.breakEndTime || shiftObject?.breakEndTime),
    crossMidnight: source?.crossMidnight === true || shiftObject?.crossMidnight === true,
  }
}

function buildRequesterShiftOption(employee = {}) {
  if (!employee) return null

  return normalizeShiftRecord({
    shiftId: employee.shiftId,
    shiftCode: employee.shiftCode,
    shiftName: employee.shiftName,
    shiftType: employee.shiftType,
    shiftStartTime: employee.shiftStartTime,
    shiftEndTime: employee.shiftEndTime,
    shift: employee.shift,
  })
}

function normalizeEmployeeProfile(source = {}) {
  const root = source?.employee || source?.employeeProfile || source?.employeeInfo || source || {}

  const employeeId = s(root?._id || root?.id || root?.employeeId || source?.employeeId)
  const displayName = s(
    root?.displayName ||
      root?.name ||
      source?.displayName ||
      source?.name ||
      source?.loginId,
  )

  const employeeNo = s(
    root?.employeeNo ||
      root?.employeeCode ||
      source?.employeeNo ||
      source?.employeeCode,
  )

  if (!employeeId && !displayName) return null

  const shift = normalizeShiftRecord({
    shiftId: root?.shiftId || source?.shiftId,
    shiftCode: root?.shiftCode || source?.shiftCode,
    shiftName: root?.shiftName || source?.shiftName,
    shiftType: root?.shiftType || source?.shiftType,
    shiftStartTime: root?.shiftStartTime || source?.shiftStartTime,
    shiftEndTime: root?.shiftEndTime || source?.shiftEndTime,
    shift: root?.shift || source?.shift,
  })

  return {
    _id: employeeId,
    id: employeeId,
    employeeId,
    displayName,
    employeeNo,
    employeeCode: employeeNo,
    employeeLabel: [employeeNo, displayName].filter(Boolean).join(' - ') || displayName || employeeId,
    shiftId: shift?.id || '',
    shiftCode: shift?.code || '',
    shiftName: shift?.name || '',
    shiftType: shift?.type || '',
    shiftStartTime: shift?.startTime || '',
    shiftEndTime: shift?.endTime || '',
    shift: shift || null,
  }
}

function normalizeUnavailableEmployeesResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

  return rows
    .map((item) => ({
      id: s(item?.id || item?._id),
      requestId: s(item?.requestId || item?.otRequestId),
      employeeId: s(item?.employeeId),
      employeeCode: s(item?.employeeCode),
      employeeName: s(item?.employeeName),
      employeeLabel: s(item?.employeeLabel),
      requestNo: s(item?.requestNo),
      status: s(item?.status),
      statusLabel: s(item?.statusLabel),
      otDate: s(item?.otDate),
    }))
    .filter((item) => item.employeeId)
}

function normalizeShiftOptionsResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

  selectedOptionDayType.value = upper(payload?.dayType || payload?.meta?.dayType)

  return rows
    .map((item) => {
      const id = s(item?.id || item?._id)

      if (!id) return null

      const totalRequestPaidMinutes = positiveNumber(
        item?.totalRequestPaidMinutes,
        item?.totalMinutes,
        item?.requestedMinutes,
      )

      return {
        ...item,
        id,
        _id: id,

        label: s(item?.label || item?.name || item?.optionLabel),
        optionLabel: s(item?.optionLabel || item?.label || item?.name),

        timingMode: upper(item?.timingMode || 'AFTER_SHIFT_END'),

        requestStartTime: s(item?.requestStartTime || item?.startTime),
        requestEndTime: s(item?.requestEndTime || item?.endTime),
        startTime: s(item?.requestStartTime || item?.startTime),
        endTime: s(item?.requestEndTime || item?.endTime),

        requestedMinutes: n(item?.requestedMinutes),
        breakMinutes: n(item?.breakMinutes),
        totalRequestPaidMinutes,
        totalMinutes: totalRequestPaidMinutes,
        totalHours: round2(totalRequestPaidMinutes / 60),
      }
    })
    .filter((item) => item?.id && item?.optionLabel)
}

function normalizeSelectedEmployee(source = {}) {
  const employeeId = s(source?.employeeId || source?._id || source?.id)
  const employeeNo = s(source?.employeeNo || source?.employeeCode)
  const displayName = s(source?.displayName || source?.employeeName || source?.name)

  return {
    ...source,
    _id: employeeId,
    id: employeeId,
    employeeId,
    employeeNo,
    employeeCode: employeeNo,
    displayName,
    employeeName: displayName,
    employeeLabel: [employeeNo, displayName].filter(Boolean).join(' - ') || displayName || employeeId,
    lineName: s(
      source?.lineName ||
        source?.productionLineName ||
        source?.line?.name ||
        source?.productionLine?.name,
    ),
    lineLabel: s(source?.lineName || source?.productionLineName || source?.lineLabel || source?.productionLineLabel),
    requestedMinutes: n(source?.requestedMinutes),
    totalRequestPaidMinutes: positiveNumber(
      source?.totalRequestPaidMinutes,
      source?.totalMinutes,
      source?.requestedMinutes,
      editRequestDetail.value?.totalRequestPaidMinutes,
      editRequestDetail.value?.requestedMinutes,
    ),
    totalMinutes: positiveNumber(
      source?.totalRequestPaidMinutes,
      source?.totalMinutes,
      source?.requestedMinutes,
      editRequestDetail.value?.totalRequestPaidMinutes,
      editRequestDetail.value?.requestedMinutes,
    ),
  }
}

function clearShiftOptions() {
  shiftOptions.value = []
  form.shiftOtOptionId = ''
  selectedOptionDayType.value = ''
  lastLoadedShiftKey.value = ''
  resetCustomTiming()
}

function resetCustomTiming() {
  form.otTimingSource = 'SHIFT_OPTION'
  form.customStartTime = ''
  form.customEndTime = ''
  form.customBreakMinutes = 0
  form.customDurationHours = null
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

function hydrateRequesterFromEditRequest(data = {}) {
  const shift = normalizeShiftRecord({
    shiftId: data?.shiftId,
    shiftCode: data?.shiftCode,
    shiftName: data?.shiftName,
    shiftType: data?.shiftType,
    shiftStartTime: data?.shiftStartTime,
    shiftEndTime: data?.shiftEndTime,
  })

  return {
    _id: s(data?.requesterEmployeeId),
    id: s(data?.requesterEmployeeId),
    employeeId: s(data?.requesterEmployeeId),
    employeeNo: s(data?.requesterEmployeeCode),
    employeeCode: s(data?.requesterEmployeeCode),
    displayName: s(data?.requesterName),
    name: s(data?.requesterName),
    shiftId: shift?.id || '',
    shiftCode: shift?.code || '',
    shiftName: shift?.name || '',
    shiftType: shift?.type || '',
    shiftStartTime: shift?.startTime || '',
    shiftEndTime: shift?.endTime || '',
    shift: shift || null,
  }
}

function hydrateFormFromEditRequest(data = {}) {
  hydratingEditRequest.value = true

  editRequestDetail.value = data

  form.otDate = parseYMDToDate(data?.otDate) || new Date()
  form.shiftId = s(data?.shiftId)
  form.otTimingSource = upper(data?.otTimingSource || 'SHIFT_OPTION')
  form.shiftOtOptionId = s(data?.shiftOtOptionId)
  form.customStartTime = s(data?.customStartTime || data?.requestStartTime || data?.startTime)
  form.customEndTime = s(data?.customEndTime || data?.requestEndTime || data?.endTime)
  form.customBreakMinutes = n(data?.customBreakMinutes ?? data?.breakMinutes)
  form.customDurationHours = null
  form.reason = s(data?.reason)

  requesterEmployee.value = hydrateRequesterFromEditRequest(data)

  const sourceEmployees = Array.isArray(data?.requestedEmployees) && data.requestedEmployees.length
    ? data.requestedEmployees
    : Array.isArray(data?.employees)
      ? data.employees
      : []

  selectedEmployees.value = sourceEmployees
    .map(normalizeSelectedEmployee)
    .filter((item) => getEmployeeId(item))

  window.setTimeout(() => {
    hydratingEditRequest.value = false
  }, 0)
}

async function loadRequesterEmployee() {
  loadingRequester.value = true

  try {
    const res = await api.get('/auth/me')
    const authUser = normalizeAuthUser(res)
    const profile = normalizeEmployeeProfile(authUser)

    requesterEmployee.value = profile

    if (!form.shiftId && profile?.shiftId) {
      form.shiftId = profile.shiftId
    }
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

async function loadEditRequest() {
  const id = editRequestId.value
  if (!id) return

  loadingEditRequest.value = true

  try {
    const res = await getOTRequestById(id)
    const data = normalizePayload(res)

    if (!data?.id && !data?._id) {
      throw new Error('OT request not found')
    }

    if (data.canEdit !== true) {
      showToast(
        'warn',
        labelOr('ot.requests.edit.editUnavailableTitle', 'Edit unavailable'),
        labelOr(
          'ot.requests.edit.editUnavailableDetail',
          'This request cannot be edited because it is already approved, rejected, cancelled, or not allowed.',
        ),
        4500,
      )

      router.push('/ot/requests')
      return
    }

    hydrateFormFromEditRequest(data)
    await loadUnavailableEmployeesForDate()
    await loadShiftOptionsForSelectedShift({ keepSelectedOption: true })
  } catch (error) {
    showToast(
      'error',
      t('common.loadFailed'),
      buildApiErrorMessage(error, labelOr('ot.requests.edit.loadFailedDetail', 'Failed to load OT request.')),
      4000,
    )

    router.push('/ot/requests')
  } finally {
    loadingEditRequest.value = false
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

async function loadShiftOptionsForSelectedShift(options = {}) {
  const keepSelectedOption = options.keepSelectedOption === true
  const shiftId = s(form.shiftId)
  const otDate = selectedDateYMD.value
  const currentOptionId = s(form.shiftOtOptionId)

  if (!otDate || !shiftId) {
    if (!keepSelectedOption) clearShiftOptions()
    return
  }

  const loadKey = `${shiftId}|${otDate}`

  if (lastLoadedShiftKey.value === loadKey && shiftOptions.value.length) return

  loadingShiftOptions.value = true

  if (!keepSelectedOption) {
    form.shiftOtOptionId = ''
    resetCustomTiming()
  }

  try {
    const res = await getShiftOTOptionsByShift(shiftId, {
      otDate,
    })

    const rows = normalizeShiftOptionsResponse(res)

    shiftOptions.value = rows
    lastLoadedShiftKey.value = loadKey

    if (keepSelectedOption && currentOptionId) {
      const exists = rows.some((item) => s(item.id || item._id) === currentOptionId)

      if (exists) {
        form.shiftOtOptionId = currentOptionId
      } else if (rows.length === 1) {
        form.shiftOtOptionId = rows[0].id
      } else {
        form.shiftOtOptionId = ''
      }
    } else if (rows.length === 1) {
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

function buildEmployeeTimeOverridesPayload() {
  return selectedEmployees.value
    .map((employee) => {
      const employeeId = getEmployeeId(employee)

      if (!employeeId) return null

      if (upper(employee?.otTimeMode || 'DEFAULT') !== 'CUSTOM') {
        return null
      }

      const startTime = s(employee?.requestStartTime || employee?.startTime)
      const endTime = s(employee?.requestEndTime || employee?.endTime)

      if (!startTime || !endTime) return null

      return {
        employeeId,
        startTime,
        endTime,
        breakMinutes: n(employee?.breakMinutes),
      }
    })
    .filter(Boolean)
}

function buildPayload() {
  const payload = {
    employeeIds: selectedEmployeeIds.value,
    employeeTimeOverrides: buildEmployeeTimeOverridesPayload(),

    otDate: selectedDateYMD.value,

    otTimingSource: isCustomFixedTime.value ? 'CUSTOM_FIXED' : 'SHIFT_OPTION',
    shiftOtOptionId: s(form.shiftOtOptionId),

    reason: s(form.reason),
  }

  if (isCustomFixedTime.value) {
    payload.customStartTime = s(form.customStartTime)
    payload.customEndTime = s(form.customEndTime)
    payload.customBreakMinutes = n(form.customBreakMinutes)
  }

  return payload
}

function validateBeforeSubmit(payload) {
  if (loadingUnavailableEmployees.value) {
    return t('ot.requests.create.waitAvailability')
  }

  if (isEditMode.value && editRequestDetail.value?.canEdit !== true) {
    return labelOr('ot.requests.edit.editUnavailableDetail', 'This OT request cannot be edited.')
  }

  if (!payload.otDate) {
    return t('ot.requests.create.selectDateFirst')
  }

  if (selectedShiftState.value.mode === 'missing') {
    return t('ot.requests.create.missingShift')
  }

  if (!payload.shiftOtOptionId || !selectedOTOption.value) {
    return t('ot.requests.create.selectOtOption')
  }

  if (!Array.isArray(payload.employeeIds) || !payload.employeeIds.length) {
    return t('ot.requests.create.selectAtLeastOneEmployee')
  }

  const blockedSelected = payload.employeeIds
    .map((employeeId) => unavailableEmployeeMap.value[employeeId])
    .filter(Boolean)

  if (blockedSelected.length) {
    return buildDuplicateToastMessage(blockedSelected)
  }

  if (payload.otTimingSource === 'CUSTOM_FIXED') {
    if (!payload.customStartTime || !payload.customEndTime) {
      return t('ot.requests.create.selectValidTiming')
    }
  }

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

  return upper(
    payload?.code ||
      payload?.data?.code ||
      errorObject?.code,
  )
}

function getErrorMessageText(error) {
  const payload = getErrorPayload(error)
  const errorObject = getErrorObject(error)

  return s(
    payload?.message ||
      payload?.data?.message ||
      errorObject?.message ||
      error?.message,
  )
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
      employeeId: s(item?.employeeId),
      employeeCode: s(item?.employeeCode),
      employeeName: s(item?.employeeName),
      employeeLabel: s(item?.employeeLabel),
      requestNo: s(item?.requestNo),
      status: s(item?.status),
      otDate: s(item?.otDate),
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
      employeeId: s(item?.employeeId),
      employeeNo: s(item?.employeeNo || item?.employeeCode),
      employeeCode: s(item?.employeeCode || item?.employeeNo),
      employeeName: s(item?.employeeName),
      employeeLabel: s(item?.employeeLabel),
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

  if (code === 'OT_REQUEST_EDIT_NOT_ALLOWED') {
    return labelOr('ot.requests.edit.editUnavailableDetail', 'This OT request cannot be edited.')
  }

  return message || fallback || t('ot.requests.create.createFailedDetail')
}

function formatEmployeeOTTime(employee = {}) {
  const minutes = positiveNumber(
    employee?.totalRequestPaidMinutes,
    employee?.totalMinutes,
    employee?.requestedMinutes,
    backendTimingPreview.value?.totalRequestPaidMinutes,
  )

  return formatDurationMinutes(minutes)
}

function formatEmployeeLine(employee = {}) {
  return s(
    employee?.lineName ||
      employee?.productionLineName ||
      employee?.line?.name ||
      employee?.productionLine?.name ||
      employee?.lineLabel ||
      employee?.productionLineLabel,
  ) || '-'
}

function removeEmployeesFromSelectionByIds(employeeIds = []) {
  const idSet = new Set(employeeIds.map((id) => s(id)).filter(Boolean))
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

function openSubmitConfirm() {
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

  confirmPayload.value = payload
  confirmVisible.value = true
}

async function submitConfirmed() {
  const payload = confirmPayload.value || buildPayload()
  const message = validateBeforeSubmit(payload)

  if (message) {
    confirmVisible.value = false

    showToast(
      'warn',
      t('ot.requests.create.validationTitle'),
      message,
      3500,
    )
    return
  }

  confirmVisible.value = false
  submitting.value = true

  try {
    if (isEditMode.value) {
      await updateOTRequest(editRequestId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        labelOr('ot.requests.edit.updatedSuccess', 'OT request updated successfully.'),
        2500,
      )
    } else {
      await createOTRequest(payload)

      showToast(
        'success',
        t('ot.requests.create.successTitle'),
        t('ot.requests.create.successMessage'),
        2500,
      )
    }

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

    console.error('[OTRequestCreateView] save failed:', error?.response?.data || error)

    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildApiErrorMessage(
        error,
        isEditMode.value
          ? labelOr('ot.requests.edit.updateFailedDetail', 'Failed to update OT request.')
          : t('ot.requests.create.createFailedDetail'),
      ),
      8000,
    )
  } finally {
    submitting.value = false
    confirmPayload.value = null
  }
}

function goBack() {
  router.push('/ot/requests')
}

watch(
  () => selectedDateYMD.value,
  async () => {
    if (hydratingEditRequest.value) return

    if (!isEditMode.value) {
      selectedEmployees.value = []
    }

    clearShiftOptions()

    await loadUnavailableEmployeesForDate()
    await loadShiftOptionsForSelectedShift()
  },
)

watch(
  () => form.shiftId,
  async () => {
    if (hydratingEditRequest.value) return

    if (!isEditMode.value) {
      selectedEmployees.value = []
    }

    clearShiftOptions()

    await loadShiftOptionsForSelectedShift()
  },
)

watch(
  () => [
    form.otTimingSource,
    form.customStartTime,
    form.customEndTime,
    form.customBreakMinutes,
    form.customDurationHours,
  ].join('|'),
  () => {
    if (!isCustomFixedTime.value) {
      form.customStartTime = ''
      form.customEndTime = ''
      form.customBreakMinutes = 0
      form.customDurationHours = null
    }
  },
)

onMounted(async () => {
  if (isEditMode.value) {
    await loadEditRequest()
    return
  }

  await loadRequesterEmployee()
  await loadUnavailableEmployeesForDate()
  await loadShiftOptionsForSelectedShift()
})
</script>

<template>
  <div class="ot-create-page">
    <Message
      v-if="isEditMode"
      severity="info"
      :closable="false"
      class="ot-edit-mode-message"
    >
      {{ labelOr('ot.requests.edit.editModeMessage', 'Editing pending OT request. Changes are allowed only before any approval step is approved.') }}
    </Message>

    <div
      v-if="pageLoading"
      class="ot-loading-panel"
    >
      <i class="pi pi-spin pi-spinner" />
      <span>{{ labelOr('common.loading', 'Loading') }}</span>
    </div>

    <template v-else>
      <OTDetailView
        :form="form"
        :requester-employee="requesterEmployee"
        :selected-employee-count="selectedEmployeeIds.length"
        :selected-shift-state="selectedShiftState"
        :loading-shifts="loadingRequester"
        :shift-options="shiftOptions"
        :loading-shift-options="loadingShiftOptions"
        :selected-ot-option="selectedOTOption"
        :request-preview="requestPreview"
      />

      <OTEmployeeMultiPicker
        v-if="employeePickerReady"
        v-model="selectedEmployees"
        :ot-date="selectedDateYMD"
        :selected-shift-id="sharedShiftIdForPicker"
        :selected-shift-label="sharedShiftLabelForPicker"
        :auto-select-all="!isEditMode"
        :auto-select-ready="autoSelectEmployeesReady"
        :blocked-employee-map="unavailableEmployeeMap"
        :blocked-loading="loadingUnavailableEmployees"
        :request-preview="pickerRequestPreview"
        @loading-change="employeePickerLoading = $event"
      />

      <div class="ot-create-bottom-grid">
        <OTSubmitBar
          :submit-label="submitLabel"
          :submitting="submitting"
          :disabled="submitDisabled"
          @submit="openSubmitConfirm"
          @back="goBack"
        />
      </div>
    </template>

    <Dialog
      v-model:visible="confirmVisible"
      modal
      class="ot-confirm-dialog"
      :header="confirmDialogTitle"
      :style="{ width: 'min(96vw, 760px)' }"
    >
      <div class="ot-confirm-body">
        <div class="ot-confirm-summary">
          <div class="ot-confirm-item">
            <span>{{ labelOr('ot.requests.create.confirmDate', 'Date') }}</span>
            <strong>{{ selectedDateYMD || '-' }}</strong>
          </div>

          <div class="ot-confirm-item">
            <span>{{ labelOr('ot.requests.create.confirmTime', 'OT time') }}</span>
            <strong>{{ confirmTimeLabel }}</strong>
          </div>

          <div class="ot-confirm-item">
            <span>{{ labelOr('ot.requests.create.confirmEmployees', 'Employees') }}</span>
            <strong>{{ selectedEmployeeIds.length }}</strong>
          </div>
        </div>

        <div class="ot-confirm-employee-box">
          <div class="ot-confirm-employee-head">
            <strong>{{ labelOr('ot.requests.create.selectedPreviewTitle', 'Selected employees') }}</strong>
          </div>

          <div class="ot-confirm-employee-table-wrap">
            <table class="ot-confirm-employee-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Line</th>
                  <th>OT Time</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="(employee, index) in selectedEmployees"
                  :key="getEmployeeId(employee) || index"
                >
                  <td>{{ index + 1 }}</td>

                  <td>
                    {{ employee.employeeNo || employee.employeeCode || getEmployeeId(employee) || '-' }}
                  </td>

                  <td>
                    {{ employee.displayName || employee.employeeName || employee.name || '-' }}
                  </td>

                  <td>
                    {{ formatEmployeeLine(employee) }}
                  </td>

                  <td>{{ formatEmployeeOTTime(employee) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          :label="labelOr('common.cancel', 'Cancel')"
          severity="secondary"
          outlined
          size="small"
          :disabled="submitting"
          @click="confirmVisible = false"
        />

        <Button
          :label="confirmSubmitLabel"
          icon="pi pi-check"
          size="small"
          :loading="submitting"
          @click="submitConfirmed"
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

.ot-loading-panel,
.ot-edit-mode-message {
  border-radius: 1rem;
}

.ot-loading-panel {
  display: inline-flex;
  min-height: 7rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  color: var(--ot-text-muted);
  font-size: 0.84rem;
  font-weight: 600;
}

.ot-create-bottom-grid {
  display: flex;
  justify-content: flex-end;
}

.ot-confirm-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.ot-confirm-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.ot-confirm-item {
  min-width: 0;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-bg);
  padding: 0.62rem 0.7rem;
}

.ot-confirm-item span {
  display: block;
  margin-bottom: 0.12rem;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ot-confirm-item strong {
  display: block;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-confirm-employee-box {
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-surface);
  padding: 0.72rem;
}

.ot-confirm-employee-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.55rem;
}

.ot-confirm-employee-head strong {
  color: var(--ot-text);
  font-size: 0.84rem;
  font-weight: 650;
}

.ot-confirm-employee-head span {
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 500;
}

.ot-confirm-employee-table-wrap {
  width: 100%;
  max-width: 100%;
  max-height: 10rem;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.75rem;
}

.ot-confirm-employee-table {
  width: 100%;
  max-width: 100%;
  table-layout: auto;
  border-collapse: separate;
  border-spacing: 0;
}

.ot-confirm-employee-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--ot-bg);
  border-bottom: 1px solid var(--ot-border);
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.035em;
  padding: 0.45rem 0.5rem;
  text-align: left;
  text-transform: uppercase;
  vertical-align: middle;
}

.ot-confirm-employee-table td {
  border-bottom: 1px solid var(--ot-border);
  color: var(--ot-text);
  font-size: 0.74rem;
  font-weight: 500;
  padding: 0.45rem 0.5rem;
  vertical-align: middle;
}

.ot-confirm-employee-table tr:last-child td {
  border-bottom: 0;
}

.ot-confirm-employee-table th:first-child,
.ot-confirm-employee-table td:first-child {
  width: 1%;
  text-align: center;
  white-space: nowrap;
}

.ot-confirm-employee-table th:nth-child(2),
.ot-confirm-employee-table td:nth-child(2) {
  width: 1%;
  white-space: nowrap;
}

.ot-confirm-employee-table th:nth-child(3),
.ot-confirm-employee-table td:nth-child(3) {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ot-confirm-employee-table th:nth-child(4),
.ot-confirm-employee-table td:nth-child(4) {
  width: 1%;
  white-space: nowrap;
}

.ot-confirm-employee-table th:nth-child(5),
.ot-confirm-employee-table td:nth-child(5) {
  width: 1%;
  text-align: center;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .ot-create-page {
    padding-bottom: calc(5.6rem + env(safe-area-inset-bottom, 0px));
  }

  .ot-create-bottom-grid {
    position: fixed;
    left: 0.75rem;
    right: 0.75rem;
    bottom: calc(0.65rem + env(safe-area-inset-bottom, 0px));
    z-index: 1200;
    display: flex;
    justify-content: stretch;
    border: 1px solid var(--ot-border);
    border-radius: 1rem;
    background: color-mix(in srgb, var(--ot-surface) 94%, transparent);
    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
    padding: 0.55rem;
    backdrop-filter: blur(14px);
  }

  .ot-create-bottom-grid > * {
    width: 100%;
  }

  .ot-create-bottom-grid :deep(.p-button) {
    min-height: 2.45rem;
  }

  .ot-confirm-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .ot-confirm-employee-head {
    flex-direction: column;
    gap: 0.18rem;
  }

  .ot-confirm-employee-table-wrap {
    max-height: 48vh;
  }

  .ot-confirm-employee-table th,
  .ot-confirm-employee-table td {
    padding: 0.42rem 0.42rem;
    font-size: 0.7rem;
  }

  .ot-confirm-employee-table th {
    font-size: 0.62rem;
    letter-spacing: 0.02em;
  }

  :deep(.ot-confirm-dialog .p-dialog-content),
  :deep(.ot-confirm-dialog .p-dialog-footer) {
    padding-inline: 0.85rem !important;
  }
}
</style>
