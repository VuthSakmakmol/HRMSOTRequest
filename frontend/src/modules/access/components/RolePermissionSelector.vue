<!-- frontend/src/modules/access/components/RolePermissionSelector.vue -->
<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  options: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const keyword = ref('')

const selectedIds = computed(() => {
  return new Set(
    Array.isArray(props.modelValue)
      ? props.modelValue.map((item) => String(item))
      : [],
  )
})

const filteredOptions = computed(() => {
  const q = String(keyword.value || '').trim().toLowerCase()
  const rows = Array.isArray(props.options) ? props.options : []

  if (!q) return rows

  return rows.filter((item) => {
    const code = String(item?.code || '').toLowerCase()
    const name = String(item?.name || '').toLowerCase()
    const module = String(item?.module || '').toLowerCase()
    const description = String(item?.description || '').toLowerCase()

    return (
      code.includes(q) ||
      name.includes(q) ||
      module.includes(q) ||
      description.includes(q)
    )
  })
})

const groupedOptions = computed(() => {
  const map = new Map()

  for (const item of filteredOptions.value) {
    const moduleName = String(item?.module || 'GENERAL').trim() || 'GENERAL'

    if (!map.has(moduleName)) {
      map.set(moduleName, [])
    }

    map.get(moduleName).push(item)
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([module, items]) => ({
      module,
      items: [...items].sort((a, b) =>
        String(a?.code || '').localeCompare(String(b?.code || '')),
      ),
    }))
})

const selectedCount = computed(() => selectedIds.value.size)

function isChecked(id) {
  return selectedIds.value.has(String(id))
}

function togglePermission(id, checked) {
  const next = new Set(selectedIds.value)
  const value = String(id)

  if (checked) next.add(value)
  else next.delete(value)

  emit('update:modelValue', Array.from(next))
}

function selectModule(items) {
  const next = new Set(selectedIds.value)

  for (const item of items) {
    next.add(String(item.value))
  }

  emit('update:modelValue', Array.from(next))
}

function clearModule(items) {
  const next = new Set(selectedIds.value)

  for (const item of items) {
    next.delete(String(item.value))
  }

  emit('update:modelValue', Array.from(next))
}

function moduleSelectedCount(items) {
  return items.filter((item) => selectedIds.value.has(String(item.value))).length
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
      <IconField class="w-full">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="keyword"
          class="w-full"
          size="small"
          :placeholder="t('access.permission.searchPlaceholder')"
        />
      </IconField>

      <div class="flex items-center xl:justify-end">
        <Tag
          :value="t('access.role.selectedCount', { count: selectedCount })"
          severity="secondary"
        />
      </div>
    </div>

    <div
      v-if="loading"
      class="rounded-2xl border border-dashed border-[color:var(--ot-border)] px-4 py-5 text-sm text-[color:var(--ot-text-muted)]"
    >
      {{ t('access.permission.loading') }}
    </div>

    <div
      v-else-if="!groupedOptions.length"
      class="rounded-2xl border border-dashed border-[color:var(--ot-border)] px-4 py-5 text-sm text-[color:var(--ot-text-muted)]"
    >
      {{ t('access.permission.noData') }}
    </div>

    <div
      v-else
      class="grid grid-cols-1 gap-3 xl:grid-cols-2"
    >
      <div
        v-for="group in groupedOptions"
        :key="group.module"
        class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
      >
        <div class="flex items-start justify-between gap-3 border-b border-[color:var(--ot-border)] px-3 py-3">
          <div class="min-w-0">
            <div class="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
              {{ group.module }}
            </div>

            <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
              {{ t('access.role.moduleSelectedCount', {
                selected: moduleSelectedCount(group.items),
                total: group.items.length,
              }) }}
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <Button
              :label="t('common.selectAll')"
              text
              size="small"
              class="ot-compact-button"
              @click="selectModule(group.items)"
            />

            <Button
              :label="t('common.clear')"
              text
              severity="secondary"
              size="small"
              class="ot-compact-button"
              @click="clearModule(group.items)"
            />
          </div>
        </div>

        <div class="space-y-2 p-3">
          <label
            v-for="item in group.items"
            :key="item.value"
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--ot-border)] px-3 py-2.5 transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Checkbox
              :binary="true"
              :model-value="isChecked(item.value)"
              class="mt-0.5"
              @update:model-value="togglePermission(item.value, $event)"
            />

            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold text-[color:var(--ot-text)]">
                {{ item.code || '-' }}
              </div>

              <div class="mt-0.5 text-sm text-[color:var(--ot-text-muted)]">
                {{ item.name || '-' }}
              </div>

              <div
                v-if="item.description"
                class="ot-truncate-2 mt-1 text-xs text-[color:var(--ot-text-muted)]"
              >
                {{ item.description }}
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>