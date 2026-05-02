<!-- frontend/src/layouts/components/AppTopbar.vue -->
<script setup>
// frontend/src/layouts/components/AppTopbar.vue
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Menu from 'primevue/menu'

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

const profileMenu = ref(null)

const pageTitle = computed(() => String(route.meta?.title || 'Dashboard').trim())

const accountInitial = computed(() =>
  String(auth.user?.displayName || auth.user?.loginId || 'U').charAt(0).toUpperCase(),
)

const displayName = computed(() =>
  String(auth.user?.displayName || auth.user?.loginId || 'User').trim(),
)

const profileItems = computed(() => [
  {
    label: theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
    icon: theme.isDark ? 'pi pi-sun' : 'pi pi-moon',
    command: () => theme.toggle(),
  },
  {
    label: 'Profile',
    icon: 'pi pi-user',
    command: () => router.push('/profile'),
  },
  { separator: true },
  {
    label: 'Logout',
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
    <div class="flex h-[56px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
      <div class="flex min-w-0 items-center gap-2">
        <Button
          icon="pi pi-bars"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn lg:!hidden"
          aria-label="Open navigation"
          @click="emit('toggle-sidebar')"
        />

        <Button
          :icon="desktopCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn hidden lg:!inline-flex"
          aria-label="Toggle desktop sidebar"
          @click="emit('toggle-desktop-sidebar')"
        />

        <div class="hidden h-7 w-px bg-[color:var(--ot-border)] sm:block" />

        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-[color:var(--ot-text)] sm:text-[15px]">
            {{ pageTitle }}
          </div>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <Button
          :icon="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn"
          aria-label="Toggle theme"
          @click="theme.toggle()"
        />

        <Button
          icon="pi pi-bell"
          text
          rounded
          severity="secondary"
          size="small"
          class="topbar-icon-btn"
          aria-label="Notifications"
        />

        <button
          type="button"
          class="topbar-profile-btn ml-1 flex min-w-0 items-center gap-2 rounded-full border px-1 py-1 transition"
          @click="toggleProfileMenu"
        >
          <Avatar
            :label="accountInitial"
            shape="circle"
            class="!h-8 !w-8 !bg-[color:var(--ot-blue)] !text-xs !font-semibold !text-white"
          />

          <span class="hidden max-w-[120px] truncate text-xs font-medium text-[color:var(--ot-text)] md:block">
            {{ displayName }}
          </span>

          <i class="pi pi-angle-down hidden text-[10px] text-[color:var(--ot-text-muted)] sm:block" />
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

.topbar-profile-btn {
  border-color: transparent;
  background: transparent;
}

.topbar-profile-btn:hover {
  border-color: var(--ot-border);
  background: color-mix(in srgb, var(--ot-text) 6%, transparent);
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
</style>