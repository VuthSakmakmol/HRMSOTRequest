<!-- frontend/src/modules/ot/components/OTApproverChainView.vue -->
<script setup>
// frontend/src/modules/ot/components/OTApproverChainView.vue

import { computed } from 'vue'

import Tag from 'primevue/tag'

const props = defineProps({
  loadingRequester: {
    type: Boolean,
    default: false,
  },
  loadingApproverChain: {
    type: Boolean,
    default: false,
  },
  requesterEmployeeId: {
    type: String,
    default: '',
  },
  requesterEmployee: {
    type: Object,
    default: null,
  },
  approverChain: {
    type: Array,
    default: () => [],
  },
  selectedApproverEmployeeIds: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['toggle'])

const selectableApproverChain = computed(() =>
  Array.isArray(props.approverChain) ? props.approverChain.slice(0, 4) : [],
)

const selectedApprovers = computed(() =>
  selectableApproverChain.value.filter((item) =>
    props.selectedApproverEmployeeIds.includes(item.employeeId),
  ),
)

const finalApprover = computed(() => {
  return selectedApprovers.value[selectedApprovers.value.length - 1] || null
})

function onApproverToggle(index, checked) {
  emit('toggle', { index, checked })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="text-sm font-medium text-[color:var(--ot-text)]">
          Approver Chain <span class="ot-required-star">*</span>
        </div>
      </div>

      <div class="p-4">
        <div
          v-if="loadingRequester || loadingApproverChain"
          class="rounded-xl border border-[color:var(--ot-border)] px-4 py-3 text-sm text-[color:var(--ot-text-muted)]"
        >
          Loading approver chain...
        </div>

        <div
          v-else-if="!requesterEmployeeId"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
        >
          Your employee profile could not be resolved, so approver chain cannot load yet.
        </div>

        <div
          v-else-if="!approverChain.length"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
        >
          No upward approver chain found for your account.
        </div>

        <template v-else>
          <div
            v-if="approverChain.length > 4"
            class="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"
          >
            Only the first 4 hierarchy levels can be selected for OT approval.
          </div>

          <div class="mb-3 rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-2,var(--ot-surface))] px-4 py-3">
            <div class="ot-soft-label">
              Request Owner
            </div>

            <div class="mt-1 text-sm font-medium text-[color:var(--ot-text)]">
              {{ requesterEmployee?.displayName || '-' }}
            </div>

            <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
              {{ requesterEmployee?.employeeNo || 'No employee number' }}
            </div>
          </div>

          <div class="space-y-3">
            <label
              v-for="(approver, index) in selectableApproverChain"
              :key="approver.employeeId"
              class="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--ot-border)] px-4 py-3 transition hover:bg-[color:var(--ot-surface-hover,rgba(0,0,0,0.02))]"
            >
              <input
                type="checkbox"
                class="mt-1 h-4 w-4 rounded border-surface-300 text-primary focus:ring-primary"
                :checked="selectedApproverEmployeeIds.includes(approver.employeeId)"
                @change="onApproverToggle(index, $event.target.checked)"
              />

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <Tag
                    :value="`Step ${index + 1}`"
                    severity="info"
                    class="ot-status-tag"
                  />

                  <span class="text-sm font-medium text-[color:var(--ot-text)]">
                    {{ approver.displayName }}
                  </span>
                </div>

                <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                  {{ approver.employeeNo || 'No employee number' }}
                </div>
              </div>
            </label>
          </div>
        </template>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="text-sm font-medium text-[color:var(--ot-text)]">
          Selected Route Preview
        </div>
      </div>

      <div class="p-4">
        <div
          v-if="selectedApprovers.length"
          class="space-y-2"
        >
          <div
            v-for="(approver, index) in selectedApprovers"
            :key="approver.employeeId"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <Tag
              :value="`Step ${index + 1}`"
              severity="success"
              class="ot-status-tag"
            />

            <span class="font-medium text-[color:var(--ot-text)]">
              {{ approver.displayName }}
            </span>

            <span class="text-[color:var(--ot-text-muted)]">
              {{ approver.employeeNo }}
            </span>
          </div>

          <div
            v-if="finalApprover"
            class="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary dark:border-primary/30 dark:bg-primary/10"
          >
            Final approver:
            <span class="font-medium">
              {{ finalApprover.displayName }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="text-sm text-[color:var(--ot-text-muted)]"
        >
          No approver selected yet.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ot-required-star {
  color: #ef4444;
  font-weight: 600;
}

.ot-soft-label {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

:deep(.p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>