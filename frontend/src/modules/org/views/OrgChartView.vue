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

let searchTimer = null

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function buildLabel(...parts) {
  return parts
    .map((part) => s(part))
    .filter(Boolean)
    .join(' - ')
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

function normalizeWorkflowRole(data = {}) {
  // Backend source of truth:
  // Employee.otWorkflowRole enum = NONE / APPROVER / ACKNOWLEDGE
  const raw =
    data.otWorkflowRole ||
    data.workflowRole ||
    data.approvalRole ||
    data.approverRole ||
    data.approvalMode ||
    data.approverMode ||
    data.workflowMode ||
    data.workflowLabel ||
    data.approvalLabel ||
    data.roleType ||
    data.actionType ||
    ''

  const value = upper(raw)

  if (
    value === 'APPROVER' ||
    value === 'APPROVE' ||
    value.includes('APPROVER') ||
    value.includes('APPROVE') ||
    data.isApprover === true ||
    data.canApprove === true
  ) {
    return 'APPROVER'
  }

  if (
    value === 'ACKNOWLEDGE' ||
    value === 'ACKNOWLEDGER' ||
    value === 'ACK' ||
    value.includes('ACKNOWLEDGE') ||
    value.includes('ACKNOWLEDGER') ||
    value.includes('ACK') ||
    data.isAcknowledger === true ||
    data.canAcknowledge === true
  ) {
    return 'ACKNOWLEDGE'
  }

  return 'NONE'
}

function normalizeLines(data = {}) {
  const rawLines = Array.isArray(data.lines) ? data.lines : []

  const lines = rawLines
    .map((line) => ({
      id: s(line?.id || line?._id),
      code: s(line?.code),
      name: s(line?.name),
      label: s(line?.label) || buildLabel(line?.code, line?.name),
    }))
    .filter((line) => line.id || line.code || line.name || line.label)

  const fallbackLine = {
    id: s(data.lineId),
    code: s(data.lineCode),
    name: s(data.lineName),
    label: buildLabel(data.lineCode, data.lineName),
  }

  if (!lines.length && (fallbackLine.id || fallbackLine.code || fallbackLine.name)) {
    lines.push(fallbackLine)
  }

  const seen = new Set()

  return lines.filter((line) => {
    const key = line.id || line.code || line.label

    if (!key) return false
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function normalizeTreeNode(node) {
  if (!node) return null

  const data = node.data || {}
  const lineManagers = normalizeLineManagers(data.lineManagers)
  const employeeCode = s(data.employeeCode || data.employeeNo)
  const lines = normalizeLines(data)
  const workflowRole = normalizeWorkflowRole(data)

  return {
    key: s(node.key || data.id),
    expanded: false,
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

      lineId: s(data.lineId) || lines[0]?.id || null,
      lineCode: s(data.lineCode) || lines[0]?.code || '',
      lineName: s(data.lineName) || lines[0]?.name || '',
      lineIds: Array.isArray(data.lineIds)
        ? data.lineIds.map((lineId) => s(lineId)).filter(Boolean)
        : lines.map((line) => line.id).filter(Boolean),
      lines,
      lineCodes: Array.isArray(data.lineCodes)
        ? data.lineCodes.map((item) => s(item)).filter(Boolean)
        : lines.map((line) => line.code).filter(Boolean),
      lineNames: Array.isArray(data.lineNames)
        ? data.lineNames.map((item) => s(item)).filter(Boolean)
        : lines.map((line) => line.name).filter(Boolean),
      linesLabel:
        s(data.linesLabel) ||
        lines
          .map((line) => line.label || buildLabel(line.code, line.name))
          .filter(Boolean)
          .join(', '),

      shiftCode: s(data.shiftCode),
      shiftName: s(data.shiftName),
      shiftType: s(data.shiftType),
      shiftStartTime: s(data.shiftStartTime),
      shiftEndTime: s(data.shiftEndTime),

      isActive: typeof data.isActive === 'boolean' ? data.isActive : false,
      reportsToEmployeeId: s(data.reportsToEmployeeId) || null,

      otWorkflowRole: workflowRole,
      workflowRole,

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
    const role = normalizeWorkflowRole(employee)

    return {
      label: [
        buildLabel(employeeCode, displayName) || t('common.unknown'),
        positionName ? `(${positionName})` : '',
        role && role !== 'NONE' ? `[${role}]` : '',
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
            height="34rem"
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
          class="org-tree-panel"
        >
          <OrgChartNode
            :node="rootNode"
            :matched-ids="matchedEmployeeIds"
            :expanded-ids="expandedEmployeeIds"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.org-chart-page {
  --org-primary-rgb: 37, 99, 235;
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

.org-tree-panel {
  min-height: 34rem;
  max-height: calc(100vh - 10rem);
  overflow: auto;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface-2);
  padding: 0.9rem 0.95rem;
}

:global(.dark) .org-tree-panel {
  background: var(--ot-surface-2);
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

  .org-tree-panel {
    max-height: calc(100vh - 12rem);
    padding: 0.65rem;
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