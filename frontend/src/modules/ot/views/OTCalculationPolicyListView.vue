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

const { t } = useI18n()
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

function hasPermission(code) {
  return (
    auth.user?.isRootAdmin ||
    auth.hasAnyPermission?.([code]) ||
    auth.hasPermission?.(code)
  )
}

const canView = computed(() => hasPermission('OT_POLICY_VIEW'))
const canCreate = computed(() => hasPermission('OT_POLICY_CREATE'))
const canUpdate = computed(() => hasPermission('OT_POLICY_UPDATE'))

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const roundMethodOptions = computed(() => [
  { label: t('ot.policy.allMethods'), value: '' },
  { label: t('ot.policy.roundMethod.floor'), value: 'FLOOR' },
  { label: t('ot.policy.roundMethod.ceil'), value: 'CEIL' },
  { label: t('ot.policy.roundMethod.nearest'), value: 'NEAREST' },
])

const formRoundMethodOptions = computed(() => [
  { label: t('ot.policy.roundMethod.floor'), value: 'FLOOR' },
  { label: t('ot.policy.roundMethod.ceil'), value: 'CEIL' },
  { label: t('ot.policy.roundMethod.nearest'), value: 'NEAREST' },
])

const behaviorFlags = computed(() => [
  {
    key: 'allowPreShiftOT',
    label: t('ot.policy.flag.allowPreShiftOT'),
    description: t('ot.policy.flagHelp.allowPreShiftOT'),
  },
  {
    key: 'allowPostShiftOT',
    label: t('ot.policy.flag.allowPostShiftOT'),
    description: t('ot.policy.flagHelp.allowPostShiftOT'),
  },
  {
    key: 'capByRequestedMinutes',
    label: t('ot.policy.flag.capByRequestedMinutes'),
    description: t('ot.policy.flagHelp.capByRequestedMinutes'),
  },
  {
    key: 'treatForgetScanInAsPending',
    label: t('ot.policy.flag.treatForgetScanInAsPending'),
    description: t('ot.policy.flagHelp.treatForgetScanInAsPending'),
  },
  {
    key: 'treatForgetScanOutAsPending',
    label: t('ot.policy.flag.treatForgetScanOutAsPending'),
    description: t('ot.policy.flagHelp.treatForgetScanOutAsPending'),
  },
  {
    key: 'allowApprovedOtWithoutExactClockOut',
    label: t('ot.policy.flag.allowApprovedOtWithoutExactClockOut'),
    description: t('ot.policy.flagHelp.allowApprovedOtWithoutExactClockOut'),
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
  isEditMode.value ? t('ot.policy.editTitle') : t('ot.policy.createTitle'),
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

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function upper(value) {
  return String(value || '').trim().toUpperCase()
}

function activeSeverity(row) {
  return row?.statusSeverity || (row?.isActive === false ? 'secondary' : 'success')
}

function activeLabel(row) {
  if (row?.statusKey) return t(row.statusKey)
  if (row?.statusCode) {
    return row.statusCode === 'ACTIVE' ? t('common.active') : t('common.inactive')
  }

  return row?.isActive === false ? t('common.inactive') : t('common.active')
}

function roundMethodLabel(value) {
  const method = upper(value)

  if (method === 'FLOOR') return t('ot.policy.roundMethod.floor')
  if (method === 'NEAREST') return t('ot.policy.roundMethod.nearest')

  return t('ot.policy.roundMethod.ceil')
}

function minutesLabel(value) {
  const minutes = Number(value || 0)

  if (!minutes) return t('ot.common.minuteValue', { value: 0 })

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

function boolText(value) {
  return value ? t('common.yes') : t('common.no')
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

  form.code = String(row.code || '').trim()
  form.name = String(row.name || '').trim()
  form.description = String(row.description || '').trim()
  form.minEligibleMinutes = Number(row.minEligibleMinutes || 0)
  form.roundUnitMinutes = Number(row.roundUnitMinutes || 30)
  form.roundMethod = upper(row.roundMethod || 'CEIL')
  form.graceAfterShiftEndMinutes = Number(row.graceAfterShiftEndMinutes || 0)

  form.allowApprovedOtWithoutExactClockOut =
    row.allowApprovedOtWithoutExactClockOut === true
  form.allowPreShiftOT = row.allowPreShiftOT === true
  form.allowPostShiftOT = row.allowPostShiftOT !== false
  form.capByRequestedMinutes = row.capByRequestedMinutes !== false
  form.treatForgetScanInAsPending = row.treatForgetScanInAsPending !== false
  form.treatForgetScanOutAsPending = row.treatForgetScanOutAsPending !== false
  form.isActive = row.isActive !== false

  policyDialogVisible.value = true
}

function buildPayload() {
  return {
    code: String(form.code || '').trim(),
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),

    minEligibleMinutes: Number(form.minEligibleMinutes || 0),
    roundUnitMinutes: Number(form.roundUnitMinutes || 0),
    roundMethod: upper(form.roundMethod || 'CEIL'),
    graceAfterShiftEndMinutes: Number(form.graceAfterShiftEndMinutes || 0),

    allowApprovedOtWithoutExactClockOut:
      form.allowApprovedOtWithoutExactClockOut === true,
    allowPreShiftOT: form.allowPreShiftOT === true,
    allowPostShiftOT: form.allowPostShiftOT === true,
    capByRequestedMinutes: form.capByRequestedMinutes === true,
    treatForgetScanInAsPending: form.treatForgetScanInAsPending === true,
    treatForgetScanOutAsPending: form.treatForgetScanOutAsPending === true,

    isActive: form.isActive === true,
  }
}

function validateForm() {
  if (!String(form.code || '').trim()) return t('ot.policy.validation.codeRequired')
  if (!String(form.name || '').trim()) return t('ot.policy.validation.nameRequired')

  if (!String(form.roundMethod || '').trim()) {
    return t('ot.policy.validation.roundMethodRequired')
  }

  if (Number(form.roundUnitMinutes || 0) < 1) {
    return t('ot.policy.validation.roundUnitInvalid')
  }

  if (Number(form.minEligibleMinutes || 0) < 0) {
    return t('ot.policy.validation.minEligibleInvalid')
  }

  if (Number(form.graceAfterShiftEndMinutes || 0) < 0) {
    return t('ot.policy.validation.graceInvalid')
  }

  return ''
}

async function submitPolicy() {
  const validationMessage = validateForm()

  if (validationMessage) {
    showToast('warn', t('common.warning'), validationMessage, 2500)
    return
  }

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
      editingPolicyId.value ? t('common.updateFailed') : t('common.createFailed'),
      getApiErrorMessage(error, t('ot.policy.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell">
    <section class="ot-filter-bar ot-filter-bar-5">
      <div class="ot-field md:col-span-2 xl:col-span-2">
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

      <div class="ot-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearFilters"
        />

        <Button
          v-if="canCreate"
          :label="t('ot.policy.newPolicy')"
          icon="pi pi-plus"
          size="small"
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

          <p class="ot-table-subtitle">
            {{ t('ot.policy.subtitle') }}
          </p>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ t('common.updating') }}
          </span>

          <Button
            :label="t('common.refresh')"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            size="small"
            :loading="backgroundLoading && bootstrapped"
            @click="reloadFirstPage({ keepVisible: true })"
          />
        </div>
      </div>

      <div class="ot-table-wrapper">
        <AppTableLoading
          v-if="isFirstLoading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="7"
          :columns="9"
          icon="pi pi-sliders-h"
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
          table-style="min-width: 112rem"
          class="ot-data-table ot-data-table-compact"
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
                <i class="pi pi-sliders-h" />
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
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-col"
              >
                <span class="font-medium text-[color:var(--ot-text)]">
                  {{ data.code || '-' }}
                </span>

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.name || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="description"
            :header="t('common.description')"
            style="min-width: 20rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ data.description || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="roundMethod"
            :header="t('ot.policy.rounding')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-col gap-1"
              >
                <Tag
                  :value="roundMethodLabel(data.roundMethod)"
                  severity="info"
                  class="ot-status-tag"
                />

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ t('ot.policy.everyUnit', { unit: minutesLabel(data.roundUnitMinutes) }) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="minEligibleMinutes"
            :header="t('ot.policy.eligibility')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-col gap-1"
              >
                <span class="font-medium">
                  {{ t('ot.policy.minEligibleShort') }}:
                  {{ minutesLabel(data.minEligibleMinutes) }}
                </span>

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ t('ot.policy.graceShort') }}:
                  {{ minutesLabel(data.graceAfterShiftEndMinutes) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('ot.policy.behavior')"
            style="min-width: 29rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-wrap gap-1"
              >
                <Tag
                  :value="t('ot.policy.flagShort.pre', { value: boolText(data.allowPreShiftOT) })"
                  :severity="data.allowPreShiftOT ? 'success' : 'secondary'"
                  class="ot-status-tag"
                />

                <Tag
                  :value="t('ot.policy.flagShort.post', { value: boolText(data.allowPostShiftOT) })"
                  :severity="data.allowPostShiftOT ? 'success' : 'secondary'"
                  class="ot-status-tag"
                />

                <Tag
                  :value="t('ot.policy.flagShort.cap', { value: boolText(data.capByRequestedMinutes) })"
                  :severity="data.capByRequestedMinutes ? 'success' : 'warning'"
                  class="ot-status-tag"
                />

                <Tag
                  :value="t('ot.policy.flagShort.noExactOut', {
                    value: boolText(data.allowApprovedOtWithoutExactClockOut),
                  })"
                  :severity="data.allowApprovedOtWithoutExactClockOut ? 'info' : 'secondary'"
                  class="ot-status-tag"
                />
              </div>
            </template>
          </Column>

          <Column
            :header="t('ot.policy.forgetScan')"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-wrap gap-1"
              >
                <Tag
                  :value="t('ot.policy.flagShort.fsIn', {
                    value: boolText(data.treatForgetScanInAsPending),
                  })"
                  :severity="data.treatForgetScanInAsPending ? 'warning' : 'secondary'"
                  class="ot-status-tag"
                />

                <Tag
                  :value="t('ot.policy.flagShort.fsOut', {
                    value: boolText(data.treatForgetScanOutAsPending),
                  })"
                  :severity="data.treatForgetScanOutAsPending ? 'warning' : 'secondary'"
                  class="ot-status-tag"
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
                :severity="activeSeverity(data)"
                class="ot-status-tag"
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
              <span v-if="data">
                {{ formatDateTime(data.updatedAt || data.createdAt) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('common.actions')"
            frozen
            alignFrozen="right"
            headerClass="ot-action-column-header"
            bodyClass="ot-action-column-body"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="ot-row-actions"
              >
                <Button
                  v-if="canUpdate"
                  :label="t('common.edit')"
                  icon="pi pi-pencil"
                  size="small"
                  outlined
                  @click="openEditDialog(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="policyDialogVisible"
      modal
      :closable="!saving"
      :header="dialogTitle"
      :style="{ width: '64rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('common.code') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('ot.policy.codePlaceholder')"
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
            />
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('common.description') }}
          </label>

          <Textarea
            v-model="form.description"
            rows="3"
            auto-resize
            class="w-full"
            :placeholder="t('ot.policy.descriptionPlaceholder')"
          />
        </div>

        <div class="ot-form-grid">
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

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.policy.roundUnit') }}
            </label>

            <InputNumber
              v-model="form.roundUnitMinutes"
              class="w-full"
              inputClass="w-full"
              :min="1"
              :useGrouping="false"
              :suffix="` ${t('ot.common.min')}`"
            />
          </div>
        </div>

        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.policy.minEligible') }}
            </label>

            <InputNumber
              v-model="form.minEligibleMinutes"
              class="w-full"
              inputClass="w-full"
              :min="0"
              :useGrouping="false"
              :suffix="` ${t('ot.common.min')}`"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('ot.policy.graceAfterShiftEnd') }}
            </label>

            <InputNumber
              v-model="form.graceAfterShiftEndMinutes"
              class="w-full"
              inputClass="w-full"
              :min="0"
              :useGrouping="false"
              :suffix="` ${t('ot.common.min')}`"
            />
          </div>
        </div>

        <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] p-4">
          <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
            {{ t('ot.policy.behavior') }}
          </div>

          <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <label
              v-for="flag in behaviorFlags"
              :key="flag.key"
              class="flex items-start gap-3 rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-3"
            >
              <Checkbox
                v-model="form[flag.key]"
                binary
              />

              <span class="grid gap-0.5">
                <span class="text-sm font-semibold text-[color:var(--ot-text)]">
                  {{ flag.label }}
                </span>

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ flag.description }}
                </span>
              </span>
            </label>
          </div>
        </div>

        <label class="flex items-center gap-3 rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <Checkbox
            v-model="form.isActive"
            binary
          />

          <span class="grid gap-0.5">
            <span class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('common.active') }}
            </span>

            <span class="text-xs text-[color:var(--ot-text-muted)]">
              {{ t('ot.policy.activeHelp') }}
            </span>
          </span>
        </label>
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
            icon="pi pi-check"
            size="small"
            :loading="saving"
            :disabled="isSaveDisabled"
            @click="submitPolicy"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  border: 1px solid transparent !important;
  border-radius: 999px !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}
</style>