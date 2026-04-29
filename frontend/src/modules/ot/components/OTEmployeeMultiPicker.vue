<!-- frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue -->
<script setup>
// frontend/src/modules/ot/components/OTEmployeeMultiPicker.vue

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'

import api from '@/shared/services/api'
import { getEmployees } from '@/modules/org/employee.api'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },

  autoSelectAll: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const toast = useToast()

const PAGE_SIZE = 24

const dialogVisible = ref(false)
const scrollRef = ref(null)

const loading = ref(false)
const loadingMore = ref(false)
const loadingSelf = ref(false)
const loadingShifts = ref(false)

const search = ref('')
const selectedShiftId = ref('')

const employees = ref([])
const selfEmployee = ref(null)
const remoteShiftOptions = ref([])

const page = ref(1)
const total = ref(0)
const hasMore = ref(true)

const selectAllMode = ref(props.autoSelectAll)

let searchTimer = null
let requestSeq = 0

const selectedRows = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [],
)

const selectedIds = computed(() =>
  new Set(
    selectedRows.value
      .map((item) => getEmployeeId(item))
      .filter(Boolean),
  ),
)

const selectedCount = computed(() => selectedRows.value.length)

const loadedCountLabel = computed(() => {
  const loaded = employees.value.length
  const all = total.value || loaded

  return `${loaded}/${all}`
})

const selectedPreview = computed(() => selectedRows.value.slice(0, 12))

const localShiftOptions = computed(() => {
  const map = new Map()

  for (const row of [...employees.value, ...selectedRows.value, selfEmployee.value]) {
    if (!row) continue

    const shift = extractShiftFields(row)
    if (!shift.shiftId) continue

    const label =
      [shift.shiftCode, shift.shiftName].filter(Boolean).join(' · ') ||
      'Unnamed shift'

    map.set(shift.shiftId, {
      label,
      value: shift.shiftId,
    })
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
})

const shiftOptions = computed(() => {
  const map = new Map()

  for (const row of remoteShiftOptions.value) {
    if (row.value) map.set(row.value, row)
  }

  for (const row of localShiftOptions.value) {
    if (row.value) map.set(row.value, row)
  }

  return [
    {
      label: 'All shifts',
      value: '',
    },
    ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ]
})

const displayedEmployees = computed(() => {
  const map = new Map()

  const self = selfEmployee.value

  if (self?._id && employeeMatchesLocalFilters(self)) {
    map.set(self._id, {
      ...self,
      isSelf: true,
    })
  }

  for (const row of employees.value) {
    if (!row?._id) continue
    if (!employeeMatchesLocalFilters(row)) continue

    map.set(row._id, {
      ...row,
      isSelf: row._id === self?._id,
    })
  }

  return Array.from(map.values())
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

function getEmployeeId(employee) {
  return toTrimmedString(employee?._id || employee?.id || employee?.employeeId)
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
          id: shiftId,
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

  const _id = toTrimmedString(source?._id || source?.id || source?.employeeId || '')

  const employeeNo = toTrimmedString(
    source?.employeeNo ||
      source?.employeeCode ||
      source?.code ||
      source?.loginId ||
      '',
  )

  const displayName = toTrimmedString(
    source?.displayName ||
      source?.employeeName ||
      source?.name ||
      source?.fullName ||
      '',
  )

  const positionName = toTrimmedString(
    source?.positionName ||
      source?.position?.name ||
      source?.positionTitle ||
      '',
  )

  if (!_id || !displayName) return null

  return {
    _id,
    id: _id,
    employeeNo,
    displayName,
    positionName,
    ...extractShiftFields(source),
    isSelf,
  }
}

function normalizeEmployeesResponse(res) {
  const root = res?.data?.data || res?.data || {}

  const rows =
    root?.items ||
    root?.rows ||
    root?.employees ||
    root?.data ||
    res?.data?.items ||
    res?.data?.rows ||
    []

  const normalizedRows = Array.isArray(rows)
    ? rows.map((item) => normalizeEmployeeRecord(item)).filter(Boolean)
    : []

  const pagination =
    root?.pagination ||
    res?.data?.pagination ||
    {}

  const totalRows = Number(
    pagination?.total ??
      root?.total ??
      res?.data?.total ??
      normalizedRows.length,
  )

  const totalPages = Number(
    pagination?.totalPages ?? Math.max(1, Math.ceil(totalRows / PAGE_SIZE)),
  )

  const responseHasMore =
    typeof root?.hasMore === 'boolean'
      ? root.hasMore
      : typeof pagination?.hasMore === 'boolean'
        ? pagination.hasMore
        : page.value < totalPages

  return {
    rows: normalizedRows,
    total: totalRows,
    hasMore: responseHasMore,
  }
}

function normalizeAuthMeUser(res) {
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

  return {
    employeeId: toTrimmedString(
      employee?._id ||
        employee?.id ||
        user?.employeeId ||
        '',
    ),

    employeeNo: toTrimmedString(
      employee?.employeeNo ||
        user?.employeeNo ||
        user?.loginId ||
        '',
    ),

    displayName: toTrimmedString(
      employee?.displayName ||
        employee?.name ||
        user?.displayName ||
        user?.name ||
        user?.loginId ||
        '',
    ),
  }
}

function getNormalizedRowsFromEmployeeResponse(res) {
  const normalized = normalizeEmployeesResponse(res)
  return Array.isArray(normalized?.rows) ? normalized.rows : []
}

function findSelfEmployeeFromRows(rows = [], authUser = {}) {
  const employeeId = toTrimmedString(authUser.employeeId)
  const employeeNo = toTrimmedString(authUser.employeeNo).toLowerCase()
  const displayName = toTrimmedString(authUser.displayName).toLowerCase()

  return (
    rows.find((row) => {
      const rowId = toTrimmedString(row?._id || row?.id)
      const rowNo = toTrimmedString(row?.employeeNo).toLowerCase()
      const rowName = toTrimmedString(row?.displayName).toLowerCase()

      if (employeeId && rowId === employeeId) return true
      if (employeeNo && rowNo === employeeNo) return true
      if (employeeNo && rowName === employeeNo) return true
      if (displayName && rowName === displayName) return true

      return false
    }) || null
  )
}

function normalizeShiftOptionsResponse(res) {
  const root = res?.data?.data || res?.data || {}

  const rows =
    root?.items ||
    root?.rows ||
    root?.shifts ||
    root?.data ||
    res?.data?.items ||
    res?.data?.rows ||
    []

  if (!Array.isArray(rows)) return []

  const map = new Map()

  for (const row of rows) {
    const id = toTrimmedString(row?._id || row?.id || row?.shiftId)
    if (!id) continue

    const code = toTrimmedString(row?.code || row?.shiftCode)
    const name = toTrimmedString(row?.name || row?.shiftName)
    const label = [code, name].filter(Boolean).join(' · ') || 'Unnamed shift'

    map.set(id, {
      label,
      value: id,
    })
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function employeeMatchesLocalFilters(employee) {
  const keyword = toTrimmedString(search.value).toLowerCase()
  const shiftId = toTrimmedString(selectedShiftId.value)

  if (shiftId && toTrimmedString(employee?.shiftId) !== shiftId) {
    return false
  }

  if (!keyword) return true

  const haystack = [
    employee?.employeeNo,
    employee?.displayName,
    employee?.positionName,
    employee?.shiftCode,
    employee?.isSelf ? 'self me myself mine' : '',
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(keyword)
}

function mergeUniqueRows(existingRows = [], incomingRows = []) {
  const map = new Map()

  for (const row of existingRows) {
    const id = getEmployeeId(row)
    if (id) map.set(id, row)
  }

  for (const row of incomingRows) {
    const normalized = normalizeEmployeeRecord(row, {
      isSelf: row?.isSelf === true,
    })

    const id = getEmployeeId(normalized)
    if (id) map.set(id, normalized)
  }

  return Array.from(map.values())
}

function emitSelected(rows = []) {
  const normalizedRows = rows
    .map((item) =>
      normalizeEmployeeRecord(item, {
        isSelf: item?.isSelf === true,
      }),
    )
    .filter(Boolean)

  emit('update:modelValue', mergeUniqueRows([], normalizedRows))
}

function selectRows(rows = []) {
  emitSelected([...selectedRows.value, ...rows])
}

function replaceSelection(rows = []) {
  emitSelected(rows)
}

function removeRows(rows = []) {
  const removeIds = new Set(rows.map((item) => getEmployeeId(item)).filter(Boolean))

  emitSelected(
    selectedRows.value.filter((item) => !removeIds.has(getEmployeeId(item))),
  )
}

function isSelected(employee) {
  return selectedIds.value.has(getEmployeeId(employee))
}

function toggleEmployee(employee) {
  const id = getEmployeeId(employee)
  if (!id) return

  if (isSelected(employee)) {
    selectAllMode.value = false
    removeRows([employee])
    return
  }

  selectRows([employee])
}

function clearSelected() {
  selectAllMode.value = false
  emitSelected([])
}

function selectAllLoaded() {
  selectAllMode.value = true
  selectRows(displayedEmployees.value)
}

function buildEmployeeParams(targetPage) {
  const keyword = toTrimmedString(search.value)
  const shiftId = toTrimmedString(selectedShiftId.value)

  return {
    page: targetPage,
    limit: PAGE_SIZE,
    search: keyword,
    q: keyword,
    shiftId,
    isActive: true,
  }
}

async function loadSelfEmployee() {
  try {
    loadingSelf.value = true

    const meRes = await api.get('/auth/me')
    const authUser = normalizeAuthMeUser(meRes)

    const searchKeys = Array.from(
      new Set(
        [
          authUser.employeeNo,
          authUser.employeeId,
          authUser.displayName,
        ]
          .map((item) => toTrimmedString(item))
          .filter(Boolean),
      ),
    )

    let found = null

    for (const keyword of searchKeys) {
      const res = await getEmployees({
        page: 1,
        limit: 10,
        search: keyword,
        q: keyword,
        isActive: true,
      })

      const rows = getNormalizedRowsFromEmployeeResponse(res)
      found = findSelfEmployeeFromRows(rows, authUser)

      if (found) break
    }

    if (found) {
      selfEmployee.value = {
        ...found,
        isSelf: true,
      }
      return
    }

    selfEmployee.value = null

    toast.add({
      severity: 'warn',
      summary: 'Self employee not found',
      detail:
        'Your profile is logged in, but the employee master record was not found by employee lookup.',
      life: 3500,
    })
  } catch (error) {
    selfEmployee.value = null

    toast.add({
      severity: 'warn',
      summary: 'Self employee load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load your employee record.',
      life: 3500,
    })
  } finally {
    loadingSelf.value = false
  }
}

async function loadShiftOptions() {
  try {
    loadingShifts.value = true

    const res = await api.get('/shift/lookup', {
      params: {
        page: 1,
        limit: 300,
        isActive: true,
      },
    })

    remoteShiftOptions.value = normalizeShiftOptionsResponse(res)
  } catch (error) {
    remoteShiftOptions.value = []

    if (error?.response?.status === 403) {
      return
    }

    toast.add({
      severity: 'warn',
      summary: 'Shift filter unavailable',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load shift filter options.',
      life: 2500,
    })
  } finally {
    loadingShifts.value = false
  }
}

async function ensureScrollableFill() {
  await nextTick()

  const el = scrollRef.value
  if (!el || loading.value || loadingMore.value || !hasMore.value) return

  const needsMore = el.scrollHeight <= el.clientHeight + 80

  if (needsMore) {
    await loadEmployees()
  }
}

async function loadEmployees(options = {}) {
  const { reset = false } = options

  if (loading.value || loadingMore.value) return
  if (!reset && !hasMore.value) return

  const targetPage = reset ? 1 : page.value
  const currentSeq = ++requestSeq

  if (targetPage === 1) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  let shouldEnsureFill = false

  try {
    const res = await getEmployees(buildEmployeeParams(targetPage))

    if (currentSeq !== requestSeq) return

    const payload = normalizeEmployeesResponse(res)

    total.value = payload.total
    hasMore.value = payload.hasMore

    if (reset) {
      employees.value = payload.rows
      page.value = 2

      await nextTick()

      if (scrollRef.value) {
        scrollRef.value.scrollTop = 0
      }

      if (selectAllMode.value) {
        replaceSelection(displayedEmployees.value)
      }
    } else {
      employees.value = mergeUniqueRows(employees.value, payload.rows)
      page.value = targetPage + 1

      if (selectAllMode.value) {
        selectRows(displayedEmployees.value)
      }
    }

    shouldEnsureFill = true
  } catch (error) {
    if (reset) {
      employees.value = []
      total.value = 0
      hasMore.value = false
    }

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
    if (targetPage === 1) {
      loading.value = false
    } else {
      loadingMore.value = false
    }
  }

  if (shouldEnsureFill) {
    await ensureScrollableFill()
  }
}

async function resetAndLoadEmployees() {
  page.value = 1
  hasMore.value = true

  await loadEmployees({ reset: true })
}

function handleScroll(event) {
  const el = event?.target
  if (!el || loading.value || loadingMore.value || !hasMore.value) return

  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 160

  if (nearBottom) {
    loadEmployees()
  }
}

function openPicker() {
  dialogVisible.value = true

  nextTick(() => {
    ensureScrollableFill()
  })
}

watch(search, () => {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    resetAndLoadEmployees()
  }, 280)
})

watch(selectedShiftId, () => {
  resetAndLoadEmployees()
})

onMounted(async () => {
  await loadSelfEmployee()

  await Promise.all([
    loadShiftOptions(),
    resetAndLoadEmployees(),
  ])
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <section class="ot-employee-picker">
    <div class="ot-picker-summary">
      <div class="min-w-0">
        <div class="ot-picker-eyebrow">
          Employee Selection <span class="ot-required-star">*</span>
        </div>

        <h2 class="ot-picker-title">
          Search & select employees
        </h2>

        <p class="ot-picker-subtitle">
          Employees are selected by default. Use Shift filter only when the manager has employees from different shifts.
        </p>
      </div>

      <div class="ot-picker-actions">
        <div class="ot-count-box">
          <span>Selected</span>
          <strong>{{ selectedCount }}</strong>
        </div>

        <div class="ot-count-box">
          <span>Loaded</span>
          <strong>{{ loadedCountLabel }}</strong>
        </div>

        <Button
          label="Full Screen"
          icon="pi pi-window-maximize"
          size="small"
          @click="openPicker"
        />
      </div>
    </div>

    <div
      v-if="selectedPreview.length"
      class="ot-selected-preview"
    >
      <div
        v-for="employee in selectedPreview"
        :key="getEmployeeId(employee)"
        class="ot-selected-chip"
      >
        <span>{{ employee.displayName }}</span>
        <small>{{ employee.employeeNo || 'No ID' }}</small>
      </div>

      <Tag
        v-if="selectedCount > selectedPreview.length"
        :value="`+${selectedCount - selectedPreview.length} more`"
        severity="info"
      />
    </div>

    <Message
      v-else
      severity="info"
      :closable="false"
      class="m-3"
    >
      No employees selected.
    </Message>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      maximizable
      class="ot-fullscreen-dialog"
      :style="{ width: '100vw', height: '100vh', maxHeight: '100vh' }"
    >
      <template #header>
        <div class="ot-dialog-header">
          <div class="min-w-0">
            <div class="ot-picker-eyebrow">
              OT Employee Picker <span class="ot-required-star">*</span>
            </div>

            <div class="ot-dialog-title">
              Full screen employee selection
            </div>
          </div>

          <div class="ot-dialog-tags">
            <Tag
              :value="selectAllMode ? 'Auto select ON' : 'Manual select'"
              :severity="selectAllMode ? 'success' : 'secondary'"
            />

            <Tag
              :value="`${selectedCount} selected`"
              severity="contrast"
            />

            <Tag
              :value="`${loadedCountLabel} loaded`"
              severity="info"
            />
          </div>
        </div>
      </template>

      <div class="ot-dialog-body">
        <div class="ot-dialog-toolbar">
          <IconField class="ot-search-field">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model.trim="search"
              class="w-full"
              placeholder="Search employee name, ID, position, or shift code..."
            />
          </IconField>

          <Dropdown
            v-model="selectedShiftId"
            :options="shiftOptions"
            optionLabel="label"
            optionValue="value"
            class="ot-shift-filter"
            placeholder="All shifts"
            :loading="loadingShifts"
          />

          <Button
            label="Select Loaded"
            icon="pi pi-check-square"
            severity="success"
            size="small"
            @click="selectAllLoaded"
          />

          <Button
            label="Clear"
            icon="pi pi-times"
            severity="danger"
            outlined
            size="small"
            :disabled="!selectedCount"
            @click="clearSelected"
          />
        </div>

        <div
          ref="scrollRef"
          class="ot-employee-scroll"
          @scroll="handleScroll"
        >
          <div
            v-if="loading || loadingSelf"
            class="ot-loading-state"
          >
            <ProgressSpinner style="width: 42px; height: 42px" strokeWidth="4" />
            <span>Loading employees...</span>
          </div>

          <div
            v-else-if="!displayedEmployees.length"
            class="ot-empty-state"
          >
            <i class="pi pi-users" />
            <strong>No employees found</strong>
            <span>Try another keyword or shift filter.</span>
          </div>

          <div
            v-else
            class="ot-employee-grid"
          >
            <button
              v-for="employee in displayedEmployees"
              :key="employee._id"
              type="button"
              class="ot-employee-card"
              :class="{ 'is-selected': selectedIds.has(employee._id) }"
              @click="toggleEmployee(employee)"
            >
              <span class="ot-check-circle">
                <i
                  v-if="selectedIds.has(employee._id)"
                  class="pi pi-check"
                />
              </span>

              <span class="ot-employee-name">
                {{ employee.displayName }}
              </span>

              <span class="ot-employee-id">
                ID: {{ employee.employeeNo || 'No ID' }}
              </span>

              <span class="ot-employee-meta">
                <i class="pi pi-clock" />
                {{ employee.shiftCode || 'No shift' }}
              </span>

              <span class="ot-employee-position">
                <i class="pi pi-briefcase" />
                {{ employee.positionName || 'No position' }}
              </span>

              <Tag
                v-if="employee.isSelf"
                value="Self"
                severity="success"
                class="ot-self-tag"
              />
            </button>
          </div>

          <div
            v-if="loadingMore"
            class="ot-more-loading"
          >
            <ProgressSpinner style="width: 26px; height: 26px" strokeWidth="4" />
            <span>Loading more employees...</span>
          </div>

          <div
            v-else-if="!hasMore && displayedEmployees.length"
            class="ot-all-loaded"
          >
            All loaded
          </div>
        </div>
      </div>
    </Dialog>
  </section>
</template>

<style scoped>
.ot-employee-picker {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1.25rem;
  background: var(--ot-surface);
}

.ot-picker-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.ot-picker-eyebrow {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-required-star {
  color: #ef4444;
  font-weight: 600;
}

.ot-picker-title {
  margin-top: 0.2rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-picker-subtitle {
  margin-top: 0.25rem;
  max-width: 760px;
  font-size: 0.82rem;
  color: var(--ot-text-muted);
}

.ot-picker-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.ot-count-box {
  min-width: 84px;
  border: 1px solid var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-bg);
  padding: 0.55rem 0.7rem;
  text-align: center;
}

.ot-count-box span {
  display: block;
  font-size: 0.64rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-count-box strong {
  display: block;
  margin-top: 0.1rem;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-selected-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  border-top: 1px solid var(--ot-border);
  padding: 0.75rem 1rem 1rem;
}

.ot-selected-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 230px;
  border: 1px solid color-mix(in srgb, #22c55e 42%, var(--ot-border));
  border-radius: 999px;
  background: color-mix(in srgb, #22c55e 12%, var(--ot-surface));
  padding: 0.35rem 0.65rem;
}

.ot-selected-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-selected-chip small {
  flex: 0 0 auto;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-dialog-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ot-dialog-title {
  margin-top: 0.15rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-dialog-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}

.ot-dialog-body {
  display: flex;
  height: calc(100vh - 7.25rem);
  min-height: 0;
  flex-direction: column;
  gap: 0.75rem;
}

.ot-dialog-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.75rem;
}

.ot-search-field,
.ot-shift-filter {
  width: 100%;
}

.ot-employee-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
  padding: 0.75rem;
}

.ot-employee-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  gap: 0.65rem;
}

.ot-employee-card {
  position: relative;
  min-height: 116px;
  cursor: pointer;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.72rem 2.25rem 0.72rem 0.78rem;
  text-align: left;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.ot-employee-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #3b82f6 45%, var(--ot-border));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.ot-employee-card.is-selected {
  border-color: color-mix(in srgb, #22c55e 72%, var(--ot-border));
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.17), rgba(59, 130, 246, 0.08)),
    var(--ot-surface);
  box-shadow: 0 12px 30px rgba(34, 197, 94, 0.13);
}

.ot-check-circle {
  position: absolute;
  top: 0.58rem;
  right: 0.58rem;
  display: inline-flex;
  width: 1.45rem;
  height: 1.45rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ot-border);
  border-radius: 999px;
  background: var(--ot-bg);
  color: #16a34a;
  font-size: 0.72rem;
}

.ot-employee-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.18;
  color: var(--ot-text);
}

.ot-employee-id {
  display: block;
  margin-top: 0.4rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-employee-meta,
.ot-employee-position {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.32rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-employee-meta i,
.ot-employee-position i {
  flex: 0 0 auto;
  font-size: 0.7rem;
}

.ot-self-tag {
  margin-top: 0.5rem;
}

.ot-loading-state,
.ot-empty-state {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--ot-text-muted);
  text-align: center;
}

.ot-empty-state i {
  font-size: 2rem;
}

.ot-empty-state strong {
  font-weight: 600;
  color: var(--ot-text);
}

.ot-more-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 1rem;
  font-size: 0.84rem;
  color: var(--ot-text-muted);
}

.ot-all-loaded {
  padding: 1rem;
  text-align: center;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

:deep(.ot-fullscreen-dialog .p-dialog-header) {
  border-bottom: 1px solid var(--ot-border);
}

:deep(.ot-fullscreen-dialog .p-dialog-content) {
  height: 100%;
  padding: 0.75rem !important;
  background: var(--ot-bg) !important;
}

:deep(.ot-search-field .p-inputtext) {
  min-height: 2.6rem !important;
  padding-left: 2.45rem !important;
  border-radius: 0.9rem !important;
}

:deep(.ot-search-field .p-inputicon) {
  color: var(--ot-text-muted) !important;
}

@media (min-width: 768px) {
  .ot-dialog-toolbar {
    grid-template-columns: minmax(260px, 1fr) minmax(210px, 280px) auto auto;
    align-items: center;
  }
}

@media (max-width: 768px) {
  .ot-picker-summary,
  .ot-dialog-header {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-picker-actions,
  .ot-dialog-tags {
    justify-content: flex-start;
  }

  .ot-count-box {
    flex: 1 1 90px;
  }

  .ot-employee-grid {
    grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
  }
}
</style>