<!-- frontend/src/modules/attendance/views/AttendanceScanStationView.vue -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

import { submitAttendanceScan } from '@/modules/attendance/attendance.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'

const { t } = useI18n()
const toast = useToast()

const scanInputRef = ref(null)
const scannedValue = ref('')
const scanning = ref(false)
const lastResult = ref(null)
const recentScans = ref([])

// Some USB scanners append Enter and others only type the Employee ID.
// A short idle delay lets the second type submit automatically after its final character.
const AUTO_SUBMIT_IDLE_MS = 500
let autoSubmitTimer = null

const resultClass = computed(() => {
  if (!lastResult.value) return 'scan-station-idle'
  return lastResult.value.accepted ? 'scan-station-success' : 'scan-station-error'
})

const resultIcon = computed(() => {
  if (!lastResult.value) return 'pi pi-barcode'
  return lastResult.value.accepted ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle'
})

const resultTitle = computed(() => {
  if (!lastResult.value) return t('attendance.scanStation.readyTitle')
  return lastResult.value.accepted
    ? t('attendance.scanStation.recordedTitle')
    : t('attendance.scanStation.errorTitle')
})

function s(value) {
  return String(value ?? '').trim()
}

function normalizePayload(response) {
  return response?.data?.data || response?.data || {}
}

function formatTime(value) {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value))
  } catch {
    return '—'
  }
}

function clearAutoSubmitTimer() {
  if (autoSubmitTimer) {
    window.clearTimeout(autoSubmitTimer)
    autoSubmitTimer = null
  }
}

function focusScanInput() {
  window.setTimeout(() => {
    if (!scanning.value) {
      scanInputRef.value?.$el?.focus?.()
      scanInputRef.value?.focus?.()
    }
  }, 0)
}

function clearAndFocus() {
  clearAutoSubmitTimer()
  scannedValue.value = ''
  focusScanInput()
}

function pushRecent(result) {
  recentScans.value = [
    {
      id: result?.scanLog?.id || `${Date.now()}-${Math.random()}`,
      accepted: result?.accepted === true,
      employeeNo: s(result?.employee?.employeeNo),
      employeeName: s(result?.employee?.employeeName),
      rawScannedValue: s(result?.scanLog?.rawScannedValue),
      result: s(result?.result),
      scannedAt: result?.scannedAt || result?.scanLog?.scannedAt || new Date().toISOString(),
      scanOut: s(result?.scanOut),
    },
    ...recentScans.value,
  ].slice(0, 10)
}

async function submitCurrentScan() {
  clearAutoSubmitTimer()

  const value = s(scannedValue.value)
  if (scanning.value || !value) {
    clearAndFocus()
    return
  }

  scanning.value = true

  try {
    const response = await submitAttendanceScan({
      scannedValue: value,
      stationName: 'SCAN_STATION',
    })

    const result = normalizePayload(response)
    lastResult.value = result
    pushRecent(result)

    if (result.accepted) {
      toast.add({
        severity: 'success',
        summary: t('attendance.scanStation.recordedTitle'),
        detail: `${result?.employee?.employeeNo || ''} ${result?.employee?.employeeName || ''}`.trim(),
        life: 1800,
      })
    }
  } catch (error) {
    const result = {
      accepted: false,
      result: 'SYSTEM_ERROR',
      reason: getApiErrorMessage(error, t('attendance.scanStation.systemError')),
      scanLog: {
        rawScannedValue: value,
        scannedAt: new Date().toISOString(),
      },
    }

    lastResult.value = result
    pushRecent(result)

    toast.add({
      severity: 'error',
      summary: t('attendance.scanStation.errorTitle'),
      detail: result.reason,
      life: 4000,
    })
  } finally {
    scanning.value = false
    clearAndFocus()
  }
}

function scheduleAutoSubmit() {
  clearAutoSubmitTimer()

  const valueAtSchedule = s(scannedValue.value)
  if (scanning.value || !valueAtSchedule) return

  autoSubmitTimer = window.setTimeout(() => {
    autoSubmitTimer = null

    // Do not submit a stale value after a successful Enter scan, clear, or new scan.
    if (scanning.value || s(scannedValue.value) !== valueAtSchedule) return

    submitCurrentScan()
  }, AUTO_SUBMIT_IDLE_MS)
}

function onScanInput() {
  // Scanner with Enter: this timer is cancelled by onInputKeydown and submits immediately.
  // Scanner without Enter: it submits 500 ms after the scanner finishes typing.
  scheduleAutoSubmit()
}

function onInputKeydown(event) {
  if (event.key !== 'Enter') return

  clearAutoSubmitTimer()
  event.preventDefault()
  submitCurrentScan()
}

function onDocumentPointerDown() {
  focusScanInput()
}

onMounted(async () => {
  await nextTick()
  focusScanInput()
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('focus', focusScanInput)
})

onBeforeUnmount(() => {
  clearAutoSubmitTimer()
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('focus', focusScanInput)
})
</script>

<template>
  <main class="ot-page attendance-scan-station-page">
    <section class="ot-page-heading">
      <div>
        <h1 class="ot-page-title">
          {{ t('attendance.scanStation.title') }}
        </h1>

      </div>
    </section>

    <section class="scan-station-card">
      <div class="scan-station-instruction">
        <i class="pi pi-id-card" />
        <div>
          <div class="scan-station-instruction-title">
            {{ t('attendance.scanStation.scanCard') }}
          </div>
        </div>
      </div>

      <InputText
        ref="scanInputRef"
        v-model="scannedValue"
        class="scan-station-input"
        autocomplete="off"
        spellcheck="false"
        :disabled="scanning"
        :placeholder="t('attendance.scanStation.placeholder')"
        @input="onScanInput"
        @keydown="onInputKeydown"
        @blur="focusScanInput"
      />
    </section>

    <section
      class="scan-station-result"
      :class="resultClass"
      aria-live="polite"
    >
      <i
        class="scan-station-result-icon"
        :class="resultIcon"
      />

      <div class="min-w-0">
        <div class="scan-station-result-title">
          {{ resultTitle }}
        </div>

        <template v-if="lastResult">
          <div
            v-if="lastResult.accepted"
            class="scan-station-result-main"
          >
            {{ lastResult.employee?.employeeNo }} · {{ lastResult.employee?.employeeName }}
          </div>

          <div
            v-if="lastResult.accepted"
            class="scan-station-result-meta"
          >
            {{ t('attendance.scanStation.officialTime', {
              scanIn: lastResult.scanIn,
              scanOut: lastResult.scanOut,
            }) }}
          </div>

          <div
            v-else
            class="scan-station-result-main"
          >
            {{ lastResult.reason || t('attendance.scanStation.errorDefault') }}
          </div>

          <div
            v-if="!lastResult.accepted"
            class="scan-station-result-meta"
          >
            {{ t('attendance.scanStation.paperInstruction') }}
          </div>
        </template>
      </div>
    </section>

    <section class="ot-table-card scan-station-recent-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('attendance.scanStation.recentScans') }}
          </h2>
        </div>

        <Button
          :label="t('attendance.scanStation.focusInput')"
          icon="pi pi-barcode"
          size="small"
          severity="secondary"
          outlined
          @click="focusScanInput"
        />
      </div>

      <div
        v-if="!recentScans.length"
        class="scan-station-empty"
      >
        {{ t('attendance.scanStation.noScansYet') }}
      </div>

      <div
        v-else
        class="scan-station-recent-list"
      >
        <article
          v-for="item in recentScans"
          :key="item.id"
          class="scan-station-recent-row"
          :class="item.accepted ? 'is-success' : 'is-error'"
        >
          <i :class="item.accepted ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
          <div class="min-w-0 flex-1">
            <div class="truncate font-bold">
              <template v-if="item.accepted">
                {{ item.employeeNo }} · {{ item.employeeName }}
              </template>
              <template v-else>
                {{ item.rawScannedValue || '—' }}
              </template>
            </div>
            <div class="text-xs opacity-80">
              {{ item.accepted ? item.scanOut : item.result }}
            </div>
          </div>
          <time class="text-xs opacity-80">
            {{ formatTime(item.scannedAt) }}
          </time>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.attendance-scan-station-page {
  max-width: 980px;
}

.scan-station-card,
.scan-station-result {
  border: 1px solid var(--ot-border);
  border-radius: 1.25rem;
  background: var(--ot-surface);
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.06);
}

.scan-station-card {
  padding: 1.25rem;
}

.scan-station-instruction {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.scan-station-instruction > i {
  display: grid;
  width: 2.7rem;
  height: 2.7rem;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  color: var(--primary-color);
  font-size: 1.3rem;
}

.scan-station-instruction-title,
.scan-station-result-title {
  color: var(--ot-text);
  font-weight: 800;
}

.scan-station-instruction-text,
.scan-station-input-help,
.scan-station-result-meta {
  color: var(--ot-text-muted);
  font-size: 0.85rem;
}

.scan-station-input {
  width: 100%;
  min-height: 5.25rem;
  border-radius: 1rem;
  font-size: clamp(1.7rem, 6vw, 3.25rem);
  font-weight: 800;
  letter-spacing: 0.1em;
  text-align: center;
}

.scan-station-input-help {
  margin-top: 0.65rem;
  text-align: center;
}

.scan-station-result {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1.1rem 1.25rem;
}

.scan-station-result-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  font-size: 1.6rem;
}

.scan-station-idle {
  border-color: var(--ot-border);
}

.scan-station-idle .scan-station-result-icon {
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  color: var(--primary-color);
}

.scan-station-success {
  border-color: color-mix(in srgb, #16a34a 42%, var(--ot-border));
  background: color-mix(in srgb, #16a34a 9%, var(--ot-surface));
}

.scan-station-success .scan-station-result-icon {
  background: #16a34a;
  color: white;
}

.scan-station-error {
  border-color: color-mix(in srgb, #dc2626 42%, var(--ot-border));
  background: color-mix(in srgb, #dc2626 9%, var(--ot-surface));
}

.scan-station-error .scan-station-result-icon {
  background: #dc2626;
  color: white;
}

.scan-station-result-main {
  margin-top: 0.18rem;
  color: var(--ot-text);
  font-size: 1rem;
  font-weight: 700;
}

.scan-station-recent-card {
  margin-top: 1rem;
}

.scan-station-empty {
  padding: 2.2rem 1rem;
  color: var(--ot-text-muted);
  text-align: center;
}

.scan-station-recent-list {
  display: grid;
}

.scan-station-recent-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0.1rem;
  border-top: 1px solid var(--ot-border);
  color: var(--ot-text);
}

.scan-station-recent-row:first-child {
  border-top: 0;
}

.scan-station-recent-row.is-success > i {
  color: #16a34a;
}

.scan-station-recent-row.is-error > i {
  color: #dc2626;
}

@media (max-width: 640px) {
  .scan-station-card,
  .scan-station-result {
    border-radius: 1rem;
  }

  .scan-station-card {
    padding: 1rem;
  }

  .scan-station-input {
    min-height: 4.5rem;
    font-size: 1.55rem;
  }
}
</style>
