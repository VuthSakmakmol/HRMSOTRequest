<!-- frontend/src/modules/access/views/PermissionsView.vue -->
<script setup>
// frontend/src/modules/access/views/PermissionsView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { getPermissions } from '@/modules/access/permission.api'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
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

const moduleOptions = ref([])

const filters = reactive({
  search: '',
  module: '',
  isActive: '',
  sortField: 'module',
  sortOrder: 1,
})

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const moduleSelectOptions = computed(() => [
  { label: t('access.permission.allModules'), value: '' },
  ...moduleOptions.value.map((item) => ({
    label: item,
    value: item,
  })),
])

const totalPermissions = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalPermissions.value > PAGE_SIZE)
const isFirstLoading = computed(() => !bootstrapped.value && backgroundLoading.value)

const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalPermissions.value,
  }),
)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.permissions)) return payload.permissions
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

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
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
    query.q = search
  }

  addQueryValue(query, 'module', filters.module)
  addQueryValue(query, 'isActive', filters.isActive)

  return query
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getPermissions(buildQuery(page))

    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
    const total = normalizeTotal(payload, items)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (Array.isArray(payload?.filters?.modules)) {
      moduleOptions.value = payload.filters.modules
    }

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
      getApiErrorMessage(error, t('access.permission.loadFailed')),
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

function onModuleChange() {
  reloadFirstPage({ keepVisible: true })
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

async function clearFilters() {
  filters.search = ''
  filters.module = ''
  filters.isActive = ''
  filters.sortField = 'module'
  filters.sortOrder = 1

  await reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  filters.sortField = event.sortField || 'module'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : 1

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

function moduleLabel(value) {
  return String(value || '-').trim() || '-'
}

onMounted(async () => {
  await reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell permission-page">
    <section class="ot-filter-bar permission-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('access.permission.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('access.permission.module') }}
        </label>

        <Select
          v-model="filters.module"
          :options="moduleSelectOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          size="small"
          @change="onModuleChange"
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
          @change="onStatusChange"
        />
      </div>

      <div class="permission-filter-actions">
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
            {{ t('access.permission.tableTitle') }}
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
          :columns="6"
          icon="pi pi-shield"
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
          table-style="min-width: 76rem"
          class="ot-data-table ot-data-table-compact permission-data-table"
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
                <i class="pi pi-shield" />
              </div>

              <div class="ot-empty-title">
                {{ t('common.noData') }}
              </div>

              <div class="ot-empty-text">
                {{ t('access.permission.noData') }}
              </div>
            </div>
          </template>

          <Column
            field="module"
            :header="t('access.permission.module')"
            sortable
            header-class="permission-center-header"
            body-class="permission-center-cell"
            style="min-width: 10rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="permission-cell-center"
              >
                <Tag
                  :value="moduleLabel(data.module)"
                  class="permission-rgb-tag permission-module-tag"
                />
              </div>
            </template>
          </Column>

          <Column
            field="code"
            :header="t('common.code')"
            sortable
            header-class="permission-center-header"
            body-class="permission-center-cell"
            style="min-width: 15rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="permission-cell-center"
              >
                <span class="permission-code-text">
                  {{ data.code || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="name"
            :header="t('common.name')"
            sortable
            header-class="permission-center-header"
            body-class="permission-center-cell"
            style="min-width: 15rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="permission-cell-center"
              >
                <span
                  class="permission-truncate-center"
                  :title="data.name || '-'"
                >
                  {{ data.name || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="description"
            :header="t('common.description')"
            header-class="permission-center-header"
            body-class="permission-center-cell"
            style="min-width: 22rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="permission-cell-center"
              >
                <span
                  class="permission-truncate-center"
                  :title="data.description || '-'"
                >
                  {{ data.description || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="isActive"
            :header="t('common.status')"
            sortable
            header-class="permission-center-header"
            body-class="permission-center-cell"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="permission-cell-center"
              >
                <Tag
                  :value="data.isActive ? t('common.active') : t('common.inactive')"
                  class="permission-rgb-tag"
                  :class="data.isActive ? 'permission-active-tag' : 'permission-inactive-tag'"
                />
              </div>
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('common.createdAt')"
            sortable
            header-class="permission-center-header"
            body-class="permission-center-cell"
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="permission-cell-center"
              >
                <span>
                  {{ formatDateTime(data.createdAt) }}
                </span>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </section>
  </div>
</template>

<style scoped>
.permission-page {
  --permission-module-rgb: 37, 99, 235;
  --permission-active-rgb: 22, 163, 74;
  --permission-inactive-rgb: 100, 116, 139;
}

/* fixed filter layout, no auto-fit */
.permission-filter-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
}

.permission-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.permission-filter-actions > * {
  flex: 0 0 auto;
}

/* table alignment: header clean, body data left */
.permission-data-table :deep(.p-datatable-thead > tr > th) {
  text-align: left;
  vertical-align: middle;
}

.permission-data-table :deep(.p-datatable-tbody > tr > td),
.permission-data-table :deep(.permission-center-cell) {
  text-align: left;
  vertical-align: middle;
}

.permission-data-table :deep(.p-column-header-content) {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}

.permission-data-table :deep(.p-sortable-column-icon) {
  margin-left: 0.35rem;
}

.permission-data-table :deep(.p-sortable-column-icon) {
  margin-left: 0.35rem;
}

.permission-data-table :deep(.p-datatable-tbody > tr > td) {
  padding-top: 0.42rem;
  padding-bottom: 0.42rem;
}

.permission-cell-center {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.permission-code-text {
  font-weight: 650;
  color: var(--ot-text);
}

.permission-truncate-center {
  display: -webkit-box;
  max-width: 100%;
  margin-right: auto;
  margin-left: auto;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  word-break: break-word;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* RGB tag colors */
.permission-rgb-tag {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.22rem 0.58rem;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.permission-module-tag {
  border-color: rgba(var(--permission-module-rgb), 0.24);
  background: rgba(var(--permission-module-rgb), 0.12);
  color: rgb(var(--permission-module-rgb));
}

.permission-active-tag {
  border-color: rgba(var(--permission-active-rgb), 0.24);
  background: rgba(var(--permission-active-rgb), 0.12);
  color: rgb(var(--permission-active-rgb));
}

.permission-inactive-tag {
  border-color: rgba(var(--permission-inactive-rgb), 0.24);
  background: rgba(var(--permission-inactive-rgb), 0.12);
  color: rgb(var(--permission-inactive-rgb));
}

.dark .permission-module-tag {
  border-color: rgba(var(--permission-module-rgb), 0.36);
  background: rgba(var(--permission-module-rgb), 0.18);
}

.dark .permission-active-tag {
  border-color: rgba(var(--permission-active-rgb), 0.36);
  background: rgba(var(--permission-active-rgb), 0.18);
}

.dark .permission-inactive-tag {
  border-color: rgba(var(--permission-inactive-rgb), 0.36);
  background: rgba(var(--permission-inactive-rgb), 0.18);
}

@media (max-width: 768px) {
  .permission-filter-actions {
    justify-content: stretch;
  }

  .permission-filter-actions > * {
    flex: 1 1 100%;
  }
}

/* fixed 2 columns */
@media (min-width: 768px) {
  .permission-filter-bar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

/* fixed desktop layout */
@media (min-width: 1280px) {
  .permission-filter-bar {
    grid-template-columns:
      400px
      280px
      230px
      minmax(260px, 1fr);
  }

  .permission-filter-actions {
    grid-column: auto;
  }
}
</style>