<!-- frontend/src/layouts/components/AppTopbar.vue -->
<script setup>
// frontend/src/layouts/components/AppTopbar.vue

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'

import AppLanguageSwitcher from '@/shared/components/AppLanguageSwitcher.vue'
import NotificationBell from '@/modules/notification/components/NotificationBell.vue'

import { useThemeStore } from '@/app/store/theme.store'

defineProps({
  desktopCollapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-sidebar', 'toggle-desktop-sidebar'])

const route = useRoute()
const theme = useThemeStore()
const { t } = useI18n()

const pageTitle = computed(() => {
  const titleKey = String(route.meta?.titleKey || '').trim()
  const fallbackTitle = String(route.meta?.title || t('common.appName')).trim()

  return titleKey ? t(titleKey) : fallbackTitle
})

const themeIcon = computed(() => (theme.isDark ? 'pi pi-sun' : 'pi pi-moon'))

const themeLabel = computed(() =>
  theme.isDark ? t('common.switchToLightMode') : t('common.switchToDarkMode'),
)
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
  max-width: min(58vw, 46rem);
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

@media (max-width: 768px) {
  .app-topbar__inner {
    height: 3.75rem;
    padding: 0 0.75rem;
  }

  .app-topbar__right {
    gap: 0.4rem;
  }

  .app-topbar__title {
    max-width: 46vw;
    font-size: 0.92rem;
  }
}

@media (max-width: 520px) {
  .app-topbar__divider {
    display: none;
  }

  .app-topbar__title {
    max-width: 38vw;
  }
}
</style>