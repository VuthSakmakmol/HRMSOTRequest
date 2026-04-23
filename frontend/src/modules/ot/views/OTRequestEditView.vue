<!-- frontend/src/modules/ot/views/OTRequestEditView.vue -->
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import DatePicker from 'primevue/datepicker'
import Divider from 'primevue/divider'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import {
  getAllowedOTApproverChain,
  getOTRequestById,
  getShiftOTOptionsByShift,
  updateOTRequest,
} from '@/modules/ot/ot.api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const saving = ref(false)
const loadingShiftOptions = ref(false)

const detail = ref(null)
const approverOptions = ref([])
const shiftOptions = ref([])

const requestId = computed(() => String(route.params.id || '').trim())
const employees = computed(() =>
  Array.isArray(detail.value?.employees) ? detail.value.employees : [],
)

const form = reactive({
  otDate: null,
  shiftOtOptionId: '',
  startTime: '',
  endTime: '',
  breakMinutes: 0,
  reason: '',
  employeeIds: [],
  approverEmployeeIds: [],
})

const isLegacyManualMode = computed(() => {
  const shiftId = String(detail.value?.shiftId || '').trim()
  const shiftOtOptionId = String(detail.value?.shiftOtOptionId || '').trim()

  return !shiftId && !shiftOtOptionId
})

const selectedOTOption = computed(() =>
  shiftOptions.value.find((item) => item.id === form.shiftOtOptionId) || null,
)

const requestPreview = computed(() => {
  if (isLegacyManualMode.value) return null
  if (!selectedOTOption.value) return null

  const shiftEndTime = String(detail.value?.shiftEndTime || '').trim()
  if (!shiftEndTime) return null

  const requestedMinutes = Number(selectedOTOption.value.requestedMinutes || 0)

  return {
    requestStartTime: shiftEndTime,
    requestEndTime: addMinutesToHHmm(shiftEndTime, requestedMinutes),
    requestedMinutes,
    requestedHours: Number(
      selectedOTOption.value.requestedHours ||
        (requestedMinutes / 60).toFixed(2),
    ),
  }
})

function normalizePayload(res) {
  return res?.data?.data || res?.data || null
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

      return {
        id: String(item?.id || item?._id || '').trim(),
        label: String(item?.label || '').trim(),
        requestedMinutes,
        requestedHours,
        sequence: Number(item?.sequence || 0),
        calculationPolicy: item?.calculationPolicy || null,
        optionLabel: `${String(item?.label || '').trim()} (${requestedMinutes} min)`,
      }
    })
    .filter((item) => item.id && item.label)
}

function parseYMDToDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const [yyyy, mm, dd] = raw.split('-').map(Number)
  if (!yyyy || !mm || !dd) return null

  const date = new Date(yyyy, mm - 1, dd)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateYMD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

function timeToMinutes(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function minutesToHHmm(totalMinutes) {
  const normalized = ((Number(totalMinutes || 0) % 1440) + 1440) % 1440
  const hh = Math.floor(normalized / 60)
  const mm = normalized % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function addMinutesToHHmm(hhmm, extraMinutes) {
  const base = timeToMinutes(hhmm)
  if (base === null) return ''
  return minutesToHHmm(base + Number(extraMinutes || 0))
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

function formatTimeRange(row) {
  const start = String(row?.requestStartTime || row?.startTime || '').trim()
  const end = String(row?.requestEndTime || row?.endTime || '').trim()

  if (!start && !end) return '-'
  return [start, end].filter(Boolean).join(' - ')
}

function hydrateForm(data) {
  form.otDate = parseYMDToDate(data?.otDate)
  form.shiftOtOptionId = String(data?.shiftOtOptionId || '').trim()
  form.startTime = String(data?.startTime || '').trim()
  form.endTime = String(data?.endTime || '').trim()
  form.breakMinutes = Number(data?.breakMinutes || 0)
  form.reason = String(data?.reason || '').trim()

  form.employeeIds = Array.isArray(data?.employees)
    ? data.employees
        .map((item) => String(item?.employeeId || '').trim())
        .filter(Boolean)
    : []

  form.approverEmployeeIds = Array.isArray(data?.approvalSteps)
    ? [...data.approvalSteps]
        .sort((a, b) => Number(a?.stepNo || 0) - Number(b?.stepNo || 0))
        .map((step) => String(step?.approverEmployeeId || '').trim())
        .filter(Boolean)
    : []
}

async function fetchApproverOptions(employeeId) {
  approverOptions.value = []

  if (!employeeId) return

  const res = await getAllowedOTApproverChain(employeeId)
  const payload = normalizePayload(res)
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  approverOptions.value = items.map((item) => ({
    label: `${item.displayName || '-'} (${item.employeeNo || '-'})`,
    value: item.employeeId,
  }))
}

async function fetchShiftOptions(shiftId) {
  shiftOptions.value = []

  if (!shiftId) return

  loadingShiftOptions.value = true

  try {
    const res = await getShiftOTOptionsByShift(shiftId)
    shiftOptions.value = normalizeShiftOptionsResponse(res)

    if (form.shiftOtOptionId) {
      const exists = shiftOptions.value.some((item) => item.id === form.shiftOtOptionId)
      if (!exists) {
        form.shiftOtOptionId = ''
      }
    }

    if (!form.shiftOtOptionId && shiftOptions.value.length === 1) {
      form.shiftOtOptionId = shiftOptions.value[0].id
    }
  } catch (error) {
    shiftOptions.value = []
    toast.add({
      severity: 'error',
      summary: 'OT options failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load OT options for this shift.',
      life: 3500,
    })
  } finally {
    loadingShiftOptions.value = false
  }
}

async function fetchDetail() {
  if (!requestId.value) return

  loading.value = true

  try {
    const res = await getOTRequestById(requestId.value)
    const data = normalizePayload(res)

    detail.value = data
    hydrateForm(data)

    if (data?.requesterEmployeeId) {
      await fetchApproverOptions(data.requesterEmployeeId)
    }

    if (String(data?.shiftId || '').trim()) {
      await fetchShiftOptions(String(data.shiftId).trim())
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load OT request',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (!requestId.value) {
    router.push('/ot/requests')
    return
  }

  router.push(`/ot/requests/${requestId.value}`)
}

function validateForm() {
  if (!detail.value?.canEdit) {
    toast.add({
      severity: 'warn',
      summary: 'Edit unavailable',
      detail: 'This OT request can no longer be edited.',
      life: 2500,
    })
    return false
  }

  if (!form.otDate) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please select OT date.',
      life: 2500,
    })
    return false
  }

  if (!String(form.reason || '').trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please enter reason.',
      life: 2500,
    })
    return false
  }

  if (!Array.isArray(form.employeeIds) || !form.employeeIds.length) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'At least 1 employee is required.',
      life: 2500,
    })
    return false
  }

  if (!Array.isArray(form.approverEmployeeIds) || !form.approverEmployeeIds.length) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please select at least 1 approver.',
      life: 2500,
    })
    return false
  }

  if (form.approverEmployeeIds.length > 4) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'You can select up to 4 approvers only.',
      life: 2500,
    })
    return false
  }

  if (isLegacyManualMode.value) {
    const startMinutes = timeToMinutes(form.startTime)
    const endMinutes = timeToMinutes(form.endTime)

    if (startMinutes === null) {
      toast.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Start time must be HH:mm.',
        life: 2500,
      })
      return false
    }

    if (endMinutes === null) {
      toast.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'End time must be HH:mm.',
        life: 2500,
      })
      return false
    }

    if (endMinutes <= startMinutes) {
      toast.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'End time must be later than start time.',
        life: 2500,
      })
      return false
    }
  } else {
    if (!String(form.shiftOtOptionId || '').trim()) {
      toast.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Please select OT option.',
        life: 2500,
      })
      return false
    }
  }

  return true
}

async function onSave() {
  if (saving.value) return
  if (!requestId.value) return
  if (!validateForm()) return

  saving.value = true

  try {
    const payload = {
      employeeIds: form.employeeIds,
      otDate: formatDateYMD(form.otDate),
      reason: String(form.reason || '').trim(),
      approverEmployeeIds: form.approverEmployeeIds,
    }

    if (isLegacyManualMode.value) {
      payload.startTime = String(form.startTime || '').trim()
      payload.endTime = String(form.endTime || '').trim()
      payload.breakMinutes = Number(form.breakMinutes || 0)
    } else {
      payload.shiftOtOptionId = String(form.shiftOtOptionId || '').trim()
    }

    await updateOTRequest(requestId.value, payload)

    toast.add({
      severity: 'success',
      summary: 'Updated',
      detail: 'OT request updated successfully.',
      life: 2500,
    })

    router.push(`/ot/requests/${requestId.value}`)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Update failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update OT request',
      life: 3500,
    })
  } finally {
    saving.value = false
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
            Edit OT Request
          </h1>

          <Tag
            v-if="detail"
            :value="detail.status || '-'"
            :severity="detail.canEdit ? 'warning' : 'secondary'"
          />

          <Tag
            v-if="detail"
            :value="isLegacyManualMode ? 'LEGACY MANUAL MODE' : 'SHIFT OT OPTION MODE'"
            :severity="isLegacyManualMode ? 'contrast' : 'info'"
          />
        </div>

        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Requester can edit only before any approval step becomes approved.
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
        <Button
          label="Save Changes"
          icon="pi pi-save"
          size="small"
          :loading="saving"
          :disabled="!detail?.canEdit"
          @click="onSave"
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
      <Message v-if="!detail.canEdit" severity="warn" :closable="false">
        This OT request cannot be edited because it is no longer pending or it already has an approved step.
      </Message>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="ot-edit-card xl:col-span-2">
          <template #title>
            Edit Form
          </template>

          <template #content>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div class="ot-info-box">
                <div class="ot-info-label">Request No</div>
                <div class="ot-info-value">{{ detail.requestNo || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Requester</div>
                <div class="ot-info-value">{{ detail.requesterName || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Requester Id</div>
                <div class="ot-info-value">{{ detail.requesterEmployeeNo || '-' }}</div>
              </div>

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
                  :disabled="!detail.canEdit"
                />
              </div>

              <template v-if="isLegacyManualMode">
                <div class="space-y-2">
                  <label class="text-sm font-medium text-[color:var(--ot-text)]">
                    Start Time
                  </label>
                  <InputText
                    v-model.trim="form.startTime"
                    class="w-full"
                    placeholder="HH:mm"
                    :disabled="!detail.canEdit"
                  />
                </div>

                <div class="space-y-2">
                  <label class="text-sm font-medium text-[color:var(--ot-text)]">
                    End Time
                  </label>
                  <InputText
                    v-model.trim="form.endTime"
                    class="w-full"
                    placeholder="HH:mm"
                    :disabled="!detail.canEdit"
                  />
                </div>

                <div class="space-y-2">
                  <label class="text-sm font-medium text-[color:var(--ot-text)]">
                    Break Minutes
                  </label>
                  <InputNumber
                    v-model="form.breakMinutes"
                    inputClass="w-full"
                    class="w-full"
                    :min="0"
                    :useGrouping="false"
                    :disabled="!detail.canEdit"
                  />
                </div>
              </template>

              <template v-else>
                <div class="space-y-2 md:col-span-2">
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
                    :disabled="!detail.canEdit || !shiftOptions.length"
                  />
                </div>
              </template>

              <div class="space-y-2 md:col-span-2 xl:col-span-2">
                <label class="text-sm font-medium text-[color:var(--ot-text)]">
                  Approver Chain
                </label>
                <MultiSelect
                  v-model="form.approverEmployeeIds"
                  :options="approverOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
                  display="chip"
                  placeholder="Select approvers in hierarchy order"
                  :maxSelectedLabels="4"
                  :disabled="!detail.canEdit"
                />
              </div>
            </div>

            <Divider />

            <template v-if="!isLegacyManualMode">
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div class="ot-info-box">
                  <div class="ot-info-label">Shift</div>
                  <div class="ot-info-value">
                    {{ detail.shiftCode || '-' }} {{ detail.shiftName ? `· ${detail.shiftName}` : '' }}
                  </div>
                </div>

                <div class="ot-info-box">
                  <div class="ot-info-label">Shift Type</div>
                  <div class="ot-info-value">
                    {{ detail.shiftType || '-' }}
                  </div>
                </div>

                <div class="ot-info-box">
                  <div class="ot-info-label">Shift Start</div>
                  <div class="ot-info-value">
                    {{ detail.shiftStartTime || '-' }}
                  </div>
                </div>

                <div class="ot-info-box">
                  <div class="ot-info-label">Shift End</div>
                  <div class="ot-info-value">
                    {{ detail.shiftEndTime || '-' }}
                  </div>
                </div>
              </div>

              <div
                v-if="requestPreview"
                class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
              >
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

              <Message
                v-if="!loadingShiftOptions && !shiftOptions.length"
                severity="warn"
                :closable="false"
                class="mt-4"
              >
                No active OT option is configured for this shift yet.
              </Message>

              <div
                v-if="selectedOTOption?.calculationPolicy"
                class="mt-4 rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4"
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
            </template>

            <Divider />

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">
                Reason
              </label>
              <Textarea
                v-model.trim="form.reason"
                rows="5"
                autoResize
                class="w-full"
                :disabled="!detail.canEdit"
              />
            </div>
          </template>
        </Card>

        <Card class="ot-edit-card">
          <template #title>
            Current Summary
          </template>

          <template #content>
            <div class="flex flex-col gap-3">
              <div class="ot-info-box">
                <div class="ot-info-label">Department</div>
                <div class="ot-info-value">{{ detail.departmentName || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Position</div>
                <div class="ot-info-value">{{ detail.positionName || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Current Request Time</div>
                <div class="ot-info-value">{{ formatTimeRange(detail) }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Current Total Hours</div>
                <div class="ot-info-value">{{ detail.totalHours ?? '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Current OT Option</div>
                <div class="ot-info-value">{{ detail.shiftOtOptionLabel || '-' }}</div>
              </div>

              <div class="ot-info-box">
                <div class="ot-info-label">Requested Minutes</div>
                <div class="ot-info-value">{{ detail.requestedMinutes ?? 0 }}</div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Card class="ot-edit-card">
        <template #title>
          Employees in This Request
        </template>

        <template #content>
          <div class="mb-3 text-sm text-[color:var(--ot-text-muted)]">
            This version keeps the current employee list and updates OT details, reason, and approver chain.
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="employee in employees"
              :key="employee.employeeId"
              class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-3"
            >
              <div class="font-semibold text-[color:var(--ot-text)]">
                {{ employee.employeeName || '-' }}
              </div>
              <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                {{ employee.employeeCode || '-' }}
              </div>
              <div class="mt-2 text-sm text-[color:var(--ot-text-muted)]">
                {{ employee.departmentName || '-' }} · {{ employee.positionName || '-' }}
              </div>
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
:deep(.ot-edit-card .p-card-body) {
  padding: 1rem !important;
}

:deep(.ot-edit-card .p-card-title) {
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