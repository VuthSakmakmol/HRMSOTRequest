<!-- frontend/src/modules/access/components/RolePermissionSummary.vue -->
<script setup>
import { computed } from 'vue'

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
})

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
  return items.slice(0, props.maxPerModule)
}

function hiddenCount(items) {
  return Math.max(0, items.length - props.maxPerModule)
}
</script>

<template>
  <div v-if="normalizedGroups.length" class="flex flex-col gap-2">
    <div
      v-for="group in normalizedGroups"
      :key="group.module"
      class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2.5"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div
          class="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]"
        >
          {{ group.module }}
        </div>

        <div class="shrink-0 text-xs text-[color:var(--ot-text-muted)]">
          {{ group.items.length }}
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <Tag
          v-for="item in visibleItems(group.items)"
          :key="item.id || item.code"
          :value="item.code || '-'"
          severity="info"
          class="ot-permission-tag"
        />
        <Tag
          v-if="hiddenCount(group.items)"
          :value="`+${hiddenCount(group.items)} more`"
          severity="secondary"
          class="ot-permission-tag"
        />
      </div>
    </div>
  </div>

  <span v-else class="text-sm text-[color:var(--ot-text-muted)]">-</span>
</template>

<style scoped>
:deep(.p-tag.ot-permission-tag) {
  min-height: 1.3rem !important;
  padding: 0.1rem 0.42rem !important;
  font-size: 0.68rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>