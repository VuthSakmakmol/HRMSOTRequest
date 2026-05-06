<!-- frontend/src/modules/org/components/OrgChartNode.vue -->
<script setup>
// frontend/src/modules/org/components/OrgChartNode.vue

defineOptions({ name: 'OrgChartNode' })

import { computed, ref, watch } from 'vue'
import Tag from 'primevue/tag'

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

function s(v) {
  return String(v ?? '').trim()
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

function managerName(manager) {
  return [s(manager?.employeeNo), s(manager?.displayName)]
    .filter(Boolean)
    .join(' - ')
}

const nodeKey = computed(() => s(props.node?.key || props.node?.data?.id))
const nodeData = computed(() => props.node?.data || {})
const children = computed(() => (Array.isArray(props.node?.children) ? props.node.children : []))
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

const lineManagers = computed(() => {
  return Array.isArray(nodeData.value.lineManagers) ? nodeData.value.lineManagers : []
})

const lineManagerText = computed(() => {
  return lineManagers.value
    .map(managerName)
    .filter(Boolean)
    .join(', ')
})

const lineText = computed(() => {
  const code = s(nodeData.value.lineCode)
  const name = s(nodeData.value.lineName)
  return [code, name].filter(Boolean).join(' • ')
})

const shiftText = computed(() => {
  const code = s(nodeData.value.shiftCode)
  const name = s(nodeData.value.shiftName)
  const type = s(nodeData.value.shiftType)

  const parts = [code, name, type].filter(Boolean)
  return parts.join(' • ')
})

const lineManagerCount = computed(() => lineManagers.value.length)

const lineManagerTagLabel = computed(() => {
  if (!lineManagerCount.value) return ''
  if (lineManagerCount.value === 1) return '1 Line Sup'
  return `${lineManagerCount.value} Line Sup`
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
        <div class="flex items-start gap-3">
          <div
            class="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
            :class="[
              isMatched ? 'bg-[color:var(--ot-primary)]' : 'bg-sky-500',
              compact ? 'h-10 w-10 text-sm' : 'h-14 w-14 text-base',
            ]"
          >
            {{ avatarText(nodeData.name) }}
          </div>

          <div class="min-w-0 flex-1">
            <div
              class="truncate font-bold text-[color:var(--ot-text)]"
              :class="compact ? 'text-base' : 'text-xl'"
              :title="nodeData.name || 'Unknown'"
            >
              {{ nodeData.name || 'Unknown' }}
            </div>

            <div
              class="truncate text-[color:var(--ot-text-soft)]"
              :class="compact ? 'text-sm' : 'text-lg'"
              :title="nodeData.title || 'No position'"
            >
              {{ nodeData.title || 'No position' }}
            </div>

            <div
              class="mt-1 truncate text-xs text-[color:var(--ot-text-muted)]"
              :title="nodeData.department || 'No department'"
            >
              {{ nodeData.department || 'No department' }}
            </div>

            <div
              v-if="lineText"
              class="org-node-meta"
              :title="lineText"
            >
              <i class="pi pi-sitemap" />
              <span>{{ lineText }}</span>
            </div>

            <div
              v-if="shiftText"
              class="org-node-meta"
              :title="shiftText"
            >
              <i class="pi pi-clock" />
              <span>{{ shiftText }}</span>
            </div>

            <div
              v-if="lineManagerText"
              class="org-line-managers"
              :title="lineManagerText"
            >
              <i class="pi pi-users" />
              <span>
                {{ lineManagerText }}
              </span>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-2">
              <Tag
                :value="nodeData.employeeNo || 'No ID'"
                severity="contrast"
                class="org-node-tag"
              />

              <Tag
                :value="nodeData.isActive ? 'Active' : 'Inactive'"
                :severity="nodeData.isActive ? 'success' : 'secondary'"
                class="org-node-tag"
              />

              <Tag
                v-if="lineManagerCount"
                :value="lineManagerTagLabel"
                severity="info"
                class="org-node-tag"
              />

              <Tag
                v-if="lineManagerCount > 1"
                value="Multi Sup"
                severity="warning"
                class="org-node-tag"
              />

              <Tag
                v-if="isMatched"
                value="Matched"
                severity="warning"
                class="org-node-tag"
              />
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
  width: 300px;
  min-height: 142px;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  box-shadow: var(--ot-shadow-sm);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}

.org-node-card--compact {
  width: 270px;
  min-height: 136px;
  padding: 0.85rem;
}

.org-node-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ot-shadow-md);
}

.org-node-card--matched {
  border-color: var(--ot-primary);
  box-shadow: 0 0 0 1px var(--ot-primary);
}

.org-node-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  min-width: 0;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  line-height: 1.15;
}

.org-node-meta i {
  flex: 0 0 auto;
  font-size: 0.7rem;
}

.org-node-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-line-managers {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-top: 0.4rem;
  min-width: 0;
  border-radius: 0.7rem;
  border: 1px solid color-mix(in srgb, #38bdf8 28%, var(--ot-border));
  background: color-mix(in srgb, #38bdf8 8%, var(--ot-surface));
  padding: 0.35rem 0.5rem;
  color: var(--ot-text);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
}

.org-line-managers i {
  flex: 0 0 auto;
  margin-top: 0.08rem;
  color: #0284c7;
  font-size: 0.72rem;
}

.org-line-managers span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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
  border-radius: 9999px;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  color: var(--ot-text-muted);
  box-shadow: var(--ot-shadow-sm);
  cursor: pointer;
}

.org-toggle-btn:hover {
  color: var(--ot-text);
  border-color: var(--ot-primary);
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
  content: '';
  position: absolute;
  top: 0;
  left: 1.2rem;
  right: 1.2rem;
  height: 2px;
  background: var(--ot-border);
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

:deep(.p-tag.org-node-tag) {
  min-height: 1.25rem !important;
  padding: 0.1rem 0.4rem !important;
  font-size: 0.66rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

@media (max-width: 1024px) {
  .org-node-card {
    width: 260px;
  }

  .org-node-card--compact {
    width: 240px;
  }

  .org-children-row {
    gap: 0.85rem;
  }
}
</style>