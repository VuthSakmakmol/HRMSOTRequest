<!-- frontend/src/modules/ot/views/OTExecutionSettingsView.vue -->
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import InputSwitch from 'primevue/inputswitch'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import {
  getOTExecutionSettings,
  updateOTExecutionSettings,
} from '@/modules/ot/otMaster.api'

const toast = useToast()
const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const loadedSettings = ref(null)

const form = reactive({
  requestSubmissionOpen: true,
  requestDailyTimeLimitEnabled: false,
  requestDailyStartTime: '',
  requestDailyEndTime: '',
  // Applies only when a user creates a new OT request for a past date.
  allowBackdatedRequests: true,
  paymentRequiresFinalApproval: false,
})

const canView = computed(() => hasPermission('OT_EXECUTION_VIEW'))
const canUpdate = computed(() => hasPermission('OT_EXECUTION_UPDATE'))

const requestStatus = computed(() => loadedSettings.value?.requestAccess || null)
const requestStatusLabel = computed(() => {
  const state = requestStatus.value
  if (!state) return 'Loading status'
  return state.isAllowed ? 'Open now' : 'Closed now'
})

const requestStatusClass = computed(() =>
  requestStatus.value?.isAllowed ? 'ot-execution-tag-open' : 'ot-execution-tag-closed',
)

const paymentModeLabel = computed(() =>
  form.paymentRequiresFinalApproval
    ? 'Final approval required'
    : 'Payment without approval allowed',
)

const currentDailyHoursLabel = computed(() => {
  const state = requestStatus.value
  if (!state?.dailyTimeLimitEnabled) return ''

  const start = state.dailyStartTime || '—'
  const end = state.dailyEndTime || '—'
  const zone = state.requestTimeZone || 'Asia/Phnom_Penh'

  return `${start} → ${end} daily (${zone})`
})

const saveDisabled = computed(() => {
  if (!canUpdate.value || saving.value || loading.value) return true

  if (form.requestDailyTimeLimitEnabled) {
    if (!form.requestDailyStartTime || !form.requestDailyEndTime) return true
    if (form.requestDailyStartTime === form.requestDailyEndTime) return true
  }

  return false
})

function hasPermission(code) {
  return (
    auth.user?.isRootAdmin ||
    auth.isRootAdmin ||
    auth.hasPermission?.(code) ||
    auth.hasAnyPermission?.([code])
  )
}

function normalizePayload(response) {
  return response?.data?.data || response?.data || {}
}

function normalizeTime(value) {
  const time = String(value || '').trim()
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : ''
}

function applyItem(item = {}) {
  loadedSettings.value = item

  form.requestSubmissionOpen = item.requestSubmissionOpen !== false
  form.requestDailyTimeLimitEnabled = item.requestDailyTimeLimitEnabled === true
  form.requestDailyStartTime = normalizeTime(item.requestDailyStartTime)
  form.requestDailyEndTime = normalizeTime(item.requestDailyEndTime)
  form.allowBackdatedRequests = item.allowBackdatedRequests !== false
  form.paymentRequiresFinalApproval = item.paymentRequiresFinalApproval === true
}

async function loadSettings({ silent = false } = {}) {
  if (!canView.value) return

  loading.value = true

  try {
    const response = await getOTExecutionSettings()
    applyItem(normalizePayload(response)?.item || {})
  } catch (error) {
    if (!silent) {
      toast.add({
        severity: 'error',
        summary: 'Load failed',
        detail: getApiErrorMessage(error, 'Failed to load OT execution controls.'),
        life: 4000,
      })
    }
  } finally {
    loading.value = false
  }
}

function buildPayload() {
  return {
    requestSubmissionOpen: form.requestSubmissionOpen === true,
    requestDailyTimeLimitEnabled: form.requestDailyTimeLimitEnabled === true,
    requestDailyStartTime: form.requestDailyTimeLimitEnabled
      ? normalizeTime(form.requestDailyStartTime) || null
      : null,
    requestDailyEndTime: form.requestDailyTimeLimitEnabled
      ? normalizeTime(form.requestDailyEndTime) || null
      : null,
    allowBackdatedRequests: form.allowBackdatedRequests === true,
    paymentRequiresFinalApproval: form.paymentRequiresFinalApproval === true,
  }
}

async function saveControls() {
  if (saveDisabled.value) return

  saving.value = true

  try {
    const response = await updateOTExecutionSettings(buildPayload())
    applyItem(normalizePayload(response)?.item || {})

    toast.add({
      severity: 'success',
      summary: 'Controls applied',
      detail: 'OT execution controls are now active.',
      life: 3000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Update failed',
      detail: getApiErrorMessage(error, 'Failed to update OT execution controls.'),
      life: 4500,
    })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="ot-page-shell ot-execution-page">
    <section class="ot-table-card ot-execution-card">
      <div class="ot-table-toolbar ot-execution-toolbar">
        <div>
          <h2 class="ot-table-title">
            OT Execution Control
          </h2>
          <p class="ot-execution-subtitle">
            Control daily OT request hours, new past-date requests, and whether payment requires final approval.
          </p>
        </div>

        <div class="ot-table-actions">
          <Tag
            :value="requestStatusLabel"
            class="ot-execution-tag"
            :class="requestStatusClass"
          />

          <Button
            label="Reload"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            size="small"
            :loading="loading"
            @click="loadSettings"
          />

          <Button
            v-if="canUpdate"
            label="Apply controls"
            icon="pi pi-check"
            size="small"
            :loading="saving"
            :disabled="saveDisabled"
            @click="saveControls"
          />
        </div>
      </div>

      <div
        v-if="!canView"
        class="ot-empty-state"
      >
        <div class="ot-empty-icon">
          <i class="pi pi-lock" />
        </div>
        <div class="ot-empty-title">
          Access denied
        </div>
        <div class="ot-empty-text">
          You need the View OT Execution Controls permission.
        </div>
      </div>

      <template v-else>
        <Message
          v-if="!canUpdate"
          severity="info"
          :closable="false"
          class="ot-execution-message"
        >
          View-only access. You can see the current controls, but cannot change them.
        </Message>

        <div class="ot-execution-grid">
          <article class="ot-execution-panel">
            <div class="ot-execution-panel-head">
              <div>
                <h3>OT request access</h3>
                <p>Use the manual switch, daily hours, and the new-request past-date rule.</p>
              </div>
              <i class="pi pi-clock" />
            </div>

            <div class="ot-execution-switch-row">
              <div>
                <strong>Open OT requests</strong>
                <span>Allow users to create and edit OT requests now.</span>
              </div>
              <InputSwitch
                v-model="form.requestSubmissionOpen"
                :disabled="!canUpdate || loading || saving"
              />
            </div>

            <div class="ot-execution-switch-row">
              <div>
                <strong>Limit request hours</strong>
                <span>Apply the same start and end time every day. No calendar date restriction is used.</span>
              </div>
              <InputSwitch
                v-model="form.requestDailyTimeLimitEnabled"
                :disabled="!canUpdate || loading || saving"
              />
            </div>

            <div
              v-if="form.requestDailyTimeLimitEnabled"
              class="ot-execution-window-grid"
            >
              <label class="ot-field">
                <span class="ot-field-label">Daily start time</span>
                <input
                  v-model="form.requestDailyStartTime"
                  type="time"
                  step="60"
                  class="ot-execution-datetime"
                  :disabled="!canUpdate || loading || saving"
                >
              </label>

              <label class="ot-field">
                <span class="ot-field-label">Daily end time</span>
                <input
                  v-model="form.requestDailyEndTime"
                  type="time"
                  step="60"
                  class="ot-execution-datetime"
                  :disabled="!canUpdate || loading || saving"
                >
              </label>
            </div>

            <div class="ot-execution-current-window">
              <i class="pi pi-clock" />
              <span v-if="currentDailyHoursLabel">
                Current daily hours: {{ currentDailyHoursLabel }}
              </span>
              <span v-else>
                No daily hour limit is active. The manual Open OT requests switch controls access.
              </span>
            </div>

            <p
              v-if="form.requestDailyTimeLimitEnabled"
              class="ot-execution-help"
            >
              Overnight hours are supported. Example: 20:00 → 02:00 allows requests from 8 PM until 2 AM.
            </p>

            <div class="ot-execution-switch-row">
              <div>
                <strong>Allow backdated OT requests</strong>
                <span>
                  Allow a new request for a past OT date, such as creating yesterday's OT request today.
                  Turning this off still allows edits to an existing request.
                </span>
              </div>
              <InputSwitch
                v-model="form.allowBackdatedRequests"
                :disabled="!canUpdate || loading || saving"
              />
            </div>

            <div class="ot-execution-current-window">
              <i :class="form.allowBackdatedRequests ? 'pi pi-check-circle' : 'pi pi-ban'" />
              <span v-if="form.allowBackdatedRequests">
                New requests for past OT dates are allowed.
              </span>
              <span v-else>
                New requests for past OT dates are blocked. Users can select today or a future date only.
              </span>
            </div>
          </article>

          <article class="ot-execution-panel">
            <div class="ot-execution-panel-head">
              <div>
                <h3>Payment approval rule</h3>
                <p>Choose whether pending OT can enter payment calculation.</p>
              </div>
              <i class="pi pi-wallet" />
            </div>

            <div class="ot-execution-switch-row">
              <div>
                <strong>Require final approval before payment</strong>
                <span>When enabled, only OT requests with status Approved are calculated and exported.</span>
              </div>
              <InputSwitch
                v-model="form.paymentRequiresFinalApproval"
                :disabled="!canUpdate || loading || saving"
              />
            </div>

            <div class="ot-execution-payment-mode">
              <Tag
                :value="paymentModeLabel"
                class="ot-execution-tag"
                :class="form.paymentRequiresFinalApproval ? 'ot-execution-tag-strict' : 'ot-execution-tag-warning'"
              />

              <p v-if="form.paymentRequiresFinalApproval">
                Pending requests are skipped during payment and listed as “Approval required” in the warning and audit results.
              </p>
              <p v-else>
                Pending requests may be calculated. The payment preview continues to mark them with a warning.
              </p>
            </div>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.ot-execution-page {
  min-width: 0;
}

.ot-execution-card {
  padding: 1rem;
}

.ot-execution-toolbar {
  gap: 0.8rem;
}

.ot-execution-subtitle {
  margin: 0.2rem 0 0;
  color: var(--ot-text-muted);
  font-size: 0.76rem;
}

.ot-execution-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.ot-execution-panel {
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-surface);
  padding: 1rem;
  min-width: 0;
}

.ot-execution-panel-head {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--ot-border);
}

.ot-execution-panel-head h3 {
  margin: 0;
  color: var(--ot-text);
  font-size: 0.9rem;
}

.ot-execution-panel-head p,
.ot-execution-switch-row span,
.ot-execution-payment-mode p,
.ot-execution-help {
  margin: 0.25rem 0 0;
  color: var(--ot-text-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.ot-execution-panel-head > i {
  color: var(--primary-color);
  font-size: 1.15rem;
}

.ot-execution-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--ot-border);
}

.ot-execution-switch-row strong {
  display: block;
  color: var(--ot-text);
  font-size: 0.8rem;
}

.ot-execution-window-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  padding-top: 0.9rem;
}

.ot-execution-datetime {
  width: 100%;
  min-height: 2.25rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.45rem;
  background: var(--ot-surface);
  color: var(--ot-text);
  padding: 0.42rem 0.55rem;
  font: inherit;
  font-size: 0.78rem;
}

.ot-execution-current-window {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.85rem;
  color: var(--ot-text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

.ot-execution-current-window i {
  color: var(--primary-color);
  margin-top: 0.1rem;
}

.ot-execution-help {
  margin-top: 0.6rem;
}

.ot-execution-payment-mode {
  padding-top: 1rem;
}

.ot-execution-tag {
  border: 0;
  font-size: 0.68rem;
}

.ot-execution-tag-open {
  background: rgba(34, 197, 94, 0.16);
  color: rgb(22, 130, 67);
}

.ot-execution-tag-closed {
  background: rgba(239, 68, 68, 0.14);
  color: rgb(185, 28, 28);
}

.ot-execution-tag-strict {
  background: rgba(59, 130, 246, 0.14);
  color: rgb(29, 78, 216);
}

.ot-execution-tag-warning {
  background: rgba(245, 158, 11, 0.16);
  color: rgb(161, 98, 7);
}

.ot-execution-message {
  margin-top: 1rem;
}

:global(.dark) .ot-execution-panel,
:global(.dark) .ot-execution-datetime {
  background: var(--ot-surface);
}

@media (max-width: 760px) {
  .ot-execution-card {
    padding: 0.75rem;
  }

  .ot-execution-toolbar,
  .ot-execution-toolbar :deep(.ot-table-actions) {
    align-items: stretch;
  }

  .ot-execution-grid,
  .ot-execution-window-grid {
    grid-template-columns: 1fr;
  }

  .ot-execution-switch-row {
    align-items: flex-start;
  }
}
</style>
