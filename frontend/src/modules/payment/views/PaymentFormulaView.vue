<!-- frontend/src/modules/payment/views/PaymentFormulaView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()

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
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive(defaultForm())

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: true },
  { label: t('common.inactive'), value: false },
])

const totalItems = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalItems.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)
const isEditMode = computed(() => Boolean(editingId.value))

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalItems.value,
  }),
)

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
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeTotal(payload) {
  return Number(payload?.pagination?.total || payload?.pagination?.totalRecords || payload?.total || 0)
}

function normalizeRow(row) {
  if (!row) return row

  return {
    ...row,
    id: s(row.id || row._id),
  }
}

function formatMultiplier(value) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return '0'
  if (Number.isInteger(number)) return String(number)

  return number.toFixed(4).replace(/\.?0+$/, '')
}

function formatFormulaStatusLabel(value) {
  return value ? t('common.active') : t('common.inactive')
}

function getFormulaStatusSeverity(value) {
  return value ? 'success' : 'danger'
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
    isActive: filters.isActive === '' ? undefined : filters.isActive,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
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
    const total = normalizeTotal(payload)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value = new Set([page])
    } else {
      const nextRows = rows.value.length
        ? [...rows.value]
        : Array.from({ length: total }, () => null)

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows

      const nextLoadedPages = new Set(loadedPages.value)
      nextLoadedPages.add(page)
      loadedPages.value = nextLoadedPages
    }

    bootstrapped.value = true
  } catch (error) {
    bootstrapped.value = true

    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('payment.formulas.loadFailed')),
    )
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  loadedPages.value = new Set()

  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    bootstrapped.value = false
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

function onFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortField = event?.sortField || 'createdAt'
  filters.sortOrder = typeof event?.sortOrder === 'number' ? event.sortOrder : -1

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

function clearFilters() {
  filters.search = ''
  filters.isActive = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function refresh() {
  reloadFirstPage({ keepVisible: true })
}

function openCreateDialog() {
  editingId.value = ''
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  if (!row) return

  editingId.value = s(row.id || row._id)

  Object.assign(form, {
    code: s(row.code),
    name: s(row.name),
    description: s(row.description),
    salaryBasis: row.salaryBasis || 'MONTHLY_SALARY',
    monthlyWorkingDays: Number(row.monthlyWorkingDays || 26),
    hoursPerDay: Number(row.hoursPerDay || 8),
    multipliers: {
      WORKING_DAY: Number(row.multipliers?.WORKING_DAY ?? 1.5),
      SUNDAY: Number(row.multipliers?.SUNDAY ?? 2),
      HOLIDAY: Number(row.multipliers?.HOLIDAY ?? 3),
    },
    roundingDecimals: Number(row.roundingDecimals ?? 2),
    currency: s(row.currency || 'USD'),
    isActive: row.isActive !== false,
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

async function saveFormula() {
  const payload = normalizeSavePayload()

  saving.value = true

  try {
    if (isEditMode.value) {
      await updatePaymentFormula(editingId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        t('payment.formulas.updatedSuccess'),
        2500,
      )
    } else {
      await createPaymentFormula(payload)

      showToast(
        'success',
        t('common.created'),
        t('payment.formulas.createdSuccess'),
        2500,
      )
    }

    dialogVisible.value = false
    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      getApiErrorMessage(error, t('payment.formulas.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

watch(
  () => filters.isActive,
  () => {
    onFilterChange()
  },
)

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell">
    <section class="ot-filter-bar payment-formula-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('payment.formulas.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.status') }}
        </label>

        <Select
          v-model="filters.isActive"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('common.allStatus')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-filter-actions payment-formula-filter-actions">
        <span class="ot-loaded-badge whitespace-nowrap">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('payment.formulas.newFormula')"
          icon="pi pi-plus"
          size="small"
          class="whitespace-nowrap"
          @click="openCreateDialog"
        />

        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="backgroundLoading"
          @click="refresh"
        />

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearFilters"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('payment.formulas.tableTitle') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ t('common.updating') }}
          </span>
        </div>
      </div>

      <div class="ot-table-wrapper">
        <AppTableLoading
          v-if="isFirstLoading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="7"
          :columns="8"
          icon="pi pi-calculator"
        />

        <DataTable
          v-else
          :value="rows"
          data-key="id"
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortField"
          :sort-order="filters.sortOrder"
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
          class="ot-data-table ot-data-table-compact payment-formula-table"
          :virtual-scroller-options="useVirtualScroll ? {
            lazy: true,
            onLazyLoad: onVirtualLazyLoad,
            itemSize: 72,
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
              class="ot-empty-state"
            >
              <div class="ot-empty-icon">
                <i class="pi pi-calculator" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('payment.formulas.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-semibold text-[color:var(--ot-text)]"
              >
                {{ data.code || '—' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('payment.formulas.formulaName')"
            sortable
            style="min-width: 18rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="min-w-0"
              >
                <div class="font-medium text-[color:var(--ot-text)]">
                  {{ data.name || '—' }}
                </div>

                <div
                  v-if="data.description"
                  class="mt-0.5 max-w-[360px] truncate text-xs text-[color:var(--ot-text-muted)]"
                  :title="data.description"
                >
                  {{ data.description }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="t('payment.formulas.baseRule')"
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="text-xs leading-5 text-[color:var(--ot-text-muted)]"
              >
                <div>
                  {{ Number(data.monthlyWorkingDays || 0) }}
                  {{ t('payment.formulas.daysPerMonth') }}
                </div>

                <div>
                  {{ Number(data.hoursPerDay || 0) }}
                  {{ t('payment.formulas.hoursPerDay') }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="t('payment.formulas.multipliers')"
            style="min-width: 22rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-wrap items-center gap-1.5"
              >
                <Tag
                  :value="`${t('payment.dayTypes.workingDay')} ${formatMultiplier(data.multipliers?.WORKING_DAY)}x`"
                  severity="success"
                  class="payment-status-tag payment-day-working"
                />

                <Tag
                  :value="`${t('payment.dayTypes.sunday')} ${formatMultiplier(data.multipliers?.SUNDAY)}x`"
                  severity="warning"
                  class="payment-status-tag payment-day-sunday"
                />

                <Tag
                  :value="`${t('payment.dayTypes.holiday')} ${formatMultiplier(data.multipliers?.HOLIDAY)}x`"
                  severity="danger"
                  class="payment-status-tag payment-day-holiday"
                />
              </div>
            </template>
          </Column>

          <Column
            :header="t('payment.formulas.round')"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="whitespace-nowrap text-sm text-[color:var(--ot-text)]"
              >
                {{ data.roundingDecimals ?? 2 }}
                {{ t('payment.formulas.decimals') }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('payment.formulas.currency')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="whitespace-nowrap text-sm text-[color:var(--ot-text)]"
              >
                {{ data.currency || 'USD' }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="formatFormulaStatusLabel(data.isActive)"
                :severity="getFormulaStatusSeverity(data.isActive)"
                class="payment-status-tag"
                :class="data.isActive ? 'payment-status-active' : 'payment-status-inactive'"
              />
            </template>
          </Column>

          <Column
            field="updatedAt"
            :header="t('common.updatedAt')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="whitespace-nowrap text-xs text-[color:var(--ot-text-muted)]"
              >
                {{ formatDateTime(data.updatedAt || data.createdAt) || '—' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('common.actions')"
            frozen
            align-frozen="right"
            header-class="ot-action-header"
            body-class="ot-action-cell"
            style="width: 5.5rem; min-width: 5.5rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                size="small"
                :aria-label="t('common.edit')"
                @click="openEditDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :draggable="false"
      :style="{ width: '96vw', maxWidth: '920px' }"
      :header="isEditMode ? t('payment.formulas.editTitle') : t('payment.formulas.createTitle')"
    >
      <div class="ot-dialog-form">
        <div class="payment-formula-note">
          <i class="pi pi-info-circle" />

          <div>
            {{ t('payment.formulas.dialogNote') }}
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('common.code') }}
              <span class="text-red-500">*</span>
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('payment.formulas.codePlaceholder')"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('common.name') }}
              <span class="text-red-500">*</span>
            </label>

            <InputText
              v-model="form.name"
              class="w-full"
              :placeholder="t('payment.formulas.namePlaceholder')"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('common.description') }}
          </label>

          <Textarea
            v-model="form.description"
            class="w-full"
            rows="2"
            auto-resize
            :placeholder="t('payment.formulas.descriptionPlaceholder')"
            :disabled="saving"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.formulas.workingDays') }}
              <span class="text-red-500">*</span>
            </label>

            <InputNumber
              v-model="form.monthlyWorkingDays"
              class="w-full"
              input-class="w-full"
              :min="1"
              :max-fraction-digits="2"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.formulas.hoursPerDayField') }}
              <span class="text-red-500">*</span>
            </label>

            <InputNumber
              v-model="form.hoursPerDay"
              class="w-full"
              input-class="w-full"
              :min="1"
              :max-fraction-digits="2"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.formulas.roundDecimals') }}
            </label>

            <InputNumber
              v-model="form.roundingDecimals"
              class="w-full"
              input-class="w-full"
              :min="0"
              :max="6"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.formulas.currency') }}
            </label>

            <InputText
              v-model="form.currency"
              class="w-full"
              placeholder="USD"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="ot-panel">
          <div class="mb-3 text-sm text-[color:var(--ot-text)]">
            {{ t('payment.formulas.dayTypeMultipliers') }}
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <div class="ot-field">
              <label class="ot-field-label">
                {{ t('payment.dayTypes.workingDay') }}
              </label>

              <InputNumber
                v-model="form.multipliers.WORKING_DAY"
                class="w-full"
                input-class="w-full"
                :min="0"
                :max-fraction-digits="4"
                :disabled="saving"
              />
            </div>

            <div class="ot-field">
              <label class="ot-field-label">
                {{ t('payment.dayTypes.sunday') }}
              </label>

              <InputNumber
                v-model="form.multipliers.SUNDAY"
                class="w-full"
                input-class="w-full"
                :min="0"
                :max-fraction-digits="4"
                :disabled="saving"
              />
            </div>

            <div class="ot-field">
              <label class="ot-field-label">
                {{ t('payment.dayTypes.holiday') }}
              </label>

              <InputNumber
                v-model="form.multipliers.HOLIDAY"
                class="w-full"
                input-class="w-full"
                :min="0"
                :max-fraction-digits="4"
                :disabled="saving"
              />
            </div>
          </div>
        </div>

        <div class="ot-panel">
          <div class="mb-3 text-sm text-[color:var(--ot-text)]">
            {{ t('payment.formulas.previewTitle') }}
          </div>

          <div class="payment-formula-preview">
            <div>
              {{ t('payment.formulas.hourlyRatePreview') }}
            </div>

            <div>
              {{ t('payment.formulas.otAmountPreview') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox
            v-model="form.isActive"
            input-id="payment-formula-active"
            binary
            :disabled="saving"
          />

          <label
            for="payment-formula-active"
            class="text-sm text-[color:var(--ot-text)]"
          >
            {{ t('common.active') }}
          </label>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            outlined
            :disabled="saving"
            @click="dialogVisible = false"
          />

          <Button
            :label="isEditMode ? t('common.update') : t('common.create')"
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
@media (min-width: 1280px) {
  .payment-formula-filter-bar {
    grid-template-columns:
      minmax(260px, 1fr)
      minmax(180px, 220px)
      auto;
    align-items: end;
  }

  .payment-formula-filter-actions {
    flex-wrap: nowrap;
    justify-content: flex-end;
    min-width: max-content;
  }
}

:deep(.payment-formula-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-formula-table .p-datatable-thead > tr > th) {
  white-space: nowrap !important;
}

:deep(.payment-formula-table .p-datatable-tbody > tr > td) {
  vertical-align: middle !important;
  white-space: nowrap !important;
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

.payment-formula-note {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 0.85rem;
  background: rgba(245, 158, 11, 0.08);
  color: var(--ot-text);
  padding: 0.65rem 0.75rem;
  font-size: 0.78rem;
  line-height: 1.5;
}

.payment-formula-preview {
  display: grid;
  gap: 0.35rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.68rem 0.75rem;
  font-size: 0.78rem;
  line-height: 1.5;
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
</style>