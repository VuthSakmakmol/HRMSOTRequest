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

const accountInitial = computed(() =>
  String(auth.user?.displayName || auth.user?.loginId || 'U')
    .charAt(0)
    .toUpperCase(),
)

const displayName = computed(() =>
  String(auth.user?.displayName || auth.user?.loginId || 'User').trim(),
)

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
          class="topbar-icon-btn hidden sm:!inline-flex"
          :aria-label="t('common.notifications')"
        />

        <button
          type="button"
          class="topbar-profile-btn"
          :aria-label="t('auth.profile')"
          @click="toggleProfileMenu"
        >
          <Avatar
            :label="accountInitial"
            shape="circle"
            class="!h-8 !w-8 !bg-[color:var(--ot-blue)] !text-xs !font-semibold !text-white"
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
  height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-inline: 0.75rem;
}

.app-topbar__left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.app-topbar__right {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.35rem;
}

.app-topbar__divider {
  display: none;
  height: 1.75rem;
  width: 1px;
  background: var(--ot-border);
}

.app-topbar__title-wrap {
  min-width: 0;
}

.app-topbar__title {
  overflow: hidden;
  max-width: 44vw;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ot-text);
}

.topbar-profile-btn {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  margin-left: 0.15rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  padding: 0.25rem;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.topbar-profile-btn:hover {
  border-color: var(--ot-border);
  background: color-mix(in srgb, var(--ot-text) 6%, transparent);
}

.topbar-profile-btn__name {
  display: none;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--ot-text);
}

.topbar-profile-btn__icon {
  display: none;
  font-size: 0.62rem;
  color: var(--ot-text-muted);
}

:deep(.topbar-icon-btn.p-button) {
  color: var(--ot-text-muted) !important;
}

:deep(.topbar-icon-btn.p-button:hover) {
  color: var(--ot-text) !important;
  background: color-mix(in srgb, var(--ot-text) 7%, transparent) !important;
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

@media (min-width: 640px) {
  .app-topbar__inner {
    padding-inline: 1rem;
  }

  .app-topbar__divider {
    display: block;
  }

  .app-topbar__title {
    max-width: 52vw;
    font-size: 0.94rem;
  }

  .topbar-profile-btn__icon {
    display: inline-block;
  }
}

@media (min-width: 768px) {
  .topbar-profile-btn__name {
    display: inline-block;
  }
}

@media (min-width: 1024px) {
  .app-topbar__inner {
    padding-inline: 1.25rem;
  }

  .app-topbar__title {
    max-width: 58vw;
  }
}
</style>