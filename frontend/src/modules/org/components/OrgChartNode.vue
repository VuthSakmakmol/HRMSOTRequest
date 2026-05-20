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
  compact: {
    type: Boolean,
    default: true,
  },
})

const { t } = useI18n()

function s(value) {
  return String(value ?? '').trim()
}

function buildLabel(...parts) {
  return parts
    .map((part) => s(part))
    .filter(Boolean)
    .join(' - ')
}

const nodeKey = computed(() => s(props.node?.key || props.node?.data?.id))
const nodeData = computed(() => props.node?.data || {})
const children = computed(() =>
  Array.isArray(props.node?.children) ? props.node.children : [],
)

const hasChildren = computed(() => children.value.length > 0)
const hasManyChildren = computed(() => children.value.length > 1)

const isMatched = computed(() => {
  return props.matchedIds.includes(nodeKey.value) || !!nodeData.value.highlighted
})

const AUTO_EXPAND_MAX_DEPTH = 2

const initialExpanded = computed(() => {
  if (!hasChildren.value) return false

  // When search returns expanded path, keep it open.
  if (props.expandedIds.includes(nodeKey.value)) return true

  // Auto expand only 3 visible levels:
  // depth 0 = A open
  // depth 1 = B open
  // depth 2 = C visible but closed
  return props.depth < AUTO_EXPAND_MAX_DEPTH
})

const isOpen = ref(initialExpanded.value)

watch(initialExpanded, (value) => {
  isOpen.value = value
})

const employeeCode = computed(() =>
  s(nodeData.value.employeeCode || nodeData.value.employeeNo),
)

const displayName = computed(() =>
  s(nodeData.value.name || nodeData.value.displayName),
)

const positionTitle = computed(() =>
  s(nodeData.value.title || nodeData.value.positionName),
)

const lineText = computed(() => {
  return buildLabel(nodeData.value.lineCode, nodeData.value.lineName)
})

function toggleOpen() {
  if (!hasChildren.value) return
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="org-node-wrap">
    <div class="org-node-center">
      <div
        class="org-node-card"
        :class="[
          { 'org-node-card--matched': isMatched },
          compact ? 'org-node-card--compact' : '',
        ]"
      >
        <div class="org-node-content">
          <div
            class="org-node-name"
            :title="displayName || t('common.unknown')"
          >
            {{ displayName || t('common.unknown') }}
          </div>

          <div
            class="org-node-id"
            :title="employeeCode || t('org.orgChart.noEmployeeCode')"
          >
            {{ employeeCode || t('org.orgChart.noEmployeeCode') }}
          </div>

          <div
            class="org-node-position"
            :title="positionTitle || t('org.orgChart.noPosition')"
          >
            {{ positionTitle || t('org.orgChart.noPosition') }}
          </div>

          <div
            v-if="lineText"
            class="org-node-mini-line"
            :title="lineText"
          >
            <i class="pi pi-sitemap" />
            <span>{{ lineText }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="hasChildren"
        class="org-toggle-wrap"
      >
        <button
          type="button"
          class="org-toggle-btn"
          :aria-label="isOpen ? t('org.orgChart.collapseNode') : t('org.orgChart.expandNode')"
          @click="toggleOpen"
        >
          <span class="org-toggle-count">
            {{ children.length }}
          </span>

          <i :class="isOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
        </button>
      </div>
    </div>

    <template v-if="hasChildren && isOpen">
      <div class="org-line-down" />

      <div
        class="org-children-row"
        :class="{ 'org-children-row--single': !hasManyChildren }"
      >
        <div
          v-for="child in children"
          :key="child.key"
          class="org-child-col"
        >
          <div class="org-line-branch" />

          <OrgChartNode
            :node="child"
            :depth="depth + 1"
            :matched-ids="matchedIds"
            :expanded-ids="expandedIds"
            :compact="compact"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.org-node-wrap {
  --org-node-primary-rgb: 37, 99, 235;
  --org-node-card-rgb: 219, 234, 254;
  --org-node-card-soft-rgb: 239, 246, 255;
  --org-node-card-border-rgb: 147, 197, 253;
  --org-node-muted-rgb: 71, 85, 105;
  --org-node-text-rgb: 15, 23, 42;
  --org-node-line-rgb: 148, 163, 184;

  display: flex;
  min-width: max-content;
  flex-direction: column;
  align-items: center;
}

.org-node-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.org-node-card {
  width: 245px;
  min-height: 92px;
  border: 1px solid rgba(var(--org-node-card-border-rgb), 0.95);
  border-radius: 0.95rem;
  background:
    linear-gradient(
      180deg,
      rgba(var(--org-node-card-rgb), 0.78),
      rgba(var(--org-node-card-soft-rgb), 0.96)
    );
  box-shadow: var(--ot-shadow-sm);
  padding: 0.72rem 0.78rem;
  text-align: center;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.org-node-card--compact {
  width: 232px;
  min-height: 86px;
  padding: 0.68rem 0.74rem;
}

.org-node-card:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--org-node-primary-rgb), 0.38);
  box-shadow: var(--ot-shadow-md);
}

.org-node-card--matched {
  border-color: rgba(var(--org-node-primary-rgb), 0.62);
  background:
    linear-gradient(
      180deg,
      rgba(var(--org-node-primary-rgb), 0.18),
      rgba(var(--org-node-card-rgb), 0.92)
    );
  box-shadow: 0 0 0 1px rgba(var(--org-node-primary-rgb), 0.26);
}

.org-node-content {
  display: flex;
  min-width: 0;
  width: 100%;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.org-node-name {
  width: 100%;
  overflow: hidden;
  color: rgb(var(--org-node-text-rgb));
  font-size: 0.94rem;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-node-id {
  margin-top: 0.16rem;
  width: 100%;
  overflow: hidden;
  color: rgb(var(--org-node-muted-rgb));
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.18;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-node-position {
  margin-top: 0.3rem;
  width: 100%;
  overflow: hidden;
  color: rgb(var(--org-node-text-rgb));
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.22;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-node-mini-line {
  display: flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  margin-top: 0.3rem;
  color: rgb(var(--org-node-muted-rgb));
  font-size: 0.7rem;
  font-weight: 550;
  line-height: 1.18;
  text-align: center;
}

.org-node-mini-line i {
  flex: 0 0 auto;
  color: rgb(var(--org-node-muted-rgb));
  font-size: 0.66rem;
}

.org-node-mini-line span {
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-toggle-wrap {
  position: relative;
  margin-top: 0.42rem;
}

.org-toggle-btn {
  display: inline-flex;
  height: 1.6rem;
  min-width: 2.9rem;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  border: 1px solid rgba(var(--org-node-primary-rgb), 0.28);
  border-radius: 9999px;
  background: rgba(var(--org-node-primary-rgb), 0.11);
  color: rgb(var(--org-node-primary-rgb));
  box-shadow: var(--ot-shadow-sm);
  cursor: pointer;
  padding: 0 0.52rem;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.org-toggle-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--org-node-primary-rgb), 0.45);
  background: rgba(var(--org-node-primary-rgb), 0.16);
}

.org-toggle-btn i {
  font-size: 0.62rem;
}

.org-toggle-count {
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
}

.org-line-down {
  width: 2px;
  height: 0.85rem;
  background: rgba(var(--org-node-line-rgb), 0.65);
}

.org-children-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0.85rem;
  padding-top: 0.85rem;
}

.org-children-row::before {
  position: absolute;
  top: 0;
  right: 1.1rem;
  left: 1.1rem;
  height: 2px;
  background: rgba(var(--org-node-line-rgb), 0.65);
  content: '';
}

.org-children-row--single::before {
  display: none;
}

.org-child-col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.org-line-branch {
  width: 2px;
  height: 0.85rem;
  background: rgba(var(--org-node-line-rgb), 0.65);
}

:global(.dark) .org-node-wrap {
  --org-node-card-rgb: 30, 64, 175;
  --org-node-card-soft-rgb: 15, 23, 42;
  --org-node-card-border-rgb: 59, 130, 246;
  --org-node-text-rgb: 226, 232, 240;
  --org-node-muted-rgb: 203, 213, 225;
  --org-node-line-rgb: 71, 85, 105;
}

:global(.dark) .org-node-card {
  background:
    linear-gradient(
      180deg,
      rgba(var(--org-node-card-rgb), 0.34),
      rgba(var(--org-node-card-soft-rgb), 1)
    );
}

:global(.dark) .org-node-card--matched {
  background:
    linear-gradient(
      180deg,
      rgba(var(--org-node-primary-rgb), 0.34),
      rgba(var(--org-node-card-soft-rgb), 1)
    );
}

@media (max-width: 1024px) {
  .org-node-card {
    width: 232px;
  }

  .org-node-card--compact {
    width: 220px;
  }

  .org-children-row {
    gap: 0.7rem;
  }
}
</style>