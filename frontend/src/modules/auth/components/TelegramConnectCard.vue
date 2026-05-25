<!-- frontend/src/modules/auth/components/TelegramConnectCard.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

import {
  createTelegramConnectLink,
  disconnectTelegram,
  getTelegramStatus,
} from '@/modules/auth/telegram.api'

const props = defineProps({
  redirectAfterConnected: {
    type: String,
    default: '',
  },
  redirectDelayMs: {
    type: Number,
    default: 900,
  },
})

const router = useRouter()
const { t, te } = useI18n()
const toast = useToast()

const loading = ref(false)
const connecting = ref(false)
const disconnecting = ref(false)
const waitingForStart = ref(false)

const status = ref(null)
const connectUrl = ref('')
const connectDeepLink = ref('')
const expiresAt = ref(null)
const lastError = ref('')

let pollTimer = null
let redirectTimer = null

const isConnected = computed(() => status.value?.connected === true)

const telegramName = computed(() => {
  const username = String(status.value?.telegramUsername || '').trim()
  const firstName = String(status.value?.telegramFirstName || '').trim()
  const lastName = String(status.value?.telegramLastName || '').trim()

  if (username) return `@${username}`

  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  return fullName || ''
})

const connectedLabel = computed(() => {
  if (!isConnected.value) return tr('telegram.status.notConnected', 'Not connected')

  return telegramName.value || tr('telegram.status.connected', 'Connected')
})

const statusSeverity = computed(() => {
  if (isConnected.value) return 'success'
  if (waitingForStart.value) return 'warning'

  return 'secondary'
})

const isConnectExpired = computed(() => {
  if (!expiresAt.value) return false

  return new Date(expiresAt.value).getTime() <= Date.now()
})

function tr(key, fallback) {
  return te(key) ? t(key) : fallback
}

function unwrapItem(response) {
  return response?.data?.item || response?.item || response?.data || response || null
}

function clearPollTimer() {
  if (pollTimer) {
    window.clearTimeout(pollTimer)
    pollTimer = null
  }
}

function clearRedirectTimer() {
  if (redirectTimer) {
    window.clearTimeout(redirectTimer)
    redirectTimer = null
  }
}

function showSuccess(message) {
  toast.add({
    severity: 'success',
    summary: tr('common.success', 'Success'),
    detail: message,
    life: 2500,
  })
}

function showError(message) {
  toast.add({
    severity: 'error',
    summary: tr('common.error', 'Error'),
    detail: message,
    life: 3500,
  })
}

function resetConnectLink() {
  connectUrl.value = ''
  connectDeepLink.value = ''
  expiresAt.value = null
}

function redirectAfterConnected() {
  const path = String(props.redirectAfterConnected || '').trim()

  if (!path) return

  clearRedirectTimer()

  redirectTimer = window.setTimeout(() => {
    router.push(path)
  }, Number(props.redirectDelayMs) || 900)
}

async function loadStatus({ silent = false } = {}) {
  if (!silent) {
    loading.value = true
  }

  lastError.value = ''

  try {
    const response = await getTelegramStatus()
    status.value = unwrapItem(response)

    if (status.value?.connected === true) {
      waitingForStart.value = false
      clearPollTimer()
    }

    return status.value
  } catch (error) {
    lastError.value =
      error?.response?.data?.message ||
      error?.message ||
      tr('telegram.error.statusFailed', 'Could not load Telegram status.')

    if (!silent) {
      showError(lastError.value)
    }

    return null
  } finally {
    loading.value = false
  }
}

function openTelegramLink() {
  const appLink = String(connectDeepLink.value || '').trim()
  const webLink = String(connectUrl.value || '').trim()

  if (appLink) {
    window.location.href = appLink
    return
  }

  if (webLink) {
    window.open(webLink, '_blank', 'noopener,noreferrer')
  }
}

async function pollConnectedStatus() {
  clearPollTimer()

  if (!waitingForStart.value) return

  if (isConnectExpired.value) {
    waitingForStart.value = false
    resetConnectLink()

    lastError.value = tr(
      'telegram.error.linkExpired',
      'Telegram connection link expired. Please click Connect Telegram again.',
    )

    return
  }

  const item = await loadStatus({ silent: true })

  if (item?.connected === true) {
    waitingForStart.value = false
    resetConnectLink()

    showSuccess(tr('telegram.success.connected', 'Telegram connected successfully.'))
    redirectAfterConnected()

    return
  }

  pollTimer = window.setTimeout(pollConnectedStatus, 2500)
}

async function connect() {
  if (connecting.value) return

  connecting.value = true
  waitingForStart.value = false
  lastError.value = ''
  resetConnectLink()
  clearPollTimer()

  try {
    const response = await createTelegramConnectLink()
    const item = unwrapItem(response)

    connectUrl.value = item?.connectUrl || ''
    connectDeepLink.value = item?.connectDeepLink || ''
    expiresAt.value = item?.expiresAt || null

    if (!connectUrl.value && !connectDeepLink.value) {
      throw new Error(tr('telegram.error.connectUrlMissing', 'Telegram connect link missing.'))
    }

    waitingForStart.value = true

    openTelegramLink()

    pollTimer = window.setTimeout(pollConnectedStatus, 1500)
  } catch (error) {
    lastError.value =
      error?.response?.data?.message ||
      error?.message ||
      tr('telegram.error.connectFailed', 'Could not create Telegram connect link.')

    showError(lastError.value)
  } finally {
    connecting.value = false
  }
}

async function disconnect() {
  if (disconnecting.value) return

  disconnecting.value = true
  waitingForStart.value = false
  lastError.value = ''
  clearPollTimer()

  try {
    const response = await disconnectTelegram()

    status.value = unwrapItem(response)
    resetConnectLink()

    showSuccess(tr('telegram.success.disconnected', 'Telegram disconnected.'))
  } catch (error) {
    lastError.value =
      error?.response?.data?.message ||
      error?.message ||
      tr('telegram.error.disconnectFailed', 'Could not disconnect Telegram.')

    showError(lastError.value)
  } finally {
    disconnecting.value = false
  }
}

onMounted(() => {
  loadStatus()
})

onBeforeUnmount(() => {
  clearPollTimer()
  clearRedirectTimer()
})
</script>

<template>
  <Card class="telegram-connect-card">
    <template #title>
      <div class="telegram-title-row">
        <div>
          <div class="telegram-title">
            {{ tr('telegram.title', 'Telegram Alert') }}
          </div>
          <div class="telegram-subtitle">
            {{ tr('telegram.subtitle', 'Receive OT alerts outside the website.') }}
          </div>
        </div>

        <Tag
          :value="connectedLabel"
          :severity="statusSeverity"
          rounded
        />
      </div>
    </template>

    <template #content>
      <div class="telegram-content">
        <Message
          v-if="isConnected"
          severity="success"
          :closable="false"
        >
          {{ tr('telegram.message.connected', 'Your Telegram is connected.') }}
        </Message>

        <Message
          v-else-if="waitingForStart"
          severity="warn"
          :closable="false"
        >
          {{
            tr(
              'telegram.message.waiting',
              'Waiting for Telegram confirmation. Press START in Telegram.',
            )
          }}
        </Message>

        <Message
          v-else
          severity="info"
          :closable="false"
        >
          {{
            tr(
              'telegram.message.notConnected',
              'Click Connect Telegram, then press START in Telegram.',
            )
          }}
        </Message>

        <Message
          v-if="lastError"
          severity="error"
          :closable="false"
        >
          {{ lastError }}
        </Message>

        <div
          v-if="isConnected"
          class="telegram-detail"
        >
          <div class="telegram-detail-label">
            {{ tr('telegram.connectedAs', 'Connected as') }}
          </div>
          <div class="telegram-detail-value">
            {{ connectedLabel }}
          </div>
        </div>

        <div
          v-if="(connectUrl || connectDeepLink) && waitingForStart"
          class="telegram-link-box"
        >
          <div class="telegram-link-text">
            {{
              tr(
                'telegram.linkHelp',
                'If Telegram did not open automatically, click Open Telegram.',
              )
            }}
          </div>

          <Button
            :label="tr('telegram.openTelegram', 'Open Telegram')"
            icon="pi pi-send"
            size="small"
            outlined
            @click="openTelegramLink"
          />
        </div>

        <div class="telegram-actions">
          <Button
            v-if="!isConnected"
            :label="tr('telegram.connect', 'Connect Telegram')"
            icon="pi pi-send"
            size="small"
            :loading="connecting"
            :disabled="loading || connecting"
            @click="connect"
          />

          <Button
            v-else
            :label="tr('telegram.disconnect', 'Disconnect Telegram')"
            icon="pi pi-times"
            size="small"
            severity="danger"
            outlined
            :loading="disconnecting"
            :disabled="disconnecting"
            @click="disconnect"
          />

          <Button
            :label="tr('common.refresh', 'Refresh')"
            icon="pi pi-refresh"
            size="small"
            text
            :loading="loading"
            @click="loadStatus()"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.telegram-connect-card {
  border-radius: 18px;
}

.telegram-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.telegram-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.telegram-subtitle {
  margin-top: 0.25rem;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  font-weight: 400;
}

.telegram-content {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.telegram-detail {
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 0.75rem 0.875rem;
  background: var(--surface-ground);
}

.telegram-detail-label {
  color: var(--text-color-secondary);
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.telegram-detail-value {
  font-size: 0.95rem;
  font-weight: 700;
}

.telegram-link-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px dashed var(--surface-border);
  border-radius: 14px;
  padding: 0.75rem;
}

.telegram-link-text {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.telegram-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .telegram-title-row {
    flex-direction: column;
  }

  .telegram-link-box {
    align-items: stretch;
    flex-direction: column;
  }

  .telegram-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .telegram-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>