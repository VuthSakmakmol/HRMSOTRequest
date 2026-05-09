<!-- frontend/src/modules/payment/views/PaymentFormulaView.vue -->
<script setup>
// frontend/src/modules/payment/views/PaymentFormulaView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
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
import Textarea from 'primevue/textarea'

import AppTableLoading from '@/shared/components/AppTableLoading.vue'

import {
  createPaymentFormula,
  getPaymentFormulas,
  updatePaymentFormula,
} from '@/modules/payment/payment.api'

const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const saving = ref(false)

const dialogVisible = ref(false)
const editingId = ref('')

const filters = reactive({
  search: '',
  isActive: '',
})

const sortState = reactive({
  sortBy: 'createdAt',
  sortOrder: 'desc',
})

const form = reactive(defaultForm())

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
]

const totalItems = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalItems.value}`)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalItems.value > PAGE_SIZE)
const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})
const isEditMode = computed(() => Boolean(editingId.value))

let searchTimer = null
let currentRequestId = 0

function defaultForm() {
  return {
    code: '',
    name: '',
    description: '',
    salaryBasis: 'MONTHLY_SALARY',
    monthlyWorkingDays: 26,
    hoursPerDay: 8,
    multipliers: {
      WORKING_DAY: 1.5,
      SUNDAY: 2,
      HOLIDAY: 3,
    },
    roundingDecimals: 2,
    currency: 'USD',
    isActive: true,
  }
}

function resetForm() {
  Object.assign(form, defaultForm())
}

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeRow(row) {
  if (!row) return row

  return {
    ...row,
    id: String(row?.id || row?._id || '').trim(),
  }
}

function errorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateTimeDMY(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')

  const dd = pad2(date.getDate())
  const mm = pad2(date.getMonth() + 1)
  const yyyy = date.getFullYear()
  const hh = pad2(date.getHours())
  const min = pad2(date.getMinutes())

  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

function formatMultiplier(value) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return '0'
  if (Number.isInteger(number)) return String(number)

  return number.toFixed(4).replace(/\.?0+$/, '')
}

function normalizeClassKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

function statusClass(value) {
  return `payment-status-${normalizeClassKey(value ? 'active' : 'inactive')}`
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
    isActive: filters.isActive === '' ? undefined : filters.isActive,
    sortBy: sortState.sortBy,
    sortOrder: sortState.sortOrder,
  }
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getPaymentFormulas(buildQuery(page))
    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload).map(normalizeRow)

    const total = Number(
      payload?.pagination?.total ||
        payload?.pagination?.totalRecords ||
        0,
    )

    totalRecords.value = total

    if (replace) {
      const nextRows = Array.from({ length: total }, () => null)
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        rows.value[startIndex + i] = items[i]
      }

      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    bootstrapped.value = true

    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail: errorMessage(error, 'Failed to load payment formulas'),
      life: 3000,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
  })
}

function runSearchSoon() {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    reloadFirstPage({ keepVisible: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.isActive = ''
  sortState.sortBy = 'createdAt'
  sortState.sortOrder = 'desc'

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  sortState.sortBy = event?.sortField || 'createdAt'
  sortState.sortOrder = event?.sortOrder === 1 ? 'asc' : 'desc'

  reloadFirstPage({ keepVisible: true })
}

async function onVirtualLazyLoad(event) {
  if (!useVirtualScroll.value) return

  const first = Number(event?.first || 0)
  const last = Number(event?.last || first + PAGE_SIZE)

  const startPage = Math.floor(first / PAGE_SIZE) + 1
  const endPage = Math.floor(Math.max(last - 1, first) / PAGE_SIZE) + 1

  for (let page = startPage; page <= endPage; page += 1) {
    if (!loadedPages.value.has(page)) {
      await fetchPage(page, { silent: true })
    }
  }
}

function openCreateDialog() {
  editingId.value = ''
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  if (!row) return

  editingId.value = String(row?._id || row?.id || '')

  Object.assign(form, {
    code: row.code || '',
    name: row.name || '',
    description: row.description || '',
    salaryBasis: row.salaryBasis || 'MONTHLY_SALARY',
    monthlyWorkingDays: Number(row.monthlyWorkingDays || 26),
    hoursPerDay: Number(row.hoursPerDay || 8),
    multipliers: {
      WORKING_DAY: Number(row.multipliers?.WORKING_DAY ?? 1.5),
      SUNDAY: Number(row.multipliers?.SUNDAY ?? 2),
      HOLIDAY: Number(row.multipliers?.HOLIDAY ?? 3),
    },
    roundingDecimals: Number(row.roundingDecimals ?? 2),
    currency: row.currency || 'USD',
    isActive: Boolean(row.isActive),
  })

  dialogVisible.value = true
}

function normalizeSavePayload() {
  return {
    code: upper(form.code),
    name: s(form.name),
    description: s(form.description),
    salaryBasis: 'MONTHLY_SALARY',
    monthlyWorkingDays: Number(form.monthlyWorkingDays || 0),
    hoursPerDay: Number(form.hoursPerDay || 0),
    multipliers: {
      WORKING_DAY: Number(form.multipliers.WORKING_DAY || 0),
      SUNDAY: Number(form.multipliers.SUNDAY || 0),
      HOLIDAY: Number(form.multipliers.HOLIDAY || 0),
    },
    roundingDecimals: Number(form.roundingDecimals ?? 2),
    currency: upper(form.currency || 'USD'),
    isActive: Boolean(form.isActive),
  }
}

function validatePayload(payload) {
  if (!payload.code) return 'Code is required'
  if (!payload.name) return 'Name is required'
  if (payload.monthlyWorkingDays <= 0) return 'Monthly working days must be greater than 0'
  if (payload.hoursPerDay <= 0) return 'Hours per day must be greater than 0'
  if (payload.multipliers.WORKING_DAY < 0) return 'Working day multiplier cannot be negative'
  if (payload.multipliers.SUNDAY < 0) return 'Sunday multiplier cannot be negative'
  if (payload.multipliers.HOLIDAY < 0) return 'Holiday multiplier cannot be negative'
  if (payload.roundingDecimals < 0 || payload.roundingDecimals > 6) {
    return 'Round decimals must be between 0 and 6'
  }

  return ''
}

async function saveFormula() {
  const payload = normalizeSavePayload()
  const validationMessage = validatePayload(payload)

  if (validationMessage) {
    toast.add({
      severity: 'warn',
      summary: 'Check form',
      detail: validationMessage,
      life: 3000,
    })
    return
  }

  saving.value = true

  try {
    if (isEditMode.value) {
      await updatePaymentFormula(editingId.value, payload)

      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Payment formula updated successfully',
        life: 2500,
      })
    } else {
      await createPaymentFormula(payload)

      toast.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Payment formula created successfully',
        life: 2500,
      })
    }

    dialogVisible.value = false
    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: errorMessage(error, 'Failed to save payment formula'),
      life: 3500,
    })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <!-- Compact filter/action bar -->
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[240px] xl:shrink-0">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              placeholder="Search"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[175px] xl:shrink-0">
            <Select
              v-model="filters.isActive"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
              size="small"
              @change="onStatusChange"
            />
          </div>

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <div
              class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]"
            >
              Loaded {{ summaryText }}
            </div>

            <Button
              label="Clear"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />

            <Button
              label="New Formula"
              icon="pi pi-plus"
              size="small"
              @click="openCreateDialog"
            />
          </div>
        </div>
      </div>

      <AppTableLoading
        v-if="firstLoading"
        title="Loading payment formulas"
        message="Fetching payment formula setup..."
        :rows="8"
        :columns="8"
      />

      <DataTable
        v-else
        :value="rows"
        dataKey="id"
        lazy
        scrollable
        scrollHeight="500px"
        removableSort
        tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
        class="payment-formula-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 64,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
        @sort="onSort"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No payment formulas found.
          </div>
        </template>

        <Column field="code" header="Code" sortable>
          <template #body="{ data }">
            <span
              v-if="data"
              class="font-semibold text-[color:var(--ot-text)]"
            >
              {{ data.code || '-' }}
            </span>
          </template>
        </Column>

        <Column field="name" header="Formula Name" sortable>
          <template #body="{ data }">
            <div v-if="data" class="formula-name-cell">
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ data.name || '-' }}
              </div>

              <div
                v-if="data.description"
                class="mt-0.5 max-w-[360px] truncate text-xs text-[color:var(--ot-text-muted)]"
              >
                {{ data.description }}
              </div>
            </div>
          </template>
        </Column>

        <Column header="Base Rule">
          <template #body="{ data }">
            <div
              v-if="data"
              class="whitespace-nowrap text-xs font-medium text-[color:var(--ot-text-muted)]"
            >
              <div>{{ data.monthlyWorkingDays || 0 }} days / month</div>
              <div>{{ data.hoursPerDay || 0 }} hours / day</div>
            </div>
          </template>
        </Column>

        <Column header="Multipliers">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-wrap gap-1.5">
              <Tag
                :value="`Working ${formatMultiplier(data.multipliers?.WORKING_DAY)}x`"
                severity="success"
                class="payment-status-tag payment-day-working"
              />

              <Tag
                :value="`Sunday ${formatMultiplier(data.multipliers?.SUNDAY)}x`"
                severity="warning"
                class="payment-status-tag payment-day-sunday"
              />

              <Tag
                :value="`Holiday ${formatMultiplier(data.multipliers?.HOLIDAY)}x`"
                severity="danger"
                class="payment-status-tag payment-day-holiday"
              />
            </div>
          </template>
        </Column>

        <Column header="Round">
          <template #body="{ data }">
            <span
              v-if="data"
              class="whitespace-nowrap text-sm font-medium text-[color:var(--ot-text)]"
            >
              {{ data.roundingDecimals ?? 2 }} decimals
            </span>
          </template>
        </Column>

        <Column header="Currency">
          <template #body="{ data }">
            <span
              v-if="data"
              class="whitespace-nowrap text-sm font-semibold text-[color:var(--ot-text)]"
            >
              {{ data.currency || 'USD' }}
            </span>
          </template>
        </Column>

        <Column field="isActive" header="Status" sortable>
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.isActive ? 'Active' : 'Inactive'"
              :severity="data.isActive ? 'success' : 'danger'"
              class="payment-status-tag"
              :class="statusClass(data.isActive)"
            />
          </template>
        </Column>

        <Column field="updatedAt" header="Updated At" sortable>
          <template #body="{ data }">
            <span
              v-if="data"
              class="whitespace-nowrap text-xs font-medium text-[color:var(--ot-text-muted)]"
            >
              {{ formatDateTimeDMY(data.updatedAt || data.createdAt) }}
            </span>
          </template>
        </Column>

        <Column header="Action" frozen alignFrozen="right">
          <template #body="{ data }">
            <Button
              v-if="data"
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              size="small"
              @click="openEditDialog(data)"
            />
          </template>
        </Column>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <Dialog
      v-model:visible="dialogVisible"
      modal
      :draggable="false"
      :header="isEditMode ? 'Edit Payment Formula' : 'Create Payment Formula'"
      class="payment-dialog w-[96vw] max-w-3xl"
    >
      <div class="flex flex-col gap-3">
        <div class="payment-warning-box">
          <i class="pi pi-info-circle" />
          <div>
            Formula setup is saved. Salary Excel and generated payment result are not saved.
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="field-box">
            <label>Code <span>*</span></label>
            <InputText
              v-model="form.code"
              class="w-full"
              placeholder="STD_OT_2026"
              :disabled="saving"
            />
          </div>

          <div class="field-box">
            <label>Name <span>*</span></label>
            <InputText
              v-model="form.name"
              class="w-full"
              placeholder="Standard OT Formula 2026"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="field-box">
          <label>Description</label>
          <Textarea
            v-model="form.description"
            class="w-full"
            rows="2"
            autoResize
            placeholder="Optional description..."
            :disabled="saving"
          />
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div class="field-box">
            <label>Working Days <span>*</span></label>
            <InputNumber
              v-model="form.monthlyWorkingDays"
              class="w-full"
              inputClass="w-full"
              :min="1"
              :maxFractionDigits="2"
              :disabled="saving"
            />
          </div>

          <div class="field-box">
            <label>Hours / Day <span>*</span></label>
            <InputNumber
              v-model="form.hoursPerDay"
              class="w-full"
              inputClass="w-full"
              :min="1"
              :maxFractionDigits="2"
              :disabled="saving"
            />
          </div>

          <div class="field-box">
            <label>Round Decimals</label>
            <InputNumber
              v-model="form.roundingDecimals"
              class="w-full"
              inputClass="w-full"
              :min="0"
              :max="6"
              :disabled="saving"
            />
          </div>

          <div class="field-box">
            <label>Currency</label>
            <InputText
              v-model="form.currency"
              class="w-full"
              placeholder="USD"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="formula-section">
          <div class="formula-section-title">Day Type Multipliers</div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="field-box">
              <label>Working Day</label>
              <InputNumber
                v-model="form.multipliers.WORKING_DAY"
                class="w-full"
                inputClass="w-full"
                :min="0"
                :maxFractionDigits="4"
                :disabled="saving"
              />
            </div>

            <div class="field-box">
              <label>Sunday</label>
              <InputNumber
                v-model="form.multipliers.SUNDAY"
                class="w-full"
                inputClass="w-full"
                :min="0"
                :maxFractionDigits="4"
                :disabled="saving"
              />
            </div>

            <div class="field-box">
              <label>Holiday</label>
              <InputNumber
                v-model="form.multipliers.HOLIDAY"
                class="w-full"
                inputClass="w-full"
                :min="0"
                :maxFractionDigits="4"
                :disabled="saving"
              />
            </div>
          </div>
        </div>

        <div class="formula-section">
          <div class="formula-section-title">Formula Preview</div>

          <div class="formula-preview">
            <div>Hourly Rate = Monthly Salary ÷ Working Days ÷ Hours Per Day</div>
            <div>OT Amount = Payable OT Hours × Hourly Rate × Day Type Multiplier</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox
            v-model="form.isActive"
            inputId="payment-formula-active"
            binary
            :disabled="saving"
          />

          <label
            for="payment-formula-active"
            class="text-sm font-medium text-[color:var(--ot-text)]"
          >
            Active
          </label>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            outlined
            :disabled="saving"
            @click="dialogVisible = false"
          />

          <Button
            :label="isEditMode ? 'Update' : 'Create'"
            icon="pi pi-save"
            :loading="saving"
            @click="saveFormula"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.payment-formula-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-formula-table .p-datatable-thead > tr > th) {
  padding: 0.62rem 0.75rem !important;
  white-space: nowrap !important;
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
}

:deep(.payment-formula-table .p-datatable-tbody > tr > td) {
  padding: 0.55rem 0.75rem !important;
  height: 64px !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
}

.formula-name-cell {
  min-width: max-content;
}

:deep(.payment-formula-table .p-tag.payment-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
  white-space: nowrap !important;
}

:deep(.p-tag.payment-day-working),
:deep(.p-tag.payment-status-active) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.payment-day-sunday) {
  background: #ffedd5 !important;
  color: #9a3412 !important;
  border-color: #f97316 !important;
}

:deep(.p-tag.payment-day-holiday),
:deep(.p-tag.payment-status-inactive) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

.payment-warning-box {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 0.85rem;
  background: rgba(245, 158, 11, 0.08);
  color: var(--ot-text);
  padding: 0.7rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.field-box label {
  margin-bottom: 0.35rem;
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ot-text-muted);
}

.field-box label span {
  color: #ef4444;
}

.formula-section {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.04), transparent),
    var(--ot-bg);
  padding: 0.85rem;
}

.formula-section-title {
  margin-bottom: 0.65rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ot-text);
}

.formula-preview {
  display: grid;
  gap: 0.35rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.7rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ot-text);
}

:global(.dark) :deep(.p-tag.payment-day-working),
:global(.dark) :deep(.p-tag.payment-status-active) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.payment-day-sunday) {
  background: rgba(249, 115, 22, 0.18) !important;
  color: #fdba74 !important;
  border-color: rgba(249, 115, 22, 0.45) !important;
}

:global(.dark) :deep(.p-tag.payment-day-holiday),
:global(.dark) :deep(.p-tag.payment-status-inactive) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

@media (max-width: 768px) {
  :deep(.payment-formula-table .p-datatable-tbody > tr > td) {
    height: 60px !important;
  }

  .formula-section {
    padding: 0.75rem;
  }
}
</style>