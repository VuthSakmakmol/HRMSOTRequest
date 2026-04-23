<!-- frontend/src/modules/ot/views/ShiftOTOptionListView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { getShifts } from '@/modules/shift/shift.api'
import {
  createShiftOTOption,
  getOTCalculationPolicies,
  getShiftOTOptions,
  updateShiftOTOption,
} from '@/modules/ot/otMaster.api'

const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300
const SELECT_FETCH_LIMIT = 100

const loading = ref(false)
const saving = ref(false)

const rows = ref([])
const totalRecords = ref(0)

const shiftSelectOptions = ref([])
const policySelectOptions = ref([])

const filters = reactive({
  search: '',
  shiftId: '',
  calculationPolicyId: '',
  isActive: '',
  page: 1,
  limit: PAGE_SIZE,
  sortField: 'sequence',
  sortOrder: 1,
})

const dialog = reactive({
  visible: false,
  mode: 'create',
  id: '',
})

const form = reactive({
  shiftId: '',
  label: '',
  requestedMinutes: 120,
  calculationPolicyId: '',
  sequence: 1,
  isActive: true,
})

let searchTimer = null

const dialogTitle = computed(() =>
  dialog.mode === 'edit' ? 'Edit Shift OT Option' : 'Create Shift OT Option',
)

const totalRows = computed(() => Number(totalRecords.value || 0))

const filterShiftOptions = computed(() => [
  { label: 'All Shifts', value: '' },
  ...shiftSelectOptions.value,
])

const filterPolicyOptions = computed(() => [
  { label: 'All Policies', value: '' },
  ...policySelectOptions.value,
])

const isActiveOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
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

function activeSeverity(value) {
  return value ? 'success' : 'secondary'
}

function shiftLabel(row) {
  const shift = row?.shift || {}
  const code = String(shift?.code || '').trim()
  const name = String(shift?.name || '').trim()

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name
  return '-'
}

function shiftSubLabel(row) {
  const shift = row?.shift || {}
  const type = String(shift?.type || '').trim()
  const start = String(shift?.startTime || '').trim()
  const end = String(shift?.endTime || '').trim()

  const pieces = [type, start && end ? `${start} - ${end}` : ''].filter(Boolean)
  return pieces.length ? pieces.join(' · ') : '-'
}

function policyLabel(row) {
  const policy = row?.calculationPolicy || {}
  const code = String(policy?.code || '').trim()
  const name = String(policy?.name || '').trim()

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name
  return '-'
}

function buildQuery() {
  return {
    page: filters.page,
    limit: filters.limit,
    search: String(filters.search || '').trim() || undefined,
    shiftId: filters.shiftId || undefined,
    calculationPolicyId: filters.calculationPolicyId || undefined,
    isActive: filters.isActive || undefined,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

async function fetchShiftOptionsForSelect() {
  try {
    const res = await getShifts({
      page: 1,
      limit: SELECT_FETCH_LIMIT,
    })

    const payload = normalizePayload(res)
    const items = Array.isArray(payload?.items) ? payload.items : []

    shiftSelectOptions.value = items
      .filter((item) => item?.isActive !== false)
      .map((item) => ({
        label: `${String(item?.code || '').trim()} · ${String(item?.name || '').trim()}`.replace(
          /^ · | · $/g,
          '',
        ),
        value: String(item?._id || item?.id || '').trim(),
        subLabel: [
          String(item?.type || '').trim(),
          String(item?.startTime || '').trim() && String(item?.endTime || '').trim()
            ? `${String(item?.startTime || '').trim()} - ${String(item?.endTime || '').trim()}`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }))
      .filter((item) => item.value)
  } catch (error) {
    shiftSelectOptions.value = []
    toast.add({
      severity: 'error',
      summary: 'Shift load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load shifts.',
      life: 3000,
    })
  }
}

async function fetchPoliciesForSelect() {
  try {
    const res = await getOTCalculationPolicies({
      page: 1,
      limit: SELECT_FETCH_LIMIT,
    })

    const payload = normalizePayload(res)
    const items = Array.isArray(payload?.items) ? payload.items : []

    policySelectOptions.value = items
      .filter((item) => item?.isActive !== false)
      .map((item) => ({
        label: `${String(item?.code || '').trim()} · ${String(item?.name || '').trim()}`.replace(
          /^ · | · $/g,
          '',
        ),
        value: String(item?.id || item?._id || '').trim(),
        subLabel: `${String(item?.roundMethod || '').trim()} · ${Number(item?.roundUnitMinutes || 0)} min`,
      }))
      .filter((item) => item.value)
  } catch (error) {
    policySelectOptions.value = []
    toast.add({
      severity: 'error',
      summary: 'Policy load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load OT calculation policies.',
      life: 3000,
    })
  }
}

async function fetchShiftOTOptions() {
  loading.value = true

  try {
    const res = await getShiftOTOptions(buildQuery())
    const payload = normalizePayload(res)

    rows.value = Array.isArray(payload?.items) ? payload.items : []
    totalRecords.value = Number(payload?.pagination?.total || 0)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load shift OT options.',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.shiftId = ''
  form.label = ''
  form.requestedMinutes = 120
  form.calculationPolicyId = ''
  form.sequence = 1
  form.isActive = true
}

function fillForm(row) {
  form.shiftId = String(row?.shiftId || row?.shift?.id || row?.shift?._id || '').trim()
  form.label = String(row?.label || '').trim()
  form.requestedMinutes = Number(row?.requestedMinutes || 120)
  form.calculationPolicyId = String(
    row?.calculationPolicyId ||
      row?.calculationPolicy?.id ||
      row?.calculationPolicy?._id ||
      '',
  ).trim()
  form.sequence = Number(row?.sequence || 1)
  form.isActive = row?.isActive !== false
}

function openCreate() {
  dialog.visible = true
  dialog.mode = 'create'
  dialog.id = ''
  resetForm()
}

function openEdit(row) {
  dialog.visible = true
  dialog.mode = 'edit'
  dialog.id = String(row?.id || row?._id || '').trim()
  fillForm(row)
}

function closeDialog() {
  if (saving.value) return
  dialog.visible = false
}

function validateForm() {
  if (!String(form.shiftId || '').trim()) return 'Shift is required.'
  if (!String(form.label || '').trim()) return 'Label is required.'
  if (Number(form.requestedMinutes || 0) < 1) return 'Requested minutes must be at least 1.'
  if (!String(form.calculationPolicyId || '').trim()) return 'Calculation policy is required.'
  if (Number(form.sequence || 0) < 1) return 'Sequence must be at least 1.'
  return ''
}

function buildPayload() {
  return {
    shiftId: String(form.shiftId || '').trim(),
    label: String(form.label || '').trim(),
    requestedMinutes: Number(form.requestedMinutes || 0),
    calculationPolicyId: String(form.calculationPolicyId || '').trim(),
    sequence: Number(form.sequence || 0),
    isActive: form.isActive === true,
  }
}

async function submitForm() {
  const message = validateForm()

  if (message) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: message,
      life: 2500,
    })
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()

    if (dialog.mode === 'edit' && dialog.id) {
      await updateShiftOTOption(dialog.id, payload)
    } else {
      await createShiftOTOption(payload)
    }

    toast.add({
      severity: 'success',
      summary: dialog.mode === 'edit' ? 'Updated' : 'Created',
      detail:
        dialog.mode === 'edit'
          ? 'Shift OT option updated successfully.'
          : 'Shift OT option created successfully.',
      life: 2500,
    })

    dialog.visible = false
    await fetchShiftOTOptions()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: dialog.mode === 'edit' ? 'Update failed' : 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to save shift OT option.',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

function onPage(event) {
  filters.page = Math.floor(Number(event.first || 0) / Number(event.rows || PAGE_SIZE)) + 1
  filters.limit = Number(event.rows || PAGE_SIZE)
  fetchShiftOTOptions()
}

function onSort(event) {
  const fieldMap = {
    label: 'label',
    requestedMinutes: 'requestedMinutes',
    sequence: 'sequence',
    isActive: 'isActive',
    createdAt: 'createdAt',
  }

  filters.sortField = fieldMap[event.sortField] || 'sequence'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : 1
  filters.page = 1
  fetchShiftOTOptions()
}

function clearFilters() {
  filters.search = ''
  filters.shiftId = ''
  filters.calculationPolicyId = ''
  filters.isActive = ''
  filters.page = 1
  filters.limit = PAGE_SIZE
  filters.sortField = 'sequence'
  filters.sortOrder = 1
  fetchShiftOTOptions()
}

watch(
  () => [filters.shiftId, filters.calculationPolicyId, filters.isActive],
  () => {
    filters.page = 1
    fetchShiftOTOptions()
  },
)

watch(
  () => filters.search,
  () => {
    filters.page = 1

    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      fetchShiftOTOptions()
    }, SEARCH_DEBOUNCE_MS)
  },
)

onMounted(async () => {
  await Promise.all([fetchShiftOptionsForSelect(), fetchPoliciesForSelect()])
  await fetchShiftOTOptions()
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Shift OT Options
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Manage selectable OT durations per shift and assign the calculation policy used by requester flow.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Total
          </div>
          <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
            {{ totalRows }}
          </div>
        </div>

        <Button
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="loading"
          @click="fetchShiftOTOptions"
        />

        <Button
          label="New Shift OT Option"
          icon="pi pi-plus"
          size="small"
          @click="openCreate"
        />
      </div>
    </div>

    <Card class="shift-ot-option-card">
      <template #content>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
            <IconField class="w-full xl:w-[320px] xl:shrink-0">
              <InputIcon class="pi pi-search" />
              <InputText
                v-model="filters.search"
                placeholder="Search option label"
                class="w-full"
                size="small"
              />
            </IconField>

            <div class="w-full xl:w-[260px] xl:shrink-0">
              <Select
                v-model="filters.shiftId"
                :options="filterShiftOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Shift"
                class="w-full"
                size="small"
                filter
              />
            </div>

            <div class="w-full xl:w-[280px] xl:shrink-0">
              <Select
                v-model="filters.calculationPolicyId"
                :options="filterPolicyOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Calculation Policy"
                class="w-full"
                size="small"
                filter
              />
            </div>

            <div class="w-full xl:w-[180px] xl:shrink-0">
              <Select
                v-model="filters.isActive"
                :options="isActiveOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Status"
                class="w-full"
                size="small"
              />
            </div>

            <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
              <Button
                label="Clear"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                size="small"
                @click="clearFilters"
              />
            </div>
          </div>

          <DataTable
            :value="rows"
            lazy
            paginator
            removableSort
            :rows="filters.limit"
            :first="(filters.page - 1) * filters.limit"
            :totalRecords="totalRecords"
            :rowsPerPageOptions="[10, 20, 50]"
            responsiveLayout="scroll"
            scrollable
            tableStyle="min-width: 104rem"
            class="shift-ot-option-table"
            @page="onPage"
            @sort="onSort"
          >
            <template #empty>
              <div class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]">
                No shift OT options found.
              </div>
            </template>

            <Column header="Shift" style="min-width: 16rem">
              <template #body="{ data }">
                <div class="flex flex-col">
                  <span class="font-medium text-[color:var(--ot-text)]">
                    {{ shiftLabel(data) }}
                  </span>
                  <span class="text-xs text-[color:var(--ot-text-muted)]">
                    {{ shiftSubLabel(data) }}
                  </span>
                </div>
              </template>
            </Column>

            <Column field="label" header="Option Label" sortable style="min-width: 14rem" />

            <Column field="requestedMinutes" header="Requested Minutes" sortable style="min-width: 10rem">
              <template #body="{ data }">
                {{ Number(data.requestedMinutes || 0) }} min
              </template>
            </Column>

            <Column header="Requested Duration" style="min-width: 10rem">
              <template #body="{ data }">
                {{ formatMinutesLabel(data.requestedMinutes) }}
              </template>
            </Column>

            <Column header="Calculation Policy" style="min-width: 18rem">
              <template #body="{ data }">
                <div class="flex flex-col">
                  <span class="font-medium text-[color:var(--ot-text)]">
                    {{ policyLabel(data) }}
                  </span>
                  <span class="text-xs text-[color:var(--ot-text-muted)]">
                    {{ data?.calculationPolicy?.roundMethod || '-' }} · {{ Number(data?.calculationPolicy?.roundUnitMinutes || 0) }} min
                  </span>
                </div>
              </template>
            </Column>

            <Column field="sequence" header="Sequence" sortable style="min-width: 8rem" />

            <Column field="isActive" header="Active" sortable style="min-width: 8rem">
              <template #body="{ data }">
                <Tag
                  :value="data.isActive ? 'ACTIVE' : 'INACTIVE'"
                  :severity="activeSeverity(data.isActive)"
                />
              </template>
            </Column>

            <Column field="createdAt" header="Created At" sortable style="min-width: 14rem">
              <template #body="{ data }">
                {{ formatDateTime(data.createdAt) }}
              </template>
            </Column>

            <Column header="Actions" style="min-width: 8rem">
              <template #body="{ data }">
                <Button
                  label="Edit"
                  icon="pi pi-pencil"
                  size="small"
                  severity="warning"
                  outlined
                  @click="openEdit(data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialog.visible"
      modal
      :closable="!saving"
      :style="{ width: '64rem', maxWidth: '96vw' }"
      :header="dialogTitle"
    >
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">Shift</label>
            <Select
              v-model="form.shiftId"
              :options="shiftSelectOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              filter
              placeholder="Select shift"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">Option Label</label>
            <InputText
              v-model.trim="form.label"
              class="w-full"
              placeholder="2 Hours / 3 Hours / 4 Hours"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Requested Minutes</label>
              <InputNumber
                v-model="form.requestedMinutes"
                inputClass="w-full"
                class="w-full"
                :min="1"
                :useGrouping="false"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Sequence</label>
              <InputNumber
                v-model="form.sequence"
                inputClass="w-full"
                class="w-full"
                :min="1"
                :useGrouping="false"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">Calculation Policy</label>
            <Select
              v-model="form.calculationPolicyId"
              :options="policySelectOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              filter
              placeholder="Select policy"
            />
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4">
            <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
              Quick Summary
            </div>

            <div class="grid grid-cols-1 gap-2 text-sm text-[color:var(--ot-text-muted)]">
              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Requested:</span>
                {{ Number(form.requestedMinutes || 0) }} min
                <span class="ml-1">({{ formatMinutesLabel(form.requestedMinutes) }})</span>
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Sequence:</span>
                {{ Number(form.sequence || 0) }}
              </div>

              <div>
                <span class="font-medium text-[color:var(--ot-text)]">Status:</span>
                {{ form.isActive ? 'ACTIVE' : 'INACTIVE' }}
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
            <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
              Flags
            </div>

            <label class="shift-ot-check-item">
              <Checkbox v-model="form.isActive" binary />
              <span>Active</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            :disabled="saving"
            @click="closeDialog"
          />
          <Button
            :label="dialog.mode === 'edit' ? 'Save Changes' : 'Create Option'"
            :icon="dialog.mode === 'edit' ? 'pi pi-save' : 'pi pi-plus'"
            :loading="saving"
            @click="submitForm"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.shift-ot-option-card .p-card-body) {
  padding: 1rem !important;
}

:deep(.shift-ot-option-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.shift-ot-option-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  vertical-align: middle !important;
}

.shift-ot-check-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  border-radius: 0.9rem;
  padding: 0.75rem 0.9rem;
  color: var(--ot-text);
  font-size: 0.92rem;
}
</style>