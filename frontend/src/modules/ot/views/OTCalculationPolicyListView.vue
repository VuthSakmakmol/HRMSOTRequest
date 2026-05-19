<!-- frontend/src/modules/ot/views/OTCalculationPolicyListView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTCalculationPolicyListView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'
import {
  createOTCalculationPolicy,
  getOTCalculationPolicies,
  updateOTCalculationPolicy,
} from '@/modules/ot/otMaster.api'

const { t, te } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const policyDialogVisible = ref(false)
const editingPolicyId = ref('')

const filters = reactive({
  search: '',
  isActive: '',
  roundMethod: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  code: '',
  name: '',
  description: '',
  minEligibleMinutes: 0,
  roundUnitMinutes: 30,
  roundMethod: 'CEIL',
  graceAfterShiftEndMinutes: 0,
  allowApprovedOtWithoutExactClockOut: false,
  allowPreShiftOT: false,
  allowPostShiftOT: true,
  capByRequestedMinutes: true,
  treatForgetScanInAsPending: true,
  treatForgetScanOutAsPending: true,
  isActive: true,
})

const canView = computed(() => hasPermission('OT_POLICY_VIEW'))
const canCreate = computed(() => hasPermission('OT_POLICY_CREATE'))
const canUpdate = computed(() => hasPermission('OT_POLICY_UPDATE'))

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const roundMethodOptions = computed(() => [
  { label: tr('ot.policy.allMethods'), value: '' },
  { label: tr('ot.policy.roundMethod.floor'), value: 'FLOOR' },
  { label: tr('ot.policy.roundMethod.ceil'), value: 'CEIL' },
  { label: tr('ot.policy.roundMethod.nearest'), value: 'NEAREST' },
])

const formRoundMethodOptions = computed(() => [
  { label: tr('ot.policy.roundMethod.floor'), value: 'FLOOR' },
  { label: tr('ot.policy.roundMethod.ceil'), value: 'CEIL' },
  { label: tr('ot.policy.roundMethod.nearest'), value: 'NEAREST' },
])

const behaviorFlags = computed(() => [
  {
    key: 'allowPreShiftOT',
    label: tr('ot.policy.flag.allowPreShiftOT'),
    description: tr('ot.policy.flagHelp.allowPreShiftOT'),
  },
  {
    key: 'allowPostShiftOT',
    label: tr('ot.policy.flag.allowPostShiftOT'),
    description: tr('ot.policy.flagHelp.allowPostShiftOT'),
  },
  {
    key: 'capByRequestedMinutes',
    label: tr('ot.policy.flag.capByRequestedMinutes'),
    description: tr('ot.policy.flagHelp.capByRequestedMinutes'),
  },
  {
    key: 'treatForgetScanInAsPending',
    label: tr('ot.policy.flag.treatForgetScanInAsPending'),
    description: tr('ot.policy.flagHelp.treatForgetScanInAsPending'),
  },
  {
    key: 'treatForgetScanOutAsPending',
    label: tr('ot.policy.flag.treatForgetScanOutAsPending'),
    description: tr('ot.policy.flagHelp.treatForgetScanOutAsPending'),
  },
  {
    key: 'allowApprovedOtWithoutExactClockOut',
    label: tr('ot.policy.flag.allowApprovedOtWithoutExactClockOut'),
    description: tr('ot.policy.flagHelp.allowApprovedOtWithoutExactClockOut'),
  },
])

const isEditMode = computed(() => !!editingPolicyId.value)
const totalPolicies = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalPolicies.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalPolicies.value,
  }),
)

const dialogTitle = computed(() =>
  isEditMode.value
    ? tr('ot.policy.editTitle')
    : tr('ot.policy.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('common.create'),
)

const isSaveDisabled = computed(() => {
  if (saving.value) return true
  if (isEditMode.value && !canUpdate.value) return true
  if (!isEditMode.value && !canCreate.value) return true

  if (!String(form.code || '').trim()) return true
  if (!String(form.name || '').trim()) return true
  if (!String(form.roundMethod || '').trim()) return true
  if (Number(form.roundUnitMinutes || 0) < 1) return true
  if (Number(form.minEligibleMinutes || 0) < 0) return true
  if (Number(form.graceAfterShiftEndMinutes || 0) < 0) return true

  return false
})

let searchTimer = null
let currentRequestId = 0

function tr(key, params = {}) {
  return key && te(key) ? t(key, params) : key
}

function hasPermission(code) {
  return (
    auth.user?.isRootAdmin ||
    auth.isRootAdmin ||
    auth.hasAnyPermission?.([code]) ||
    auth.hasPermission?.(code)
  )
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function normalizeId(row) {
  return String(row?.id || row?._id || row?.policyId || '').trim()
}

function upper(value) {
  return String(value || '').trim().toUpperCase()
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: filters.isActive,
    roundMethod: filters.roundMethod,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }
}

function activeLabel(row) {
  if (row?.statusKey && te(row.statusKey)) return t(row.statusKey)

  if (row?.statusCode) {
    return row.statusCode === 'ACTIVE' ? t('common.active') : t('common.inactive')
  }

  return row?.isActive === false ? t('common.inactive') : t('common.active')
}

function activeTagClass(row) {
  return [
    'ot-policy-rgb-tag',
    row?.isActive === false ? 'ot-policy-tag-inactive' : 'ot-policy-tag-active',
  ]
}

function roundMethodLabel(value) {
  const method = upper(value)

  if (method === 'FLOOR') return tr('ot.policy.roundMethod.floor')
  if (method === 'CEIL') return tr('ot.policy.roundMethod.ceil')
  if (method === 'NEAREST') return tr('ot.policy.roundMethod.nearest')

  return method || '-'
}

function roundMethodTagClass(value) {
  const method = upper(value)

  if (method === 'FLOOR') return ['ot-policy-rgb-tag', 'ot-policy-tag-floor']
  if (method === 'CEIL') return ['ot-policy-rgb-tag', 'ot-policy-tag-ceil']
  if (method === 'NEAREST') return ['ot-policy-rgb-tag', 'ot-policy-tag-nearest']

  return ['ot-policy-rgb-tag', 'ot-policy-tag-muted']
}

function booleanTagClass(value) {
  return [
    'ot-policy-rgb-tag',
    value ? 'ot-policy-tag-active' : 'ot-policy-tag-inactive',
  ]
}

function yesNoLabel(value) {
  return value ? t('common.yes') : t('common.no')
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue

    const numberValue = Number(value)

    if (Number.isFinite(numberValue)) return numberValue
  }

  return 0
}

function formatMinutes(value) {
  const minutes = Number(value)

  if (!Number.isFinite(minutes)) return '-'
  if (minutes <= 0) return t('ot.common.minuteValue', { value: 0 })

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) {
    return t('ot.common.hourMinuteValue', {
      hours,
      minutes: mins,
    })
  }

  if (hours) return t('ot.common.hourValue', { value: hours })

  return t('ot.common.minuteValue', { value: mins })
}

function getRoundUnitMinutes(row) {
  return firstNumber(
    row?.roundUnitMinutes,
    row?.roundingUnitMinutes,
    row?.roundMinutes,
  )
}

function getMinEligibleMinutes(row) {
  return firstNumber(
    row?.minEligibleMinutes,
    row?.minimumEligibleMinutes,
    row?.minimumOtMinutes,
    row?.minOTMinutes,
  )
}

function getGraceAfterShiftEndMinutes(row) {
  return firstNumber(
    row?.graceAfterShiftEndMinutes,
    row?.graceMinutes,
    row?.afterShiftGraceMinutes,
    row?.graceAfterShiftMinutes,
  )
}

function flagItems(row) {
  return [
    {
      key: 'pre',
      label: tr('ot.policy.short.allowPreShiftOT'),
      value: row?.allowPreShiftOT === true,
    },
    {
      key: 'post',
      label: tr('ot.policy.short.allowPostShiftOT'),
      value: row?.allowPostShiftOT !== false,
    },
    {
      key: 'cap',
      label: tr('ot.policy.short.capByRequestedMinutes'),
      value: row?.capByRequestedMinutes !== false,
    },
    {
      key: 'in',
      label: tr('ot.policy.short.treatForgetScanInAsPending'),
      value: row?.treatForgetScanInAsPending !== false,
    },
    {
      key: 'out',
      label: tr('ot.policy.short.treatForgetScanOutAsPending'),
      value: row?.treatForgetScanOutAsPending !== false,
    },
    {
      key: 'clockOut',
      label: tr('ot.policy.short.allowApprovedOtWithoutExactClockOut'),
      value: row?.allowApprovedOtWithoutExactClockOut === true,
    },
  ]
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!canView.value) {
    bootstrapped.value = true
    return
  }

  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTCalculationPolicies(buildQuery(page))

    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
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
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const nextRows = [...rows.value]

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    bootstrapped.value = true

    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('ot.policy.loadFailed')),
    )
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
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

function clearFilters() {
  filters.search = ''
  filters.isActive = ''
  filters.roundMethod = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortField = event.sortField || 'createdAt'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : -1

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

function resetForm() {
  editingPolicyId.value = ''

  form.code = ''
  form.name = ''
  form.description = ''
  form.minEligibleMinutes = 0
  form.roundUnitMinutes = 30
  form.roundMethod = 'CEIL'
  form.graceAfterShiftEndMinutes = 0
  form.allowApprovedOtWithoutExactClockOut = false
  form.allowPreShiftOT = false
  form.allowPostShiftOT = true
  form.capByRequestedMinutes = true
  form.treatForgetScanInAsPending = true
  form.treatForgetScanOutAsPending = true
  form.isActive = true
}

function openCreateDialog() {
  resetForm()
  policyDialogVisible.value = true
}

function openEditDialog(row) {
  if (!row) return

  editingPolicyId.value = normalizeId(row)

  form.code = row?.code || ''
  form.name = row?.name || ''
  form.description = row?.description || ''
  form.minEligibleMinutes = Number(row?.minEligibleMinutes || 0)
  form.roundUnitMinutes = Number(row?.roundUnitMinutes || 30)
  form.roundMethod = upper(row?.roundMethod || 'CEIL')
  form.graceAfterShiftEndMinutes = Number(row?.graceAfterShiftEndMinutes || 0)
  form.allowApprovedOtWithoutExactClockOut = row?.allowApprovedOtWithoutExactClockOut === true
  form.allowPreShiftOT = row?.allowPreShiftOT === true
  form.allowPostShiftOT = row?.allowPostShiftOT !== false
  form.capByRequestedMinutes = row?.capByRequestedMinutes !== false
  form.treatForgetScanInAsPending = row?.treatForgetScanInAsPending !== false
  form.treatForgetScanOutAsPending = row?.treatForgetScanOutAsPending !== false
  form.isActive = row?.isActive !== false

  policyDialogVisible.value = true
}

function buildPayload() {
  return {
    code: String(form.code || '').trim().toUpperCase(),
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    minEligibleMinutes: Number(form.minEligibleMinutes || 0),
    roundUnitMinutes: Number(form.roundUnitMinutes || 0),
    roundMethod: String(form.roundMethod || '').trim().toUpperCase(),
    graceAfterShiftEndMinutes: Number(form.graceAfterShiftEndMinutes || 0),
    allowApprovedOtWithoutExactClockOut: !!form.allowApprovedOtWithoutExactClockOut,
    allowPreShiftOT: !!form.allowPreShiftOT,
    allowPostShiftOT: !!form.allowPostShiftOT,
    capByRequestedMinutes: !!form.capByRequestedMinutes,
    treatForgetScanInAsPending: !!form.treatForgetScanInAsPending,
    treatForgetScanOutAsPending: !!form.treatForgetScanOutAsPending,
    isActive: !!form.isActive,
  }
}

async function submitPolicy() {
  saving.value = true

  try {
    const payload = buildPayload()

    if (editingPolicyId.value) {
      await updateOTCalculationPolicy(editingPolicyId.value, payload)

      showToast(
        'success',
        t('common.updated'),
        t('ot.policy.updatedSuccess'),
        2500,
      )
    } else {
      await createOTCalculationPolicy(payload)

      showToast(
        'success',
        t('common.created'),
        t('ot.policy.createdSuccess'),
        2500,
      )
    }

    policyDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      getApiErrorMessage(error, t('ot.policy.saveFailed')),
      3500,
    )
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
  <div class="ot-page-shell ot-policy-page">
    <section class="ot-filter-bar ot-policy-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('ot.policy.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('ot.policy.roundMethodLabel') }}
        </label>

        <Select
          v-model="filters.roundMethod"
          :options="roundMethodOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onFilterChange"
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
          class="w-full"
          size="small"
          @change="onFilterChange"
        />
      </div>

      <div class="ot-policy-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="ot-policy-action-button"
          @click="clearFilters"
        />

        <Button
          v-if="canCreate"
          :label="t('ot.policy.newPolicy')"
          icon="pi pi-plus"
          size="small"
          class="ot-policy-action-button"
          @click="openCreateDialog"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('ot.policy.tableTitle') }}
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

      <div
        v-if="!canView"
        class="ot-empty-state"
      >
        <div class="ot-empty-icon">
          <i class="pi pi-lock" />
        </div>

        <div class="ot-empty-title">
          {{ t('auth.accessDenied') }}
        </div>

        <div class="ot-empty-text">
          {{ t('ot.policy.noViewPermission') }}
        </div>
      </div>

      <div
        v-else
        class="ot-table-wrapper"
      >
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
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortField"
          :sort-order="filters.sortOrder"
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
          class="ot-policy-table ot-data-table ot-data-table-compact"
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
                {{ t('ot.policy.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-semibold text-[color:var(--ot-text)]"
              >
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('common.name')"
            sortable
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ data.name || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="roundMethod"
            :header="t('ot.policy.roundMethodLabel')"
            sortable
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="roundMethodLabel(data.roundMethod)"
                :class="roundMethodTagClass(data.roundMethod)"
              />
            </template>
          </Column>

          <Column
            field="roundUnitMinutes"
            :header="t('ot.policy.roundUnit')"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <span v-if="data">{{ formatMinutes(data.roundUnitMinutes) }}</span>
            </template>
          </Column>

          <Column
            field="minEligibleMinutes"
            :header="t('ot.policy.minEligible')"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <span v-if="data">{{ formatMinutes(getMinEligibleMinutes(data)) }}</span>
            </template>
          </Column>

          <Column
            field="graceAfterShiftEndMinutes"
            :header="t('ot.policy.graceAfterShiftEnd')"
            sortable
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <span v-if="data">{{ formatMinutes(getGraceAfterShiftEndMinutes(data)) }}</span>
            </template>
          </Column>

          <Column
            :header="t('ot.policy.behaviorFlags')"
            style="min-width: 24rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="ot-policy-flag-row"
              >
                <Tag
                  v-for="item in flagItems(data)"
                  :key="item.key"
                  :value="t('ot.policy.flagValue', { label: item.label, value: yesNoLabel(item.value) })"
                  :class="booleanTagClass(item.value)"
                />
              </div>
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
                :value="activeLabel(data)"
                :class="activeTagClass(data)"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="text-sm text-[color:var(--ot-text-muted)]"
              >
                {{ formatDateTime(data.createdAt) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('common.actions')"
            frozen
            align-frozen="right"
            style="width: 7rem; min-width: 7rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data && canUpdate"
                :label="t('common.edit')"
                icon="pi pi-pencil"
                size="small"
                outlined
                class="ot-policy-action-button"
                @click="openEditDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="policyDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '62rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-policy-dialog-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('common.code') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('ot.policy.codePlaceholder')"
              maxlength="30"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('common.name') }}
            </label>

            <InputText
              v-model="form.name"
              class="w-full"
              :placeholder="t('ot.policy.namePlaceholder')"
              maxlength="120"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.policy.roundMethodLabel') }}
            </label>

            <Select
              v-model="form.roundMethod"
              :options="formRoundMethodOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div class="ot-policy-active-card">
            <span class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('common.active') }}
            </span>

            <Checkbox
              v-model="form.isActive"
              binary
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.policy.minEligibleMinutes') }}
            </label>

            <InputNumber
              v-model="form.minEligibleMinutes"
              class="w-full"
              input-class="w-full"
              :min="0"
              :max-fraction-digits="0"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.policy.roundUnitMinutes') }}
            </label>

            <InputNumber
              v-model="form.roundUnitMinutes"
              class="w-full"
              input-class="w-full"
              :min="1"
              :max-fraction-digits="0"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.policy.graceAfterShiftEndMinutes') }}
            </label>

            <InputNumber
              v-model="form.graceAfterShiftEndMinutes"
              class="w-full"
              input-class="w-full"
              :min="0"
              :max-fraction-digits="0"
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
            rows="3"
            :placeholder="t('ot.policy.descriptionPlaceholder')"
          />
        </div>

        <div class="ot-policy-flag-grid">
          <label
            v-for="flag in behaviorFlags"
            :key="flag.key"
            class="ot-policy-flag-card"
          >
            <div class="min-w-0">
              <div class="ot-policy-flag-title">
                {{ flag.label }}
              </div>

              <div class="ot-policy-flag-description">
                {{ flag.description }}
              </div>
            </div>

            <Checkbox
              v-model="form[flag.key]"
              binary
            />
          </label>
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            :disabled="saving"
            @click="policyDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitPolicy"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.ot-policy-page {
  --ot-policy-active-rgb: 34 197 94;
  --ot-policy-inactive-rgb: 100 116 139;
  --ot-policy-floor-rgb: 59 130 246;
  --ot-policy-ceil-rgb: 245 158 11;
  --ot-policy-nearest-rgb: 139 92 246;
  --ot-policy-muted-rgb: 100 116 139;
}

.ot-policy-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.ot-policy-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.ot-policy-filter-actions > * {
  flex: 0 0 auto;
}

.ot-policy-flag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

:deep(.ot-policy-rgb-tag) {
  --ot-policy-tag-rgb: var(--ot-policy-muted-rgb);
  min-height: 1.42rem;
  border: 1px solid rgb(var(--ot-policy-tag-rgb) / 0.28);
  background: rgb(var(--ot-policy-tag-rgb) / 0.11);
  color: rgb(var(--ot-policy-tag-rgb) / 1);
  padding: 0.12rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  border-radius: 999px;
  white-space: nowrap;
}

:deep(.ot-policy-tag-active) {
  --ot-policy-tag-rgb: var(--ot-policy-active-rgb);
}

:deep(.ot-policy-tag-inactive) {
  --ot-policy-tag-rgb: var(--ot-policy-inactive-rgb);
}

:deep(.ot-policy-tag-floor) {
  --ot-policy-tag-rgb: var(--ot-policy-floor-rgb);
}

:deep(.ot-policy-tag-ceil) {
  --ot-policy-tag-rgb: var(--ot-policy-ceil-rgb);
}

:deep(.ot-policy-tag-nearest) {
  --ot-policy-tag-rgb: var(--ot-policy-nearest-rgb);
}

:deep(.ot-policy-tag-muted) {
  --ot-policy-tag-rgb: var(--ot-policy-muted-rgb);
}

:deep(.ot-policy-action-button .p-button-icon) {
  font-size: 0.76rem;
}

:deep(.ot-policy-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-policy-table .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  text-align: center !important;
  vertical-align: middle !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.ot-policy-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  text-align: center !important;
  font-size: 0.8rem !important;
}

:deep(.ot-policy-table .p-column-header-content) {
  justify-content: center !important;
  text-align: center !important;
}

:deep(.ot-policy-table .p-datatable-tbody > tr > td > *) {
  margin-left: auto !important;
  margin-right: auto !important;
}

.ot-policy-dialog-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}

.ot-policy-active-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  padding: 0.75rem 0.85rem;
}

.ot-policy-flag-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
}

.ot-policy-flag-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  border: 1px solid var(--ot-border);
  border-radius: var(--ot-radius-md);
  background: var(--ot-bg);
  padding: 0.7rem 0.8rem;
  cursor: pointer;
}

.ot-policy-flag-title {
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.2;
}

.ot-policy-flag-description {
  margin-top: 0.16rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.25;
}

@media (max-width: 768px) {
  .ot-policy-filter-actions {
    justify-content: stretch;
  }

  .ot-policy-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 768px) {
  .ot-policy-dialog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-policy-flag-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .ot-policy-filter-bar {
    grid-template-columns:
      minmax(260px, 1.3fr)
      minmax(190px, 0.9fr)
      minmax(170px, 0.8fr);
  }

  .ot-policy-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .ot-policy-dialog-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .ot-policy-flag-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>