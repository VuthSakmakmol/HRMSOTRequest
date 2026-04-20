<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'

import OTApproverChainView from '@/modules/ot/components/OTApproverChainView.vue'
import OTDetailView from '@/modules/ot/components/OTDetailView.vue'
import OTEmployeeMultiPicker from '@/modules/ot/components/OTEmployeeMultiPicker.vue'
import OTSubmitBar from '@/modules/ot/components/OTSubmitBar.vue'
import api from '@/shared/services/api'
import {
  createOTRequest,
  getAllowedOTApproverChain,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()

const submitting = ref(false)
const loadingApproverChain = ref(false)
const loadingRequester = ref(false)

const selectedEmployees = ref([])
const approverChain = ref([])
const requesterEmployee = ref(null)

const form = reactive({
  otDate: null,
  startTime: buildTimeDefault(16, 0),
  endTime: buildTimeDefault(17, 0),
  breakMinutes: 0,
  reason: '',
  approverEmployeeIds: [],
})

watch(
  () => form.startTime,
  (value) => {
    if (!value) return

    const start = new Date(value)
    if (Number.isNaN(start.getTime())) return

    const currentEnd = form.endTime ? new Date(form.endTime) : null

    if (!currentEnd || Number.isNaN(currentEnd.getTime()) || currentEnd <= start) {
      const nextEnd = new Date(start)
      nextEnd.setHours(nextEnd.getHours() + 1)
      form.endTime = nextEnd
    }
  },
  { immediate: true },
)

watch(
  () => form.endTime,
  (value) => {
    if (!value || !form.startTime) return

    const start = new Date(form.startTime)
    const end = new Date(value)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return

    if (end <= start) {
      const fixedEnd = new Date(start)
      fixedEnd.setHours(fixedEnd.getHours() + 1)
      form.endTime = fixedEnd
    }
  },
)

function buildTimeDefault(hour, minute = 0) {
  const now = new Date()
  now.setHours(hour, minute, 0, 0)
  return now
}

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

function clearApproverSelection() {
  approverChain.value = []
  form.approverEmployeeIds = []
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

function formatTimeHHmm(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function buildPayload() {
  return {
    employeeIds: selectedEmployeeIds.value,
    otDate: formatDateYMD(form.otDate),
    startTime: formatTimeHHmm(form.startTime),
    endTime: formatTimeHHmm(form.endTime),
    breakMinutes: Number(form.breakMinutes ?? 0),
    reason: String(form.reason || '').trim(),
    approverEmployeeIds: form.approverEmployeeIds
      .map((id) => String(id).trim())
      .filter(Boolean),
  }
}

function validateBeforeSubmit(payload) {
  if (!payload.employeeIds.length) return 'Please select at least 1 employee.'
  if (!payload.otDate) return 'Please select OT date.'
  if (!payload.startTime) return 'Please select start time.'
  if (!payload.endTime) return 'Please select end time.'
  if (!Number.isFinite(payload.breakMinutes) || payload.breakMinutes < 0) {
    return 'Break minutes must be a valid number.'
  }
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

        <OTDetailView
          :form="form"
          :selected-employee-count="selectedEmployeeIds.length"
        />
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
          :disabled="loadingRequester || loadingApproverChain"
          @submit="submit"
          @back="goBack"
        />
      </div>
    </div>
  </div>
</template>