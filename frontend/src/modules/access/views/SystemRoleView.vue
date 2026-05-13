<!-- frontend/src/modules/access/views/SystemRoleView.vue -->
<script setup>
// frontend/src/modules/access/views/SystemRoleView.vue

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
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
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
const expandedRows = ref({})

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
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

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
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.roles)) return payload.roles
  if (Array.isArray(payload?.rows)) return payload.rows
  return []
}

function normalizeTotal(payload, items = []) {
  return Number(
    payload?.pagination?.total ||
      payload?.total ||
      payload?.count ||
      items.length ||
      0,
  )
}

function normalizeId(row) {
  return String(row?.id || row?._id || '').trim()
}

function addQueryValue(query, key, value) {
  const text = String(value ?? '').trim()

  if (text) {
    query[key] = text
  }
}

function buildQuery(page) {
  const query = {
    page,
    limit: PAGE_SIZE,
    sortField: filters.sortField,
    sortOrder: filters.sortOrder,
  }

  const search = String(filters.search || '').trim()

  if (search) {
    query.search = search
  }

  addQueryValue(query, 'isActive', filters.isActive)

  return query
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function mapPermissionOption(item) {
  const id = normalizeId(item)
  const code = String(item?.code || '').trim()
  const name = String(item?.name || '').trim()
  const module = String(item?.module || '').trim() || 'GENERAL'

  return {
    id,
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

function normalizeRoleRow(item) {
  const id = normalizeId(item)

  return {
    ...item,
    id,
  }
}

function permissionPreviewItems(row) {
  const groups = Array.isArray(row?.permissionGroups) ? row.permissionGroups : []
  const items = []

  for (const group of groups) {
    const groupItems = Array.isArray(group?.items) ? group.items : []

    for (const item of groupItems) {
      const name = String(item?.name || '').trim()

      items.push({
        id: item?.id || item?.value || item?.code || name,
        name: name || '-',
      })
    }
  }

  return items.slice(0, 4)
}

function hiddenPermissionCount(row) {
  const total = Number(row?.permissionCount || 0)
  return Math.max(0, total - permissionPreviewItems(row).length)
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

    permissionOptions.value = allItems.map(mapPermissionOption).filter((item) => item.value)
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
    const items = normalizeItems(payload).map(normalizeRoleRow)
    const total = normalizeTotal(payload, items)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value = new Set([page])
      expandedRows.value = {}
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
    expandedRows.value = {}
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

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

async function clearFilters() {
  filters.search = ''
  filters.isActive = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  await reloadFirstPage({ keepVisible: true })
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

function expandAllVisible() {
  const next = {}

  for (const row of rows.value) {
    if (!row) continue

    const id = normalizeId(row)
    if (id) next[id] = true
  }

  expandedRows.value = next
}

function collapseAll() {
  expandedRows.value = {}
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
  <div class="ot-page-shell role-page">
    <section class="ot-filter-bar role-filter-bar">
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

      <div class="role-filter-actions">
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
          :label="t('access.role.expandAll')"
          icon="pi pi-angle-double-down"
          severity="secondary"
          outlined
          size="small"
          @click="expandAllVisible"
        />

        <Button
          :label="t('access.role.collapseAll')"
          icon="pi pi-angle-double-up"
          severity="secondary"
          outlined
          size="small"
          @click="collapseAll"
        />

        <Button
          :label="t('access.role.newRole')"
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
        <AppTableLoading
          v-if="isFirstLoading"
          :title="t('common.loadingData')"
          :message="t('common.fetchingRecords')"
          :rows="7"
          :columns="8"
          icon="pi pi-id-card"
        />

        <DataTable
          v-else
          v-model:expanded-rows="expandedRows"
          :value="rows"
          data-key="id"
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortField"
          :sort-order="filters.sortOrder"
          table-style="min-width: 82rem"
          class="ot-data-table ot-data-table-compact role-data-table"
          :virtual-scroller-options="useVirtualScroll ? {
            lazy: true,
            onLazyLoad: onVirtualLazyLoad,
            itemSize: 58,
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
            expander
            style="width: 3rem; min-width: 3rem"
          />

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="role-cell"
              >
                <span class="role-code-text">
                  {{ data.code || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="displayName"
            :header="t('access.role.displayName')"
            sortable
            style="min-width: 15rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="role-cell"
              >
                <span
                  class="role-truncate"
                  :title="data.displayName || '-'"
                >
                  {{ data.displayName || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('access.role.permissionsByModule')"
            style="min-width: 30rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="role-permission-preview"
              >
                <Tag
                  v-for="item in permissionPreviewItems(data)"
                  :key="item.id || item.name"
                  :value="item.name"
                  class="role-rgb-tag role-permission-tag"
                />

                <Tag
                  v-if="hiddenPermissionCount(data)"
                  :value="t('access.role.morePermissions', { count: hiddenPermissionCount(data) })"
                  class="role-rgb-tag role-more-tag"
                />

                <span
                  v-if="!permissionPreviewItems(data).length"
                  class="role-empty-text"
                >
                  -
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('access.role.count')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="role-cell"
              >
                <Tag
                  :value="String(data.permissionCount || 0)"
                  class="role-rgb-tag role-count-tag"
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
              <div
                v-if="data"
                class="role-cell"
              >
                <Tag
                  :value="data.isActive ? t('common.active') : t('common.inactive')"
                  class="role-rgb-tag"
                  :class="data.isActive ? 'role-active-tag' : 'role-inactive-tag'"
                />
              </div>
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            style="min-width: 14rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="role-cell"
              >
                <span>
                  {{ formatDateTime(data.createdAt) }}
                </span>
              </div>
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
                class="role-action-cell"
              >
                <Button
                  :label="t('common.edit')"
                  icon="pi pi-pencil"
                  size="small"
                  outlined
                  @click="openEditDialog(data)"
                />
              </div>
            </template>
          </Column>

          <template #expansion="{ data }">
            <div class="role-expansion-panel">
              <RolePermissionSummary
                :groups="data.permissionGroups || []"
                :expanded="true"
                :max-per-module="999"
              />
            </div>
          </template>
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
        <div class="role-dialog-grid">
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('access.role.roleCode') }}
            </label>

            <InputText
              v-model="form.code"
              class="w-full"
              :placeholder="t('access.role.roleCodeExample')"
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

        <div class="role-active-box">
          <span class="role-active-label">
            {{ t('common.active') }}
          </span>

          <InputSwitch v-model="form.isActive" />
        </div>

        <div class="space-y-3">
          <div class="role-dialog-section-header">
            <label class="ot-field-label">
              {{ t('access.role.permissionsByModule') }}
            </label>

            <Tag
              :value="t('access.role.selectedCount', { count: selectedPermissionCount })"
              class="role-rgb-tag role-count-tag"
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

<style scoped>
.role-page {
  --role-primary-rgb: 37, 99, 235;
  --role-count-rgb: 15, 118, 110;
  --role-more-rgb: 100, 116, 139;
  --role-active-rgb: 22, 163, 74;
  --role-inactive-rgb: 100, 116, 139;
}

.role-filter-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
}

.role-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.role-filter-actions > * {
  flex: 0 0 auto;
}

.role-data-table :deep(.p-datatable-tbody > tr > td) {
  padding-top: 0.42rem;
  padding-bottom: 0.42rem;
  vertical-align: middle;
}

.role-data-table :deep(.p-datatable-thead > tr > th) {
  vertical-align: middle;
}

.role-data-table :deep(.p-column-header-content) {
  width: 100%;
}

.role-cell,
.role-action-cell {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
}

.role-action-cell {
  justify-content: center;
}

.role-code-text {
  font-weight: 650;
  color: var(--ot-text);
}

.role-truncate {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-empty-text {
  color: var(--ot-text-muted);
  font-size: 0.82rem;
}

.role-permission-preview {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.35rem;
}

.role-rgb-tag {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.2rem 0.56rem;
  font-size: 0.7rem;
  font-weight: 650;
  line-height: 1;
}

.role-permission-tag {
  border-color: rgba(var(--role-primary-rgb), 0.24);
  background: rgba(var(--role-primary-rgb), 0.11);
  color: rgb(var(--role-primary-rgb));
}

.role-count-tag {
  border-color: rgba(var(--role-count-rgb), 0.24);
  background: rgba(var(--role-count-rgb), 0.1);
  color: rgb(var(--role-count-rgb));
}

.role-more-tag {
  border-color: rgba(var(--role-more-rgb), 0.24);
  background: rgba(var(--role-more-rgb), 0.1);
  color: rgb(var(--role-more-rgb));
}

.role-active-tag {
  border-color: rgba(var(--role-active-rgb), 0.24);
  background: rgba(var(--role-active-rgb), 0.12);
  color: rgb(var(--role-active-rgb));
}

.role-inactive-tag {
  border-color: rgba(var(--role-inactive-rgb), 0.24);
  background: rgba(var(--role-inactive-rgb), 0.12);
  color: rgb(var(--role-inactive-rgb));
}

.role-expansion-panel {
  padding: 0.85rem;
  background: var(--ot-surface-2);
}

.role-dialog-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}

.role-active-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  padding: 0.75rem 0.9rem;
}

.role-active-label {
  color: var(--ot-text);
  font-size: 0.86rem;
  font-weight: 650;
}

.role-dialog-section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.role-page :deep(.p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.dark) .role-permission-tag {
  border-color: rgba(var(--role-primary-rgb), 0.36);
  background: rgba(var(--role-primary-rgb), 0.18);
}

:global(.dark) .role-count-tag {
  border-color: rgba(var(--role-count-rgb), 0.36);
  background: rgba(var(--role-count-rgb), 0.16);
}

:global(.dark) .role-more-tag {
  border-color: rgba(var(--role-more-rgb), 0.36);
  background: rgba(var(--role-more-rgb), 0.16);
}

:global(.dark) .role-active-tag {
  border-color: rgba(var(--role-active-rgb), 0.36);
  background: rgba(var(--role-active-rgb), 0.18);
}

:global(.dark) .role-inactive-tag {
  border-color: rgba(var(--role-inactive-rgb), 0.36);
  background: rgba(var(--role-inactive-rgb), 0.18);
}

@media (max-width: 768px) {
  .role-filter-actions {
    justify-content: stretch;
  }

  .role-filter-actions > * {
    flex: 1 1 100%;
  }
}

@media (min-width: 768px) {
  .role-filter-bar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 220px);
  }

  .role-dialog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .role-filter-bar {
    grid-template-columns:
      400px
      220px
      minmax(420px, 1fr);
  }

  .role-filter-actions {
    grid-column: auto;
  }
}
</style>