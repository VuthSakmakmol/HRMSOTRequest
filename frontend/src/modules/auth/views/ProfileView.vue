<!-- frontend/src/modules/auth/views/ProfileView.vue -->
<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'

import TelegramConnectCard from '@/modules/auth/components/TelegramConnectCard.vue'
import { useAuthStore } from '@/modules/auth/auth.store'

const auth = useAuthStore()
const { t, te } = useI18n()

const user = computed(() => auth.user || {})

const employee = computed(() => {
  return (
    user.value.employee ||
    user.value.employeeProfile ||
    user.value.profile ||
    user.value.employeeSnapshot ||
    {}
  )
})

const department = computed(() => {
  return (
    employee.value.department ||
    employee.value.departmentSnapshot ||
    user.value.department ||
    user.value.departmentSnapshot ||
    {}
  )
})

const position = computed(() => {
  return (
    employee.value.position ||
    employee.value.positionSnapshot ||
    user.value.position ||
    user.value.positionSnapshot ||
    {}
  )
})

function cleanText(value) {
  return String(value ?? '').trim()
}

function firstValidText(values = []) {
  return values.map(cleanText).find(Boolean) || ''
}

function combineName(source = {}) {
  return [source.firstName, source.lastName]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')
}

function tr(key, fallback) {
  return te(key) ? t(key) : fallback
}

const displayName = computed(() => {
  return (
    firstValidText([
      user.value.displayName,
      user.value.fullName,
      user.value.name,
      user.value.employeeName,
      user.value.englishName,
      user.value.localName,
      combineName(user.value),

      employee.value.displayName,
      employee.value.fullName,
      employee.value.name,
      employee.value.employeeName,
      employee.value.englishName,
      employee.value.localName,
      combineName(employee.value),

      user.value.loginId,
      user.value.username,
      employee.value.employeeCode,
      employee.value.employeeNo,
    ]) || tr('profile.unknownUser', 'User')
  )
})

const loginId = computed(() => {
  return firstValidText([user.value.loginId, user.value.username]) || '-'
})

const employeeLabel = computed(() => {
  const code = firstValidText([
    employee.value.employeeCode,
    employee.value.employeeNo,
    employee.value.code,
    user.value.employeeCode,
    user.value.employeeNo,
  ])

  const name = firstValidText([
    employee.value.displayName,
    employee.value.fullName,
    employee.value.name,
    employee.value.employeeName,
    employee.value.englishName,
    employee.value.localName,
    combineName(employee.value),
    user.value.employeeName,
    user.value.employeeLabel,
  ])

  if (code && name && code !== name) return `${code} · ${name}`

  return code || name || '-'
})

const departmentName = computed(() => {
  const code = firstValidText([
    user.value.departmentCode,
    employee.value.departmentCode,
    department.value.code,
    department.value.departmentCode,
  ])

  const name = firstValidText([
    user.value.departmentName,
    employee.value.departmentName,
    department.value.name,
    department.value.departmentName,
  ])

  if (code && name && code !== name) return `${code} · ${name}`

  return code || name || '-'
})

const positionName = computed(() => {
  const code = firstValidText([
    user.value.positionCode,
    employee.value.positionCode,
    position.value.code,
    position.value.positionCode,
  ])

  const name = firstValidText([
    user.value.positionName,
    employee.value.positionName,
    position.value.name,
    position.value.positionName,
  ])

  if (code && name && code !== name) return `${code} · ${name}`

  return code || name || '-'
})

const accountInitial = computed(() => {
  return String(displayName.value || 'U').trim().charAt(0).toUpperCase() || 'U'
})

const accountStatusLabel = computed(() => {
  return user.value.isActive === false
    ? tr('common.inactive', 'Inactive')
    : tr('common.active', 'Active')
})

const accountStatusSeverity = computed(() => {
  return user.value.isActive === false ? 'danger' : 'success'
})

const profileSummaryCards = computed(() => [
  {
    key: 'login',
    icon: 'pi pi-id-card',
    label: tr('profile.loginId', 'Login ID'),
    value: loginId.value,
    tone: 'blue',
  },
  {
    key: 'department',
    icon: 'pi pi-building',
    label: tr('profile.department', 'Department'),
    value: departmentName.value,
    tone: 'green',
  },
  {
    key: 'position',
    icon: 'pi pi-briefcase',
    label: tr('profile.position', 'Position'),
    value: positionName.value,
    tone: 'purple',
  },
])

const accountRows = computed(() => [
  {
    icon: 'pi pi-user',
    label: tr('profile.displayName', 'Display Name'),
    value: displayName.value,
  },
  {
    icon: 'pi pi-key',
    label: tr('profile.loginId', 'Login ID'),
    value: loginId.value,
  },
  {
    icon: 'pi pi-users',
    label: tr('profile.employee', 'Employee'),
    value: employeeLabel.value,
  },
  {
    icon: 'pi pi-building',
    label: tr('profile.department', 'Department'),
    value: departmentName.value,
  },
  {
    icon: 'pi pi-briefcase',
    label: tr('profile.position', 'Position'),
    value: positionName.value,
  },
])
</script>

<template>
  <main class="profile-page">
    <section class="profile-hero">
      <div class="profile-hero__main">
        <div class="profile-avatar-shell">
          <Avatar
            :label="accountInitial"
            shape="circle"
            class="profile-hero__avatar"
          />

          <span
            class="profile-avatar-status"
            :class="{ 'is-inactive': user.isActive === false }"
          />
        </div>

        <div class="profile-hero__content">
          <div class="profile-hero__eyebrow">
            <i class="pi pi-user" />
            <span>{{ tr('profile.accountInformation', 'Account Information') }}</span>
          </div>

          <h1 class="profile-hero__name">
            {{ displayName }}
          </h1>

          <div class="profile-hero__meta">
            <span>{{ tr('profile.loginId', 'Login ID') }}: {{ loginId }}</span>
            <span class="profile-meta-dot" />
            <span>{{ employeeLabel }}</span>
          </div>
        </div>
      </div>

      <div class="profile-hero__side">
        <Tag
          :value="accountStatusLabel"
          :severity="accountStatusSeverity"
          rounded
          class="profile-status-tag"
        />

        <span class="profile-status-caption">
          {{ tr('profile.accountStatus', 'Account Status') }}
        </span>
      </div>
    </section>

    <section class="profile-summary-grid">
      <article
        v-for="item in profileSummaryCards"
        :key="item.key"
        class="profile-summary-card"
        :class="`is-${item.tone}`"
      >
        <span class="profile-summary-icon">
          <i :class="item.icon" />
        </span>

        <div class="profile-summary-text">
          <span>{{ item.label }}</span>
          <strong>{{ item.value || '-' }}</strong>
        </div>
      </article>
    </section>

    <section class="profile-content-grid">
      <aside class="profile-side-panel">
        <TelegramConnectCard redirect-after-connected="/ot/requests" />
      </aside>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  --profile-code-rgb: 37 99 235;
  --profile-text-rgb: 15 23 42;
  --profile-muted-rgb: 100 116 139;
  --profile-soft-rgb: 148 163 184;
  --profile-green-rgb: 34 197 94;
  --profile-amber-rgb: 245 158 11;
  --profile-red-rgb: 239 68 68;
  --profile-blue-rgb: 59 130 246;
  --profile-purple-rgb: 168 85 247;
  --profile-row-border: 148 163 184;

  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 0.9rem;
  overflow-x: hidden;
  padding: 0.95rem;
}

.profile-page,
.profile-page :deep(.p-component),
.profile-page :deep(.p-button),
.profile-page :deep(.p-inputtext),
.profile-page :deep(.p-tag) {
  font-family: var(--ot-font-main) !important;
}

/* =========================
   Hero
   ========================= */

.profile-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 1.15rem;
  background:
    radial-gradient(circle at 0% 0%, rgb(var(--profile-blue-rgb) / 0.16), transparent 32%),
    linear-gradient(135deg, rgb(var(--profile-blue-rgb) / 0.06), transparent 38%),
    var(--surface-card);
  box-shadow: 0 16px 42px rgb(15 23 42 / 0.07);
  padding: 1rem;
}

.profile-hero::after {
  position: absolute;
  inset: auto -3rem -4.5rem auto;
  z-index: -1;
  width: 13rem;
  height: 13rem;
  border-radius: 999px;
  background: rgb(var(--profile-blue-rgb) / 0.075);
  content: '';
}

.profile-hero__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.85rem;
}

.profile-avatar-shell {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.profile-hero__avatar {
  width: 3.35rem;
  height: 3.35rem;
  border: 1px solid rgb(var(--profile-blue-rgb) / 0.22);
  background:
    linear-gradient(135deg, rgb(var(--profile-blue-rgb) / 0.2), rgb(var(--profile-purple-rgb) / 0.12)),
    var(--surface-card);
  color: rgb(var(--profile-blue-rgb));
  box-shadow: 0 12px 28px rgb(var(--profile-blue-rgb) / 0.16);
  font-size: 1.02rem;
  font-weight: 900;
}

.profile-avatar-status {
  position: absolute;
  right: 0.1rem;
  bottom: 0.16rem;
  width: 0.72rem;
  height: 0.72rem;
  border: 2px solid var(--surface-card);
  border-radius: 999px;
  background: rgb(var(--profile-green-rgb));
  box-shadow: 0 0 0 3px rgb(var(--profile-green-rgb) / 0.12);
}

.profile-avatar-status.is-inactive {
  background: rgb(var(--profile-red-rgb));
  box-shadow: 0 0 0 3px rgb(var(--profile-red-rgb) / 0.12);
}

.profile-hero__content {
  min-width: 0;
}

.profile-hero__eyebrow {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  color: rgb(var(--profile-blue-rgb));
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.025em;
  line-height: 1.15;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.profile-hero__eyebrow i {
  font-size: 0.72rem;
}

.profile-hero__name {
  max-width: min(58vw, 48rem);
  margin: 0.2rem 0 0;
  overflow: hidden;
  color: var(--text-color);
  font-size: 1.18rem;
  font-weight: 880;
  line-height: 1.18;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-hero__meta {
  display: flex;
  min-width: 0;
  max-width: min(64vw, 52rem);
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.28rem;
  overflow: hidden;
  color: var(--text-color-secondary);
  font-size: 0.76rem;
  font-weight: 620;
  line-height: 1.25;
  white-space: nowrap;
}

.profile-hero__meta span:not(.profile-meta-dot) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-meta-dot {
  width: 0.28rem;
  height: 0.28rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgb(var(--profile-soft-rgb) / 0.8);
}

.profile-hero__side {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
}

.profile-status-tag {
  min-height: 1.48rem;
  padding-inline: 0.58rem !important;
  font-size: 0.7rem !important;
  font-weight: 780 !important;
}

.profile-status-caption {
  color: var(--text-color-secondary);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

/* =========================
   Summary cards
   ========================= */

.profile-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.profile-summary-card {
  --summary-rgb: var(--profile-blue-rgb);

  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgb(var(--summary-rgb) / 0.14);
  border-radius: 1rem;
  background:
    linear-gradient(135deg, rgb(var(--summary-rgb) / 0.075), transparent 38%),
    var(--surface-card);
  box-shadow: 0 12px 32px rgb(15 23 42 / 0.045);
  padding: 0.78rem;
}

.profile-summary-card.is-green {
  --summary-rgb: var(--profile-green-rgb);
}

.profile-summary-card.is-purple {
  --summary-rgb: var(--profile-purple-rgb);
}

.profile-summary-icon {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(var(--summary-rgb) / 0.22);
  border-radius: 0.8rem;
  background: rgb(var(--summary-rgb) / 0.11);
  color: rgb(var(--summary-rgb));
  font-size: 0.86rem;
}

.profile-summary-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.12rem;
}

.profile-summary-text span {
  overflow: hidden;
  color: var(--text-color-secondary);
  font-size: 0.68rem;
  font-weight: 780;
  letter-spacing: 0.025em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.profile-summary-text strong {
  overflow: hidden;
  color: var(--text-color);
  font-size: 0.82rem;
  font-weight: 780;
  line-height: 1.22;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* =========================
   Content layout
   ========================= */

.profile-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 0.9rem;
  align-items: start;
}

.profile-panel,
.profile-side-panel {
  min-width: 0;
}

.profile-panel {
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 1.15rem;
  background: var(--surface-card);
  box-shadow: 0 16px 42px rgb(15 23 42 / 0.06);
}

.profile-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  border-bottom: 1px solid rgb(var(--profile-row-border) / 0.12);
  background:
    linear-gradient(135deg, rgb(var(--profile-green-rgb) / 0.055), transparent 34%),
    var(--surface-card);
  padding: 0.88rem 1rem;
}

.profile-panel-header h2 {
  margin: 0;
  color: var(--text-color);
  font-size: 0.98rem;
  font-weight: 850;
  line-height: 1.2;
}

.profile-panel-header p {
  margin: 0.18rem 0 0;
  color: var(--text-color-secondary);
  font-size: 0.74rem;
  font-weight: 560;
  line-height: 1.35;
}

.profile-panel-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(var(--profile-blue-rgb) / 0.18);
  border-radius: 999px;
  background: rgb(var(--profile-blue-rgb) / 0.09);
  color: rgb(var(--profile-blue-rgb));
  font-size: 0.84rem;
}

/* =========================
   Info list
   ========================= */

.profile-info-list {
  display: grid;
  gap: 0.5rem;
  padding: 0.85rem;
}

.profile-info-row {
  display: grid;
  min-width: 0;
  grid-template-columns: 2rem minmax(8rem, 0.32fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.58rem;
  border: 1px solid rgb(var(--profile-row-border) / 0.14);
  border-radius: 0.9rem;
  background:
    linear-gradient(135deg, rgb(var(--profile-blue-rgb) / 0.025), transparent 36%),
    color-mix(in srgb, var(--surface-ground) 82%, transparent);
  padding: 0.58rem 0.65rem;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    transform 0.14s ease;
}

.profile-info-row:hover {
  border-color: rgb(var(--profile-blue-rgb) / 0.25);
  background:
    linear-gradient(135deg, rgb(var(--profile-blue-rgb) / 0.04), transparent 36%),
    var(--surface-card);
  transform: translateY(-1px);
}

.profile-info-icon {
  display: grid;
  width: 1.82rem;
  height: 1.82rem;
  place-items: center;
  border-radius: 0.72rem;
  background: rgb(var(--profile-blue-rgb) / 0.09);
  color: rgb(var(--profile-blue-rgb));
  font-size: 0.78rem;
}

.profile-info-label {
  min-width: 0;
  overflow: hidden;
  color: var(--text-color-secondary);
  font-size: 0.74rem;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-info-value {
  min-width: 0;
  overflow: hidden;
  color: var(--text-color);
  font-size: 0.82rem;
  font-weight: 760;
  line-height: 1.25;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-side-panel {
  position: sticky;
  top: 0.85rem;
}

.profile-side-panel :deep(.p-card),
.profile-side-panel :deep(.telegram-connect-card),
.profile-side-panel :deep(.telegram-card) {
  border-radius: 1.15rem !important;
  box-shadow: 0 16px 42px rgb(15 23 42 / 0.06) !important;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .profile-page {
  --profile-text-rgb: 226 232 240;
  --profile-muted-rgb: 203 213 225;
  --profile-row-border: 71 85 105;
}

:global(.dark) .profile-summary-card,
:global(.dark) .profile-panel,
:global(.dark) .profile-hero {
  box-shadow: 0 16px 42px rgb(0 0 0 / 0.22);
}

:global(.dark) .profile-info-row {
  background:
    linear-gradient(135deg, rgb(var(--profile-blue-rgb) / 0.055), transparent 36%),
    color-mix(in srgb, var(--surface-ground) 86%, transparent);
}

:global(.dark) .profile-info-row:hover {
  background:
    linear-gradient(135deg, rgb(var(--profile-blue-rgb) / 0.075), transparent 36%),
    var(--surface-card);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 1100px) {
  .profile-content-grid {
    grid-template-columns: 1fr;
  }

  .profile-side-panel {
    position: static;
  }
}

@media (max-width: 820px) {
  .profile-summary-grid {
    grid-template-columns: 1fr;
  }

  .profile-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile-hero__side {
    width: 100%;
    align-items: flex-start;
  }

  .profile-hero__name,
  .profile-hero__meta {
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .profile-page {
    gap: 0.65rem;
    padding: 0.65rem;
  }

  .profile-hero {
    border-radius: 0.9rem;
    padding: 0.72rem;
  }

  .profile-hero__main {
    width: 100%;
    align-items: flex-start;
    gap: 0.65rem;
  }

  .profile-hero__avatar {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 0.88rem;
  }

  .profile-avatar-status {
    width: 0.64rem;
    height: 0.64rem;
  }

  .profile-hero__eyebrow {
    font-size: 0.66rem;
  }

  .profile-hero__name {
    font-size: 0.98rem;
    white-space: normal;
  }

  .profile-hero__meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.12rem;
    font-size: 0.7rem;
    white-space: normal;
  }

  .profile-meta-dot {
    display: none;
  }

  .profile-status-caption {
    display: none;
  }

  .profile-summary-grid {
    gap: 0.5rem;
  }

  .profile-summary-card {
    border-radius: 0.85rem;
    padding: 0.62rem;
  }

  .profile-summary-icon {
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 0.7rem;
    font-size: 0.78rem;
  }

  .profile-summary-text span {
    font-size: 0.62rem;
  }

  .profile-summary-text strong {
    font-size: 0.76rem;
  }

  .profile-content-grid {
    gap: 0.65rem;
  }

  .profile-panel {
    border-radius: 0.9rem;
  }

  .profile-panel-header {
    padding: 0.72rem;
  }

  .profile-panel-header h2 {
    font-size: 0.9rem;
  }

  .profile-panel-header p {
    font-size: 0.68rem;
  }

  .profile-panel-icon {
    width: 1.8rem;
    height: 1.8rem;
    font-size: 0.76rem;
  }

  .profile-info-list {
    gap: 0.42rem;
    padding: 0.58rem;
  }

  .profile-info-row {
    grid-template-columns: 1.75rem minmax(0, 1fr);
    gap: 0.22rem 0.5rem;
    border-radius: 0.75rem;
    padding: 0.5rem;
  }

  .profile-info-icon {
    grid-row: span 2;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 0.62rem;
    font-size: 0.7rem;
  }

  .profile-info-label {
    font-size: 0.66rem;
  }

  .profile-info-value {
    font-size: 0.76rem;
    text-align: left;
    white-space: normal;
  }
}
</style>