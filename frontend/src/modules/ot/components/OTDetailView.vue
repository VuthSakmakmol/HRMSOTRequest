<!-- frontend/src/modules/ot/components/OTDetailView.vue -->
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
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
    if (item?.date) map.set(item.date, item)
  }
  return map
})

const selectedHoliday = computed(() => {
  const key = formatYMD(props.form?.otDate)
  return holidayMap.value.get(key) || null
})

const estimatedHours = computed(() => {
  if (!props.form?.startTime || !props.form?.endTime) return '-'

  const start = new Date(props.form.startTime)
  const end = new Date(props.form.endTime)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-'

  let diffMinutes = (end.getTime() - start.getTime()) / 60000
  if (diffMinutes < 0) diffMinutes += 24 * 60

  diffMinutes -= Number(props.form?.breakMinutes || 0)

  if (diffMinutes < 0) diffMinutes = 0

  return (diffMinutes / 60).toFixed(2)
})

const estimatedDayType = computed(() => {
  const date = props.form?.otDate
  if (!date) return '-'

  const key = formatYMD(date)
  if (holidayMap.value.has(key)) return 'HOLIDAY'

  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '-'

  if (d.getDay() === 0) return 'SUNDAY'

  return 'WORKING_DAY'
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

function resolveInitialMonth() {
  const source = props.form?.otDate ? new Date(props.form.otDate) : new Date()
  if (Number.isNaN(source.getTime())) {
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  }
  return new Date(source.getFullYear(), source.getMonth(), 1)
}

function pad2(v) {
  return String(v).padStart(2, '0')
}

function formatYMD(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatPrettyDate(value) {
  if (!value) return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
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
    isSelected: isSameDate(date, props.form?.otDate),
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
    monthHolidayRows.value = normalizeItems(payload)
  } catch (error) {
    monthHolidayRows.value = []
    toast.add({
      severity: 'error',
      summary: 'Holiday load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load holiday calendar.',
      life: 3000,
    })
  } finally {
    loadingCalendar.value = false
  }
}

function syncMonthFromFormDate(value) {
  if (!value) return
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return
  currentMonth.value = new Date(d.getFullYear(), d.getMonth(), 1)
}

function selectDate(cell) {
  props.form.otDate = new Date(cell.date)

  if (!cell.inCurrentMonth) {
    currentMonth.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
  }
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
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
    <!-- left -->
    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-4 py-3">
        <div class="text-sm font-medium text-[color:var(--ot-text)]">
          OT Details
        </div>
      </div>

      <div class="p-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              OT Date <span class="text-red-500">*</span>
            </label>
            <DatePicker
              v-model="form.otDate"
              dateFormat="yy-mm-dd"
              showIcon
              manualInput="false"
              fluid
              class="w-full ot-compact-picker"
              inputClass="w-full"
              placeholder="Select OT date"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Break Minutes
            </label>
            <InputNumber
              v-model="form.breakMinutes"
              :min="0"
              :useGrouping="false"
              fluid
              class="w-full"
              inputClass="w-full"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Start Time <span class="text-red-500">*</span>
            </label>
            <DatePicker
              v-model="form.startTime"
              timeOnly
              hourFormat="24"
              showIcon
              manualInput="false"
              fluid
              class="w-full ot-compact-picker"
              inputClass="w-full"
              placeholder="Choose start time"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              End Time <span class="text-red-500">*</span>
            </label>
            <DatePicker
              v-model="form.endTime"
              timeOnly
              hourFormat="24"
              showIcon
              manualInput="false"
              fluid
              class="w-full ot-compact-picker"
              inputClass="w-full"
              placeholder="Choose end time"
            />
          </div>

          <div class="space-y-2 md:col-span-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Reason <span class="text-red-500">*</span>
            </label>
            <Textarea
              v-model.trim="form.reason"
              rows="4"
              autoResize
              class="w-full"
              placeholder="Enter OT reason"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- right -->
    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] self-start">
      <div class="border-b border-[color:var(--ot-border)] px-4 py-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="text-sm font-medium text-[color:var(--ot-text)]">
              OT Calendar
            </div>
            <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
              Estimate OT day type
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
      </div>

      <div class="p-4">
        <div class="rounded-2xl bg-[color:var(--ot-bg)] p-3">
          <div class="mb-3 flex items-center justify-between">
            <button
              type="button"
              class="calendar-nav-btn"
              @click="previousMonth"
            >
              <i class="pi pi-chevron-left text-xs" />
            </button>

            <div class="text-center text-base font-semibold text-[color:var(--ot-text)]">
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
              class="pb-1 text-center text-[11px] font-semibold text-[color:var(--ot-text-muted)]"
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
              <span v-if="cell.isHoliday" class="calendar-dot" />
            </button>
          </div>
        </div>

        <div class="mt-3 space-y-2">
          <div class="rounded-xl border border-[color:var(--ot-border)] px-3 py-2">
            <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
              Selected Date
            </div>
            <div class="mt-1 text-sm font-medium text-[color:var(--ot-text)]">
              {{ formatPrettyDate(form.otDate) }}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-xl border border-[color:var(--ot-border)] px-3 py-2">
              <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
                Day Type
              </div>
              <div class="mt-1 text-sm font-medium text-[color:var(--ot-text)]">
                {{ estimatedDayType }}
              </div>
            </div>

            <div class="rounded-xl border border-[color:var(--ot-border)] px-3 py-2">
              <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
                Hours
              </div>
              <div class="mt-1 text-sm font-medium text-[color:var(--ot-text)]">
                {{ estimatedHours }}
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-[color:var(--ot-border)] px-3 py-2">
            <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
              Staff
            </div>
            <div class="mt-1 text-sm font-medium text-[color:var(--ot-text)]">
              {{ selectedEmployeeCount }}
            </div>
          </div>
        </div>

        <div
          v-if="selectedHoliday"
          class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
        >
          <div class="font-semibold">
            Holiday: {{ selectedHoliday.name }}
          </div>
          <div class="mt-1">
            {{ selectedHoliday.date }}
          </div>
        </div>

        <div
          v-else-if="loadingCalendar"
          class="mt-3 rounded-xl border border-[color:var(--ot-border)] px-3 py-3 text-sm text-[color:var(--ot-text-muted)]"
        >
          Loading holiday calendar...
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.ot-compact-picker .p-inputtext),
:deep(.ot-compact-picker .p-datepicker-input) {
  min-height: 2.625rem !important;
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
  height: 2.2rem;
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
</style>