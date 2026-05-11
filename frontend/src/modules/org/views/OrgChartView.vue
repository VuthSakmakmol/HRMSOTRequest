<!-- frontend/src/modules/org/views/OrgChartView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'

import OrgChartNode from '@/modules/org/components/OrgChartNode.vue'
import { getEmployeeOrgTree } from '@/modules/org/employee.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const SEARCH_DEBOUNCE_MS = 250

const loading = ref(false)
const searchKeyword = ref(String(route.query.search || '').trim())
const selectedRootEmployeeId = ref(String(route.query.rootEmployeeId || '').trim())
const includeInactive = ref(String(route.query.includeInactive || '').trim() === 'true')

const chartPayload = ref({
  rootEmployeeId: null,
  rootOptions: [],
  matchedEmployeeIds: [],
  expandedEmployeeIds: [],
  totalVisibleEmployees: 0,
  tree: [],
})

const zoom = ref(0.85)

let searchTimer = null

function s(value) {
  return String(value ?? '').trim()
}

function buildLabel(...parts) {
  return parts
    .map((part) => s(part))
    .filter(Boolean)
    .join(' - ')
}

function clampZoom(value) {
  return Math.max(0.5, Math.min(1.6, Number(value || 1)))
}

function zoomIn() {
  zoom.value = clampZoom(zoom.value + 0.1)
}

function zoomOut() {
  zoom.value = clampZoom(zoom.value - 0.1)
}

function resetZoom() {
  zoom.value = 0.85
}

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)

const canvasStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  transformOrigin: 'top center',
}))

const canvasOuterStyle = computed(() => ({
  minHeight: `${Math.max(420, Math.round(520 * zoom.value))}px`,
}))

function normalizeLineManagers(value) {
  if (!Array.isArray(value)) return []

  return value
    .map((manager) => ({
      id: s(manager?.id || manager?._id),
      employeeCode: s(manager?.employeeCode || manager?.employeeNo),
      displayName: s(manager?.displayName),
    }))
    .filter((manager) => manager.id || manager.employeeCode || manager.displayName)
}

function normalizeTreeNode(node) {
  if (!node) return null

  const data = node.data || {}
  const lineManagers = normalizeLineManagers(data.lineManagers)
  const employeeCode = s(data.employeeCode || data.employeeNo)

  return {
    key: s(node.key || data.id),
    expanded: !!node.expanded,
    data: {
      id: s(data.id),
      name: s(data.name || data.displayName || node.label || t('common.unknown')),
      displayName: s(data.displayName || data.name || node.label || t('common.unknown')),
      employeeCode,
      employeeNo: employeeCode, // compatibility alias only

      title: s(data.title || data.positionName || t('org.orgChart.noPosition')),
      positionName: s(data.positionName || data.title || ''),

      department: s(data.department || data.departmentName || t('org.orgChart.noDepartment')),
      departmentName: s(data.departmentName || data.department || ''),

      lineCode: s(data.lineCode),
      lineName: s(data.lineName),

      shiftCode: s(data.shiftCode),
      shiftName: s(data.shiftName),
      shiftType: s(data.shiftType),
      shiftStartTime: s(data.shiftStartTime),
      shiftEndTime: s(data.shiftEndTime),

      isActive: typeof data.isActive === 'boolean' ? data.isActive : false,
      reportsToEmployeeId: s(data.reportsToEmployeeId) || null,

      lineManagerIds: Array.isArray(data.lineManagerIds)
        ? data.lineManagerIds.map((id) => s(id)).filter(Boolean)
        : [],

      lineManagers,

      lineManagerNames: lineManagers
        .map((manager) => buildLabel(manager.employeeCode, manager.displayName))
        .filter(Boolean)
        .join(', '),

      highlighted: !!data.highlighted,
    },
    children: Array.isArray(node.children)
      ? node.children.map(normalizeTreeNode).filter(Boolean)
      : [],
  }
}

const treeNodes = computed(() => {
  const raw = Array.isArray(chartPayload.value?.tree) ? chartPayload.value.tree : []
  return raw.map(normalizeTreeNode).filter(Boolean)
})

const rootNode = computed(() => treeNodes.value[0] || null)

const rootOptions = computed(() => {
  const roots = Array.isArray(chartPayload.value?.rootOptions)
    ? chartPayload.value.rootOptions
    : []

  return roots.map((employee) => {
    const employeeCode = s(employee.employeeCode || employee.employeeNo)
    const displayName = s(employee.displayName || employee.name)
    const positionName = s(employee.positionName)

    return {
      label: [
        buildLabel(employeeCode, displayName) || t('common.unknown'),
        positionName ? `(${positionName})` : '',
      ]
        .filter(Boolean)
        .join(' '),
      value: s(employee.id || employee.employeeId),
    }
  })
})

const matchedEmployeeIds = computed(() => {
  return Array.isArray(chartPayload.value?.matchedEmployeeIds)
    ? chartPayload.value.matchedEmployeeIds
    : []
})

const expandedEmployeeIds = computed(() => {
  return Array.isArray(chartPayload.value?.expandedEmployeeIds)
    ? chartPayload.value.expandedEmployeeIds
    : []
})

const totalVisibleEmployees = computed(() => {
  return Number(chartPayload.value?.totalVisibleEmployees || 0)
})

const totalRoots = computed(() => {
  return Array.isArray(chartPayload.value?.rootOptions)
    ? chartPayload.value.rootOptions.length
    : 0
})

const searchResultCount = computed(() => matchedEmployeeIds.value.length)

const summaryItems = computed(() => [
  {
    label: t('org.orgChart.visibleEmployees'),
    value: totalVisibleEmployees.value,
  },
  {
    label: t('org.orgChart.searchResults'),
    value: searchResultCount.value,
  },
  {
    label: t('org.orgChart.rootOptions'),
    value: totalRoots.value,
  },
])

function syncRouteQuery() {
  const nextQuery = { ...route.query }

  if (s(selectedRootEmployeeId.value)) {
    nextQuery.rootEmployeeId = s(selectedRootEmployeeId.value)
  } else {
    delete nextQuery.rootEmployeeId
  }

  if (s(searchKeyword.value)) {
    nextQuery.search = s(searchKeyword.value)
  } else {
    delete nextQuery.search
  }

  if (includeInactive.value) {
    nextQuery.includeInactive = 'true'
  } else {
    delete nextQuery.includeInactive
  }

  router.replace({ query: nextQuery })
}

async function loadTree({ silent = false } = {}) {
  if (!silent) {
    loading.value = true
  }

  try {
    const response = await getEmployeeOrgTree({
      rootEmployeeId: s(selectedRootEmployeeId.value) || undefined,
      search: s(searchKeyword.value) || undefined,
      includeInactive: includeInactive.value ? 'true' : undefined,
    })

    const payload =
  response?.data?.data?.item ||
  response?.data?.item ||
  response?.data?.data ||
  response?.item ||
  response?.data ||
  response ||
  {}

    chartPayload.value = {
      rootEmployeeId: payload.rootEmployeeId || null,
      rootOptions: Array.isArray(payload.rootOptions) ? payload.rootOptions : [],
      matchedEmployeeIds: Array.isArray(payload.matchedEmployeeIds)
        ? payload.matchedEmployeeIds
        : [],
      expandedEmployeeIds: Array.isArray(payload.expandedEmployeeIds)
        ? payload.expandedEmployeeIds
        : [],
      totalVisibleEmployees: Number(payload.totalVisibleEmployees || 0),
      tree: Array.isArray(payload.tree) ? payload.tree : [],
    }

    if (!s(selectedRootEmployeeId.value) && s(chartPayload.value.rootEmployeeId)) {
      selectedRootEmployeeId.value = s(chartPayload.value.rootEmployeeId)
    }

    syncRouteQuery()
  } catch (error) {
    chartPayload.value = {
      rootEmployeeId: null,
      rootOptions: [],
      matchedEmployeeIds: [],
      expandedEmployeeIds: [],
      totalVisibleEmployees: 0,
      tree: [],
    }

    toast.add({
      severity: 'error',
      summary: t('common.loadFailed'),
      detail: getApiErrorMessage(error, t('org.orgChart.loadFailed')),
      life: 3500,
    })
  } finally {
    loading.value = false
  }
}

function onSearchInput() {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    loadTree({ silent: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onRootChange(value) {
  selectedRootEmployeeId.value = s(value)
  loadTree()
}

function onToggleInactive() {
  loadTree()
}

function refreshTree() {
  loadTree()
}

onMounted(() => {
  loadTree()
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell">
    <section class="ot-page-header">
      <div class="ot-page-header-main">
        <div class="ot-page-kicker">
          <i class="pi pi-sitemap" />
          {{ t('nav.organization') }}
        </div>

        <h1 class="ot-page-title">
          {{ t('org.orgChart.title') }}
        </h1>

        <p class="ot-page-subtitle">
          {{ t('org.orgChart.subtitle') }}
        </p>
      </div>

      <div class="ot-page-actions">
        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          outlined
          size="small"
          :loading="loading"
          @click="refreshTree"
        />
      </div>
    </section>

    <section class="ot-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="searchKeyword"
            :placeholder="t('org.orgChart.searchPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('org.orgChart.rootPerson') }}
        </label>

        <Select
          :model-value="selectedRootEmployeeId"
          :options="rootOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('org.orgChart.selectRootPerson')"
          class="w-full"
          size="small"
          filter
          show-clear
          @update:model-value="onRootChange"
        />
      </div>

      <div class="ot-filter-actions">
        <label class="flex h-[2.35rem] cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--ot-border)] px-3 text-sm text-[color:var(--ot-text)]">
          <Checkbox
            v-model="includeInactive"
            binary
            @change="onToggleInactive"
          />

          <span class="whitespace-nowrap">
            {{ t('org.orgChart.includeInactive') }}
          </span>
        </label>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-3 shadow-sm"
      >
        <div class="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
          {{ item.label }}
        </div>

        <div class="mt-1 text-2xl font-bold text-[color:var(--ot-text)]">
          {{ item.value }}
        </div>
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('org.orgChart.treeTitle') }}
          </h2>

          <p class="ot-table-subtitle">
            {{ t('org.orgChart.zoomLabel', { zoom: zoomPercent }) }}
          </p>
        </div>

        <div class="ot-table-actions">
          <Button
            icon="pi pi-search-minus"
            :label="t('org.orgChart.zoomOut')"
            outlined
            size="small"
            class="org-chart-control-btn"
            @click="zoomOut"
          />

          <Button
            icon="pi pi-refresh"
            :label="t('org.orgChart.resetZoom')"
            outlined
            size="small"
            class="org-chart-control-btn"
            @click="resetZoom"
          />

          <Button
            icon="pi pi-search-plus"
            :label="t('org.orgChart.zoomIn')"
            outlined
            size="small"
            class="org-chart-control-btn"
            @click="zoomIn"
          />
        </div>
      </div>

      <div class="p-4">
        <div v-if="loading">
          <Skeleton
            height="24rem"
            border-radius="1rem"
          />
        </div>

        <Message
          v-else-if="!rootNode"
          severity="secondary"
          :closable="false"
        >
          {{ t('org.orgChart.noTreeData') }}
        </Message>

        <div
          v-else
          class="overflow-auto rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] p-4"
        >
          <div
            class="org-chart-viewport"
            :style="canvasOuterStyle"
          >
            <div
              class="org-chart-canvas"
              :style="canvasStyle"
            >
              <OrgChartNode
                :node="rootNode"
                :matched-ids="matchedEmployeeIds"
                :expanded-ids="expandedEmployeeIds"
                :compact="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.org-chart-viewport {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-width: max-content;
  width: 100%;
}

.org-chart-canvas {
  min-width: max-content;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  transition: transform 0.18s ease;
}

:deep(.org-chart-control-btn.p-button) {
  white-space: nowrap !important;
}

@media (max-width: 640px) {
  :deep(.org-chart-control-btn .p-button-label) {
    display: none !important;
  }

  :deep(.org-chart-control-btn.p-button) {
    width: 2.25rem !important;
    padding-inline: 0 !important;
  }
}
</style>