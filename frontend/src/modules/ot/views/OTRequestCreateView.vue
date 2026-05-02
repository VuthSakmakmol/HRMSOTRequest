<!-- frontend/src/modules/ot/views/OTRequestCreateView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestCreateView.vue

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import OTApproverChainView from '@/modules/ot/components/OTApproverChainView.vue'
import OTDetailView from '@/modules/ot/components/OTDetailView.vue'
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
const loadingUnavailableEmployees = ref(false)

const selectedEmployees = ref([])
const approverChain = ref([])
const requesterEmployee = ref(null)
const shiftOptions = ref([])
const unavailableEmployees = ref([])
const lastLoadedShiftId = ref('')

let unavailableRequestSeq = 0

const form = reactive({
  otDate: null,
  shiftOtOptionId: '',
  reason: '',
  approverEmployeeIds: [],
})

const selectedEmployeeIds = computed(() =>
  selectedEmployees.value
    .map((item) => String(item?._id || item?.id || item?.employeeId || '').trim())
    .filter(Boolean),
)

const requesterEmployeeId = computed(() =>
  String(requesterEmployee.value?._id || '').trim(),
)

const selectableApproverChain = computed(() => approverChain.value.slice(0, 4))

const selectedOTOption = computed(() =>
  shiftOptions.value.find((item) => item.id === form.shiftOtOptionId) || null,
)

const unavailableEmployeeMap = computed(() => {
  const map = {}

  for (const item of unavailableEmployees.value) {
    const employeeId = String(item?.employeeId || '').trim()
    if (!employeeId) continue
    map[employeeId] = item
  }

  return map
})

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

  if (!_id || !displayName) return null

  return {
    _id,
    displayName,
    employeeNo,
  }
}

function normalizeUnavailableEmployeesResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

  return rows
    .map((item) => ({
      employeeId: String(item?.employeeId || '').trim(),
      employeeCode: String(item?.employeeCode || '').trim(),
      employeeName: String(item?.employeeName || '').trim(),
      employeeLabel: String(item?.employeeLabel || '').trim(),
      requestNo: String(item?.requestNo || '').trim(),
      status: String(item?.status || '').trim(),
      statusLabel: String(item?.statusLabel || '').trim(),
      otDate: String(item?.otDate || '').trim(),
    }))
    .filter((item) => item.employeeId)
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

function normalizeShiftOptionsResponse(res) {
  const payload = res?.data?.data || res?.data || {}
  const rows = Array.isArray(payload?.items) ? payload.items : []

  return rows
    .map((item) => {
      const requestedMinutes = Number(item?.requestedMinutes || 0)
      const requestedHours = Number(
        item?.requestedHours || (requestedMinutes / 60).toFixed(2),
      )

      const timingMode = String(item?.timingMode || 'AFTER_SHIFT_END')
        .trim()
        .toUpperCase()

      const requestStartTime = String(
        item?.requestStartTime || item?.fixedStartTime || '',
      ).trim()

      const requestEndTime = String(
        item?.requestEndTime || item?.fixedEndTime || '',
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
        requestStartTime,
        requestEndTime,
        requestedMinutes,
        requestedHours,
        sequence: Number(item?.sequence || 0),
        calculationPolicy: item?.calculationPolicy || null,
        optionLabel: windowLabel
          ? `${label} · ${windowLabel} · ${formatMinutesLabel(requestedMinutes)}`
          : `${label} · ${formatMinutesLabel(requestedMinutes)}`,
      }
    })
    .filter((item) => item.id && item.label)
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
      message: 'Selected employees belong to different shifts. Please use the Shift filter or select one shift only.',
    }
  }

  return {
    mode: 'ready',
    shift: shiftInfos[0],
    message: '',
  }
})

const sharedShift = computed(() => selectedShiftState.value.shift || null)

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
  }
})

function clearApproverSelection() {
  approverChain.value = []
  form.approverEmployeeIds = []
}

function clearShiftOptions() {
  shiftOptions.value = []
  form.shiftOtOptionId = ''
  lastLoadedShiftId.value = ''
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatYMD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function removeUnavailableSelectedEmployees() {
  const blockedMap = unavailableEmployeeMap.value
  const beforeCount = selectedEmployees.value.length

  selectedEmployees.value = selectedEmployees.value.filter((item) => {
    const employeeId = String(item?._id || item?.id || item?.employeeId || '').trim()
    return !blockedMap[employeeId]
  })

  const removedCount = beforeCount - selectedEmployees.value.length

  if (removedCount > 0) {
    toast.add({
      severity: 'warn',
      summary: 'Employees removed',
      detail: `${removedCount} employee(s) already have OT request on this date and were removed from selection.`,
      life: 5000,
    })
  }
}

async function loadUnavailableEmployeesForDate() {
  const otDate = formatYMD(form.otDate)
  const requestSeq = ++unavailableRequestSeq

  unavailableEmployees.value = []

  if (!otDate) {
    return
  }

  loadingUnavailableEmployees.value = true

  try {
    const res = await api.get('/ot/requests/unavailable-employees', {
      params: { otDate },
    })

    if (requestSeq !== unavailableRequestSeq) return

    unavailableEmployees.value = normalizeUnavailableEmployeesResponse(res)
    removeUnavailableSelectedEmployees()
  } catch (error) {
    unavailableEmployees.value = []

    toast.add({
      severity: 'warn',
      summary: 'OT availability check failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to check existing OT employees for this date.',
      life: 3500,
    })
  } finally {
    if (requestSeq === unavailableRequestSeq) {
      loadingUnavailableEmployees.value = false
    }
  }
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

async function loadShiftOptionsForSharedShift() {
  const state = selectedShiftState.value

  if (state.mode !== 'ready' || !state.shift?.shiftId) {
    clearShiftOptions()
    return
  }

  if (lastLoadedShiftId.value === state.shift.shiftId) return

  loadingShiftOptions.value = true
  form.shiftOtOptionId = ''

  try {
    const res = await getShiftOTOptionsByShift(state.shift.shiftId)
    const rows = normalizeShiftOptionsResponse(res)

    shiftOptions.value = rows
    lastLoadedShiftId.value = state.shift.shiftId

    if (rows.length === 1) {
      form.shiftOtOptionId = rows[0].id
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
  () =>
    selectedShiftState.value.mode === 'ready'
      ? selectedShiftState.value.shift?.shiftId
      : '',
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

watch(
  () => formatYMD(form.otDate),
  async () => {
    await loadUnavailableEmployeesForDate()
  },
)

function buildPayload() {
  return {
    employeeIds: selectedEmployeeIds.value,
    otDate: formatYMD(form.otDate),
    shiftOtOptionId: String(form.shiftOtOptionId || '').trim(),
    reason: String(form.reason || '').trim(),
    approverEmployeeIds: form.approverEmployeeIds
      .map((id) => String(id).trim())
      .filter(Boolean),
  }
}

function validateBeforeSubmit(payload) {
  if (loadingUnavailableEmployees.value) {
    return 'Please wait until OT availability check finishes.'
  }

  if (!payload.employeeIds.length) return 'Please select at least 1 employee.'
  if (!payload.otDate) return 'Please select OT date from the internal calendar.'

  if (selectedShiftState.value.mode === 'missing') {
    return 'Some selected employees do not have assigned shift information.'
  }

  if (selectedShiftState.value.mode === 'mixed') {
    return 'Please select employees from one shift only before creating OT request.'
  }

  if (!payload.shiftOtOptionId) return 'Please select OT option.'
  if (!payload.reason) return 'Please enter reason.'
  if (!payload.approverEmployeeIds.length) return 'Please select at least 1 approver.'

  return ''
}

function getErrorPayload(error) {
  return error?.response?.data || {}
}

function normalizeDuplicateEmployees(error) {
  const payload = getErrorPayload(error)

  const duplicates =
    payload?.duplicates ||
    payload?.details?.duplicates ||
    payload?.data?.duplicates ||
    []

  if (!Array.isArray(duplicates)) {
    return []
  }

  return duplicates
    .map((item) => ({
      employeeId: String(item?.employeeId || '').trim(),
      employeeCode: String(item?.employeeCode || '').trim(),
      employeeName: String(item?.employeeName || '').trim(),
      employeeLabel: String(item?.employeeLabel || '').trim(),
      requestNo: String(item?.requestNo || '').trim(),
      status: String(item?.status || '').trim(),
      otDate: String(item?.otDate || '').trim(),
    }))
    .filter((item) => item.employeeId)
}

function removeDuplicateEmployeesFromSelection(duplicates = []) {
  const duplicateIdSet = new Set(
    duplicates.map((item) => String(item.employeeId || '').trim()).filter(Boolean),
  )

  if (!duplicateIdSet.size) return 0

  const beforeCount = selectedEmployees.value.length

  selectedEmployees.value = selectedEmployees.value.filter((item) => {
    const employeeId = String(
      item?._id ||
        item?.id ||
        item?.employeeId ||
        '',
    ).trim()

    return !duplicateIdSet.has(employeeId)
  })

  return beforeCount - selectedEmployees.value.length
}

function buildDuplicateToastMessage(duplicates = []) {
  const preview = duplicates
    .slice(0, 5)
    .map((item) => {
      const employeeLabel =
        item.employeeLabel ||
        [item.employeeCode, item.employeeName].filter(Boolean).join(' - ') ||
        item.employeeId

      return item.requestNo ? `${employeeLabel} (${item.requestNo})` : employeeLabel
    })
    .join(', ')

  const moreText = duplicates.length > 5 ? ` and ${duplicates.length - 5} more` : ''

  return `These employees already have OT request on this date. Removed from selection: ${preview}${moreText}.`
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
    const duplicates = normalizeDuplicateEmployees(error)

    if (duplicates.length) {
      const removedCount = removeDuplicateEmployeesFromSelection(duplicates)

      toast.add({
        severity: 'warn',
        summary: 'Duplicate OT employees',
        detail:
          removedCount > 0
            ? buildDuplicateToastMessage(duplicates)
            : error?.response?.data?.message ||
              buildDuplicateToastMessage(duplicates),
        life: 8000,
      })

      await loadUnavailableEmployeesForDate()
      return
    }

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
  <div class="ot-create-page">
    <OTEmployeeMultiPicker
      v-model="selectedEmployees"
      auto-select-all
      :auto-select-ready="Boolean(form.otDate) && !loadingUnavailableEmployees"
      :blocked-employee-map="unavailableEmployeeMap"
      :blocked-loading="loadingUnavailableEmployees"
    />

    <div class="ot-create-bottom-grid">
      <OTDetailView
        :form="form"
        :selected-employee-count="selectedEmployeeIds.length"
        :selected-shift-state="selectedShiftState"
        :shift-options="shiftOptions"
        :loading-shift-options="loadingShiftOptions"
        :selected-ot-option="selectedOTOption"
        :request-preview="requestPreview"
      />

      <div class="ot-approval-side">
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
          :disabled="loadingRequester || loadingApproverChain || loadingShiftOptions || loadingUnavailableEmployees"
          @submit="submit"
          @back="goBack"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ot-create-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ot-create-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}

.ot-approval-side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 1280px) {
  .ot-create-bottom-grid {
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
    align-items: start;
  }
}
</style>