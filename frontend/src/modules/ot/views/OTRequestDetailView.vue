<!-- frontend/src/modules/ot/components/OTDetailView.vue -->
<script setup>
// frontend/src/modules/ot/components/OTDetailView.vue

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Card from 'primevue/card'
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

  shiftOptions: {
    type: Array,
    default: () => [],
  },

  loadingShifts: {
    type: Boolean,
    default: false,
  },

  otOptions: {
    type: Array,
    default: () => [],
  },

  loadingOtOptions: {
    type: Boolean,
    default: false,
  },

  selectedShift: {
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

  selectedEmployeeCount: {
    type: Number,
    default: 0,
  },

  checkingAvailability: {
    type: Boolean,
    default: false,
  },
})

const toast = useToast()

const loadingCalendar = ref(false)
const monthHolidayRows = ref([])

const selectedDateYMD = computed(() => formatYMD(props.form.otDate))
const selectedDateLabel = computed(() => formatPrettyDate(props.form.otDate))

const selectedMonth = computed(() => {
  const source = props.form.otDate ? new Date(props.form.otDate) : new Date()
  if (Number.isNaN(source.getTime())) return new Date()
  return source
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
  const key = selectedDateYMD.value
  return key ? holidayMap.value.get(key) || null : null
})

const selectedDayType = computed(() => {
  if (!props.form.otDate) return '—'

  const key = selectedDateYMD.value
  if (key && holidayMap.value.has(key)) return 'HOLIDAY'

  const date = new Date(props.form.otDate)
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

const stepState = computed(() => {
  if (!selectedDateYMD.value) {
    return {
      severity: 'info',
      message: 'Step 1: Choose OT date first.',
    }
  }

  if (!props.form.shiftId) {
    return {
      severity: 'info',
      message: 'Step 2: Choose shift to load OT options.',
    }
  }

  if (props.loadingOtOptions) {
    return {
      severity: 'info',
      message: 'Loading OT options for selected shift...',
    }
  }

  if (!props.otOptions.length) {
    return {
      severity: 'warn',
      message: 'No active OT option is configured for this shift.',
    }
  }

  if (!props.form.shiftOtOptionId) {
    return {
      severity: 'info',
      message: 'Step 3: Choose OT option.',
    }
  }

  return {
    severity: 'success',
    message: 'Step 4: Choose employees. Your managed employees will be auto-selected.',
  }
})

function pad2(value) {
  return String(value).padStart(2, '0')
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

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeHolidayItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.rows)) return payload.rows
  return []
}

async function fetchMonthHolidays() {
  const source = selectedMonth.value
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
  () => `${selectedMonth.value.getFullYear()}-${selectedMonth.value.getMonth() + 1}`,
  () => {
    fetchMonthHolidays()
  },
)

onMounted(() => {
  fetchMonthHolidays()
})
</script>

<template>
  <Card class="ot-setup-card">
    <template #content>
      <div class="ot-setup-head">
        <div class="min-w-0">
          <div class="ot-setup-eyebrow">
            Create OT Request
          </div>

          <h2 class="ot-setup-title">
            OT setup
          </h2>

          <p class="ot-setup-subtitle">
            Choose date, shift, OT option, then select employees.
          </p>
        </div>

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

      <Message
        :severity="stepState.severity"
        :closable="false"
        class="m-0"
      >
        {{ stepState.message }}
      </Message>

      <div class="ot-setup-grid">
        <div class="ot-field">
          <label class="ot-field-label">
            1. OT Date <span class="ot-required-star">*</span>
          </label>

          <DatePicker
            v-model="form.otDate"
            dateFormat="yy-mm-dd"
            showIcon
            showButtonBar
            class="w-full"
            inputClass="w-full"
            placeholder="Choose OT date"
          />

          <div class="ot-date-card">
            <div>
              <span>Selected Date</span>
              <strong>{{ selectedDateLabel }}</strong>
            </div>

            <div>
              <span>Day Type</span>
              <strong>{{ selectedDayType }}</strong>
            </div>

            <div
              v-if="selectedHoliday"
              class="ot-holiday-box"
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
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            2. Shift <span class="ot-required-star">*</span>
          </label>

          <Select
            v-model="form.shiftId"
            :options="shiftOptions"
            optionLabel="optionLabel"
            optionValue="id"
            class="w-full"
            placeholder="Choose shift"
            :loading="loadingShifts"
            :disabled="!form.otDate || loadingShifts"
          />

          <div
            v-if="selectedShift"
            class="ot-shift-card"
          >
            <div>
              <span>Shift</span>
              <strong>{{ selectedShift.label }}</strong>
            </div>

            <div>
              <span>Time</span>
              <strong>
                {{ selectedShift.startTime || '-' }} - {{ selectedShift.endTime || '-' }}
              </strong>
            </div>

            <div v-if="selectedShift.breakStartTime || selectedShift.breakEndTime">
              <span>Break</span>
              <strong>
                {{ selectedShift.breakStartTime || '-' }} - {{ selectedShift.breakEndTime || '-' }}
              </strong>
            </div>
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            3. OT Option <span class="ot-required-star">*</span>
          </label>

          <Select
            v-model="form.shiftOtOptionId"
            :options="otOptions"
            optionLabel="optionLabel"
            optionValue="id"
            class="w-full"
            placeholder="Choose OT option"
            :loading="loadingOtOptions"
            :disabled="!form.shiftId || loadingOtOptions || !otOptions.length"
          />

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
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            4. Reason <span class="ot-optional-text">Optional</span>
          </label>

          <Textarea
            v-model.trim="form.reason"
            rows="4"
            autoResize
            class="w-full"
            placeholder="Reason is optional. Add note only if needed."
          />
        </div>
      </div>

      <div
        v-if="selectedOTOption?.calculationPolicy"
        class="ot-policy-box"
      >
        <div class="ot-policy-head">
          <span>Calculation Policy</span>

          <Tag
            :value="selectedOTOption.calculationPolicy.code || '—'"
            severity="info"
          />
        </div>

        <div class="ot-policy-grid">
          <div class="ot-policy-item">
            <span>Name</span>
            <strong>{{ selectedOTOption.calculationPolicy.name || '-' }}</strong>
          </div>

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

      <Message
        v-if="checkingAvailability"
        severity="info"
        :closable="false"
        class="m-0"
      >
        Checking employees already used in OT on this date...
      </Message>
    </template>
  </Card>
</template>

<style scoped>
:deep(.ot-setup-card .p-card-body) {
  padding: 1rem !important;
}

.ot-setup-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.ot-setup-eyebrow {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-setup-title {
  margin-top: 0.15rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-setup-subtitle {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: var(--ot-text-muted);
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
  gap: 0.85rem;
  margin-top: 0.9rem;
}

.ot-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.ot-field-label {
  font-size: 0.82rem;
  font-weight: 500;
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

.ot-date-card,
.ot-shift-card,
.ot-option-preview,
.ot-policy-box {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-date-card,
.ot-shift-card {
  display: grid;
  gap: 0.45rem;
}

.ot-date-card span,
.ot-shift-card span,
.ot-preview-box span,
.ot-policy-item span,
.ot-holiday-box span {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-date-card strong,
.ot-shift-card strong,
.ot-preview-box strong,
.ot-policy-item strong,
.ot-holiday-box strong {
  display: block;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-holiday-box {
  border: 1px solid rgba(220, 38, 38, 0.28);
  border-radius: 0.85rem;
  background: rgba(220, 38, 38, 0.08);
  padding: 0.65rem;
}

.ot-holiday-box strong,
.ot-holiday-box small {
  color: #dc2626;
}

.ot-holiday-box small {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.72rem;
}

.ot-calendar-note {
  font-size: 0.76rem;
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

.ot-policy-box {
  margin-top: 0.9rem;
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

:deep(.p-inputtext),
:deep(.p-select) {
  font-size: 0.86rem;
}

@media (min-width: 768px) {
  .ot-setup-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-policy-grid {
    grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .ot-setup-grid {
    grid-template-columns: 290px 300px minmax(300px, 1fr) minmax(280px, 0.9fr);
    align-items: start;
  }

  .ot-option-preview {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>