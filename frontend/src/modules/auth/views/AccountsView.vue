<!-- frontend/src/modules/auth/views/AccountsView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputSwitch from 'primevue/inputswitch'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Password from 'primevue/password'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import {
  createAccount,
  getAccounts,
  getEmployeeOptions,
  getRoleOptions,
  resetAccountPassword,
  updateAccount,
} from '@/modules/auth/account.api'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import { buildSaveErrorMessage, getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const saving = ref(false)
const resetting = ref(false)
const loadingOptions = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const employeeOptions = ref([])
const roleOptions = ref([])

const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const resetDialogVisible = ref(false)
const selectedAccount = ref(null)

const filters = reactive({
  search: '',
  isActive: '',
})

const createForm = reactive({
  loginId: '',
  password: '',
  displayName: '',
  employeeId: null,
  roleIds: [],
  directPermissionCodes: [],
  mustChangePassword: false,
  isActive: true,
})

const editForm = reactive({
  loginId: '',
  displayName: '',
  employeeId: null,
  roleIds: [],
  directPermissionCodes: [],
  mustChangePassword: false,
  isActive: true,
})

const resetForm = reactive({
  newPassword: '',
  mustChangePassword: true,
})

const directPermissionInput = ref('')
const editDirectPermissionInput = ref('')

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const yesNoOptions = computed(() => [
  { label: t('common.yes'), value: true },
  { label: t('common.no'), value: false },
])

const totalAccounts = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalAccounts.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalAccounts.value,
  }),
)

const isCreateDisabled = computed(() => {
  return (
    saving.value ||
    !String(createForm.loginId || '').trim() ||
    !String(createForm.password || '').trim() ||
    !String(createForm.displayName || '').trim()
  )
})

const isEditDisabled = computed(() => {
  return (
    saving.value ||
    !String(editForm.loginId || '').trim() ||
    !String(editForm.displayName || '').trim()
  )
})

const isResetDisabled = computed(() => {
  return resetting.value || !String(resetForm.newPassword || '').trim()
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
  return String(row?.id || row?._id || '').trim()
}

function normalizeRefId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  return value?.id || value?._id || null
}

function employeeLabel(item = {}) {
  const employeeNo = String(item?.employeeNo || item?.code || '').trim()
  const displayName = String(item?.displayName || item?.name || '').trim()

  return (
    [employeeNo, displayName].filter(Boolean).join(' - ') ||
    t('auth.account.unnamedEmployee')
  )
}

function normalizeEmployeeOptions(payload) {
  return normalizeItems(payload)
    .map((item) => ({
      label: employeeLabel(item),
      value: normalizeId(item),
    }))
    .filter((item) => item.value)
}

function normalizeRoleOptions(payload) {
  return normalizeItems(payload)
    .map((item) => ({
      label:
        item?.displayName ||
        item?.name ||
        item?.title ||
        item?.code ||
        t('auth.account.unnamedRole'),
      value: normalizeId(item),
    }))
    .filter((item) => item.value)
}

function normalizePermissionCodes(values) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => String(value || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
}

function permissionChips(input) {
  return normalizePermissionCodes(String(input || '').split(','))
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: filters.isActive,
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
    const res = await getAccounts(buildQuery(page))

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
      getApiErrorMessage(error, t('auth.account.loadFailed')),
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

async function fetchOptions() {
  loadingOptions.value = true

  try {
    const [employeeResult, roleResult] = await Promise.allSettled([
      getEmployeeOptions({ page: 1, limit: 100, isActive: true }),
      getRoleOptions({ page: 1, limit: 100, isActive: true }),
    ])

    if (employeeResult.status === 'fulfilled') {
      employeeOptions.value = normalizeEmployeeOptions(
        normalizePayload(employeeResult.value),
      )
    } else {
      employeeOptions.value = []
      showToast('warn', t('common.warning'), t('auth.account.employeeOptionsLoadFailed'))
    }

    if (roleResult.status === 'fulfilled') {
      roleOptions.value = normalizeRoleOptions(normalizePayload(roleResult.value))
    } else {
      roleOptions.value = []
      showToast('warn', t('common.warning'), t('auth.account.roleOptionsLoadFailed'))
    }
  } finally {
    loadingOptions.value = false
  }
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

function resetCreateForm() {
  createForm.loginId = ''
  createForm.password = ''
  createForm.displayName = ''
  createForm.employeeId = null
  createForm.roleIds = []
  createForm.directPermissionCodes = []
  createForm.mustChangePassword = false
  createForm.isActive = true
  directPermissionInput.value = ''
}

function resetEditForm() {
  editForm.loginId = ''
  editForm.displayName = ''
  editForm.employeeId = null
  editForm.roleIds = []
  editForm.directPermissionCodes = []
  editForm.mustChangePassword = false
  editForm.isActive = true
  editDirectPermissionInput.value = ''
}

function resetResetForm() {
  resetForm.newPassword = ''
  resetForm.mustChangePassword = true
}

function openCreateDialog() {
  resetCreateForm()
  createDialogVisible.value = true
}

function openEditDialog(row) {
  selectedAccount.value = row

  editForm.loginId = row?.loginId || ''
  editForm.displayName = row?.displayName || ''
  editForm.employeeId = normalizeRefId(row?.employeeId)
  editForm.roleIds = Array.isArray(row?.roleIds) ? [...row.roleIds] : []
  editForm.directPermissionCodes = Array.isArray(row?.directPermissionCodes)
    ? [...row.directPermissionCodes]
    : []
  editForm.mustChangePassword = !!row?.mustChangePassword
  editForm.isActive = !!row?.isActive
  editDirectPermissionInput.value = editForm.directPermissionCodes.join(', ')

  editDialogVisible.value = true
}

function openResetDialog(row) {
  selectedAccount.value = row
  resetResetForm()
  resetDialogVisible.value = true
}

async function submitCreate() {
  saving.value = true

  try {
    await createAccount({
      loginId: String(createForm.loginId || '').trim(),
      password: createForm.password,
      displayName: String(createForm.displayName || '').trim(),
      employeeId: createForm.employeeId || null,
      roleIds: Array.isArray(createForm.roleIds) ? createForm.roleIds : [],
      directPermissionCodes: permissionChips(directPermissionInput.value),
      mustChangePassword: !!createForm.mustChangePassword,
      isActive: !!createForm.isActive,
    })

    createDialogVisible.value = false
    resetCreateForm()

    showToast('success', t('common.created'), t('auth.account.createdSuccess'), 2500)

    await fetchOptions()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      t('common.createFailed'),
      buildSaveErrorMessage(error, t('auth.account.createFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

async function submitEdit() {
  const accountId = normalizeId(selectedAccount.value)
  if (!accountId) return

  saving.value = true

  try {
    await updateAccount(accountId, {
      loginId: String(editForm.loginId || '').trim(),
      displayName: String(editForm.displayName || '').trim(),
      employeeId: editForm.employeeId || null,
      roleIds: Array.isArray(editForm.roleIds) ? editForm.roleIds : [],
      directPermissionCodes: permissionChips(editDirectPermissionInput.value),
      mustChangePassword: !!editForm.mustChangePassword,
      isActive: !!editForm.isActive,
    })

    editDialogVisible.value = false
    resetEditForm()

    showToast('success', t('common.updated'), t('auth.account.updatedSuccess'), 2500)

    await fetchOptions()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      t('common.updateFailed'),
      buildSaveErrorMessage(error, t('auth.account.updateFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

async function submitResetPassword() {
  const accountId = normalizeId(selectedAccount.value)
  if (!accountId) return

  resetting.value = true

  try {
    await resetAccountPassword(accountId, {
      newPassword: resetForm.newPassword,
      mustChangePassword: !!resetForm.mustChangePassword,
    })

    resetDialogVisible.value = false
    resetResetForm()

    showToast(
      'success',
      t('auth.account.passwordReset'),
      t('auth.account.passwordResetSuccess'),
      2500,
    )

    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    showToast(
      'error',
      t('auth.account.resetFailed'),
      buildSaveErrorMessage(error, t('auth.account.resetFailed')),
      3500,
    )
  } finally {
    resetting.value = false
  }
}

function statusSeverity(active) {
  return active ? 'success' : 'secondary'
}

function yesNoSeverity(value) {
  return value ? 'warn' : 'secondary'
}

function formatRoleNames(roleIds = []) {
  if (!Array.isArray(roleIds) || !roleIds.length) return '-'

  const labelMap = new Map(roleOptions.value.map((item) => [item.value, item.label]))

  return roleIds.map((id) => labelMap.get(id) || id).join(', ')
}

function formatEmployeeName(employeeValue) {
  if (!employeeValue) return '-'

  if (typeof employeeValue === 'object') {
    return employeeLabel(employeeValue)
  }

  const found = employeeOptions.value.find((item) => item.value === employeeValue)

  return found?.label || '-'
}

onMounted(async () => {
  await Promise.all([
    fetchOptions(),
    reloadFirstPage({ keepVisible: false }),
  ])
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell">
    <section class="ot-filter-bar accounts-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('auth.account.searchPlaceholder')"
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
          @change="onStatusChange"
        />
      </div>

      <div class="ot-filter-actions accounts-filter-actions">
        <span class="ot-loaded-badge whitespace-nowrap">
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
          :label="t('auth.account.newAccount')"
          icon="pi pi-plus"
          size="small"
          class="whitespace-nowrap"
          @click="openCreateDialog"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('auth.account.tableTitle') }}
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
          icon="pi pi-users"
        />

        <DataTable
          v-else
          :value="rows"
          lazy
          scrollable
          scroll-height="500px"
          table-style="min-width: 96rem"
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
        >
          <template #empty>
            <div
              v-if="bootstrapped"
              class="ot-empty-state"
            >
              <div class="ot-empty-icon">
                <i class="pi pi-users" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('auth.account.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="loginId"
            :header="t('auth.loginId')"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-bold"
              >
                {{ data.loginId || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="displayName"
            :header="t('auth.account.displayName')"
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ data.displayName || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.employees')"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ formatEmployeeName(data.employeeId) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('nav.roles')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="ot-truncate-2"
              >
                {{ formatRoleNames(data.roleIds) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('auth.account.directPermissions')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <div
                v-if="data && Array.isArray(data.directPermissionCodes) && data.directPermissionCodes.length"
                class="flex flex-wrap gap-1"
              >
                <Tag
                  v-for="code in data.directPermissionCodes"
                  :key="code"
                  :value="code"
                  severity="info"
                />
              </div>

              <span v-else-if="data">-</span>
            </template>
          </Column>

          <Column
            :header="t('auth.account.mustChangePassword')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="data.mustChangePassword ? t('common.yes') : t('common.no')"
                :severity="yesNoSeverity(data.mustChangePassword)"
              />
            </template>
          </Column>

          <Column
            :header="t('common.status')"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="data.isActive ? t('common.active') : t('common.inactive')"
                :severity="statusSeverity(data.isActive)"
              />
            </template>
          </Column>

          <Column
            :header="t('common.createdAt')"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span v-if="data">
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
              <div
                v-if="data"
                class="ot-row-actions"
              >
                <Button
                  :label="t('common.edit')"
                  icon="pi pi-pencil"
                  size="small"
                  outlined
                  @click="openEditDialog(data)"
                />

                <Button
                  :label="t('auth.account.reset')"
                  icon="pi pi-key"
                  size="small"
                  severity="danger"
                  outlined
                  @click="openResetDialog(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="createDialogVisible"
      modal
      :header="t('auth.account.createTitle')"
      :style="{ width: '52rem', maxWidth: '96vw' }"
      @hide="resetCreateForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.loginId') }}
            </label>

            <InputText
              v-model="createForm.loginId"
              class="w-full"
              :placeholder="t('auth.account.loginIdExample')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.account.displayName') }}
            </label>

            <InputText
              v-model="createForm.displayName"
              class="w-full"
              :placeholder="t('auth.account.displayNameExample')"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.password') }}
            </label>

            <Password
              v-model="createForm.password"
              class="w-full"
              input-class="w-full"
              toggle-mask
              :feedback="false"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.employees') }}
            </label>

            <Select
              v-model="createForm.employeeId"
              :options="employeeOptions"
              option-label="label"
              option-value="value"
              filter
              show-clear
              :placeholder="t('auth.account.selectEmployee')"
              class="w-full"
              :loading="loadingOptions"
            />
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('nav.roles') }}
          </label>

          <MultiSelect
            v-model="createForm.roleIds"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            filter
            display="chip"
            :placeholder="t('auth.account.selectRoles')"
            class="w-full"
            :loading="loadingOptions"
          />
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('auth.account.directPermissions') }}
          </label>

          <InputText
            v-model="directPermissionInput"
            class="w-full"
            placeholder="ACCOUNT_VIEW, ACCOUNT_CREATE"
          />

          <p class="ot-field-help">
            {{ t('auth.account.directPermissionHelp') }}
          </p>
        </div>

        <div class="ot-form-grid">
          <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
            <span class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('auth.account.mustChangePassword') }}
            </span>

            <InputSwitch v-model="createForm.mustChangePassword" />
          </div>

          <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
            <span class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('common.active') }}
            </span>

            <InputSwitch v-model="createForm.isActive" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            @click="createDialogVisible = false"
          />

          <Button
            :label="t('auth.account.createTitle')"
            :loading="saving"
            :disabled="isCreateDisabled"
            size="small"
            @click="submitCreate"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="editDialogVisible"
      modal
      :header="t('auth.account.editTitle')"
      :style="{ width: '52rem', maxWidth: '96vw' }"
      @hide="resetEditForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.loginId') }}
            </label>

            <InputText
              v-model="editForm.loginId"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.account.displayName') }}
            </label>

            <InputText
              v-model="editForm.displayName"
              class="w-full"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('nav.employees') }}
            </label>

            <Select
              v-model="editForm.employeeId"
              :options="employeeOptions"
              option-label="label"
              option-value="value"
              filter
              show-clear
              :placeholder="t('auth.account.selectEmployee')"
              class="w-full"
              :loading="loadingOptions"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.account.mustChangePassword') }}
            </label>

            <Select
              v-model="editForm.mustChangePassword"
              :options="yesNoOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('nav.roles') }}
          </label>

          <MultiSelect
            v-model="editForm.roleIds"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            filter
            display="chip"
            :placeholder="t('auth.account.selectRoles')"
            class="w-full"
            :loading="loadingOptions"
          />
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('auth.account.directPermissions') }}
          </label>

          <InputText
            v-model="editDirectPermissionInput"
            class="w-full"
            placeholder="ACCOUNT_VIEW, ACCOUNT_CREATE"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-semibold text-[color:var(--ot-text)]">
            {{ t('common.active') }}
          </span>

          <InputSwitch v-model="editForm.isActive" />
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            @click="editDialogVisible = false"
          />

          <Button
            :label="t('common.save')"
            :loading="saving"
            :disabled="isEditDisabled"
            size="small"
            @click="submitEdit"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="resetDialogVisible"
      modal
      :header="t('auth.account.resetPassword')"
      :style="{ width: '34rem', maxWidth: '95vw' }"
      @hide="resetResetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-inline-error">
          {{ t('auth.account.resettingFor') }}
          <span class="font-semibold">
            {{ selectedAccount?.loginId || '-' }}
          </span>
        </div>

        <div class="ot-field">
          <label class="ot-field-label">
            {{ t('auth.account.newPassword') }}
          </label>

          <Password
            v-model="resetForm.newPassword"
            class="w-full"
            input-class="w-full"
            toggle-mask
            :feedback="false"
          />
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-semibold text-[color:var(--ot-text)]">
            {{ t('auth.account.forcePasswordChange') }}
          </span>

          <InputSwitch v-model="resetForm.mustChangePassword" />
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            @click="resetDialogVisible = false"
          />

          <Button
            :label="t('auth.account.resetPassword')"
            severity="danger"
            :loading="resetting"
            :disabled="isResetDisabled"
            size="small"
            @click="submitResetPassword"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
@media (min-width: 1280px) {
  .accounts-filter-bar {
    grid-template-columns: minmax(280px, 1fr) minmax(220px, 360px) auto;
    align-items: end;
  }

  .accounts-filter-actions {
    flex-wrap: nowrap;
    justify-content: flex-end;
    min-width: max-content;
  }
}
</style>