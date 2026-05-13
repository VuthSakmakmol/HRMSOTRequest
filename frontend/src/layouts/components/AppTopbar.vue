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

  const combinedName = [user.firstName, user.lastName].map(cleanText).filter(Boolean).join(' ')
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

        <Button
          icon="pi pi-bell"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn hidden md:!inline-flex"
          :aria-label="t('common.notifications')"
        />

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
  height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-inline: 0.65rem;
}

.app-topbar__left {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.app-topbar__right {
  display: flex;
  flex: 0 0 auto;
  min-width: 0;
  align-items: center;
  gap: 0.28rem;
}

.app-topbar__divider {
  display: none;
  height: 1.65rem;
  width: 1px;
  flex: 0 0 auto;
  background: var(--ot-border);
}

.app-topbar__title-wrap {
  min-width: 0;
  flex: 1 1 auto;
}

.app-topbar__title {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.2;
  color: var(--ot-text);
}

.topbar-profile-btn {
  display: inline-flex;
  min-width: 0;
  max-width: 42vw;
  align-items: center;
  gap: 0.42rem;
  margin-left: 0.1rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  padding: 0.22rem;
  color: var(--ot-text);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.topbar-profile-btn:hover {
  border-color: var(--ot-border);
  background: color-mix(in srgb, var(--ot-text) 6%, transparent);
}

:deep(.topbar-profile-btn__avatar) {
  height: 2rem !important;
  width: 2rem !important;
  flex: 0 0 auto;
  background: var(--ot-blue) !important;
  color: #ffffff !important;
  font-size: 0.72rem !important;
  font-weight: 650 !important;
}

.topbar-profile-btn__name {
  display: none;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.1;
  color: var(--ot-text);
}

.topbar-profile-btn__icon {
  display: none;
  flex: 0 0 auto;
  font-size: 0.62rem;
  color: var(--ot-text-muted);
}

:deep(.topbar-icon-btn.p-button) {
  width: 2rem !important;
  height: 2rem !important;
  color: var(--ot-text-muted) !important;
}

:deep(.topbar-icon-btn.p-button:hover) {
  color: var(--ot-text) !important;
  background: color-mix(in srgb, var(--ot-text) 7%, transparent) !important;
}

:deep(.app-language-switcher) {
  width: 4.25rem;
  min-width: 4.25rem;
}

:deep(.app-language-switcher .p-select-label) {
  padding-inline: 0.5rem !important;
  font-size: 0.72rem !important;
}

:global(.dark) .app-topbar {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--ot-surface) 92%, #020617 8%),
      color-mix(in srgb, var(--ot-surface) 84%, #020617 16%)
    );
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--ot-border) 70%, transparent),
    0 10px 30px rgb(0 0 0 / 0.16);
}

:global(.app-profile-menu.p-menu) {
  border: 1px solid var(--ot-border) !important;
  background: var(--ot-surface) !important;
  color: var(--ot-text) !important;
  box-shadow: 0 18px 45px rgb(15 23 42 / 0.16) !important;
}

:global(.app-profile-menu .p-menuitem-link) {
  color: var(--ot-text) !important;
}

:global(.app-profile-menu .p-menuitem-link:hover) {
  background: color-mix(in srgb, var(--ot-text) 7%, transparent) !important;
}

:global(.app-profile-menu .p-menuitem-icon),
:global(.app-profile-menu .p-menuitem-text) {
  color: var(--ot-text) !important;
}

:global(.app-profile-menu .p-menu-separator) {
  border-top-color: var(--ot-border) !important;
}

:global(.dark) :global(.app-profile-menu.p-menu) {
  box-shadow: 0 18px 45px rgb(0 0 0 / 0.38) !important;
}

@media (min-width: 480px) {
  .app-topbar__inner {
    gap: 0.65rem;
    padding-inline: 0.75rem;
  }

  .app-topbar__title {
    font-size: 0.86rem;
  }
}

@media (min-width: 640px) {
  .app-topbar__inner {
    padding-inline: 1rem;
  }

  .app-topbar__divider {
    display: block;
  }

  .app-topbar__title {
    font-size: 0.9rem;
  }

  .topbar-profile-btn {
    max-width: 13rem;
    padding-inline: 0.28rem 0.5rem;
  }

  .topbar-profile-btn__name {
    display: inline-block;
    max-width: 7.5rem;
  }

  .topbar-profile-btn__icon {
    display: inline-block;
  }
}

@media (min-width: 768px) {
  .app-topbar__right {
    gap: 0.35rem;
  }

  .topbar-profile-btn__name {
    max-width: 10rem;
  }
}

@media (min-width: 1024px) {
  .app-topbar__inner {
    padding-inline: 1.25rem;
  }

  .topbar-profile-btn {
    max-width: 16rem;
  }

  .topbar-profile-btn__name {
    max-width: 12rem;
  }
}

@media (max-width: 380px) {
  :deep(.app-language-switcher) {
    width: 3.75rem;
    min-width: 3.75rem;
  }

  .app-topbar__inner {
    gap: 0.35rem;
    padding-inline: 0.45rem;
  }

  .app-topbar__left {
    gap: 0.28rem;
  }

  .app-topbar__right {
    gap: 0.18rem;
  }

  .app-topbar__title {
    font-size: 0.78rem;
  }

  :deep(.topbar-icon-btn.p-button) {
    width: 1.85rem !important;
    height: 1.85rem !important;
  }

  :deep(.topbar-profile-btn__avatar) {
    height: 1.85rem !important;
    width: 1.85rem !important;
  }
}
</style>