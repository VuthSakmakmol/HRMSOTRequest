<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import DatePicker from 'primevue/datepicker'
import Dropdown from 'primevue/dropdown'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import OTApproverChainView from '@/modules/ot/components/OTApproverChainView.vue'
import OTEmployeeMultiPicker from '@/modules/ot/components/OTEmployeeMultiPicker.vue'
import OTSubmitBar from '@/modules/ot/components/OTSubmitBar.vue'
import api from '@/shared/services/api'
import {
  createOTRequest,
  getAllowedOTApproverChain,
  getShiftOTOptionsByShift,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()

const submitting = ref(false)
const loadingApproverChain = ref(false)
const loadingRequester = ref(false)
const loadingShiftOptions = ref(false)

const selectedEmployees = ref([])
const approverChain = ref([])
const requesterEmployee = ref(null)
const shiftOptions = ref([])
const lastLoadedShiftId = ref('')

const form = reactive({
  otDate: null,
  shiftOtOptionId: '',
  reason: '',
  approverEmployeeIds: [],
})

const selectedEmployeeIds = computed(() =>
  selectedEmployees.value
    .map((item) => String(item?._id || item?.id || '').trim())
    .filter(Boolean),
)

const requesterEmployeeId = computed(() =>
  String(requesterEmployee.value?._id || '').trim(),
)

const selectableApproverChain = computed(() => approverChain.value.slice(0, 4))

function normalizeApproverChainResponse(res) {
  const rows =
    res?.data?.data?.items ||
    res?.data?.data?.rows ||
    res?.data?.data ||
    res?.data ||
    []

  if (!Array.isArray(rows)) return []

  return rows
    .map((item, index) => ({
      orderNo: Number(item?.orderNo || index + 1),
      employeeId: String(item?.employeeId || item?._id || '').trim(),
      employeeNo: String(item?.employeeNo || '').trim(),
      displayName: String(item?.displayName || item?.name || '').trim(),
    }))
    .filter((item) => item.employeeId && item.displayName)
}

function normalizeMeResponse(res) {
  const root =
    res?.data?.data?.user ||
    res?.data?.data ||
    res?.data?.user ||
    res?.data ||
    {}

  const employee =
    root?.employee ||
    root?.employeeProfile ||
    root?.employeeInfo ||
    {}

  const _id = String(
    employee?._id ||
      employee?.id ||
      root?.employeeId ||
      root?.employee?._id ||
      '',
  ).trim()

  const displayName = String(
    employee?.displayName ||
      employee?.name ||
      root?.displayName ||
      root?.name ||
      root?.loginId ||
      '',
  ).trim()

  const employeeNo = String(
    employee?.employeeNo || root?.employeeNo || '',
  ).trim()

  const departmentName = String(
    employee?.departmentName ||
      employee?.department?.name ||
      root?.departmentName ||
      '',
  ).trim()

  const positionName = String(
    employee?.positionName ||
      employee?.position?.name ||
      root?.positionName ||
      '',
  ).trim()

  if (!_id || !displayName) return null

  return {
    _id,
    displayName,
    employeeNo,
    departmentName,
    positionName,
  }
}

function normalizeShiftOptionsResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const shift = payload?.shift || null
  const rows = Array.isArray(payload?.items) ? payload.items : []

  return {
    shift,
    items: rows.map((item) => {
      const requestedMinutes = Number(item?.requestedMinutes || 0)
      const requestedHours = Number(
        item?.requestedHours || (requestedMinutes / 60).toFixed(2),
      )

      const timingMode = String(item?.timingMode || 'AFTER_SHIFT_END')
        .trim()
        .toUpperCase()

      const requestStartTime = String(
        item?.requestStartTime ||
          item?.fixedStartTime ||
          '',
      ).trim()

      const requestEndTime = String(
        item?.requestEndTime ||
          item?.fixedEndTime ||
          '',
      ).trim()

      const label = String(item?.label || '').trim()
      const windowLabel =
        requestStartTime && requestEndTime
          ? `${requestStartTime} - ${requestEndTime}`
          : ''

      return {
        id: String(item?.id || item?._id || '').trim(),
        label,

        timingMode,
        startAfterShiftEndMinutes: Number(item?.startAfterShiftEndMinutes || 0),
        fixedStartTime: String(item?.fixedStartTime || '').trim(),
        fixedEndTime: String(item?.fixedEndTime || '').trim(),

        requestStartTime,
        requestEndTime,

        requestedMinutes,
        requestedHours,
        sequence: Number(item?.sequence || 0),
        calculationPolicy: item?.calculationPolicy || null,

        optionLabel: windowLabel
          ? `${label} · ${windowLabel} · ${formatMinutesLabel(requestedMinutes)}`
          : `${label} (${requestedMinutes} min)`,
      }
    }).filter((item) => item.id && item.label),
  }
}

function clearApproverSelection() {
  approverChain.value = []
  form.approverEmployeeIds = []
}

function clearShiftOptions() {
  shiftOptions.value = []
  form.shiftOtOptionId = ''
  lastLoadedShiftId.value = ''
}

async function loadRequesterEmployee() {
  try {
    loadingRequester.value = true
    const res = await api.get('/auth/me')
    requesterEmployee.value = normalizeMeResponse(res)
  } catch (error) {
    requesterEmployee.value = null
    toast.add({
      severity: 'error',
      summary: 'Profile load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load your profile.',
      life: 3000,
    })
  } finally {
    loadingRequester.value = false
  }
}

async function loadApproverChainForRequester() {
  try {
    const employeeId = requesterEmployeeId.value
    clearApproverSelection()

    if (!employeeId) return

    loadingApproverChain.value = true

    const res = await getAllowedOTApproverChain(employeeId)
    approverChain.value = normalizeApproverChainResponse(res)
  } catch (error) {
    clearApproverSelection()
    toast.add({
      severity: 'error',
      summary: 'Approver chain failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load approver chain.',
      life: 3000,
    })
  } finally {
    loadingApproverChain.value = false
  }
}

function onApproverToggle({ index, checked }) {
  const chain = selectableApproverChain.value

  if (!chain[index]) return

  if (checked) {
    form.approverEmployeeIds = chain
      .slice(0, index + 1)
      .map((item) => item.employeeId)
    return
  }

  form.approverEmployeeIds = chain
    .slice(0, index)
    .map((item) => item.employeeId)
}

function formatDateYMD(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function minutesToHHmm(totalMinutes) {
  const normalized = ((Number(totalMinutes || 0) % 1440) + 1440) % 1440
  const hh = Math.floor(normalized / 60)
  const mm = normalized % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function addMinutesToHHmm(hhmm, extraMinutes) {
  const match = String(hhmm || '').trim().match(/^(\d{2}):(\d{2})$/)
  if (!match) return ''
  const total = Number(match[1]) * 60 + Number(match[2]) + Number(extraMinutes || 0)
  return minutesToHHmm(total)
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

function extractShiftInfo(employee) {
  const shift =
    employee?.shift ||
    employee?.shiftInfo ||
    employee?.assignedShift ||
    {}

  const shiftId = String(
    employee?.shiftId ||
      shift?._id ||
      shift?.id ||
      '',
  ).trim()

  if (!shiftId) return null

  return {
    shiftId,
    code: String(employee?.shiftCode || shift?.code || '').trim(),
    name: String(employee?.shiftName || shift?.name || '').trim(),
    type: String(employee?.shiftType || shift?.type || '').trim(),
    startTime: String(employee?.shiftStartTime || shift?.startTime || '').trim(),
    endTime: String(employee?.shiftEndTime || shift?.endTime || '').trim(),
    crossMidnight:
      employee?.shiftCrossMidnight === true ||
      shift?.crossMidnight === true,
  }
}

const selectedShiftState = computed(() => {
  if (!selectedEmployees.value.length) {
    return {
      mode: 'none',
      shift: null,
      message: '',
    }
  }

  const shiftInfos = selectedEmployees.value.map(extractShiftInfo)
  const missingShiftCount = shiftInfos.filter((item) => !item?.shiftId).length

  if (missingShiftCount > 0) {
    return {
      mode: 'missing',
      shift: null,
      message: 'Some selected employees do not have assigned shift information.',
    }
  }

  const uniqueShiftIds = Array.from(new Set(shiftInfos.map((item) => item.shiftId)))

  if (uniqueShiftIds.length > 1) {
    return {
      mode: 'mixed',
      shift: null,
      message: 'Selected employees belong to different shifts. Please choose employees from the same shift.',
    }
  }

  return {
    mode: 'ready',
    shift: shiftInfos[0],
    message: '',
  }
})

const sharedShift = computed(() => selectedShiftState.value.shift || null)

const selectedOTOption = computed(() =>
  shiftOptions.value.find((item) => item.id === form.shiftOtOptionId) || null,
)

const requestPreview = computed(() => {
  if (!sharedShift.value || !selectedOTOption.value) return null

  const requestedMinutes = Number(selectedOTOption.value.requestedMinutes || 0)

  return {
    timingMode: String(selectedOTOption.value.timingMode || 'AFTER_SHIFT_END')
      .trim()
      .toUpperCase(),

    requestStartTime: String(selectedOTOption.value.requestStartTime || '').trim(),
    requestEndTime: String(selectedOTOption.value.requestEndTime || '').trim(),

    requestedMinutes,
    requestedHours: Number(
      selectedOTOption.value.requestedHours ||
        (requestedMinutes / 60).toFixed(2),
    ),

    startAfterShiftEndMinutes: Number(
      selectedOTOption.value.startAfterShiftEndMinutes || 0,
    ),
  }
})

async function loadShiftOptionsForSharedShift() {
  const state = selectedShiftState.value

  if (state.mode !== 'ready' || !state.shift?.shiftId) {
    clearShiftOptions()
    return
  }

  if (lastLoadedShiftId.value === state.shift.shiftId) {
    return
  }

  loadingShiftOptions.value = true
  form.shiftOtOptionId = ''

  try {
    const res = await getShiftOTOptionsByShift(state.shift.shiftId)
    const normalized = normalizeShiftOptionsResponse(res)

    shiftOptions.value = normalized.items
    lastLoadedShiftId.value = state.shift.shiftId

    if (shiftOptions.value.length === 1) {
      form.shiftOtOptionId = shiftOptions.value[0].id
    }
  } catch (error) {
    clearShiftOptions()
    toast.add({
      severity: 'error',
      summary: 'OT options failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load OT options for the selected shift.',
      life: 3500,
    })
  } finally {
    loadingShiftOptions.value = false
  }
}

watch(
  () => selectedShiftState.value.mode === 'ready' ? selectedShiftState.value.shift?.shiftId : '',
  async (shiftId, oldShiftId) => {
    if (!shiftId) {
      clearShiftOptions()
      return
    }

    if (shiftId !== oldShiftId) {
      clearShiftOptions()
    }

    await loadShiftOptionsForSharedShift()
  },
  { immediate: true },
)

function buildPayload() {
  return {
    employeeIds: selectedEmployeeIds.value,
    otDate: formatDateYMD(form.otDate),
    shiftOtOptionId: String(form.shiftOtOptionId || '').trim(),
    reason: String(form.reason || '').trim(),
    approverEmployeeIds: form.approverEmployeeIds
      .map((id) => String(id).trim())
      .filter(Boolean),
  }
}

function validateBeforeSubmit(payload) {
  if (!payload.employeeIds.length) return 'Please select at least 1 employee.'
  if (!payload.otDate) return 'Please select OT date.'
  if (selectedShiftState.value.mode === 'missing') {
    return 'Some selected employees do not have assigned shift information.'
  }
  if (selectedShiftState.value.mode === 'mixed') {
    return 'Selected employees must belong to the same shift.'
  }
  if (!payload.shiftOtOptionId) return 'Please select OT option.'
  if (!payload.reason) return 'Please enter reason.'
  if (!payload.approverEmployeeIds.length) return 'Please select at least 1 approver.'
  return ''
}

async function submit() {
  const payload = buildPayload()
  const message = validateBeforeSubmit(payload)

  if (message) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: message,
      life: 2500,
    })
    return
  }

  try {
    submitting.value = true
    await createOTRequest(payload)

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'OT request created successfully.',
      life: 2500,
    })

    router.push('/ot/requests')
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to create OT request.',
      life: 4000,
    })
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push('/ot/requests')
}

onMounted(async () => {
  await loadRequesterEmployee()
  await loadApproverChainForRequester()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Create OT Request
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Select employees, choose one OT option for their shared shift, then submit to the approver chain.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Staff
          </div>
          <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
            {{ selectedEmployeeIds.length }}
          </div>
        </div>

        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Chain
          </div>
          <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
            {{ selectableApproverChain.length }}
          </div>
        </div>

        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            OT Option
          </div>
          <div class="mt-1 text-sm font-semibold leading-none text-[color:var(--ot-text)]">
            {{ selectedOTOption?.label || '—' }}
          </div>
        </div>

        <Button
          label="Back"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          size="small"
          @click="goBack"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.78fr)]">
      <div class="flex flex-col gap-4">
        <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
          <div class="border-b border-[color:var(--ot-border)] px-4 py-3">
            <div class="text-sm font-medium text-[color:var(--ot-text)]">
              Employee Selection
            </div>
          </div>

          <div class="p-4">
            <OTEmployeeMultiPicker v-model="selectedEmployees" />
          </div>
        </div>

        <Card class="ot-create-card">
          <template #title>
            OT Option
          </template>

          <template #content>
            <div class="flex flex-col gap-4">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="space-y-2">
                  <label class="text-sm font-medium text-[color:var(--ot-text)]">
                    OT Date
                  </label>
                  <DatePicker
                    v-model="form.otDate"
                    dateFormat="yy-mm-dd"
                    showIcon
                    class="w-full"
                    inputClass="w-full"
                  />
                </div>

                <div class="space-y-2">
                  <label class="text-sm font-medium text-[color:var(--ot-text)]">
                    OT Option
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
                v-else-if="selectedEmployeeIds.length && selectedShiftState.mode === 'ready' && !loadingShiftOptions && !shiftOptions.length"
                severity="warn"
                :closable="false"
              >
                No active OT option is configured for this shift yet.
              </Message>

              <div
                v-if="selectedShiftState.mode === 'ready' && sharedShift"
                class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
              >
                <div class="ot-info-box">
                  <div class="ot-info-label">Shift</div>
                  <div class="ot-info-value">
                    {{ sharedShift.code || '-' }} {{ sharedShift.name ? `· ${sharedShift.name}` : '' }}
                  </div>
                </div>

                <div class="ot-info-box">
                  <div class="ot-info-label">Shift Type</div>
                  <div class="ot-info-value">
                    {{ sharedShift.type || '-' }}
                  </div>
                </div>

                <div class="ot-info-box">
                  <div class="ot-info-label">Shift Start</div>
                  <div class="ot-info-value">
                    {{ sharedShift.startTime || '-' }}
                  </div>
                </div>

                <div class="ot-info-box">
                  <div class="ot-info-label">Shift End</div>
                  <div class="ot-info-value">
                    {{ sharedShift.endTime || '-' }}
                  </div>
                </div>
              </div>

              <div
                v-if="requestPreview && selectedOTOption"
                class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
              >
                <div class="ot-info-box border-indigo-200 dark:border-indigo-800">
                  <div class="ot-info-label">Timing Mode</div>
                  <div class="ot-info-value">
                    {{ timingModeLabel(requestPreview.timingMode) }}
                  </div>
                </div>
                <div class="ot-info-box border-emerald-200 dark:border-emerald-800">
                  <div class="ot-info-label">Requested Minutes</div>
                  <div class="ot-info-value">
                    {{ requestPreview.requestedMinutes }}
                  </div>
                </div>

                <div class="ot-info-box border-sky-200 dark:border-sky-800">
                  <div class="ot-info-label">Requested Duration</div>
                  <div class="ot-info-value">
                    {{ formatMinutesLabel(requestPreview.requestedMinutes) }}
                  </div>
                </div>

                <div class="ot-info-box border-violet-200 dark:border-violet-800">
                  <div class="ot-info-label">Request Start</div>
                  <div class="ot-info-value">
                    {{ requestPreview.requestStartTime || '-' }}
                  </div>
                </div>

                <div class="ot-info-box border-amber-200 dark:border-amber-800">
                  <div class="ot-info-label">Request End</div>
                  <div class="ot-info-value">
                    {{ requestPreview.requestEndTime || '-' }}
                  </div>
                </div>
              </div>

              <div
                v-if="selectedOTOption?.calculationPolicy"
                class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4"
              >
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-[color:var(--ot-text)]">
                    Calculation Policy
                  </span>
                  <Tag
                    :value="selectedOTOption.calculationPolicy.code || '—'"
                    severity="info"
                  />
                </div>

                <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div class="text-sm text-[color:var(--ot-text-muted)]">
                    <span class="font-medium text-[color:var(--ot-text)]">Name:</span>
                    {{ selectedOTOption.calculationPolicy.name || '-' }}
                  </div>
                  <div class="text-sm text-[color:var(--ot-text-muted)]">
                    <span class="font-medium text-[color:var(--ot-text)]">Min Eligible:</span>
                    {{ selectedOTOption.calculationPolicy.minEligibleMinutes ?? 0 }} min
                  </div>
                  <div class="text-sm text-[color:var(--ot-text-muted)]">
                    <span class="font-medium text-[color:var(--ot-text)]">Round Unit:</span>
                    {{ selectedOTOption.calculationPolicy.roundUnitMinutes ?? 0 }} min
                  </div>
                  <div class="text-sm text-[color:var(--ot-text-muted)]">
                    <span class="font-medium text-[color:var(--ot-text)]">Round Method:</span>
                    {{ selectedOTOption.calculationPolicy.roundMethod || '-' }}
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium text-[color:var(--ot-text)]">
                  Reason
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
          </template>
        </Card>
      </div>

      <div class="flex flex-col gap-4">
        <OTApproverChainView
          :loading-requester="loadingRequester"
          :loading-approver-chain="loadingApproverChain"
          :requester-employee-id="requesterEmployeeId"
          :requester-employee="requesterEmployee"
          :approver-chain="approverChain"
          :selected-approver-employee-ids="form.approverEmployeeIds"
          @toggle="onApproverToggle"
        />

        <OTSubmitBar
          :submitting="submitting"
          :disabled="loadingRequester || loadingApproverChain || loadingShiftOptions"
          @submit="submit"
          @back="goBack"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.ot-create-card .p-card-body) {
  padding: 1rem !important;
}

:deep(.ot-create-card .p-card-title) {
  font-size: 1rem !important;
  font-weight: 700 !important;
  color: var(--ot-text) !important;
}

.ot-info-box {
  border: 1px solid var(--ot-border);
  background: var(--ot-bg);
  border-radius: 1rem;
  padding: 0.9rem;
}

.ot-info-label {
  margin-bottom: 0.3rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-info-value {
  word-break: break-word;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ot-text);
}
</style>