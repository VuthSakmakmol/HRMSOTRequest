<!-- frontend/src/modules/org/views/OrgChartView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'

import OrgChartNode from '../components/OrgChartNode.vue'
import { getEmployeeOrgTree } from '../employee.api'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
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

function s(v) {
  return String(v ?? '').trim()
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

function normalizeTreeNode(node) {
  if (!node) return null

  const data = node.data || {}

  return {
    key: s(node.key || data.id),
    expanded: !!node.expanded,
    data: {
      id: s(data.id),
      name: s(data.name || node.label || 'Unknown'),
      employeeNo: s(data.employeeNo),
      title: s(data.title || 'No position'),
      department: s(data.department || 'No department'),
      shiftCode: s(data.shiftCode),
      shiftName: s(data.shiftName),
      shiftType: s(data.shiftType),
      isActive: typeof data.isActive === 'boolean' ? data.isActive : false,
      reportsToEmployeeId: s(data.reportsToEmployeeId) || null,
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
  const roots = Array.isArray(chartPayload.value?.rootOptions) ? chartPayload.value.rootOptions : []

  return roots.map((emp) => ({
    label: `${emp.employeeNo || '-'} - ${emp.displayName || 'Unknown'}${emp.positionName ? ` (${emp.positionName})` : ''}`,
    value: s(emp.id),
  }))
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

const summaryItems = computed(() => [
  { label: 'Visible Employees', value: totalVisibleEmployees.value },
  { label: 'Matched', value: matchedEmployeeIds.value.length },
  { label: 'Roots', value: totalRoots.value },
])

function syncRouteQuery() {
  const nextQuery = { ...route.query }

  if (s(selectedRootEmployeeId.value)) nextQuery.rootEmployeeId = s(selectedRootEmployeeId.value)
  else delete nextQuery.rootEmployeeId

  if (s(searchKeyword.value)) nextQuery.search = s(searchKeyword.value)
  else delete nextQuery.search

  if (includeInactive.value) nextQuery.includeInactive = 'true'
  else delete nextQuery.includeInactive

  router.replace({ query: nextQuery })
}

async function loadTree() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getEmployeeOrgTree({
      rootEmployeeId: s(selectedRootEmployeeId.value) || undefined,
      search: s(searchKeyword.value) || undefined,
      includeInactive: includeInactive.value ? 'true' : undefined,
    })

    chartPayload.value = response?.data?.data || {
      rootEmployeeId: null,
      rootOptions: [],
      matchedEmployeeIds: [],
      expandedEmployeeIds: [],
      totalVisibleEmployees: 0,
      tree: [],
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

    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to load organization tree'
  } finally {
    loading.value = false
  }
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)

  searchTimer = setTimeout(() => {
    loadTree()
  }, 250)
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

function onSelectRoot(id) {
  const nextId = s(id)
  if (!nextId) return
  selectedRootEmployeeId.value = nextId
  loadTree()
}

onMounted(() => {
  loadTree()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          Organization Tree
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          View the organization from the top person by default, search employees, and re-root the chart by clicking Set as root.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          v-for="item in summaryItems"
          :key="item.label"
          class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            {{ item.label }}
          </div>
          <div class="mt-1 text-lg font-semibold text-[color:var(--ot-text)]">
            {{ item.value }}
          </div>
        </div>

        <Button
          label="Refresh"
          icon="pi pi-refresh"
          outlined
          size="small"
          :loading="loading"
          @click="refreshTree"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="px-3 py-3">
        <div class="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(240px,1.2fr)_minmax(320px,1.1fr)_auto_auto]">
          <IconField class="w-full">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="searchKeyword"
              placeholder="Search by employee no, name, department, or position"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <Select
            :modelValue="selectedRootEmployeeId"
            :options="rootOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select top/root person"
            class="w-full"
            size="small"
            filter
            @update:modelValue="onRootChange"
          />

          <div class="flex items-center gap-2 rounded-xl border border-[color:var(--ot-border)] px-3 py-2">
            <Checkbox
              inputId="includeInactive"
              v-model="includeInactive"
              binary
              @change="onToggleInactive"
            />
            <label
              for="includeInactive"
              class="cursor-pointer text-sm text-[color:var(--ot-text)]"
            >
              Include inactive
            </label>
          </div>

          <div class="flex items-center gap-2 xl:justify-end">
            <Tag
              :value="selectedRootEmployeeId ? 'Top selected' : 'No root selected'"
              severity="contrast"
            />
          </div>
        </div>
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">
      {{ errorMessage }}
    </Message>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-sm font-semibold text-[color:var(--ot-text)]">
              Organization Chart
            </h2>
            <p class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
              Smaller org cards with zoom controls and connector lines.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Tag :value="`Expanded Path Nodes: ${expandedEmployeeIds.length}`" severity="info" />
            <Tag :value="`Matches: ${matchedEmployeeIds.length}`" severity="success" />
            <Tag :value="`Zoom: ${zoomPercent}`" severity="contrast" />

            <Button
              icon="pi pi-search-minus"
              outlined
              size="small"
              @click="zoomOut"
            />
            <Button
              icon="pi pi-refresh"
              outlined
              size="small"
              @click="resetZoom"
            />
            <Button
              icon="pi pi-search-plus"
              outlined
              size="small"
              @click="zoomIn"
            />
          </div>
        </div>
      </div>

      <div class="p-4">
        <div v-if="loading">
          <Skeleton height="24rem" borderRadius="1rem" />
        </div>

        <Message v-else-if="!rootNode" severity="secondary" :closable="false">
          No tree data available.
        </Message>

        <div
          v-else
          class="overflow-auto rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] p-4"
        >
          <div class="org-chart-viewport" :style="canvasOuterStyle">
            <div class="org-chart-canvas" :style="canvasStyle">
              <OrgChartNode
                :node="rootNode"
                :matched-ids="matchedEmployeeIds"
                :expanded-ids="expandedEmployeeIds"
                :compact="true"
                @select-root="onSelectRoot"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
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
</style>