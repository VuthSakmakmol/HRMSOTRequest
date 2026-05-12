<!-- frontend/src/modules/access/components/RolePermissionSummary.vue -->
<script setup>
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
  return Array.isArray(props.groups)
    ? props.groups
        .map((group) => ({
          module: String(group?.module || 'GENERAL').trim() || 'GENERAL',
          items: Array.isArray(group?.items) ? group.items : [],
        }))
        .filter((group) => group.items.length)
    : []
})

function visibleItems(items) {
  if (props.expanded) return items
  return items.slice(0, props.maxPerModule)
}

function hiddenCount(items) {
  if (props.expanded) return 0
  return Math.max(0, items.length - props.maxPerModule)
}

function permissionLabel(item) {
  const code = String(item?.code || '').trim()
  const name = String(item?.name || '').trim()

  if (props.expanded && code && name) return `${code} — ${name}`
  return code || name || '-'
}
</script>

<template>
  <div
    v-if="normalizedGroups.length"
    class="flex flex-col gap-2"
  >
    <div
      v-for="group in normalizedGroups"
      :key="group.module"
      class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2)] px-3 py-2.5"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
          {{ group.module }}
        </div>

        <div class="shrink-0 text-xs font-bold text-[color:var(--ot-text-muted)]">
          {{ group.items.length }}
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <Tag
          v-for="item in visibleItems(group.items)"
          :key="item.id || item.value || item.code"
          :value="permissionLabel(item)"
          severity="info"
        />

        <Tag
          v-if="hiddenCount(group.items)"
          :value="t('access.role.morePermissions', { count: hiddenCount(group.items) })"
          severity="secondary"
        />
      </div>
    </div>
  </div>

  <span
    v-else
    class="text-sm text-[color:var(--ot-text-muted)]"
  >
    -
  </span>
</template>