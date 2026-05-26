<!-- frontend/src/modules/auth/views/ProfileView.vue -->
<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Avatar from 'primevue/avatar'
import Card from 'primevue/card'
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

const accountRows = computed(() => [
  {
    label: tr('profile.displayName', 'Display Name'),
    value: displayName.value,
  },
  {
    label: tr('profile.loginId', 'Login ID'),
    value: loginId.value,
  },
  {
    label: tr('profile.employee', 'Employee'),
    value: employeeLabel.value,
  },
  {
    label: tr('profile.department', 'Department'),
    value: departmentName.value,
  },
  {
    label: tr('profile.position', 'Position'),
    value: positionName.value,
  },
])
</script>

<template>
  <main class="profile-page">
    <section class="profile-hero">
      <div class="profile-hero__identity">
        <Avatar
          :label="accountInitial"
          shape="circle"
          class="profile-hero__avatar"
        />

        <div class="profile-hero__text">
          <h1 class="profile-hero__name">
            {{ displayName }}
          </h1>

          <div class="profile-hero__meta">
            <span>{{ tr('profile.loginId', 'Login ID') }}: {{ loginId }}</span>
          </div>
        </div>
      </div>

      <Tag
        :value="accountStatusLabel"
        :severity="accountStatusSeverity"
        rounded
        class="profile-status-tag"
      />
    </section>

    <section class="profile-grid">
      <Card class="profile-card">
        <template #title>
          <div class="profile-card-title">
            <i class="pi pi-user" />
            <span>{{ tr('profile.accountInformation', 'Account Information') }}</span>
          </div>
        </template>

        <template #content>
          <div class="profile-info-list">
            <div
              v-for="row in accountRows"
              :key="row.label"
              class="profile-info-row"
            >
              <span class="profile-info-label">
                {{ row.label }}
              </span>

              <strong class="profile-info-value">
                {{ row.value || '-' }}
              </strong>
            </div>
          </div>
        </template>
      </Card>

      <TelegramConnectCard redirect-after-connected="/ot/requests" />
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.profile-hero {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 1.05rem;
  background:
    linear-gradient(135deg, rgb(59 130 246 / 0.055), transparent 34%),
    var(--surface-card);
  box-shadow: 0 12px 34px rgb(15 23 42 / 0.055);
  padding: 0.9rem 1rem;
}

.profile-hero__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.profile-hero__avatar {
  width: 2.7rem;
  height: 2.7rem;
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--primary-color) 16%, transparent);
  color: var(--primary-color);
  font-size: 0.92rem;
  font-weight: 900;
}

.profile-hero__text {
  min-width: 0;
}

.profile-hero__name {
  max-width: min(54vw, 42rem);
  margin: 0;
  overflow: hidden;
  color: var(--text-color);
  font-size: 1.05rem;
  font-weight: 850;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-hero__meta {
  display: flex;
  min-width: 0;
  margin-top: 0.2rem;
  color: var(--text-color-secondary);
  font-size: 0.76rem;
  font-weight: 650;
}

.profile-status-tag {
  flex: 0 0 auto;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 1rem;
  align-items: start;
}

.profile-card {
  overflow: hidden;
  border-radius: 1.05rem;
  box-shadow: 0 12px 34px rgb(15 23 42 / 0.045);
}

.profile-card :deep(.p-card-body) {
  padding: 1rem;
}

.profile-card :deep(.p-card-title) {
  margin-bottom: 0.75rem;
}

.profile-card-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-color);
  font-size: 0.94rem;
  font-weight: 850;
}

.profile-card-title i {
  color: var(--primary-color);
  font-size: 0.86rem;
}

.profile-info-list {
  display: grid;
  gap: 0.52rem;
}

.profile-info-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(8rem, 0.34fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--surface-border);
  border-radius: 0.82rem;
  background: color-mix(in srgb, var(--surface-ground) 82%, transparent);
  padding: 0.64rem 0.75rem;
}

.profile-info-label {
  color: var(--text-color-secondary);
  font-size: 0.76rem;
  font-weight: 700;
}

.profile-info-value {
  min-width: 0;
  overflow: hidden;
  color: var(--text-color);
  font-size: 0.82rem;
  font-weight: 760;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .profile-page {
    padding: 0.75rem;
  }

  .profile-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile-hero__name {
    max-width: 72vw;
  }

  .profile-info-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .profile-info-value {
    text-align: left;
    white-space: normal;
  }
}
</style>