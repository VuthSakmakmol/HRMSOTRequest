<!-- frontend/src/modules/payment/views/PaymentFormulaView.vue -->
<script setup>
// frontend/src/modules/payment/views/PaymentFormulaView.vue

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
const DEFAULT_CASH_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]

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

const cashRoundingModeOptions = computed(() => [
  { label: 'Round nearest', value: 'ROUND' },
  { label: 'Round up', value: 'CEIL' },
  { label: 'Round down', value: 'FLOOR' },
  { label: 'No cash rounding', value: 'NONE' },
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

const formCashDenominations = computed(() => {
  return parseDenominations(form.cashDenominationsText)
})

const cashPolicyPreview = computed(() => {
  const mode = upper(form.cashRoundingMode || 'ROUND')
  const unit = Number(form.cashRoundingUnit || 100)
  const denominations = formCashDenominations.value

  return `${mode} / ${formatNumber(unit, 0)} · ${denominations
    .map((item) => formatNumber(item, 0))
    .join(', ')}`
})

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
    payoutCurrency: 'KHR',
    cashRoundingUnit: 100,
    cashRoundingMode: 'ROUND',
    cashDenominationsText: DEFAULT_CASH_DENOMINATIONS.join(', '),
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
  return Number(
    payload?.pagination?.total ||
      payload?.pagination?.totalRecords ||
      payload?.total ||
      0,
  )
}

function normalizeDenominations(value) {
  const source =
    Array.isArray(value) && value.length
      ? value
      : DEFAULT_CASH_DENOMINATIONS

  const normalized = [
    ...new Set(
      source
        .map((item) => Math.round(Number(item || 0)))
        .filter((item) => item > 0),
    ),
  ].sort((a, b) => b - a)

  return normalized.length ? normalized : DEFAULT_CASH_DENOMINATIONS
}

function parseDenominations(value) {
  if (Array.isArray(value)) return normalizeDenominations(value)

  const raw = s(value)

  if (!raw) return DEFAULT_CASH_DENOMINATIONS

  return normalizeDenominations(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function normalizeRow(row) {
  if (!row) return row

  return {
    ...row,
    id: s(row.id || row._id),
    currency: upper(row.currency || 'USD'),
    payoutCurrency: upper(row.payoutCurrency || 'KHR'),
    cashRoundingUnit: Number(row.cashRoundingUnit || 100),
    cashRoundingMode: upper(row.cashRoundingMode || 'ROUND'),
    cashDenominations: normalizeDenominations(row.cashDenominations),
  }
}

function formatNumber(value, decimals = 2) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '0'

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(number)
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

function formulaStatusTagClass(value) {
  return value ? 'payment-status-active' : 'payment-status-inactive'
}

function dayMultiplierTagClass(type) {
  const value = upper(type)

  if (value === 'WORKING_DAY') return 'payment-day-working'
  if (value === 'SUNDAY') return 'payment-day-sunday'
  if (value === 'HOLIDAY') return 'payment-day-holiday'

  return 'payment-day-default'
}

function formatCurrencyPair(row = {}) {
  const from = upper(row.currency || 'USD')
  const to = upper(row.payoutCurrency || 'KHR')

  return `${from} → ${to}`
}

function formatCashPolicy(row = {}) {
  const mode = upper(row.cashRoundingMode || 'ROUND')
  const unit = Number(row.cashRoundingUnit || 100)

  return `${mode} / ${formatNumber(unit, 0)}`
}

function formatDenominations(row = {}) {
  return normalizeDenominations(row.cashDenominations)
    .map((item) => formatNumber(item, 0))
    .join(', ')
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

  const denominations = normalizeDenominations(row.cashDenominations)

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
    currency: upper(row.currency || 'USD'),
    payoutCurrency: upper(row.payoutCurrency || 'KHR'),
    cashRoundingUnit: Number(row.cashRoundingUnit || 100),
    cashRoundingMode: upper(row.cashRoundingMode || 'ROUND'),
    cashDenominationsText: denominations.join(', '),
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
    payoutCurrency: upper(form.payoutCurrency || 'KHR'),
    cashRoundingUnit: Number(form.cashRoundingUnit || 100),
    cashRoundingMode: upper(form.cashRoundingMode || 'ROUND'),
    cashDenominations: formCashDenominations.value,
    isActive: Boolean(form.isActive),
  }
}

function validateBeforeSave(payload = {}) {
  if (!payload.code) return 'Code is required'
  if (!payload.name) return 'Name is required'
  if (!payload.monthlyWorkingDays || payload.monthlyWorkingDays <= 0) {
    return 'Monthly working days must be greater than 0'
  }
  if (!payload.hoursPerDay || payload.hoursPerDay <= 0) {
    return 'Hours per day must be greater than 0'
  }
  if (!payload.currency) return 'Base currency is required'
  if (!payload.payoutCurrency) return 'Payout currency is required'
  if (!payload.cashRoundingUnit || payload.cashRoundingUnit <= 0) {
    return 'Cash rounding unit must be greater than 0'
  }
  if (!payload.cashDenominations.length) {
    return 'At least one cash denomination is required'
  }

  return ''
}

async function saveFormula() {
  const payload = normalizeSavePayload()
  const validationMessage = validateBeforeSave(payload)

  if (validationMessage) {
    showToast('warn', 'Check form', validationMessage)
    return
  }

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
  <div class="ot-page-shell payment-formula-page">
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
          class="payment-action-button whitespace-nowrap"
          @click="openCreateDialog"
        />

        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          class="payment-action-button"
          :loading="backgroundLoading"
          @click="refresh"
        />

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="payment-action-button"
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
          :columns="10"
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
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-code-text"
              >
                {{ data.code || '—' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('payment.formulas.formulaName')"
            sortable
            style="width: 16rem; min-width: 16rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="payment-name-stack"
              >
                <div class="payment-name-text">
                  {{ data.name || '—' }}
                </div>

                <div
                  v-if="data.description"
                  class="payment-description-text"
                  :title="data.description"
                >
                  {{ data.description }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="t('payment.formulas.baseRule')"
            style="width: 12rem; min-width: 12rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="payment-rule-stack"
              >
                <div class="payment-rule-line">
                  {{ Number(data.monthlyWorkingDays || 0) }}
                  {{ t('payment.formulas.daysPerMonth') }}
                </div>

                <div class="payment-rule-line">
                  {{ Number(data.hoursPerDay || 0) }}
                  {{ t('payment.formulas.hoursPerDay') }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="t('payment.formulas.multipliers')"
            style="width: 20rem; min-width: 20rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="payment-multiplier-list"
              >
                <Tag
                  :value="`${t('payment.dayTypes.workingDay')} ${formatMultiplier(data.multipliers?.WORKING_DAY)}x`"
                  class="payment-rgb-tag"
                  :class="dayMultiplierTagClass('WORKING_DAY')"
                />

                <Tag
                  :value="`${t('payment.dayTypes.sunday')} ${formatMultiplier(data.multipliers?.SUNDAY)}x`"
                  class="payment-rgb-tag"
                  :class="dayMultiplierTagClass('SUNDAY')"
                />

                <Tag
                  :value="`${t('payment.dayTypes.holiday')} ${formatMultiplier(data.multipliers?.HOLIDAY)}x`"
                  class="payment-rgb-tag"
                  :class="dayMultiplierTagClass('HOLIDAY')"
                />
              </div>
            </template>
          </Column>

          <Column
            :header="t('payment.formulas.round')"
            style="width: 8rem; min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-meta-text"
              >
                {{ data.roundingDecimals ?? 2 }}
                {{ t('payment.formulas.decimals') }}
              </span>
            </template>
          </Column>

          <Column
            field="currency"
            :header="t('payment.formulas.currency')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="formatCurrencyPair(data)"
                class="payment-rgb-tag payment-currency-tag"
              />
            </template>
          </Column>

          <Column
            field="cashRoundingMode"
            header="Cash rounding"
            sortable
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="formatCashPolicy(data)"
                class="payment-rgb-tag payment-tag-purple"
              />
            </template>
          </Column>

          <Column
            header="Cash denominations"
            style="width: 19rem; min-width: 19rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-denomination-text"
                :title="formatDenominations(data)"
              >
                {{ formatDenominations(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="width: 8rem; min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="formatFormulaStatusLabel(data.isActive)"
                class="payment-rgb-tag"
                :class="formulaStatusTagClass(data.isActive)"
              />
            </template>
          </Column>

          <Column
            field="updatedAt"
            :header="t('common.updatedAt')"
            sortable
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-meta-text"
              >
                {{ formatDateTime(data.updatedAt || data.createdAt) || '—' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('common.actions')"
            frozen
            align-frozen="right"
            header-class="payment-action-header"
            body-class="payment-action-cell"
            style="width: 7rem; min-width: 7rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data"
                :label="t('common.edit')"
                icon="pi pi-pencil"
                size="small"
                outlined
                class="payment-table-edit-button"
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
      :style="{ width: '96vw', maxWidth: '980px' }"
      :header="isEditMode ? t('payment.formulas.editTitle') : t('payment.formulas.createTitle')"
    >
      <div class="ot-dialog-form">

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
              Base currency
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
          <div class="payment-panel-title">
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
          <div class="payment-panel-title">
            Cash payout policy
          </div>

          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="ot-field">
              <label class="ot-field-label">
                Payout currency
              </label>

              <InputText
                v-model="form.payoutCurrency"
                class="w-full"
                placeholder="KHR"
                :disabled="saving"
              />
            </div>

            <div class="ot-field">
              <label class="ot-field-label">
                Cash rounding mode
              </label>

              <Select
                v-model="form.cashRoundingMode"
                :options="cashRoundingModeOptions"
                option-label="label"
                option-value="value"
                class="w-full"
                :disabled="saving"
              />
            </div>

            <div class="ot-field">
              <label class="ot-field-label">
                Cash rounding unit
              </label>

              <InputNumber
                v-model="form.cashRoundingUnit"
                class="w-full"
                input-class="w-full"
                :min="1"
                :max-fraction-digits="0"
                :disabled="saving"
              />
            </div>

            <div class="ot-field">
              <label class="ot-field-label">
                Currency flow
              </label>

              <div class="payment-currency-preview">
                {{ upper(form.currency || 'USD') }} → {{ upper(form.payoutCurrency || 'KHR') }}
              </div>
            </div>
          </div>

          <div class="ot-field mt-3">
            <label class="ot-field-label">
              Cash denominations
            </label>

            <InputText
              v-model="form.cashDenominationsText"
              class="w-full"
              placeholder="50000, 20000, 10000, 5000, 1000, 500, 100"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="payment-active-box">
          <div>
            <div class="payment-active-title">
              {{ t('common.active') }}
            </div>
          </div>

          <Checkbox
            v-model="form.isActive"
            input-id="payment-formula-active"
            binary
            :disabled="saving"
          />
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
.payment-formula-page {
  --payment-code-rgb: 37 99 235;
  --payment-name-rgb: 15 23 42;
  --payment-meta-rgb: 71 85 105;
  --payment-active-rgb: 34 197 94;
  --payment-inactive-rgb: 239 68 68;
  --payment-info-rgb: 59 130 246;
  --payment-warning-rgb: 245 158 11;
  --payment-muted-rgb: 100 116 139;
  --payment-purple-rgb: 168 85 247;
}

.payment-formula-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.payment-formula-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.payment-formula-filter-actions > * {
  flex: 0 0 auto;
}

/* =========================
   Table text
   ========================= */

.payment-code-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--payment-code-rgb));
  font-size: 0.82rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.payment-name-stack,
.payment-rule-stack {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.payment-name-text {
  max-width: 100%;
  overflow: hidden;
  color: rgb(var(--payment-name-rgb));
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payment-description-text {
  max-width: 15rem;
  margin-top: 0.16rem;
  overflow: hidden;
  color: rgb(var(--payment-meta-rgb));
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payment-rule-line,
.payment-meta-text,
.payment-denomination-text {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: rgb(var(--payment-meta-rgb));
  font-size: 0.78rem;
  font-weight: 500;
  text-align: center;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.payment-meta-text {
  font-variant-numeric: tabular-nums;
}

.payment-denomination-text {
  max-width: 18rem;
  color: rgb(var(--payment-info-rgb));
  font-size: 0.74rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.payment-multiplier-list {
  display: inline-flex;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  text-align: center;
}

.payment-panel-title {
  margin-bottom: 0.75rem;
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.payment-field-help {
  margin-top: 0.25rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  line-height: 1.35;
}

.payment-currency-preview {
  display: flex;
  min-height: 2.35rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--payment-info-rgb) / 0.28);
  border-radius: 0.7rem;
  background: rgb(var(--payment-info-rgb) / 0.08);
  color: rgb(var(--payment-info-rgb));
  font-size: 0.84rem;
  font-weight: 800;
}

.payment-cash-preview {
  margin-top: 0.75rem;
  border: 1px dashed rgb(var(--payment-purple-rgb) / 0.35);
  border-radius: 0.85rem;
  background: rgb(var(--payment-purple-rgb) / 0.07);
  padding: 0.65rem 0.75rem;
  text-align: center;
}

.payment-cash-preview-label {
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.payment-cash-preview-value {
  margin-top: 0.18rem;
  color: rgb(var(--payment-purple-rgb));
  font-size: 0.82rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.payment-active-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.75rem 0.9rem;
}

.payment-active-title {
  color: var(--ot-text);
  font-size: 0.86rem;
  font-weight: 650;
}

.payment-active-help {
  display: -webkit-box;
  max-width: 44rem;
  margin-top: 0.18rem;
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.74rem;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* =========================
   RGB tags
   ========================= */

.payment-rgb-tag {
  --payment-tag-rgb: var(--payment-muted-rgb);
  display: inline-flex !important;
  min-height: 1.42rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--payment-tag-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--payment-tag-rgb) / 0.11);
  color: rgb(var(--payment-tag-rgb) / 1);
  padding: 0.12rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 750;
  line-height: 1;
  text-align: center !important;
  vertical-align: middle;
  white-space: nowrap;
}

.payment-currency-tag {
  --payment-tag-rgb: var(--payment-info-rgb);
}

.payment-status-active {
  --payment-tag-rgb: var(--payment-active-rgb);
}

.payment-status-inactive {
  --payment-tag-rgb: var(--payment-inactive-rgb);
}

.payment-day-working {
  --payment-tag-rgb: var(--payment-active-rgb);
}

.payment-day-sunday {
  --payment-tag-rgb: var(--payment-warning-rgb);
}

.payment-day-holiday {
  --payment-tag-rgb: var(--payment-inactive-rgb);
}

.payment-day-default {
  --payment-tag-rgb: var(--payment-muted-rgb);
}

.payment-tag-purple {
  --payment-tag-rgb: var(--payment-purple-rgb);
}

/* =========================
   Dialog notes
   ========================= */

.payment-formula-note {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  border: 1px solid rgb(var(--payment-warning-rgb) / 0.35);
  border-radius: 0.85rem;
  background: rgb(var(--payment-warning-rgb) / 0.08);
  color: var(--ot-text);
  padding: 0.65rem 0.75rem;
  font-size: 0.78rem;
  line-height: 1.5;
}

.payment-formula-note i {
  color: rgb(var(--payment-warning-rgb));
  margin-top: 0.15rem;
}

.payment-formula-preview {
  display: grid;
  gap: 0.35rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.68rem 0.75rem;
  color: var(--ot-text);
  font-size: 0.78rem;
  line-height: 1.5;
}

/* =========================
   PrimeVue table center
   ========================= */

:deep(.payment-formula-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-formula-table.p-datatable .p-datatable-thead > tr > th),
:deep(.payment-formula-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.payment-formula-table.p-datatable .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.payment-formula-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.8rem !important;
}

:deep(.payment-formula-table.p-datatable .p-datatable-column-header-content),
:deep(.payment-formula-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.payment-formula-table.p-datatable .p-datatable-column-title),
:deep(.payment-formula-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.payment-formula-table.p-datatable .p-sortable-column-icon),
:deep(.payment-formula-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.payment-formula-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.payment-formula-table.p-datatable .p-tag),
:deep(.payment-formula-table.p-datatable .p-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.payment-formula-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

:deep(.payment-formula-table.p-datatable .payment-action-header),
:deep(.payment-formula-table.p-datatable .payment-action-cell) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.payment-table-edit-button .p-button-label),
:deep(.payment-action-button .p-button-label) {
  font-weight: 500 !important;
}

:deep(.payment-action-button .p-button-icon),
:deep(.payment-table-edit-button .p-button-icon) {
  font-size: 0.76rem;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .payment-formula-page {
  --payment-name-rgb: 226 232 240;
  --payment-meta-rgb: 203 213 225;
}

:global(.dark) .payment-rgb-tag {
  border-color: rgb(var(--payment-tag-rgb) / 0.42);
  background: rgb(var(--payment-tag-rgb) / 0.18);
}

:global(.dark) .payment-formula-note {
  border-color: rgb(var(--payment-warning-rgb) / 0.42);
  background: rgb(var(--payment-warning-rgb) / 0.14);
}

:global(.dark) .payment-currency-preview {
  background: rgb(var(--payment-info-rgb) / 0.15);
}

:global(.dark) .payment-cash-preview {
  background: rgb(var(--payment-purple-rgb) / 0.14);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .payment-formula-filter-actions {
    justify-content: stretch;
  }

  .payment-formula-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .payment-formula-filter-bar {
    grid-template-columns:
      minmax(260px, 1.4fr)
      minmax(180px, 0.8fr);
  }

  .payment-formula-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .payment-formula-filter-bar {
    grid-template-columns:
      minmax(300px, 1.2fr)
      minmax(190px, 0.75fr)
      auto;
  }

  .payment-formula-filter-actions {
    grid-column: auto;
    flex-wrap: nowrap;
    justify-content: flex-end;
    min-width: max-content;
  }
}
</style>