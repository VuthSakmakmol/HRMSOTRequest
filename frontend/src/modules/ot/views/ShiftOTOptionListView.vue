<!-- frontend/src/modules/ot/views/ShiftOTOptionListView.vue -->
<script setup>
// frontend/src/modules/ot/views/ShiftOTOptionListView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'
import { getShiftLookupOptions } from '@/modules/shift/shift.api'
import {
  createShiftOTOption,
  getOTCalculationPolicyLookupOptions,
  getShiftOTOptions,
  updateShiftOTOption,
} from '@/modules/ot/otMaster.api'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const LOOKUP_LIMIT = 100

const saving = ref(false)
const loadingShifts = ref(false)
const loadingPolicies = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const shiftOptions = ref([])
const policyOptions = ref([])

const optionDialogVisible = ref(false)
const editingOptionId = ref('')

const filters = reactive({
  search: '',
  shiftId: '',
  calculationPolicyId: '',
  timingMode: '',
  dayType: '',
  isActive: '',
  sortField: 'sequence',
  sortOrder: 1,
})

const form = reactive({
  shiftId: '',
  label: '',
  timingMode: 'AFTER_SHIFT_END',
  applicableDayTypes: ['WORKING_DAY'],
  startAfterShiftEndMinutes: 0,
  fixedStartTime: '',
  fixedEndTime: '',
  requestedMinutes: 120,
  calculationPolicyId: '',
  sequence: 1,
  isActive: true,
})

const canView = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission?.(['SHIFT_OT_OPTION_VIEW']),
)

const canCreate = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission?.(['SHIFT_OT_OPTION_CREATE']),
)

const canUpdate = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission?.(['SHIFT_OT_OPTION_UPDATE']),
)

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const timingModeOptions = computed(() => [
  { label: t('ot.shiftOption.allTimingModes'), value: '' },
  { label: t('ot.shiftOption.timing.afterShiftEnd'), value: 'AFTER_SHIFT_END' },
  { label: t('ot.shiftOption.timing.fixedTime'), value: 'FIXED_TIME' },
])

const formTimingModeOptions = computed(() => [
  { label: t('ot.shiftOption.timing.afterShiftEnd'), value: 'AFTER_SHIFT_END' },
  { label: t('ot.shiftOption.timing.fixedTime'), value: 'FIXED_TIME' },
])

const dayTypeOptions = computed(() => [
  { label: t('ot.shiftOption.allDayTypes'), value: '' },
  { label: t('ot.dayType.workingDay'), value: 'WORKING_DAY' },
  { label: t('ot.dayType.sunday'), value: 'SUNDAY' },
  { label: t('ot.dayType.holiday'), value: 'HOLIDAY' },
])

const formDayTypeOptions = computed(() => [
  { label: t('ot.dayType.workingDay'), value: 'WORKING_DAY' },
  { label: t('ot.dayType.sunday'), value: 'SUNDAY' },
  { label: t('ot.dayType.holiday'), value: 'HOLIDAY' },
])

const filterShiftOptions = computed(() => [
  { label: t('ot.shiftOption.allShifts'), value: '' },
  ...shiftOptions.value,
])

const filterPolicyOptions = computed(() => [
  { label: t('ot.shiftOption.allPolicies'), value: '' },
  ...policyOptions.value,
])

const isEditMode = computed(() => Boolean(editingOptionId.value))
const isFixedTimeMode = computed(() => form.timingMode === 'FIXED_TIME')
const isAfterShiftEndMode = computed(() => form.timingMode === 'AFTER_SHIFT_END')

const totalOptions = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalOptions.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalOptions.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('ot.shiftOption.editTitle') : t('ot.shiftOption.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('common.create'),
)

const isSaveDisabled = computed(() => {
  if (saving.value) return true
  if (isEditMode.value && !canUpdate.value) return true
  if (!isEditMode.value && !canCreate.value) return true

  if (!String(form.shiftId || '').trim()) return true
  if (!String(form.label || '').trim()) return true
  if (!String(form.timingMode || '').trim()) return true

  if (!Array.isArray(form.applicableDayTypes) || !form.applicableDayTypes.length) {
    return true
  }

  if (!String(form.calculationPolicyId || '').trim()) return true
  if (Number(form.requestedMinutes || 0) < 1) return true
  if (Number(form.sequence || 0) < 1) return true

  if (isAfterShiftEndMode.value && Number(form.startAfterShiftEndMinutes || 0) < 0) {
    return true
  }

  if (isFixedTimeMode.value) {
    return !isHHmm(form.fixedStartTime) || !isHHmm(form.fixedEndTime)
  }

  return false
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function normalizeId(row) {
  return String(row?.id || row?._id || row?.shiftOtOptionId || '').trim()
}

function buildLabel(...parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' - ')
}

function upper(value) {
  return String(value || '').trim().toUpperCase()
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function mapLookupOptions(items = []) {
  return items
    .map((item) => {
      const value = normalizeId(item) || String(item?.value || '').trim()
      const label =
        item?.label ||
        item?.optionLabel ||
        buildLabel(item?.code, item?.name) ||
        buildLabel(item?.shiftCode, item?.shiftName)

      if (!value || !label) return null

      return {
        ...item,
        value,
        label,
      }
    })
    .filter(Boolean)
}

function mapPolicyLookupOptions(items = []) {
  return items
    .map((item) => {
      const value = normalizeId(item) || String(item?.value || '').trim()
      const code = String(item?.code || item?.policyCode || '').trim()
      const label = code || String(item?.label || '').trim()

      if (!value || !label) return null

      return {
        ...item,
        value,
        label,
      }
    })
    .filter(Boolean)
}

function normalizeApplicableDayTypes(value) {
  const source = Array.isArray(value) ? value : []
  const valid = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

  const normalized = Array.from(
    new Set(
      source
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item) => valid.includes(item)),
    ),
  )

  return normalized.length ? normalized : ['WORKING_DAY']
}

function isHHmm(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim())
}

function activeLabel(row) {
  if (row?.statusKey) return t(row.statusKey)

  return row?.isActive === false ? t('common.inactive') : t('common.active')
}

function activeTagClass(value) {
  return [
    'shift-option-rgb-tag',
    value === false ? 'shift-option-tag-inactive' : 'shift-option-tag-active',
  ]
}

function timingModeLabel(value) {
  const mode = upper(value)

  if (mode === 'FIXED_TIME') return t('ot.shiftOption.timing.fixedTime')
  return t('ot.shiftOption.timing.afterShiftEnd')
}

function timingModeTagClass(value) {
  const mode = upper(value)

  return [
    'shift-option-rgb-tag',
    mode === 'FIXED_TIME' ? 'shift-option-tag-info' : 'shift-option-tag-muted',
  ]
}

function dayTypeLabel(value) {
  const dayType = upper(value)

  if (dayType === 'SUNDAY') return t('ot.dayType.sunday')
  if (dayType === 'HOLIDAY') return t('ot.dayType.holiday')

  return t('ot.dayType.workingDay')
}

function dayTypeTagClass(value) {
  const dayType = upper(value)

  if (dayType === 'HOLIDAY') return ['shift-option-rgb-tag', 'shift-option-tag-holiday']
  if (dayType === 'SUNDAY') return ['shift-option-rgb-tag', 'shift-option-tag-sunday']

  return ['shift-option-rgb-tag', 'shift-option-tag-working']
}

function infoTagClass() {
  return ['shift-option-rgb-tag', 'shift-option-tag-info']
}

function paidTagClass() {
  return ['shift-option-rgb-tag', 'shift-option-tag-active']
}

function minutesLabel(value) {
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

function shiftLabel(row) {
  const shift = row?.shift || {}

  return (
    row?.shiftLabel ||
    shift?.label ||
    buildLabel(row?.shiftCode, row?.shiftName) ||
    buildLabel(shift?.code, shift?.name) ||
    '-'
  )
}

function policyLabel(row) {
  const policy = row?.calculationPolicy || row?.policy || {}

  return (
    row?.calculationPolicyLabel ||
    row?.policyLabel ||
    policy?.label ||
    buildLabel(row?.calculationPolicyCode, row?.calculationPolicyName) ||
    buildLabel(policy?.code, policy?.name) ||
    '-'
  )
}

function policySubLabel(row) {
  const policy = row?.calculationPolicy || row?.policy || {}

  const roundMethod = row?.roundMethod || policy?.roundMethod || ''
  const roundUnit = row?.roundUnitMinutes || policy?.roundUnitMinutes || ''
  const minEligible = row?.minEligibleMinutes || policy?.minEligibleMinutes || ''

  const parts = []

  if (roundMethod) parts.push(roundMethod)

  if (roundUnit) {
    parts.push(
      t('ot.shiftOption.roundEvery', {
        unit: minutesLabel(roundUnit),
      }),
    )
  }

  if (minEligible) {
    parts.push(
      t('ot.shiftOption.minEligibleValue', {
        value: minutesLabel(minEligible),
      }),
    )
  }

  return parts.join(' · ') || '-'
}

function optionTimeWindow(row) {
  const start =
    row?.requestStartTime ||
    row?.startTime ||
    row?.fixedStartTime ||
    row?.preview?.requestStartTime ||
    ''

  const end =
    row?.requestEndTime ||
    row?.endTime ||
    row?.fixedEndTime ||
    row?.preview?.requestEndTime ||
    ''

  if (!start && !end) return '-'

  return [start, end].filter(Boolean).join(' - ')
}

function optionTimingSubLabel(row) {
  const timingMode = timingModeLabel(row?.timingMode)
  const offset = Number(row?.startAfterShiftEndMinutes || 0)

  if (upper(row?.timingMode) === 'AFTER_SHIFT_END') {
    return offset > 0
      ? t('ot.shiftOption.afterShiftOffset', {
          offset: minutesLabel(offset),
        })
      : timingMode
  }

  return timingMode
}

function rowRequestedMinutes(row) {
  return Number(
    row?.requestedMinutes ||
      row?.preview?.requestedMinutes ||
      row?.grossMinutes ||
      0,
  )
}

function rowBreakMinutes(row) {
  return Number(row?.breakMinutes || row?.preview?.breakMinutes || 0)
}

function rowPaidMinutes(row) {
  return Number(
    row?.totalRequestPaidMinutes ||
      row?.preview?.totalRequestPaidMinutes ||
      row?.paidMinutes ||
      row?.requestedMinutes ||
      0,
  )
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    shiftId: filters.shiftId,
    calculationPolicyId: filters.calculationPolicyId,
    timingMode: filters.timingMode,
    dayType: filters.dayType,
    isActive: filters.isActive,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

async function fetchShiftLookup() {
  loadingShifts.value = true

  try {
    const res = await getShiftLookupOptions({
      page: 1,
      limit: LOOKUP_LIMIT,
      search: '',
      isActive: true,
    })

    shiftOptions.value = mapLookupOptions(normalizeItems(normalizePayload(res)))
  } catch (error) {
    shiftOptions.value = []

    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('ot.shiftOption.shiftLookupFailed')),
    )
  } finally {
    loadingShifts.value = false
  }
}

async function fetchPolicyLookup() {
  loadingPolicies.value = true

  try {
    const res = await getOTCalculationPolicyLookupOptions({
      page: 1,
      limit: LOOKUP_LIMIT,
      search: '',
      isActive: true,
    })

    policyOptions.value = mapPolicyLookupOptions(normalizeItems(normalizePayload(res)))
  } catch (error) {
    policyOptions.value = []

    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('ot.shiftOption.policyLookupFailed')),
    )
  } finally {
    loadingPolicies.value = false
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!canView.value) {
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
    const total = normalizeTotal(payload)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const nextRows = [...rows.value]

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    bootstrapped.value = true

    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('ot.shiftOption.loadFailed')),
    )
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
    bootstrapped.value = false
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

function onFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.shiftId = ''
  filters.calculationPolicyId = ''
  filters.timingMode = ''
  filters.dayType = ''
  filters.isActive = ''
  filters.sortField = 'sequence'
  filters.sortOrder = 1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortField = event.sortField || 'sequence'
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
  form.applicableDayTypes = ['WORKING_DAY']
  form.startAfterShiftEndMinutes = 0
  form.fixedStartTime = ''
  form.fixedEndTime = ''
  form.requestedMinutes = 120
  form.calculationPolicyId = ''
  form.sequence = 1
  form.isActive = true
}

function openCreateDialog() {
  resetForm()
  optionDialogVisible.value = true
}

function openEditDialog(row) {
  if (!row) return

  editingOptionId.value = normalizeId(row)

  form.shiftId = String(row.shiftId || row.shift?.id || row.shift?._id || '').trim()
  form.label = String(row.label || '').trim()
  form.timingMode = upper(row.timingMode || 'AFTER_SHIFT_END')
  form.applicableDayTypes = normalizeApplicableDayTypes(row.applicableDayTypes)
  form.startAfterShiftEndMinutes = Number(row.startAfterShiftEndMinutes || 0)
  form.fixedStartTime = String(row.fixedStartTime || '').trim()
  form.fixedEndTime = String(row.fixedEndTime || '').trim()
  form.requestedMinutes = Number(row.requestedMinutes || 0)

  form.calculationPolicyId = String(
    row.calculationPolicyId ||
      row.calculationPolicy?.id ||
      row.calculationPolicy?._id ||
      '',
  ).trim()

  form.sequence = Number(row.sequence || 1)
  form.isActive = row.isActive !== false

  optionDialogVisible.value = true
}

function buildPayload() {
  const payload = {
    shiftId: String(form.shiftId || '').trim(),
    label: String(form.label || '').trim(),
    timingMode: upper(form.timingMode || 'AFTER_SHIFT_END'),
    applicableDayTypes: normalizeApplicableDayTypes(form.applicableDayTypes),
    startAfterShiftEndMinutes: Number(form.startAfterShiftEndMinutes || 0),
    fixedStartTime: String(form.fixedStartTime || '').trim(),
    fixedEndTime: String(form.fixedEndTime || '').trim(),
    requestedMinutes: Number(form.requestedMinutes || 0),
    calculationPolicyId: String(form.calculationPolicyId || '').trim(),
    sequence: Number(form.sequence || 1),
    isActive: form.isActive === true,
  }

  if (payload.timingMode === 'AFTER_SHIFT_END') {
    payload.fixedStartTime = ''
    payload.fixedEndTime = ''
  }

  if (payload.timingMode === 'FIXED_TIME') {
    payload.startAfterShiftEndMinutes = 0
  }

  return payload
}

function validateForm() {
  if (!String(form.shiftId || '').trim()) return t('ot.shiftOption.validation.shiftRequired')
  if (!String(form.label || '').trim()) return t('ot.shiftOption.validation.labelRequired')

  if (!String(form.timingMode || '').trim()) {
    return t('ot.shiftOption.validation.timingModeRequired')
  }

  if (!Array.isArray(form.applicableDayTypes) || !form.applicableDayTypes.length) {
    return t('ot.shiftOption.validation.dayTypesRequired')
  }

  if (!String(form.calculationPolicyId || '').trim()) {
    return t('ot.shiftOption.validation.policyRequired')
  }

  if (Number(form.requestedMinutes || 0) < 1) {
    return t('ot.shiftOption.validation.requestedMinutesInvalid')
  }

  if (Number(form.sequence || 0) < 1) {
    return t('ot.shiftOption.validation.sequenceInvalid')
  }

  if (isAfterShiftEndMode.value && Number(form.startAfterShiftEndMinutes || 0) < 0) {
    return t('ot.shiftOption.validation.startAfterShiftEndInvalid')
  }

  if (isFixedTimeMode.value) {
    if (!isHHmm(form.fixedStartTime)) {
      return t('ot.shiftOption.validation.fixedStartTimeInvalid')
    }

    if (!isHHmm(form.fixedEndTime)) {
      return t('ot.shiftOption.validation.fixedEndTimeInvalid')
    }

    if (form.fixedStartTime === form.fixedEndTime) {
      return t('ot.shiftOption.validation.fixedTimeSame')
    }
  }

  return ''
}

async function submitOption() {
  const validationMessage = validateForm()

  if (validationMessage) {
    showToast('warn', t('common.warning'), validationMessage, 2500)
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()

    if (editingOptionId.value) {
      await updateShiftOTOption(editingOptionId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        t('ot.shiftOption.updatedSuccess'),
        2500,
      )
    } else {
      await createShiftOTOption(payload)

      showToast(
        'success',
        t('common.created'),
        t('ot.shiftOption.createdSuccess'),
        2500,
      )
    }

    optionDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      editingOptionId.value ? t('common.updateFailed') : t('common.createFailed'),
      getApiErrorMessage(error, t('ot.shiftOption.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchShiftLookup(), fetchPolicyLookup()])
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell shift-option-page">
    <section class="ot-filter-bar shift-option-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('ot.shiftOption.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('nav.shift') }}
        </label>

        <Select
          v-model="filters.shiftId"
          :options="filterShiftOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          filter
          :loading="loadingShifts"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('ot.shiftOption.policy') }}
        </label>

        <Select
          v-model="filters.calculationPolicyId"
          :options="filterPolicyOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          filter
          :loading="loadingPolicies"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('ot.shiftOption.timingMode') }}
        </label>

        <Select
          v-model="filters.timingMode"
          :options="timingModeOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('ot.shiftOption.dayType') }}
        </label>

        <Select
          v-model="filters.dayType"
          :options="dayTypeOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.status') }}
        </label>

        <Select
          v-model="filters.isActive"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="shift-option-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="shift-option-action-button"
          @click="clearFilters"
        />

        <Button
          v-if="canCreate"
          :label="t('ot.shiftOption.newOption')"
          icon="pi pi-plus"
          size="small"
          class="shift-option-action-button"
          @click="openCreateDialog"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('ot.shiftOption.tableTitle') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ t('common.updating') }}
          </span>

          <Button
            :label="t('common.refresh')"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            size="small"
            class="shift-option-action-button"
            :loading="backgroundLoading && bootstrapped"
            @click="reloadFirstPage({ keepVisible: true })"
          />
        </div>
      </div>

      <div
        v-if="!canView"
        class="ot-empty-state"
      >
        <div class="ot-empty-icon">
          <i class="pi pi-lock" />
        </div>

        <div class="ot-empty-title">
          {{ t('auth.accessDenied') }}
        </div>

        <div class="ot-empty-text">
          {{ t('common.noPermission') }}
        </div>
      </div>

      <div
        v-else
        class="ot-table-wrapper"
      >
        <AppTableLoading
          v-if="isFirstLoading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="7"
          :columns="12"
          icon="pi pi-clock"
        />

        <DataTable
          v-else
          :value="rows"
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortField"
          :sort-order="filters.sortOrder"
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
          class="shift-option-table ot-data-table ot-data-table-compact"
          :virtual-scroller-options="useVirtualScroll ? {
            lazy: true,
            onLazyLoad: onVirtualLazyLoad,
            itemSize: 72,
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
              class="ot-empty-state"
            >
              <div class="ot-empty-icon">
                <i class="pi pi-clock" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('ot.shiftOption.noData') }}
              </div>
            </div>
          </template>

          <Column
            :header="t('nav.shift')"
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-semibold text-[color:var(--ot-text)]"
              >
                {{ shiftLabel(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="label"
            :header="t('ot.shiftOption.optionLabel')"
            sortable
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-semibold text-[color:var(--ot-text)]"
              >
                {{ data.label || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('ot.shiftOption.dayType')"
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="shift-option-tag-row"
              >
                <Tag
                  v-for="type in normalizeApplicableDayTypes(data.applicableDayTypes)"
                  :key="type"
                  :value="dayTypeLabel(type)"
                  :class="dayTypeTagClass(type)"
                />
              </div>
            </template>
          </Column>

          <Column
            field="timingMode"
            :header="t('ot.shiftOption.timingMode')"
            sortable
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="timingModeLabel(data.timingMode)"
                :class="timingModeTagClass(data.timingMode)"
              />
            </template>
          </Column>

          <Column
            :header="t('ot.shiftOption.otWindow')"
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="shift-option-stack-cell"
              >
                <span class="font-semibold text-[color:var(--ot-text)]">
                  {{ optionTimeWindow(data) }}
                </span>

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ optionTimingSubLabel(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('ot.shiftOption.requested')"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="minutesLabel(rowRequestedMinutes(data))"
                :class="infoTagClass()"
              />
            </template>
          </Column>

          <Column
            :header="t('ot.shiftOption.break')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-medium"
              >
                {{ minutesLabel(rowBreakMinutes(data)) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('ot.shiftOption.paid')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="minutesLabel(rowPaidMinutes(data))"
                :class="paidTagClass()"
              />
            </template>
          </Column>

          <Column
            :header="t('ot.shiftOption.policy')"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="shift-option-stack-cell"
              >
                <span class="font-semibold text-[color:var(--ot-text)]">
                  {{ policyLabel(data) }}
                </span>

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ policySubLabel(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="sequence"
            :header="t('ot.shiftOption.sequence')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span v-if="data">
                {{ Number(data.sequence || 0) }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="activeLabel(data)"
                :class="activeTagClass(data.isActive)"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="text-sm text-[color:var(--ot-text-muted)]"
              >
                {{ formatDateTime(data.createdAt) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('common.actions')"
            frozen
            align-frozen="right"
            style="width: 7rem; min-width: 7rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data && canUpdate"
                :label="t('common.edit')"
                icon="pi pi-pencil"
                size="small"
                outlined
                class="shift-option-action-button"
                @click="openEditDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="optionDialogVisible"
      modal
      :closable="!saving"
      :header="dialogTitle"
      :style="{ width: '76rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="shift-option-dialog-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.shift') }}
            </label>

            <Select
              v-model="form.shiftId"
              :options="shiftOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('ot.shiftOption.selectShift')"
              class="w-full"
              filter
              :loading="loadingShifts"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.shiftOption.policy') }}
            </label>

            <Select
              v-model="form.calculationPolicyId"
              :options="policyOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('ot.shiftOption.selectPolicy')"
              class="w-full"
              filter
              :loading="loadingPolicies"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.shiftOption.optionLabel') }}
            </label>

            <InputText
              v-model="form.label"
              class="w-full"
              :placeholder="t('ot.shiftOption.labelPlaceholder')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.shiftOption.timingMode') }}
            </label>

            <Select
              v-model="form.timingMode"
              :options="formTimingModeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.shiftOption.applicableDayTypes') }}
            </label>

            <MultiSelect
              v-model="form.applicableDayTypes"
              :options="formDayTypeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              display="chip"
              :placeholder="t('ot.shiftOption.selectDayTypes')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.shiftOption.sequence') }}
            </label>

            <InputNumber
              v-model="form.sequence"
              class="w-full"
              input-class="w-full"
              :min="1"
              :use-grouping="false"
            />
          </div>

          <div
            v-if="isAfterShiftEndMode"
            class="ot-field"
          >
            <label class="ot-field-label">
              {{ t('ot.shiftOption.startAfterShiftEnd') }}
            </label>

            <InputNumber
              v-model="form.startAfterShiftEndMinutes"
              class="w-full"
              input-class="w-full"
              :min="0"
              :use-grouping="false"
              :suffix="` ${t('ot.common.min')}`"
            />
          </div>

          <div
            v-if="isFixedTimeMode"
            class="ot-field"
          >
            <label class="ot-field-label">
              {{ t('ot.shiftOption.fixedStartTime') }}
            </label>

            <InputText
              v-model="form.fixedStartTime"
              class="w-full"
              placeholder="18:00"
            />
          </div>

          <div
            v-if="isFixedTimeMode"
            class="ot-field"
          >
            <label class="ot-field-label">
              {{ t('ot.shiftOption.fixedEndTime') }}
            </label>

            <InputText
              v-model="form.fixedEndTime"
              class="w-full"
              placeholder="20:00"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.shiftOption.requestedMinutes') }}
            </label>

            <InputNumber
              v-model="form.requestedMinutes"
              class="w-full"
              input-class="w-full"
              :min="1"
              :use-grouping="false"
              :suffix="` ${t('ot.common.min')}`"
            />
          </div>

          <label class="shift-option-active-card">
            <Checkbox
              v-model="form.isActive"
              binary
            />

            <span class="grid gap-0.5">
              <span class="text-sm font-semibold text-[color:var(--ot-text)]">
                {{ t('common.active') }}
              </span>

              <span class="text-xs text-[color:var(--ot-text-muted)]">
                {{ t('ot.shiftOption.activeHelp') }}
              </span>
            </span>
          </label>
        </div>

        <p
          v-if="isAfterShiftEndMode"
          class="ot-field-help"
        >
          {{ t('ot.shiftOption.startAfterShiftEndHelp') }}
        </p>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            :disabled="saving"
            @click="optionDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            icon="pi pi-check"
            size="small"
            :loading="saving"
            :disabled="isSaveDisabled"
            @click="submitOption"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.shift-option-page {
  --shift-option-active-rgb: 34 197 94;
  --shift-option-inactive-rgb: 100 116 139;
  --shift-option-info-rgb: 59 130 246;
  --shift-option-warning-rgb: 245 158 11;
  --shift-option-danger-rgb: 239 68 68;
  --shift-option-working-rgb: 34 197 94;
  --shift-option-sunday-rgb: 245 158 11;
  --shift-option-holiday-rgb: 239 68 68;
}

.shift-option-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.shift-option-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.shift-option-filter-actions > * {
  flex: 0 0 auto;
}

.shift-option-tag-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
}

.shift-option-stack-cell {
  display: flex;
  min-width: max-content;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

:deep(.shift-option-rgb-tag) {
  --shift-option-tag-rgb: var(--shift-option-inactive-rgb);
  min-height: 1.42rem;
  border: 1px solid rgb(var(--shift-option-tag-rgb) / 0.28);
  background: rgb(var(--shift-option-tag-rgb) / 0.11);
  color: rgb(var(--shift-option-tag-rgb) / 1);
  padding: 0.12rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  border-radius: 999px;
  white-space: nowrap;
}

:deep(.shift-option-tag-active) {
  --shift-option-tag-rgb: var(--shift-option-active-rgb);
}

:deep(.shift-option-tag-inactive) {
  --shift-option-tag-rgb: var(--shift-option-inactive-rgb);
}

:deep(.shift-option-tag-info) {
  --shift-option-tag-rgb: var(--shift-option-info-rgb);
}

:deep(.shift-option-tag-muted) {
  --shift-option-tag-rgb: var(--shift-option-inactive-rgb);
}

:deep(.shift-option-tag-working) {
  --shift-option-tag-rgb: var(--shift-option-working-rgb);
}

:deep(.shift-option-tag-sunday) {
  --shift-option-tag-rgb: var(--shift-option-sunday-rgb);
}

:deep(.shift-option-tag-holiday) {
  --shift-option-tag-rgb: var(--shift-option-holiday-rgb);
}

:deep(.shift-option-action-button .p-button-icon) {
  font-size: 0.76rem;
}

:deep(.shift-option-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.shift-option-table .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  text-align: center !important;
  vertical-align: middle !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.shift-option-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  text-align: center !important;
  font-size: 0.8rem !important;
}

:deep(.shift-option-table .p-column-header-content) {
  justify-content: center !important;
  text-align: center !important;
}

:deep(.shift-option-table .p-datatable-tbody > tr > td > *) {
  margin-left: auto !important;
  margin-right: auto !important;
}

.shift-option-dialog-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}

.shift-option-active-card {
  display: flex;
  min-height: 4.55rem;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  background: var(--ot-bg);
  padding: 0.75rem 0.85rem;
  cursor: pointer;
}

@media (max-width: 768px) {
  .shift-option-filter-actions {
    justify-content: stretch;
  }

  .shift-option-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 768px) {
  .shift-option-dialog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .shift-option-filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .shift-option-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .shift-option-filter-bar {
    grid-template-columns:
      minmax(240px, 1.15fr)
      minmax(180px, 0.85fr)
      minmax(180px, 0.85fr)
      minmax(170px, 0.8fr)
      minmax(160px, 0.75fr)
      minmax(150px, 0.7fr);
  }

  .shift-option-dialog-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>