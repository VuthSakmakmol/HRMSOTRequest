<!-- frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue -->
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'

import api from '@/shared/services/api'
import { getEmployees } from '@/modules/org/employee.api'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])

const toast = useToast()

const loading = ref(false)
const loadingSelf = ref(false)
const search = ref('')
const employees = ref([])
const selfEmployee = ref(null)
const page = ref(1)
const limit = 60
const total = ref(0)
const pulseIds = ref([])

const selectedIds = computed(() =>
  new Set(
    (Array.isArray(props.modelValue) ? props.modelValue : [])
      .map((item) => String(item?._id || item?.id || '').trim())
      .filter(Boolean),
  ),
)

const displayedEmployees = computed(() => {
  const rows = Array.isArray(employees.value) ? [...employees.value] : []
  const me = selfEmployee.value

  if (!me?._id) return rows

  const exists = rows.some((item) => String(item?._id || '').trim() === me._id)

  if (exists) {
    return rows.map((item) =>
      String(item?._id || '').trim() === me._id
        ? { ...item, isSelf: true }
        : item,
    )
  }

  return [{ ...me, isSelf: true }, ...rows]
})

function toTrimmedString(value) {
  return String(value ?? '').trim()
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeBoolean(...values) {
  for (const value of values) {
    if (value === true || value === false) return value
    if (value === 1 || value === 0) return Boolean(value)

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true
      if (['false', '0', 'no', 'n'].includes(normalized)) return false
    }
  }

  return false
}

function extractShiftFields(source = {}) {
  const shiftObj =
    (isObject(source?.shiftId) && source.shiftId) ||
    (isObject(source?.shift) && source.shift) ||
    (isObject(source?.shiftInfo) && source.shiftInfo) ||
    (isObject(source?.assignedShift) && source.assignedShift) ||
    {}

  const rawShiftId =
    !isObject(source?.shiftId) && source?.shiftId
      ? source.shiftId
      : shiftObj?._id || shiftObj?.id || ''

  const shiftId = toTrimmedString(rawShiftId)
  const shiftCode = toTrimmedString(source?.shiftCode || shiftObj?.code || '')
  const shiftName = toTrimmedString(source?.shiftName || shiftObj?.name || '')
  const shiftType = toTrimmedString(source?.shiftType || shiftObj?.type || '')
  const shiftStartTime = toTrimmedString(
    source?.shiftStartTime || shiftObj?.startTime || '',
  )
  const shiftEndTime = toTrimmedString(
    source?.shiftEndTime || shiftObj?.endTime || '',
  )
  const shiftCrossMidnight = normalizeBoolean(
    source?.shiftCrossMidnight,
    shiftObj?.crossMidnight,
  )

  const hasShiftPayload = Boolean(
    shiftId ||
      shiftCode ||
      shiftName ||
      shiftType ||
      shiftStartTime ||
      shiftEndTime,
  )

  return {
    shiftId,
    shiftCode,
    shiftName,
    shiftType,
    shiftStartTime,
    shiftEndTime,
    shiftCrossMidnight,
    shift: hasShiftPayload
      ? {
          _id: shiftId,
          code: shiftCode,
          name: shiftName,
          type: shiftType,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          crossMidnight: shiftCrossMidnight,
        }
      : null,
  }
}

function normalizeEmployeeRecord(source = {}, options = {}) {
  const { isSelf = false } = options

  const _id = toTrimmedString(source?._id || source?.id || '')
  const employeeNo = toTrimmedString(source?.employeeNo || '')
  const displayName = toTrimmedString(source?.displayName || source?.name || '')
  const departmentName = toTrimmedString(
    source?.departmentName || source?.department?.name || '',
  )
  const positionName = toTrimmedString(
    source?.positionName || source?.position?.name || '',
  )

  if (!_id || !displayName) return null

  return {
    _id,
    id: _id,
    employeeNo,
    displayName,
    departmentName,
    positionName,
    ...extractShiftFields(source),
    isSelf,
  }
}

function normalizeEmployeesResponse(res) {
  const rows =
    res?.data?.data?.items ||
    res?.data?.data?.rows ||
    res?.data?.items ||
    res?.data?.rows ||
    res?.data?.data ||
    res?.data ||
    []

  if (!Array.isArray(rows)) return []

  return rows
    .map((item) => normalizeEmployeeRecord(item, { isSelf: false }))
    .filter(Boolean)
}

function normalizeMeResponse(res) {
  const user =
    res?.data?.data?.user ||
    res?.data?.data ||
    res?.data?.user ||
    res?.data ||
    {}

  const employee =
    user?.employee ||
    user?.employeeProfile ||
    user?.employeeInfo ||
    {}

  const merged = {
    ...user,
    ...employee,
    department: employee?.department || user?.department,
    position: employee?.position || user?.position,
    shiftId: employee?.shiftId || user?.shiftId,
    shift: employee?.shift || user?.shift,
    shiftInfo: employee?.shiftInfo || user?.shiftInfo,
    assignedShift: employee?.assignedShift || user?.assignedShift,
    shiftCode: employee?.shiftCode || user?.shiftCode,
    shiftName: employee?.shiftName || user?.shiftName,
    shiftType: employee?.shiftType || user?.shiftType,
    shiftStartTime: employee?.shiftStartTime || user?.shiftStartTime,
    shiftEndTime: employee?.shiftEndTime || user?.shiftEndTime,
    shiftCrossMidnight:
      employee?.shiftCrossMidnight ?? user?.shiftCrossMidnight,
  }

  return normalizeEmployeeRecord(merged, { isSelf: true })
}

async function loadSelfEmployee() {
  try {
    loadingSelf.value = true
    const res = await api.get('/auth/me')
    selfEmployee.value = normalizeMeResponse(res)
  } catch {
    selfEmployee.value = null
  } finally {
    loadingSelf.value = false
  }
}

async function loadEmployees() {
  try {
    loading.value = true

    const res = await getEmployees({
      page: page.value,
      limit,
      search: String(search.value || '').trim(),
      isActive: true,
    })

    employees.value = normalizeEmployeesResponse(res)
    total.value = Number(
      res?.data?.data?.pagination?.total ||
        res?.data?.pagination?.total ||
        employees.value.length ||
        0,
    )

    triggerSearchHint()
  } catch (error) {
    employees.value = []
    total.value = 0

    toast.add({
      severity: 'error',
      summary: 'Employee load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load employees.',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

function emitSelected(nextRows) {
  emit('update:modelValue', nextRows)
}

function toggleEmployee(employee) {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
  const targetId = String(employee?._id || '').trim()

  if (!targetId) return

  const exists = current.find(
    (item) => String(item?._id || '').trim() === targetId,
  )

  if (exists) {
    emitSelected(
      current.filter((item) => String(item?._id || '').trim() !== targetId),
    )
    return
  }

  emitSelected([...current, employee])
}

function clearSelected() {
  emitSelected([])
}

function selectCurrentPage() {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
  const existingIds = new Set(
    current.map((item) => String(item?._id || '').trim()),
  )
  const merged = [...current]

  displayedEmployees.value.forEach((row) => {
    if (!existingIds.has(row._id)) merged.push(row)
  })

  emitSelected(merged)
}

function unselectCurrentPage() {
  const pageIds = new Set(displayedEmployees.value.map((item) => item._id))
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []

  emitSelected(
    current.filter((item) => !pageIds.has(String(item?._id || '').trim())),
  )
}

function goPrev() {
  if (page.value <= 1) return
  page.value -= 1
}

function goNext() {
  const maxPage = Math.max(1, Math.ceil(total.value / limit))
  if (page.value >= maxPage) return
  page.value += 1
}

function triggerSearchHint() {
  const keyword = String(search.value || '').trim().toLowerCase()

  if (!keyword) {
    pulseIds.value = []
    return
  }

  const matched = displayedEmployees.value
    .filter((item) => {
      const haystack = [
        item.employeeNo,
        item.displayName,
        item.departmentName,
        item.positionName,
        item.shiftCode,
        item.shiftName,
        item.shiftType,
        item.isSelf ? 'self me myself mine' : '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
    .map((item) => item._id)

  pulseIds.value = matched

  clearTimeout(triggerSearchHint._timer)
  triggerSearchHint._timer = setTimeout(() => {
    pulseIds.value = []
  }, 1400)
}

function shiftLabel(employee) {
  const code = toTrimmedString(employee?.shiftCode || '')
  const name = toTrimmedString(employee?.shiftName || '')
  const start = toTrimmedString(employee?.shiftStartTime || '')
  const end = toTrimmedString(employee?.shiftEndTime || '')

  let label = 'Shift: '

  if (code || name) {
    label += code || '-'
    if (name) label += ` · ${name}`
  } else {
    label += 'Not assigned'
  }

  if (start || end) {
    label += ` · ${start || '--:--'} - ${end || '--:--'}`
  }

  return label
}

watch(search, () => {
  page.value = 1
})

watch([search, page], () => {
  loadEmployees()
})

watch(displayedEmployees, () => {
  triggerSearchHint()
})

onMounted(async () => {
  await loadSelfEmployee()
  await loadEmployees()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div class="min-w-0 flex-1">
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Search Employees
          </label>

          <IconField class="w-full ot-search-field">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model.trim="search"
              class="w-full"
              placeholder="Search employee no, name, department, position"
            />
          </IconField>
        </div>

        <div class="flex flex-wrap items-center gap-2 xl:justify-end">
          <Tag :value="`${modelValue.length} selected`" severity="contrast" />

          <Button
            label="Select Page"
            icon="pi pi-check-square"
            size="small"
            severity="secondary"
            outlined
            @click="selectCurrentPage"
          />

          <Button
            label="Unselect Page"
            icon="pi pi-minus-circle"
            size="small"
            severity="secondary"
            outlined
            @click="unselectCurrentPage"
          />

          <Button
            label="Clear"
            icon="pi pi-times"
            size="small"
            severity="danger"
            outlined
            :disabled="!modelValue.length"
            @click="clearSelected"
          />
        </div>
      </div>
    </div>

    <div
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div
        v-if="loading || loadingSelf"
        class="flex min-h-[280px] items-center justify-center"
      >
        <div class="flex flex-col items-center gap-3">
          <ProgressSpinner style="width:38px;height:38px" strokeWidth="4" />
          <div class="text-sm text-[color:var(--ot-text-muted)]">
            Loading employees...
          </div>
        </div>
      </div>

      <div
        v-else-if="!displayedEmployees.length"
        class="flex min-h-[180px] items-center justify-center px-4 py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
      >
        No employees found.
      </div>

      <div
        v-else
        class="max-h-[500px] overflow-y-auto p-3"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <button
            v-for="employee in displayedEmployees"
            :key="employee._id"
            type="button"
            class="group relative rounded-2xl border px-4 py-3 text-left transition duration-200"
            :class="[
              selectedIds.has(employee._id)
                ? 'border-primary bg-primary/10 ring-1 ring-primary/25 shadow-sm'
                : employee.isSelf
                  ? 'border-primary/35 bg-primary/[0.04] hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm'
                  : 'border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm',
              pulseIds.includes(employee._id) ? 'ot-search-pulse' : '',
            ]"
            @click="toggleEmployee(employee)"
          >
            <div class="flex items-start gap-3">
              <div
                class="ot-check-box mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border"
                :class="
                  selectedIds.has(employee._id)
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] text-transparent'
                "
              >
                <i
                  class="pi pi-check text-[12px] font-bold leading-none"
                  :class="selectedIds.has(employee._id) ? 'opacity-100' : 'opacity-0'"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="truncate text-sm font-semibold text-[color:var(--ot-text)]">
                    {{ employee.displayName }}
                  </div>

                  <Tag
                    v-if="employee.employeeNo"
                    :value="employee.employeeNo"
                    severity="info"
                    class="text-[10px]"
                  />

                  <Tag
                    v-if="employee.isSelf"
                    value="Self"
                    severity="success"
                    class="text-[10px]"
                  />

                  <Tag
                    v-if="employee.shiftCode"
                    :value="employee.shiftCode"
                    severity="warning"
                    class="text-[10px]"
                  />
                </div>

                <div class="mt-1 space-y-1 text-xs text-[color:var(--ot-text-muted)]">
                  <div v-if="employee.departmentName">{{ employee.departmentName }}</div>
                  <div v-if="employee.positionName">{{ employee.positionName }}</div>

                  <div
                    :class="
                      employee.shiftId
                        ? 'text-[color:var(--ot-text-muted)]'
                        : 'font-medium text-amber-600 dark:text-amber-400'
                    "
                  >
                    {{ shiftLabel(employee) }}
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <div class="text-xs text-[color:var(--ot-text-muted)]">
        Page {{ page }} / {{ Math.max(1, Math.ceil(total / limit)) }}
      </div>

      <div class="flex items-center gap-2">
        <Button
          label="Previous"
          icon="pi pi-angle-left"
          size="small"
          severity="secondary"
          outlined
          :disabled="page <= 1 || loading"
          @click="goPrev"
        />
        <Button
          label="Next"
          icon="pi pi-angle-right"
          iconPos="right"
          size="small"
          severity="secondary"
          outlined
          :disabled="page >= Math.max(1, Math.ceil(total / limit)) || loading"
          @click="goNext"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ot-search-pulse {
  animation: otPulse 1.2s ease;
}

@keyframes otPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.35);
  }
  35% {
    transform: scale(1.015);
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.12);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

:deep(.ot-search-field .p-inputtext) {
  min-height: 3rem !important;
  padding-left: 2.5rem !important;
  border-radius: 1rem !important;
}

:deep(.ot-search-field .p-inputicon) {
  color: var(--ot-text-muted) !important;
}

.ot-check-box {
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}
</style>