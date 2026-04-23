<!-- frontend/src/modules/ot/views/OTCalculationPolicyListView.vue -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import {
  createOTCalculationPolicy,
  getOTCalculationPolicies,
  updateOTCalculationPolicy,
} from '@/modules/ot/otMaster.api'

const toast = useToast()

const PAGE_SIZE = 10

const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const totalRecords = ref(0)

const filters = reactive({
  search: '',
  isActive: '',
  roundMethod: '',
  page: 1,
  limit: PAGE_SIZE,
  sortField: 'createdAt',
  sortOrder: -1,
})

const dialog = reactive({
  visible: false,
  mode: 'create',
  id: '',
})

const form = reactive({
  code: '',
  name: '',
  description: '',
  minEligibleMinutes: 0,
  roundUnitMinutes: 30,
  roundMethod: 'CEIL',
  graceAfterShiftEndMinutes: 0,
  allowPreShiftOT: false,
  allowPostShiftOT: true,
  capByRequestedMinutes: true,
  treatForgetScanInAsPending: true,
  treatForgetScanOutAsPending: true,
  isActive: true,
})

let searchTimer = null

const isActiveOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
]

const roundMethodOptions = [
  { label: 'All Methods', value: '' },
  { label: 'Floor', value: 'FLOOR' },
  { label: 'Ceil', value: 'CEIL' },
  { label: 'Nearest', value: 'NEAREST' },
]

const formRoundMethodOptions = [
  { label: 'Floor', value: 'FLOOR' },
  { label: 'Ceil', value: 'CEIL' },
  { label: 'Nearest', value: 'NEAREST' },
]

const dialogTitle = computed(() =>
  dialog.mode === 'edit' ? 'Edit OT Calculation Policy' : 'Create OT Calculation Policy',
)

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function activeSeverity(value) {
  return value ? 'success' : 'secondary'
}

function boolLabel(value) {
  return value ? 'YES' : 'NO'
}

function boolSeverity(value) {
  return value ? 'success' : 'secondary'
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

function buildQuery() {
  return {
    page: filters.page,
    limit: filters.limit,
    search: String(filters.search || '').trim() || undefined,
    isActive: filters.isActive || undefined,
    roundMethod: filters.roundMethod || undefined,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function resetForm() {
  form.code = ''
  form.name = ''
  form.description = ''
  form.minEligibleMinutes = 0
  form.roundUnitMinutes = 30
  form.roundMethod = 'CEIL'
  form.graceAfterShiftEndMinutes = 0
  form.allowPreShiftOT = false
  form.allowPostShiftOT = true
  form.capByRequestedMinutes = true
  form.treatForgetScanInAsPending = true
  form.treatForgetScanOutAsPending = true
  form.isActive = true
}

function fillForm(row) {
  form.code = String(row?.code || '').trim()
  form.name = String(row?.name || '').trim()
  form.description = String(row?.description || '').trim()
  form.minEligibleMinutes = Number(row?.minEligibleMinutes || 0)
  form.roundUnitMinutes = Number(row?.roundUnitMinutes || 30)
  form.roundMethod = String(row?.roundMethod || 'CEIL').trim() || 'CEIL'
  form.graceAfterShiftEndMinutes = Number(row?.graceAfterShiftEndMinutes || 0)
  form.allowPreShiftOT = row?.allowPreShiftOT === true
  form.allowPostShiftOT = row?.allowPostShiftOT !== false
  form.capByRequestedMinutes = row?.capByRequestedMinutes !== false
  form.treatForgetScanInAsPending = row?.treatForgetScanInAsPending !== false
  form.treatForgetScanOutAsPending = row?.treatForgetScanOutAsPending !== false
  form.isActive = row?.isActive !== false
}

async function fetchPolicies() {
  loading.value = true

  try {
    const res = await getOTCalculationPolicies(buildQuery())
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
        'Failed to load OT calculation policies.',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
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
  if (!String(form.code || '').trim()) return 'Code is required.'
  if (!String(form.name || '').trim()) return 'Name is required.'
  if (Number(form.minEligibleMinutes) < 0) return 'Min eligible minutes must be at least 0.'
  if (Number(form.roundUnitMinutes) < 1) return 'Round unit minutes must be at least 1.'
  if (Number(form.graceAfterShiftEndMinutes) < 0) return 'Grace after shift end must be at least 0.'
  if (!String(form.roundMethod || '').trim()) return 'Round method is required.'
  return ''
}

function buildPayload() {
  return {
    code: String(form.code || '').trim(),
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    minEligibleMinutes: Number(form.minEligibleMinutes || 0),
    roundUnitMinutes: Number(form.roundUnitMinutes || 0),
    roundMethod: String(form.roundMethod || '').trim(),
    graceAfterShiftEndMinutes: Number(form.graceAfterShiftEndMinutes || 0),
    allowPreShiftOT: form.allowPreShiftOT === true,
    allowPostShiftOT: form.allowPostShiftOT === true,
    capByRequestedMinutes: form.capByRequestedMinutes === true,
    treatForgetScanInAsPending: form.treatForgetScanInAsPending === true,
    treatForgetScanOutAsPending: form.treatForgetScanOutAsPending === true,
    isActive: form.isActive === true,
  }
}

async function submitForm() {
  const validationMessage = validateForm()

  if (validationMessage) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: validationMessage,
      life: 2500,
    })
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()

    if (dialog.mode === 'edit' && dialog.id) {
      await updateOTCalculationPolicy(dialog.id, payload)
    } else {
      await createOTCalculationPolicy(payload)
    }

    toast.add({
      severity: 'success',
      summary: dialog.mode === 'edit' ? 'Updated' : 'Created',
      detail:
        dialog.mode === 'edit'
          ? 'OT calculation policy updated successfully.'
          : 'OT calculation policy created successfully.',
      life: 2500,
    })

    dialog.visible = false
    await fetchPolicies()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: dialog.mode === 'edit' ? 'Update failed' : 'Create failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to save OT calculation policy.',
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

function onPage(event) {
  filters.page = Math.floor(Number(event.first || 0) / Number(event.rows || PAGE_SIZE)) + 1
  filters.limit = Number(event.rows || PAGE_SIZE)
  fetchPolicies()
}

function onSort(event) {
  const fieldMap = {
    code: 'code',
    name: 'name',
    roundMethod: 'roundMethod',
    roundUnitMinutes: 'roundUnitMinutes',
    isActive: 'isActive',
    createdAt: 'createdAt',
  }

  filters.sortField = fieldMap[event.sortField] || 'createdAt'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : -1
  filters.page = 1
  fetchPolicies()
}

function clearFilters() {
  filters.search = ''
  filters.isActive = ''
  filters.roundMethod = ''
  filters.page = 1
  filters.limit = PAGE_SIZE
  filters.sortField = 'createdAt'
  filters.sortOrder = -1
  fetchPolicies()
}

watch(
  () => [filters.isActive, filters.roundMethod],
  () => {
    filters.page = 1
    fetchPolicies()
  },
)

watch(
  () => filters.search,
  () => {
    filters.page = 1

    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      fetchPolicies()
    }, 300)
  },
)

onMounted(() => {
  fetchPolicies()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          OT Calculation Policies
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Manage OT rounding rules, eligibility thresholds, grace minutes, and scan-pending behavior.
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
            {{ totalRecords }}
          </div>
        </div>

        <Button
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="loading"
          @click="fetchPolicies"
        />

        <Button
          label="New Policy"
          icon="pi pi-plus"
          size="small"
          @click="openCreate"
        />
      </div>
    </div>

    <Card class="ot-policy-card">
      <template #content>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
            <IconField class="w-full xl:w-[320px] xl:shrink-0">
              <InputIcon class="pi pi-search" />
              <InputText
                v-model="filters.search"
                placeholder="Search code, name, description"
                class="w-full"
                size="small"
              />
            </IconField>

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

            <div class="w-full xl:w-[180px] xl:shrink-0">
              <Select
                v-model="filters.roundMethod"
                :options="roundMethodOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Round Method"
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
            tableStyle="min-width: 96rem"
            class="ot-policy-table"
            @page="onPage"
            @sort="onSort"
          >
            <template #empty>
              <div class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]">
                No OT calculation policies found.
              </div>
            </template>

            <Column field="code" header="Code" sortable style="min-width: 12rem">
              <template #body="{ data }">
                <span class="font-medium">{{ data.code || '-' }}</span>
              </template>
            </Column>

            <Column field="name" header="Name" sortable style="min-width: 16rem" />

            <Column field="roundMethod" header="Round Method" sortable style="min-width: 10rem">
              <template #body="{ data }">
                <Tag :value="data.roundMethod || '-'" severity="info" />
              </template>
            </Column>

            <Column field="roundUnitMinutes" header="Round Unit" sortable style="min-width: 9rem">
              <template #body="{ data }">
                {{ Number(data.roundUnitMinutes || 0) }} min
              </template>
            </Column>

            <Column field="minEligibleMinutes" header="Min Eligible" style="min-width: 10rem">
              <template #body="{ data }">
                {{ Number(data.minEligibleMinutes || 0) }} min
              </template>
            </Column>

            <Column field="graceAfterShiftEndMinutes" header="Grace" style="min-width: 8rem">
              <template #body="{ data }">
                {{ Number(data.graceAfterShiftEndMinutes || 0) }} min
              </template>
            </Column>

            <Column header="Flags" style="min-width: 24rem">
              <template #body="{ data }">
                <div class="flex flex-wrap gap-1.5">
                  <Tag :value="`Pre: ${boolLabel(data.allowPreShiftOT)}`" :severity="boolSeverity(data.allowPreShiftOT)" />
                  <Tag :value="`Post: ${boolLabel(data.allowPostShiftOT)}`" :severity="boolSeverity(data.allowPostShiftOT)" />
                  <Tag :value="`Cap: ${boolLabel(data.capByRequestedMinutes)}`" :severity="boolSeverity(data.capByRequestedMinutes)" />
                  <Tag :value="`FS-In: ${boolLabel(data.treatForgetScanInAsPending)}`" :severity="boolSeverity(data.treatForgetScanInAsPending)" />
                  <Tag :value="`FS-Out: ${boolLabel(data.treatForgetScanOutAsPending)}`" :severity="boolSeverity(data.treatForgetScanOutAsPending)" />
                </div>
              </template>
            </Column>

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
      :style="{ width: '72rem', maxWidth: '96vw' }"
      :header="dialogTitle"
    >
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Code</label>
              <InputText v-model.trim="form.code" class="w-full" placeholder="POST_SHIFT_STD_30M_CEIL" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Name</label>
              <InputText v-model.trim="form.name" class="w-full" placeholder="Post Shift Standard 30-Minute Ceiling" />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-[color:var(--ot-text)]">Description</label>
            <Textarea
              v-model.trim="form.description"
              rows="4"
              autoResize
              class="w-full"
              placeholder="Policy description"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Min Eligible Minutes</label>
              <InputNumber v-model="form.minEligibleMinutes" inputClass="w-full" class="w-full" :min="0" :useGrouping="false" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Round Unit Minutes</label>
              <InputNumber v-model="form.roundUnitMinutes" inputClass="w-full" class="w-full" :min="1" :useGrouping="false" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Round Method</label>
              <Select
                v-model="form.roundMethod"
                :options="formRoundMethodOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-[color:var(--ot-text)]">Grace After Shift End</label>
              <InputNumber
                v-model="form.graceAfterShiftEndMinutes"
                inputClass="w-full"
                class="w-full"
                :min="0"
                :useGrouping="false"
              />
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4">
            <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
              Behavior Flags
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label class="ot-check-item">
                <input v-model="form.allowPreShiftOT" type="checkbox">
                <span>Allow Pre-Shift OT</span>
              </label>

              <label class="ot-check-item">
                <input v-model="form.allowPostShiftOT" type="checkbox">
                <span>Allow Post-Shift OT</span>
              </label>

              <label class="ot-check-item">
                <input v-model="form.capByRequestedMinutes" type="checkbox">
                <span>Cap by Requested Minutes</span>
              </label>

              <label class="ot-check-item">
                <input v-model="form.treatForgetScanInAsPending" type="checkbox">
                <span>Forget Scan In = Pending</span>
              </label>

              <label class="ot-check-item">
                <input v-model="form.treatForgetScanOutAsPending" type="checkbox">
                <span>Forget Scan Out = Pending</span>
              </label>

              <label class="ot-check-item">
                <input v-model="form.isActive" type="checkbox">
                <span>Active</span>
              </label>
            </div>
          </div>

          <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4">
            <div class="mb-2 text-sm font-semibold text-[color:var(--ot-text)]">
              Quick Summary
            </div>

            <div class="grid grid-cols-1 gap-2 text-sm text-[color:var(--ot-text-muted)]">
              <div><span class="font-medium text-[color:var(--ot-text)]">Round:</span> {{ form.roundMethod }} every {{ Number(form.roundUnitMinutes || 0) }} min</div>
              <div><span class="font-medium text-[color:var(--ot-text)]">Min Eligible:</span> {{ Number(form.minEligibleMinutes || 0) }} min</div>
              <div><span class="font-medium text-[color:var(--ot-text)]">Grace:</span> {{ Number(form.graceAfterShiftEndMinutes || 0) }} min</div>
            </div>
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
            :label="dialog.mode === 'edit' ? 'Save Changes' : 'Create Policy'"
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
:deep(.ot-policy-card .p-card-body) {
  padding: 1rem !important;
}

:deep(.ot-policy-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.ot-policy-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  vertical-align: middle !important;
}

.ot-check-item {
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