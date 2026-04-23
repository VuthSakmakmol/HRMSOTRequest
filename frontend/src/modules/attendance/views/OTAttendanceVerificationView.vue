
<!-- frontend/src/modules/attendance/views/OTAttendanceVerificationView.vue -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'

import { verifyOTAttendance } from '@/modules/attendance/attendance.api'
import { getOTRequests } from '@/modules/ot/ot.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const searchLoading = ref(false)
const payload = ref(null)

const requestNoSearch = ref('')
const searchResults = ref([])
const selectedOtRequestId = ref('')

const otRequestId = computed(() => {
  return (
    String(selectedOtRequestId.value || '').trim() ||
    String(route.params.otRequestId || '').trim() ||
    String(route.params.id || '').trim() ||
    String(route.query.otRequestId || '').trim() ||
    String(route.query.id || '').trim()
  )
})

const otRequest = computed(() => payload.value?.otRequest || {})
const verification = computed(() => payload.value?.verification || {})

const attendedEmployees = computed(() => verification.value?.attendedEmployees || [])
const absentFromApproved = computed(() => verification.value?.absentFromApproved || [])
const attendedButNotApproved = computed(() => verification.value?.attendedButNotApproved || [])
const shiftMismatchEmployees = computed(() => verification.value?.shiftMismatchEmployees || [])
const pendingReviewEmployees = computed(() => verification.value?.pendingReviewEmployees || [])
const notEligibleEmployees = computed(() => verification.value?.notEligibleEmployees || [])

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payloadValue) {
  return Array.isArray(payloadValue?.items) ? payloadValue.items : []
}

function normalizeTimeValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (timeMatch) {
    const hh = String(Number(timeMatch[1])).padStart(2, '0')
    const mm = String(Number(timeMatch[2])).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatNumber(value) {
  return Number(value || 0)
}

function formatMinutesLabel(value) {
  const minutes = Math.max(0, Number(value || 0))

  if (!minutes) return '0m'

  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60

  if (hh && mm) return `${hh}h ${mm}m`
  if (hh) return `${hh}h`
  return `${mm}m`
}

function statusSeverity(value) {
  switch (String(value || '').toUpperCase()) {
    case 'APPROVED':
    case 'PRESENT':
      return 'success'
    case 'PENDING':
    case 'PENDING_REQUESTER_CONFIRMATION':
      return 'warning'
    case 'REQUESTER_DISAGREED':
    case 'REJECTED':
    case 'ABSENT':
    case 'SHIFT_MISMATCH':
      return 'danger'
    case 'LATE':
      return 'warn'
    case 'FORGET_SCAN_IN':
    case 'FORGET_SCAN_OUT':
      return 'info'
    case 'CANCELLED':
      return 'secondary'
    default:
      return 'contrast'
  }
}

function dayTypeSeverity(value) {
  switch (String(value || '').toUpperCase()) {
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

function yesNoSeverity(value) {
  return value === true ? 'success' : value === false ? 'danger' : 'secondary'
}

function verificationResult(value) {
  return String(value || '').trim().toUpperCase() === 'MATCH' ? 'MATCH' : 'MISMATCH'
}

function verificationSeverity(value) {
  return verificationResult(value) === 'MATCH' ? 'success' : 'danger'
}

function personLabel(row) {
  const code = String(row?.employeeCode || row?.employeeNo || '').trim()
  const name = String(row?.employeeName || '').trim()

  if (code && name) return `${code} · ${name}`
  return code || name || '-'
}

function displayTime(...values) {
  for (const value of values) {
    const normalized = normalizeTimeValue(value)
    if (normalized) return normalized
  }
  return '-'
}

function rowShiftEndTime(row = {}) {
  return displayTime(row?.shiftEndTime, otRequest.value?.shiftEndTime)
}

function rowRequestedOtLabel(row = {}) {
  return formatMinutesLabel(
    row?.requestedMinutes ??
      row?.requestedOtMinutes ??
      verification.value?.requestedMinutes ??
      otRequest.value?.requestedMinutes ??
      otRequest.value?.totalMinutes ??
      0,
  )
}

function rowExpectedOtEndTime(row = {}) {
  return displayTime(
    row?.expectedOtEndTime,
    verification.value?.expectedOtEndTime,
    otRequest.value?.expectedOtEndTime,
    otRequest.value?.requestEndTime,
    otRequest.value?.endTime,
  )
}

function rowActualClockOut(row = {}) {
  return displayTime(row?.clockOut)
}

function rowActualOtLabel(row = {}) {
  return formatMinutesLabel(
    row?.roundedOtMinutes ??
      row?.actualOtMinutes ??
      0,
  )
}

const requestRequestedOtLabel = computed(() =>
  formatMinutesLabel(
    verification.value?.requestedMinutes ??
      otRequest.value?.requestedMinutes ??
      otRequest.value?.totalMinutes ??
      0,
  ),
)

const requestShiftStartTime = computed(() =>
  displayTime(otRequest.value?.shiftStartTime),
)

const requestShiftEndTime = computed(() =>
  displayTime(otRequest.value?.shiftEndTime),
)

const requestExpectedOtEndTime = computed(() =>
  displayTime(
    verification.value?.expectedOtEndTime,
    otRequest.value?.expectedOtEndTime,
    otRequest.value?.requestEndTime,
    otRequest.value?.endTime,
  ),
)

const requestPolicyLabel = computed(() => {
  const code = String(
    verification.value?.policyCode ||
      otRequest.value?.otCalculationPolicySnapshot?.code ||
      '',
  ).trim()
  const name = String(
    verification.value?.policyName ||
      otRequest.value?.otCalculationPolicySnapshot?.name ||
      '',
  ).trim()

  if (code && name) return `${code} · ${name}`
  return code || name || '-'
})

const summaryCards = computed(() => {
  return [
    {
      label: 'Requested',
      value: Number(verification.value?.requestedEmployeeCount || 0),
      tone: 'bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
    },
    {
      label: 'Approved',
      value: Number(verification.value?.approvedEmployeeCount || 0),
      tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    },
    {
      label: 'Attended',
      value: Number(verification.value?.actualAttendedCount || 0),
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    {
      label: 'Absent From Approved',
      value: Number(verification.value?.absentFromApprovedCount || 0),
      tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    },
    {
      label: 'Shift Mismatch',
      value: Number(verification.value?.shiftMismatchCount || 0),
      tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    },
    {
      label: 'Pending Review',
      value: Number(verification.value?.pendingReviewCount || 0),
      tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    },
    {
      label: 'Not Eligible',
      value: Number(verification.value?.notEligibleCount || 0),
      tone: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    },
    {
      label: 'Attended Not Approved',
      value: Number(verification.value?.attendedButNotApprovedCount || 0),
      tone: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
    },
  ]
})

async function loadData() {
  if (!otRequestId.value) {
    payload.value = null
    return
  }

  loading.value = true
  try {
    const response = await verifyOTAttendance(otRequestId.value)
    payload.value = response?.data?.data || null
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load OT attendance verification.',
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

async function searchByRequestNo() {
  const keyword = String(requestNoSearch.value || '').trim()

  if (!keyword) {
    toast.add({
      severity: 'warn',
      summary: 'Request No required',
      detail: 'Please enter OT request number first.',
      life: 2500,
    })
    return
  }

  searchLoading.value = true
  searchResults.value = []

  try {
    const response = await getOTRequests({
      page: 1,
      limit: 10,
      search: keyword,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    const payloadValue = normalizePayload(response)
    const items = normalizeItems(payloadValue)

    searchResults.value = items

    const exactMatch = items.find(
      (item) =>
        String(item?.requestNo || '').trim().toLowerCase() === keyword.toLowerCase(),
    )

    if (exactMatch) {
      await pickRequest(exactMatch)
      return
    }

    if (!items.length) {
      toast.add({
        severity: 'warn',
        summary: 'Not found',
        detail: 'No OT request found for that request number.',
        life: 3000,
      })
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Search failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to search OT request.',
      life: 3500,
    })
  } finally {
    searchLoading.value = false
  }
}

async function pickRequest(row) {
  const id = String(row?._id || row?.id || '').trim()
  if (!id) return

  selectedOtRequestId.value = id
  requestNoSearch.value = String(row?.requestNo || '').trim()
  await loadData()
}

function clearSearch() {
  requestNoSearch.value = ''
  searchResults.value = []
  selectedOtRequestId.value = ''
  payload.value = null
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push('/attendance/imports')
}

onMounted(() => {
  if (otRequestId.value) {
    loadData()
  }
})
</script>

<template>
  <div class="min-h-full bg-transparent">
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
      <section
        class="overflow-hidden rounded-3xl border border-surface-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-5 shadow-sm dark:border-surface-800 dark:from-sky-950/30 dark:via-surface-950 dark:to-emerald-950/20"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <div
              class="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-surface-700 shadow-sm ring-1 ring-surface-200 dark:bg-surface-900/80 dark:text-surface-200 dark:ring-surface-700"
            >
              <i class="pi pi-check-square text-xs" />
              OT Attendance Verification
            </div>

            <div>
              <h1 class="text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-0">
                OT Verification Summary
              </h1>
              <p class="mt-1 max-w-3xl text-sm leading-6 text-surface-600 dark:text-surface-300">
                Search by OT Request No, then verify approved OT from backend with a simple MATCH or MISMATCH result.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              label="Back"
              icon="pi pi-arrow-left"
              severity="secondary"
              outlined
              @click="goBack"
            />
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              :loading="loading"
              :disabled="!otRequestId"
              @click="loadData"
            />
          </div>
        </div>
      </section>

      <Card class="overflow-hidden rounded-3xl shadow-sm">
        <template #content>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
              <IconField class="w-full lg:w-[360px]">
                <InputIcon class="pi pi-search" />
                <InputText
                  v-model.trim="requestNoSearch"
                  class="w-full"
                  placeholder="Search by OT Request No"
                  @keyup.enter="searchByRequestNo"
                />
              </IconField>

              <div class="flex flex-wrap gap-2">
                <Button
                  label="Search Request No"
                  icon="pi pi-search"
                  :loading="searchLoading"
                  @click="searchByRequestNo"
                />
                <Button
                  label="Clear"
                  icon="pi pi-refresh"
                  severity="secondary"
                  outlined
                  @click="clearSearch"
                />
              </div>
            </div>

            <div class="text-sm text-surface-500 dark:text-surface-400">
              Users can search by request number here. No need to remember Mongo ID.
            </div>

            <DataTable
              v-if="searchResults.length"
              :value="searchResults"
              dataKey="_id"
              responsiveLayout="scroll"
              stripedRows
              size="small"
            >
              <Column field="requestNo" header="Request No" style="min-width: 10rem" />
              <Column field="otDate" header="OT Date" style="min-width: 9rem" />
              <Column field="status" header="Status" style="min-width: 8rem">
                <template #body="{ data }">
                  <Tag :value="data.status || '-'" :severity="statusSeverity(data.status)" />
                </template>
              </Column>
              <Column field="dayType" header="Day Type" style="min-width: 8rem">
                <template #body="{ data }">
                  <Tag :value="data.dayType || '-'" :severity="dayTypeSeverity(data.dayType)" />
                </template>
              </Column>
              <Column header="Action" style="min-width: 10rem">
                <template #body="{ data }">
                  <Button
                    label="Verify"
                    icon="pi pi-check-square"
                    size="small"
                    severity="success"
                    outlined
                    @click="pickRequest(data)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </Card>

      <div
        v-if="loading && !payload"
        class="rounded-3xl border border-surface-200 bg-white px-4 py-10 text-center text-sm text-surface-500 shadow-sm dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400"
      >
        Loading OT attendance verification...
      </div>

      <template v-else-if="payload">
        <section class="mt-0 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div
            v-for="card in summaryCards"
            :key="card.label"
            class="rounded-2xl px-4 py-3 shadow-sm ring-1 ring-black/5"
            :class="card.tone"
          >
            <div class="text-xs font-medium opacity-80">{{ card.label }}</div>
            <div class="mt-1 text-xl font-bold">{{ card.value }}</div>
          </div>
        </section>

        <Card class="overflow-hidden rounded-3xl shadow-sm">
          <template #content>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8">
              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">Request No</div>
                <div class="mt-1 font-semibold text-surface-900 dark:text-surface-0">
                  {{ otRequest.requestNo || '-' }}
                </div>
              </div>

              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">Requester</div>
                <div class="mt-1 font-semibold text-surface-900 dark:text-surface-0">
                  {{ otRequest.requesterEmployeeNo || '-' }} · {{ otRequest.requesterName || '-' }}
                </div>
              </div>

              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">OT Date</div>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-surface-900 dark:text-surface-0">
                    {{ otRequest.otDate || '-' }}
                  </span>
                  <Tag
                    :value="otRequest.dayType || '-'"
                    :severity="dayTypeSeverity(otRequest.dayType)"
                  />
                </div>
              </div>

              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">Shift</div>
                <div class="mt-1 font-semibold text-surface-900 dark:text-surface-0">
                  {{ requestShiftStartTime }} - {{ requestShiftEndTime }}
                </div>
              </div>

              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">OT Option</div>
                <div class="mt-1 font-semibold text-surface-900 dark:text-surface-0">
                  {{ otRequest.shiftOtOptionLabel || '-' }}
                </div>
              </div>

              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">Policy</div>
                <div class="mt-1 font-semibold text-surface-900 dark:text-surface-0">
                  {{ requestPolicyLabel }}
                </div>
              </div>

              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">Requested OT</div>
                <div class="mt-1 font-semibold text-surface-900 dark:text-surface-0">
                  {{ requestRequestedOtLabel }}
                </div>
              </div>

              <div class="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
                <div class="text-xs text-surface-500 dark:text-surface-400">Expected OT End</div>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-surface-900 dark:text-surface-0">
                    {{ requestExpectedOtEndTime }}
                  </span>
                  <Tag
                    :value="otRequest.status || '-'"
                    :severity="statusSeverity(otRequest.status)"
                  />
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="overflow-hidden rounded-3xl shadow-sm">
          <template #title>
            <div class="flex items-center justify-between gap-3">
              <span>Attended Employees</span>
              <Tag :value="String(formatNumber(verification.actualAttendedCount))" severity="success" />
            </div>
          </template>
          <template #content>
            <DataTable
              :value="attendedEmployees"
              :loading="loading"
              responsiveLayout="scroll"
              scrollable
              stripedRows
              dataKey="employeeId"
            >
              <template #empty>
                <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
                  No attended employees found.
                </div>
              </template>

              <Column header="Employee" style="min-width: 15rem">
                <template #body="{ data }">
                  <div class="font-medium text-surface-900 dark:text-surface-0">
                    {{ personLabel(data) }}
                  </div>
                </template>
              </Column>

              <Column field="clockIn" header="Clock In" style="min-width: 7rem" />

              <Column header="Shift End" style="min-width: 7rem">
                <template #body="{ data }">
                  {{ rowShiftEndTime(data) }}
                </template>
              </Column>

              <Column header="Requested OT" style="min-width: 8rem">
                <template #body="{ data }">
                  {{ rowRequestedOtLabel(data) }}
                </template>
              </Column>

              <Column header="Expected OT End" style="min-width: 9rem">
                <template #body="{ data }">
                  <span class="font-semibold text-surface-900 dark:text-surface-0">
                    {{ rowExpectedOtEndTime(data) }}
                  </span>
                </template>
              </Column>

              <Column header="Actual Clock Out" style="min-width: 8rem">
                <template #body="{ data }">
                  <span class="font-semibold text-surface-900 dark:text-surface-0">
                    {{ rowActualClockOut(data) }}
                  </span>
                </template>
              </Column>

              <Column header="Actual OT" style="min-width: 8rem">
                <template #body="{ data }">
                  {{ rowActualOtLabel(data) }}
                </template>
              </Column>

              <Column header="Verification" style="min-width: 9rem">
                <template #body="{ data }">
                  <Tag
                    :value="verificationResult(data.otResult)"
                    :severity="verificationSeverity(data.otResult)"
                  />
                </template>
              </Column>

              <Column header="Attendance Status" style="min-width: 10rem">
                <template #body="{ data }">
                  <Tag
                    :value="data.attendanceStatus || '-'"
                    :severity="statusSeverity(data.attendanceStatus)"
                  />
                </template>
              </Column>

              <Column field="shiftName" header="Shift" style="min-width: 10rem" />
              <Column field="shiftStartTime" header="Shift Start" style="min-width: 7rem" />
              <Column field="workedMinutes" header="Worked Min" style="min-width: 7rem" />
              <Column field="lateMinutes" header="Late Min" style="min-width: 7rem" />
              <Column field="earlyOutMinutes" header="Early Out" style="min-width: 7rem" />
            </DataTable>
          </template>
        </Card>

        <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card class="overflow-hidden rounded-3xl shadow-sm">
            <template #title>
              <div class="flex items-center justify-between gap-3">
                <span>Absent From Approved OT</span>
                <Tag :value="String(formatNumber(verification.absentFromApprovedCount))" severity="danger" />
              </div>
            </template>
            <template #content>
              <DataTable
                :value="absentFromApproved"
                :loading="loading"
                responsiveLayout="scroll"
                scrollable
                stripedRows
                dataKey="employeeId"
              >
                <template #empty>
                  <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
                    No absent approved employees.
                  </div>
                </template>

                <Column header="Employee" style="min-width: 15rem">
                  <template #body="{ data }">
                    <div class="font-medium text-surface-900 dark:text-surface-0">
                      {{ personLabel(data) }}
                    </div>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card class="overflow-hidden rounded-3xl shadow-sm">
            <template #title>
              <div class="flex items-center justify-between gap-3">
                <span>Attended But Not Approved</span>
                <Tag :value="String(formatNumber(verification.attendedButNotApprovedCount))" severity="info" />
              </div>
            </template>
            <template #content>
              <DataTable
                :value="attendedButNotApproved"
                :loading="loading"
                responsiveLayout="scroll"
                scrollable
                stripedRows
                dataKey="employeeId"
              >
                <template #empty>
                  <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
                    No employees found in this group.
                  </div>
                </template>

                <Column header="Employee" style="min-width: 15rem">
                  <template #body="{ data }">
                    <div class="font-medium text-surface-900 dark:text-surface-0">
                      {{ personLabel(data) }}
                    </div>
                  </template>
                </Column>
                <Column field="clockIn" header="Clock In" style="min-width: 7rem" />
                <Column field="clockOut" header="Clock Out" style="min-width: 7rem" />
                <Column header="Attendance Status" style="min-width: 10rem">
                  <template #body="{ data }">
                    <Tag
                      :value="data.attendanceStatus || '-'"
                      :severity="statusSeverity(data.attendanceStatus)"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card class="overflow-hidden rounded-3xl shadow-sm">
            <template #title>
              <div class="flex items-center justify-between gap-3">
                <span>Shift Mismatch</span>
                <Tag :value="String(formatNumber(verification.shiftMismatchCount))" severity="warning" />
              </div>
            </template>
            <template #content>
              <DataTable
                :value="shiftMismatchEmployees"
                :loading="loading"
                responsiveLayout="scroll"
                scrollable
                stripedRows
                dataKey="employeeId"
              >
                <template #empty>
                  <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
                    No shift mismatch employees.
                  </div>
                </template>

                <Column header="Employee" style="min-width: 15rem">
                  <template #body="{ data }">
                    <div class="font-medium text-surface-900 dark:text-surface-0">
                      {{ personLabel(data) }}
                    </div>
                  </template>
                </Column>
                <Column field="clockIn" header="Clock In" style="min-width: 7rem" />
                <Column field="clockOut" header="Clock Out" style="min-width: 7rem" />
                <Column field="shiftName" header="Shift" style="min-width: 10rem" />
                <Column header="Shift Match" style="min-width: 8rem">
                  <template #body="{ data }">
                    <Tag
                      :value="data.shiftMatchStatus || '-'"
                      :severity="statusSeverity(data.shiftMatchStatus)"
                    />
                  </template>
                </Column>
                <Column header="Reason" style="min-width: 16rem">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600 dark:text-surface-300">
                      {{ (data.validationIssues || []).join(', ') || '-' }}
                    </span>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>

          <Card class="overflow-hidden rounded-3xl shadow-sm">
            <template #title>
              <div class="flex items-center justify-between gap-3">
                <span>Pending Review</span>
                <Tag :value="String(formatNumber(verification.pendingReviewCount))" severity="info" />
              </div>
            </template>
            <template #content>
              <DataTable
                :value="pendingReviewEmployees"
                :loading="loading"
                responsiveLayout="scroll"
                scrollable
                stripedRows
                dataKey="employeeId"
              >
                <template #empty>
                  <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
                    No pending review employees.
                  </div>
                </template>

                <Column header="Employee" style="min-width: 15rem">
                  <template #body="{ data }">
                    <div class="font-medium text-surface-900 dark:text-surface-0">
                      {{ personLabel(data) }}
                    </div>
                  </template>
                </Column>
                <Column header="Attendance Status" style="min-width: 10rem">
                  <template #body="{ data }">
                    <Tag
                      :value="data.attendanceStatus || '-'"
                      :severity="statusSeverity(data.attendanceStatus)"
                    />
                  </template>
                </Column>
                <Column header="Has Clock In" style="min-width: 8rem">
                  <template #body="{ data }">
                    <Tag
                      :value="data.hasClockIn === true ? 'YES' : 'NO'"
                      :severity="yesNoSeverity(data.hasClockIn)"
                    />
                  </template>
                </Column>
                <Column header="Has Clock Out" style="min-width: 8rem">
                  <template #body="{ data }">
                    <Tag
                      :value="data.hasClockOut === true ? 'YES' : 'NO'"
                      :severity="yesNoSeverity(data.hasClockOut)"
                    />
                  </template>
                </Column>
                <Column header="Reason" style="min-width: 16rem">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600 dark:text-surface-300">
                      {{ data.derivedStatusReason || (data.validationIssues || []).join(', ') || '-' }}
                    </span>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </div>

        <Card class="overflow-hidden rounded-3xl shadow-sm">
          <template #title>
            <div class="flex items-center justify-between gap-3">
              <span>Not Eligible</span>
              <Tag :value="String(formatNumber(verification.notEligibleCount))" severity="contrast" />
            </div>
          </template>
          <template #content>
            <DataTable
              :value="notEligibleEmployees"
              :loading="loading"
              responsiveLayout="scroll"
              scrollable
              stripedRows
              dataKey="employeeId"
            >
              <template #empty>
                <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
                  No not-eligible employees.
                </div>
              </template>

              <Column header="Employee" style="min-width: 15rem">
                <template #body="{ data }">
                  <div class="font-medium text-surface-900 dark:text-surface-0">
                    {{ personLabel(data) }}
                  </div>
                </template>
              </Column>

              <Column header="Attendance Status" style="min-width: 10rem">
                <template #body="{ data }">
                  <Tag
                    :value="data.attendanceStatus || '-'"
                    :severity="statusSeverity(data.attendanceStatus)"
                  />
                </template>
              </Column>

              <Column header="Reason" style="min-width: 16rem">
                <template #body="{ data }">
                  <span class="text-sm text-surface-600 dark:text-surface-300">
                    {{ data.derivedStatusReason || (data.validationIssues || []).join(', ') || '-' }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </template>

      <div
        v-else
        class="rounded-3xl border border-dashed border-surface-300 bg-white px-4 py-10 text-center text-sm text-surface-500 shadow-sm dark:border-surface-700 dark:bg-surface-900 dark:text-surface-400"
      >
        Search OT request number to verify attendance.
      </div>
    </div>
  </div>
</template>