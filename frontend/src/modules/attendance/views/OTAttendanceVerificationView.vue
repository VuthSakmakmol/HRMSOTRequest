<!-- frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'

import { verifyOTAttendance } from '@/modules/attendance/attendance.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const otRequestId = ref(String(route.query.id || '').trim())
const verificationData = ref(null)

const otRequest = computed(() => verificationData.value?.otRequest || null)
const verification = computed(() => verificationData.value?.verification || null)

const attendedEmployees = computed(() =>
  Array.isArray(verification.value?.attendedEmployees)
    ? verification.value.attendedEmployees
    : []
)

const absentFromApproved = computed(() =>
  Array.isArray(verification.value?.absentFromApproved)
    ? verification.value.absentFromApproved
    : []
)

const attendedButNotApproved = computed(() =>
  Array.isArray(verification.value?.attendedButNotApproved)
    ? verification.value.attendedButNotApproved
    : []
)

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

function getStatusSeverity(status) {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'PENDING_REQUESTER_CONFIRMATION':
      return 'info'
    case 'REJECTED':
      return 'danger'
    case 'REQUESTER_DISAGREED':
      return 'danger'
    case 'CANCELLED':
      return 'secondary'
    default:
      return 'secondary'
  }
}

function getAttendanceStatusSeverity(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PRESENT':
      return 'success'
    case 'ABSENT':
      return 'danger'
    case 'LEAVE':
      return 'warning'
    case 'OFF':
      return 'info'
    default:
      return 'secondary'
  }
}

async function runVerification() {
  const id = String(otRequestId.value || '').trim()

  if (!id) {
    toast.add({
      severity: 'warn',
      summary: 'OT Request ID required',
      detail: 'Please enter an OT request ID first',
      life: 2500,
    })
    return
  }

  loading.value = true

  try {
    const response = await verifyOTAttendance(id)
    verificationData.value = response?.data?.data || null

    router.replace({
      query: {
        ...route.query,
        id,
      },
    })

    toast.add({
      severity: 'success',
      summary: 'Verification loaded',
      detail: 'Attendance verification loaded successfully',
      life: 2200,
    })
  } catch (error) {
    console.error(error)
    verificationData.value = null

    toast.add({
      severity: 'error',
      summary: 'Verification failed',
      detail: error?.response?.data?.message || 'Unable to verify attendance for this OT request',
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

function clearVerification() {
  otRequestId.value = ''
  verificationData.value = null

  router.replace({
    query: {
      ...route.query,
      id: undefined,
    },
  })
}

onMounted(() => {
  if (otRequestId.value) {
    runVerification()
  }
})
</script>

<template>
  <div class="flex flex-col gap-4 p-3 md:p-4">
    <section
      class="overflow-hidden rounded-3xl border border-surface-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 shadow-sm dark:border-surface-700 dark:from-surface-900 dark:via-surface-900 dark:to-surface-800"
    >
      <div class="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <span
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-sky-600 shadow-sm ring-1 ring-black/5 dark:bg-surface-800 dark:text-sky-400"
            >
              <i class="pi pi-check-square text-base" />
            </span>

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-semibold tracking-tight text-surface-900 dark:text-surface-0">
                  OT Attendance Verification
                </h1>
                <Tag value="Verification" severity="info" rounded />
              </div>
              <p class="mt-1 text-sm text-surface-600 dark:text-surface-300">
                Compare OT approved employees against imported attendance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <Card class="compact-card rounded-3xl shadow-sm">
      <template #title>
        <div class="flex items-center gap-2 text-base">
          <i class="pi pi-search text-sky-500" />
          <span>Find OT Request</span>
        </div>
      </template>

      <template #content>
        <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto]">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">
              OT Request ID
            </label>
            <InputText
              v-model="otRequestId"
              class="w-full"
              placeholder="Paste OT request Mongo ID here"
              @keyup.enter="runVerification"
            />
          </div>

          <div class="flex flex-wrap items-end gap-2">
            <Button
              label="Verify"
              icon="pi pi-search"
              size="small"
              :loading="loading"
              @click="runVerification"
            />
            <Button
              label="Clear"
              icon="pi pi-times"
              size="small"
              severity="secondary"
              outlined
              @click="clearVerification"
            />
          </div>
        </div>
      </template>
    </Card>

    <template v-if="otRequest && verification">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="verify-stat-box">
          <div class="verify-stat-label">Requested</div>
          <div class="verify-stat-value">{{ verification.requestedEmployeeCount || 0 }}</div>
        </div>

        <div class="verify-stat-box">
          <div class="verify-stat-label">Approved</div>
          <div class="verify-stat-value">{{ verification.approvedEmployeeCount || 0 }}</div>
        </div>

        <div class="verify-stat-box border-emerald-200 dark:border-emerald-800">
          <div class="verify-stat-label">Actual Attended</div>
          <div class="verify-stat-value text-emerald-600 dark:text-emerald-400">
            {{ verification.actualAttendedCount || 0 }}
          </div>
        </div>

        <div class="verify-stat-box border-amber-200 dark:border-amber-800">
          <div class="verify-stat-label">Absent From Approved</div>
          <div class="verify-stat-value text-amber-600 dark:text-amber-400">
            {{ verification.absentFromApprovedCount || 0 }}
          </div>
        </div>

        <div class="verify-stat-box border-rose-200 dark:border-rose-800">
          <div class="verify-stat-label">Attended Not Approved</div>
          <div class="verify-stat-value text-rose-600 dark:text-rose-400">
            {{ verification.attendedButNotApprovedCount || 0 }}
          </div>
        </div>
      </div>

      <Card class="compact-card rounded-3xl shadow-sm">
        <template #title>
          <div class="flex items-center gap-2 text-base">
            <i class="pi pi-info-circle text-sky-500" />
            <span>OT Request Summary</span>
          </div>
        </template>

        <template #content>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="verify-info-box">
              <div class="verify-info-label">Request No</div>
              <div class="verify-info-value">{{ otRequest.requestNo || '—' }}</div>
            </div>

            <div class="verify-info-box">
              <div class="verify-info-label">Requester</div>
              <div class="verify-info-value">{{ otRequest.requesterName || '—' }}</div>
              <div class="mt-0.5 text-xs text-surface-500">
                {{ otRequest.requesterEmployeeNo || '—' }}
              </div>
            </div>

            <div class="verify-info-box">
              <div class="verify-info-label">OT Date</div>
              <div class="verify-info-value">{{ otRequest.otDate || '—' }}</div>
            </div>

            <div class="verify-info-box">
              <div class="verify-info-label">Day Type</div>
              <div class="mt-1">
                <Tag
                  :value="otRequest.dayType || '—'"
                  :severity="getDayTypeSeverity(otRequest.dayType)"
                />
              </div>
            </div>

            <div class="verify-info-box">
              <div class="verify-info-label">Status</div>
              <div class="mt-1">
                <Tag
                  :value="otRequest.status || '—'"
                  :severity="getStatusSeverity(otRequest.status)"
                />
              </div>
            </div>

            <div class="verify-info-box">
              <div class="verify-info-label">Requester Confirmation</div>
              <div class="mt-1">
                <Tag
                  :value="otRequest.requesterConfirmationStatus || '—'"
                  severity="info"
                />
              </div>
            </div>

            <div class="verify-info-box">
              <div class="verify-info-label">Approved Count</div>
              <div class="verify-info-value">{{ otRequest.approvedEmployeeCount || 0 }}</div>
            </div>

            <div class="verify-info-box">
              <div class="verify-info-label">Proposed Approved</div>
              <div class="verify-info-value">{{ otRequest.proposedApprovedEmployeeCount || 0 }}</div>
            </div>
          </div>
        </template>
      </Card>

      <Card class="compact-card rounded-3xl shadow-sm">
        <template #title>
          <div class="flex items-center gap-2 text-base">
            <i class="pi pi-users text-emerald-500" />
            <span>Actual Attended Employees</span>
          </div>
        </template>

        <template #content>
          <DataTable
            :value="attendedEmployees"
            dataKey="attendanceRecordId"
            responsiveLayout="scroll"
            stripedRows
            size="small"
            class="verify-table"
          >
            <template #empty>
              <div class="py-8 text-center text-sm text-surface-500">
                No attended employees found for this OT date.
              </div>
            </template>

            <Column field="employeeCode" header="Employee No" style="min-width: 9rem" />
            <Column field="employeeName" header="Employee Name" style="min-width: 12rem" />
            <Column field="departmentName" header="Department" style="min-width: 10rem" />
            <Column field="positionName" header="Position" style="min-width: 10rem" />
            <Column field="clockIn" header="In" style="min-width: 6rem" />
            <Column field="clockOut" header="Out" style="min-width: 6rem" />
            <Column field="workMinutes" header="Work Min" style="min-width: 7rem" />
            <Column field="attendanceStatus" header="Attendance" style="min-width: 8rem">
              <template #body="{ data }">
                <Tag
                  :value="data.attendanceStatus || '—'"
                  :severity="getAttendanceStatusSeverity(data.attendanceStatus)"
                />
              </template>
            </Column>
            <Column field="attendanceDayType" header="Day Type" style="min-width: 8rem">
              <template #body="{ data }">
                <Tag
                  :value="data.attendanceDayType || '—'"
                  :severity="getDayTypeSeverity(data.attendanceDayType)"
                />
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <div class="grid gap-4 xl:grid-cols-2">
        <Card class="compact-card rounded-3xl shadow-sm">
          <template #title>
            <div class="flex items-center gap-2 text-base">
              <i class="pi pi-user-minus text-amber-500" />
              <span>Absent From Approved</span>
            </div>
          </template>

          <template #content>
            <DataTable
              :value="absentFromApproved"
              dataKey="employeeId"
              responsiveLayout="scroll"
              stripedRows
              size="small"
              class="verify-table"
            >
              <template #empty>
                <div class="py-8 text-center text-sm text-surface-500">
                  No absent employees from approved OT.
                </div>
              </template>

              <Column field="employeeCode" header="Employee No" style="min-width: 9rem" />
              <Column field="employeeName" header="Employee Name" style="min-width: 12rem" />
              <Column field="departmentName" header="Department" style="min-width: 10rem" />
              <Column field="positionName" header="Position" style="min-width: 10rem" />
            </DataTable>
          </template>
        </Card>

        <Card class="compact-card rounded-3xl shadow-sm">
          <template #title>
            <div class="flex items-center gap-2 text-base">
              <i class="pi pi-exclamation-triangle text-rose-500" />
              <span>Attended But Not Approved</span>
            </div>
          </template>

          <template #content>
            <DataTable
              :value="attendedButNotApproved"
              dataKey="attendanceRecordId"
              responsiveLayout="scroll"
              stripedRows
              size="small"
              class="verify-table"
            >
              <template #empty>
                <div class="py-8 text-center text-sm text-surface-500">
                  No employees attended outside the approved OT list.
                </div>
              </template>

              <Column field="employeeCode" header="Employee No" style="min-width: 9rem" />
              <Column field="employeeName" header="Employee Name" style="min-width: 12rem" />
              <Column field="departmentName" header="Department" style="min-width: 10rem" />
              <Column field="positionName" header="Position" style="min-width: 10rem" />
              <Column field="clockIn" header="In" style="min-width: 6rem" />
              <Column field="clockOut" header="Out" style="min-width: 6rem" />
              <Column field="workMinutes" header="Work Min" style="min-width: 7rem" />
              <Column field="attendanceStatus" header="Attendance" style="min-width: 8rem">
                <template #body="{ data }">
                  <Tag
                    :value="data.attendanceStatus || '—'"
                    :severity="getAttendanceStatusSeverity(data.attendanceStatus)"
                  />
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>
    </template>

    <Card
      v-else
      class="compact-card rounded-3xl border border-dashed border-surface-300 shadow-sm dark:border-surface-700"
    >
      <template #content>
        <div class="py-8 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-300">
            <i class="pi pi-search text-lg" />
          </div>
          <div class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Enter an OT request ID to verify attendance
          </div>
          <div class="mt-1 text-xs text-surface-500">
            The page will compare approved employees with imported attendance records.
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
:deep(.compact-card .p-card-body) {
  padding: 0.95rem !important;
}

:deep(.compact-card .p-card-title) {
  font-size: 1rem !important;
  font-weight: 700 !important;
}

:deep(.verify-table .p-datatable-thead > tr > th) {
  padding: 0.65rem 0.75rem !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

:deep(.verify-table .p-datatable-tbody > tr > td) {
  padding: 0.65rem 0.75rem !important;
  vertical-align: middle !important;
}

.verify-stat-box {
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  border-radius: 1rem;
  padding: 0.95rem;
}

.verify-stat-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.verify-stat-value {
  margin-top: 0.35rem;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--ot-text);
}

.verify-info-box {
  border: 1px solid var(--ot-border);
  background: var(--ot-bg);
  border-radius: 1rem;
  padding: 0.9rem;
}

.verify-info-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.verify-info-value {
  margin-top: 0.35rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ot-text);
  word-break: break-word;
}

@media (max-width: 640px) {
  :deep(.compact-card .p-card-body) {
    padding: 0.8rem !important;
  }

  .verify-stat-box,
  .verify-info-box {
    padding: 0.8rem;
  }

  .verify-stat-value {
    font-size: 1.25rem;
  }
}
</style>