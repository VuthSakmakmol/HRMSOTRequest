<!-- frontend/src/modules/ot/views/OTRequestDetailView.vue -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import {
  getOTRequestById,
  requesterConfirmOTRequest,
} from '@/modules/ot/ot.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const actionLoading = ref(false)
const detail = ref(null)
const requesterRemark = ref('')

const requestId = computed(() => String(route.params.id || '').trim())

const requestedEmployees = computed(() =>
  Array.isArray(detail.value?.requestedEmployees) ? detail.value.requestedEmployees : [],
)

const approvedEmployees = computed(() =>
  Array.isArray(detail.value?.approvedEmployees) ? detail.value.approvedEmployees : [],
)

const proposedApprovedEmployees = computed(() =>
  Array.isArray(detail.value?.proposedApprovedEmployees) ? detail.value.proposedApprovedEmployees : [],
)

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

function normalizePayload(res) {
  return res?.data?.data || res?.data || null
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
  switch (String(status || '').toUpperCase()) {
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
  switch (String(dayType || '').toUpperCase()) {
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
  switch (String(status || '').toUpperCase()) {
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

function personLabel(row) {
  const code = String(row?.employeeCode || '').trim()
  const name = String(row?.employeeName || '').trim()

  if (code && name) return `${code} - ${name}`
  if (code) return code
  if (name) return name
  return '-'
}

function approverLabel(row) {
  const code = String(row?.approverCode || '').trim()
  const name = String(row?.approverName || '').trim()

  if (code && name) return `${code} - ${name}`
  if (code) return code
  if (name) return name
  return '-'
}

async function fetchDetail() {
  if (!requestId.value) return

  loading.value = true

  try {
    const res = await getOTRequestById(requestId.value)
    detail.value = normalizePayload(res)
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
  if (!requestId.value) return
  router.push(`/ot/requests/${requestId.value}/edit`)
}

function goVerifyAttendance() {
  if (!requestId.value) return
  router.push(`/attendance/ot-verification/${requestId.value}`)
}

async function submitRequesterConfirmation(action) {
  if (!requestId.value || actionLoading.value) return
  if (!detail.value?.canRequesterConfirm) return

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
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
            OT Request Detail
          </h1>

          <Tag
            v-if="detail"
            :value="detail.status || '-'"
            :severity="getStatusSeverity(detail.status)"
          />

          <Tag
            v-if="detail"
            :value="detail.dayType || '-'"
            :severity="getDayTypeSeverity(detail.dayType)"
          />

          <Tag
            v-if="detail"
            :value="isLegacyManualMode ? 'LEGACY MANUAL MODE' : 'SHIFT OT OPTION MODE'"
            :severity="isLegacyManualMode ? 'contrast' : 'info'"
          />
        </div>

        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          View OT request, approval flow, employee adjustments, and verify attendance from this request.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          label="Back"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          size="small"
          @click="goBack"
        />
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          outlined
          size="small"
          :loading="loading"
          @click="fetchDetail"
        />
        <Button
          label="Verify Attendance"
          icon="pi pi-check-square"
          severity="success"
          outlined
          size="small"
          @click="goVerifyAttendance"
        />
        <Button
          v-if="detail?.canEdit"
          label="Edit"
          icon="pi pi-pencil"
          size="small"
          @click="goEdit"
        />
      </div>
    </div>

    <div
      v-if="loading"
      class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
    >
      Loading OT request...
    </div>

    <template v-else-if="detail">
      <Message
        v-if="detail.canRequesterConfirm"
        severity="warn"
        :closable="false"
      >
        This request is waiting for requester confirmation because the approver adjusted the approved employee list.
      </Message>

      <div
        v-if="detail.canRequesterConfirm"
        class="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
      >
        <div class="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
          Requester Confirmation
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div class="ot-info-box border-amber-200 dark:border-amber-800">
            <div class="ot-info-label">Requested Staff</div>
            <div class="ot-info-value">
              {{ comparisonSummary.requestedEmployeeCount ?? 0 }}
            </div>
          </div>

          <div class="ot-info-box border-amber-200 dark:border-amber-800">
            <div class="ot-info-label">Current Approved Staff</div>
            <div class="ot-info-value">
              {{ comparisonSummary.approvedEmployeeCount ?? 0 }}
            </div>
          </div>

          <div class="ot-info-box border-amber-200 dark:border-amber-800">
            <div class="ot-info-label">Proposed Approved Staff</div>
            <div class="ot-info-value">
              {{ comparisonSummary.proposedApprovedEmployeeCount ?? 0 }}
            </div>
          </div>
        </div>

        <div class="mt-4 space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Remark
          </label>
          <Textarea
            v-model.trim="requesterRemark"
            rows="4"
            autoResize
            class="w-full"
            placeholder="Optional for Agree, required for Disagree"
          />
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <Button
            label="Agree"
            icon="pi pi-check"
            :loading="actionLoading"
            @click="submitRequesterConfirmation('AGREE')"
          />
          <Button
            label="Disagree"
            icon="pi pi-times"
            severity="danger"
            outlined
            :loading="actionLoading"
            @click="submitRequesterConfirmation('DISAGREE')"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div class="ot-summary-box">
          <div class="ot-summary-label">Request No</div>
          <div class="ot-summary-value">{{ detail.requestNo || '-' }}</div>
        </div>

        <div class="ot-summary-box">
          <div class="ot-summary-label">Requester</div>
          <div class="ot-summary-value">{{ detail.requesterName || '-' }}</div>
          <div class="ot-summary-sub">{{ detail.requesterEmployeeNo || '-' }}</div>
        </div>

        <div class="ot-summary-box">
          <div class="ot-summary-label">OT Date</div>
          <div class="ot-summary-value">{{ detail.otDate || '-' }}</div>
        </div>

        <div class="ot-summary-box">
          <div class="ot-summary-label">Current Step</div>
          <div class="ot-summary-value">{{ detail.currentApprovalStep ?? 1 }}</div>
        </div>

        <div class="ot-summary-box">
          <div class="ot-summary-label">Requested Staff</div>
          <div class="ot-summary-value">{{ detail.requestedEmployeeCount ?? 0 }}</div>
        </div>

        <div class="ot-summary-box">
          <div class="ot-summary-label">Approved Staff</div>
          <div class="ot-summary-value">{{ detail.approvedEmployeeCount ?? 0 }}</div>
        </div>

        <div class="ot-summary-box">
          <div class="ot-summary-label">Proposed Approved</div>
          <div class="ot-summary-value">{{ detail.proposedApprovedEmployeeCount ?? 0 }}</div>
        </div>

        <div class="ot-summary-box">
          <div class="ot-summary-label">Requester Confirmation</div>
          <div class="ot-summary-value">{{ detail.requesterConfirmationStatus || '-' }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="ot-detail-card xl:col-span-2">
          <template #title>
            OT Request Summary
          </template>

          <template #content>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div class="ot-info-box">
                <div class="ot-info-label">Request Window</div>
                <div class="ot-info-value">{{ requestWindowLabel }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Requested Minutes</div>
                <div class="ot-info-value">{{ detail.requestedMinutes ?? detail.totalMinutes ?? 0 }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Requested Duration</div>
                <div class="ot-info-value">
                  {{ formatMinutesLabel(detail.requestedMinutes ?? detail.totalMinutes ?? 0) }}
                </div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Legacy Start Time</div>
                <div class="ot-info-value">{{ detail.startTime || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Legacy End Time</div>
                <div class="ot-info-value">{{ detail.endTime || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Break Minutes</div>
                <div class="ot-info-value">{{ detail.breakMinutes ?? 0 }}</div>
              </div>
            </div>

            <Divider />

            <div class="space-y-2">
              <div class="text-sm font-medium text-[color:var(--ot-text)]">Reason</div>
              <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4 text-sm leading-6 text-[color:var(--ot-text)]">
                {{ detail.reason || '-' }}
              </div>
            </div>
          </template>
        </Card>

        <Card class="ot-detail-card">
          <template #title>
            Shift / OT Option
          </template>

          <template #content>
            <div class="flex flex-col gap-3">
              <div class="ot-info-box">
                <div class="ot-info-label">Shift</div>
                <div class="ot-info-value">
                  {{ detail.shiftCode || '-' }} {{ detail.shiftName ? `· ${detail.shiftName}` : '' }}
                </div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Shift Type</div>
                <div class="ot-info-value">{{ detail.shiftType || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Shift Start</div>
                <div class="ot-info-value">{{ detail.shiftStartTime || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Shift End</div>
                <div class="ot-info-value">{{ detail.shiftEndTime || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Cross Midnight</div>
                <div class="ot-info-value">
                  {{
                    detail.shiftCrossMidnight === true
                      ? 'YES'
                      : detail.shiftCrossMidnight === false
                        ? 'NO'
                        : '-'
                  }}
                </div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">OT Option</div>
                <div class="ot-info-value">{{ detail.shiftOtOptionLabel || '-' }}</div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Card
        v-if="detail.otCalculationPolicySnapshot && (detail.otCalculationPolicySnapshot.code || detail.otCalculationPolicySnapshot.name)"
        class="ot-detail-card"
      >
        <template #title>
          Policy Snapshot
        </template>

        <template #content>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="ot-info-box">
              <div class="ot-info-label">Policy Code</div>
              <div class="ot-info-value">{{ detail.otCalculationPolicySnapshot.code || '-' }}</div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Policy Name</div>
              <div class="ot-info-value">{{ detail.otCalculationPolicySnapshot.name || '-' }}</div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Min Eligible</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.minEligibleMinutes ?? 0 }} min
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Round Unit</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.roundUnitMinutes ?? 0 }} min
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Round Method</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.roundMethod || '-' }}
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Grace After Shift End</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.graceAfterShiftEndMinutes ?? 0 }} min
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Allow Pre-Shift OT</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.allowPreShiftOT ? 'YES' : 'NO' }}
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Allow Post-Shift OT</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.allowPostShiftOT ? 'YES' : 'NO' }}
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Cap By Request</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.capByRequestedMinutes ? 'YES' : 'NO' }}
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Forget Scan In Pending</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.treatForgetScanInAsPending ? 'YES' : 'NO' }}
              </div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Forget Scan Out Pending</div>
              <div class="ot-info-value">
                {{ detail.otCalculationPolicySnapshot.treatForgetScanOutAsPending ? 'YES' : 'NO' }}
              </div>
            </div>
          </div>
        </template>
      </Card>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card class="ot-detail-card">
          <template #title>
            Requested Employees
          </template>

          <template #content>
            <DataTable
              :value="requestedEmployees"
              dataKey="employeeId"
              responsiveLayout="scroll"
              stripedRows
              size="small"
              class="ot-table"
            >
              <template #empty>
                <div class="py-6 text-center text-sm text-[color:var(--ot-text-muted)]">
                  No requested employees.
                </div>
              </template>

              <Column header="Employee" style="min-width: 14rem">
                <template #body="{ data }">
                  {{ personLabel(data) }}
                </template>
              </Column>
              <Column field="departmentName" header="Department" style="min-width: 10rem" />
              <Column field="positionName" header="Position" style="min-width: 10rem" />
            </DataTable>
          </template>
        </Card>

        <Card class="ot-detail-card">
          <template #title>
            Approved Employees
          </template>

          <template #content>
            <DataTable
              :value="approvedEmployees"
              dataKey="employeeId"
              responsiveLayout="scroll"
              stripedRows
              size="small"
              class="ot-table"
            >
              <template #empty>
                <div class="py-6 text-center text-sm text-[color:var(--ot-text-muted)]">
                  No approved employees.
                </div>
              </template>

              <Column header="Employee" style="min-width: 14rem">
                <template #body="{ data }">
                  {{ personLabel(data) }}
                </template>
              </Column>
              <Column field="departmentName" header="Department" style="min-width: 10rem" />
              <Column field="positionName" header="Position" style="min-width: 10rem" />
            </DataTable>
          </template>
        </Card>
      </div>

      <Card
        v-if="proposedApprovedEmployees.length"
        class="ot-detail-card"
      >
        <template #title>
          Proposed Approved Employees
        </template>

        <template #content>
          <DataTable
            :value="proposedApprovedEmployees"
            dataKey="employeeId"
            responsiveLayout="scroll"
            stripedRows
            size="small"
            class="ot-table"
          >
            <template #empty>
              <div class="py-6 text-center text-sm text-[color:var(--ot-text-muted)]">
                No proposed approved employees.
              </div>
            </template>

            <Column header="Employee" style="min-width: 14rem">
              <template #body="{ data }">
                {{ personLabel(data) }}
              </template>
            </Column>
            <Column field="departmentName" header="Department" style="min-width: 10rem" />
            <Column field="positionName" header="Position" style="min-width: 10rem" />
          </DataTable>
        </template>
      </Card>

      <Card class="ot-detail-card">
        <template #title>
          Approval Steps
        </template>

        <template #content>
          <DataTable
            :value="approvalSteps"
            dataKey="stepNo"
            responsiveLayout="scroll"
            stripedRows
            size="small"
            class="ot-table"
          >
            <template #empty>
              <div class="py-6 text-center text-sm text-[color:var(--ot-text-muted)]">
                No approval steps found.
              </div>
            </template>

            <Column field="stepNo" header="Step" style="min-width: 5rem" />
            <Column header="Approver" style="min-width: 14rem">
              <template #body="{ data }">
                {{ approverLabel(data) }}
              </template>
            </Column>
            <Column header="Status" style="min-width: 8rem">
              <template #body="{ data }">
                <Tag
                  :value="data.status || '-'"
                  :severity="getApprovalStepSeverity(data.status)"
                />
              </template>
            </Column>
            <Column field="actedAt" header="Acted At" style="min-width: 12rem">
              <template #body="{ data }">
                {{ formatDateTime(data.actedAt) }}
              </template>
            </Column>
            <Column field="remark" header="Remark" style="min-width: 16rem" />
          </DataTable>
        </template>
      </Card>

      <Card
        v-if="detail.lastAdjustmentByEmployeeName || detail.requesterConfirmationRemark"
        class="ot-detail-card"
      >
        <template #title>
          Adjustment / Confirmation
        </template>

        <template #content>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="ot-info-box">
              <div class="ot-info-label">Last Adjustment By</div>
              <div class="ot-info-value">{{ detail.lastAdjustmentByEmployeeName || '-' }}</div>
              <div class="ot-summary-sub">{{ detail.lastAdjustmentByEmployeeNo || '' }}</div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Last Adjustment At</div>
              <div class="ot-info-value">{{ formatDateTime(detail.lastAdjustmentAt) }}</div>
            </div>

            <div class="ot-info-box md:col-span-2 xl:col-span-2">
              <div class="ot-info-label">Last Adjustment Remark</div>
              <div class="ot-info-value">{{ detail.lastAdjustmentRemark || '-' }}</div>
            </div>

            <div class="ot-info-box">
              <div class="ot-info-label">Requester Confirmed At</div>
              <div class="ot-info-value">{{ formatDateTime(detail.requesterConfirmedAt) }}</div>
            </div>

            <div class="ot-info-box md:col-span-3">
              <div class="ot-info-label">Requester Confirmation Remark</div>
              <div class="ot-info-value">{{ detail.requesterConfirmationRemark || '-' }}</div>
            </div>
          </div>
        </template>
      </Card>
    </template>

    <div
      v-else
      class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
    >
      OT request not found.
    </div>
  </div>
</template>

<style scoped>
:deep(.ot-detail-card .p-card-body) {
  padding: 1rem !important;
}

:deep(.ot-detail-card .p-card-title) {
  font-size: 1rem !important;
  font-weight: 700 !important;
  color: var(--ot-text) !important;
}

:deep(.ot-table .p-datatable-thead > tr > th) {
  padding: 0.65rem 0.75rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

:deep(.ot-table .p-datatable-tbody > tr > td) {
  padding: 0.65rem 0.75rem !important;
  vertical-align: middle !important;
}

.ot-summary-box {
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  border-radius: 1rem;
  padding: 0.9rem;
}

.ot-summary-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-summary-value {
  margin-top: 0.35rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ot-text);
  word-break: break-word;
}

.ot-summary-sub {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: var(--ot-text-muted);
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