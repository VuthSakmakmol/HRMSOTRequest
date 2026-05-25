<!-- frontend/src/modules/notification/components/NotificationBell.vue -->
<script setup>
// frontend/src/modules/notification/components/NotificationBell.vue

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Badge from 'primevue/badge'
import Tag from 'primevue/tag'

import { useNotificationStore } from '@/modules/notification/notification.store'

const router = useRouter()
const { t } = useI18n()
const notificationStore = useNotificationStore()

const open = ref(false)

const unreadCount = computed(() => Number(notificationStore.unreadCount || 0))
const hasUnread = computed(() => unreadCount.value > 0)
const items = computed(() => notificationStore.latestItems)
const loading = computed(() => notificationStore.loading)

function labelOr(key, fallback) {
  const value = t(key)

  return value === key ? fallback : value
}

function togglePanel() {
  open.value = !open.value

  if (open.value) {
    notificationStore.fetchNotifications().catch(() => {})
  }
}

function closePanel() {
  open.value = false
}

function formatDateTime(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function severityOf(item = {}) {
  const type = String(item.type || '').toUpperCase()

  if (type.includes('REJECTED') || type.includes('DISAGREED')) return 'danger'
  if (type.includes('APPROVED')) return 'success'
  if (type.includes('CONFIRMATION')) return 'warning'
  if (type.includes('APPROVAL_REQUIRED')) return 'success'

  return 'info'
}

function typeLabel(item = {}) {
  const type = String(item.type || '').toUpperCase()

  const map = {
    OT_APPROVAL_REQUIRED: labelOr('notification.type.otApprovalRequired', 'Approval Required'),
    OT_APPROVED: labelOr('notification.type.otApproved', 'Approved'),
    OT_REJECTED: labelOr('notification.type.otRejected', 'Rejected'),
    OT_REQUESTER_CONFIRMATION_REQUIRED: labelOr(
      'notification.type.otRequesterConfirmationRequired',
      'Confirmation Required',
    ),
    OT_REQUESTER_CONFIRMED: labelOr('notification.type.otRequesterConfirmed', 'Requester Confirmed'),
    OT_REQUESTER_DISAGREED: labelOr('notification.type.otRequesterDisagreed', 'Requester Disagreed'),
  }

  return map[type] || String(item.module || 'Info')
}

async function openNotification(item) {
  if (!item) return

  if (!item.isRead && item.id) {
    await notificationStore.markRead(item.id).catch(() => {})
  }

  closePanel()

  if (item.routePath) {
    router.push(item.routePath)
  }
}

async function markAllRead() {
  await notificationStore.markAllRead().catch(() => {})
}

function handleDocumentClick(event) {
  const root = document.querySelector('.notification-bell-shell')

  if (!root) return

  if (!root.contains(event.target)) {
    closePanel()
  }
}

onMounted(() => {
  notificationStore.startRealtime()
  notificationStore.startPolling()
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  notificationStore.stopPolling()
  notificationStore.stopRealtime()
})
</script>

<template>
  <div class="notification-bell-shell">
    <button
      type="button"
      class="notification-bell-button"
      :class="{ 'has-unread': hasUnread }"
      @click.stop="togglePanel"
    >
      <i class="pi pi-bell" />

      <Badge
        v-if="hasUnread"
        :value="unreadCount > 99 ? '99+' : unreadCount"
        severity="danger"
        class="notification-bell-badge"
      />
    </button>

    <div
      v-if="open"
      class="notification-panel"
      @click.stop
    >
      <div class="notification-panel-header">
        <div>
          <h3>{{ labelOr('notification.title', 'Notifications') }}</h3>
          <p>{{ labelOr('notification.subtitle', 'Latest system updates') }}</p>
        </div>

        <Button
          v-if="hasUnread"
          :label="labelOr('notification.markAllRead', 'Mark all read')"
          text
          size="small"
          :loading="notificationStore.marking"
          @click="markAllRead"
        />
      </div>

      <div
        v-if="loading && !items.length"
        class="notification-loading"
      >
        <i class="pi pi-spin pi-spinner" />
        <span>{{ labelOr('common.loading', 'Loading') }}</span>
      </div>

      <div
        v-else-if="!items.length"
        class="notification-empty"
      >
        <div class="notification-empty-icon">
          <i class="pi pi-bell-slash" />
        </div>

        <strong>{{ labelOr('notification.emptyTitle', 'No notifications') }}</strong>
        <span>{{ labelOr('notification.emptyText', 'You are all caught up.') }}</span>
      </div>

      <div
        v-else
        class="notification-list"
      >
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="notification-item"
          :class="{ unread: !item.isRead }"
          @click="openNotification(item)"
        >
          <span class="notification-dot" />

          <span class="notification-content">
            <span class="notification-topline">
              <Tag
                :value="typeLabel(item)"
                :severity="severityOf(item)"
                class="notification-type-tag"
              />

              <span class="notification-time">
                {{ formatDateTime(item.createdAt) }}
              </span>
            </span>

            <strong>{{ item.title || '-' }}</strong>

            <span class="notification-message">
              {{ item.message || item.requestNo || '-' }}
            </span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-bell-shell {
  position: relative;
  display: inline-flex;
}

.notification-bell-button {
  position: relative;
  display: inline-grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 1px solid var(--ot-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-surface) 92%, white);
  color: var(--ot-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.notification-bell-button:hover,
.notification-bell-button.has-unread {
  border-color: color-mix(in srgb, var(--primary-color) 42%, transparent);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.notification-bell-badge {
  position: absolute;
  top: -0.32rem;
  right: -0.36rem;
  min-width: 1.15rem;
  height: 1.15rem;
  font-size: 0.62rem;
  line-height: 1.15rem;
}

.notification-panel {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  z-index: 80;
  width: min(92vw, 24rem);
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 18px;
  background: var(--ot-surface);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

.notification-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem;
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 10%, transparent), transparent 42%),
    var(--ot-surface);
}

.notification-panel-header h3 {
  margin: 0;
  color: var(--ot-text);
  font-size: 0.95rem;
  font-weight: 850;
}

.notification-panel-header p {
  margin: 0.15rem 0 0;
  color: var(--ot-muted);
  font-size: 0.74rem;
}

.notification-loading,
.notification-empty {
  display: flex;
  min-height: 10rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 1.25rem;
  color: var(--ot-muted);
  font-size: 0.82rem;
}

.notification-empty-icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-muted) 12%, transparent);
  color: var(--ot-muted);
  font-size: 1.1rem;
}

.notification-empty strong {
  color: var(--ot-text);
}

.notification-list {
  max-height: 24rem;
  overflow-y: auto;
  padding: 0.35rem;
}

.notification-item {
  position: relative;
  display: flex;
  width: 100%;
  gap: 0.55rem;
  padding: 0.7rem;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.notification-item:hover {
  background: var(--ot-soft);
}

.notification-item.unread {
  background: color-mix(in srgb, var(--primary-color) 7%, transparent);
}

.notification-dot {
  width: 0.45rem;
  height: 0.45rem;
  margin-top: 0.48rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: transparent;
}

.notification-item.unread .notification-dot {
  background: var(--primary-color);
}

.notification-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.24rem;
}

.notification-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.notification-type-tag {
  font-size: 0.64rem;
  font-weight: 800;
}

.notification-time {
  flex: 0 0 auto;
  color: var(--ot-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.notification-content strong {
  color: var(--ot-text);
  font-size: 0.82rem;
  line-height: 1.25;
}

.notification-message {
  color: var(--ot-muted);
  font-size: 0.75rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .notification-panel {
    position: fixed;
    top: 4.25rem;
    right: 0.75rem;
    left: 0.75rem;
    width: auto;
  }
}
</style>