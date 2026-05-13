<!-- frontend/src/modules/access/components/RolePermissionSelector.vue -->
<script setup>
// frontend/src/modules/access/components/RolePermissionSelector.vue

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
        String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || '')),
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

function permissionName(item) {
  return String(item?.name || '').trim() || '-'
}
</script>

<template>
  <div class="role-permission-selector">
    <div class="role-permission-selector-filter">
      <IconField class="role-permission-search">
        <InputIcon class="pi pi-search" />

        <InputText
          v-model="keyword"
          class="w-full"
          size="small"
          :placeholder="t('access.permission.searchPlaceholder')"
        />
      </IconField>

      <Tag
        :value="t('access.role.selectedCount', { count: selectedCount })"
        class="role-rgb-tag role-count-tag"
      />
    </div>

    <div
      v-if="loading"
      class="role-permission-state"
    >
      <i class="pi pi-spin pi-spinner" />
      <span>{{ t('access.permission.loading') }}</span>
    </div>

    <div
      v-else-if="!groupedOptions.length"
      class="role-permission-state"
    >
      <i class="pi pi-inbox" />
      <span>{{ t('access.permission.noData') }}</span>
    </div>

    <div
      v-else
      class="role-permission-selector-grid"
    >
      <div
        v-for="group in groupedOptions"
        :key="group.module"
        class="role-permission-card"
      >
        <div class="role-permission-card-header">
          <div class="role-permission-card-title-wrap">
            <div
              class="role-permission-module"
              :title="group.module"
            >
              {{ group.module }}
            </div>

            <div class="role-permission-module-subtitle">
              {{
                t('access.role.moduleSelectedCount', {
                  selected: moduleSelectedCount(group.items),
                  total: group.items.length,
                })
              }}
            </div>
          </div>

          <div class="role-permission-card-actions">
            <Button
              :label="t('common.selectAll')"
              text
              size="small"
              class="role-mini-button"
              @click="selectModule(group.items)"
            />

            <Button
              :label="t('common.clear')"
              text
              severity="secondary"
              size="small"
              class="role-mini-button"
              @click="clearModule(group.items)"
            />
          </div>
        </div>

        <div class="role-permission-option-list">
          <label
            v-for="item in group.items"
            :key="item.value"
            class="role-permission-option"
            :class="{ 'role-permission-option-selected': isChecked(item.value) }"
          >
            <Checkbox
              :binary="true"
              :model-value="isChecked(item.value)"
              class="role-permission-checkbox"
              @update:model-value="togglePermission(item.value, $event)"
            />

            <div class="role-permission-option-content">
              <div
                class="role-permission-option-name"
                :title="permissionName(item)"
              >
                {{ permissionName(item) }}
              </div>

              <div
                v-if="item.description"
                class="role-permission-option-description"
                :title="item.description"
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

<style scoped>
.role-permission-selector {
  --role-primary-rgb: 37, 99, 235;
  --role-count-rgb: 15, 118, 110;
  --role-selected-rgb: 37, 99, 235;

  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.role-permission-selector-filter {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
}

.role-permission-search {
  width: 100%;
  min-width: 0;
}

.role-rgb-tag {
  width: fit-content;
  max-width: 100%;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.2rem 0.56rem;
  font-size: 0.7rem;
  font-weight: 650;
  line-height: 1;
}

.role-count-tag {
  justify-self: start;
  border-color: rgba(var(--role-count-rgb), 0.24);
  background: rgba(var(--role-count-rgb), 0.1);
  color: rgb(var(--role-count-rgb));
}

.role-permission-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 4.5rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-surface-2);
  padding: 1rem;
  color: var(--ot-text-muted);
  font-size: 0.82rem;
}

.role-permission-selector-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
}

.role-permission-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-surface);
}

.role-permission-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-border);
  background: var(--ot-surface-2);
  padding: 0.6rem 0.7rem;
}

.role-permission-card-title-wrap {
  min-width: 0;
}

.role-permission-module {
  min-width: 0;
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 650;
  letter-spacing: 0.11em;
  line-height: 1.1;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.role-permission-module-subtitle {
  margin-top: 0.25rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  line-height: 1.2;
}

.role-permission-card-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.role-mini-button {
  min-width: auto;
  padding-inline: 0.45rem;
  font-size: 0.72rem;
}

.role-permission-option-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.42rem;
  padding: 0.6rem;
}

.role-permission-option {
  display: flex;
  min-width: 0;
  cursor: pointer;
  align-items: flex-start;
  gap: 0.55rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
  padding: 0.52rem 0.58rem;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.role-permission-option:hover {
  border-color: rgba(var(--role-primary-rgb), 0.26);
  background: rgba(var(--role-primary-rgb), 0.05);
}

.role-permission-option-selected {
  border-color: rgba(var(--role-selected-rgb), 0.32);
  background: rgba(var(--role-selected-rgb), 0.08);
}

.role-permission-checkbox {
  margin-top: 0.16rem;
  flex: 0 0 auto;
}

.role-permission-option-content {
  min-width: 0;
  flex: 1 1 auto;
}

.role-permission-option-name {
  min-width: 0;
  overflow: hidden;
  color: rgb(var(--role-primary-rgb));
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-permission-option-description {
  display: -webkit-box;
  margin-top: 0.18rem;
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.role-permission-selector :deep(.p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-permission-selector :deep(.p-checkbox-box) {
  width: 1rem;
  height: 1rem;
  border-radius: 0.3rem;
}

.role-permission-selector :deep(.p-checkbox-icon) {
  font-size: 0.66rem;
}

:global(.dark) .role-count-tag {
  border-color: rgba(var(--role-count-rgb), 0.36);
  background: rgba(var(--role-count-rgb), 0.16);
}

:global(.dark) .role-permission-option:hover {
  border-color: rgba(var(--role-primary-rgb), 0.38);
  background: rgba(var(--role-primary-rgb), 0.12);
}

:global(.dark) .role-permission-option-selected {
  border-color: rgba(var(--role-selected-rgb), 0.42);
  background: rgba(var(--role-selected-rgb), 0.16);
}

@media (min-width: 768px) {
  .role-permission-selector-filter {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .role-count-tag {
    justify-self: end;
  }
}

@media (min-width: 1280px) {
  .role-permission-selector-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>