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

const displayName = computed(() => {
  return (
    user.value.displayName ||
    user.value.fullName ||
    user.value.name ||
    user.value.employeeName ||
    user.value.loginId ||
    'User'
  )
})

const loginId = computed(() => user.value.loginId || user.value.username || '-')

const employeeLabel = computed(() => {
  return (
    user.value.employeeLabel ||
    user.value.employeeName ||
    user.value.employee?.displayName ||
    user.value.employee?.employeeName ||
    '-'
  )
})

const departmentName = computed(() => {
  return (
    user.value.departmentName ||
    user.value.employee?.departmentName ||
    user.value.employee?.department?.name ||
    '-'
  )
})

const positionName = computed(() => {
  return (
    user.value.positionName ||
    user.value.employee?.positionName ||
    user.value.employee?.position?.name ||
    '-'
  )
})

const accountInitial = computed(() => {
  return String(displayName.value || 'U').trim().charAt(0).toUpperCase() || 'U'
})

const accountStatus = computed(() => {
  return user.value.isActive === false ? 'Inactive' : 'Active'
})

const accountStatusSeverity = computed(() => {
  return user.value.isActive === false ? 'danger' : 'success'
})

function tr(key, fallback) {
  return te(key) ? t(key) : fallback
}
</script>

<template>
  <main class="profile-page">
    <section class="profile-hero">
      <div class="profile-hero__left">
        <Avatar
          :label="accountInitial"
          shape="circle"
          class="profile-hero__avatar"
        />

        <div class="profile-hero__text">
          <h1 class="profile-hero__title">
            {{ tr('auth.profile', 'Profile') }}
          </h1>

          <p class="profile-hero__subtitle">
            {{
              tr(
                'profile.subtitle',
                'Manage your account and notification channels.',
              )
            }}
          </p>
        </div>
      </div>

      <Tag
        :value="accountStatus"
        :severity="accountStatusSeverity"
        rounded
      />
    </section>

    <section class="profile-grid">
      <Card class="profile-card">
        <template #title>
          <div class="profile-card-title">
            {{ tr('profile.accountInfo', 'Account Information') }}
          </div>
        </template>

        <template #content>
          <div class="profile-info-list">
            <div class="profile-info-row">
              <span class="profile-info-label">
                {{ tr('profile.displayName', 'Display Name') }}
              </span>
              <strong>{{ displayName }}</strong>
            </div>

            <div class="profile-info-row">
              <span class="profile-info-label">
                {{ tr('auth.loginId', 'Login ID') }}
              </span>
              <strong>{{ loginId }}</strong>
            </div>

            <div class="profile-info-row">
              <span class="profile-info-label">
                {{ tr('employee.employee', 'Employee') }}
              </span>
              <strong>{{ employeeLabel }}</strong>
            </div>

            <div class="profile-info-row">
              <span class="profile-info-label">
                {{ tr('org.department', 'Department') }}
              </span>
              <strong>{{ departmentName }}</strong>
            </div>

            <div class="profile-info-row">
              <span class="profile-info-label">
                {{ tr('org.position', 'Position') }}
              </span>
              <strong>{{ positionName }}</strong>
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
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.profile-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 22px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--primary-color) 9%, var(--surface-card)),
      var(--surface-card)
    );
  padding: 1rem;
}

.profile-hero__left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
}

.profile-hero__avatar {
  width: 3.25rem;
  height: 3.25rem;
  flex: 0 0 auto;
  background: var(--primary-color);
  color: var(--primary-color-text);
  font-weight: 800;
}

.profile-hero__text {
  min-width: 0;
}

.profile-hero__title {
  margin: 0;
  color: var(--text-color);
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.2;
}

.profile-hero__subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 1rem;
  align-items: start;
}

.profile-card {
  border-radius: 18px;
}

.profile-card-title {
  font-size: 1rem;
  font-weight: 800;
}

.profile-info-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.profile-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  background: var(--surface-ground);
  padding: 0.75rem 0.875rem;
}

.profile-info-label {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

.profile-info-row strong {
  min-width: 0;
  text-align: right;
  color: var(--text-color);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
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

  .profile-info-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile-info-row strong {
    text-align: left;
  }
}
</style>