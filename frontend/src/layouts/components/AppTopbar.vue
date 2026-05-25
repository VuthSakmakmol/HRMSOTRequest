<!-- frontend/src/layouts/components/AppTopbar.vue -->
<script setup>
// frontend/src/layouts/components/AppTopbar.vue

import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Menu from 'primevue/menu'

import AppLanguageSwitcher from '@/shared/components/AppLanguageSwitcher.vue'
import NotificationBell from '@/modules/notification/components/NotificationBell.vue'

import { useAuthStore } from '@/modules/auth/auth.store'
import { useThemeStore } from '@/app/store/theme.store'

defineProps({
  desktopCollapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-sidebar', 'toggle-desktop-sidebar'])

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
const { t } = useI18n()

const profileMenu = ref(null)

const pageTitle = computed(() => {
  const titleKey = String(route.meta?.titleKey || '').trim()
  const fallbackTitle = String(route.meta?.title || t('nav.dashboard')).trim()

  return titleKey ? t(titleKey) : fallbackTitle
})

function cleanText(value) {
  return String(value ?? '').trim()
}

function firstValidText(values = []) {
  return values.map(cleanText).find(Boolean) || ''
}

const displayName = computed(() => {
  const user = auth.user || {}
  const employee = user.employee || user.employeeProfile || user.profile || {}

  const combinedName = [user.firstName, user.lastName]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')

  const employeeCombinedName = [employee.firstName, employee.lastName]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')

  return (
    firstValidText([
      user.displayName,
      user.fullName,
      user.name,
      user.employeeName,
      user.englishName,
      user.localName,
      combinedName,

      employee.displayName,
      employee.fullName,
      employee.name,
      employee.employeeName,
      employee.englishName,
      employee.localName,
      employeeCombinedName,

      user.loginId,
      user.username,
      user.employeeNo,
    ]) || 'User'
  )
})

const accountInitial = computed(() => {
  const name = displayName.value || 'U'

  return String(name).trim().charAt(0).toUpperCase() || 'U'
})

const themeIcon = computed(() => (theme.isDark ? 'pi pi-sun' : 'pi pi-moon'))

const themeLabel = computed(() =>
  theme.isDark ? t('common.switchToLightMode') : t('common.switchToDarkMode'),
)

const profileItems = computed(() => [
  {
    label: themeLabel.value,
    icon: themeIcon.value,
    command: () => theme.toggle(),
  },
  {
    label: t('auth.profile'),
    icon: 'pi pi-user',
    command: () => router.push('/profile'),
  },
  { separator: true },
  {
    label: t('auth.logout'),
    icon: 'pi pi-sign-out',
    command: async () => {
      await auth.logout()
      router.push('/login')
    },
  },
])

function toggleProfileMenu(event) {
  profileMenu.value?.toggle(event)
}
</script>

<template>
  <header class="app-topbar sticky top-0 z-30">
    <div class="app-topbar__inner">
      <div class="app-topbar__left">
        <Button
          icon="pi pi-bars"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn lg:!hidden"
          :aria-label="t('common.openNavigation')"
          @click="emit('toggle-sidebar')"
        />

        <Button
          :icon="desktopCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn hidden lg:!inline-flex"
          :aria-label="t('common.toggleDesktopSidebar')"
          @click="emit('toggle-desktop-sidebar')"
        />

        <div class="app-topbar__divider" />

        <div class="app-topbar__title-wrap">
          <div class="app-topbar__title">
            {{ pageTitle }}
          </div>
        </div>
      </div>

      <div class="app-topbar__right">
        <AppLanguageSwitcher />

        <Button
          :icon="themeIcon"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn"
          :aria-label="themeLabel"
          @click="theme.toggle()"
        />

        <NotificationBell />

        <button
          type="button"
          class="topbar-profile-btn"
          :title="displayName"
          :aria-label="displayName"
          @click="toggleProfileMenu"
        >
          <Avatar
            :label="accountInitial"
            shape="circle"
            class="topbar-profile-btn__avatar"
          />

          <span class="topbar-profile-btn__name">
            {{ displayName }}
          </span>

          <i class="pi pi-angle-down topbar-profile-btn__icon" />
        </button>

        <Menu
          ref="profileMenu"
          :model="profileItems"
          popup
          class="app-profile-menu w-56"
        />
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--ot-surface) 96%, transparent),
      color-mix(in srgb, var(--ot-surface) 88%, transparent)
    );
  color: var(--ot-text);
  backdrop-filter: blur(14px);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--ot-border) 55%, transparent);
}

.app-topbar__inner {
  display: flex;
  min-width: 0;
  height: 4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1rem;
}

.app-topbar__left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
}

.app-topbar__right {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
}

.app-topbar__divider {
  width: 1px;
  height: 1.65rem;
  background: var(--ot-border);
}

.app-topbar__title-wrap {
  min-width: 0;
}

.app-topbar__title {
  max-width: min(46vw, 36rem);
  overflow: hidden;
  color: var(--ot-text);
  font-size: 1rem;
  font-weight: 850;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-icon-btn {
  width: 2.35rem;
  height: 2.35rem;
  color: var(--ot-muted);
}

.topbar-profile-btn {
  display: inline-flex;
  min-width: 0;
  max-width: 15rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0.25rem 0.42rem 0.25rem 0.25rem;
  border: 1px solid var(--ot-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-surface) 92%, white);
  color: var(--ot-text);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.topbar-profile-btn:hover {
  border-color: color-mix(in srgb, var(--primary-color) 35%, transparent);
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.topbar-profile-btn__avatar {
  flex: 0 0 auto;
  width: 1.9rem;
  height: 1.9rem;
  background: color-mix(in srgb, var(--primary-color) 16%, transparent);
  color: var(--primary-color);
  font-size: 0.78rem;
  font-weight: 900;
}

.topbar-profile-btn__name {
  min-width: 0;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.82rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-profile-btn__icon {
  flex: 0 0 auto;
  color: var(--ot-muted);
  font-size: 0.75rem;
}

:deep(.app-profile-menu) {
  border: 1px solid var(--ot-border);
  border-radius: 16px;
  background: var(--ot-surface);
  box-shadow: 0 20px 46px rgba(15, 23, 42, 0.14);
}

@media (max-width: 768px) {
  .app-topbar__inner {
    height: 3.75rem;
    padding: 0 0.75rem;
  }

  .app-topbar__right {
    gap: 0.4rem;
  }

  .app-topbar__title {
    max-width: 42vw;
    font-size: 0.92rem;
  }

  .topbar-profile-btn {
    padding: 0.22rem;
  }

  .topbar-profile-btn__name,
  .topbar-profile-btn__icon {
    display: none;
  }
}

@media (max-width: 520px) {
  .app-topbar__divider {
    display: none;
  }

  .app-topbar__title {
    max-width: 34vw;
  }
}
</style>