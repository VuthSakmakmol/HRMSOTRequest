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
import Tag from 'primevue/tag'

import { getOTRequestById } from '@/modules/ot/ot.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const detail = ref(null)

const requestId = computed(() => String(route.params.id || '').trim())

const employees = computed(() => {
  return Array.isArray(detail.value?.employees) ? detail.value.employees : []
})

const approvalSteps = computed(() => {
  return Array.isArray(detail.value?.approvalSteps) ? detail.value.approvalSteps : []
})

function normalizePayload(res) {
  return res?.data?.data || res?.data || null
}

function statusSeverity(value) {
  if (value === 'APPROVED') return 'success'
  if (value === 'REJECTED') return 'danger'
  if (value === 'CANCELLED') return 'contrast'
  if (value === 'PENDING') return 'warning'
  if (value === 'DRAFT') return 'info'
  return 'secondary'
}

function dayTypeSeverity(value) {
  if (value === 'HOLIDAY') return 'danger'
  if (value === 'SUNDAY') return 'warning'
  return 'success'
}

function approvalSeverity(value) {
  if (value === 'APPROVED') return 'success'
  if (value === 'REJECTED') return 'danger'
  if (value === 'PENDING') return 'warning'
  if (value === 'WAITING') return 'secondary'
  return 'secondary'
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

function formatTimeRange(row) {
  const start = String(row?.startTime || '').trim()
  const end = String(row?.endTime || '').trim()

  if (!start && !end) return '-'
  return [start, end].filter(Boolean).join(' - ')
}

function goBack() {
  router.push('/ot/requests')
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
        'Failed to load OT request detail',
      life: 3000,
    })
  } finally {
    loading.value = false
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
            :severity="statusSeverity(detail.status)"
          />
        </div>

        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          View request information and all employees inside this OT request.
        </p>
      </div>

      <div class="flex items-center gap-2">
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

    <div
      v-if="loading"
      class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
    >
      Loading OT request detail...
    </div>

    <template v-else-if="detail">
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="ot-detail-card xl:col-span-2">
          <template #title>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>Request Summary</span>

              <div class="flex flex-wrap items-center gap-2">
                <Tag
                  :value="detail.dayType || '-'"
                  :severity="dayTypeSeverity(detail.dayType)"
                />
                <Tag
                  :value="`${detail.employeeCount ?? employees.length} staff`"
                  severity="info"
                />
              </div>
            </div>
          </template>

          <template #content>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div class="ot-info-box">
                <div class="ot-info-label">Request No</div>
                <div class="ot-info-value">{{ detail.requestNo || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">OT Date</div>
                <div class="ot-info-value">{{ detail.otDate || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Time</div>
                <div class="ot-info-value">{{ formatTimeRange(detail) }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Break Minutes</div>
                <div class="ot-info-value">{{ detail.breakMinutes ?? 0 }} min</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Total Hours</div>
                <div class="ot-info-value">{{ detail.totalHours ?? '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Requester</div>
                <div class="ot-info-value">{{ detail.requesterName || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Requester Id</div>
                <div class="ot-info-value">{{ detail.requesterEmployeeNo || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Department</div>
                <div class="ot-info-value">{{ detail.departmentName || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Position</div>
                <div class="ot-info-value">{{ detail.positionName || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Created At</div>
                <div class="ot-info-value">{{ formatDateTime(detail.createdAt) }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Updated At</div>
                <div class="ot-info-value">{{ formatDateTime(detail.updatedAt) }}</div>
              </div>
            </div>

            <Divider />

            <div class="ot-info-box">
              <div class="ot-info-label">Reason</div>
              <div class="ot-info-value whitespace-pre-line">
                {{ detail.reason || '-' }}
              </div>
            </div>
          </template>
        </Card>

        <Card class="ot-detail-card">
          <template #title>
            Approval Flow
          </template>

          <template #content>
            <div v-if="approvalSteps.length" class="flex flex-col gap-3">
              <div
                v-for="step in approvalSteps"
                :key="step.stepNo"
                class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-3"
              >
                <div class="mb-2 flex items-center justify-between gap-2">
                  <div class="text-sm font-semibold text-[color:var(--ot-text)]">
                    Step {{ step.stepNo }}
                  </div>

                  <Tag
                    :value="step.status || '-'"
                    :severity="approvalSeverity(step.status)"
                  />
                </div>

                <div class="text-sm font-medium text-[color:var(--ot-text)]">
                  {{ step.approverName || '-' }}
                </div>

                <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                  {{ step.approverCode || '-' }}
                </div>

                <div class="mt-2 text-xs text-[color:var(--ot-text-muted)]">
                  Acted At: {{ formatDateTime(step.actedAt) }}
                </div>

                <div
                  v-if="step.remark"
                  class="mt-2 rounded-lg border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-2 py-2 text-xs text-[color:var(--ot-text)]"
                >
                  {{ step.remark }}
                </div>
              </div>
            </div>

            <div v-else class="text-sm text-[color:var(--ot-text-muted)]">
              No approval steps found.
            </div>
          </template>
        </Card>
      </div>

      <Card class="ot-detail-card">
        <template #title>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span>Employees</span>
            <Tag
              :value="`${detail.employeeCount ?? employees.length} staff`"
              severity="info"
            />
          </div>
        </template>

        <template #content>
          <DataTable
            :value="employees"
            scrollable
            responsiveLayout="scroll"
            tableStyle="min-width: 72rem"
            class="ot-detail-employee-table"
          >
            <template #empty>
              <div class="py-8 text-center text-sm text-[color:var(--ot-text-muted)]">
                No employees found in this request.
              </div>
            </template>

            <Column header="#" style="width: 5rem; min-width: 5rem">
              <template #body="{ index }">
                {{ index + 1 }}
              </template>
            </Column>

            <Column field="employeeCode" header="Employee No" style="min-width: 10rem">
              <template #body="{ data }">
                {{ data.employeeCode || '-' }}
              </template>
            </Column>

            <Column field="employeeName" header="Employee Name" style="min-width: 15rem">
              <template #body="{ data }">
                <span class="font-medium text-[color:var(--ot-text)]">
                  {{ data.employeeName || '-' }}
                </span>
              </template>
            </Column>

            <Column field="departmentName" header="Department" style="min-width: 14rem">
              <template #body="{ data }">
                {{ data.departmentName || '-' }}
              </template>
            </Column>

            <Column field="positionName" header="Position" style="min-width: 14rem">
              <template #body="{ data }">
                {{ data.positionName || '-' }}
              </template>
            </Column>
          </DataTable>
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

:deep(.ot-detail-employee-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.ot-detail-employee-table .p-datatable-tbody > tr > td) {
  padding: 0.7rem 0.9rem !important;
  vertical-align: middle !important;
}
</style>