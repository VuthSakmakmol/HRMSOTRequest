<!-- frontend/src/modules/org/views/OrgChartView.vue -->
<script setup>
// frontend/src/modules/org/views/OrgChartView.vue

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
const DEFAULT_ZOOM = 0.72

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

const zoom = ref(DEFAULT_ZOOM)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)

const panStart = ref({
  pointerId: null,
  clientX: 0,
  clientY: 0,
  panX: 0,
  panY: 0,
})

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
  return Math.max(0.45, Math.min(1.6, Number(value || DEFAULT_ZOOM)))
}

function zoomIn() {
  zoom.value = clampZoom(zoom.value + 0.08)
}

function zoomOut() {
  zoom.value = clampZoom(zoom.value - 0.08)
}

function resetView() {
  zoom.value = DEFAULT_ZOOM
  panX.value = 0
  panY.value = 0
}

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)

const canvasStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: 'top center',
}))

const canvasOuterStyle = computed(() => ({
  minHeight: `${Math.max(720, Math.round(960 * zoom.value))}px`,
  minWidth: '100%',
}))

function shouldIgnorePan(event) {
  const target = event?.target

  return !!target?.closest?.(
    'button, input, textarea, select, .p-button, .p-inputtext, .p-select, .p-checkbox, .p-dropdown, .org-toggle-btn, .org-chart-sticky-controls',
  )
}

function startPan(event) {
  if (event.button !== 0) return
  if (shouldIgnorePan(event)) return

  isPanning.value = true

  panStart.value = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    panX: panX.value,
    panY: panY.value,
  }

  event.currentTarget?.setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

function movePan(event) {
  if (!isPanning.value) return

  const deltaX = event.clientX - panStart.value.clientX
  const deltaY = event.clientY - panStart.value.clientY

  panX.value = panStart.value.panX + deltaX
  panY.value = panStart.value.panY + deltaY
}

function endPan(event) {
  if (!isPanning.value) return

  try {
    event.currentTarget?.releasePointerCapture?.(panStart.value.pointerId)
  } catch {
    // ignore release errors
  }

  isPanning.value = false
}

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
    expanded: true,
    data: {
      id: s(data.id),
      name: s(data.name || data.displayName || node.label || t('common.unknown')),
      displayName: s(data.displayName || data.name || node.label || t('common.unknown')),
      employeeCode,
      employeeNo: employeeCode,

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
  const ids = Array.isArray(chartPayload.value?.expandedEmployeeIds)
    ? chartPayload.value.expandedEmployeeIds
    : []

  return ids
})

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
  resetView()
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
  <div class="ot-page-shell org-chart-page">
    <section class="ot-filter-bar org-chart-filter-bar">
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

      <div class="org-chart-filter-actions">
        <label class="org-chart-check">
          <Checkbox
            v-model="includeInactive"
            binary
            @change="onToggleInactive"
          />

          <span>
            {{ t('org.orgChart.includeInactive') }}
          </span>
        </label>

        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="loading"
          @click="refreshTree"
        />
      </div>
    </section>

    <section class="ot-table-card org-chart-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('org.orgChart.treeTitle') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span class="ot-loaded-badge">
            {{ t('common.loaded', {
              loaded: chartPayload.totalVisibleEmployees || 0,
              total: chartPayload.totalVisibleEmployees || 0,
            }) }}
          </span>
        </div>
      </div>

      <div class="org-chart-body">
        <div v-if="loading">
          <Skeleton
            height="38rem"
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
          class="org-chart-frame"
          :class="{ 'org-chart-frame--panning': isPanning }"
          @pointerdown="startPan"
          @pointermove="movePan"
          @pointerup="endPan"
          @pointercancel="endPan"
        >
          <div class="org-chart-sticky-controls">
            <span class="org-chart-zoom-badge">
              {{ t('org.orgChart.zoomLabel', { zoom: zoomPercent }) }}
            </span>

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
              @click="resetView"
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
.org-chart-page {
  --org-primary-rgb: 37, 99, 235;
  --org-success-rgb: 22, 163, 74;
  --org-muted-rgb: 100, 116, 139;
}

.org-chart-filter-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
}

.org-chart-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: end;
  justify-content: flex-end;
  gap: 0.5rem;
}

.org-chart-filter-actions > * {
  flex: 0 0 auto;
}

.org-chart-check {
  display: inline-flex;
  height: 2.35rem;
  cursor: pointer;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0 0.75rem;
  color: var(--ot-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.org-chart-check span {
  white-space: nowrap;
}

.org-chart-card {
  overflow: hidden;
}

.org-chart-body {
  padding: 0.75rem;
}

.org-chart-frame {
  position: relative;
  min-height: 44rem;
  max-height: calc(100vh - 10rem);
  overflow: auto;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background:
    radial-gradient(circle at top left, rgba(var(--org-primary-rgb), 0.07), transparent 28rem),
    var(--ot-surface-2);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.org-chart-frame--panning {
  cursor: grabbing;
}

.org-chart-sticky-controls {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  border-bottom: 1px solid var(--ot-border);
  background: color-mix(in srgb, var(--ot-surface) 94%, transparent);
  padding: 0.55rem;
  backdrop-filter: blur(10px);
}

.org-chart-zoom-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  border: 1px solid rgba(var(--org-primary-rgb), 0.24);
  border-radius: 999px;
  background: rgba(var(--org-primary-rgb), 0.1);
  padding: 0 0.65rem;
  color: rgb(var(--org-primary-rgb));
  font-size: 0.72rem;
  font-weight: 750;
  white-space: nowrap;
}

.org-chart-viewport {
  display: flex;
  width: 100%;
  min-width: max-content;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem 1.75rem 2.5rem;
}

.org-chart-canvas {
  display: flex;
  min-width: max-content;
  align-items: flex-start;
  justify-content: center;
  transition: transform 0.12s ease;
  will-change: transform;
}

:deep(.org-chart-control-btn.p-button) {
  white-space: nowrap !important;
}

:global(.dark) .org-chart-frame {
  background:
    radial-gradient(circle at top left, rgba(var(--org-primary-rgb), 0.13), transparent 30rem),
    var(--ot-surface-2);
}

@media (max-width: 768px) {
  .org-chart-filter-actions {
    justify-content: stretch;
  }

  .org-chart-filter-actions > * {
    flex: 1 1 100%;
  }

  .org-chart-check {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .org-chart-frame {
    min-height: 34rem;
    max-height: calc(100vh - 12rem);
  }

  .org-chart-sticky-controls {
    justify-content: flex-start;
  }

  :deep(.org-chart-control-btn .p-button-label) {
    display: none !important;
  }

  :deep(.org-chart-control-btn.p-button) {
    width: 2.25rem !important;
    padding-inline: 0 !important;
  }
}

@media (min-width: 768px) {
  .org-chart-filter-bar {
    grid-template-columns:
      minmax(260px, 1fr)
      minmax(320px, 1.3fr);
  }
}

@media (min-width: 1280px) {
  .org-chart-filter-bar {
    grid-template-columns:
      minmax(340px, 1fr)
      minmax(420px, 1.2fr)
      minmax(300px, 0.8fr);
  }

  .org-chart-filter-actions {
    grid-column: auto;
  }
}
</style>