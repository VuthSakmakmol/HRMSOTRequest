<script setup>
// frontend/src/modules/ot/components/OTDetailView.vue

import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import { getHolidayLookupOptions } from '@/modules/calendar/holiday.api'

import {
  buildOTCreatePreview,
  findFirstShiftOTOption,
  findShiftOTOptionById,
  formatOptionMeta as formatSharedOptionMeta,
  isHHmm,
  normalizeShiftOTOption,
  normalizeShiftOTOptions,
  timingModeLabel as sharedTimingModeLabel,
} from '@/modules/ot/otCreatePreview'

const props = defineProps({
  form: {
    type: Object,
    required: true,
  },

  selectedEmployeeCount: {
    type: Number,
    default: 0,
  },

  requesterEmployee: {
    type: Object,
    default: null,
  },

  loadingShifts: {
    type: Boolean,
    default: false,
  },

  selectedShiftState: {
    type: Object,
    default: () => ({
      mode: 'none',
      shift: null,
      message: '',
    }),
  },

  shiftOptions: {
    type: Array,
    default: () => [],
  },

  loadingShiftOptions: {
    type: Boolean,
    default: false,
  },

  selectedOtOption: {
    type: Object,
    default: null,
  },

  selectedOTOption: {
    type: Object,
    default: null,
  },

  requestPreview: {
    type: Object,
    default: null,
  },
})

const CUSTOM_OPTION_VALUE = '__OTHER_CUSTOM_TIME__'

const toast = useToast()
const { t, locale } = useI18n()

const loadingCalendar = ref(false)
const monthHolidayRows = ref([])
const currentMonth = ref(getMonthStart(props.form.otDate || new Date()))

const weekLabels = computed(() => [
  t('calendar.holidayPicker.week.sun'),
  t('calendar.holidayPicker.week.mon'),
  t('calendar.holidayPicker.week.tue'),
  t('calendar.holidayPicker.week.wed'),
  t('calendar.holidayPicker.week.thu'),
  t('calendar.holidayPicker.week.fri'),
  t('calendar.holidayPicker.week.sat'),
])

const safeShiftOptions = computed(() => normalizeShiftOTOptions(props.shiftOptions || []))

const selectedOption = computed(() => {
  const explicitOption = props.selectedOTOption || props.selectedOtOption

  if (explicitOption) {
    return normalizeShiftOTOption(explicitOption)
  }

  return findShiftOTOptionById(safeShiftOptions.value, props.form.shiftOtOptionId)
})

const selectedDateYMD = computed(() => formatYMD(props.form.otDate))

const selectedTimingSource = computed(() => {
  return String(props.form.otTimingSource || 'SHIFT_OPTION').trim().toUpperCase()
})

const isCustomFixedTime = computed(() => selectedTimingSource.value === 'CUSTOM_FIXED')

const otCreatePreview = computed(() => {
  return buildOTCreatePreview({
    form: props.form,
    shiftOptions: safeShiftOptions.value,
    selectedOption: selectedOption.value,
    requestPreview: props.requestPreview,
  })
})

const localRequestPreview = computed(() => {
  const preview = otCreatePreview.value

  return {
    timingMode: preview.isCustomFixedTime ? 'CUSTOM_FIXED' : preview.selectedOption?.timingMode,
    requestStartTime: preview.requestStartTime,
    requestEndTime: preview.requestEndTime,
    breakMinutes: preview.breakMinutes,
    requestedMinutes: preview.requestedMinutes,
    requestedHours: preview.requestedHours,
    paidMinutes: preview.paidMinutes,
    paidHours: preview.paidHours,
    paidHoursLabel: preview.paidHoursLabel,
    requestedHoursLabel: preview.requestedHoursLabel,
    breakLabel: preview.breakLabel,
  }
})

const customDurationMinutes = computed(() => {
  return Number(otCreatePreview.value?.paidMinutes || 0)
})

const customBaseStartTime = computed(() => {
  return String(otCreatePreview.value?.requestStartTime || '').trim()
})

const otOptionDropdownOptions = computed(() => {
  const realOptions = safeShiftOptions.value
    .map((item) => {
      const normalized = normalizeShiftOTOption(item)

      return {
        ...normalized,
        id: String(normalized?.id || normalized?._id || '').trim(),
        optionLabel: formatOTOptionShortLabel(normalized),
        isCustomOption: false,
        disabled: false,
      }
    })
    .filter((item) => item.id && item.optionLabel)

  return [
    ...realOptions,
    {
      id: CUSTOM_OPTION_VALUE,
      optionLabel: labelOr('ot.requests.create.otherCustomTime', 'Other'),
      timingMode: 'CUSTOM_FIXED',
      timingModeLabel: labelOr('ot.requests.create.timingMode.customFixed', 'Custom fixed time'),
      requestStartTime: '',
      requestEndTime: '',
      requestedMinutes: 0,
      requestedHours: 0,
      paidMinutes: 0,
      paidHours: 0,
      isCustomOption: true,
      disabled: realOptions.length === 0,
    },
  ]
})

const selectedOptionDropdownValue = computed({
  get() {
    if (isCustomFixedTime.value) return CUSTOM_OPTION_VALUE

    return String(props.form.shiftOtOptionId || '').trim()
  },

  set(value) {
    handleOtOptionDropdownChange(value)
  },
})

const monthTitle = computed(() => {
  return currentMonth.value.toLocaleDateString(locale.value || 'en-US', {
    month: 'long',
    year: 'numeric',
  })
})

const holidayMap = computed(() => {
  const map = new Map()

  for (const item of monthHolidayRows.value) {
    const key = normalizeDateKey(item?.date)

    if (key) {
      map.set(key, item)
    }
  }

  return map
})

const selectedDayType = computed(() => {
  if (!props.form.otDate) return '—'

  const key = selectedDateYMD.value

  if (key && holidayMap.value.has(key)) {
    return 'HOLIDAY'
  }

  const date = props.form.otDate instanceof Date ? props.form.otDate : new Date(props.form.otDate)

  if (Number.isNaN(date.getTime())) return '—'

  if (date.getDay() === 0) return 'SUNDAY'

  return 'WORKING_DAY'
})

const selectedDayTypeLabel = computed(() => dayTypeLabel(selectedDayType.value))

const selectedDaySeverity = computed(() => {
  if (selectedDayType.value === 'HOLIDAY') return 'danger'
  if (selectedDayType.value === 'SUNDAY') return 'warning'
  if (selectedDayType.value === 'WORKING_DAY') return 'success'

  return 'secondary'
})

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []

  for (let index = 0; index < firstDayIndex; index += 1) {
    const day = daysInPrevMonth - firstDayIndex + index + 1
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

const customTimeError = computed(() => {
  if (!isCustomFixedTime.value) return ''

  const startTime = customBaseStartTime.value
  const paidMinutes = Number(otCreatePreview.value?.paidMinutes || 0)

  if (!props.form.customDurationHours) return ''

  if (!startTime || !isHHmm(startTime)) {
    return t('ot.requests.create.selectValidTiming')
  }

  if (paidMinutes <= 0) {
    return t('ot.requests.create.enterCustomDurationHours')
  }

  if (paidMinutes > 1440) {
    return t('ot.requests.create.customDurationTooLong')
  }

  return ''
})

function labelOr(key, fallback) {
  const value = t(key)

  return value === key ? fallback : value
}

function dayTypeLabel(value) {
  const dayType = String(value || '').trim().toUpperCase()

  if (dayType === 'SUNDAY') return t('ot.dayType.sunday')
  if (dayType === 'HOLIDAY') return t('ot.dayType.holiday')
  if (dayType === 'WORKING_DAY') return t('ot.dayType.workingDay')

  return dayType && dayType !== '—' ? dayType : '—'
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function getMonthStart(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    const now = new Date()

    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatYMD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function normalizeDateKey(value) {
  const raw = String(value || '').trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10)
  }

  return formatYMD(value)
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
    isSelected: isSameDate(date, props.form.otDate),
    isHoliday: isHolidayDate(date),
    isSunday: date.getDay() === 0,
  }
}

function hhmmToDate(value) {
  const raw = String(value || '').trim()

  if (!isHHmm(raw)) return null

  const [hours, minutes] = raw.split(':').map(Number)
  const date = new Date()

  date.setHours(hours, minutes, 0, 0)

  return date
}

function dateToHHmm(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''

  return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`
}

function updateCustomStartTime(value) {
  props.form.customStartTime = dateToHHmm(value)
}

function updateCustomEndTime(value) {
  props.form.customEndTime = dateToHHmm(value)
}

function timingModeLabel(value) {
  const normalized = String(value || '').trim().toUpperCase()

  if (normalized === 'CUSTOM_FIXED') {
    return labelOr('ot.requests.create.timingMode.customFixed', sharedTimingModeLabel(value))
  }

  if (normalized === 'FIXED_TIME') {
    return labelOr('ot.requests.create.timingMode.fixedTime', sharedTimingModeLabel(value))
  }

  return labelOr('ot.requests.create.timingMode.afterShiftEnd', sharedTimingModeLabel(value))
}

function getRealShiftOptionById(optionId) {
  return findShiftOTOptionById(safeShiftOptions.value, optionId)
}

function getFirstRealShiftOption() {
  return findFirstShiftOTOption(safeShiftOptions.value)
}

function ensurePolicyOptionForCustomTime() {
  const currentOption = getRealShiftOptionById(props.form.shiftOtOptionId)

  if (currentOption) return currentOption

  const firstOption = getFirstRealShiftOption()

  if (firstOption) {
    props.form.shiftOtOptionId = String(firstOption?.id || firstOption?._id || '').trim()
    return firstOption
  }

  props.form.otTimingSource = 'SHIFT_OPTION'
  props.form.shiftOtOptionId = ''

  toast.add({
    severity: 'warn',
    summary: t('ot.requests.create.noOptionTitle'),
    detail: t('ot.requests.create.noOptionGeneric'),
    life: 3500,
  })

  return null
}

function applyCustomTimeDefaults(option = null) {
  const sourceOption = option || selectedOption.value || getFirstRealShiftOption() || {}
  const preview = props.requestPreview || {}

  const startTime = String(
    preview.requestStartTime ||
      sourceOption.requestStartTime ||
      sourceOption.startTime ||
      '',
  ).trim()

  props.form.customStartTime = startTime
  props.form.customEndTime = ''
  props.form.customBreakMinutes = 0
  props.form.customDurationHours = null
}

function handleOtOptionDropdownChange(value) {
  const selectedValue = String(value || '').trim()

  if (selectedValue === CUSTOM_OPTION_VALUE) {
    const policyOption = ensurePolicyOptionForCustomTime()

    if (!policyOption) return

    props.form.otTimingSource = 'CUSTOM_FIXED'
    applyCustomTimeDefaults(policyOption)

    return
  }

  props.form.shiftOtOptionId = selectedValue
  props.form.otTimingSource = 'SHIFT_OPTION'
  props.form.customStartTime = ''
  props.form.customEndTime = ''
  props.form.customBreakMinutes = 0
  props.form.customDurationHours = null
}

function formatOTOptionShortLabel(option = {}) {
  const minutes = Number(
    option?.paidMinutes ||
      option?.totalRequestPaidMinutes ||
      option?.totalMinutes ||
      option?.requestedMinutes ||
      0,
  )

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return String(option?.label || option?.name || option?.optionLabel || '').trim()
  }

  const hours = minutes / 60

  if (Number.isInteger(hours)) {
    return `${hours}h`
  }

  return `${Number(hours.toFixed(2))}h`
}

function formatOptionMeta(option = {}) {
  if (option?.isCustomOption) {
    return labelOr(
      'ot.requests.create.otherCustomTimeHelp',
      'Enter OT hours only. The system calculates the end time automatically.',
    )
  }

  return formatSharedOptionMeta(option)
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeHolidayItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.rows)) return payload.rows

  return []
}

function selectDate(cell) {
  props.form.otDate = new Date(cell.date)

  if (!cell.inCurrentMonth) {
    currentMonth.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
    fetchMonthHolidays()
  }
}

function previousMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() - 1,
    1,
  )

  fetchMonthHolidays()
}

function nextMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + 1,
    1,
  )

  fetchMonthHolidays()
}

function setToday() {
  const now = new Date()

  props.form.otDate = now
  currentMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)

  fetchMonthHolidays()
}

function ensureTimingDefaults() {
  if (!props.form.otTimingSource) {
    props.form.otTimingSource = 'SHIFT_OPTION'
  }

  if (props.form.customBreakMinutes === undefined || props.form.customBreakMinutes === null) {
    props.form.customBreakMinutes = 0
  }

  if (props.form.customDurationHours === undefined) {
    props.form.customDurationHours = null
  }
}

async function fetchMonthHolidays() {
  const source = currentMonth.value || getMonthStart(props.form.otDate || new Date())

  if (Number.isNaN(source.getTime())) return

  const year = source.getFullYear()
  const month = source.getMonth() + 1

  loadingCalendar.value = true

  try {
    const res = await getHolidayLookupOptions({
      page: 1,
      limit: 100,
      search: '',
      isActive: true,
      year,
      month,
      sortBy: 'date',
      sortOrder: 'asc',
    })

    monthHolidayRows.value = normalizeHolidayItems(normalizePayload(res))
  } catch (error) {
    monthHolidayRows.value = []

    toast.add({
      severity: 'warn',
      summary: t('ot.requests.create.calendarUnavailableTitle'),
      detail:
        error?.response?.data?.message ||
        error?.message ||
        t('ot.requests.create.calendarUnavailableDetail'),
      life: 3000,
    })
  } finally {
    loadingCalendar.value = false
  }
}

watch(
  () => selectedDateYMD.value,
  (value) => {
    if (!value) return

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return

    const nextMonthStart = new Date(date.getFullYear(), date.getMonth(), 1)

    if (formatYMD(nextMonthStart) !== formatYMD(currentMonth.value)) {
      currentMonth.value = nextMonthStart
      fetchMonthHolidays()
    }
  },
)

watch(
  () => props.form.otTimingSource,
  () => {
    ensureTimingDefaults()

    if (!isCustomFixedTime.value) {
      props.form.customStartTime = ''
      props.form.customEndTime = ''
      props.form.customBreakMinutes = 0
      props.form.customDurationHours = null
    }
  },
)

watch(
  () => otCreatePreview.value?.calculatedEndTime,
  (value) => {
    if (!isCustomFixedTime.value) return
    if (!value) return

    props.form.customEndTime = value
  },
)

onMounted(() => {
  ensureTimingDefaults()

  if (!props.form.otDate) {
    props.form.otDate = new Date()
  }

  currentMonth.value = getMonthStart(props.form.otDate)

  fetchMonthHolidays()
})
</script>

<template>
  <Card class="ot-setup-card">
    <template #content>
      <div class="ot-setup-head">
        <div class="ot-setup-tags">
          <Tag
            :value="selectedDayTypeLabel"
            :severity="selectedDaySeverity"
            class="ot-pill-tag"
          />

          <Tag
            :value="t('ot.requests.create.selectedCount', { count: selectedEmployeeCount })"
            severity="info"
            class="ot-pill-tag"
          />
        </div>
      </div>

      <div class="ot-setup-grid">
        <section class="ot-date-panel">
          <div class="ot-section-head">
            <div>
              <label class="ot-field-label">
                {{ t('ot.requests.create.selectOtDate') }}
                <span class="ot-required-star">*</span>
              </label>
            </div>

            <Button
              :label="t('calendar.holidayPicker.today')"
              icon="pi pi-calendar"
              size="small"
              outlined
              severity="secondary"
              class="ot-today-btn"
              @click="setToday"
            />
          </div>

          <div class="ot-calendar-box">
            <div class="ot-calendar-header">
              <button
                type="button"
                class="calendar-nav-btn"
                @click="previousMonth"
              >
                <i class="pi pi-chevron-left text-sm" />
              </button>

              <div class="ot-calendar-title">
                {{ monthTitle }}
              </div>

              <button
                type="button"
                class="calendar-nav-btn"
                @click="nextMonth"
              >
                <i class="pi pi-chevron-right text-sm" />
              </button>
            </div>

            <div class="ot-calendar-grid">
              <div
                v-for="label in weekLabels"
                :key="label"
                class="ot-week-label"
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
                @click="selectDate(cell)"
              >
                <span class="calendar-number">{{ cell.day }}</span>

                <span
                  v-if="cell.isHoliday"
                  class="calendar-dot"
                />
              </button>
            </div>
          </div>
        </section>

        <section class="ot-detail-panel">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.requests.create.otOptionPolicy') }}
              <span class="ot-required-star">*</span>
            </label>

            <Select
              v-model="selectedOptionDropdownValue"
              :options="otOptionDropdownOptions"
              option-label="optionLabel"
              option-value="id"
              option-disabled="disabled"
              class="w-full"
              :placeholder="t('ot.requests.create.selectOtOption')"
              :loading="loadingShiftOptions"
              :disabled="selectedShiftState?.mode !== 'ready' || loadingShiftOptions || loadingShifts"
            >
              <template #option="{ option }">
                <div
                  class="ot-option-dropdown-row"
                  :class="{ 'is-custom-option': option.isCustomOption }"
                >
                  <div class="ot-option-dropdown-main">
                    <strong>{{ option.optionLabel }}</strong>
                  </div>
                </div>
              </template>
            </Select>
          </div>

          <Message
            v-if="selectedShiftState?.mode !== 'ready' && !loadingShifts"
            severity="warn"
            :closable="false"
          >
            {{ selectedShiftState?.message || labelOr('ot.requests.create.requesterShiftMissing', 'Requester shift is not assigned. Please update the employee shift before creating OT.') }}
          </Message>

          <Message
            v-else-if="selectedShiftState?.mode === 'ready' && !loadingShiftOptions && !safeShiftOptions.length"
            severity="warn"
            :closable="false"
          >
            {{ t('ot.requests.create.noOptionGeneric') }}
          </Message>

          <div
            v-if="isCustomFixedTime"
            class="ot-custom-time-box"
          >
            <div class="ot-custom-time-grid">
              <div class="ot-field">
                <label class="ot-field-label">
                  {{ labelOr('ot.requests.create.customDurationHours', 'OT Hours') }}
                  <span class="ot-required-star">*</span>
                </label>

                <InputNumber
                  v-model="props.form.customDurationHours"
                  class="w-full"
                  input-class="w-full"
                  :min="1"
                  :max="24"
                  :step="1"
                  :min-fraction-digits="0"
                  :max-fraction-digits="0"
                  suffix=" h"
                  show-buttons
                  :placeholder="labelOr('ot.requests.create.customDurationPlaceholder', 'Example: 1, 2, 3, 4')"
                />
              </div>
            </div>

            <Message
              v-if="customTimeError"
              severity="warn"
              :closable="false"
            >
              {{ customTimeError }}
            </Message>
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.requests.create.reason') }}
              <span class="ot-optional-text">
                {{ t('ot.requests.create.optional') }}
              </span>
            </label>

            <Textarea
              v-model.trim="props.form.reason"
              rows="5"
              auto-resize
              class="w-full"
              :placeholder="t('ot.requests.create.reasonPlaceholder')"
            />
          </div>
        </section>
      </div>
    </template>
  </Card>
</template>

<style scoped>
:deep(.ot-setup-card .p-card-body) {
  padding: 1rem !important;
}

.ot-setup-card {
  overflow: hidden;
}

.ot-setup-head {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.ot-setup-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}

.ot-setup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  margin-top: 0.9rem;
}

.ot-date-panel,
.ot-detail-panel {
  min-width: 0;
  border: 1px solid var(--ot-border);
  border-radius: 1.1rem;
  background: var(--ot-surface);
  padding: 1rem;
}

.ot-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.ot-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.ot-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.ot-field-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-required-star {
  color: #ef4444;
  font-weight: 600;
}

.ot-optional-text {
  margin-left: 0.25rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 500;
}

.ot-calendar-box {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.9rem;
}

.ot-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.ot-calendar-title {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.ot-week-label {
  padding-bottom: 0.25rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ot-text-muted);
}

.calendar-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 999px;
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
  height: 2.45rem;
  border-radius: 999px;
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
  font-weight: 600;
}

.calendar-cell.is-holiday {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
  font-weight: 700;
}

.calendar-cell.is-sunday.is-holiday {
  background: rgba(220, 38, 38, 0.16);
  color: #b91c1c;
}

.calendar-cell.is-selected {
  background: var(--p-primary-500);
  color: white;
  font-weight: 700;
}

.calendar-cell.is-selected.is-holiday,
.calendar-cell.is-selected.is-sunday,
.calendar-cell.is-selected.is-sunday.is-holiday {
  background: var(--p-primary-500);
  color: white;
}

.calendar-number {
  font-size: 0.86rem;
  line-height: 1;
}

.calendar-dot {
  position: absolute;
  right: 0.48rem;
  bottom: 0.38rem;
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.9;
}


.ot-auto-time-preview {
  display: flex;
  min-height: 2.55rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-bg);
  padding: 0.55rem 0.75rem;
  color: var(--ot-text);
  font-size: 0.86rem;
}

.ot-auto-time-preview strong {
  font-weight: 700;
  color: var(--ot-text);
}

.ot-auto-time-preview span {
  color: var(--ot-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.ot-option-dropdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.ot-option-dropdown-row.is-custom-option {
  color: var(--p-primary-600);
}

.ot-option-dropdown-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.ot-option-dropdown-main strong {
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.84rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-option-dropdown-main span {
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  line-height: 1.25;
}

.ot-option-preview,
.ot-custom-time-box {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-option-preview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.ot-preview-box {
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.65rem;
}

.ot-preview-box span {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-preview-box strong {
  display: block;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-custom-time-box {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.08), transparent),
    var(--ot-bg);
}

.ot-custom-time-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.ot-custom-time-head strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-custom-time-head span {
  display: block;
  margin-top: 0.18rem;
  font-size: 0.74rem;
  line-height: 1.4;
  color: var(--ot-text-muted);
}

.ot-custom-time-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
}

:deep(.ot-pill-tag.p-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  border-radius: 999px !important;
}

:deep(.ot-today-btn.p-button) {
  min-height: 2rem !important;
  padding: 0.3rem 0.58rem !important;
  border-radius: 999px !important;
  font-size: 0.78rem !important;
}

:deep(.ot-option-type-tag.p-tag) {
  min-height: 1.2rem !important;
  padding: 0.1rem 0.42rem !important;
  border-radius: 999px !important;
  font-size: 0.64rem !important;
  font-weight: 500 !important;
  white-space: nowrap !important;
}

:deep(.p-inputtext),
:deep(.p-select),
:deep(.p-textarea),
:deep(.p-inputnumber-input) {
  font-size: 0.86rem;
}

:deep(.ot-time-picker .p-inputtext) {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 768px) {
  .ot-custom-time-grid {
    grid-template-columns: 1fr 1fr 180px;
  }
}

@media (min-width: 1280px) {
  .ot-setup-grid {
    grid-template-columns: minmax(360px, 0.9fr) minmax(0, 1.6fr);
    align-items: start;
  }

  .ot-option-preview {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  :deep(.ot-setup-card .p-card-body) {
    padding: 0.65rem !important;
  }

  .ot-setup-head {
    margin-bottom: 0.55rem;
  }

  .ot-setup-tags {
    justify-content: flex-start;
  }

  .ot-setup-grid {
    gap: 0.65rem;
    margin-top: 0.55rem;
  }

  .ot-date-panel,
  .ot-detail-panel {
    border-radius: 0.95rem;
    padding: 0.65rem;
  }

  .ot-section-head {
    align-items: center;
    margin-bottom: 0.55rem;
  }

  .ot-field-label {
    font-size: 0.8rem;
  }

  .ot-calendar-box {
    border-radius: 0.85rem;
    padding: 0.58rem;
  }

  .ot-calendar-header {
    margin-bottom: 0.58rem;
  }

  .ot-calendar-title {
    font-size: 0.92rem;
  }

  .calendar-nav-btn {
    width: 1.95rem;
    height: 1.95rem;
  }

  .ot-calendar-grid {
    gap: 0.22rem;
  }

  .calendar-cell {
    height: 2.05rem;
  }

  .calendar-number {
    font-size: 0.78rem;
  }

  :deep(.p-inputtext),
  :deep(.p-select-label),
  :deep(.p-textarea),
  :deep(.p-inputnumber-input) {
    font-size: 16px !important;
  }
}

</style>