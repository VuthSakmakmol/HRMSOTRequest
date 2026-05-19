<!-- frontend/src/modules/ot/components/OTDetailView.vue -->
<script setup>
// frontend/src/modules/ot/components/OTDetailView.vue

import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import { getHolidays } from '@/modules/calendar/holiday.api'

const props = defineProps({
  form: {
    type: Object,
    required: true,
  },

  selectedEmployeeCount: {
    type: Number,
    default: 0,
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

const timingSourceOptions = computed(() => [
  {
    label: t('ot.requests.create.presetOption'),
    value: 'SHIFT_OPTION',
  },
  {
    label: t('ot.requests.create.customFixedTime'),
    value: 'CUSTOM_FIXED',
  },
])

const selectedOption = computed(() => {
  return props.selectedOTOption || props.selectedOtOption || null
})

const selectedDateYMD = computed(() => formatYMD(props.form.otDate))

const selectedTimingSource = computed(() => {
  return String(props.form.otTimingSource || 'SHIFT_OPTION').trim().toUpperCase()
})

const isCustomFixedTime = computed(() => selectedTimingSource.value === 'CUSTOM_FIXED')

const safeShiftOptions = computed(() => {
  return Array.isArray(props.shiftOptions) ? props.shiftOptions : []
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

const localRequestPreview = computed(() => {
  if (isCustomFixedTime.value) {
    const startTime = String(props.form.customStartTime || '').trim()
    const endTime = String(props.form.customEndTime || '').trim()
    const breakMinutes = Number(props.form.customBreakMinutes || 0)

    if (!startTime || !endTime) return null

    const totalMinutes = calculateTimeWindowMinutes(startTime, endTime, breakMinutes)

    return {
      timingMode: 'CUSTOM_FIXED',
      requestStartTime: startTime,
      requestEndTime: endTime,
      breakMinutes,
      requestedMinutes: totalMinutes,
      requestedHours: Number((totalMinutes / 60).toFixed(2)),
    }
  }

  return props.requestPreview || null
})

const customTimeError = computed(() => {
  if (!isCustomFixedTime.value) return ''

  const startTime = String(props.form.customStartTime || '').trim()
  const endTime = String(props.form.customEndTime || '').trim()
  const breakMinutes = Number(props.form.customBreakMinutes || 0)

  if (!startTime || !endTime) return ''

  if (!isHHmm(startTime) || !isHHmm(endTime)) {
    return t('ot.requests.create.customTimeInvalid')
  }

  if (startTime === endTime) {
    return t('ot.requests.create.customTimeSame')
  }

  const rawMinutes = calculateRawWindowMinutes(startTime, endTime)

  if (breakMinutes >= rawMinutes) {
    return t('ot.requests.create.breakTooLong')
  }

  return ''
})

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

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim())
}

function timeToMinutes(value) {
  if (!isHHmm(value)) return 0

  const [hh, mm] = String(value).split(':').map(Number)
  return hh * 60 + mm
}

function calculateRawWindowMinutes(startTime, endTime) {
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

  if (!minutes) return t('ot.common.minuteValue', { value: 0 })

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) {
    return t('ot.common.hourMinuteValue', {
      hours,
      minutes: mins,
    })
  }

  if (hours) return t('ot.common.hourValue', { value: hours })
  return t('ot.common.minuteValue', { value: mins })
}

function timingModeLabel(value) {
  const normalized = String(value || '').trim().toUpperCase()

  if (normalized === 'CUSTOM_FIXED') return t('ot.requests.create.timingMode.customFixed')
  if (normalized === 'FIXED_TIME') return t('ot.requests.create.timingMode.fixedTime')

  return t('ot.requests.create.timingMode.afterShiftEnd')
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
}

async function fetchMonthHolidays() {
  const source = currentMonth.value || getMonthStart(props.form.otDate || new Date())

  if (Number.isNaN(source.getTime())) return

  const year = source.getFullYear()
  const month = source.getMonth() + 1

  loadingCalendar.value = true

  try {
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
    }
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
            :value="selectedDayType"
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
              {{ t('ot.requests.create.timingType') }}
              <span class="ot-required-star">*</span>
            </label>

            <Select
              v-model="props.form.otTimingSource"
              :options="timingSourceOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :placeholder="t('ot.requests.create.selectTimingType')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.requests.create.otOptionPolicy') }}
              <span class="ot-required-star">*</span>
            </label>

            <Select
              v-model="props.form.shiftOtOptionId"
              :options="safeShiftOptions"
              option-label="optionLabel"
              option-value="id"
              class="w-full"
              :placeholder="t('ot.requests.create.selectOtOption')"
              :loading="loadingShiftOptions"
              :disabled="selectedShiftState?.mode !== 'ready' || loadingShiftOptions || !safeShiftOptions.length"
            />
          </div>

          <div
            v-if="isCustomFixedTime"
            class="ot-custom-time-box"
          >
            <div class="ot-custom-time-head">
              <div>
                <strong>{{ t('ot.requests.create.customDefaultTime') }}</strong>
                <span>{{ t('ot.requests.create.customDefaultTimeHelp') }}</span>
              </div>

              <Tag
                :value="t('ot.requests.create.flexible')"
                severity="info"
              />
            </div>

            <div class="ot-custom-time-grid">
              <div class="ot-field">
                <label class="ot-field-label">
                  {{ t('ot.requests.create.startTime') }}
                  <span class="ot-required-star">*</span>
                </label>

                <DatePicker
                  :model-value="hhmmToDate(props.form.customStartTime)"
                  time-only
                  hour-format="24"
                  show-icon
                  :step-minute="5"
                  :manual-input="false"
                  class="w-full ot-time-picker"
                  input-class="w-full"
                  placeholder="18:00"
                  @update:model-value="updateCustomStartTime"
                />
              </div>

              <div class="ot-field">
                <label class="ot-field-label">
                  {{ t('ot.requests.create.endTime') }}
                  <span class="ot-required-star">*</span>
                </label>

                <DatePicker
                  :model-value="hhmmToDate(props.form.customEndTime)"
                  time-only
                  hour-format="24"
                  show-icon
                  :step-minute="5"
                  :manual-input="false"
                  class="w-full ot-time-picker"
                  input-class="w-full"
                  placeholder="20:00"
                  @update:model-value="updateCustomEndTime"
                />
              </div>

              <div class="ot-field">
                <label class="ot-field-label">
                  {{ t('ot.requests.create.breakMinutes') }}
                </label>

                <InputNumber
                  v-model="props.form.customBreakMinutes"
                  class="w-full"
                  input-class="w-full"
                  :min="0"
                  :max="1440"
                  :step="5"
                  show-buttons
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

          <div
            v-if="localRequestPreview"
            class="ot-option-preview"
          >
            <div class="ot-preview-box">
              <span>{{ t('ot.requests.create.timing') }}</span>
              <strong>{{ timingModeLabel(localRequestPreview.timingMode) }}</strong>
            </div>

            <div class="ot-preview-box">
              <span>{{ t('ot.requests.create.start') }}</span>
              <strong>{{ localRequestPreview.requestStartTime || '-' }}</strong>
            </div>

            <div class="ot-preview-box">
              <span>{{ t('ot.requests.create.end') }}</span>
              <strong>{{ localRequestPreview.requestEndTime || '-' }}</strong>
            </div>

            <div class="ot-preview-box">
              <span>{{ t('ot.requests.create.otTime') }}</span>
              <strong>{{ formatMinutesLabel(localRequestPreview.requestedMinutes) }}</strong>
            </div>
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

:deep(.p-inputtext),
:deep(.p-select),
:deep(.p-textarea),
:deep(.p-inputnumber-input) {
  font-size: 0.86rem;
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
:deep(.ot-time-picker .p-inputtext) {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

</style>