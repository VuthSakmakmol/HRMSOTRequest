<!-- frontend/src/modules/ot/components/OTDetailView.vue -->
<script setup>
// frontend/src/modules/ot/components/OTDetailView.vue

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
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

const loadingCalendar = ref(false)
const monthHolidayRows = ref([])
const currentMonth = ref(getMonthStart(props.form.otDate || new Date()))

const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const timingSourceOptions = [
  {
    label: 'Preset option',
    value: 'SHIFT_OPTION',
  },
  {
    label: 'Custom fixed time',
    value: 'CUSTOM_FIXED',
  },
]

const selectedOption = computed(() => {
  return props.selectedOTOption || props.selectedOtOption || null
})

const selectedDateYMD = computed(() => formatYMD(props.form.otDate))

const selectedDateLabel = computed(() => formatPrettyDate(props.form.otDate))

const selectedShift = computed(() => {
  return props.selectedShiftState?.shift || null
})



const selectedTimingSource = computed(() => {
  return String(props.form.otTimingSource || 'SHIFT_OPTION').trim().toUpperCase()
})

const isCustomFixedTime = computed(() => selectedTimingSource.value === 'CUSTOM_FIXED')

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

    if (key) {
      map.set(key, item)
    }
  }

  return map
})

const sortedMonthHolidays = computed(() => {
  return [...monthHolidayRows.value].sort((a, b) => {
    return String(normalizeDateKey(a?.date)).localeCompare(String(normalizeDateKey(b?.date)))
  })
})

const selectedHoliday = computed(() => {
  const key = selectedDateYMD.value
  return key ? holidayMap.value.get(key) || null : null
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
    return 'Custom start and end time must be HH:mm.'
  }

  if (startTime === endTime) {
    return 'Custom start time and end time cannot be the same.'
  }

  const rawMinutes = calculateRawWindowMinutes(startTime, endTime)

  if (breakMinutes >= rawMinutes) {
    return 'Break minutes cannot be greater than or equal to OT duration.'
  }

  return ''
})

const selectedPolicy = computed(() => {
  return selectedOption.value?.calculationPolicy || null
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

  if (!minutes) return '0 min'

  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60

  if (hh && mm) return `${hh}h ${mm}m`
  if (hh) return `${hh}h`
  return `${mm}m`
}

function timingModeLabel(value) {
  const normalized = String(value || '').trim().toUpperCase()

  if (normalized === 'CUSTOM_FIXED') return 'Custom Fixed Time'
  if (normalized === 'FIXED_TIME') return 'Fixed Time'

  return 'After Shift End'
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
      summary: 'Holiday calendar unavailable',
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
            :value="`${selectedEmployeeCount} selected`"
            severity="info"
            class="ot-pill-tag"
          />
        </div>
      </div>

      <div class="ot-setup-grid">
        <!-- LEFT: SAME HOLIDAY CALENDAR SOURCE -->
        <section class="ot-date-panel">
          <div class="ot-section-head">
            <div>
              <label class="ot-field-label">
                1. Select OT Date <span class="ot-required-star">*</span>
              </label>
            </div>

            <Button
              label="Today"
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

          <div class="ot-date-info-grid">
            <div class="ot-info-card">
              <span>Selected Date</span>
              <strong>{{ selectedDateLabel }}</strong>
            </div>

            <div class="ot-info-card">
              <span>Day Type</span>
              <strong>{{ selectedDayType }}</strong>
            </div>

            <div
              v-if="selectedHoliday"
              class="ot-info-card is-holiday"
            >
              <span>Holiday</span>
              <strong>{{ selectedHoliday.name }}</strong>
              <small>{{ normalizeDateKey(selectedHoliday.date) }}</small>
            </div>

            <div
              v-else-if="loadingCalendar"
              class="ot-calendar-note"
            >
              Checking internal calendar...
            </div>
          </div>

          <div class="ot-month-holidays">
            <div class="ot-month-holidays-head">
              <span>This month holidays</span>
              <Tag
                :value="`${sortedMonthHolidays.length}`"
                severity="info"
                class="ot-pill-tag"
              />
            </div>

            <div
              v-if="loadingCalendar"
              class="ot-calendar-note"
            >
              Loading holidays...
            </div>

            <div
              v-else-if="sortedMonthHolidays.length"
              class="ot-holiday-list"
            >
              <button
                v-for="item in sortedMonthHolidays"
                :key="item.id || item._id || item.date"
                type="button"
                class="ot-holiday-row"
                @click="props.form.otDate = new Date(normalizeDateKey(item.date))"
              >
                <span>{{ item.name }}</span>
                <small>{{ normalizeDateKey(item.date) }}</small>
              </button>
            </div>

            <div
              v-else
              class="ot-calendar-note"
            >
              No active holiday in this month.
            </div>
          </div>
        </section>

        <!-- RIGHT: OT OPTION + CUSTOM TIME + REASON -->
        <section class="ot-detail-panel">
          


          <div class="ot-field">
            <label class="ot-field-label">
              3. Timing Type <span class="ot-required-star">*</span>
            </label>

            <Select
              v-model="props.form.otTimingSource"
              :options="timingSourceOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              placeholder="Select timing type"
            />

          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              4. OT Option / Policy <span class="ot-required-star">*</span>
            </label>

            <Select
              v-model="props.form.shiftOtOptionId"
              :options="shiftOptions"
              optionLabel="optionLabel"
              optionValue="id"
              class="w-full"
              placeholder="Select OT option"
              :loading="loadingShiftOptions"
              :disabled="selectedShiftState?.mode !== 'ready' || loadingShiftOptions || !shiftOptions.length"
            />
          </div>

          <div
            v-if="isCustomFixedTime"
            class="ot-custom-time-box"
          >
            <div class="ot-custom-time-head">
              <div>
                <strong>Custom default OT time</strong>
                <span>All selected employees use this time unless adjusted later.</span>
              </div>

              <Tag
                value="Flexible"
                severity="info"
              />
            </div>

            <div class="ot-custom-time-grid">
              <div class="ot-field">
                <label class="ot-field-label">
                  Start Time <span class="ot-required-star">*</span>
                </label>

                <InputText
                  v-model.trim="props.form.customStartTime"
                  type="time"
                  placeholder="18:00"
                  class="w-full"
                />
              </div>

              <div class="ot-field">
                <label class="ot-field-label">
                  End Time <span class="ot-required-star">*</span>
                </label>

                <InputText
                  v-model.trim="props.form.customEndTime"
                  type="time"
                  placeholder="20:00"
                  class="w-full"
                />
              </div>

              <div class="ot-field">
                <label class="ot-field-label">
                  Break Minutes
                </label>

                <InputNumber
                  v-model="props.form.customBreakMinutes"
                  class="w-full"
                  inputClass="w-full"
                  :min="0"
                  :max="1440"
                  :step="5"
                  showButtons
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
              <span>Timing</span>
              <strong>{{ timingModeLabel(localRequestPreview.timingMode) }}</strong>
            </div>

            <div class="ot-preview-box">
              <span>Start</span>
              <strong>{{ localRequestPreview.requestStartTime || '-' }}</strong>
            </div>

            <div class="ot-preview-box">
              <span>End</span>
              <strong>{{ localRequestPreview.requestEndTime || '-' }}</strong>
            </div>

            <div class="ot-preview-box">
              <span>Total</span>
              <strong>{{ formatMinutesLabel(localRequestPreview.requestedMinutes) }}</strong>
            </div>
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              5. Reason <span class="ot-optional-text">Optional</span>
            </label>

            <Textarea
              v-model.trim="props.form.reason"
              rows="5"
              autoResize
              class="w-full"
              placeholder="Example: urgent production order, shipment deadline..."
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
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.ot-setup-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ot-text);
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

.ot-field-hint {
  margin-top: 0.16rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--ot-text-muted);
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

.ot-date-info-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.ot-info-card,
.ot-shift-summary,
.ot-option-preview,
.ot-policy-box,
.ot-custom-time-box,
.ot-month-holidays {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-info-card span,
.ot-preview-box span,
.ot-policy-item span,
.ot-shift-summary span {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-info-card strong,
.ot-preview-box strong,
.ot-policy-item strong,
.ot-shift-summary strong {
  display: block;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-info-card small {
  display: block;
  margin-top: 0.14rem;
  font-size: 0.72rem;
  color: var(--ot-text-muted);
}

.ot-info-card.is-holiday {
  border-color: rgba(220, 38, 38, 0.28);
  background: rgba(220, 38, 38, 0.08);
}

.ot-info-card.is-holiday strong,
.ot-info-card.is-holiday small {
  color: #dc2626;
}

.ot-calendar-note {
  font-size: 0.76rem;
  color: var(--ot-text-muted);
}

.ot-month-holidays {
  margin-top: 0.75rem;
}

.ot-month-holidays-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.ot-month-holidays-head span {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-holiday-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.ot-holiday-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
  padding: 0.55rem 0.65rem;
  text-align: left;
  transition: 0.2s ease;
}

.ot-holiday-row:hover {
  background: var(--ot-hover, rgba(148, 163, 184, 0.08));
}

.ot-holiday-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-holiday-row small {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: var(--ot-text-muted);
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

.ot-policy-box {
  margin-top: 0.1rem;
}

.ot-policy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.ot-policy-head span {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-policy-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
}

.ot-policy-item {
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.65rem;
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
  .ot-date-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-custom-time-grid {
    grid-template-columns: 1fr 1fr 180px;
  }

  .ot-policy-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .ot-policy-grid {
    grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr));
  }
}
</style>