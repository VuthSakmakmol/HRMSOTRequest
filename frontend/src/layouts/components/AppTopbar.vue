<!-- frontend/src/layouts/components/AppTopbar.vue -->
<script setup>
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

const breadcrumbItems = computed(() => {
  const matched = Array.isArray(route.matched) ? route.matched : []

  return matched
    .filter((item) => item.meta?.title)
    .map((item) => ({
      title: String(item.meta.title).trim(),
      path: item.path,
    }))
})

const accountInitial = computed(() =>
  String(auth.user?.displayName || auth.user?.loginId || 'U').charAt(0).toUpperCase(),
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
  <header
    class="sticky top-0 z-30 border-b border-[color:var(--ot-border)] bg-white/90 backdrop-blur-md dark:bg-[color:var(--ot-surface)]/92"
  >
    <div class="flex h-[56px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
      <div class="flex min-w-0 items-center gap-2">
        <!-- mobile sidebar open -->
        <Button
          icon="pi pi-bars"
          text
          rounded
          severity="secondary"
          size="small"
          class="lg:!hidden"
          aria-label="Open navigation"
          @click="emit('toggle-sidebar')"
        />

        <!-- desktop collapse toggle -->
        <Button
          :icon="desktopCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"
          text
          rounded
          severity="secondary"
          size="small"
          class="hidden lg:!inline-flex"
          aria-label="Toggle desktop sidebar"
          @click="emit('toggle-desktop-sidebar')"
        />

        <div class="hidden h-7 w-px bg-[color:var(--ot-border)] sm:block" />

        <div class="min-w-0">
          <div
            class="hidden min-w-0 items-center gap-1 text-xs text-[color:var(--ot-text-muted)] sm:flex"
          >
            <template v-if="breadcrumbItems.length">
              <template
                v-for="(item, index) in breadcrumbItems"
                :key="`${item.path}-${index}`"
              >
                <span class="truncate">{{ item.title }}</span>
                <span
                  v-if="index !== breadcrumbItems.length - 1"
                  class="text-[color:var(--ot-text-muted)]/70"
                >
                  /
                </span>
              </template>
            </template>
            <template v-else>
              <span>Workspace</span>
            </template>
          </div>

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
          aria-label="Toggle theme"
          @click="theme.toggle()"
        />

        <Button
          icon="pi pi-bell"
          text
          rounded
          severity="secondary"
          size="small"
          aria-label="Notifications"
        />

        <button
          type="button"
          class="ml-1 flex items-center gap-1 rounded-full border border-transparent px-1 py-1 transition hover:border-[color:var(--ot-border)] hover:bg-black/5 dark:hover:bg-white/5"
          @click="toggleProfileMenu"
        >
          <Avatar
            :label="accountInitial"
            shape="circle"
            class="!h-8 !w-8 !bg-[color:var(--ot-blue)] !text-xs !font-semibold !text-white"
          />
          <i class="pi pi-angle-down hidden text-[10px] text-[color:var(--ot-text-muted)] sm:block" />
        </button>

        <Menu
          ref="profileMenu"
          :model="profileItems"
          popup
          class="w-56"
        />
      </div>
    </div>
  </header>
</template>