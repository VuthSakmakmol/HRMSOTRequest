<!-- frontend/src/modules/ot/views/OTCalculationPolicyListView.vue -->
<script setup>
import { computed, h, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import { useAuthStore } from '@/modules/auth/auth.store'
import {
  createOTCalculationPolicy,
  getOTCalculationPolicies,
  updateOTCalculationPolicy,
} from '@/modules/ot/otMaster.api'

const toast = useToast()
const auth = useAuthStore()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const policyDialogVisible = ref(false)
const editingPolicyId = ref('')

const filters = reactive({
  search: '',
  isActive: '',
  roundMethod: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  code: '',
  name: '',
  description: '',
  minEligibleMinutes: 0,
  roundUnitMinutes: 30,
  roundMethod: 'CEIL',
  graceAfterShiftEndMinutes: 0,
  allowPreShiftOT: false,
  allowPostShiftOT: true,
  capByRequestedMinutes: true,
  treatForgetScanInAsPending: true,
  treatForgetScanOutAsPending: true,
  allowApprovedOtWithoutExactClockOut: false,
  isActive: true,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const roundMethodOptions = [
  { label: 'All Methods', value: '' },
  { label: 'Floor', value: 'FLOOR' },
  { label: 'Ceil', value: 'CEIL' },
  { label: 'Nearest', value: 'NEAREST' },
]

const formRoundMethodOptions = [
  { label: 'Floor', value: 'FLOOR' },
  { label: 'Ceil', value: 'CEIL' },
  { label: 'Nearest', value: 'NEAREST' },
]

const policyFieldInfo = {
  code: {
    label: 'Code',
    meaning: 'Unique policy code used by the system and admins.',
    example:
      'POST_SHIFT_STD_30M_CEIL means post-shift OT, standard rule, 30-minute rounding, round up.',
    recommendation:
      'Use clear uppercase code names so admins can understand the rule later.',
  },
  name: {
    label: 'Name',
    meaning: 'Human-readable policy name shown to users and admins.',
    example: 'Post Shift Standard 30-Minute Ceiling.',
    recommendation:
      'Use a simple business name that managers can understand.',
  },
  description: {
    label: 'Description',
    meaning: 'Optional explanation of what this policy is used for.',
    example:
      'Used for normal post-shift OT. Actual OT is rounded up by 30 minutes and capped by requested minutes.',
    recommendation:
      'Add a short explanation so future admins understand why this policy exists.',
  },
  minEligibleMinutes: {
    label: 'Min Eligible Minutes',
    meaning:
      'Minimum actual OT minutes required before OT can be counted.',
    example:
      'If set to 30, employee who works only 20 minutes extra is not eligible. If they work 35 minutes, OT can be counted.',
    recommendation:
      'For your current flow, 30 minutes is a good default.',
  },
  roundUnitMinutes: {
    label: 'Round Unit Minutes',
    meaning:
      'The time block used to round actual OT time.',
    example:
      'If set to 30, OT rounds by 30-minute blocks: 30, 60, 90, 120 minutes.',
    recommendation:
      '30 minutes is simple and common for payroll calculation.',
  },
  roundMethod: {
    label: 'Round Method',
    meaning:
      'Controls how actual OT is rounded after the system calculates real worked OT.',
    example:
      'CEIL: 1h20m becomes 1h30m. FLOOR: 1h20m becomes 1h. NEAREST: rounds to the closest unit.',
    recommendation:
      'CEIL is employee-friendly. FLOOR is stricter. NEAREST is balanced.',
  },
  graceAfterShiftEndMinutes: {
    label: 'Grace After Shift End',
    meaning:
      'Small free period after shift end before OT starts counting.',
    example:
      'Shift ends 16:00 and grace is 10 minutes. Clock-out 16:08 = no OT. Clock-out 16:30 = OT counts from 16:10.',
    recommendation:
      'Use 0 if OT should start immediately after shift end.',
  },
  behaviorFlags: {
    label: 'Behavior Flags',
    meaning:
      'Controls what kind of OT is allowed and how missing scan data should be handled.',
    example:
      'Post-shift OT can be allowed, pre-shift OT can be blocked, and missing clock-out can be marked pending.',
    recommendation:
      'For your current flow: Post-shift ON, Pre-shift OFF, Cap ON, Forget Scan pending ON.',
  },
  quickSummary: {
    label: 'Quick Summary',
    meaning:
      'A simple preview of the current policy setup before saving.',
    example:
      'Round: CEIL every 30 min, Min Eligible: 30 min, Grace: 0 min.',
    recommendation:
      'Use this to quickly confirm the rule before saving.',
  },
}

const behaviorFlags = [
  {
    key: 'allowPreShiftOT',
    label: 'Allow Pre-Shift OT',
    short: 'Pre',
    meaning: 'Allows OT before the normal shift start time.',
    example:
      'Shift starts at 07:00. Employee clocks in at 06:00. The system may count 06:00 - 07:00 as pre-shift OT.',
    recommendation:
      'For your current OT flow, keep this OFF because your flow is mainly post-shift OT.',
  },
  {
    key: 'allowPostShiftOT',
    label: 'Allow Post-Shift OT',
    short: 'Post',
    meaning: 'Allows OT after the normal shift end time.',
    example:
      'Shift ends at 16:00. Employee clocks out at 18:00. The system may count 16:00 - 18:00 as post-shift OT.',
    recommendation:
      'For your current OT flow, keep this ON.',
  },
  {
    key: 'capByRequestedMinutes',
    label: 'Cap by Requested Minutes',
    short: 'Cap',
    meaning:
      'Final credited OT cannot be more than the approved/requested OT duration.',
    example:
      'Employee requested 2h OT but clocked out 3h late. Final OT is capped at 2h.',
    recommendation:
      'Keep this ON to avoid paying more than approved OT.',
  },
  {
    key: 'treatForgetScanInAsPending',
    label: 'Forget Scan In = Pending',
    short: 'FS-In',
    meaning:
      'If clock-in is missing, the system will not auto-finalize the OT result.',
    example:
      'Clock-in is missing but clock-out is 18:00. The system marks it as pending for manual review.',
    recommendation:
      'Keep this ON for safer attendance verification.',
  },
    {
    key: 'allowApprovedOtWithoutExactClockOut',
    label: 'Allow Approved OT Without Exact Clock-Out',
    short: 'No Exact Out',
    meaning:
      'Allows working-day approved OT to be credited even when exact OT end clock-out is not available.',
    example:
      'Shift is 07:00 - 16:00, approved OT is 16:00 - 20:00, attendance shows 06:45 - 16:00. If employee is present, system can credit approved OT.',
    recommendation:
      'Turn ON only for working-day post-shift OT policies. Keep OFF for Sunday/Holiday strict OT policies.',
  },
  {
    key: 'treatForgetScanOutAsPending',
    label: 'Forget Scan Out = Pending',
    short: 'FS-Out',
    meaning:
      'If clock-out is missing, the system will not auto-calculate OT.',
    example:
      'Clock-in exists but clock-out is missing. The system cannot know actual OT end time, so it marks pending.',
    recommendation:
      'Keep this ON because OT depends on clock-out time.',
  },
]

const activeFlagInfo = {
  label: 'Active',
  meaning:
    'Controls whether this policy can be selected for new Shift OT Options.',
  example:
    'If Active is OFF, old OT requests keep their policy snapshot, but new options should not use this policy.',
  recommendation:
    'Keep this ON for policies currently in use.',
}

function stopHelpEvent(event) {
  event.preventDefault()
  event.stopPropagation()
}

const HelpTip = (props) => {
  const info = props.info || {}

  return h(
    'span',
    {
      class: 'ot-help-wrap',
      tabindex: '0',
      role: 'button',
      'aria-label': `View ${info.label || 'field'} meaning`,
      onClick: stopHelpEvent,
      onMousedown: stopHelpEvent,
      onKeydown: stopHelpEvent,
    },
    [
      h('i', { class: 'pi pi-info-circle text-xs' }),
      h('span', { class: 'ot-help-tooltip' }, [
        h('span', { class: 'ot-help-title' }, info.label || 'Information'),
        h('span', { class: 'ot-help-line' }, info.meaning || '-'),
        h('span', { class: 'ot-help-line' }, [
          h('strong', 'Example: '),
          info.example || '-',
        ]),
        h('span', { class: 'ot-help-line' }, [
          h('strong', 'Recommended: '),
          info.recommendation || '-',
        ]),
      ]),
    ],
  )
}

HelpTip.props = {
  info: {
    type: Object,
    required: true,
  },
}

const canViewPolicy = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission(['OT_POLICY_VIEW']),
)

const canCreatePolicy = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission(['OT_POLICY_CREATE']),
)

const canUpdatePolicy = computed(() =>
  auth.user?.isRootAdmin || auth.hasAnyPermission(['OT_POLICY_UPDATE']),
)

const isEditMode = computed(() => !!editingPolicyId.value)

const canSaveDialog = computed(() =>
  isEditMode.value ? canUpdatePolicy.value : canCreatePolicy.value,
)

const totalPolicies = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalPolicies.value}`)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalPolicies.value > PAGE_SIZE)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !canSaveDialog.value ||
    !String(form.code || '').trim() ||
    !String(form.name || '').trim() ||
    !String(form.roundMethod || '').trim() ||
    Number(form.roundUnitMinutes || 0) < 1 ||
    Number(form.minEligibleMinutes || 0) < 0 ||
    Number(form.graceAfterShiftEndMinutes || 0) < 0
  )
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: filters.isActive,
    roundMethod: filters.roundMethod,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!canViewPolicy.value) {
    bootstrapped.value = true
    return
  }

  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTCalculationPolicies(buildQuery(page))
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
        'Failed to load OT calculation policies.',
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

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function onRoundMethodChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.isActive = ''
  filters.roundMethod = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  const fieldMap = {
    code: 'code',
    name: 'name',
    roundMethod: 'roundMethod',
    roundUnitMinutes: 'roundUnitMinutes',
    minEligibleMinutes: 'minEligibleMinutes',
    graceAfterShiftEndMinutes: 'graceAfterShiftEndMinutes',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }

  filters.sortField = fieldMap[event.sortField] || 'createdAt'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : -1

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
  editingPolicyId.value = ''

  form.code = ''
  form.name = ''
  form.description = ''
  form.minEligibleMinutes = 0
  form.roundUnitMinutes = 30
  form.roundMethod = 'CEIL'
  form.graceAfterShiftEndMinutes = 0
  form.allowPreShiftOT = false
  form.allowPostShiftOT = true
  form.capByRequestedMinutes = true
  form.treatForgetScanInAsPending = true
  form.treatForgetScanOutAsPending = true
  form.allowApprovedOtWithoutExactClockOut = false
  form.isActive = true
}

function openCreateDialog() {
  if (!canCreatePolicy.value) return

  resetForm()
  policyDialogVisible.value = true
}

function openEditDialog(row) {
  if (!canUpdatePolicy.value) return

  editingPolicyId.value = String(row?.id || row?._id || '').trim()

  form.code = String(row?.code || '').trim()
  form.name = String(row?.name || '').trim()
  form.description = String(row?.description || '').trim()
  form.minEligibleMinutes = Number(row?.minEligibleMinutes || 0)
  form.roundUnitMinutes = Number(row?.roundUnitMinutes || 30)
  form.roundMethod = String(row?.roundMethod || 'CEIL').trim() || 'CEIL'
  form.graceAfterShiftEndMinutes = Number(row?.graceAfterShiftEndMinutes || 0)
  form.allowPreShiftOT = row?.allowPreShiftOT === true
  form.allowPostShiftOT = row?.allowPostShiftOT !== false
  form.capByRequestedMinutes = row?.capByRequestedMinutes !== false
  form.treatForgetScanInAsPending = row?.treatForgetScanInAsPending !== false
  form.treatForgetScanOutAsPending = row?.treatForgetScanOutAsPending !== false
  form.allowApprovedOtWithoutExactClockOut =
    row?.allowApprovedOtWithoutExactClockOut === true
  form.isActive = row?.isActive !== false

  policyDialogVisible.value = true
}

function validateForm() {
  if (!String(form.code || '').trim()) return 'Code is required.'
  if (!String(form.name || '').trim()) return 'Name is required.'
  if (Number(form.minEligibleMinutes || 0) < 0) {
    return 'Min eligible minutes must be at least 0.'
  }
  if (Number(form.roundUnitMinutes || 0) < 1) {
    return 'Round unit minutes must be at least 1.'
  }
  if (Number(form.graceAfterShiftEndMinutes || 0) < 0) {
    return 'Grace after shift end must be at least 0.'
  }
  if (!String(form.roundMethod || '').trim()) return 'Round method is required.'

  return ''
}

function buildPayload() {
  return {
    code: String(form.code || '').trim().toUpperCase(),
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    minEligibleMinutes: Number(form.minEligibleMinutes || 0),
    roundUnitMinutes: Number(form.roundUnitMinutes || 0),
    roundMethod: String(form.roundMethod || '').trim().toUpperCase(),
    graceAfterShiftEndMinutes: Number(form.graceAfterShiftEndMinutes || 0),
    allowPreShiftOT: form.allowPreShiftOT === true,
    allowPostShiftOT: form.allowPostShiftOT === true,
    capByRequestedMinutes: form.capByRequestedMinutes === true,
    treatForgetScanInAsPending: form.treatForgetScanInAsPending === true,
    treatForgetScanOutAsPending: form.treatForgetScanOutAsPending === true,
    allowApprovedOtWithoutExactClockOut:
      form.allowApprovedOtWithoutExactClockOut === true,
    isActive: form.isActive === true,
  }
}

async function submitPolicy() {
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
        ? 'You do not have permission to update OT policy.'
        : 'You do not have permission to create OT policy.',
      life: 2500,
    })
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()

    if (editingPolicyId.value) {
      await updateOTCalculationPolicy(editingPolicyId.value, payload)

      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'OT calculation policy updated successfully.',
        life: 2500,
      })
    } else {
      await createOTCalculationPolicy(payload)

      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'OT calculation policy created successfully.',
        life: 2500,
      })
    }

    policyDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: isEditMode.value ? 'Save failed' : 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save OT calculation policy.',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

function activeSeverity(value) {
  return value ? 'success' : 'contrast'
}

function boolLabel(value) {
  return value ? 'YES' : 'NO'
}

function boolSeverity(value) {
  return value ? 'success' : 'contrast'
}

function roundMethodSeverity(value) {
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'CEIL') return 'warning'
  if (normalized === 'FLOOR') return 'info'
  if (normalized === 'NEAREST') return 'success'

  return 'contrast'
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

      <div class="flex flex-wrap items-center gap-2">

        <Button
          v-if="canCreatePolicy"
          label="New Policy"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>
    </div>

    <div
      v-if="!canViewPolicy"
      class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
    >
      You do not have permission to view OT policies.
    </div>

    <div
      v-else
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[320px] xl:shrink-0">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filters.search"
              placeholder="Search code, name, description"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[180px] xl:shrink-0">
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

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <Select
              v-model="filters.roundMethod"
              :options="roundMethodOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Round Method"
              class="w-full"
              size="small"
              @change="onRoundMethodChange"
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
        tableStyle="min-width: 108rem"
        class="ot-policy-table"
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
            No OT calculation policies found.
          </div>
        </template>

        <Column field="code" header="Code" sortable style="min-width: 13rem">
          <template #body="{ data }">
            <span v-if="data" class="font-medium">
              {{ data.code || '-' }}
            </span>
          </template>
        </Column>

        <Column field="name" header="Name" sortable style="min-width: 18rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.name || '-' }}</span>
          </template>
        </Column>

        <Column field="roundMethod" header="Round Method" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.roundMethod || '-'"
              :severity="roundMethodSeverity(data.roundMethod)"
              class="ot-policy-tag"
            />
          </template>
        </Column>

        <Column field="roundUnitMinutes" header="Round Unit" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <span v-if="data">{{ Number(data.roundUnitMinutes || 0) }} min</span>
          </template>
        </Column>

        <Column field="minEligibleMinutes" header="Min Eligible" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data">{{ Number(data.minEligibleMinutes || 0) }} min</span>
          </template>
        </Column>

        <Column field="graceAfterShiftEndMinutes" header="Grace" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <span v-if="data">{{ Number(data.graceAfterShiftEndMinutes || 0) }} min</span>
          </template>
        </Column>

        <Column header="Flags" style="min-width: 25rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-wrap gap-1.5">
              <Tag
                :value="`Pre: ${boolLabel(data.allowPreShiftOT)}`"
                :severity="boolSeverity(data.allowPreShiftOT)"
                class="ot-policy-tag"
              />
              <Tag
                :value="`Post: ${boolLabel(data.allowPostShiftOT)}`"
                :severity="boolSeverity(data.allowPostShiftOT)"
                class="ot-policy-tag"
              />
              <Tag
                :value="`Cap: ${boolLabel(data.capByRequestedMinutes)}`"
                :severity="boolSeverity(data.capByRequestedMinutes)"
                class="ot-policy-tag"
              />
              <Tag
                :value="`FS-In: ${boolLabel(data.treatForgetScanInAsPending)}`"
                :severity="boolSeverity(data.treatForgetScanInAsPending)"
                class="ot-policy-tag"
              />
              <Tag
                :value="`No Exact Out: ${boolLabel(data.allowApprovedOtWithoutExactClockOut)}`"
                :severity="boolSeverity(data.allowApprovedOtWithoutExactClockOut)"
                class="ot-policy-tag"
              />
              <Tag
                :value="`FS-Out: ${boolLabel(data.treatForgetScanOutAsPending)}`"
                :severity="boolSeverity(data.treatForgetScanOutAsPending)"
                class="ot-policy-tag"
              />
            </div>
          </template>
        </Column>

        <Column field="isActive" header="Status" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.isActive ? 'Active' : 'Inactive'"
              :severity="activeSeverity(data.isActive)"
              class="ot-policy-tag"
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
              v-if="data && canUpdatePolicy"
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
      v-model:visible="policyDialogVisible"
      modal
      :closable="!saving"
      :header="isEditMode ? 'Edit OT Calculation Policy' : 'Create OT Calculation Policy'"
      :style="{ width: '72rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="ot-field-label">
                <span>Code</span>
                <HelpTip :info="policyFieldInfo.code" />
              </label>
              <InputText
                v-model="form.code"
                class="w-full"
                placeholder="POST_SHIFT_STD_30M_CEIL"
              />
            </div>

            <div class="space-y-2">
              <label class="ot-field-label">
                <span>Name</span>
                <HelpTip :info="policyFieldInfo.name" />
              </label>
              <InputText
                v-model="form.name"
                class="w-full"
                placeholder="Post Shift Standard 30-Minute Ceiling"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="ot-field-label">
              <span>Description</span>
              <HelpTip :info="policyFieldInfo.description" />
            </label>
            <Textarea
              v-model="form.description"
              rows="4"
              autoResize
              class="w-full"
              placeholder="Policy description"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="ot-field-label">
                <span>Min Eligible Minutes</span>
                <HelpTip :info="policyFieldInfo.minEligibleMinutes" />
              </label>
              <InputNumber
                v-model="form.minEligibleMinutes"
                inputClass="w-full"
                class="w-full"
                :min="0"
                :useGrouping="false"
              />
            </div>

            <div class="space-y-2">
              <label class="ot-field-label">
                <span>Round Unit Minutes</span>
                <HelpTip :info="policyFieldInfo.roundUnitMinutes" />
              </label>
              <InputNumber
                v-model="form.roundUnitMinutes"
                inputClass="w-full"
                class="w-full"
                :min="1"
                :useGrouping="false"
              />
            </div>

            <div class="space-y-2">
              <label class="ot-field-label">
                <span>Round Method</span>
                <HelpTip :info="policyFieldInfo.roundMethod" />
              </label>
              <Select
                v-model="form.roundMethod"
                :options="formRoundMethodOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>

            <div class="space-y-2">
              <label class="ot-field-label">
                <span>Grace After Shift End</span>
                <HelpTip :info="policyFieldInfo.graceAfterShiftEndMinutes" />
              </label>
              <InputNumber
                v-model="form.graceAfterShiftEndMinutes"
                inputClass="w-full"
                class="w-full"
                :min="0"
                :useGrouping="false"
              />
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4">
            <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--ot-text)]">
              <span>Behavior Flags</span>
              <HelpTip :info="policyFieldInfo.behaviorFlags" />
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label
                v-for="flag in behaviorFlags"
                :key="flag.key"
                class="ot-check-item"
              >
                <input
                  v-model="form[flag.key]"
                  type="checkbox"
                >
                <span class="min-w-0 flex-1">{{ flag.label }}</span>
                <HelpTip :info="flag" />
              </label>

              <label class="ot-check-item">
                <input
                  v-model="form.isActive"
                  type="checkbox"
                >
                <span class="min-w-0 flex-1">Active</span>
                <HelpTip :info="activeFlagInfo" />
              </label>
            </div>
          </div>

          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
            <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--ot-text)]">
              <span>Quick Summary</span>
              <HelpTip :info="policyFieldInfo.quickSummary" />
            </div>

            <div class="grid grid-cols-1 gap-2 text-sm text-[color:var(--ot-text-muted)]">
              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Round:</span>
                {{ form.roundMethod }} every {{ Number(form.roundUnitMinutes || 0) }} min
              </div>
              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Min Eligible:</span>
                {{ Number(form.minEligibleMinutes || 0) }} min
              </div>
              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Grace:</span>
                {{ Number(form.graceAfterShiftEndMinutes || 0) }} min
              </div>
              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Status:</span>
                {{ form.isActive ? 'Active' : 'Inactive' }}
              </div>
            </div>
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
            @click="policyDialogVisible = false"
          />
          <Button
            v-if="canSaveDialog"
            :label="isEditMode ? 'Save Changes' : 'Create Policy'"
            :icon="isEditMode ? 'pi pi-save' : 'pi pi-plus'"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitPolicy"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.ot-policy-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.ot-policy-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  height: 76px !important;
  vertical-align: middle !important;
}

:deep(.ot-policy-table .p-tag.ot-policy-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

/* frontend/src/modules/ot/views/OTCalculationPolicyListView.vue */

/* Field label with help icon */
.ot-field-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ot-text);
}

/*
  IMPORTANT:
  HelpTip is rendered by JS h(), so use :global()
  to make sure scoped CSS still controls the tooltip.
*/
:global(.ot-help-wrap) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  flex-shrink: 0;
  border-radius: 999px;
  color: var(--ot-text-muted);
  cursor: help;
  transition:
    color 0.18s ease,
    background-color 0.18s ease;
}

:global(.ot-help-wrap:hover),
:global(.ot-help-wrap:focus-visible) {
  color: var(--p-primary-500);
  background: color-mix(in srgb, var(--p-primary-500) 10%, transparent);
  outline: none;
}

/* Hidden by default */
:global(.ot-help-tooltip) {
  position: absolute;
  left: 0;
  top: calc(100% + 0.55rem);
  z-index: 9999;

  display: flex;
  width: min(24rem, 80vw);
  flex-direction: column;
  gap: 0.45rem;

  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
  padding: 0.9rem 1rem;

  color: var(--ot-text);
  text-align: left;
  line-height: 1.45;

  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  pointer-events: none;

  transition:
    opacity 0.18s ease 1s,
    visibility 0s linear 1s,
    transform 0.18s ease 1s;
}

/* Small arrow */
:global(.ot-help-tooltip::before) {
  content: '';
  position: absolute;
  left: 0.45rem;
  bottom: 100%;
  border-width: 0.45rem;
  border-style: solid;
  border-color: transparent transparent var(--ot-surface) transparent;
}

/*
  Show only after hovering/focusing for 2 seconds.
  This prevents messy instant tooltips.
*/
:global(.ot-help-wrap:hover .ot-help-tooltip),
:global(.ot-help-wrap:focus-visible .ot-help-tooltip) {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;

  transition-delay: 2s, 2s, 2s;
}

/* If mouse leaves before 2 seconds, hide immediately */
:global(.ot-help-wrap:not(:hover):not(:focus-visible) .ot-help-tooltip) {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  pointer-events: none;

  transition-delay: 0s;
}

:global(.ot-help-title) {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--ot-text);
}

:global(.ot-help-line) {
  font-size: 0.78rem;
  color: var(--ot-text-muted);
}

:global(.ot-help-line strong) {
  color: var(--ot-text);
}
</style>