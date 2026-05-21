<!-- frontend/src/modules/org/components/OrgChartNode.vue -->
<script setup>
// frontend/src/modules/org/components/OrgChartNode.vue

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'OrgChartNode' })

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  depth: {
    type: Number,
    default: 0,
  },
  matchedIds: {
    type: Array,
    default: () => [],
  },
  expandedIds: {
    type: Array,
    default: () => [],
  },
})

const { t } = useI18n()

const AUTO_EXPAND_MAX_DEPTH = 2

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function fallbackT(key, fallback) {
  const translated = t(key)
  return translated === key ? fallback : translated
}

const nodeKey = computed(() => s(props.node?.key || props.node?.data?.id))
const nodeData = computed(() => props.node?.data || {})

const children = computed(() =>
  Array.isArray(props.node?.children) ? props.node.children : [],
)

const hasChildren = computed(() => children.value.length > 0)

const isMatched = computed(() => {
  return props.matchedIds.includes(nodeKey.value) || !!nodeData.value.highlighted
})

const initialExpanded = computed(() => {
  if (!hasChildren.value) return false

  if (props.expandedIds.includes(nodeKey.value)) return true

  return props.depth < AUTO_EXPAND_MAX_DEPTH
})

const isOpen = ref(initialExpanded.value)

watch(initialExpanded, (value) => {
  isOpen.value = value
})

const displayName = computed(() =>
  s(nodeData.value.name || nodeData.value.displayName),
)

const positionTitle = computed(() =>
  s(nodeData.value.title || nodeData.value.positionName),
)

const lineLabel = computed(() => {
  const lineNames = Array.isArray(nodeData.value.lineNames)
    ? nodeData.value.lineNames.map((item) => s(item)).filter(Boolean)
    : []

  if (lineNames.length) {
    return [...new Set(lineNames)].join(', ')
  }

  const lines = Array.isArray(nodeData.value.lines) ? nodeData.value.lines : []

  if (lines.length) {
    return [
      ...new Set(
        lines
          .map((line) => s(line?.name))
          .filter(Boolean),
      ),
    ].join(', ')
  }

  return s(nodeData.value.lineName)
})

const workflowRole = computed(() => {
  const value = upper(nodeData.value.otWorkflowRole || nodeData.value.workflowRole)

  if (value === 'APPROVER' || value === 'APPROVE') {
    return {
      label: fallbackT('org.employee.otWorkflowRole.approver', 'Approver'),
      className: 'org-tree-role--approver',
    }
  }

  if (value === 'ACKNOWLEDGE' || value === 'ACKNOWLEDGER' || value === 'ACK') {
    return {
      label: fallbackT('org.employee.otWorkflowRole.acknowledge', 'Acknowledge'),
      className: 'org-tree-role--acknowledge',
    }
  }

  return {
    label: fallbackT('org.employee.otWorkflowRole.none', 'None'),
    className: 'org-tree-role--none',
  }
})

const nodeTitle = computed(() => {
  const name = displayName.value || fallbackT('common.unknown', 'Unknown')
  const position = positionTitle.value || fallbackT('org.orgChart.noPosition', 'No position')
  const line = lineLabel.value

  return [name, `(${position})`, `(${workflowRole.value.label})`, line ? `Line: ${line}` : '']
    .filter(Boolean)
    .join(' ')
})

function toggleOpen() {
  if (!hasChildren.value) return
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div
    class="org-tree-node"
    :class="[
      { 'org-tree-node--root': depth === 0 },
      { 'org-tree-node--matched': isMatched },
      { 'org-tree-node--leaf': !hasChildren },
    ]"
  >
    <div class="org-tree-row">
      <span class="org-tree-horizontal-line" />

      <button
        v-if="hasChildren"
        type="button"
        class="org-tree-toggle"
        :aria-label="isOpen ? fallbackT('org.orgChart.collapseNode', 'Collapse') : fallbackT('org.orgChart.expandNode', 'Expand')"
        @click="toggleOpen"
      >
        <i :class="isOpen ? 'pi pi-minus' : 'pi pi-plus'" />
      </button>

      <span
        v-else
        class="org-tree-dot"
      />

      <button
        type="button"
        class="org-tree-text"
        :title="nodeTitle"
        @click="toggleOpen"
      >
        <span class="org-tree-name">
          {{ displayName || fallbackT('common.unknown', 'Unknown') }}
        </span>

        <span class="org-tree-position">
          ({{ positionTitle || fallbackT('org.orgChart.noPosition', 'No position') }})
        </span>

        <span
          class="org-tree-role"
          :class="workflowRole.className"
        >
          ({{ workflowRole.label }})
        </span>

        <span
          v-if="lineLabel"
          class="org-tree-line-label"
        >
          [{{ lineLabel }}]
        </span>

        <span
          v-if="hasChildren"
          class="org-tree-count"
        >
          {{ children.length }}
        </span>
      </button>
    </div>

    <div
      v-if="hasChildren && isOpen"
      class="org-tree-children"
    >
      <OrgChartNode
        v-for="child in children"
        :key="child.key"
        :node="child"
        :depth="depth + 1"
        :matched-ids="matchedIds"
        :expanded-ids="expandedIds"
      />
    </div>
  </div>
</template>

<style scoped>
.org-tree-node {
  --org-tree-primary-rgb: 37, 99, 235;
  --org-tree-success-rgb: 22, 163, 74;
  --org-tree-warning-rgb: 245, 158, 11;
  --org-tree-muted-rgb: 100, 116, 139;
  --org-tree-line-rgb: 203, 213, 225;

  position: relative;
  min-width: max-content;
}

.org-tree-node + .org-tree-node {
  margin-top: 0.08rem;
}

.org-tree-row {
  position: relative;
  display: flex;
  min-width: max-content;
  min-height: 1.85rem;
  align-items: center;
}

.org-tree-horizontal-line {
  width: 1.05rem;
  height: 1px;
  flex: 0 0 1.05rem;
  background: rgba(var(--org-tree-line-rgb), 0.95);
}

.org-tree-node--root > .org-tree-row > .org-tree-horizontal-line {
  display: none;
}

.org-tree-toggle {
  display: inline-flex;
  width: 1.08rem;
  height: 1.08rem;
  flex: 0 0 1.08rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--org-tree-line-rgb), 1);
  border-radius: 0.2rem;
  background: var(--ot-surface);
  color: rgb(var(--org-tree-muted-rgb));
  cursor: pointer;
  padding: 0;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.org-tree-toggle:hover {
  border-color: rgba(var(--org-tree-primary-rgb), 0.55);
  background: rgba(var(--org-tree-primary-rgb), 0.06);
  color: rgb(var(--org-tree-primary-rgb));
}

.org-tree-toggle i {
  font-size: 0.56rem;
  font-weight: 700;
}

.org-tree-dot {
  display: inline-flex;
  width: 1.08rem;
  height: 1.08rem;
  flex: 0 0 1.08rem;
  align-items: center;
  justify-content: center;
}

.org-tree-dot::before {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 999px;
  background: rgba(var(--org-tree-line-rgb), 1);
  content: '';
}

.org-tree-text {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.28rem;
  border: 0;
  border-radius: 0.28rem;
  background: transparent;
  color: var(--ot-text);
  cursor: pointer;
  padding: 0.17rem 0.35rem;
  text-align: left;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.org-tree-text:hover {
  background: rgba(var(--org-tree-primary-rgb), 0.06);
}

.org-tree-node--root > .org-tree-row > .org-tree-text {
  font-weight: 750;
}

.org-tree-node--matched > .org-tree-row > .org-tree-text {
  background: rgba(var(--org-tree-primary-rgb), 0.1);
  color: rgb(var(--org-tree-primary-rgb));
  font-weight: 750;
}

.org-tree-name {
  color: var(--ot-text);
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.25;
}

.org-tree-position {
  color: var(--ot-text-muted);
  font-size: 0.78rem;
  font-weight: 560;
  line-height: 1.25;
}

.org-tree-role {
  font-size: 0.75rem;
  font-weight: 720;
  line-height: 1.25;
}

.org-tree-role--approver {
  color: rgb(var(--org-tree-success-rgb));
}

.org-tree-role--acknowledge {
  color: rgb(var(--org-tree-warning-rgb));
}

.org-tree-role--none {
  color: rgb(var(--org-tree-muted-rgb));
}

.org-tree-count {
  display: inline-flex;
  min-width: 1.15rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(var(--org-tree-primary-rgb), 0.08);
  color: rgb(var(--org-tree-primary-rgb));
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1;
  padding: 0 0.25rem;
}

.org-tree-children {
  position: relative;
  margin-left: 1.59rem;
  padding-left: 1.2rem;
}

.org-tree-children::before {
  position: absolute;
  top: -0.42rem;
  bottom: 0.94rem;
  left: 0;
  width: 1px;
  background: rgba(var(--org-tree-line-rgb), 0.95);
  content: '';
}

.org-tree-children > .org-tree-node {
  position: relative;
}

.org-tree-children > .org-tree-node::before {
  position: absolute;
  top: 0.92rem;
  left: -1.2rem;
  width: 1.2rem;
  height: 1px;
  background: rgba(var(--org-tree-line-rgb), 0.95);
  content: '';
}

.org-tree-children > .org-tree-node > .org-tree-row > .org-tree-horizontal-line {
  display: none;
}

:global(.dark) .org-tree-node {
  --org-tree-line-rgb: 71, 85, 105;
}

:global(.dark) .org-tree-toggle {
  background: var(--ot-surface-2);
}

:global(.dark) .org-tree-text:hover {
  background: rgba(var(--org-tree-primary-rgb), 0.14);
}

:global(.dark) .org-tree-node--matched > .org-tree-row > .org-tree-text {
  background: rgba(var(--org-tree-primary-rgb), 0.2);
}

@media (max-width: 640px) {
  .org-tree-name {
    font-size: 0.8rem;
  }

  .org-tree-position,
  .org-tree-role {
    font-size: 0.72rem;
  }

  .org-tree-children {
    margin-left: 1.38rem;
    padding-left: 0.95rem;
  }

  .org-tree-children > .org-tree-node::before {
    left: -0.95rem;
    width: 0.95rem;
  }
}
.org-tree-line-label {
  color: rgb(var(--org-tree-primary-rgb));
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1.25;
}
</style>