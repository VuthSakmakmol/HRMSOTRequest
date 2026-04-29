<!-- frontend/src/modules/ot/views/ShiftOTOptionListView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { useAuthStore } from '@/modules/auth/auth.store'
import { getShiftLookupOptions } from '@/modules/shift/shift.api'
import {
  createShiftOTOption,
  getOTCalculationPolicyLookupOptions,
  getShiftOTOptions,
  updateShiftOTOption,
} from '@/modules/ot/otMaster.api'

const toast = useToast()
const auth = useAuthStore()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const LOOKUP_LIMIT = 50

const saving = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const shiftSelectOptions = ref([])
const policySelectOptions = ref([])

const optionDialogVisible = ref(false)
const editingOptionId = ref('')

const filters = reactive({
  search: '',
  shiftId: '',
  calculationPolicyId: '',
  timingMode: '',
  isActive: '',
  sortField: 'sequence',
  sortOrder: 1,
})

const form = reactive({
  shiftId: '',
  label: '',
  timingMode: 'AFTER_SHIFT_END',
  startAfterShiftEndMinutes: 0,
  fixedStartTime: '',
  fixedEndTime: '',
  requestedMinutes: 120,
  calculationPolicyId: '',
  sequence: 1,
  isActive: true,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const timingModeOptions = [
  { label: 'All Timing Modes', value: '' },
  { label: 'After Shift End', value: 'AFTER_SHIFT_END' },
  { label: 'Fixed Time', value: 'FIXED_TIME' },
]

const formTimingModeOptions = [
  {
    label: 'After Shift End',
    value: 'AFTER_SHIFT_END',
  },
  {
    label: 'Fixed Time',
    value: 'FIXED_TIME',
  },
]

const filterShiftOptions = computed(() => [
  { label: 'All Shifts', value: '' },
  ...shiftSelectOptions.value,
])

const filterPolicyOptions = computed(() => [
  { label: 'All Policies', value: '' },
  ...policySelectOptions.value,
])

const canViewShiftOTOption = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission(['SHIFT_OT_OPTION_VIEW']),
)

const canCreateShiftOTOption = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission(['SHIFT_OT_OPTION_CREATE']),
)

const canUpdateShiftOTOption = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission(['SHIFT_OT_OPTION_UPDATE']),
)

const isEditMode = computed(() => !!editingOptionId.value)

const canSaveDialog = computed(() =>
  isEditMode.value ? canUpdateShiftOTOption.value : canCreateShiftOTOption.value,
)

const totalOptions = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalOptions.value}`)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalOptions.value > PAGE_SIZE)

const selectedShiftOption = computed(() =>
  shiftSelectOptions.value.find((item) => item.value === form.shiftId) || null,
)

const selectedPolicyOption = computed(() =>
  policySelectOptions.value.find((item) => item.value === form.calculationPolicyId) || null,
)

const isAfterShiftEndMode = computed(() => form.timingMode === 'AFTER_SHIFT_END')
const isFixedTimeMode = computed(() => form.timingMode === 'FIXED_TIME')

const previewWindow = computed(() => {
  if (isAfterShiftEndMode.value) {
    const shiftEnd = selectedShiftOption.value?.endTime || ''
    const start = addMinutesToHHmm(shiftEnd, Number(form.startAfterShiftEndMinutes || 0))
    const end = addMinutesToHHmm(start, Number(form.requestedMinutes || 0))

    return {
      start,
      end,
    }
  }

  return {
    start: form.fixedStartTime || '',
    end: form.fixedEndTime || '',
  }
})

const isSaveDisabled = computed(() => {
  const baseInvalid =
    saving.value ||
    !canSaveDialog.value ||
    !String(form.shiftId || '').trim() ||
    !String(form.label || '').trim() ||
    !String(form.timingMode || '').trim() ||
    !String(form.calculationPolicyId || '').trim() ||
    Number(form.requestedMinutes || 0) < 1 ||
    Number(form.sequence || 0) < 1

  if (baseInvalid) return true

  if (form.timingMode === 'AFTER_SHIFT_END') {
    return Number(form.startAfterShiftEndMinutes || 0) < 0
  }

  if (form.timingMode === 'FIXED_TIME') {
    return !isValidHHmm(form.fixedStartTime) || !isValidHHmm(form.fixedEndTime)
  }

  return true
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeLookupItems(res) {
  const payload = normalizePayload(res)
  const items = normalizeItems(payload)

  return items
    .map((item) => {
      const id = String(item?.id || item?._id || item?.value || '').trim()
      const label = String(
        item?.label ||
          item?.optionLabel ||
          [item?.code, item?.name].filter(Boolean).join(' - ') ||
          '',
      ).trim()

      if (!id || !label) return null

      return {
        ...item,
        label,
        value: id,
      }
    })
    .filter(Boolean)
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isValidHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim())
}

function toMinutes(value) {
  const raw = String(value || '').trim()

  if (!isValidHHmm(raw)) return null

  const [hours, minutes] = raw.split(':').map(Number)
  return hours * 60 + minutes
}

function fromMinutes(value) {
  const total = ((Number(value || 0) % 1440) + 1440) % 1440
  const hours = Math.floor(total / 60)
  const minutes = total % 60

  return `${pad2(hours)}:${pad2(minutes)}`
}

function addMinutesToHHmm(time, minutesToAdd) {
  const base = toMinutes(time)

  if (base === null) return ''

  return fromMinutes(base + Number(minutesToAdd || 0))
}

function durationBetweenTimes(startTime, endTime) {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)

  if (start === null || end === null) return 0

  let diff = end - start

  if (diff <= 0) {
    diff += 1440
  }

  return diff
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    shiftId: filters.shiftId,
    calculationPolicyId: filters.calculationPolicyId,
    timingMode: filters.timingMode,
    isActive: filters.isActive,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

async function fetchShiftLookup() {
  try {
    const res = await getShiftLookupOptions({
      search: '',
      limit: LOOKUP_LIMIT,
      isActive: true,
    })

    shiftSelectOptions.value = normalizeLookupItems(res)
  } catch (error) {
    shiftSelectOptions.value = []

    toast.add({
      severity: 'error',
      summary: 'Shift lookup failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load shift lookup options.',
      life: 3000,
    })
  }
}

async function fetchPolicyLookup() {
  try {
    const res = await getOTCalculationPolicyLookupOptions({
      search: '',
      limit: LOOKUP_LIMIT,
      isActive: true,
    })

    policySelectOptions.value = normalizeLookupItems(res)
  } catch (error) {
    policySelectOptions.value = []

    toast.add({
      severity: 'error',
      summary: 'Policy lookup failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load policy lookup options.',
      life: 3000,
    })
  }
}

async function fetchLookups() {
  await Promise.all([fetchShiftLookup(), fetchPolicyLookup()])
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!canViewShiftOTOption.value) {
    bootstrapped.value = true
    return
  }

  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getShiftOTOptions(buildQuery(page))
    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
    const total = Number(payload?.pagination?.total || 0)

    totalRecords.value = total

    if (replace) {
      const nextRows = Array.from({ length: total }, () => null)
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        rows.value[startIndex + i] = items[i]
      }

      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load shift OT options.',
      life: 3000,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
  })
}

function runSearchSoon() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    reloadFirstPage({ keepVisible: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onShiftChange() {
  reloadFirstPage({ keepVisible: true })
}

function onPolicyChange() {
  reloadFirstPage({ keepVisible: true })
}

function onTimingModeFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.shiftId = ''
  filters.calculationPolicyId = ''
  filters.timingMode = ''
  filters.isActive = ''
  filters.sortField = 'sequence'
  filters.sortOrder = 1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  const fieldMap = {
    label: 'label',
    timingMode: 'timingMode',
    requestedMinutes: 'requestedMinutes',
    startAfterShiftEndMinutes: 'startAfterShiftEndMinutes',
    sequence: 'sequence',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }

  filters.sortField = fieldMap[event.sortField] || 'sequence'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : 1

  reloadFirstPage({ keepVisible: true })
}

async function onVirtualLazyLoad(event) {
  if (!useVirtualScroll.value) return

  const first = Number(event?.first || 0)
  const last = Number(event?.last || first + PAGE_SIZE)

  const startPage = Math.floor(first / PAGE_SIZE) + 1
  const endPage = Math.floor(Math.max(last - 1, first) / PAGE_SIZE) + 1

  for (let page = startPage; page <= endPage; page += 1) {
    if (!loadedPages.value.has(page)) {
      await fetchPage(page, { silent: true })
    }
  }
}

function resetForm() {
  editingOptionId.value = ''
  form.shiftId = ''
  form.label = ''
  form.timingMode = 'AFTER_SHIFT_END'
  form.startAfterShiftEndMinutes = 0
  form.fixedStartTime = ''
  form.fixedEndTime = ''
  form.requestedMinutes = 120
  form.calculationPolicyId = ''
  form.sequence = 1
  form.isActive = true
}

function openCreateDialog() {
  if (!canCreateShiftOTOption.value) return

  resetForm()
  optionDialogVisible.value = true
}

function openEditDialog(row) {
  if (!canUpdateShiftOTOption.value) return

  editingOptionId.value = String(row?.id || row?._id || '').trim()
  form.shiftId = String(row?.shiftId || row?.shift?.id || row?.shift?._id || '').trim()
  form.label = String(row?.label || '').trim()
  form.timingMode = String(row?.timingMode || 'AFTER_SHIFT_END').trim().toUpperCase()
  form.startAfterShiftEndMinutes = Number(row?.startAfterShiftEndMinutes || 0)
  form.fixedStartTime = String(row?.fixedStartTime || '').trim()
  form.fixedEndTime = String(row?.fixedEndTime || '').trim()
  form.requestedMinutes = Number(row?.requestedMinutes || 120)
  form.calculationPolicyId = String(
    row?.calculationPolicyId ||
      row?.calculationPolicy?.id ||
      row?.calculationPolicy?._id ||
      '',
  ).trim()
  form.sequence = Number(row?.sequence || 1)
  form.isActive = row?.isActive !== false

  optionDialogVisible.value = true
}

function validateForm() {
  if (!String(form.shiftId || '').trim()) return 'Shift is required.'
  if (!String(form.label || '').trim()) return 'Label is required.'
  if (!String(form.timingMode || '').trim()) return 'Timing mode is required.'

  if (form.timingMode === 'AFTER_SHIFT_END') {
    if (Number(form.startAfterShiftEndMinutes || 0) < 0) {
      return 'Start after shift end minutes must be at least 0.'
    }
  }

  if (form.timingMode === 'FIXED_TIME') {
    if (!isValidHHmm(form.fixedStartTime)) {
      return 'Fixed start time must be in HH:mm format.'
    }

    if (!isValidHHmm(form.fixedEndTime)) {
      return 'Fixed end time must be in HH:mm format.'
    }

    if (form.fixedStartTime === form.fixedEndTime) {
      return 'Fixed start time and fixed end time cannot be the same.'
    }
  }

  if (Number(form.requestedMinutes || 0) < 1) {
    return 'Requested minutes must be at least 1.'
  }

  if (!String(form.calculationPolicyId || '').trim()) {
    return 'Calculation policy is required.'
  }

  if (Number(form.sequence || 0) < 1) {
    return 'Sequence must be at least 1.'
  }

  return ''
}

function buildPayload() {
  const timingMode = String(form.timingMode || 'AFTER_SHIFT_END').trim().toUpperCase()

  return {
    shiftId: String(form.shiftId || '').trim(),
    label: String(form.label || '').trim(),
    timingMode,
    startAfterShiftEndMinutes:
      timingMode === 'AFTER_SHIFT_END'
        ? Number(form.startAfterShiftEndMinutes || 0)
        : 0,
    fixedStartTime:
      timingMode === 'FIXED_TIME'
        ? String(form.fixedStartTime || '').trim()
        : '',
    fixedEndTime:
      timingMode === 'FIXED_TIME'
        ? String(form.fixedEndTime || '').trim()
        : '',
    requestedMinutes: Number(form.requestedMinutes || 0),
    calculationPolicyId: String(form.calculationPolicyId || '').trim(),
    sequence: Number(form.sequence || 0),
    isActive: form.isActive === true,
  }
}

async function submitOption() {
  const message = validateForm()

  if (message) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: message,
      life: 2500,
    })
    return
  }

  if (!canSaveDialog.value) {
    toast.add({
      severity: 'warn',
      summary: 'Permission denied',
      detail: isEditMode.value
        ? 'You do not have permission to update shift OT option.'
        : 'You do not have permission to create shift OT option.',
      life: 2500,
    })
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()

    if (editingOptionId.value) {
      await updateShiftOTOption(editingOptionId.value, payload)

      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Shift OT option updated successfully.',
        life: 2500,
      })
    } else {
      await createShiftOTOption(payload)

      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Shift OT option created successfully.',
        life: 2500,
      })
    }

    optionDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Save failed' : 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save shift OT option.',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

function activeSeverity(value) {
  return value ? 'success' : 'contrast'
}

function timingModeSeverity(value) {
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'FIXED_TIME') return 'warning'
  return 'info'
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

function formatMinutesLabel(value) {
  const minutes = Number(value || 0)

  if (!minutes) return '0 min'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`

  return `${mins}m`
}

function shiftLabel(row) {
  const shift = row?.shift || {}
  const code = String(shift?.code || '').trim()
  const name = String(shift?.name || '').trim()

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name

  return '-'
}

function shiftSubLabel(row) {
  const shift = row?.shift || {}
  const type = String(shift?.type || '').trim()
  const start = String(shift?.startTime || '').trim()
  const end = String(shift?.endTime || '').trim()

  return [type, start && end ? `${start} - ${end}` : '']
    .filter(Boolean)
    .join(' · ') || '-'
}

function policyLabel(row) {
  const policy = row?.calculationPolicy || {}
  const code = String(policy?.code || '').trim()
  const name = String(policy?.name || '').trim()

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name

  return '-'
}

function policySubLabel(row) {
  const policy = row?.calculationPolicy || {}

  const exactOutLabel =
    policy?.allowApprovedOtWithoutExactClockOut === true
      ? 'No exact out allowed'
      : 'Strict scan'

  return [
    String(policy?.roundMethod || '').trim(),
    Number(policy?.roundUnitMinutes || 0)
      ? `${Number(policy?.roundUnitMinutes || 0)} min`
      : '',
    exactOutLabel,
  ]
    .filter(Boolean)
    .join(' · ') || '-'
}

function timingModeLabel(value) {
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'FIXED_TIME') return 'Fixed Time'
  return 'After Shift End'
}

function optionTimeWindow(row) {
  const timingMode = String(row?.timingMode || 'AFTER_SHIFT_END').toUpperCase()

  if (timingMode === 'FIXED_TIME') {
    const start = String(row?.fixedStartTime || '').trim()
    const end = String(row?.fixedEndTime || '').trim()

    if (start && end) return `${start} - ${end}`
    return '-'
  }

  const shiftEnd = String(row?.shift?.endTime || '').trim()
  const start = addMinutesToHHmm(shiftEnd, Number(row?.startAfterShiftEndMinutes || 0))
  const end = addMinutesToHHmm(start, Number(row?.requestedMinutes || 0))

  if (start && end) return `${start} - ${end}`
  return '-'
}

function optionTimingSubLabel(row) {
  const timingMode = String(row?.timingMode || 'AFTER_SHIFT_END').toUpperCase()

  if (timingMode === 'FIXED_TIME') {
    return 'Uses fixed start/end time'
  }

  return `Starts ${Number(row?.startAfterShiftEndMinutes || 0)} min after shift end`
}

watch(
  () => form.timingMode,
  (value) => {
    const mode = String(value || '').toUpperCase()

    if (mode === 'AFTER_SHIFT_END') {
      form.fixedStartTime = ''
      form.fixedEndTime = ''
    }

    if (mode === 'FIXED_TIME') {
      form.startAfterShiftEndMinutes = 0

      if (isValidHHmm(form.fixedStartTime) && isValidHHmm(form.fixedEndTime)) {
        form.requestedMinutes = durationBetweenTimes(form.fixedStartTime, form.fixedEndTime)
      }
    }
  },
)

watch(
  () => [form.fixedStartTime, form.fixedEndTime, form.timingMode],
  () => {
    if (form.timingMode !== 'FIXED_TIME') return
    if (!isValidHHmm(form.fixedStartTime) || !isValidHHmm(form.fixedEndTime)) return

    form.requestedMinutes = durationBetweenTimes(form.fixedStartTime, form.fixedEndTime)
  },
)

onMounted(async () => {
  await fetchLookups()
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Shift OT Options
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Manage OT options per shift, including delayed post-shift OT and fixed-time Sunday/Holiday OT.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Total
          </div>
          <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
            {{ totalOptions }}
          </div>
        </div>

        <Button
          v-if="canCreateShiftOTOption"
          label="New Shift OT Option"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>
    </div>

    <div
      v-if="!canViewShiftOTOption"
      class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
    >
      You do not have permission to view shift OT options.
    </div>

    <div
      v-else
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[270px] xl:shrink-0">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filters.search"
              placeholder="Search option label"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[230px] xl:shrink-0">
            <Select
              v-model="filters.shiftId"
              :options="filterShiftOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Shift"
              class="w-full"
              size="small"
              filter
              @change="onShiftChange"
            />
          </div>

          <div class="w-full xl:w-[245px] xl:shrink-0">
            <Select
              v-model="filters.calculationPolicyId"
              :options="filterPolicyOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Calculation Policy"
              class="w-full"
              size="small"
              filter
              @change="onPolicyChange"
            />
          </div>

          <div class="w-full xl:w-[185px] xl:shrink-0">
            <Select
              v-model="filters.timingMode"
              :options="timingModeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Timing Mode"
              class="w-full"
              size="small"
              @change="onTimingModeFilterChange"
            />
          </div>

          <div class="w-full xl:w-[145px] xl:shrink-0">
            <Select
              v-model="filters.isActive"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
              size="small"
              @change="onStatusChange"
            />
          </div>

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
              Loaded {{ summaryText }}
            </div>

            <Button
              label="Clear"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />
          </div>
        </div>
      </div>

      <DataTable
        :value="rows"
        lazy
        removableSort
        scrollable
        scrollHeight="500px"
        :sortField="filters.sortField"
        :sortOrder="filters.sortOrder"
        tableStyle="min-width: 118rem"
        class="shift-ot-option-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 76,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
        @sort="onSort"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No shift OT options found.
          </div>
        </template>

        <Column header="Shift" style="min-width: 18rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-col">
              <span class="font-medium text-[color:var(--ot-text)]">
                {{ shiftLabel(data) }}
              </span>
              <span class="text-xs text-[color:var(--ot-text-muted)]">
                {{ shiftSubLabel(data) }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="label" header="Option Label" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data" class="font-medium text-[color:var(--ot-text)]">
              {{ data.label || '-' }}
            </span>
          </template>
        </Column>

        <Column field="timingMode" header="Timing Mode" sortable style="min-width: 11rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="timingModeLabel(data.timingMode)"
              :severity="timingModeSeverity(data.timingMode)"
              class="shift-ot-tag"
            />
          </template>
        </Column>

        <Column header="OT Window" style="min-width: 14rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-col">
              <span class="font-semibold text-[color:var(--ot-text)]">
                {{ optionTimeWindow(data) }}
              </span>
              <span class="text-xs text-[color:var(--ot-text-muted)]">
                {{ optionTimingSubLabel(data) }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="requestedMinutes" header="Requested" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="formatMinutesLabel(data.requestedMinutes)"
              severity="info"
              class="shift-ot-tag"
            />
          </template>
        </Column>

        <Column header="Calculation Policy" style="min-width: 22rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-col">
              <span class="font-medium text-[color:var(--ot-text)]">
                {{ policyLabel(data) }}
              </span>
              <span class="text-xs text-[color:var(--ot-text-muted)]">
                {{ policySubLabel(data) }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="sequence" header="Sequence" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <span v-if="data">{{ Number(data.sequence || 0) }}</span>
          </template>
        </Column>

        <Column field="isActive" header="Status" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.isActive ? 'Active' : 'Inactive'"
              :severity="activeSeverity(data.isActive)"
              class="shift-ot-tag"
            />
          </template>
        </Column>

        <Column field="createdAt" header="Created At" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>

        <Column header="Actions" style="width: 7rem; min-width: 7rem">
          <template #body="{ data }">
            <Button
              v-if="data && canUpdateShiftOTOption"
              label="Edit"
              icon="pi pi-pencil"
              size="small"
              outlined
              @click="openEditDialog(data)"
            />
          </template>
        </Column>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </div>

    <Dialog
      v-model:visible="optionDialogVisible"
      modal
      :closable="!saving"
      :header="isEditMode ? 'Edit Shift OT Option' : 'Create Shift OT Option'"
      :style="{ width: '70rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Shift
            </label>
            <Select
              v-model="form.shiftId"
              :options="shiftSelectOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              filter
              placeholder="Select shift"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Option Label
            </label>
            <InputText
              v-model="form.label"
              class="w-full"
              placeholder="Evening OT 18:00 - 20:00"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Timing Mode
            </label>
            <Select
              v-model="form.timingMode"
              :options="formTimingModeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              placeholder="Select timing mode"
            />
          </div>

          <div
            v-if="isAfterShiftEndMode"
            class="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">
                Start After Shift End Minutes
              </label>
              <InputNumber
                v-model="form.startAfterShiftEndMinutes"
                inputClass="w-full"
                class="w-full"
                :min="0"
                :useGrouping="false"
              />
              <p class="text-xs text-[color:var(--ot-text-muted)]">
                Example: shift end 16:00 + 120 min = OT starts 18:00.
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">
                Requested Minutes
              </label>
              <InputNumber
                v-model="form.requestedMinutes"
                inputClass="w-full"
                class="w-full"
                :min="1"
                :useGrouping="false"
              />
            </div>
          </div>

          <div
            v-if="isFixedTimeMode"
            class="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">
                Fixed Start Time
              </label>
              <InputText
                v-model="form.fixedStartTime"
                class="w-full"
                placeholder="08:00"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">
                Fixed End Time
              </label>
              <InputText
                v-model="form.fixedEndTime"
                class="w-full"
                placeholder="17:00"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">
                Requested Minutes
              </label>
              <InputNumber
                v-model="form.requestedMinutes"
                inputClass="w-full"
                class="w-full"
                :min="1"
                :useGrouping="false"
              />
              <p class="text-xs text-[color:var(--ot-text-muted)]">
                Auto-calculated from fixed time.
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Calculation Policy
            </label>
            <Select
              v-model="form.calculationPolicyId"
              :options="policySelectOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              filter
              placeholder="Select policy"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">
              Sequence
            </label>
            <InputNumber
              v-model="form.sequence"
              inputClass="w-full"
              class="w-full"
              :min="1"
              :useGrouping="false"
            />
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4">
            <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
              Preview
            </div>

            <div class="grid grid-cols-1 gap-2 text-sm text-[color:var(--ot-text-muted)]">
              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Shift:</span>
                {{ selectedShiftOption?.label || '-' }}
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Shift Time:</span>
                {{ selectedShiftOption?.startTime || '-' }} - {{ selectedShiftOption?.endTime || '-' }}
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Timing Mode:</span>
                {{ timingModeLabel(form.timingMode) }}
              </div>

              <div v-if="isAfterShiftEndMode">
                <span class="font-medium text-[color:var(--ot-text)]">Start Offset:</span>
                {{ Number(form.startAfterShiftEndMinutes || 0) }} minutes after shift end
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">OT Window:</span>
                {{ previewWindow.start || '-' }} - {{ previewWindow.end || '-' }}
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Requested:</span>
                {{ Number(form.requestedMinutes || 0) }} min
                <span class="ml-1">
                  ({{ formatMinutesLabel(form.requestedMinutes) }})
                </span>
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Policy:</span>
                {{ selectedPolicyOption?.label || '-' }}
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Status:</span>
                {{ form.isActive ? 'Active' : 'Inactive' }}
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
            <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
              Recommended Setup
            </div>

            <div class="space-y-3 text-sm text-[color:var(--ot-text-muted)]">
              <div class="rounded-xl border border-[color:var(--ot-border)] px-3 py-2">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  Working Day: 18:00 - 20:00
                </div>
                <div class="mt-1">
                  Timing Mode = After Shift End, Start Offset = 120, Requested = 120.
                </div>
              </div>

              <div class="rounded-xl border border-[color:var(--ot-border)] px-3 py-2">
                <div class="font-semibold text-[color:var(--ot-text)]">
                  Sunday/Holiday: 08:00 - 17:00
                </div>
                <div class="mt-1">
                  Timing Mode = Fixed Time, Fixed Start = 08:00, Fixed End = 17:00.
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
            <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
              Flags
            </div>

            <label class="shift-ot-check-item">
              <Checkbox
                v-model="form.isActive"
                binary
              />
              <span>Active</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            :disabled="saving"
            @click="optionDialogVisible = false"
          />
          <Button
            v-if="canSaveDialog"
            :label="isEditMode ? 'Save Changes' : 'Create Option'"
            :icon="isEditMode ? 'pi pi-save' : 'pi pi-plus'"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitOption"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.shift-ot-option-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.shift-ot-option-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  height: 76px !important;
  vertical-align: middle !important;
}

:deep(.shift-ot-option-table .p-tag.shift-ot-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

.shift-ot-check-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  border-radius: 0.9rem;
  padding: 0.75rem 0.9rem;
  color: var(--ot-text);
  font-size: 0.92rem;
}
</style>