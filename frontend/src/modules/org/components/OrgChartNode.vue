<!-- frontend/src/modules/org/components/OrgChartNode.vue -->
<script setup>
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

function avatarText(name) {
  const value = s(name)

  if (!value) return 'NA'

  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
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
  if (props.expandedIds.includes(nodeKey.value)) return true
  if (props.node?.expanded === true) return true

  return props.depth < 1
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
        <div class="org-node-main">
          <div
            class="org-node-avatar"
            :class="{ 'org-node-avatar--matched': isMatched }"
          >
            {{ avatarText(displayName) }}
          </div>

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
              class="org-node-line"
              :title="lineText"
            >
              <i class="pi pi-sitemap" />
              <span>{{ lineText }}</span>
            </div>
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
          <i :class="isOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
        </button>
      </div>
    </div>

    <template v-if="hasChildren && isOpen">
      <div class="org-line-down" />

      <div class="org-children-row">
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
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: max-content;
}

.org-node-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.org-node-card {
  width: 280px;
  min-height: 112px;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  box-shadow: var(--ot-shadow-sm);
  padding: 0.85rem;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}

.org-node-card--compact {
  width: 255px;
  min-height: 104px;
  padding: 0.78rem;
}

.org-node-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ot-shadow-md);
}

.org-node-card--matched {
  border-color: var(--ot-primary);
  box-shadow: 0 0 0 1px var(--ot-primary);
}

.org-node-main {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 0.7rem;
}

.org-node-avatar {
  display: inline-flex;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #0ea5e9;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 800;
}

.org-node-avatar--matched {
  background: var(--ot-primary);
}

.org-node-content {
  min-width: 0;
  flex: 1;
}

.org-node-name {
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-node-id {
  margin-top: 0.18rem;
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-node-position {
  margin-top: 0.3rem;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-node-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  color: var(--ot-text-muted);
  font-size: 0.73rem;
  line-height: 1.2;
}

.org-node-line i {
  flex: 0 0 auto;
  font-size: 0.72rem;
}

.org-node-line span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-toggle-wrap {
  position: relative;
  margin-top: 0.45rem;
}

.org-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid var(--ot-border);
  border-radius: 9999px;
  background: var(--ot-surface);
  color: var(--ot-text-muted);
  box-shadow: var(--ot-shadow-sm);
  cursor: pointer;
}

.org-toggle-btn:hover {
  border-color: var(--ot-primary);
  color: var(--ot-text);
}

.org-line-down {
  width: 2px;
  height: 1rem;
  background: var(--ot-border);
}

.org-children-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 1.15rem;
  padding-top: 1rem;
}

.org-children-row::before {
  position: absolute;
  top: 0;
  right: 1.2rem;
  left: 1.2rem;
  height: 2px;
  background: var(--ot-border);
  content: '';
}

.org-child-col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.org-line-branch {
  width: 2px;
  height: 1rem;
  background: var(--ot-border);
}

@media (max-width: 1024px) {
  .org-node-card {
    width: 250px;
  }

  .org-node-card--compact {
    width: 230px;
  }

  .org-children-row {
    gap: 0.85rem;
  }
}
</style>