<!-- frontend/src/modules/payment/views/PaymentExchangeRateView.vue -->
<script setup>
// frontend/src/modules/payment/views/PaymentExchangeRateView.vue

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
  createPaymentExchangeRate,
  getPaymentExchangeRates,
  updatePaymentExchangeRate,
} from '@/modules/payment/payment.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const DEFAULT_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]

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

const roundingModeOptions = computed(() => [
  {
    label: t('payment.exchangeRates.roundingModes.round'),
    value: 'ROUND',
  },
  {
    label: t('payment.exchangeRates.roundingModes.ceil'),
    value: 'CEIL',
  },
  {
    label: t('payment.exchangeRates.roundingModes.floor'),
    value: 'FLOOR',
  },
  {
    label: t('payment.exchangeRates.roundingModes.none'),
    value: 'NONE',
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
    fromCurrency: 'USD',
    toCurrency: 'KHR',
    rate: null,
    roundingUnit: 100,
    roundingMode: 'ROUND',
    denominationsText: DEFAULT_DENOMINATIONS.join(', '),
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
    denominations: Array.isArray(row.denominations) ? row.denominations : [],
  }
}

function formatNumber(value, fallback = '—') {
  const number = Number(value)

  if (!Number.isFinite(number)) return fallback

  return new Intl.NumberFormat().format(number)
}

function formatRate(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '—'

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(number)
}

function formatCurrencyPair(row) {
  if (!row) return '—'

  return `${upper(row.fromCurrency || 'USD')} → ${upper(row.toCurrency || 'KHR')}`
}

function formatDenominations(value) {
  const denominations = Array.isArray(value) ? value : []

  if (!denominations.length) return '—'

  return denominations.map((item) => formatNumber(item)).join(', ')
}

function formatStatusLabel(value) {
  return value ? t('common.active') : t('common.inactive')
}

function activeTagClass(value) {
  return value ? 'payment-status-active' : 'payment-status-inactive'
}

function roundingTagClass(value) {
  const mode = upper(value || 'ROUND')

  if (mode === 'CEIL') return 'payment-rounding-ceil'
  if (mode === 'FLOOR') return 'payment-rounding-floor'
  if (mode === 'NONE') return 'payment-rounding-none'

  return 'payment-rounding-round'
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
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
    const res = await getPaymentExchangeRates(buildQuery(page))

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
      getApiErrorMessage(error, t('payment.exchangeRates.loadFailed')),
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
    fromCurrency: upper(row.fromCurrency || 'USD'),
    toCurrency: upper(row.toCurrency || 'KHR'),
    rate: Number(row.rate || 0),
    roundingUnit: Number(row.roundingUnit || 100),
    roundingMode: upper(row.roundingMode || 'ROUND'),
    denominationsText: formatDenominations(row.denominations || DEFAULT_DENOMINATIONS).replace(/\s/g, ''),
    isActive: row.isActive !== false,
  })

  dialogVisible.value = true
}

function parseDenominations(value) {
  return [
    ...new Set(
      s(value)
        .split(',')
        .map((item) => Number(s(item).replace(/,/g, '')))
        .filter((item) => Number.isFinite(item) && item > 0)
        .map((item) => Math.round(item)),
    ),
  ].sort((a, b) => b - a)
}

function normalizeSavePayload() {
  return {
    code: upper(form.code),
    name: s(form.name),
    description: s(form.description),
    fromCurrency: upper(form.fromCurrency || 'USD'),
    toCurrency: upper(form.toCurrency || 'KHR'),
    rate: Number(form.rate || 0),
    roundingUnit: Number(form.roundingUnit || 100),
    roundingMode: upper(form.roundingMode || 'ROUND'),
    denominations: parseDenominations(form.denominationsText),
    isActive: Boolean(form.isActive),
  }
}

async function saveExchangeRate() {
  const payload = normalizeSavePayload()

  saving.value = true

  try {
    if (isEditMode.value) {
      await updatePaymentExchangeRate(editingId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        t('payment.exchangeRates.updatedSuccess'),
        2500,
      )
    } else {
      await createPaymentExchangeRate(payload)

      showToast(
        'success',
        t('common.created'),
        t('payment.exchangeRates.createdSuccess'),
        2500,
      )
    }

    dialogVisible.value = false
    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      getApiErrorMessage(error, t('payment.exchangeRates.saveFailed')),
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
  <div class="ot-page-shell payment-exchange-rate-page">
    <section class="ot-filter-bar payment-exchange-rate-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('payment.exchangeRates.searchPlaceholder')"
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

      <div class="ot-filter-actions payment-exchange-rate-filter-actions">
        <span class="ot-loaded-badge whitespace-nowrap">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('payment.exchangeRates.newExchangeRate')"
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
            {{ t('payment.exchangeRates.tableTitle') }}
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
          icon="pi pi-money-bill"
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
          class="ot-data-table ot-data-table-compact payment-exchange-rate-table"
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
                <i class="pi pi-money-bill" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('payment.exchangeRates.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="width: 10rem; min-width: 10rem"
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
            :header="t('payment.exchangeRates.rateName')"
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
            :header="t('payment.exchangeRates.currencyPair')"
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
            field="rate"
            :header="t('payment.exchangeRates.rate')"
            sortable
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-rate-text"
              >
                {{ formatRate(data.rate) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('payment.exchangeRates.rounding')"
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="payment-rounding-stack"
              >
                <Tag
                  :value="data.roundingMode || 'ROUND'"
                  class="payment-rgb-tag"
                  :class="roundingTagClass(data.roundingMode)"
                />

                <div class="payment-rounding-unit">
                  {{ t('payment.exchangeRates.unit') }}:
                  {{ formatNumber(data.roundingUnit || 100) }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="t('payment.exchangeRates.denominations')"
            style="width: 22rem; min-width: 22rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="payment-denomination-text"
                :title="formatDenominations(data.denominations)"
              >
                {{ formatDenominations(data.denominations) }}
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
                :value="formatStatusLabel(data.isActive)"
                class="payment-rgb-tag"
                :class="activeTagClass(data.isActive)"
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
      :style="{ width: '96vw', maxWidth: '940px' }"
      :header="isEditMode ? t('payment.exchangeRates.editTitle') : t('payment.exchangeRates.createTitle')"
    >
      <div class="ot-dialog-form">
        <div class="payment-exchange-rate-note">
          <i class="pi pi-info-circle" />

          <div>
            {{ t('payment.exchangeRates.dialogNote') }}
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
              :placeholder="t('payment.exchangeRates.codePlaceholder')"
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
              :placeholder="t('payment.exchangeRates.namePlaceholder')"
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
            :placeholder="t('payment.exchangeRates.descriptionPlaceholder')"
            :disabled="saving"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.exchangeRates.fromCurrency') }}
              <span class="text-red-500">*</span>
            </label>

            <InputText
              v-model="form.fromCurrency"
              class="w-full"
              placeholder="USD"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.exchangeRates.toCurrency') }}
              <span class="text-red-500">*</span>
            </label>

            <InputText
              v-model="form.toCurrency"
              class="w-full"
              placeholder="KHR"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.exchangeRates.rate') }}
              <span class="text-red-500">*</span>
            </label>

            <InputNumber
              v-model="form.rate"
              class="w-full"
              input-class="w-full"
              :min="0"
              :max-fraction-digits="6"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.exchangeRates.roundingUnit') }}
              <span class="text-red-500">*</span>
            </label>

            <InputNumber
              v-model="form.roundingUnit"
              class="w-full"
              input-class="w-full"
              :min="1"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.exchangeRates.roundingMode') }}
            </label>

            <Select
              v-model="form.roundingMode"
              :options="roundingModeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :disabled="saving"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('payment.exchangeRates.denominations') }}
            </label>

            <InputText
              v-model="form.denominationsText"
              class="w-full"
              placeholder="50000, 20000, 10000, 5000, 1000, 500, 100"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="ot-panel">
          <div class="mb-3 text-sm text-[color:var(--ot-text)]">
            {{ t('payment.exchangeRates.roundingPreviewTitle') }}
          </div>

          <div class="payment-exchange-rate-preview">
            <div>
              {{ t('payment.exchangeRates.roundRulePreview') }}
            </div>

            <div>
              {{ t('payment.exchangeRates.cashBreakdownPreview') }}
            </div>
          </div>
        </div>

        <div class="payment-active-box">
          <div>
            <div class="payment-active-title">
              {{ t('common.active') }}
            </div>

            <div class="payment-active-help">
              {{ t('payment.exchangeRates.activeHelp') || t('payment.exchangeRates.dialogNote') }}
            </div>
          </div>

          <Checkbox
            v-model="form.isActive"
            input-id="payment-exchange-rate-active"
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
            @click="saveExchangeRate"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.payment-exchange-rate-page {
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

.payment-exchange-rate-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.payment-exchange-rate-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.payment-exchange-rate-filter-actions > * {
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
.payment-rounding-stack {
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
  max-width: 17rem;
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

.payment-rate-text,
.payment-meta-text,
.payment-denomination-text,
.payment-rounding-unit {
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

.payment-rate-text {
  color: rgb(var(--payment-name-rgb));
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.payment-denomination-text {
  max-width: 21rem;
}

.payment-rounding-unit {
  margin-top: 0.18rem;
  font-size: 0.7rem;
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
  margin-top: 0.18rem;
  color: var(--ot-text-muted);
  font-size: 0.74rem;
  line-height: 1.35;
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

.payment-rounding-round {
  --payment-tag-rgb: var(--payment-info-rgb);
}

.payment-rounding-ceil {
  --payment-tag-rgb: var(--payment-warning-rgb);
}

.payment-rounding-floor {
  --payment-tag-rgb: var(--payment-purple-rgb);
}

.payment-rounding-none {
  --payment-tag-rgb: var(--payment-muted-rgb);
}

/* =========================
   Dialog notes
   ========================= */

.payment-exchange-rate-note {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  border: 1px solid rgb(var(--payment-active-rgb) / 0.35);
  border-radius: 0.85rem;
  background: rgb(var(--payment-active-rgb) / 0.08);
  color: var(--ot-text);
  padding: 0.65rem 0.75rem;
  font-size: 0.78rem;
  line-height: 1.5;
}

.payment-exchange-rate-note i {
  color: rgb(var(--payment-active-rgb));
  margin-top: 0.15rem;
}

.payment-exchange-rate-preview {
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

:deep(.payment-exchange-rate-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-datatable-thead > tr > th),
:deep(.payment-exchange-rate-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.8rem !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-datatable-column-header-content),
:deep(.payment-exchange-rate-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-datatable-column-title),
:deep(.payment-exchange-rate-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-sortable-column-icon),
:deep(.payment-exchange-rate-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-tag),
:deep(.payment-exchange-rate-table.p-datatable .p-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.payment-exchange-rate-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

:deep(.payment-exchange-rate-table.p-datatable .payment-action-header),
:deep(.payment-exchange-rate-table.p-datatable .payment-action-cell) {
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

:global(.dark) .payment-exchange-rate-page {
  --payment-name-rgb: 226 232 240;
  --payment-meta-rgb: 203 213 225;
}

:global(.dark) .payment-rgb-tag {
  border-color: rgb(var(--payment-tag-rgb) / 0.42);
  background: rgb(var(--payment-tag-rgb) / 0.18);
}

:global(.dark) .payment-exchange-rate-note {
  border-color: rgb(var(--payment-active-rgb) / 0.42);
  background: rgb(var(--payment-active-rgb) / 0.14);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .payment-exchange-rate-filter-actions {
    justify-content: stretch;
  }

  .payment-exchange-rate-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .payment-exchange-rate-filter-bar {
    grid-template-columns:
      minmax(260px, 1.4fr)
      minmax(180px, 0.8fr);
  }

  .payment-exchange-rate-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .payment-exchange-rate-filter-bar {
    grid-template-columns:
      minmax(300px, 1.2fr)
      minmax(190px, 0.75fr)
      auto;
  }

  .payment-exchange-rate-filter-actions {
    grid-column: auto;
    flex-wrap: nowrap;
    justify-content: flex-end;
    min-width: max-content;
  }
}
</style>