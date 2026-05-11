<!-- frontend/src/modules/calendar/components/HolidayDatePicker.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'

import {
  getHolidayLookupOptions,
  resolveHolidayDayType,
} from '@/modules/calendar/holiday.api'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: 'Select date',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  clearable: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue', 'change', 'selectedInfo'])

const rootRef = ref(null)
const open = ref(false)
const loading = ref(false)
const holidays = ref([])
const currentMonth = ref(getInitialMonth())

const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const selectedYmd = computed(() => normalizeYmd(props.modelValue))

const displayValue = computed(() => formatDdMmYyyy(selectedYmd.value))

const monthTitle = computed(() => {
  return currentMonth.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})

const holidayMap = computed(() => {
  const map = new Map()

  for (const item of holidays.value) {
    if (item?.date) {
      map.set(item.date, item)
    }
  }

  return map
})

const selectedHoliday = computed(() => {
  if (!selectedYmd.value) return null
  return holidayMap.value.get(selectedYmd.value) || null
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

    cells.push(buildCell(date, false))
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)

    cells.push(buildCell(date, true))
  }

  while (cells.length < 42) {
    const nextDay = cells.length - (firstDayIndex + daysInMonth) + 1
    const date = new Date(year, month + 1, nextDay)

    cells.push(buildCell(date, false))
  }

  return cells
})

watch(
  () => props.modelValue,
  (value) => {
    const ymd = normalizeYmd(value)

    if (ymd) {
      const date = ymdToLocalDate(ymd)
      currentMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
      fetchMonthHolidays()
    }
  },
)

watch(
  currentMonth,
  () => {
    fetchMonthHolidays()
  },
  { deep: false },
)

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatYmd(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function normalizeYmd(value) {
  const raw = String(value || '').trim()

  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const parsed = new Date(raw)

  if (Number.isNaN(parsed.getTime())) return ''

  return formatYmd(parsed)
}

function ymdToLocalDate(ymd) {
  const raw = normalizeYmd(ymd)

  if (!raw) return new Date()

  const [year, month, day] = raw.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function formatDdMmYyyy(ymd) {
  const raw = normalizeYmd(ymd)

  if (!raw) return ''

  const [year, month, day] = raw.split('-')

  return `${day}/${month}/${year}`
}

function getInitialMonth() {
  const selected = normalizeYmd(props.modelValue)

  if (selected) {
    const date = ymdToLocalDate(selected)

    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  const now = new Date()

  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function isToday(date) {
  return formatYmd(date) === formatYmd(new Date())
}

function isSelected(date) {
  return formatYmd(date) === selectedYmd.value
}

function isSunday(date) {
  return date.getDay() === 0
}

function buildCell(date, inCurrentMonth) {
  const ymd = formatYmd(date)
  const holiday = holidayMap.value.get(ymd) || null

  return {
    key: ymd,
    ymd,
    date,
    day: date.getDate(),
    inCurrentMonth,
    isToday: isToday(date),
    isSelected: isSelected(date),
    isSunday: isSunday(date),
    isHoliday: !!holiday,
    holiday,
  }
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

async function fetchMonthHolidays() {
  loading.value = true

  try {
    const year = currentMonth.value.getFullYear()
    const month = currentMonth.value.getMonth() + 1

    const res = await getHolidayLookupOptions({
      year,
      month,
      isActive: true,
      limit: 100,
    })

    const payload = normalizePayload(res)

    holidays.value = normalizeItems(payload)
  } catch (error) {
    holidays.value = []
  } finally {
    loading.value = false
  }
}

function toggleCalendar() {
  if (props.disabled) return
  open.value = !open.value

  if (open.value) {
    fetchMonthHolidays()
  }
}

function closeCalendar() {
  open.value = false
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
  const today = new Date()
  currentMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selectDate(formatYmd(today))
}

function clearDate() {
  emit('update:modelValue', '')
  emit('change', '')
  emit('selectedInfo', null)
  closeCalendar()
}

async function emitSelectedInfo(ymd) {
  try {
    const res = await resolveHolidayDayType(ymd)
    const payload = normalizePayload(res)

    emit('selectedInfo', payload.item || payload)
  } catch (error) {
    const date = ymdToLocalDate(ymd)
    const holiday = holidayMap.value.get(ymd) || null

    emit('selectedInfo', {
      date: ymd,
      dayType: holiday ? 'HOLIDAY' : isSunday(date) ? 'SUNDAY' : 'WORKING_DAY',
      isHoliday: !!holiday,
      isSunday: isSunday(date),
      holiday,
    })
  }
}

function selectDate(ymd) {
  const normalized = normalizeYmd(ymd)

  if (!normalized) return

  emit('update:modelValue', normalized)
  emit('change', normalized)

  emitSelectedInfo(normalized)
  closeCalendar()
}

function onCellClick(cell) {
  if (!cell.inCurrentMonth) {
    currentMonth.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
  }

  selectDate(cell.ymd)
}

function onDocumentClick(event) {
  if (!rootRef.value) return

  if (!rootRef.value.contains(event.target)) {
    closeCalendar()
  }
}

onMounted(() => {
  fetchMonthHolidays()
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <div
    ref="rootRef"
    class="holiday-picker"
  >
    <label
      v-if="label"
      class="ot-field-label"
    >
      {{ label }}
    </label>

    <div class="holiday-picker-input-wrap">
      <InputText
        :model-value="displayValue"
        readonly
        class="w-full"
        :placeholder="placeholder"
        :disabled="disabled"
        size="small"
        @click="toggleCalendar"
      />

      <button
        type="button"
        class="holiday-picker-icon"
        :disabled="disabled"
        @click.stop="toggleCalendar"
      >
        <i class="pi pi-calendar" />
      </button>
    </div>

    <div
      v-if="open"
      class="holiday-picker-panel"
    >
      <div class="holiday-picker-toolbar">
        <button
          type="button"
          class="holiday-nav-btn"
          @click="previousMonth"
        >
          <i class="pi pi-chevron-left" />
        </button>

        <div class="min-w-0 text-center">
          <div class="holiday-month-title">
            {{ monthTitle }}
          </div>

          <div class="holiday-month-subtitle">
            <span v-if="loading">Loading holidays...</span>
            <span v-else>{{ holidays.length }} active holiday{{ holidays.length === 1 ? '' : 's' }}</span>
          </div>
        </div>

        <button
          type="button"
          class="holiday-nav-btn"
          @click="nextMonth"
        >
          <i class="pi pi-chevron-right" />
        </button>
      </div>

      <div class="holiday-week-grid">
        <div
          v-for="labelText in weekLabels"
          :key="labelText"
          class="holiday-week-label"
        >
          {{ labelText }}
        </div>

        <button
          v-for="cell in calendarDays"
          :key="cell.key"
          type="button"
          class="holiday-day-cell"
          :class="{
            'is-outside': !cell.inCurrentMonth,
            'is-today': cell.isToday,
            'is-selected': cell.isSelected,
            'is-sunday': cell.isSunday,
            'is-holiday': cell.isHoliday,
          }"
          :title="cell.holiday?.name || (cell.isSunday ? 'Sunday' : '')"
          @click="onCellClick(cell)"
        >
          <span>{{ cell.day }}</span>
          <span
            v-if="cell.isHoliday"
            class="holiday-dot"
          />
        </button>
      </div>

      <div
        v-if="selectedHoliday"
        class="holiday-selected-info"
      >
        <div class="min-w-0">
          <div class="holiday-selected-title">
            {{ selectedHoliday.name }}
          </div>

          <div class="holiday-selected-date">
            {{ formatDdMmYyyy(selectedHoliday.date) }}
          </div>
        </div>

        <Tag
          value="Holiday"
          severity="danger"
        />
      </div>

      <div class="holiday-picker-footer">
        <Button
          label="Today"
          icon="pi pi-calendar"
          severity="secondary"
          outlined
          size="small"
          @click="goToday"
        />

        <Button
          v-if="clearable"
          label="Clear"
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          @click="clearDate"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.holiday-picker {
  position: relative;
  width: 100%;
}

.holiday-picker-input-wrap {
  position: relative;
}

.holiday-picker-icon {
  position: absolute;
  top: 50%;
  right: 0.55rem;
  display: inline-flex;
  height: 1.8rem;
  width: 1.8rem;
  transform: translateY(-50%);
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--ot-text-muted);
  cursor: pointer;
}

.holiday-picker-icon:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.holiday-picker-panel {
  position: absolute;
  z-index: 50;
  top: calc(100% + 0.5rem);
  left: 0;
  width: min(22rem, 92vw);
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.16);
  padding: 0.85rem;
}

.holiday-picker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.holiday-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  border: 1px solid var(--ot-border);
  background: var(--ot-bg);
  color: var(--ot-text);
  transition: 0.2s ease;
}

.holiday-nav-btn:hover {
  background: var(--ot-hover, rgba(148, 163, 184, 0.08));
}

.holiday-month-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--ot-text);
}

.holiday-month-subtitle {
  margin-top: 0.1rem;
  font-size: 0.72rem;
  color: var(--ot-text-muted);
}

.holiday-week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.holiday-week-label {
  padding-bottom: 0.15rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ot-text-muted);
}

.holiday-day-cell {
  position: relative;
  display: inline-flex;
  min-height: 2.2rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--ot-text);
  font-size: 0.84rem;
  font-weight: 650;
  cursor: pointer;
  transition: 0.18s ease;
}

.holiday-day-cell:hover {
  background: rgba(148, 163, 184, 0.13);
}

.holiday-day-cell.is-outside {
  color: var(--ot-text-muted);
  opacity: 0.45;
}

.holiday-day-cell.is-today {
  box-shadow: inset 0 0 0 1px var(--ot-border);
}

.holiday-day-cell.is-sunday {
  color: #dc2626;
}

.holiday-day-cell.is-holiday {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}

.holiday-day-cell.is-selected {
  background: var(--p-primary-500);
  color: #ffffff;
}

.holiday-day-cell.is-selected.is-sunday,
.holiday-day-cell.is-selected.is-holiday {
  background: var(--p-primary-500);
  color: #ffffff;
}

.holiday-dot {
  position: absolute;
  right: 0.43rem;
  bottom: 0.36rem;
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 9999px;
  background: currentColor;
}

.holiday-selected-info {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-bg);
  padding: 0.65rem 0.75rem;
}

.holiday-selected-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--ot-text);
}

.holiday-selected-date {
  margin-top: 0.1rem;
  font-size: 0.75rem;
  color: var(--ot-text-muted);
}

.holiday-picker-footer {
  margin-top: 0.75rem;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
</style>