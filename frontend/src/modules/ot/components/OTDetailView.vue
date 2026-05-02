<!-- frontend/src/modules/ot/components/OTDetailView.vue -->
<script setup>
// frontend/src/modules/ot/components/OTDetailView.vue

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Dropdown from 'primevue/dropdown'
import Message from 'primevue/message'
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
const currentMonth = ref(resolveInitialMonth())
const monthHolidayRows = ref([])

const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

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
  const key = formatYMD(props.form.otDate)
  return holidayMap.value.get(key) || null
})

const sortedMonthHolidays = computed(() => {
  return [...monthHolidayRows.value].sort((a, b) => {
    return normalizeDateKey(a?.date).localeCompare(normalizeDateKey(b?.date))
  })
})

const selectedDayType = computed(() => {
  const date = props.form.otDate
  if (!date) return '—'

  const key = formatYMD(date)

  if (holidayMap.value.has(key)) return 'HOLIDAY'

  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'

  if (parsed.getDay() === 0) return 'SUNDAY'

  return 'WORKING_DAY'
})

const selectedDateLabel = computed(() => formatPrettyDate(props.form.otDate))

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

function resolveInitialMonth() {
  const source = props.form?.otDate ? new Date(props.form.otDate) : new Date()

  if (Number.isNaN(source.getTime())) {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return new Date(source.getFullYear(), source.getMonth(), 1)
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
    isSelected: isSameDate(date, props.form.otDate),
    isHoliday: isHolidayDate(date),
    isSunday: date.getDay() === 0,
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

function syncMonthFromFormDate(value) {
  if (!value) return

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return

  currentMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
}

function selectCalendarDate(cell) {
  props.form.otDate = new Date(cell.date)

  if (!cell.inCurrentMonth) {
    currentMonth.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
  }
}

function selectHolidayDate(holiday) {
  const dateKey = normalizeDateKey(holiday?.date)
  if (!dateKey) return

  props.form.otDate = new Date(dateKey)
  currentMonth.value = new Date(
    props.form.otDate.getFullYear(),
    props.form.otDate.getMonth(),
    1,
  )
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
  props.form.otDate = now
  currentMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
}

watch(
  () => props.form?.otDate,
  (value) => {
    syncMonthFromFormDate(value)
  },
)

watch(
  currentMonth,
  () => {
    fetchMonthHolidays()
  },
)

onMounted(async () => {
  syncMonthFromFormDate(props.form?.otDate)
  await fetchMonthHolidays()
})
</script>

<template>
  <Card class="ot-create-card">
    <template #content>
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div class="flex flex-col gap-4">
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
              selectedEmployeeCount &&
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
</template>

<style scoped>
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

@media (max-width: 768px) {
  .ot-calendar-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>