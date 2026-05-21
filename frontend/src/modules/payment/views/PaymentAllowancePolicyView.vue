<!-- frontend/src/modules/payment/views/PaymentAllowancePolicyView.vue -->
<script setup>
// frontend/src/modules/payment/views/PaymentAllowancePolicyView.vue

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
  createPaymentAllowancePolicy,
  getPaymentAllowancePolicies,
  updatePaymentAllowancePolicy,
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
  allowanceType: '',
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

const allowanceTypeOptions = computed(() => [
  { label: t('payment.allowancePolicies.types.food'), value: 'FOOD' },
  { label: t('payment.allowancePolicies.types.transport'), value: 'TRANSPORT' },
  { label: t('payment.allowancePolicies.types.night'), value: 'NIGHT' },
  { label: t('payment.allowancePolicies.types.holiday'), value: 'HOLIDAY' },
  { label: t('payment.allowancePolicies.types.other'), value: 'OTHER' },
])

const allowanceTypeFilterOptions = computed(() => [
  { label: t('payment.allowancePolicies.allTypes'), value: '' },
  ...allowanceTypeOptions.value,
])

const triggerTypeOptions = computed(() => [
  {
    label: t('payment.allowancePolicies.triggerTypes.otMinutes'),
    value: 'OT_MINUTES',
  },
])

const currencyOptions = computed(() => [
  { label: 'KHR', value: 'KHR' },
  { label: 'USD', value: 'USD' },
])

const applyPerOptions = computed(() => [
  {
    label: t('payment.allowancePolicies.applyPer.employeePerDay'),
    value: 'EMPLOYEE_PER_DAY',
  },
  {
    label: t('payment.allowancePolicies.applyPer.employeePerRequest'),
    value: 'EMPLOYEE_PER_REQUEST',
  },
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
    allowanceType: 'FOOD',
    triggerType: 'OT_MINUTES',
    minOtMinutes: 180,
    amount: 5000,
    currency: 'KHR',
    applyPer: 'EMPLOYEE_PER_DAY',
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

function normalizeRow(row) {
  if (!row) return row

  return {
    ...row,
    id: s(row.id || row._id),
  }
}

function formatNumber(value, decimals = 0) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '0'

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(number)
}

function formatAmount(value, currency = 'KHR') {
  const normalizedCurrency = upper(currency || 'KHR')
  const decimals = normalizedCurrency === 'USD' ? 2 : 0

  return `${formatNumber(value, decimals)} ${normalizedCurrency}`
}

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0))

  if (!minutes) return '0m'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`

  return `${mins}m`
}

function statusLabel(value) {
  return value ? t('common.active') : t('common.inactive')
}

function statusTagClass(value) {
  return value ? 'payment-status-active' : 'payment-status-inactive'
}

function allowanceTypeLabel(value) {
  const normalized = upper(value)

  const labels = {
    FOOD: t('payment.allowancePolicies.types.food'),
    TRANSPORT: t('payment.allowancePolicies.types.transport'),
    NIGHT: t('payment.allowancePolicies.types.night'),
    HOLIDAY: t('payment.allowancePolicies.types.holiday'),
    OTHER: t('payment.allowancePolicies.types.other'),
  }

  return labels[normalized] || normalized || '—'
}

function allowanceTypeTagClass(value) {
  const normalized = upper(value)

  if (normalized === 'FOOD') return 'payment-allowance-food'
  if (normalized === 'TRANSPORT') return 'payment-allowance-transport'
  if (normalized === 'NIGHT') return 'payment-allowance-night'
  if (normalized === 'HOLIDAY') return 'payment-allowance-holiday'

  return 'payment-allowance-other'
}

function triggerTypeLabel(value) {
  const normalized = upper(value)

  if (normalized === 'OT_MINUTES') {
    return t('payment.allowancePolicies.triggerTypes.otMinutes')
  }

  return normalized || '—'
}

function applyPerLabel(value) {
  const normalized = upper(value)

  if (normalized === 'EMPLOYEE_PER_DAY') {
    return t('payment.allowancePolicies.applyPer.employeePerDay')
  }

  if (normalized === 'EMPLOYEE_PER_REQUEST') {
    return t('payment.allowancePolicies.applyPer.employeePerRequest')
  }

  return normalized || '—'
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
    allowanceType: filters.allowanceType || undefined,
    isActive: filters.isActive === '' ? undefined : filters.isActive,
    sortField: filters.sortField,
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
    const res = await getPaymentAllowancePolicies(buildQuery(page))

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
      getApiErrorMessage(error, t('payment.allowancePolicies.loadFailed')),
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
  filters.allowanceType = ''
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
    allowanceType: upper(row.allowanceType || 'FOOD'),
    triggerType: upper(row.triggerType || 'OT_MINUTES'),
    minOtMinutes: Number(row.minOtMinutes || 180),
    amount: Number(row.amount || 0),
    currency: upper(row.currency || 'KHR'),
    applyPer: upper(row.applyPer || 'EMPLOYEE_PER_DAY'),
    isActive: row.isActive !== false,
  })

  dialogVisible.value = true
}

function validateForm() {
  if (!s(form.code)) return t('payment.allowancePolicies.validation.codeRequired')
  if (!s(form.name)) return t('payment.allowancePolicies.validation.nameRequired')

  if (Number(form.minOtMinutes || 0) < 1) {
    return t('payment.allowancePolicies.validation.minOtMinutesRequired')
  }

  if (Number(form.amount || 0) < 0) {
    return t('payment.allowancePolicies.validation.amountInvalid')
  }

  return ''
}

function normalizeSavePayload() {
  return {
    code: upper(form.code),
    name: s(form.name),
    description: s(form.description),
    allowanceType: upper(form.allowanceType || 'FOOD'),
    triggerType: upper(form.triggerType || 'OT_MINUTES'),
    minOtMinutes: Number(form.minOtMinutes || 0),
    amount: Number(form.amount || 0),
    currency: upper(form.currency || 'KHR'),
    applyPer: upper(form.applyPer || 'EMPLOYEE_PER_DAY'),
    isActive: Boolean(form.isActive),
  }
}

async function saveAllowancePolicy() {
  const validationMessage = validateForm()

  if (validationMessage) {
    showToast('warn', t('common.warning'), validationMessage)
    return
  }

  const payload = normalizeSavePayload()

  saving.value = true

  try {
    if (isEditMode.value) {
      await updatePaymentAllowancePolicy(editingId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        t('payment.allowancePolicies.updatedSuccess'),
        2500,
      )
    } else {
      await createPaymentAllowancePolicy(payload)

      showToast(
        'success',
        t('common.created'),
        t('payment.allowancePolicies.createdSuccess'),
        2500,
      )
    }

    dialogVisible.value = false
    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      getApiErrorMessage(error, t('payment.allowancePolicies.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

watch(
  () => [filters.allowanceType, filters.isActive],
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
  <div class="ot-page-shell payment-allowance-policy-page">
    <section class="ot-filter-bar payment-allowance-policy-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('payment.allowancePolicies.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('payment.allowancePolicies.allowanceType') }}
        </label>

        <Select
          v-model="filters.allowanceType"
          :options="allowanceTypeFilterOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
        />
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

      <div class="ot-filter-actions payment-allowance-policy-filter-actions">
        <span class="ot-loaded-badge whitespace-nowrap">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('payment.allowancePolicies.newPolicy')"
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
            {{ t('payment.allowancePolicies.tableTitle') }}
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
          :columns="9"
          icon="pi pi-gift"
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
          class="ot-data-table ot-data-table-compact payment-allowance-policy-table"
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
                <i class="pi pi-gift" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('payment.allowancePolicies.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="width: 12rem; min-width: 12rem"
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
            :header="t('payment.allowancePolicies.policyName')"
            sortable
            style="width: 18rem; min-width: 18rem"
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
            field="allowanceType"
            :header="t('payment.allowancePolicies.allowanceType')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="allowanceTypeLabel(data.allowanceType)"
                class="payment-rgb-tag"
                :class="allowanceTypeTagClass(data.allowanceType)"
              />
            </template>
          </Column>

          <Column
            field="triggerType"
            :header="t('payment.allowancePolicies.trigger')"
            sortable
            style="width: 11rem; min-width: 11rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-meta-text"
              >
                {{ triggerTypeLabel(data.triggerType) }}
              </span>
            </template>
          </Column>

          <Column
            field="minOtMinutes"
            :header="t('payment.allowancePolicies.threshold')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-amount-text"
              >
                ≥ {{ formatMinutes(data.minOtMinutes) }}
              </span>
            </template>
          </Column>

          <Column
            field="amount"
            :header="t('payment.allowancePolicies.amount')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-amount-text"
              >
                {{ formatAmount(data.amount, data.currency) }}
              </span>
            </template>
          </Column>

          <Column
            field="applyPer"
            :header="t('payment.allowancePolicies.applyPerLabel')"
            sortable
            style="width: 14rem; min-width: 14rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-meta-text"
              >
                {{ applyPerLabel(data.applyPer) }}
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
                :value="statusLabel(data.isActive)"
                class="payment-rgb-tag"
                :class="statusTagClass(data.isActive)"
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
      :style="{ width: '96vw', maxWidth: '920px' }"
      :header="isEditMode ? t('payment.allowancePolicies.editTitle') : t('payment.allowancePolicies.createTitle')"
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
              :placeholder="t('payment.allowancePolicies.codePlaceholder')"
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
              :placeholder="t('payment.allowancePolicies.namePlaceholder')"
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
            :placeholder="t('payment.allowancePolicies.descriptionPlaceholder')"
            :disabled="saving"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.allowancePolicies.allowanceType') }}
            </label>

            <Select
              v-model="form.allowanceType"
              :options="allowanceTypeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.allowancePolicies.trigger') }}
            </label>

            <Select
              v-model="form.triggerType"
              :options="triggerTypeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.allowancePolicies.minOtMinutes') }}
              <span class="text-red-500">*</span>
            </label>

            <InputNumber
              v-model="form.minOtMinutes"
              class="w-full"
              input-class="w-full"
              :min="1"
              :max-fraction-digits="0"
              suffix=" min"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.allowancePolicies.amount') }}
              <span class="text-red-500">*</span>
            </label>

            <InputNumber
              v-model="form.amount"
              class="w-full"
              input-class="w-full"
              :min="0"
              :max-fraction-digits="form.currency === 'USD' ? 2 : 0"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.allowancePolicies.currency') }}
            </label>

            <Select
              v-model="form.currency"
              :options="currencyOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.allowancePolicies.applyPerLabel') }}
            </label>

            <Select
              v-model="form.applyPer"
              :options="applyPerOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="ot-panel">
          <div class="mb-3 text-sm text-[color:var(--ot-text)]">
            {{ t('payment.allowancePolicies.previewTitle') }}
          </div>

          <div class="payment-allowance-preview">
            <div>
              {{ allowanceTypeLabel(form.allowanceType) }}
            </div>

            <div>
              {{ t('payment.allowancePolicies.otAtLeast') }}
              {{ formatMinutes(form.minOtMinutes) }}
            </div>

            <div>
              {{ formatAmount(form.amount, form.currency) }}
              ·
              {{ applyPerLabel(form.applyPer) }}
            </div>
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
            input-id="payment-allowance-policy-active"
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
            @click="saveAllowancePolicy"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.payment-allowance-policy-page {
  --payment-code-rgb: 37 99 235;
  --payment-name-rgb: 15 23 42;
  --payment-meta-rgb: 71 85 105;
  --payment-active-rgb: 34 197 94;
  --payment-inactive-rgb: 239 68 68;
  --payment-info-rgb: 59 130 246;
  --payment-warning-rgb: 245 158 11;
  --payment-muted-rgb: 100 116 139;
  --payment-purple-rgb: 168 85 247;
  --payment-orange-rgb: 249 115 22;
  --payment-sky-rgb: 14 165 233;
}

.payment-allowance-policy-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.payment-allowance-policy-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.payment-allowance-policy-filter-actions > * {
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

.payment-name-stack {
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

.payment-meta-text,
.payment-amount-text {
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

.payment-amount-text {
  color: rgb(var(--payment-name-rgb));
  font-weight: 750;
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

.payment-status-active {
  --payment-tag-rgb: var(--payment-active-rgb);
}

.payment-status-inactive {
  --payment-tag-rgb: var(--payment-inactive-rgb);
}

.payment-allowance-food {
  --payment-tag-rgb: var(--payment-orange-rgb);
}

.payment-allowance-transport {
  --payment-tag-rgb: var(--payment-sky-rgb);
}

.payment-allowance-night {
  --payment-tag-rgb: var(--payment-purple-rgb);
}

.payment-allowance-holiday {
  --payment-tag-rgb: var(--payment-inactive-rgb);
}

.payment-allowance-other {
  --payment-tag-rgb: var(--payment-muted-rgb);
}

/* =========================
   Dialog preview
   ========================= */

.payment-allowance-preview {
  display: grid;
  gap: 0.35rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.68rem 0.75rem;
  color: var(--ot-text);
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.5;
  text-align: center;
}

/* =========================
   PrimeVue table center
   ========================= */

:deep(.payment-allowance-policy-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-datatable-thead > tr > th),
:deep(.payment-allowance-policy-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.8rem !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-datatable-column-header-content),
:deep(.payment-allowance-policy-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-datatable-column-title),
:deep(.payment-allowance-policy-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-sortable-column-icon),
:deep(.payment-allowance-policy-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-tag),
:deep(.payment-allowance-policy-table.p-datatable .p-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.payment-allowance-policy-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

:deep(.payment-allowance-policy-table.p-datatable .payment-action-header),
:deep(.payment-allowance-policy-table.p-datatable .payment-action-cell) {
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

:global(.dark) .payment-allowance-policy-page {
  --payment-name-rgb: 226 232 240;
  --payment-meta-rgb: 203 213 225;
}

:global(.dark) .payment-rgb-tag {
  border-color: rgb(var(--payment-tag-rgb) / 0.42);
  background: rgb(var(--payment-tag-rgb) / 0.18);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .payment-allowance-policy-filter-actions {
    justify-content: stretch;
  }

  .payment-allowance-policy-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .payment-allowance-policy-filter-bar {
    grid-template-columns:
      minmax(260px, 1.25fr)
      minmax(190px, 0.8fr)
      minmax(180px, 0.75fr);
  }

  .payment-allowance-policy-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .payment-allowance-policy-filter-bar {
    grid-template-columns:
      minmax(300px, 1.2fr)
      minmax(190px, 0.75fr)
      minmax(180px, 0.7fr)
      auto;
  }

  .payment-allowance-policy-filter-actions {
    grid-column: auto;
    flex-wrap: nowrap;
    justify-content: flex-end;
    min-width: max-content;
  }
}
</style>