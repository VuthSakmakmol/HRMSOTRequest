<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestCreateView.vue

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Dropdown from 'primevue/dropdown'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import OTApproverChainView from '@/modules/ot/components/OTApproverChainView.vue'
import OTEmployeeMultiPicker from '@/modules/ot/components/OTEmployeeMultiPicker.vue'
import OTSubmitBar from '@/modules/ot/components/OTSubmitBar.vue'
import api from '@/shared/services/api'
import { getHolidays } from '@/modules/calendar/holiday.api'
import {
  createOTRequest,
  getAllowedOTApproverChain,
  getShiftOTOptionsByShift,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()

const submitting = ref(false)
const loadingApproverChain = ref(false)
const loadingRequester = ref(false)
const loadingShiftOptions = ref(false)
const loadingCalendar = ref(false)

const selectedEmployees = ref([])
const approverChain = ref([])
const requesterEmployee = ref(null)
const shiftOptions = ref([])
const lastLoadedShiftId = ref('')

const form = reactive({
  otDate: null,
  shiftOtOptionId: '',
  reason: '',
  approverEmployeeIds: [],
})

const currentMonth = ref(resolveInitialMonth())
const monthHolidayRows = ref([])

const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const selectedEmployeeIds = computed(() =>
  selectedEmployees.value
    .map((item) => String(item?._id || item?.id || '').trim())
    .filter(Boolean),
)

const requesterEmployeeId = computed(() =>
  String(requesterEmployee.value?._id || '').trim(),
)

const selectableApproverChain = computed(() => approverChain.value.slice(0, 4))

const selectedOTOption = computed(() =>
  shiftOptions.value.find((item) => item.id === form.shiftOtOptionId) || null,
)

const monthTitle = computed(() => {
  return currentMonth.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})

const holidayMap = computed(() => {
  const map = new Map()

  for (const item of monthHolidayRows.value) {
    const key = normalizeDateKey(item?.date)
    if (key) map.set(key, item)
  }

  return map
})

const selectedHoliday = computed(() => {
  const key = formatYMD(form.otDate)
  return holidayMap.value.get(key) || null
})

const sortedMonthHolidays = computed(() => {
  return [...monthHolidayRows.value].sort((a, b) => {
    return normalizeDateKey(a?.date).localeCompare(normalizeDateKey(b?.date))
  })
})

const selectedDayType = computed(() => {
  const date = form.otDate
  if (!date) return '—'

  const key = formatYMD(date)

  if (holidayMap.value.has(key)) return 'HOLIDAY'

  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'

  if (parsed.getDay() === 0) return 'SUNDAY'

  return 'WORKING_DAY'
})

const selectedDateLabel = computed(() => formatPrettyDate(form.otDate))

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()

  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []

  for (let i = 0; i < firstDayIndex; i += 1) {
    const day = daysInPrevMonth - firstDayIndex + i + 1
    const date = new Date(year, month - 1, day)
    cells.push(buildCalendarCell(date, false))
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    cells.push(buildCalendarCell(date, true))
  }

  while (cells.length < 42) {
    const nextDay = cells.length - (firstDayIndex + daysInMonth) + 1
    const date = new Date(year, month + 1, nextDay)
    cells.push(buildCalendarCell(date, false))
  }

  return cells
})

function normalizeApproverChainResponse(res) {
  const rows =
    res?.data?.data?.items ||
    res?.data?.data?.rows ||
    res?.data?.data ||
    res?.data ||
    []

  if (!Array.isArray(rows)) return []

  return rows
    .map((item, index) => ({
      orderNo: Number(item?.orderNo || index + 1),
      employeeId: String(item?.employeeId || item?._id || '').trim(),
      employeeNo: String(item?.employeeNo || '').trim(),
      displayName: String(item?.displayName || item?.name || '').trim(),
    }))
    .filter((item) => item.employeeId && item.displayName)
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

function formatMinutesLabel(value) {
  const minutes = Number(value || 0)

  if (!minutes) return '0 min'

  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60

  if (hh && mm) return `${hh}h ${mm}m`
  if (hh) return `${hh}h`
  return `${mm}m`
}

function timingModeLabel(value) {
  const normalized = String(value || '').trim().toUpperCase()

  if (normalized === 'FIXED_TIME') return 'Fixed Time'

  return 'After Shift End'
}

function normalizeShiftOptionsResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

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
      const windowLabel =
        requestStartTime && requestEndTime
          ? `${requestStartTime} - ${requestEndTime}`
          : ''

      return {
        id: String(item?.id || item?._id || '').trim(),
        label,
        timingMode,
        requestStartTime,
        requestEndTime,
        requestedMinutes,
        requestedHours,
        sequence: Number(item?.sequence || 0),
        calculationPolicy: item?.calculationPolicy || null,
        optionLabel: windowLabel
          ? `${label} · ${windowLabel} · ${formatMinutesLabel(requestedMinutes)}`
          : `${label} · ${formatMinutesLabel(requestedMinutes)}`,
      }
    })
    .filter((item) => item.id && item.label)
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
      message: 'Selected employees belong to different shifts. Please use the Shift filter or select one shift only.',
    }
  }

  return {
    mode: 'ready',
    shift: shiftInfos[0],
    message: '',
  }
})

const sharedShift = computed(() => selectedShiftState.value.shift || null)

const selectedShiftLabel = computed(() => {
  if (!selectedEmployeeIds.value.length) return 'No staff selected'

  if (selectedShiftState.value.mode === 'mixed') return 'Mixed shifts'
  if (selectedShiftState.value.mode === 'missing') return 'Missing shift'

  const shift = sharedShift.value
  if (!shift) return '—'

  return [shift.code, shift.name].filter(Boolean).join(' · ') || 'Selected shift'
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

function clearApproverSelection() {
  approverChain.value = []
  form.approverEmployeeIds = []
}

function clearShiftOptions() {
  shiftOptions.value = []
  form.shiftOtOptionId = ''
  lastLoadedShiftId.value = ''
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

async function loadApproverChainForRequester() {
  try {
    const employeeId = requesterEmployeeId.value
    clearApproverSelection()

    if (!employeeId) return

    loadingApproverChain.value = true

    const res = await getAllowedOTApproverChain(employeeId)
    approverChain.value = normalizeApproverChainResponse(res)
  } catch (error) {
    clearApproverSelection()
    toast.add({
      severity: 'error',
      summary: 'Approver chain failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load approver chain.',
      life: 3000,
    })
  } finally {
    loadingApproverChain.value = false
  }
}

function onApproverToggle({ index, checked }) {
  const chain = selectableApproverChain.value

  if (!chain[index]) return

  if (checked) {
    form.approverEmployeeIds = chain
      .slice(0, index + 1)
      .map((item) => item.employeeId)
    return
  }

  form.approverEmployeeIds = chain
    .slice(0, index)
    .map((item) => item.employeeId)
}

async function loadShiftOptionsForSharedShift() {
  const state = selectedShiftState.value

  if (state.mode !== 'ready' || !state.shift?.shiftId) {
    clearShiftOptions()
    return
  }

  if (lastLoadedShiftId.value === state.shift.shiftId) return

  loadingShiftOptions.value = true
  form.shiftOtOptionId = ''

  try {
    const res = await getShiftOTOptionsByShift(state.shift.shiftId)
    const rows = normalizeShiftOptionsResponse(res)

    shiftOptions.value = rows
    lastLoadedShiftId.value = state.shift.shiftId

    if (rows.length === 1) {
      form.shiftOtOptionId = rows[0].id
    }
  } catch (error) {
    clearShiftOptions()
    toast.add({
      severity: 'error',
      summary: 'OT options failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load OT options for the selected shift.',
      life: 3500,
    })
  } finally {
    loadingShiftOptions.value = false
  }
}

watch(
  () =>
    selectedShiftState.value.mode === 'ready'
      ? selectedShiftState.value.shift?.shiftId
      : '',
  async (shiftId, oldShiftId) => {
    if (!shiftId) {
      clearShiftOptions()
      return
    }

    if (shiftId !== oldShiftId) {
      clearShiftOptions()
    }

    await loadShiftOptionsForSharedShift()
  },
  { immediate: true },
)

function resolveInitialMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeDateKey(value) {
  const raw = String(value || '').trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10)
  }

  return formatYMD(value)
}

function formatYMD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatPrettyDate(value) {
  if (!value) return 'No date selected'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date selected'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeHolidayItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function isSameDate(a, b) {
  return formatYMD(a) === formatYMD(b)
}

function isToday(date) {
  return isSameDate(date, new Date())
}

function isHolidayDate(date) {
  return holidayMap.value.has(formatYMD(date))
}

function buildCalendarCell(date, inCurrentMonth) {
  return {
    key: formatYMD(date),
    date,
    day: date.getDate(),
    inCurrentMonth,
    isToday: isToday(date),
    isSelected: isSameDate(date, form.otDate),
    isHoliday: isHolidayDate(date),
    isSunday: date.getDay() === 0,
  }
}

async function fetchMonthHolidays() {
  loadingCalendar.value = true

  try {
    const year = currentMonth.value.getFullYear()
    const month = currentMonth.value.getMonth() + 1

    const res = await getHolidays({
      page: 1,
      limit: 100,
      search: '',
      isActive: true,
      year,
      month,
      sortBy: 'date',
      sortOrder: 'asc',
    })

    const payload = normalizePayload(res)
    monthHolidayRows.value = normalizeHolidayItems(payload)
  } catch (error) {
    monthHolidayRows.value = []

    toast.add({
      severity: 'error',
      summary: 'Holiday load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load internal holiday calendar.',
      life: 3000,
    })
  } finally {
    loadingCalendar.value = false
  }
}

function selectCalendarDate(cell) {
  form.otDate = new Date(cell.date)

  if (!cell.inCurrentMonth) {
    currentMonth.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
  }
}

function selectHolidayDate(holiday) {
  const dateKey = normalizeDateKey(holiday?.date)
  if (!dateKey) return

  form.otDate = new Date(dateKey)
  currentMonth.value = new Date(form.otDate.getFullYear(), form.otDate.getMonth(), 1)
}

function previousMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() - 1,
    1,
  )
}

function nextMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + 1,
    1,
  )
}

function goToday() {
  const now = new Date()
  form.otDate = now
  currentMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
}

watch(
  currentMonth,
  () => {
    fetchMonthHolidays()
  },
)

function buildPayload() {
  return {
    employeeIds: selectedEmployeeIds.value,
    otDate: formatYMD(form.otDate),
    shiftOtOptionId: String(form.shiftOtOptionId || '').trim(),
    reason: String(form.reason || '').trim(),
    approverEmployeeIds: form.approverEmployeeIds
      .map((id) => String(id).trim())
      .filter(Boolean),
  }
}

function validateBeforeSubmit(payload) {
  if (!payload.employeeIds.length) return 'Please select at least 1 employee.'
  if (!payload.otDate) return 'Please select OT date from the internal calendar.'

  if (selectedShiftState.value.mode === 'missing') {
    return 'Some selected employees do not have assigned shift information.'
  }

  if (selectedShiftState.value.mode === 'mixed') {
    return 'Please select employees from one shift only before creating OT request.'
  }

  if (!payload.shiftOtOptionId) return 'Please select OT option.'
  if (!payload.reason) return 'Please enter reason.'
  if (!payload.approverEmployeeIds.length) return 'Please select at least 1 approver.'

  return ''
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

onMounted(async () => {
  await Promise.all([fetchMonthHolidays(), loadRequesterEmployee()])
  await loadApproverChainForRequester()
})
</script>

<template>
  <div class="ot-create-page">
    <section class="ot-create-hero">
      <div class="min-w-0">
        <div class="ot-create-eyebrow">
          Overtime Request
        </div>

        <h1 class="ot-create-title">
          Create OT Request
        </h1>
      </div>

      <div class="ot-create-hero-actions">
        <div class="ot-mini-stat">
          <span>Staff</span>
          <strong>{{ selectedEmployeeIds.length }}</strong>
        </div>

        <div class="ot-mini-stat">
          <span>Shift</span>
          <strong>{{ selectedShiftLabel }}</strong>
        </div>

        <div class="ot-mini-stat">
          <span>Day Type</span>
          <strong>{{ selectedDayType }}</strong>
        </div>

        <Button
          label="Back"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          size="small"
          @click="goBack"
        />
      </div>
    </section>

    <OTEmployeeMultiPicker
      v-model="selectedEmployees"
      auto-select-all
    />

    <div class="ot-create-bottom-grid">
      <Card class="ot-create-card">
        <template #title>
          Request Detail & OT Option
        </template>

        <template #content>
          <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div class="flex flex-col gap-4">
              <Message
                v-if="!form.otDate"
                severity="info"
                :closable="false"
              >
                Please select OT date from the internal calendar.
              </Message>

              <div class="space-y-2">
                <label class="ot-field-label">
                  OT Option <span class="ot-required-star">*</span>
                </label>

                <Dropdown
                  v-model="form.shiftOtOptionId"
                  :options="shiftOptions"
                  optionLabel="optionLabel"
                  optionValue="id"
                  class="w-full"
                  placeholder="Select OT option"
                  :loading="loadingShiftOptions"
                  :disabled="selectedShiftState.mode !== 'ready' || !shiftOptions.length"
                />
              </div>

              <Message
                v-if="selectedShiftState.mode === 'missing'"
                severity="warn"
                :closable="false"
              >
                {{ selectedShiftState.message }}
              </Message>

              <Message
                v-else-if="selectedShiftState.mode === 'mixed'"
                severity="warn"
                :closable="false"
              >
                {{ selectedShiftState.message }}
              </Message>

              <Message
                v-else-if="
                  selectedEmployeeIds.length &&
                  selectedShiftState.mode === 'ready' &&
                  !loadingShiftOptions &&
                  !shiftOptions.length
                "
                severity="warn"
                :closable="false"
              >
                No active OT option is configured for this shift yet.
              </Message>

              <div
                v-if="requestPreview && selectedOTOption"
                class="ot-option-preview"
              >
                <div class="ot-preview-box">
                  <span>Timing</span>
                  <strong>{{ timingModeLabel(requestPreview.timingMode) }}</strong>
                </div>

                <div class="ot-preview-box">
                  <span>Duration</span>
                  <strong>{{ formatMinutesLabel(requestPreview.requestedMinutes) }}</strong>
                </div>

                <div class="ot-preview-box">
                  <span>Start</span>
                  <strong>{{ requestPreview.requestStartTime || '-' }}</strong>
                </div>

                <div class="ot-preview-box">
                  <span>End</span>
                  <strong>{{ requestPreview.requestEndTime || '-' }}</strong>
                </div>
              </div>

              <div
                v-if="selectedOTOption?.calculationPolicy"
                class="ot-policy-box"
              >
                <div class="ot-policy-head">
                  <span class="ot-policy-title">Calculation Policy</span>
                  <Tag
                    :value="selectedOTOption.calculationPolicy.code || '—'"
                    severity="info"
                  />
                </div>

                <div class="ot-policy-grid">
                  <div class="ot-policy-item ot-policy-item--full">
                    <span>Name</span>
                    <strong>{{ selectedOTOption.calculationPolicy.name || '-' }}</strong>
                  </div>

                  <div class="ot-policy-stats">
                    <div class="ot-policy-item">
                      <span>Min Eligible</span>
                      <strong>{{ selectedOTOption.calculationPolicy.minEligibleMinutes ?? 0 }} min</strong>
                    </div>

                    <div class="ot-policy-item">
                      <span>Round Unit</span>
                      <strong>{{ selectedOTOption.calculationPolicy.roundUnitMinutes ?? 0 }} min</strong>
                    </div>

                    <div class="ot-policy-item">
                      <span>Round Method</span>
                      <strong>{{ selectedOTOption.calculationPolicy.roundMethod || '-' }}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <label class="ot-field-label">
                  Reason <span class="ot-required-star">*</span>
                </label>

                <Textarea
                  v-model.trim="form.reason"
                  rows="5"
                  autoResize
                  class="w-full"
                  placeholder="Why is OT needed?"
                />
              </div>
            </div>

            <aside class="ot-calendar-panel">
              <div class="ot-calendar-head">
                <div>
                  <div class="ot-calendar-title">
                    Select OT Date <span class="ot-required-star">*</span>
                  </div>

                  <div class="ot-calendar-subtitle">
                    Internal company calendar
                  </div>
                </div>

                <Button
                  label="Today"
                  icon="pi pi-calendar"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="goToday"
                />
              </div>

              <div class="ot-calendar-box">
                <div class="ot-calendar-month-row">
                  <button
                    type="button"
                    class="calendar-nav-btn"
                    @click="previousMonth"
                  >
                    <i class="pi pi-chevron-left text-xs" />
                  </button>

                  <div class="ot-calendar-month">
                    {{ monthTitle }}
                  </div>

                  <button
                    type="button"
                    class="calendar-nav-btn"
                    @click="nextMonth"
                  >
                    <i class="pi pi-chevron-right text-xs" />
                  </button>
                </div>

                <div class="grid grid-cols-7 gap-1.5">
                  <div
                    v-for="label in weekLabels"
                    :key="label"
                    class="calendar-week-label"
                  >
                    {{ label }}
                  </div>

                  <button
                    v-for="cell in calendarDays"
                    :key="cell.key"
                    type="button"
                    class="calendar-cell"
                    :class="{
                      'is-outside': !cell.inCurrentMonth,
                      'is-selected': cell.isSelected,
                      'is-today': cell.isToday,
                      'is-holiday': cell.isHoliday,
                      'is-sunday': cell.isSunday,
                    }"
                    @click="selectCalendarDate(cell)"
                  >
                    <span class="calendar-number">{{ cell.day }}</span>
                    <span
                      v-if="cell.isHoliday"
                      class="calendar-dot"
                    />
                  </button>
                </div>
              </div>

              <div class="ot-date-summary">
                <div class="ot-summary-row">
                  <span>Selected Date</span>
                  <strong>{{ selectedDateLabel }}</strong>
                </div>

                <div class="ot-summary-row">
                  <span>Day Type</span>
                  <strong>{{ selectedDayType }}</strong>
                </div>

                <div
                  v-if="selectedHoliday"
                  class="ot-holiday-selected"
                >
                  <div class="ot-holiday-name">
                    {{ selectedHoliday.name }}
                  </div>

                  <div class="ot-holiday-date">
                    {{ normalizeDateKey(selectedHoliday.date) }}
                  </div>

                  <div
                    v-if="selectedHoliday.description"
                    class="ot-holiday-desc"
                  >
                    {{ selectedHoliday.description }}
                  </div>
                </div>

                <div
                  v-else-if="loadingCalendar"
                  class="ot-calendar-loading"
                >
                  Loading holiday calendar...
                </div>
              </div>

              <div
                v-if="sortedMonthHolidays.length"
                class="ot-month-holiday-list"
              >
                <div class="ot-month-holiday-title">
                  This month holidays
                </div>

                <button
                  v-for="holiday in sortedMonthHolidays"
                  :key="holiday.id || holiday._id || holiday.date"
                  type="button"
                  class="ot-month-holiday-row"
                  @click="selectHolidayDate(holiday)"
                >
                  <span>{{ holiday.name }}</span>
                  <small>{{ normalizeDateKey(holiday.date) }}</small>
                </button>
              </div>
            </aside>
          </div>
        </template>
      </Card>

      <div class="ot-approval-side">
        <OTApproverChainView
          :loading-requester="loadingRequester"
          :loading-approver-chain="loadingApproverChain"
          :requester-employee-id="requesterEmployeeId"
          :requester-employee="requesterEmployee"
          :approver-chain="approverChain"
          :selected-approver-employee-ids="form.approverEmployeeIds"
          @toggle="onApproverToggle"
        />

        <OTSubmitBar
          :submitting="submitting"
          :disabled="loadingRequester || loadingApproverChain || loadingShiftOptions"
          @submit="submit"
          @back="goBack"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ot-create-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ot-create-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--ot-border);
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 30%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 28%),
    var(--ot-surface);
  padding: 1rem;
}

.ot-create-eyebrow {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-create-title {
  margin-top: 0.25rem;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-create-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.ot-mini-stat {
  min-width: 108px;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ot-surface) 86%, transparent);
  padding: 0.65rem 0.8rem;
}

.ot-mini-stat span {
  display: block;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-mini-stat strong {
  display: block;
  margin-top: 0.2rem;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-create-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.ot-approval-side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ot-field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-required-star {
  color: #ef4444;
  font-weight: 600;
}

:deep(.ot-create-card .p-card-body) {
  padding: 1rem !important;
}

:deep(.ot-create-card .p-card-title) {
  font-size: 1rem !important;
  font-weight: 500 !important;
  color: var(--ot-text) !important;
}

.ot-option-preview {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.75rem;
}

.ot-preview-box,
.ot-policy-box {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.85rem;
}

.ot-preview-box span,
.ot-policy-item span {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-preview-box strong,
.ot-policy-item strong {
  display: block;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-policy-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

.ot-policy-title {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-policy-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ot-policy-item {
  min-width: 0;
}

.ot-policy-item--full {
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-surface);
  padding: 0.75rem 0.85rem;
}

.ot-policy-stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.ot-policy-stats .ot-policy-item {
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-surface);
  padding: 0.75rem 0.85rem;
}

.ot-calendar-panel {
  align-self: start;
  border: 1px solid var(--ot-border);
  border-radius: 1.2rem;
  background: var(--ot-surface);
  padding: 0.85rem;
}

.ot-calendar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.ot-calendar-title {
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-calendar-subtitle {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: var(--ot-text-muted);
}

.ot-calendar-box {
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-calendar-month-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.ot-calendar-month {
  text-align: center;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--ot-text);
}

.calendar-week-label {
  padding-bottom: 0.15rem;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.calendar-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.95rem;
  height: 1.95rem;
  border-radius: 9999px;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  color: var(--ot-text);
  transition: 0.2s ease;
}

.calendar-nav-btn:hover {
  background: var(--ot-hover, rgba(148, 163, 184, 0.08));
}

.calendar-cell {
  position: relative;
  height: 2.1rem;
  border-radius: 9999px;
  background: transparent;
  color: var(--ot-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s ease;
}

.calendar-cell:hover {
  background: rgba(148, 163, 184, 0.12);
}

.calendar-cell.is-outside {
  color: var(--ot-text-muted);
  opacity: 0.42;
}

.calendar-cell.is-today {
  box-shadow: inset 0 0 0 1px var(--ot-border);
}

.calendar-cell.is-sunday {
  color: #dc2626;
  font-weight: 500;
}

.calendar-cell.is-holiday {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
  font-weight: 500;
}

.calendar-cell.is-sunday.is-holiday {
  background: rgba(220, 38, 38, 0.16);
  color: #b91c1c;
}

.calendar-cell.is-selected {
  background: var(--p-primary-500);
  color: white;
  font-weight: 500;
}

.calendar-cell.is-selected.is-holiday,
.calendar-cell.is-selected.is-sunday,
.calendar-cell.is-selected.is-sunday.is-holiday {
  background: var(--p-primary-500);
  color: white;
}

.calendar-number {
  font-size: 0.82rem;
  line-height: 1;
}

.calendar-dot {
  position: absolute;
  right: 0.38rem;
  bottom: 0.34rem;
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.9;
}

.ot-date-summary {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.ot-summary-row {
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-bg);
  padding: 0.65rem 0.75rem;
}

.ot-summary-row span {
  display: block;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-summary-row strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-holiday-selected {
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 0.9rem;
  background: rgba(220, 38, 38, 0.08);
  padding: 0.75rem;
  color: #dc2626;
}

.ot-holiday-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.ot-holiday-date,
.ot-holiday-desc {
  margin-top: 0.25rem;
  font-size: 0.78rem;
}

.ot-calendar-loading {
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  padding: 0.75rem;
  font-size: 0.82rem;
  color: var(--ot-text-muted);
}

.ot-month-holiday-list {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.45rem;
}

.ot-month-holiday-title {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-month-holiday-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-bg);
  padding: 0.55rem 0.65rem;
  text-align: left;
  transition: 0.2s ease;
}

.ot-month-holiday-row:hover {
  background: var(--ot-hover, rgba(148, 163, 184, 0.08));
}

.ot-month-holiday-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-month-holiday-row small {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: var(--ot-text-muted);
}

@media (min-width: 640px) {
  .ot-policy-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .ot-option-preview {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .ot-create-bottom-grid {
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
    align-items: start;
  }
}

@media (max-width: 768px) {
  .ot-create-hero {
    flex-direction: column;
  }

  .ot-create-hero-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .ot-mini-stat {
    flex: 1 1 130px;
  }

  .ot-calendar-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>