<!-- frontend/src/modules/ot/components/OTDetailView.vue -->
<script setup>
// frontend/src/modules/ot/components/OTDetailView.vue

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
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

const selectedOption = computed(() => {
  return props.selectedOTOption || props.selectedOtOption || null
})

const selectedDateYMD = computed(() => formatYMD(props.form.otDate))

const selectedDateLabel = computed(() => formatPrettyDate(props.form.otDate))

const selectedShift = computed(() => {
  return props.selectedShiftState?.shift || null
})

const selectedShiftLabel = computed(() => {
  const shift = selectedShift.value

  if (!shift) return 'No shared shift yet'

  return [shift.code, shift.name].filter(Boolean).join(' · ') || 'Selected shift'
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

function setToday() {
  props.form.otDate = new Date()
}

async function fetchMonthHolidays() {
  const source = props.form.otDate ? new Date(props.form.otDate) : new Date()

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

      <div class="ot-setup-grid">
        <!-- LEFT: DATE FIRST -->
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
            <DatePicker
              v-model="props.form.otDate"
              inline
              class="ot-inline-calendar"
            />
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
        </section>

        <!-- RIGHT: OT OPTION + REASON -->
        <section class="ot-detail-panel">
          <div class="ot-field">
            <label class="ot-field-label">
              3. OT Option <span class="ot-required-star">*</span>
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

          <div class="ot-field">
            <label class="ot-field-label">
              4. Reason <span class="ot-optional-text">Optional</span>
            </label>

            <Textarea
              v-model.trim="props.form.reason"
              rows="6"
              autoResize
              class="w-full"
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
  padding: 0.45rem;
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
.ot-policy-box {
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

.ot-shift-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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
:deep(.p-textarea) {
  font-size: 0.86rem;
}

:deep(.ot-inline-calendar) {
  width: 100%;
}

:deep(.ot-inline-calendar .p-datepicker) {
  width: 100%;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

:deep(.ot-inline-calendar table) {
  width: 100%;
}

@media (min-width: 768px) {
  .ot-date-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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