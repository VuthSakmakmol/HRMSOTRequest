<!-- frontend/src/modules/access/views/SystemRoleView.vue -->
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
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import RolePermissionSelector from '@/modules/access/components/RolePermissionSelector.vue'
import RolePermissionSummary from '@/modules/access/components/RolePermissionSummary.vue'
import {
  createSystemRole,
  getPermissionOptions,
  getSystemRoles,
  updateSystemRole,
} from '@/modules/access/systemRole.api'
import { buildSaveErrorMessage, getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDateTime } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const PERMISSION_PAGE_SIZE = 100

const saving = ref(false)
const permissionLoading = ref(false)

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const roleDialogVisible = ref(false)
const editingRoleId = ref('')

const permissionOptions = ref([])

const filters = reactive({
  search: '',
  isActive: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const form = reactive({
  code: '',
  displayName: '',
  permissionIds: [],
  isActive: true,
})

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const isEditMode = computed(() => !!editingRoleId.value)
const totalRoles = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRoles.value > PAGE_SIZE)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalRoles.value,
  }),
)

const selectedPermissionCount = computed(() =>
  Array.isArray(form.permissionIds) ? form.permissionIds.length : 0,
)

const dialogTitle = computed(() =>
  isEditMode.value ? t('access.role.editTitle') : t('access.role.createTitle'),
)

const saveLabel = computed(() =>
  isEditMode.value ? t('common.save') : t('access.role.createTitle'),
)

const isSaveDisabled = computed(() => {
  return (
    saving.value ||
    !String(form.code || '').trim() ||
    !String(form.displayName || '').trim()
  )
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizePaginationTotal(payload) {
  return Number(payload?.pagination?.total || payload?.total || 0)
}

function normalizeId(row) {
  return String(row?.id || row?._id || '').trim()
}

function mapPermissionOption(item) {
  const id = normalizeId(item)
  const code = String(item?.code || '').trim()
  const name = String(item?.name || '').trim()
  const module = String(item?.module || '').trim()

  return {
    value: id,
    code,
    name,
    module,
    description: String(item?.description || '').trim(),
    isActive: item?.isActive !== false,
  }
}

function normalizeRolePermissionIds(row) {
  if (Array.isArray(row?.permissionIds) && row.permissionIds.length) {
    return row.permissionIds.map((value) => String(value)).filter(Boolean)
  }

  if (Array.isArray(row?.permissions) && row.permissions.length) {
    return row.permissions
      .map((item) => normalizeId(item))
      .filter(Boolean)
  }

  return []
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim(),
    isActive: filters.isActive,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
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

async function fetchAllPermissions() {
  permissionLoading.value = true

  try {
    const allItems = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const res = await getPermissionOptions({
        page,
        limit: PERMISSION_PAGE_SIZE,
        isActive: true,
        sortField: 'module',
        sortOrder: 1,
      })

      const payload = normalizePayload(res)
      const items = normalizeItems(payload)

      allItems.push(...items)

      const pagination = payload?.pagination || {}
      hasMore = !!pagination.hasMore
      page += 1

      if (page > 50) {
        hasMore = false
      }
    }

    permissionOptions.value = allItems.map(mapPermissionOption)
  } catch (error) {
    permissionOptions.value = []
    showToast(
      'error',
      t('access.permission.loadFailed'),
      getApiErrorMessage(error, t('access.permission.loadFailed')),
    )
  } finally {
    permissionLoading.value = false
  }
}

async function ensurePermissionsLoaded() {
  if (permissionOptions.value.length) return
  await fetchAllPermissions()
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getSystemRoles(buildQuery(page))
    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
    const total = normalizePaginationTotal(payload)
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
    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('access.role.loadFailed')),
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
  editingRoleId.value = ''
  form.code = ''
  form.displayName = ''
  form.permissionIds = []
  form.isActive = true
}

async function openCreateDialog() {
  resetForm()
  await ensurePermissionsLoaded()
  roleDialogVisible.value = true
}

async function openEditDialog(row) {
  editingRoleId.value = normalizeId(row)
  form.code = row?.code || ''
  form.displayName = row?.displayName || ''
  form.permissionIds = normalizeRolePermissionIds(row)
  form.isActive = row?.isActive !== false

  await ensurePermissionsLoaded()

  roleDialogVisible.value = true
}

async function submitRole() {
  saving.value = true

  try {
    const payload = {
      code: String(form.code || '').trim().toUpperCase(),
      displayName: String(form.displayName || '').trim(),
      permissionIds: Array.isArray(form.permissionIds)
        ? [...new Set(form.permissionIds.map((value) => String(value)).filter(Boolean))]
        : [],
      isActive: !!form.isActive,
    }

    if (editingRoleId.value) {
      await updateSystemRole(editingRoleId.value, payload)

      showToast('success', t('common.updated'), t('access.role.updatedSuccess'), 2500)
    } else {
      await createSystemRole(payload)

      showToast('success', t('common.created'), t('access.role.createdSuccess'), 2500)
    }

    roleDialogVisible.value = false
    resetForm()

    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    showToast(
      'error',
      isEditMode.value ? t('common.updateFailed') : t('common.createFailed'),
      buildSaveErrorMessage(error, t('access.role.saveFailed')),
      3500,
    )
  } finally {
    saving.value = false
  }
}

function statusSeverity(active) {
  return active ? 'success' : 'secondary'
}

onMounted(async () => {
  await Promise.all([
    reloadFirstPage({ keepVisible: false }),
    fetchAllPermissions(),
  ])
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell">

    <section class="ot-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="filters.search"
            :placeholder="t('access.role.searchPlaceholder')"
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
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('access.role.tableTitle') }}
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
        <DataTable
          :value="rows"
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortField"
          :sort-order="filters.sortOrder"
          table-style="min-width: 74rem"
          class="ot-data-table ot-data-table-compact"
          :virtual-scroller-options="useVirtualScroll ? {
            lazy: true,
            onLazyLoad: onVirtualLazyLoad,
            itemSize: 76,
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
                <i class="pi pi-id-card" />
              </div>
              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>
              <div class="ot-empty-text">
                {{ t('access.role.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-bold"
              >
                {{ data.code || '-' }}
              </span>
            </template>
          </Column>

          <Column
            field="displayName"
            :header="t('access.role.displayName')"
            sortable
            style="min-width: 15rem"
          >
            <template #body="{ data }">
              <span v-if="data">{{ data.displayName || '-' }}</span>
            </template>
          </Column>

          <Column
            :header="t('access.role.permissionsByModule')"
            style="min-width: 28rem"
          >
            <template #body="{ data }">
              <RolePermissionSummary
                v-if="data"
                :groups="data.permissionGroups || []"
                :max-per-module="4"
              />
            </template>
          </Column>

          <Column
            :header="t('access.role.count')"
            style="min-width: 6rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="String(data.permissionCount || 0)"
                severity="secondary"
              />
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            style="min-width: 7rem"
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
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span v-if="data">{{ formatDateTime(data.createdAt) }}</span>
            </template>
          </Column>

          <Column
            :header="t('common.actions')"
            style="width: 7rem; min-width: 7rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data"
                :label="t('common.edit')"
                icon="pi pi-pencil"
                size="small"
                outlined
                @click="openEditDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="roleDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: '76rem', maxWidth: '96vw' }"
      @hide="resetForm"
    >
      <div class="ot-dialog-form">
        <div class="ot-form-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('access.role.roleCode') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              placeholder="SYSTEM_ADMIN"
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('access.role.displayName') }}
            </label>

            <InputText
              v-model="form.displayName"
              class="w-full"
              :placeholder="t('access.role.displayNameExample')"
            />
          </div>
        </div>

        <div class="flex items-center justify-between rounded-xl border border-[color:var(--ot-border)] px-4 py-3">
          <span class="text-sm font-semibold text-[color:var(--ot-text)]">
            {{ t('common.active') }}
          </span>

          <InputSwitch v-model="form.isActive" />
        </div>

        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label class="ot-field-label">
                {{ t('access.role.permissionsByModule') }}
              </label>

              <p class="ot-field-help">
                {{ t('access.role.permissionHelp') }}
              </p>
            </div>

            <Tag
              :value="t('access.role.selectedCount', { count: selectedPermissionCount })"
              severity="secondary"
            />
          </div>

          <RolePermissionSelector
            v-model="form.permissionIds"
            :options="permissionOptions"
            :loading="permissionLoading"
          />
        </div>
      </div>

      <template #footer>
        <div class="ot-form-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            @click="roleDialogVisible = false"
          />

          <Button
            :label="saveLabel"
            :loading="saving"
            :disabled="isSaveDisabled"
            size="small"
            @click="submitRole"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>