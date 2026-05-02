<!-- frontend/src/modules/ot/views/OTRequestDetailView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestDetailView.vue

import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import { useAuthStore } from '@/modules/auth/auth.store'
import {
  getOTRequestById,
  requesterConfirmOTRequest,
} from '@/modules/ot/ot.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const loading = ref(false)
const actionLoading = ref(false)
const detail = ref(null)
const requesterRemark = ref('')

const employeeListType = ref('APPROVED')
const employeeKeyword = ref('')

const requestId = computed(() => String(route.params.id || '').trim())

const canUpdateRequest = computed(() => auth.hasAnyPermission(['OT_REQUEST_UPDATE']))
const canVerifyAttendance = computed(() => auth.hasAnyPermission(['ATTENDANCE_VERIFY']))
const canRequesterConfirmAction = computed(
  () => canUpdateRequest.value && !!detail.value?.canRequesterConfirm,
)

const requestedEmployees = computed(() =>
  Array.isArray(detail.value?.requestedEmployees) ? detail.value.requestedEmployees : [],
)

const approvedEmployees = computed(() =>
  Array.isArray(detail.value?.approvedEmployees) ? detail.value.approvedEmployees : [],
)

const proposedApprovedEmployees = computed(() =>
  Array.isArray(detail.value?.proposedApprovedEmployees)
    ? detail.value.proposedApprovedEmployees
    : [],
)

const removedEmployees = computed(() => {
  const finalList = proposedApprovedEmployees.value.length
    ? proposedApprovedEmployees.value
    : approvedEmployees.value

  const finalIdSet = new Set(
    finalList
      .map((item) => String(item?.employeeId || '').trim())
      .filter(Boolean),
  )

  return requestedEmployees.value.filter((item) => {
    const employeeId = String(item?.employeeId || '').trim()
    return employeeId && !finalIdSet.has(employeeId)
  })
})

const approvalSteps = computed(() =>
  Array.isArray(detail.value?.approvalSteps) ? detail.value.approvalSteps : [],
)

const isLegacyManualMode = computed(() => {
  const shiftId = String(detail.value?.shiftId || '').trim()
  const shiftOtOptionId = String(detail.value?.shiftOtOptionId || '').trim()

  return !shiftId && !shiftOtOptionId
})

const comparisonSummary = computed(() => detail.value?.comparisonSummary || {})

const requestWindowLabel = computed(() => {
  const start = String(detail.value?.requestStartTime || detail.value?.startTime || '').trim()
  const end = String(detail.value?.requestEndTime || detail.value?.endTime || '').trim()

  if (!start && !end) return '-'

  return [start, end].filter(Boolean).join(' - ')
})

const modeLabel = computed(() =>
  isLegacyManualMode.value ? 'Legacy Manual' : 'Shift OT Option',
)

const modeSeverity = computed(() =>
  isLegacyManualMode.value ? 'contrast' : 'info',
)

const employeeListOptions = computed(() => {
  const options = [
    {
      label: `Approved (${approvedEmployees.value.length})`,
      value: 'APPROVED',
    },
    {
      label: `Requested (${requestedEmployees.value.length})`,
      value: 'REQUESTED',
    },
  ]

  if (proposedApprovedEmployees.value.length) {
    options.push({
      label: `Proposed (${proposedApprovedEmployees.value.length})`,
      value: 'PROPOSED',
    })
  }

  if (removedEmployees.value.length) {
    options.push({
      label: `Removed (${removedEmployees.value.length})`,
      value: 'REMOVED',
    })
  }

  return options
})

const activeEmployeeRows = computed(() => {
  if (employeeListType.value === 'REQUESTED') return requestedEmployees.value
  if (employeeListType.value === 'PROPOSED') return proposedApprovedEmployees.value
  if (employeeListType.value === 'REMOVED') return removedEmployees.value

  return approvedEmployees.value
})

const filteredEmployeeRows = computed(() => {
  const keyword = String(employeeKeyword.value || '').trim().toLowerCase()

  if (!keyword) return activeEmployeeRows.value

  return activeEmployeeRows.value.filter((employee) => {
    const text = [
      employee?.employeeCode,
      employee?.employeeName,
      employee?.departmentName,
      employee?.positionName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return text.includes(keyword)
  })
})

function normalizePayload(res) {
  return res?.data?.data || res?.data || null
}

function upper(value) {
  return String(value || '').trim().toUpperCase()
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(value)
  }
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

function getStatusSeverity(status) {
  switch (upper(status)) {
    case 'APPROVED':
      return 'success'
    case 'PENDING':
    case 'PENDING_REQUESTER_CONFIRMATION':
      return 'warning'
    case 'REJECTED':
    case 'REQUESTER_DISAGREED':
      return 'danger'
    case 'CANCELLED':
      return 'secondary'
    default:
      return 'contrast'
  }
}

function getDayTypeSeverity(dayType) {
  switch (upper(dayType)) {
    case 'HOLIDAY':
      return 'danger'
    case 'SUNDAY':
      return 'warning'
    case 'WORKING_DAY':
      return 'success'
    default:
      return 'secondary'
  }
}

function getApprovalStepSeverity(status) {
  switch (upper(status)) {
    case 'APPROVED':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'REJECTED':
      return 'danger'
    case 'WAITING':
      return 'secondary'
    default:
      return 'contrast'
  }
}

function getRequesterConfirmationSeverity(status) {
  switch (upper(status)) {
    case 'AGREED':
    case 'CONFIRMED':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'DISAGREED':
      return 'danger'
    case 'NOT_REQUIRED':
      return 'secondary'
    default:
      return 'contrast'
  }
}

function approverLabel(row) {
  const code = String(row?.approverCode || '').trim()
  const name = String(row?.approverName || '').trim()

  if (code && name) return `${code} - ${name}`
  if (code) return code
  if (name) return name

  return '-'
}

function safeNumber(value) {
  const numberValue = Number(value || 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function policyValue(key, fallback = '-') {
  const policy = detail.value?.otCalculationPolicySnapshot || {}
  const value = policy[key]

  if (value === true) return 'YES'
  if (value === false) return 'NO'
  if (value === 0) return 0

  return value || fallback
}

async function fetchDetail() {
  if (!requestId.value) return

  loading.value = true

  try {
    const res = await getOTRequestById(requestId.value)
    detail.value = normalizePayload(res)

    if (
      (employeeListType.value === 'PROPOSED' && !proposedApprovedEmployees.value.length) ||
      (employeeListType.value === 'REMOVED' && !removedEmployees.value.length)
    ) {
      employeeListType.value = 'APPROVED'
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load OT request detail.',
      life: 3500,
    })
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/ot/requests')
}

function goEdit() {
  if (!requestId.value || !canUpdateRequest.value) return
  router.push(`/ot/requests/${requestId.value}/edit`)
}

function goVerifyAttendance() {
  if (!requestId.value || !canVerifyAttendance.value) return
  router.push(`/attendance/ot-verification/${requestId.value}`)
}

async function submitRequesterConfirmation(action) {
  if (!requestId.value || actionLoading.value) return
  if (!canRequesterConfirmAction.value) return

  const remark = String(requesterRemark.value || '').trim()

  if (action === 'DISAGREE' && !remark) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Remark is required when disagreeing.',
      life: 2500,
    })
    return
  }

  actionLoading.value = true

  try {
    const res = await requesterConfirmOTRequest(requestId.value, {
      action,
      remark,
    })

    detail.value = normalizePayload(res)
    requesterRemark.value = ''
    employeeListType.value = 'APPROVED'

    toast.add({
      severity: 'success',
      summary: 'Updated',
      detail:
        action === 'AGREE'
          ? 'Requester confirmation completed successfully.'
          : 'Requester disagreement submitted successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Action failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to submit requester confirmation.',
      life: 3500,
    })
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>

<template>
  <div class="ot-page">
    <section class="ot-page-header">
      <div class="min-w-0">
        <div class="ot-title-row">
          <Button
            icon="pi pi-arrow-left"
            severity="secondary"
            text
            rounded
            size="small"
            aria-label="Back"
            @click="goBack"
          />

          <div class="min-w-0">
            <div class="ot-title-line">
              <h1>OT Request Detail</h1>

              <span
                v-if="detail?.requestNo"
                class="ot-request-badge"
              >
                {{ detail.requestNo }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="detail"
          class="ot-tag-row"
        >
          <Tag
            :value="detail.status || '-'"
            :severity="getStatusSeverity(detail.status)"
            class="ot-soft-tag"
          />

          <Tag
            :value="detail.dayType || '-'"
            :severity="getDayTypeSeverity(detail.dayType)"
            class="ot-soft-tag"
          />

          <Tag
            :value="modeLabel"
            :severity="modeSeverity"
            class="ot-soft-tag"
          />

          <Tag
            :value="`Requester: ${detail.requesterConfirmationStatus || '-'}`"
            :severity="getRequesterConfirmationSeverity(detail.requesterConfirmationStatus)"
            class="ot-soft-tag"
          />
        </div>
      </div>

      <div class="ot-header-actions">
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          outlined
          size="small"
          :loading="loading"
          @click="fetchDetail"
        />

        <Button
          v-if="canVerifyAttendance"
          label="Verify Attendance"
          icon="pi pi-check-square"
          severity="success"
          outlined
          size="small"
          @click="goVerifyAttendance"
        />

        <Button
          v-if="detail?.canEdit && canUpdateRequest"
          label="Edit"
          icon="pi pi-pencil"
          size="small"
          @click="goEdit"
        />
      </div>
    </section>

    <div
      v-if="loading"
      class="ot-empty-state"
    >
      Loading OT request...
    </div>

    <template v-else-if="detail">
      <Message
        v-if="canRequesterConfirmAction"
        severity="warn"
        :closable="false"
        class="ot-message"
      >
        This request is waiting for requester confirmation because the approver adjusted the approved employee list.
      </Message>

      <section
        v-if="canRequesterConfirmAction"
        class="ot-section ot-confirm-section"
      >
        <div class="ot-section-header">
          <div>
            <h2>Requester Confirmation</h2>
          </div>
        </div>

        <div class="ot-metric-grid three">
          <div class="ot-metric-card">
            <span>Requested Staff</span>
            <strong>{{ comparisonSummary.requestedEmployeeCount ?? 0 }}</strong>
          </div>

          <div class="ot-metric-card">
            <span>Current Approved</span>
            <strong>{{ comparisonSummary.approvedEmployeeCount ?? 0 }}</strong>
          </div>

          <div class="ot-metric-card">
            <span>Proposed Approved</span>
            <strong>{{ comparisonSummary.proposedApprovedEmployeeCount ?? 0 }}</strong>
          </div>
        </div>

        <div class="ot-field-block">
          <label>Remark</label>

          <Textarea
            v-model.trim="requesterRemark"
            rows="3"
            autoResize
            class="w-full"
            placeholder="Optional for Agree, required for Disagree"
          />
        </div>

        <div class="ot-action-row">
          <Button
            label="Agree"
            icon="pi pi-check"
            size="small"
            :loading="actionLoading"
            @click="submitRequesterConfirmation('AGREE')"
          />

          <Button
            label="Disagree"
            icon="pi pi-times"
            severity="danger"
            outlined
            size="small"
            :loading="actionLoading"
            @click="submitRequesterConfirmation('DISAGREE')"
          />
        </div>
      </section>

      <section class="ot-metric-grid">
        <div class="ot-metric-card">
          <span>Requester</span>
          <strong>{{ detail.requesterName || '-' }}</strong>
          <small>{{ detail.requesterEmployeeNo || '-' }}</small>
        </div>

        <div class="ot-metric-card">
          <span>OT Date</span>
          <strong>{{ detail.otDate || '-' }}</strong>
          <small>{{ detail.dayType || '-' }}</small>
        </div>

        <div class="ot-metric-card">
          <span>Current Step</span>
          <strong>{{ detail.currentApprovalStep ?? 1 }}</strong>
          <small>{{ approvalSteps.length }} total step(s)</small>
        </div>

        <div class="ot-metric-card">
          <span>Requested Staff</span>
          <strong>{{ detail.requestedEmployeeCount ?? 0 }}</strong>
          <small>Original list</small>
        </div>

        <div class="ot-metric-card">
          <span>Approved Staff</span>
          <strong>{{ detail.approvedEmployeeCount ?? 0 }}</strong>
          <small>Current list</small>
        </div>

        <div class="ot-metric-card">
          <span>Duration</span>
          <strong>{{ formatMinutesLabel(detail.requestedMinutes ?? detail.totalMinutes ?? 0) }}</strong>
          <small>{{ safeNumber(detail.requestedMinutes ?? detail.totalMinutes) }} min</small>
        </div>
      </section>

      <section class="ot-two-column">
        <div class="ot-section wide">
          <div class="ot-section-header">
            <div>
              <h2>OT Request Summary</h2>
            </div>
          </div>

          <div class="ot-info-grid three">
            <div class="ot-info-item">
              <span>Request Window</span>
              <strong>{{ requestWindowLabel }}</strong>
            </div>

            <div class="ot-info-item">
              <span>Requested Minutes</span>
              <strong>{{ detail.requestedMinutes ?? detail.totalMinutes ?? 0 }}</strong>
            </div>

            <div class="ot-info-item">
              <span>Requested Duration</span>
              <strong>{{ formatMinutesLabel(detail.requestedMinutes ?? detail.totalMinutes ?? 0) }}</strong>
            </div>

            <div class="ot-info-item">
              <span>Legacy Start</span>
              <strong>{{ detail.startTime || '-' }}</strong>
            </div>

            <div class="ot-info-item">
              <span>Legacy End</span>
              <strong>{{ detail.endTime || '-' }}</strong>
            </div>

            <div class="ot-info-item">
              <span>Break Minutes</span>
              <strong>{{ detail.breakMinutes ?? 0 }}</strong>
            </div>
          </div>

          <div class="ot-reason-box">
            <span>Reason</span>
            <p>{{ detail.reason || '-' }}</p>
          </div>
        </div>

        <div class="ot-section">
          <div class="ot-section-header">
            <div>
              <h2>Shift / OT Option</h2>
            </div>
          </div>

          <div class="ot-info-list">
            <div class="ot-info-line">
              <span>Shift</span>
              <strong>
                {{ detail.shiftCode || '-' }}
                {{ detail.shiftName ? `· ${detail.shiftName}` : '' }}
              </strong>
            </div>

            <div class="ot-info-line">
              <span>Shift Type</span>
              <strong>{{ detail.shiftType || '-' }}</strong>
            </div>

            <div class="ot-info-line">
              <span>Shift Start</span>
              <strong>{{ detail.shiftStartTime || '-' }}</strong>
            </div>

            <div class="ot-info-line">
              <span>Shift End</span>
              <strong>{{ detail.shiftEndTime || '-' }}</strong>
            </div>

            <div class="ot-info-line">
              <span>Cross Midnight</span>
              <strong>
                {{
                  detail.shiftCrossMidnight === true
                    ? 'YES'
                    : detail.shiftCrossMidnight === false
                      ? 'NO'
                      : '-'
                }}
              </strong>
            </div>

            <div class="ot-info-line">
              <span>OT Option</span>
              <strong>{{ detail.shiftOtOptionLabel || '-' }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="detail.otCalculationPolicySnapshot && (detail.otCalculationPolicySnapshot.code || detail.otCalculationPolicySnapshot.name)"
        class="ot-section"
      >
        <div class="ot-section-header">
          <div>
            <h2>Policy Snapshot</h2>
          </div>
        </div>

        <div class="ot-info-grid four">
          <div class="ot-info-item">
            <span>Policy Code</span>
            <strong>{{ policyValue('code') }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Policy Name</span>
            <strong>{{ policyValue('name') }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Min Eligible</span>
            <strong>{{ policyValue('minEligibleMinutes', 0) }} min</strong>
          </div>

          <div class="ot-info-item">
            <span>Round Unit</span>
            <strong>{{ policyValue('roundUnitMinutes', 0) }} min</strong>
          </div>

          <div class="ot-info-item">
            <span>Round Method</span>
            <strong>{{ policyValue('roundMethod') }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Grace After Shift End</span>
            <strong>{{ policyValue('graceAfterShiftEndMinutes', 0) }} min</strong>
          </div>

          <div class="ot-info-item">
            <span>Allow Pre-Shift OT</span>
            <strong>{{ policyValue('allowPreShiftOT') }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Allow Post-Shift OT</span>
            <strong>{{ policyValue('allowPostShiftOT') }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Cap By Request</span>
            <strong>{{ policyValue('capByRequestedMinutes') }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Forget Scan In Pending</span>
            <strong>{{ policyValue('treatForgetScanInAsPending') }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Forget Scan Out Pending</span>
            <strong>{{ policyValue('treatForgetScanOutAsPending') }}</strong>
          </div>
        </div>
      </section>

      <section class="ot-section">
        <div class="ot-section-header employee-header">
          <div>
            <h2>Employees</h2>
          </div>

          <div class="employee-tools">
            <Select
              v-model="employeeListType"
              :options="employeeListOptions"
              optionLabel="label"
              optionValue="value"
              size="small"
              class="employee-list-select"
            />

            <IconField class="employee-search">
              <InputIcon class="pi pi-search" />

              <InputText
                v-model="employeeKeyword"
                placeholder="Search employee"
                size="small"
                class="w-full"
              />
            </IconField>
          </div>
        </div>

        <div class="employee-count-row">
          <Tag
            :value="`Requested ${requestedEmployees.length}`"
            severity="secondary"
            class="ot-soft-tag"
          />

          <Tag
            :value="`Approved ${approvedEmployees.length}`"
            severity="info"
            class="ot-soft-tag"
          />

          <Tag
            v-if="proposedApprovedEmployees.length"
            :value="`Proposed ${proposedApprovedEmployees.length}`"
            severity="warning"
            class="ot-soft-tag"
          />

          <Tag
            v-if="removedEmployees.length"
            :value="`Removed ${removedEmployees.length}`"
            severity="danger"
            class="ot-soft-tag"
          />

          <span class="employee-filter-count">
            Showing {{ filteredEmployeeRows.length }} of {{ activeEmployeeRows.length }}
          </span>
        </div>

        <DataTable
          :value="filteredEmployeeRows"
          dataKey="employeeId"
          scrollable
          scrollHeight="320px"
          size="small"
          class="ot-compact-table"
        >
          <template #empty>
            <div class="ot-table-empty">
              No employees found.
            </div>
          </template>

          <Column
            header="Employee"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <div class="ot-person-cell">
                <strong>{{ data.employeeName || '-' }}</strong>
                <small>{{ data.employeeCode || '-' }}</small>
              </div>
            </template>
          </Column>

          <Column
            header="Work Info"
            style="min-width: 18rem"
          >
            <template #body="{ data }">
              <div class="ot-person-cell">
                <strong>{{ data.positionName || '-' }}</strong>
                <small>{{ data.departmentName || '-' }}</small>
              </div>
            </template>
          </Column>
        </DataTable>
      </section>

      <section class="ot-section">
        <div class="ot-section-header compact">
          <div>
            <h2>Approval Steps</h2>
            <p>{{ approvalSteps.length }} approval step(s)</p>
          </div>
        </div>

        <DataTable
          :value="approvalSteps"
          dataKey="stepNo"
          scrollable
          scrollHeight="360px"
          size="small"
          class="ot-compact-table"
        >
          <template #empty>
            <div class="ot-table-empty">
              No approval steps found.
            </div>
          </template>

          <Column
            field="stepNo"
            header="Step"
            style="min-width: 5rem"
          />

          <Column
            header="Approver"
            style="min-width: 15rem"
          >
            <template #body="{ data }">
              <div class="ot-person-cell">
                <strong>{{ approverLabel(data) }}</strong>
                <small>Step {{ data.stepNo || '-' }}</small>
              </div>
            </template>
          </Column>

          <Column
            header="Status"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                :value="data.status || '-'"
                :severity="getApprovalStepSeverity(data.status)"
                class="ot-soft-tag"
              />
            </template>
          </Column>

          <Column
            field="actedAt"
            header="Acted At"
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              {{ formatDateTime(data.actedAt) }}
            </template>
          </Column>

          <Column
            field="remark"
            header="Remark"
            style="min-width: 18rem"
          >
            <template #body="{ data }">
              <span class="ot-muted-text">{{ data.remark || '-' }}</span>
            </template>
          </Column>
        </DataTable>
      </section>

      <section
        v-if="detail.lastAdjustmentByEmployeeName || detail.requesterConfirmationRemark"
        class="ot-section"
      >
        <div class="ot-section-header">
          <div>
            <h2>Adjustment / Confirmation</h2>
          </div>
        </div>

        <div class="ot-info-grid four">
          <div class="ot-info-item">
            <span>Last Adjustment By</span>
            <strong>{{ detail.lastAdjustmentByEmployeeName || '-' }}</strong>
            <small>{{ detail.lastAdjustmentByEmployeeNo || '' }}</small>
          </div>

          <div class="ot-info-item">
            <span>Last Adjustment At</span>
            <strong>{{ formatDateTime(detail.lastAdjustmentAt) }}</strong>
          </div>

          <div class="ot-info-item wide">
            <span>Last Adjustment Remark</span>
            <strong>{{ detail.lastAdjustmentRemark || '-' }}</strong>
          </div>

          <div class="ot-info-item">
            <span>Requester Confirmed At</span>
            <strong>{{ formatDateTime(detail.requesterConfirmedAt) }}</strong>
          </div>

          <div class="ot-info-item wide">
            <span>Requester Confirmation Remark</span>
            <strong>{{ detail.requesterConfirmationRemark || '-' }}</strong>
          </div>
        </div>
      </section>
    </template>

    <div
      v-else
      class="ot-empty-state"
    >
      OT request not found.
    </div>
  </div>
</template>

<style scoped>
.ot-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ot-page-header,
.ot-section,
.ot-empty-state {
  border: 1px solid var(--ot-line);
  background: var(--ot-card);
  border-radius: 1.15rem;
  box-shadow: var(--ot-shadow);
}

.ot-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.ot-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
}

.ot-title-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.ot-title-line h1 {
  margin: 0;
  color: var(--ot-text-main);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
}

.ot-subtitle {
  margin: 0.18rem 0 0;
  color: var(--ot-text-soft);
  font-size: 0.82rem;
  line-height: 1.45;
}

.ot-request-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ot-line);
  background: var(--ot-soft-bg);
  color: var(--ot-text-main);
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
  font-size: 0.73rem;
  font-weight: 700;
}

.ot-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
  padding-left: 2.7rem;
}

.ot-header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-message {
  border-radius: 1rem;
}

.ot-confirm-section {
  border-color: rgba(245, 158, 11, 0.45);
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.08), transparent 50%),
    var(--ot-card);
}

.ot-section {
  padding: 1rem;
}

.ot-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.ot-section-header.compact {
  margin-bottom: 0.65rem;
}

.ot-section-header h2 {
  margin: 0;
  color: var(--ot-text-main);
  font-size: 0.98rem;
  font-weight: 700;
}

.ot-section-header p {
  margin: 0.18rem 0 0;
  color: var(--ot-text-soft);
  font-size: 0.78rem;
  line-height: 1.45;
}

.ot-two-column {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 1rem;
}

.ot-metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.75rem;
}

.ot-metric-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ot-metric-card {
  border: 1px solid var(--ot-line);
  background: var(--ot-card);
  border-radius: 1rem;
  padding: 0.8rem;
  min-width: 0;
}

.ot-metric-card span,
.ot-info-item span,
.ot-info-line span,
.ot-reason-box span,
.ot-field-block label {
  display: block;
  color: var(--ot-text-soft);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}

.ot-metric-card strong {
  display: block;
  margin-top: 0.28rem;
  color: var(--ot-text-main);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.25;
  word-break: break-word;
}

.ot-metric-card small,
.ot-info-item small {
  display: block;
  margin-top: 0.2rem;
  color: var(--ot-text-soft);
  font-size: 0.72rem;
}

.ot-info-grid {
  display: grid;
  gap: 0.7rem;
}

.ot-info-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ot-info-grid.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.ot-info-item {
  border: 1px solid var(--ot-line);
  background: var(--ot-soft-bg);
  border-radius: 0.95rem;
  padding: 0.75rem;
  min-width: 0;
}

.ot-info-item.wide {
  grid-column: span 2;
}

.ot-info-item strong {
  display: block;
  margin-top: 0.25rem;
  color: var(--ot-text-main);
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.ot-info-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.ot-info-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-line);
  background: var(--ot-soft-bg);
  border-radius: 0.9rem;
  padding: 0.7rem 0.75rem;
}

.ot-info-line strong {
  color: var(--ot-text-main);
  font-size: 0.86rem;
  font-weight: 700;
  text-align: right;
  word-break: break-word;
}

.ot-reason-box {
  margin-top: 0.8rem;
  border: 1px solid var(--ot-line);
  background: var(--ot-soft-bg);
  border-radius: 0.95rem;
  padding: 0.85rem;
}

.ot-reason-box p {
  margin: 0.3rem 0 0;
  color: var(--ot-text-main);
  font-size: 0.88rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

.ot-field-block {
  margin-top: 0.85rem;
}

.ot-field-block label {
  margin-bottom: 0.35rem;
}

.ot-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.85rem;
}

.employee-header {
  align-items: center;
}

.employee-tools {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.employee-list-select {
  width: 13rem;
}

.employee-search {
  width: 16rem;
}

.employee-count-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.7rem;
}

.employee-filter-count {
  color: var(--ot-text-soft);
  font-size: 0.76rem;
  font-weight: 600;
  margin-left: auto;
}

.ot-person-cell {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.ot-person-cell strong {
  color: var(--ot-text-main);
  font-size: 0.83rem;
  font-weight: 700;
  line-height: 1.35;
}

.ot-person-cell small,
.ot-muted-text {
  color: var(--ot-text-soft);
  font-size: 0.75rem;
}

.ot-table-empty,
.ot-empty-state {
  color: var(--ot-text-soft);
  text-align: center;
  font-size: 0.85rem;
}

.ot-table-empty {
  padding: 1.75rem 1rem;
}

.ot-empty-state {
  padding: 2.5rem 1rem;
}

:deep(.ot-soft-tag.p-tag) {
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  padding: 0.2rem 0.55rem;
}

:deep(.ot-compact-table) {
  border: 1px solid var(--ot-line);
  border-radius: 0.95rem;
  overflow: hidden;
}

:deep(.ot-compact-table .p-datatable-thead > tr > th) {
  background: var(--ot-table-head) !important;
  color: var(--ot-text-soft) !important;
  padding: 0.62rem 0.75rem !important;
  font-size: 0.74rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.035em;
  text-transform: uppercase;
  white-space: nowrap;
  border-color: var(--ot-line) !important;
}

:deep(.ot-compact-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.75rem !important;
  font-size: 0.82rem !important;
  vertical-align: middle !important;
  border-color: var(--ot-line) !important;
}

:deep(.ot-compact-table .p-datatable-tbody > tr) {
  background: var(--ot-card) !important;
}

:deep(.ot-compact-table .p-datatable-tbody > tr:hover) {
  background: var(--ot-row-hover) !important;
}

:deep(.p-button.p-button-sm) {
  border-radius: 0.65rem;
}

:deep(.p-inputtextarea),
:deep(.p-inputtext),
:deep(.p-select) {
  border-radius: 0.75rem;
}

.ot-page {
  --ot-card: var(--p-content-background, var(--surface-card, #ffffff));
  --ot-soft-bg: var(--p-surface-50, #f8fafc);
  --ot-table-head: var(--p-surface-50, #f8fafc);
  --ot-row-hover: var(--p-surface-100, #f1f5f9);
  --ot-line: var(--p-content-border-color, var(--surface-border, #e2e8f0));
  --ot-text-main: var(--p-text-color, #0f172a);
  --ot-text-soft: var(--p-text-muted-color, #64748b);
  --ot-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

:global(.dark) .ot-page {
  --ot-card: var(--p-content-background, #111827);
  --ot-soft-bg: rgba(148, 163, 184, 0.08);
  --ot-table-head: rgba(148, 163, 184, 0.08);
  --ot-row-hover: rgba(148, 163, 184, 0.1);
  --ot-line: rgba(148, 163, 184, 0.22);
  --ot-text-main: #e5e7eb;
  --ot-text-soft: #94a3b8;
  --ot-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
}

@media (max-width: 1280px) {
  .ot-metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ot-info-grid.four {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-two-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ot-page-header {
    flex-direction: column;
  }

  .ot-header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .ot-tag-row {
    padding-left: 0;
  }

  .ot-metric-grid,
  .ot-metric-grid.three,
  .ot-info-grid.three,
  .ot-info-grid.four {
    grid-template-columns: 1fr;
  }

  .ot-info-item.wide {
    grid-column: span 1;
  }

  .ot-info-line {
    flex-direction: column;
    gap: 0.25rem;
  }

  .ot-info-line strong {
    text-align: left;
  }

  .employee-header {
    align-items: flex-start;
  }

  .employee-tools {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .employee-list-select,
  .employee-search {
    width: 100%;
  }

  .employee-filter-count {
    width: 100%;
    margin-left: 0;
  }
}
</style>