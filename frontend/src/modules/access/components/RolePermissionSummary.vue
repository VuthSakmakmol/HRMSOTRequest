<!-- frontend/src/modules/access/components/RolePermissionSummary.vue -->
<script setup>
// frontend/src/modules/access/components/RolePermissionSummary.vue

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Tag from 'primevue/tag'

const props = defineProps({
  groups: {
    type: Array,
    default: () => [],
  },
  maxPerModule: {
    type: Number,
    default: 4,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
})

const { t } = useI18n()

const normalizedGroups = computed(() => {
  if (!Array.isArray(props.groups)) return []

  return props.groups
    .map((group) => {
      const module = String(group?.module || 'GENERAL').trim() || 'GENERAL'
      const items = Array.isArray(group?.items) ? group.items : []

      return {
        module,
        items: items
          .map((item) => {
            const code = String(item?.code || '').trim()
            const name = cleanPermissionName(
              item?.name || item?.displayName || item?.label || '',
              code,
            )

            return {
              id: item?.id || item?.value || code || name || '',
              value: item?.value || item?.id || code || name || '',
              code,
              name,
            }
          })
          .filter((item) => item.name),
      }
    })
    .filter((group) => group.items.length)
})

function cleanPermissionName(value, code = '') {
  const text = String(value || '').trim()
  const codeText = String(code || '').trim()

  if (!text) return ''

  const separators = [' — ', ' - ', ': ']

  for (const separator of separators) {
    if (!text.includes(separator)) continue

    const [leftPart, ...rightParts] = text.split(separator)
    const left = String(leftPart || '').trim()
    const right = rightParts.join(separator).trim()

    if (!right) continue

    const leftLooksLikeCode = /^[A-Z0-9_]+$/.test(left)

    if (leftLooksLikeCode || (codeText && left === codeText)) {
      return right
    }
  }

  if (codeText && text.startsWith(codeText)) {
    return text.replace(codeText, '').replace(/^[-—:\s]+/, '').trim()
  }

  return text
}

function visibleItems(items) {
  if (props.expanded) return items
  return items.slice(0, props.maxPerModule)
}

function hiddenCount(items) {
  if (props.expanded) return 0
  return Math.max(0, items.length - props.maxPerModule)
}

function permissionLabel(item) {
  return String(item?.name || '').trim() || '-'
}
</script>

<template>
  <div
    v-if="normalizedGroups.length"
    class="role-permission-summary"
    :class="{ 'role-permission-summary-expanded': expanded }"
  >
    <div
      v-for="group in normalizedGroups"
      :key="group.module"
      class="role-permission-card"
    >
      <div class="role-permission-card-header">
        <div
          class="role-permission-module"
          :title="group.module"
        >
          {{ group.module }}
        </div>
      </div>

      <div class="role-permission-tag-list">
        <Tag
          v-for="item in visibleItems(group.items)"
          :key="item.id || item.value || item.name"
          :value="permissionLabel(item)"
          class="role-rgb-tag role-permission-tag"
          :title="permissionLabel(item)"
        />

        <Tag
          v-if="hiddenCount(group.items)"
          :value="t('access.role.morePermissions', { count: hiddenCount(group.items) })"
          class="role-rgb-tag role-more-tag"
        />
      </div>
    </div>
  </div>

  <span
    v-else
    class="role-permission-empty"
  >
    -
  </span>
</template>

<style scoped>
.role-permission-summary {
  --role-primary-rgb: 37, 99, 235;
  --role-more-rgb: 100, 116, 139;

  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.45rem;
}

.role-permission-summary-expanded {
  gap: 0.5rem;
}

.role-permission-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.55rem 0.65rem;
}

.role-permission-card-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.55rem;
  margin-bottom: 0.45rem;
}

.role-permission-module {
  min-width: 0;
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.66rem;
  font-weight: 650;
  letter-spacing: 0.11em;
  line-height: 1.1;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.role-permission-tag-list {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.35rem;
}

.role-rgb-tag {
  max-width: 100%;
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

.role-more-tag {
  border-color: rgba(var(--role-more-rgb), 0.24);
  background: rgba(var(--role-more-rgb), 0.1);
  color: rgb(var(--role-more-rgb));
}

.role-permission-empty {
  color: var(--ot-text-muted);
  font-size: 0.82rem;
}

.role-permission-summary :deep(.p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-permission-summary-expanded :deep(.role-permission-tag .p-tag-value) {
  white-space: normal;
}

:global(.dark) .role-permission-tag {
  border-color: rgba(var(--role-primary-rgb), 0.36);
  background: rgba(var(--role-primary-rgb), 0.18);
}

:global(.dark) .role-more-tag {
  border-color: rgba(var(--role-more-rgb), 0.36);
  background: rgba(var(--role-more-rgb), 0.16);
}

@media (min-width: 1024px) {
  .role-permission-summary-expanded {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>