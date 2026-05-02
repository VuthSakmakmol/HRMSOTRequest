// frontend/src/modules/calendar/views/HolidayListView.vue
<!-- frontend/src/modules/calendar/views/HolidayListView.vue -->
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputSwitch from 'primevue/inputswitch'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import { useAuthStore } from '@/modules/auth/auth.store'
import {
  createHoliday,
  getHolidays,
  updateHoliday,
} from '../holiday.api'

const toast = useToast()
const auth = useAuthStore()

const saving = ref(false)
const loadingCalendar = ref(false)
const loadingSummary = ref(false)

const dialogVisible = ref(false)
const editingId = ref('')

const selectedDate = ref(new Date())
const currentMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const monthHolidayRows = ref([])
const totalRecords = ref(0)

const form = reactive(getDefaultForm())

const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const isEditMode = computed(() => !!editingId.value)

const canCreateHoliday = computed(() => auth.hasAnyPermission(['HOLIDAY_CREATE']))
const canUpdateHoliday = computed(() => auth.hasAnyPermission(['HOLIDAY_UPDATE']))
const canSubmitForm = computed(() => {
  return isEditMode.value ? canUpdateHoliday.value : canCreateHoliday.value
})

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !canSubmitForm.value ||
    !String(form.date || '').trim() ||
    !String(form.name || '').trim()
  )
})

const monthTitle = computed(() => {
  return currentMonth.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})

const selectedDateKey = computed(() => formatYMD(selectedDate.value))

const holidayMap = computed(() => {
  const map = new Map()
  for (const item of monthHolidayRows.value) {
    if (item?.date) map.set(item.date, item)
  }
  return map
})

const selectedHoliday = computed(() => {
  return holidayMap.value.get(selectedDateKey.value) || null
})

const sortedMonthHolidays = computed(() => {
  return [...monthHolidayRows.value].sort((a, b) => {
    return String(a.date || '').localeCompare(String(b.date || ''))
  })
})

const totalHolidays = computed(() => totalRecords.value || 0)

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

function getDefaultForm() {
  return {
    date: '',
    code: '',
    name: '',
    description: '',
    isPaidHoliday: true,
    isActive: true,
  }
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, getDefaultForm())
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

function statusSeverity(active) {
  return active ? 'success' : 'contrast'
}

function paidSeverity(isPaid) {
  return isPaid ? 'warning' : 'contrast'
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
    isSelected: isSameDate(date, selectedDate.value),
    isHoliday: isHolidayDate(date),
  }
}

async function fetchTotal() {
  loadingSummary.value = true
  try {
    const res = await getHolidays({
      page: 1,
      limit: 1,
      sortBy: 'date',
      sortOrder: 'desc',
    })
    const payload = normalizePayload(res)
    totalRecords.value = Number(payload?.pagination?.total || 0)
  } catch (error) {
    totalRecords.value = 0
  } finally {
    loadingSummary.value = false
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
      summary: 'Load failed',
      detail: error?.response?.data?.message || error?.message || 'Failed to load holiday calendar',
      life: 3000,
    })
  } finally {
    loadingCalendar.value = false
  }
}

function selectDate(cell) {
  selectedDate.value = new Date(cell.date)
  if (!cell.inCurrentMonth) {
    currentMonth.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
    fetchMonthHolidays()
  }
}

function previousMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() - 1,
    1
  )
  fetchMonthHolidays()
}

function nextMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + 1,
    1
  )
  fetchMonthHolidays()
}

function goToday() {
  const now = new Date()
  selectedDate.value = now
  currentMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
  fetchMonthHolidays()
}

function openCreateDialog() {
  if (!canCreateHoliday.value) return
  resetForm()
  form.date = formatYMD(selectedDate.value)
  dialogVisible.value = true
}

function openEditDialog(row) {
  if (!canUpdateHoliday.value) return
  editingId.value = row?.id || row?._id || ''
  form.date = row?.date || ''
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.description = row?.description || ''
  form.isPaidHoliday = !!row?.isPaidHoliday
  form.isActive = !!row?.isActive
  dialogVisible.value = true
}

async function submitForm() {
  if (!canSubmitForm.value) return

  saving.value = true
  try {
    const payload = {
      date: String(form.date || '').trim(),
      code: String(form.code || '').trim(),
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim(),
      isPaidHoliday: !!form.isPaidHoliday,
      isActive: !!form.isActive,
    }

    if (editingId.value) {
      await updateHoliday(editingId.value, payload)
      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Holiday updated successfully',
        life: 2500,
      })
    } else {
      await createHoliday(payload)
      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Holiday created successfully',
        life: 2500,
      })
    }

    dialogVisible.value = false
    resetForm()
    await Promise.all([fetchMonthHolidays(), fetchTotal()])
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Update failed' : 'Create failed',
      detail: error?.response?.data?.message || error?.message || 'Failed to save holiday',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchMonthHolidays(), fetchTotal()])
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

      <div class="flex items-center gap-2">
        <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Total
          </div>
          <div class="mt-1 text-lg font-semibold text-[color:var(--ot-text)]">
            {{ totalHolidays }}
          </div>
        </div>

        <Button
          label="Today"
          icon="pi pi-calendar"
          severity="secondary"
          outlined
          size="small"
          @click="goToday"
        />
        <Button
          v-if="canCreateHoliday"
          label="Create Holiday"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-[color:var(--ot-text)]">
              Holiday Calendar
            </div>
            <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
              {{ monthTitle }}
            </div>
          </div>

          <Tag
            :value="`${sortedMonthHolidays.length} holiday${sortedMonthHolidays.length === 1 ? '' : 's'}`"
            severity="info"
          />
        </div>

        <div class="rounded-2xl bg-[color:var(--ot-bg)] p-4">
          <div class="mb-4 flex items-center justify-between">
            <button
              type="button"
              class="calendar-nav-btn"
              @click="previousMonth"
            >
              <i class="pi pi-chevron-left text-sm" />
            </button>

            <div class="text-center text-[26px] font-semibold tracking-tight text-[color:var(--ot-text)]">
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

          <div class="grid grid-cols-7 gap-2">
            <div
              v-for="label in weekLabels"
              :key="label"
              class="pb-1 text-center text-xs font-semibold text-[color:var(--ot-text-muted)]"
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
                'is-sunday': cell.date.getDay() === 0,
              }"
              @click="selectDate(cell)"
            >
              <span class="calendar-number">{{ cell.day }}</span>
              <span v-if="cell.isHoliday" class="calendar-dot" />
            </button>
          </div>
        </div>

        <div class="mt-3 rounded-2xl bg-[color:var(--ot-bg)] px-4 py-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Selected Date
          </div>
          <div class="mt-1 text-sm font-medium text-[color:var(--ot-text)]">
            {{ formatPrettyDate(selectedDate) }}
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
        <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-[color:var(--ot-text)]">
              Holiday Summary
            </h2>
          </div>
        </div>

        <div
          v-if="selectedHoliday"
          class="rounded-2xl bg-[color:var(--ot-bg)] p-4"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
              <div class="text-lg font-semibold text-[color:var(--ot-text)]">
                {{ selectedHoliday.name }}
              </div>
              <div class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
                {{ formatPrettyDate(selectedHoliday.date) }}
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Tag
                :value="selectedHoliday.isPaidHoliday ? 'Paid' : 'Unpaid'"
                :severity="paidSeverity(selectedHoliday.isPaidHoliday)"
              />
              <Tag
                :value="selectedHoliday.isActive ? 'Active' : 'Inactive'"
                :severity="statusSeverity(selectedHoliday.isActive)"
              />
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-3">
              <div class="text-xs text-[color:var(--ot-text-muted)]">Date</div>
              <div class="mt-1 font-medium text-[color:var(--ot-text)]">
                {{ selectedHoliday.date || '-' }}
              </div>
            </div>

            <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-3">
              <div class="text-xs text-[color:var(--ot-text-muted)]">Code</div>
              <div class="mt-1 font-medium text-[color:var(--ot-text)]">
                {{ selectedHoliday.code || '-' }}
              </div>
            </div>
          </div>

          <div
            v-if="selectedHoliday.description"
            class="mt-3 rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-3 text-sm text-[color:var(--ot-text)]"
          >
            {{ selectedHoliday.description }}
          </div>

          <div v-if="canUpdateHoliday" class="mt-3 flex justify-end">
            <Button
              label="Edit Holiday"
              icon="pi pi-pencil"
              size="small"
              outlined
              @click="openEditDialog(selectedHoliday)"
            />
          </div>
        </div>

        <div
          v-else
          class="rounded-2xl bg-[color:var(--ot-bg)] p-4"
        >
          <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
            {{ monthTitle }} Holiday List
          </div>

          <div v-if="loadingCalendar" class="py-8 text-center text-sm text-[color:var(--ot-text-muted)]">
            Loading...
          </div>

          <div v-else-if="sortedMonthHolidays.length" class="space-y-3">
            <button
              v-for="item in sortedMonthHolidays"
              :key="item.id || item._id || item.date"
              type="button"
              class="summary-row"
              @click="selectedDate = new Date(item.date)"
            >
              <div class="min-w-0 text-left">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  {{ item.name }}
                </div>
                <div class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
                  {{ formatPrettyDate(item.date) }}
                </div>
                <div
                  v-if="item.description"
                  class="mt-2 text-sm text-[color:var(--ot-text-muted)]"
                >
                  {{ item.description }}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Tag :value="item.code || 'No Code'" severity="contrast" />
                <Tag
                  :value="item.isPaidHoliday ? 'Paid' : 'Unpaid'"
                  :severity="paidSeverity(item.isPaidHoliday)"
                />
              </div>
            </button>
          </div>

          <div
            v-else
            class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-8 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No holiday in this month.
          </div>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="isEditMode ? 'Edit Holiday' : 'Create Holiday'"
      :style="{ width: '40rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Date
          </label>
          <InputText
            v-model="form.date"
            type="date"
            class="w-full"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Code
          </label>
          <InputText
            v-model="form.code"
            class="w-full"
            placeholder="Example: KHNY-1"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Holiday Name
          </label>
          <InputText
            v-model="form.name"
            class="w-full"
            placeholder="Enter holiday name"
          />
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Description
          </label>
          <Textarea
            v-model="form.description"
            class="w-full"
            rows="3"
            placeholder="Optional holiday description"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Paid Holiday
          </span>
          <InputSwitch v-model="form.isPaidHoliday" />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-medium text-[color:var(--ot-text)]">
            Active Status
          </span>
          <InputSwitch v-model="form.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="dialogVisible = false"
          />
          <Button
            v-if="canSubmitForm"
            :label="isEditMode ? 'Save Changes' : 'Create Holiday'"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitForm"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.calendar-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
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
  height: 2.9rem;
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
  font-size: 0.95rem;
  line-height: 1;
}

.calendar-dot {
  position: absolute;
  right: 0.58rem;
  bottom: 0.48rem;
  width: 0.34rem;
  height: 0.34rem;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.9;
}

.summary-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  border-radius: 0.9rem;
  padding: 0.95rem 1rem;
  transition: 0.2s ease;
}

.summary-row:hover {
  background: var(--ot-hover, rgba(148, 163, 184, 0.08));
}
</style>